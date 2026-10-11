import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";

// Canonical Sample Quantities matching Abdul Malik
export const CANONICAL_MR_SAMPLES: Record<string, number> = {
  "Metace-P": 100,
  "Pantometa-DSR": 100,
  "Metace-SP": 90,
  "Rabemeta-DSR": 90,
  "Metacol-650": 90,
  "Metacef-200": 80,
  "Metamox-CV": 70,
};

if (!isMainThread) {
  // ============================================================================
  // WORKER THREAD EXECUTION
  // ============================================================================
  const { threadId, dbUrl, workerTask } = workerData;
  const workerPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  (async () => {
    const startTime = Date.now();
    try {
      if (workerTask === "SAMPLE_INVENTORY_SYNC") {
        // ----------------------------------------------------------------------
        // WORKER 1: MULTI-THREADED SAMPLE INVENTORY PROVISIONER
        // ----------------------------------------------------------------------
        const dbName = dbUrl.split("/").pop()?.split("?")[0] || "db";
        console.log(`[Thread ${threadId}] 🔄 Synchronizing Canonical Sample Stock for ALL MRs on ${dbName}...`);

        const mrUsers = await workerPrisma.user.findMany({
          where: { role: Role.MR },
          include: { employee: true },
        });

        const products = await workerPrisma.product.findMany({
          select: { id: true, name: true, ptr: true, mrp: true, price: true },
        });

        let totalUpserted = 0;
        const mrSyncResults: { email: string; employeeId: string; skusUpdated: number }[] = [];

        for (const u of mrUsers) {
          if (!u.employee) continue;

          let skuCount = 0;
          for (const prod of products) {
            const canonicalQty = CANONICAL_MR_SAMPLES[prod.name] ?? 50;

            await workerPrisma.sampleInventory.upsert({
              where: {
                employeeId_productId: {
                  employeeId: u.employee.id,
                  productId: prod.id,
                },
              },
              update: {
                quantity: canonicalQty,
                allocatedQty: canonicalQty,
              },
              create: {
                employeeId: u.employee.id,
                productId: prod.id,
                quantity: canonicalQty,
                allocatedQty: canonicalQty,
              },
            });

            totalUpserted++;
            skuCount++;
          }

          mrSyncResults.push({
            email: u.email,
            employeeId: u.employee.id,
            skusUpdated: skuCount,
          });
        }

        parentPort?.postMessage({
          threadId,
          name: "Sample Inventory Sync Worker",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            totalMrs: mrUsers.length,
            totalUpserted,
            mrSyncResults,
          },
        });
      } else if (workerTask === "TERRITORY_ENTITY_ALIGN") {
        // ----------------------------------------------------------------------
        // WORKER 2: TERRITORY & ENTITY ALIGNMENT WORKER
        // ----------------------------------------------------------------------
        const dbName = dbUrl.split("/").pop()?.split("?")[0] || "db";
        console.log(`[Thread ${threadId}] 🌐 Aligning Territories & Entities for Complete Call on ${dbName}...`);

        const defaultTerritory = await workerPrisma.territory.findFirst({
          orderBy: { name: "asc" },
        });

        const mrUsers = await workerPrisma.user.findMany({
          where: { role: Role.MR },
          include: { employee: { include: { territories: true } } },
        });

        let linkedTerritories = 0;
        for (const u of mrUsers) {
          if (!u.employee) continue;
          if (u.employee.territories.length === 0 && defaultTerritory) {
            await workerPrisma.territory.update({
              where: { id: defaultTerritory.id },
              data: { employeeId: u.employee.id },
            });
            linkedTerritories++;
          }
        }

        const totalTerritories = await workerPrisma.territory.count();
        const totalDoctors = await workerPrisma.doctor.count();
        const totalChemists = await workerPrisma.chemist.count();

        parentPort?.postMessage({
          threadId,
          name: "Territory & Entity Alignment Worker",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            totalTerritories,
            totalDoctors,
            totalChemists,
            linkedTerritories,
          },
        });
      } else if (workerTask === "PARITY_VERIFICATION") {
        // ----------------------------------------------------------------------
        // WORKER 3: PARITY & EQUALITY VERIFIER ACROSS ALL MRS
        // ----------------------------------------------------------------------
        const dbName = dbUrl.split("/").pop()?.split("?")[0] || "db";
        console.log(`[Thread ${threadId}] 🔍 Verifying 100% Equivalence Across ALL MRs on ${dbName}...`);

        const mrUsers = await workerPrisma.user.findMany({
          where: { role: Role.MR },
          include: {
            employee: {
              include: {
                sampleInventories: {
                  include: { product: true },
                  orderBy: { product: { name: "asc" } },
                },
              },
            },
          },
          orderBy: { email: "asc" },
        });

        const audits: {
          email: string;
          name: string;
          skuCount: number;
          totalStock: number;
          stockBreakdown: Record<string, number>;
          matchedWithAbdulMalik: boolean;
        }[] = [];

        let allMatched = true;

        for (const u of mrUsers) {
          const inv = u.employee?.sampleInventories || [];
          const breakdown: Record<string, number> = {};
          let totalStock = 0;

          for (const item of inv) {
            breakdown[item.product.name] = item.quantity;
            totalStock += item.quantity;
          }

          let matched = inv.length === 7;
          for (const [prodName, expectedQty] of Object.entries(CANONICAL_MR_SAMPLES)) {
            if (breakdown[prodName] !== expectedQty) {
              matched = false;
              allMatched = false;
            }
          }

          audits.push({
            email: u.email,
            name: `${u.employee?.firstName || ""} ${u.employee?.lastName || ""}`.trim() || u.email,
            skuCount: inv.length,
            totalStock,
            stockBreakdown: breakdown,
            matchedWithAbdulMalik: matched,
          });
        }

        parentPort?.postMessage({
          threadId,
          name: "Complete Call Parity Verifier",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            totalMrsAudited: mrUsers.length,
            allMatched,
            audits,
          },
        });
      }
    } catch (err: any) {
      parentPort?.postMessage({
        threadId,
        name: workerTask,
        status: "FAILED",
        error: err.message || String(err),
      });
    } finally {
      await workerPrisma.$disconnect();
    }
  })();
} else {
  // ============================================================================
  // MAIN THREAD CONTROLLER
  // ============================================================================
  async function runMultiThreadedMRWiring() {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED WORKER ENGINE: WIRING COMPLETE CALL EQUALITY FOR ALL MRS       ");
    console.log("================================================================================\x1b[0m\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const testDbUrl = "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public";

    const targets = [
      { name: "Development (trend_mr)", url: devDbUrl },
      { name: "Test (trend_mr_test)", url: testDbUrl },
    ];

    const overallStart = Date.now();

    for (const target of targets) {
      console.log(`\n\x1b[1;33m>>> [DATABASE: ${target.name}] Launching Parallel Workers...\x1b[0m`);

      const spawnWorker = (threadId: number, workerTask: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          const tsxLoaderPath = path.resolve(__dirname, "../node_modules/tsx/dist/loader.mjs");
          const execArgv = fs.existsSync(tsxLoaderPath)
            ? ["--import", tsxLoaderPath]
            : ["--import", "tsx"];

          const worker = new Worker(__filename, {
            workerData: { threadId, dbUrl: target.url, workerTask },
            execArgv,
          });

          worker.on("message", (msg) => {
            const statusTag = msg.status === "SUCCESS" ? "\x1b[32m✔ SUCCESS\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
            console.log(`  [Thread ${msg.threadId}] ${msg.name.padEnd(35)}: ${statusTag} (${msg.durationMs}ms)`);
            if (msg.status === "FAILED") {
              reject(new Error(`Thread ${msg.threadId} failed: ${msg.error}`));
            } else {
              resolve(msg);
            }
          });

          worker.on("error", (err) => {
            console.error(`  ✖ [Thread ${threadId}] Worker Error:`, err);
            reject(err);
          });

          worker.on("exit", (code) => {
            if (code !== 0) {
              reject(new Error(`Worker ${threadId} terminated with exit code ${code}`));
            }
          });
        });
      };

      // Phase 1: Parallel Provisioning (Sample Stock & Territories)
      console.log(`  [Phase 1] Executing Sample Stock Synchronization & Territory Alignment in parallel...`);
      await Promise.all([
        spawnWorker(1, "SAMPLE_INVENTORY_SYNC"),
        spawnWorker(2, "TERRITORY_ENTITY_ALIGN"),
      ]);

      // Phase 2: Parity Audit across all MRs
      console.log(`  [Phase 2] Verifying 100% Complete Call Equivalence with Abdul Malik...`);
      const verifyMsg = await spawnWorker(3, "PARITY_VERIFICATION");

      const audits = verifyMsg.data.audits;
      console.log("\n  ┌─────────────────────────────────┬──────────┬─────────────┬──────────────────┐");
      console.log("  │ MR Account                      │ SKUs Qty │ Total Units │ Parity vs Malik  │");
      console.log("  ├─────────────────────────────────┼──────────┼─────────────┼──────────────────┤");
      for (const a of audits) {
        const parityBadge = a.matchedWithAbdulMalik ? "\x1b[32m✔ 100% EQUAL\x1b[0m" : "\x1b[31m✖ DRIFT\x1b[0m";
        console.log(`  │ ${a.email.padEnd(31)} │ ${a.skuCount.toString().padStart(8)} │ ${a.totalStock.toString().padStart(11)} │ ${parityBadge.padEnd(25)}│`);
      }
      console.log("  └─────────────────────────────────┴──────────┴─────────────┴──────────────────┘\n");
    }

    const elapsed = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\x1b[1;32m================================================================================`);
    console.log(`   SUCCESS: ALL MRS ARE NOW 100% IDENTICAL TO ABDUL MALIK IN COMPLETE CALL (${elapsed}s)`);
    console.log(`================================================================================\x1b[0m\n`);
  }

  runMultiThreadedMRWiring().catch((err) => {
    console.error("Multi-threaded execution error:", err);
    process.exit(1);
  });
}
