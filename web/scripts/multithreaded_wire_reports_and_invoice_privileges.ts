import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role } from "@prisma/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const currentFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

import { signAccessToken } from "../lib/auth.ts";

function createAuthToken(userId: string, role: Role): string {
  return signAccessToken({ sub: userId, role });
}

function mockReq(url: string, token: string): any {
  const headers = new Map<string, string>();
  headers.set("authorization", `Bearer ${token}`);
  return {
    url,
    headers: {
      get: (h: string) => headers.get(h.toLowerCase()) ?? null,
    },
    cookies: {
      get: () => undefined,
    },
  };
}

if (!isMainThread) {
  const { threadId, workerType, dbUrl } = workerData;
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  (async () => {
    const startTime = Date.now();
    try {
      if (workerType === "THREAD_MR_REPORTS_VERIFIER") {
        console.log(`[Thread ${threadId}: THREAD_MR_REPORTS_VERIFIER] Verifying MR Call Reports & Deal Closures runtime access...`);

        // Find MR users
        const mrUsers = await prisma.user.findMany({
          where: { role: Role.MR },
          include: { employee: true },
        });

        if (mrUsers.length === 0) throw new Error("No MR users found in database");
        console.log(`[Thread ${threadId}] Found ${mrUsers.length} MR users in database.`);

        for (const u of mrUsers) {
          if (!u.employee) continue;
          const visitsCount = await prisma.visit.count({
            where: { employeeId: u.employee.id },
          });
          const doctorCalls = await prisma.visit.count({
            where: { employeeId: u.employee.id, doctorId: { not: null } },
          });
          const chemistCalls = await prisma.visit.count({
            where: { employeeId: u.employee.id, chemistId: { not: null } },
          });

          console.log(`[Thread ${threadId}] MR ${u.employee.firstName} ${u.employee.lastName} (${u.email}): ${visitsCount} visits (${doctorCalls} Dr, ${chemistCalls} Chemist)`);
        }

        // Test API route handler runtime behavior
        const { GET: getCallReports } = await import("../app/api/mr/reports/calls/route.ts");
        const { GET: getDealClosures } = await import("../app/api/mr/reports/deal-closure/route.ts");

        const testMR = mrUsers[0];
        const otherMR = mrUsers[1] || mrUsers[0];
        const mrToken = createAuthToken(testMR.id, Role.MR);

        // 1. MR fetches own report
        const ownReq = mockReq("http://localhost:5555/api/mr/reports/calls?period=all", mrToken);
        const ownRes = await getCallReports(ownReq, { params: {} });
        if (ownRes.status !== 200) {
          throw new Error(`MR viewing own call report failed with status ${ownRes.status}`);
        }
        console.log(`[Thread ${threadId}] PASS: MR successfully views own call report (HTTP 200).`);

        // 2. MR attempts to fetch another MR's report
        if (testMR.employee && otherMR.employee && testMR.id !== otherMR.id) {
          const snoopingReq = mockReq(
            `http://localhost:5555/api/mr/reports/calls?period=all&employeeId=${otherMR.employee.id}`,
            mrToken
          );
          const snoopingRes = await getCallReports(snoopingReq, { params: {} });
          if (snoopingRes.status !== 403) {
            throw new Error(`MR requesting another employee's calls should return 403 Forbidden, got ${snoopingRes.status}`);
          }
          console.log(`[Thread ${threadId}] PASS: MR requesting another MR's report is blocked (HTTP 403 Forbidden).`);
        }

        // 3. Deal closure report verification
        const dcReq = mockReq("http://localhost:5555/api/mr/reports/deal-closure", mrToken);
        const dcRes = await getDealClosures(dcReq, { params: {} });
        if (dcRes.status !== 200) {
          throw new Error(`MR viewing deal closures failed with status ${dcRes.status}`);
        }
        console.log(`[Thread ${threadId}] PASS: MR views deal closures with automatic personal scoping (HTTP 200).`);

        parentPort?.postMessage({
          success: true,
          threadId,
          workerType,
          mrCount: mrUsers.length,
          durationMs: Date.now() - startTime,
        });
      } else if (workerType === "THREAD_INVOICE_PRIVILEGES_VERIFIER") {
        console.log(`[Thread ${threadId}: THREAD_INVOICE_PRIVILEGES_VERIFIER] Verifying Invoice Deletion Privileges & Statutory Protection...`);

        // 1. Verify in DB that invoices exist
        const invoiceCount = await prisma.invoice.count();
        console.log(`[Thread ${threadId}] Total statutory invoices in DB: ${invoiceCount}`);

        const sampleInvoice = await prisma.invoice.findFirst({
          include: { order: true },
        });

        if (sampleInvoice) {
          console.log(`[Thread ${threadId}] Sample Invoice #${sampleInvoice.invoiceNo} (Amount: ₹${sampleInvoice.amount}, Paid: ${sampleInvoice.paid})`);

          // 2. Test runtime DELETE /api/invoices/[id] handler with MR credentials
          const { DELETE: deleteInvoice } = await import("../app/api/invoices/[id]/route.ts");

          const mrUser = await prisma.user.findFirst({ where: { role: Role.MR } });
          if (mrUser) {
            const mrToken = createAuthToken(mrUser.id, Role.MR);
            const deleteReq = mockReq(`http://localhost:5555/api/invoices/${sampleInvoice.id}`, mrToken);
            const deleteRes = await deleteInvoice(deleteReq, { params: { id: sampleInvoice.id } });
            if (deleteRes.status !== 403) {
              throw new Error(`Expected HTTP 403 Forbidden when MR attempts to delete invoice, got ${deleteRes.status}`);
            }
            console.log(`[Thread ${threadId}] PASS: Runtime invoice deletion by MR rejected with HTTP 403 Forbidden.`);
          }
        }

        // 3. Inspect route code directly to verify Role.MR is strictly excluded from withAuth
        const invoiceRouteFile = path.resolve(currentDirname, "../app/api/invoices/[id]/route.ts");
        const invoiceRouteCode = fs.readFileSync(invoiceRouteFile, "utf-8");

        const hasMRInDeleteRoles = /export\s+const\s+DELETE\s*=\s*withAuth\([^)]*Role\.MR[^)]*\)/.test(invoiceRouteCode);
        const hasMRForbiddenCheck = /req\.user\.role\s*===\s*Role\.MR/.test(invoiceRouteCode);

        if (hasMRInDeleteRoles) {
          throw new Error("Security Violation: Role.MR found in DELETE withAuth roles list!");
        }

        if (!hasMRForbiddenCheck) {
          throw new Error("Security Violation: Explicit Role.MR forbidden check missing in deleteInvoice handler!");
        }

        console.log(`[Thread ${threadId}] PASS: Role.MR revoked from DELETE /api/invoices/[id] withAuth.`);

        // 4. Verify orders page frontend hides Delete button for MR
        const ordersPageFile = path.resolve(currentDirname, "../app/(dashboard)/orders/page.tsx");
        const ordersPageCode = fs.readFileSync(ordersPageFile, "utf-8");
        const hasCanDeleteCheck = ordersPageCode.includes("const canDeleteInvoices = isAdmin || role === \"ASM\";");
        const hasWrappedDeleteButton = ordersPageCode.includes("{canDeleteInvoices && (");

        if (!hasCanDeleteCheck || !hasWrappedDeleteButton) {
          throw new Error("UI Security Gap: Orders page does not properly guard Delete button with canDeleteInvoices!");
        }

        console.log(`[Thread ${threadId}] PASS: Frontend orders page hides invoice delete button for MR.`);

        parentPort?.postMessage({
          success: true,
          threadId,
          workerType,
          invoiceCount,
          durationMs: Date.now() - startTime,
        });
      } else if (workerType === "THREAD_DB_PROVISIONING_VERIFIER") {
        console.log(`[Thread ${threadId}: THREAD_DB_PROVISIONING_VERIFIER] Verifying Database Provisioning, Disturbance Hiding & Version...`);

        // Check Tour Plans & schedules provisioning
        const tourPlansCount = await prisma.tourPlan.count();
        const tourPlanDaysCount = await prisma.tourPlanDay.count();
        const visitsCount = await prisma.visit.count();
        const ordersCount = await prisma.order.count();
        console.log(`[Thread ${threadId}] DB Provisioned: ${tourPlansCount} Tour Plans, ${tourPlanDaysCount} Day Schedules, ${visitsCount} Visits, ${ordersCount} Orders.`);

        // Verify Tour Plans UI file hides "Multi-Agent Tour Intelligence Status"
        const tourPlansPageFile = path.resolve(currentDirname, "../app/(dashboard)/tour-plans/page.tsx");
        const tourPlansPageCode = fs.readFileSync(tourPlansPageFile, "utf-8");

        const hasTourIntelligenceStatus = tourPlansPageCode.includes("Multi-Agent Tour Intelligence Status");
        if (hasTourIntelligenceStatus) {
          throw new Error("Disturbance still present: Multi-Agent Tour Intelligence Status found in tour-plans/page.tsx!");
        }
        console.log(`[Thread ${threadId}] PASS: 'Multi-Agent Tour Intelligence Status' visual cards are hidden.`);

        // Verify MR Reports Page title scoping
        const mrReportsPageFile = path.resolve(currentDirname, "../app/(dashboard)/mr/reports/page.tsx");
        const mrReportsPageCode = fs.readFileSync(mrReportsPageFile, "utf-8");

        const hasDynamicTitle = mrReportsPageCode.includes("isMR ? \"My Customer Call Reports & Deal Closures\" : \"All MRs — Call Reports & Deal Closures\"");
        if (!hasDynamicTitle) {
          throw new Error("MR Reports Title is not dynamically scoped for MR users!");
        }
        console.log(`[Thread ${threadId}] PASS: MR Reports page has dynamic role-scoped title.`);

        // Verify package.json version
        const pkgFile = path.resolve(currentDirname, "../package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
        console.log(`[Thread ${threadId}] Package Version: ${pkg.version}`);
        if (!pkg.version || pkg.version === "0.1.0") {
          throw new Error("Package version was not bumped!");
        }
        console.log(`[Thread ${threadId}] PASS: Major version updated to ${pkg.version}.`);

        parentPort?.postMessage({
          success: true,
          threadId,
          workerType,
          tourPlansCount,
          tourPlanDaysCount,
          version: pkg.version,
          durationMs: Date.now() - startTime,
        });
      } else {
        throw new Error(`Unknown workerType: ${workerType}`);
      }
    } catch (err: any) {
      console.error(`[Thread ${threadId}] Error:`, err);
      parentPort?.postMessage({
        success: false,
        threadId,
        workerType,
        error: err.message || String(err),
      });
    } finally {
      await prisma.$disconnect();
    }
  })();
} else {
  // Main Thread
  async function runAllThreads() {
    console.log("==========================================================================");
    console.log("🚀 MULTI-THREADED WIRING & VALIDATION: MR PRIVILEGES, REPORTS & DB STATUS");
    console.log("==========================================================================");

    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr";

    const workerTypes = [
      "THREAD_MR_REPORTS_VERIFIER",
      "THREAD_INVOICE_PRIVILEGES_VERIFIER",
      "THREAD_DB_PROVISIONING_VERIFIER",
    ];

    const results = await Promise.all(
      workerTypes.map((type, index) => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(currentFilename, {
            workerData: {
              threadId: index + 1,
              workerType: type,
              dbUrl,
            },
          });

          worker.on("message", (msg) => resolve(msg));
          worker.on("error", (err) => reject(err));
          worker.on("exit", (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
          });
        });
      })
    );

    console.log("\n==========================================================================");
    console.log("📊 ALL WORKER THREADS COMPLETED:");
    console.log("==========================================================================");
    let allPassed = true;
    for (const r of results as any[]) {
      if (r.success) {
        console.log(`✔ [Thread ${r.threadId}: ${r.workerType}] PASSED (${r.durationMs}ms)`);
      } else {
        console.error(`❌ [Thread ${r.threadId}: ${r.workerType}] FAILED: ${r.error}`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      process.exit(1);
    } else {
      console.log("\n✨ ALL MULTI-THREADED WIRING & SECURITY CONSTRAINTS VERIFIED SUCCESSFULLY!\n");
      process.exit(0);
    }
  }

  runAllThreads().catch((e) => {
    console.error("Main execution failure:", e);
    process.exit(1);
  });
}
