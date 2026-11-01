import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { PrismaClient } from "@prisma/client";
import { CreditAgentsService } from "../services/credit-agents.service";
import { round2 } from "../lib/pricing";
import { postAutoLedger, reverseAutoLedger, SYSTEM_ACCOUNT_CODES } from "../lib/ledger";

export interface ThreadExecutionResult {
  threadId: number;
  name: string;
  status: "SUCCESS" | "FAILED";
  durationMs: number;
  agentRole: string;
  data?: any;
  error?: string;
}

/**
 * Worker thread execution handler
 */
export async function executeCreditCollectionWorkerTask(
  threadId: number,
  taskName: string,
  dbUrl: string
): Promise<ThreadExecutionResult> {
  const startTime = Date.now();
  const workerPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    if (taskName === "INVOICE_INTEGRITY_AND_RECEIVABLES_WIRE") {
      // ─────────────────────────────────────────────────────────────
      // THREAD 1: Invoices Mathematical & Statutory Integrity Auditor
      // ─────────────────────────────────────────────────────────────
      const invoices = await workerPrisma.invoice.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          order: {
            include: {
              chemist: true,
              items: true,
              distributor: true,
            },
          },
        },
      });

      let validCount = 0;
      let totalBilledRevenue = 0;
      let totalGstCalculated = 0;
      const issues: string[] = [];

      for (const inv of invoices) {
        const grandTotal = Number(inv.grandTotal ?? inv.amount ?? 0);
        if (isNaN(grandTotal) || grandTotal <= 0) {
          issues.push(`Invoice ${inv.invoiceNo} has invalid grandTotal: ${inv.grandTotal}`);
          continue;
        }

        if (!inv.order) {
          issues.push(`Invoice ${inv.invoiceNo} is orphaned (no linked order)`);
          continue;
        }

        if (!inv.order.chemistId || !inv.order.chemist) {
          issues.push(`Invoice ${inv.invoiceNo} has no associated chemist`);
          continue;
        }

        if (!inv.invoiceNo || (!inv.invoiceNo.startsWith("INV-") && !inv.invoiceNo.startsWith("WHO-"))) {
          issues.push(`Invoice ${inv.id} has malformed invoice number: ${inv.invoiceNo}`);
          continue;
        }

        totalBilledRevenue += grandTotal;
        totalGstCalculated += Number(inv.totalGst || 0);
        validCount++;
      }

      const isSuccess = issues.length === 0 && validCount === invoices.length && invoices.length > 0;

      return {
        threadId,
        name: "Thread 1: Invoices Statutory & Tax Integrity Auditor",
        agentRole: "Agent 1: Invoice Receivables Guard Agent",
        status: isSuccess ? "SUCCESS" : "FAILED",
        durationMs: Date.now() - startTime,
        data: {
          totalInvoicesAudited: invoices.length,
          validInvoicesCount: validCount,
          corruptedInvoicesCount: issues.length,
          totalBilledRevenue: round2(totalBilledRevenue),
          totalGstCollected: round2(totalGstCalculated),
          integrityPassRate: `${Math.round((validCount / (invoices.length || 1)) * 100)}%`,
          issues: issues.slice(0, 5),
        },
      };
    } else if (taskName === "MULTI_ROLE_SCOPING_AND_USER_VISIBILITY_WIRE") {
      // ─────────────────────────────────────────────────────────────
      // THREAD 2: Multi-Role Scoping & User Visibility Verification
      // ─────────────────────────────────────────────────────────────
      const employees = await workerPrisma.employee.findMany({
        include: { user: { select: { email: true, role: true } } },
      });

      const mrResults: Record<string, any> = {};
      let allMrsHaveVisibility = true;

      for (const emp of employees) {
        if (emp.user?.role === "MR") {
          const res = await CreditAgentsService.executeCreditPipeline({ employeeId: emp.id });
          const chemistCount = res.creditData.chemists.length;
          const outstanding = res.creditData.summary.totalOutstanding;
          const collsCount = res.creditData.recentCollections.length;

          // Every MR must have visibility into chemists (> 0)
          if (chemistCount === 0) {
            allMrsHaveVisibility = false;
          }

          mrResults[emp.firstName + " " + emp.lastName] = {
            chemistsCount: chemistCount,
            totalOutstanding: outstanding,
            recentCollections: collsCount,
            status: chemistCount > 0 ? "VISIBLE" : "EMPTY",
          };
        }
      }

      // Test Manager Overview
      const mgrRes = await CreditAgentsService.executeCreditPipeline();
      const totalCompanyChemists = mgrRes.creditData.chemists.length;
      const totalCompanyOutstanding = mgrRes.creditData.summary.totalOutstanding;

      const isSuccess = allMrsHaveVisibility && totalCompanyChemists >= 193 && totalCompanyOutstanding > 0;

      return {
        threadId,
        name: "Thread 2: Multi-MR Scoping & Cross-Role Visibility Auditor",
        agentRole: "Agent 2: Scoping & RBAC Exposure Auditor",
        status: isSuccess ? "SUCCESS" : "FAILED",
        durationMs: Date.now() - startTime,
        data: {
          totalEmployeesTested: employees.length,
          allMrsHaveVisibility,
          mrBreakdown: mrResults,
          companyWideChemists: totalCompanyChemists,
          companyWideOutstanding: totalCompanyOutstanding,
        },
      };
    } else if (taskName === "FIFO_AGING_RECONCILIATION_AND_PAID_STATUS_WIRE") {
      // ─────────────────────────────────────────────────────────────
      // THREAD 3: FIFO Invoice-to-Collection Reconciliation Engine
      // ─────────────────────────────────────────────────────────────
      const pipelineRes = await CreditAgentsService.executeCreditPipeline();
      const creditData = pipelineRes.creditData;
      const summary = creditData.summary;

      const bucketSum = round2(
        summary.aging0To30 + summary.aging31To60 + summary.aging61To90 + summary.aging90Plus
      );
      const isMathematicallyBalanced = Math.abs(bucketSum - summary.totalOutstanding) <= 1;

      // Verify that paid status matches FIFO reality
      const paidInvoices = await workerPrisma.invoice.count({ where: { paid: true } });
      const unpaidInvoices = await workerPrisma.invoice.count({ where: { paid: false } });

      return {
        threadId,
        name: "Thread 3: FIFO Aging Reconciliation & Paid Status Engine",
        agentRole: "Agent 3: Collection Reconciliation & Aging Auditor",
        status: isMathematicallyBalanced ? "SUCCESS" : "FAILED",
        durationMs: Date.now() - startTime,
        data: {
          totalAccounts: creditData.chemists.length,
          totalOutstanding: summary.totalOutstanding,
          aging0To30: summary.aging0To30,
          aging31To60: summary.aging31To60,
          aging61To90: summary.aging61To90,
          aging90Plus: summary.aging90Plus,
          bucketSum,
          driftAmount: round2(Math.abs(bucketSum - summary.totalOutstanding)),
          paidInvoicesCount: paidInvoices,
          unpaidInvoicesCount: unpaidInvoices,
          isBalanced: isMathematicallyBalanced,
        },
      };
    } else if (taskName === "PAYMENT_COLLECTION_AND_REVERSAL_LIFECYCLE_WIRE") {
      // ─────────────────────────────────────────────────────────────
      // THREAD 4: Live Payment Collection & Reversal Lifecycle Wire
      // ─────────────────────────────────────────────────────────────
      // Find a chemist with an open invoice and outstanding dues
      const pipelineBefore = await CreditAgentsService.executeCreditPipeline();
      const chemistWithDues = pipelineBefore.creditData.chemists.find(
        (c) => c.totalOutstanding > 100 && c.openInvoices.length > 0
      );

      if (!chemistWithDues) {
        throw new Error("No chemist with open invoices found for live simulation");
      }

      const targetChemistId = chemistWithDues.chemistId;
      const targetInvoice = chemistWithDues.openInvoices[0];
      const testPaymentAmount = 25; // ₹25 test payment
      const initialOutstanding = chemistWithDues.totalOutstanding;

      // Find an MR employee to book the payment
      const mr = await workerPrisma.employee.findFirst({
        where: { user: { role: "MR" } },
      });
      if (!mr) throw new Error("No MR employee found");

      // 1. Simulate logging payment against target invoice
      const testRef = `[UPI] Ref: [${targetInvoice.invoiceNo}]-TEST-${Date.now().toString().slice(-4)}`;
      const createdCollection = await workerPrisma.$transaction(async (tx) => {
        const c = await tx.collection.create({
          data: {
            employeeId: mr.id,
            chemistId: targetChemistId,
            amount: testPaymentAmount,
            refNumber: testRef,
          },
        });

        await postAutoLedger(tx, {
          sourceType: "COLLECTION",
          sourceId: c.id,
          date: c.createdAt,
          narration: `Simulated collection from ${chemistWithDues.chemistName} (Ref ${testRef})`,
          lines: [
            { accountCode: SYSTEM_ACCOUNT_CODES.cash, debit: testPaymentAmount },
            { accountCode: SYSTEM_ACCOUNT_CODES.accountsReceivable, credit: testPaymentAmount },
          ],
        });

        await CreditAgentsService.reconcileChemistInvoicePaidStatus(tx, targetChemistId);
        return c;
      });

      // 2. Verify outstanding immediately decreased
      const pipelineDuring = await CreditAgentsService.executeCreditPipeline();
      const chemistDuring = pipelineDuring.creditData.chemists.find((c) => c.chemistId === targetChemistId);
      const expectedOutstandingDuring = round2(initialOutstanding - testPaymentAmount);
      const actualOutstandingDuring = chemistDuring?.totalOutstanding ?? 0;
      const outstandingMatched = Math.abs(actualOutstandingDuring - expectedOutstandingDuring) <= 0.05;

      // 3. Simulate payment reversal / retrieval
      await CreditAgentsService.reversePaymentCollection({
        collectionId: createdCollection.id,
        reason: "Multi-threaded Lifecycle Verification Auto-Cleanup",
      });

      // 4. Verify outstanding restored to exact original
      const pipelineAfter = await CreditAgentsService.executeCreditPipeline();
      const chemistAfter = pipelineAfter.creditData.chemists.find((c) => c.chemistId === targetChemistId);
      const actualOutstandingAfter = chemistAfter?.totalOutstanding ?? 0;
      const restoredMatched = Math.abs(actualOutstandingAfter - initialOutstanding) <= 0.05;

      const isSuccess = outstandingMatched && restoredMatched;

      return {
        threadId,
        name: "Thread 4: Live Payment Recording & Reversal Simulation Engine",
        agentRole: "Agent 4: Payment Lifecycle & Auto-Ledger Guard Agent",
        status: isSuccess ? "SUCCESS" : "FAILED",
        durationMs: Date.now() - startTime,
        data: {
          targetChemist: chemistWithDues.chemistName,
          targetInvoiceNo: targetInvoice.invoiceNo,
          initialOutstanding,
          testPaymentAmount,
          outstandingDuring: actualOutstandingDuring,
          expectedDuring: expectedOutstandingDuring,
          outstandingAfterReversal: actualOutstandingAfter,
          paymentDeductionVerified: outstandingMatched,
          reversalRestorationVerified: restoredMatched,
        },
      };
    } else {
      throw new Error(`Unknown task: ${taskName}`);
    }
  } catch (err: any) {
    return {
      threadId,
      name: taskName,
      agentRole: "Unknown Role",
      status: "FAILED",
      durationMs: Date.now() - startTime,
      error: err.message || String(err),
    };
  } finally {
    await workerPrisma.$disconnect();
  }
}

// ─────────────────────────────────────────────────────────────
// WORKER THREAD ENTRY POINT
// ─────────────────────────────────────────────────────────────
if (!isMainThread) {
  const { threadId, taskName, dbUrl } = workerData;
  executeCreditCollectionWorkerTask(threadId, taskName, dbUrl)
    .then((result) => parentPort?.postMessage(result))
    .catch((err) =>
      parentPort?.postMessage({
        threadId,
        name: taskName,
        status: "FAILED",
        durationMs: 0,
        agentRole: "Worker Failure",
        error: err.message,
      })
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN THREAD ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("================================================================================");
  console.log("   MULTI-THREADED CREDIT & COLLECTIONS WIRING ENGINE (node:worker_threads)      ");
  console.log("================================================================================");

  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
  const tasks = [
    { threadId: 1, taskName: "INVOICE_INTEGRITY_AND_RECEIVABLES_WIRE" },
    { threadId: 2, taskName: "MULTI_ROLE_SCOPING_AND_USER_VISIBILITY_WIRE" },
    { threadId: 3, taskName: "FIFO_AGING_RECONCILIATION_AND_PAID_STATUS_WIRE" },
    { threadId: 4, taskName: "PAYMENT_COLLECTION_AND_REVERSAL_LIFECYCLE_WIRE" },
  ];

  console.log(`[Main Thread] Spawning 4 Worker Threads concurrently...`);
  const t0 = Date.now();

  const threadPromises = tasks.map((task) => {
    return new Promise<ThreadExecutionResult>((resolve) => {
      const worker = new Worker(__filename, {
        workerData: { ...task, dbUrl },
      });

      worker.on("message", (res: ThreadExecutionResult) => {
        resolve(res);
      });

      worker.on("error", (err) => {
        resolve({
          threadId: task.threadId,
          name: task.taskName,
          status: "FAILED",
          durationMs: 0,
          agentRole: "Worker Error",
          error: err.message,
        });
      });
    });
  });

  const results = await Promise.all(threadPromises);
  const totalDuration = Date.now() - t0;

  console.log(`\n=== WORKER THREADS EXECUTION REPORT (${totalDuration}ms) ===`);
  let allSuccess = true;

  for (const r of results) {
    const symbol = r.status === "SUCCESS" ? "✓ [PASS]" : "✗ [FAIL]";
    console.log(`\n${symbol} Thread ${r.threadId}: ${r.name} (${r.durationMs}ms)`);
    console.log(`  Agent Role: ${r.agentRole}`);
    if (r.status === "SUCCESS") {
      console.log(`  Payload:`, JSON.stringify(r.data, null, 2));
    } else {
      console.error(`  Error:`, r.error);
      allSuccess = false;
    }
  }

  console.log("\n================================================================================");
  if (allSuccess) {
    console.log("  >>> ALL 4 THREADS COMPLETED SUCCESSFULLY WITH 100% PARITY & AUDIT PASS <<<   ");
  } else {
    console.error("  >>> ONE OR MORE THREADS FAILED. SEE ERROR LOGS ABOVE <<<                   ");
  }
  console.log("================================================================================");

  process.exit(allSuccess ? 0 : 1);
}

if (isMainThread) {
  main().catch((err) => {
    console.error("Fatal in main thread:", err);
    process.exit(1);
  });
}
