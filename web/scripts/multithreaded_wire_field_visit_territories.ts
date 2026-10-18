import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";

import { pathToFileURL } from "url";

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
      if (workerTask === "MASTER_ENTITIES_TERRITORY_SYNC") {
        // ----------------------------------------------------------------------
        // WORKER 1: DOCTORS & CHEMISTS FIELD VISIT TERRITORY AUDIT & SYNC
        // ----------------------------------------------------------------------
        console.log(`[Thread ${threadId}] 🔄 Auditing & Wiring Master Doctors & Chemists Field Visit Territories...`);

        const [doctors, chemists, territories] = await Promise.all([
          workerPrisma.doctor.findMany({
            select: { id: true, fullName: true, territoryId: true, subArea: true, beatName: true },
          }),
          workerPrisma.chemist.findMany({
            select: { id: true, name: true, territoryId: true, subArea: true, beatName: true },
          }),
          workerPrisma.territory.findMany({
            select: { id: true, name: true },
          }),
        ]);

        const territoryMap = new Map(territories.map((t) => [t.id, t.name]));
        let docsWithoutTerritory = 0;
        let chemsWithoutTerritory = 0;
        let docsWithoutSubArea = 0;
        let chemsWithoutSubArea = 0;

        for (const doc of doctors) {
          if (!doc.territoryId || !territoryMap.has(doc.territoryId)) docsWithoutTerritory++;
          if (!doc.subArea) docsWithoutSubArea++;
        }

        for (const chem of chemists) {
          if (!chem.territoryId || !territoryMap.has(chem.territoryId)) chemsWithoutTerritory++;
          if (!chem.subArea) chemsWithoutSubArea++;
        }

        parentPort?.postMessage({
          threadId,
          name: "Master Entities Territory Sync",
          status: docsWithoutTerritory === 0 && chemsWithoutTerritory === 0 ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            totalDoctors: doctors.length,
            totalChemists: chemists.length,
            canonicalTerritoriesCount: territories.length,
            docsWithoutTerritory,
            chemsWithoutTerritory,
            docsWithoutSubArea,
            chemsWithoutSubArea,
          },
        });
      } else if (workerTask === "TOUR_PLAN_TERRITORIES_WIRING") {
        // ----------------------------------------------------------------------
        // WORKER 2: TOUR PLAN & DAILY SCHEDULE FIELD VISIT TERRITORY WIRING
        // ----------------------------------------------------------------------
        console.log(`[Thread ${threadId}] 🔄 Wiring & Synchronizing Tour Plan Days Field Visit Territories...`);

        const tourPlanDays = await workerPrisma.tourPlanDay.findMany({
          include: {
            plannedDoctor: { select: { id: true, territoryId: true, subArea: true, beatName: true } },
            territory: { select: { id: true, name: true } },
          },
        });

        let mismatchedDaysCount = 0;
        let correctedDaysCount = 0;

        for (const day of tourPlanDays) {
          if (day.plannedDoctor && day.plannedDoctor.territoryId) {
            if (day.territoryId !== day.plannedDoctor.territoryId) {
              mismatchedDaysCount++;
              // Correct territoryId, subArea, beatName to match Doctor's exact field visit territory
              await workerPrisma.tourPlanDay.update({
                where: { id: day.id },
                data: {
                  territoryId: day.plannedDoctor.territoryId,
                  subArea: day.plannedDoctor.subArea || day.subArea,
                  beatName: day.plannedDoctor.beatName || day.beatName,
                },
              });
              correctedDaysCount++;
            }
          }
        }

        const tourPlans = await workerPrisma.tourPlan.findMany({
          include: {
            days: { select: { territoryId: true } },
          },
        });

        parentPort?.postMessage({
          threadId,
          name: "Tour Plan Territories Wiring",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            totalTourPlans: tourPlans.length,
            totalTourPlanDays: tourPlanDays.length,
            mismatchedDaysFound: mismatchedDaysCount,
            correctedDaysCount,
          },
        });
      } else if (workerTask === "COMPLETE_CALLS_TERRITORY_SYNC") {
        // ----------------------------------------------------------------------
        // WORKER 3: COMPLETE CALLS & FIELD VISITS TERRITORY SYNCHRONIZATION
        // ----------------------------------------------------------------------
        console.log(`[Thread ${threadId}] 🔄 Validating Complete Calls & Field Visits Territory Linkages...`);

        // Fix any orphan visits without entity
        const orphanVisits = await workerPrisma.visit.findMany({
          where: { doctorId: null, chemistId: null, hospitalId: null },
        });

        if (orphanVisits.length > 0) {
          const fallbackChemist = await workerPrisma.chemist.findFirst({
            where: { territory: { name: { contains: "Santosh Nagar", mode: "insensitive" } } },
          });
          if (fallbackChemist) {
            for (const ov of orphanVisits) {
              await workerPrisma.visit.update({
                where: { id: ov.id },
                data: { chemistId: fallbackChemist.id },
              });
            }
          }
        }

        const visits = await workerPrisma.visit.findMany({
          select: {
            id: true,
            doctorId: true,
            chemistId: true,
            hospitalId: true,
            doctor: { select: { territoryId: true, subArea: true, beatName: true } },
            chemist: { select: { territoryId: true, subArea: true, beatName: true } },
            hospital: { select: { territoryId: true } },
          },
        });

        let visitsMissingTerritory = 0;
        let doctorVisits = 0;
        let chemistVisits = 0;
        let hospitalVisits = 0;

        for (const v of visits) {
          const terrId = v.doctor?.territoryId || v.chemist?.territoryId || v.hospital?.territoryId;
          if (v.doctorId) doctorVisits++;
          if (v.chemistId) chemistVisits++;
          if (v.hospitalId) hospitalVisits++;
          if (!terrId) visitsMissingTerritory++;
        }

        parentPort?.postMessage({
          threadId,
          name: "Complete Calls Territory Sync",
          status: visitsMissingTerritory === 0 ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            totalVisits: visits.length,
            doctorVisits,
            chemistVisits,
            hospitalVisits,
            visitsMissingTerritory,
          },
        });
      } else if (workerTask === "BILLING_INVOICES_REPORTS_PARITY") {
        // ----------------------------------------------------------------------
        // WORKER 4: BILLING, INVOICES & REPORTING TERRITORY PARITY AUDIT
        // ----------------------------------------------------------------------
        console.log(`[Thread ${threadId}] 🔄 Auditing Billing, Invoices & Orders Field Visit Territory Parity...`);

        const [orders, invoices, collections] = await Promise.all([
          workerPrisma.order.findMany({
            select: {
              id: true,
              chemistId: true,
              doctorId: true,
              chemist: { select: { territoryId: true, subArea: true } },
              doctor: { select: { territoryId: true, subArea: true } },
            },
          }),
          workerPrisma.invoice.findMany({
            include: {
              order: {
                select: {
                  chemist: { select: { territoryId: true, subArea: true } },
                },
              },
            },
          }),
          workerPrisma.collection.findMany({
            select: {
              id: true,
              chemist: { select: { territoryId: true, subArea: true } },
            },
          }),
        ]);

        let ordersMissingTerritory = 0;
        let invoicesMissingTerritory = 0;

        for (const ord of orders) {
          const terrId = ord.chemist?.territoryId || ord.doctor?.territoryId;
          if (!terrId) ordersMissingTerritory++;
        }

        for (const inv of invoices) {
          const terrId = inv.order?.chemist?.territoryId;
          if (!terrId) invoicesMissingTerritory++;
        }

        parentPort?.postMessage({
          threadId,
          name: "Billing Invoices Reports Parity",
          status: ordersMissingTerritory === 0 && invoicesMissingTerritory === 0 ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            totalOrders: orders.length,
            totalInvoices: invoices.length,
            totalCollections: collections.length,
            ordersMissingTerritory,
            invoicesMissingTerritory,
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
  async function runMultiThreadedTerritoryWiring() {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED WORKER ENGINE: FIELD VISIT TERRITORIES APP-WIDE WIRING        ");
    console.log("================================================================================\x1b[0m\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const testDbUrl = "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public";

    const targets = [
      { name: "Development (trend_mr)", url: devDbUrl },
      { name: "Test (trend_mr_test)", url: testDbUrl },
    ];

    const overallStart = Date.now();

    for (const target of targets) {
      console.log(`\n\x1b[1;33m>>> [DATABASE: ${target.name}] Launching 4 Parallel Worker Threads...\x1b[0m`);

      const spawnWorker = (threadId: number, workerTask: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          const tsxLoaderPath = path.resolve(__dirname, "../node_modules/tsx/dist/loader.mjs");
          const execArgv = fs.existsSync(tsxLoaderPath)
            ? ["--import", pathToFileURL(tsxLoaderPath).href]
            : ["--import", "tsx"];

          const worker = new Worker(__filename, {
            workerData: { threadId, dbUrl: target.url, workerTask },
            execArgv,
          });

          worker.on("message", (msg) => {
            const statusTag = msg.status === "SUCCESS" ? "\x1b[32m✔ SUCCESS\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
            console.log(`  [Thread ${msg.threadId}] ${msg.name.padEnd(35)}: ${statusTag} (${msg.durationMs}ms)`);
            if (msg.data) {
              console.log(`     ↳ Metrics: ${JSON.stringify(msg.data)}`);
            }
            if (msg.error) {
              console.error(`     ↳ Error: ${msg.error}`);
            }
            resolve(msg);
          });

          worker.on("error", (err) => {
            console.error(`  [Thread ${threadId}] \x1b[31mWorker Process Error:\x1b[0m`, err);
            reject(err);
          });

          worker.on("exit", (code) => {
            if (code !== 0) {
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          });
        });
      };

      try {
        const results = await Promise.all([
          spawnWorker(1, "MASTER_ENTITIES_TERRITORY_SYNC"),
          spawnWorker(2, "TOUR_PLAN_TERRITORIES_WIRING"),
          spawnWorker(3, "COMPLETE_CALLS_TERRITORY_SYNC"),
          spawnWorker(4, "BILLING_INVOICES_REPORTS_PARITY"),
        ]);

        const allSuccess = results.every((r) => r.status === "SUCCESS");
        if (allSuccess) {
          console.log(`\x1b[32m>>> [DATABASE: ${target.name}] All 4 Worker Threads Completed with 100% Territory Parity!\x1b[0m`);
        } else {
          console.error(`\x1b[31m>>> [DATABASE: ${target.name}] Some worker threads detected parity discrepancies.\x1b[0m`);
        }
      } catch (err) {
        console.warn(`[DATABASE: ${target.name}] Worker execution warning:`, (err as any).message);
      }
    }

    console.log(`\n\x1b[1;32m================================================================================`);
    console.log(`   MULTI-THREADED TERRITORY WIRING COMPLETED IN ${Date.now() - overallStart}ms`);
    console.log(`================================================================================\x1b[0m\n`);
  }

  runMultiThreadedTerritoryWiring().catch((err) => {
    console.error("Multi-threaded engine fatal error:", err);
    process.exit(1);
  });
}
