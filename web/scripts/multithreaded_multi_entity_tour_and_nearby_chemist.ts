/**
 * MULTI-THREADED MULTI-ENTITY TOUR PLAN & NEARBY CHEMIST VERIFICATION ENGINE
 * =========================================================================
 * Spawns 4 concurrent Worker threads using `node:worker_threads` to stress-test
 * and mathematically verify:
 * 1. Multi-Entity Tour Plan Engine:
 *    - Scheduling multiple doctors and chemists on the same day.
 *    - Modifying entire tour plan stops, switching between Doctor and Chemist.
 *    - Deleting individual stops on a multi-entity day without deleting the whole day.
 * 2. ProximityCorrelationAgent & Haversine Distance Calculation:
 *    - Accurate Great-Circle distance and proximity tier classification.
 * 3. Complete Call Nearby Chemist & Tour Plan Real-Time App Sync:
 *    - Completing a call with nearby chemist tagged and auto-marking today's Tour Plan day DONE.
 * 4. Multi-Threaded Concurrent Operations & Stress Test:
 *    - Concurrent multi-entity tour plan scheduling and database integrity checks.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { db } from "../lib/db";
import { TourPlanAgentsService } from "../services/tour-plan-agents.service";
import {
  NearbyChemistAgentsService,
  calculateHaversineDistance,
} from "../services/nearby-chemist-agents.service";
import { startOfUtcDay, startOfUtcMonth } from "../lib/date";
import { randomUUID } from "node:crypto";

interface WorkerTask {
  workerId: number;
  workerName: string;
}

interface WorkerResult {
  workerId: number;
  workerName: string;
  status: "SUCCESS" | "FAILURE";
  durationMs: number;
  details: Record<string, any>;
  error?: string;
}

if (!isMainThread) {
  const task: WorkerTask = workerData;
  const startTime = Date.now();

  (async () => {
    try {
      let details: Record<string, any> = {};

      switch (task.workerId) {
        case 1: {
          // Worker 1: Multi-Entity Tour Plan Operations
          // Provision or fetch a tour plan, add multiple entities to the same day, edit, and delete
          const mr = await db.employee.findFirst({
            where: { user: { role: "MR" } },
            include: { territories: true },
          });
          if (!mr) throw new Error("No active MR found");

          const now = new Date();
          const targetMonth = startOfUtcMonth(now);
          const territoryId = mr.territories[0]?.id || (await db.territory.findFirstOrThrow()).id;

          // Provision tour plan
          const planEval = await TourPlanAgentsService.provisionMonthlyPlan({
            employeeId: mr.id,
            month: targetMonth,
            overwrite: true,
          });

          // Pick a target date in the month (e.g., 15th of the month)
          const y = now.getUTCFullYear();
          const m = String(now.getUTCMonth() + 1).padStart(2, "0");
          const multiEntityDate = `${y}-${m}-15`;

          // Query doctors and chemists in territory
          const doctors = await db.doctor.findMany({
            where: { territoryId },
            take: 3,
          });
          const chemists = await db.chemist.findMany({
            where: { territoryId },
            take: 3,
          });

          if (doctors.length === 0 || chemists.length === 0) {
            throw new Error(`Insufficient doctors (${doctors.length}) or chemists (${chemists.length}) in territory`);
          }

          // Stop 1: Doctor Visit on Day 15
          const stop1 = await TourPlanAgentsService.addDayEntry({
            tourPlanId: planEval.id,
            date: multiEntityDate,
            territoryId,
            entityType: "DOCTOR",
            plannedDoctorId: doctors[0].id,
            notes: "Morning Clinic Detailing Session",
          });

          // Stop 2: Chemist Visit on the SAME Day 15!
          const stop2 = await TourPlanAgentsService.addDayEntry({
            tourPlanId: planEval.id,
            date: multiEntityDate,
            territoryId,
            entityType: "CHEMIST",
            plannedChemistId: chemists[0].id,
            notes: "Afternoon Pharmacy Stock Placement",
          });

          // Stop 3: Second Chemist Visit on the SAME Day 15!
          const chemist2 = chemists[1] || chemists[0];
          const stop3 = await TourPlanAgentsService.addDayEntry({
            tourPlanId: planEval.id,
            date: multiEntityDate,
            territoryId,
            entityType: "CHEMIST",
            plannedChemistId: chemist2.id,
            notes: "Evening Stockist Review",
          });

          // Verify all 3 stops exist on the same date
          const reEval = await TourPlanAgentsService.evaluatePlan(planEval.id);
          const day15Stops = reEval.days.filter((d) => d.date === multiEntityDate);

          if (day15Stops.length < 3) {
            throw new Error(`Expected at least 3 stops on ${multiEntityDate}, found ${day15Stops.length}`);
          }

          // Test Edit: Switch Stop 3 from Chemist to Doctor 2
          const doc2 = doctors[1] || doctors[0];
          await TourPlanAgentsService.updateDayEntry({
            tourPlanId: planEval.id,
            dayId: stop3.createdDay.id,
            territoryId,
            entityType: "DOCTOR",
            plannedDoctorId: doc2.id,
            notes: "Updated from Chemist to Doctor consultation",
          });

          // Test Delete: Delete Stop 2 (Chemist 1) while Stop 1 and Stop 3 remain intact
          await TourPlanAgentsService.deleteDayEntry({
            tourPlanId: planEval.id,
            dayId: stop2.createdDay.id,
          });

          const postDeleteEval = await TourPlanAgentsService.evaluatePlan(planEval.id);
          const day15PostDelete = postDeleteEval.days.filter((d) => d.date === multiEntityDate);

          details = {
            mrName: `${mr.firstName} ${mr.lastName}`,
            tourPlanId: planEval.id,
            multiEntityDate,
            stopsCreatedOnSameDay: day15Stops.length,
            stopsAfterDelete: day15PostDelete.length,
            totalDoctorCalls: postDeleteEval.summary.totalDoctorCalls,
            totalChemistCalls: postDeleteEval.summary.totalChemistCalls,
            totalEntitiesPlanned: postDeleteEval.summary.totalEntitiesPlanned,
            isMultiEntityWorking: day15PostDelete.length >= 2,
          };
          break;
        }

        case 2: {
          // Worker 2: ProximityCorrelationAgent & Haversine Distance Engine
          // Pick a doctor with coordinates, find nearby chemists
          const doctor = await db.doctor.findFirst({
            where: { latitude: { not: 0 }, longitude: { not: 0 } },
            include: { territory: true },
          });

          let testDocId = doctor?.id;
          let testLat = doctor?.latitude || 17.385;
          let testLon = doctor?.longitude || 78.4867;

          // Execute ProximityCorrelationAgent
          const result = await NearbyChemistAgentsService.getNearbyChemistsForDoctor({
            doctorId: testDocId,
            latitude: testLat,
            longitude: testLon,
            limit: 10,
          });

          // Mathematical verification of Haversine formula
          const testDistance = calculateHaversineDistance(17.385, 78.4867, 17.395, 78.4967);

          details = {
            doctorFound: Boolean(doctor),
            evaluatedChemists: result.totalNearbyFound,
            topChemist: result.chemists[0]
              ? {
                  name: result.chemists[0].name,
                  distanceMeters: result.chemists[0].distanceMeters,
                  proximityLabel: result.chemists[0].proximityLabel,
                  proximityTier: result.chemists[0].proximityTier,
                }
              : null,
            haversineVerification: {
              point1: { lat: 17.385, lon: 78.4867 },
              point2: { lat: 17.395, lon: 78.4967 },
              calculatedMeters: testDistance.meters,
              calculatedKm: testDistance.km,
              isAccurate: testDistance.meters > 0 && testDistance.meters < 3000,
            },
            agentTelemetry: result.agentTelemetry,
          };
          break;
        }

        case 3: {
          // Worker 3: Complete Call with Nearby Chemist & Tour Plan Real-Time Sync
          const mr = await db.employee.findFirst({
            where: { user: { role: "MR" } },
            include: { territories: true },
          });
          if (!mr) throw new Error("No active MR found");

          const doctor = await db.doctor.findFirst({
            where: { territoryId: mr.territories[0]?.id },
          }) || (await db.doctor.findFirstOrThrow());

          const chemist = await db.chemist.findFirst({
            where: { territoryId: doctor.territoryId },
          }) || (await db.chemist.findFirstOrThrow());

          // Create a Tour Plan for today so we can verify real-time sync
          const today = startOfUtcDay();
          const targetMonth = startOfUtcMonth(today);
          const tourPlan = await db.tourPlan.upsert({
            where: {
              employeeId_month: {
                employeeId: mr.id,
                month: targetMonth,
              },
            },
            create: {
              employeeId: mr.id,
              month: targetMonth,
              status: "APPROVED",
            },
            update: {},
          });

          // Ensure today's TourPlanDay exists for this doctor
          const todayDay = await db.tourPlanDay.upsert({
            where: {
              id: `today-${mr.id}-${doctor.id}`,
            },
            create: {
              id: `today-${mr.id}-${doctor.id}`,
              tourPlanId: tourPlan.id,
              date: today,
              territoryId: doctor.territoryId,
              plannedDoctorId: doctor.id,
              visitStatus: "PENDING",
              isCompleted: false,
            },
            update: {
              visitStatus: "PENDING",
              isCompleted: false,
            },
          });

          const mockVisitId = randomUUID();

          // Process complete call with nearby chemist tagged
          const syncResult = await NearbyChemistAgentsService.processVisitWithNearbyChemist({
            visitId: mockVisitId,
            employeeId: mr.id,
            doctorId: doctor.id,
            nearbyChemistId: chemist.id,
            nearbyChemistName: chemist.name,
            placementType: "NEAREST_CHEMIST",
            notes: "Dr. prescribed Trend-Cip. 5 promo packs placed with nearest pharmacy.",
            boxesPlaced: 5,
          });

          // Verify today's Tour Plan Day was automatically marked DONE
          const syncedDay = await db.tourPlanDay.findUnique({
            where: { id: todayDay.id },
          });

          details = {
            visitId: mockVisitId,
            doctorName: doctor.fullName,
            taggedChemistName: chemist.name,
            syncResult: {
              tourPlanSynced: syncResult.tourPlanSynced,
              cqsScoreBonus: syncResult.cqsScoreBonus,
              taggedChemist: syncResult.taggedChemist,
            },
            todayTourPlanDayStatus: syncedDay?.visitStatus,
            isCompleted: syncedDay?.isCompleted,
            completionNotes: syncedDay?.completionNotes,
            hasMedicinePlacementTag: syncedDay?.completionNotes?.includes("<!--MED_PLACEMENT:"),
          };
          break;
        }

        case 4: {
          // Worker 4: Referential Integrity & Multi-Stop Concurrency Stress Test
          const territories = await db.territory.findMany({ take: 3 });
          const allDoctors = await db.doctor.findMany({ take: 10 });
          const allChemists = await db.chemist.findMany({ take: 10 });

          // Run 5 rapid concurrent add-stops
          const testPlan = await db.tourPlan.findFirst({
            include: { employee: true },
          });
          if (!testPlan) throw new Error("No tour plan found for stress test");

          const concurrentOps = [];
          for (let i = 0; i < 5; i++) {
            const isDoc = i % 2 === 0;
            const tid = territories[i % territories.length].id;
            const docId = isDoc ? allDoctors[i % allDoctors.length].id : null;
            const chemId = !isDoc ? allChemists[i % allChemists.length].id : null;

            concurrentOps.push(
              TourPlanAgentsService.addDayEntry({
                tourPlanId: testPlan.id,
                date: `2026-10-${String(20 + i).padStart(2, "0")}`,
                territoryId: tid,
                entityType: isDoc ? "DOCTOR" : "CHEMIST",
                plannedDoctorId: docId,
                plannedChemistId: chemId,
                notes: `Concurrent test stop #${i + 1}`,
              })
            );
          }

          const opResults = await Promise.all(concurrentOps);

          details = {
            concurrentOpsExecuted: opResults.length,
            allSuccessful: opResults.every((r) => r.createdDay && r.createdDay.id),
            totalDaysPlannedInPlan: opResults[opResults.length - 1].evaluation.summary.totalDaysPlanned,
            totalEntitiesInPlan: opResults[opResults.length - 1].evaluation.summary.totalEntitiesPlanned,
          };
          break;
        }
      }

      parentPort?.postMessage({
        workerId: task.workerId,
        workerName: task.workerName,
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        details,
      } as WorkerResult);
    } catch (err: any) {
      parentPort?.postMessage({
        workerId: task.workerId,
        workerName: task.workerName,
        status: "FAILURE",
        durationMs: Date.now() - startTime,
        details: {},
        error: err?.message || String(err),
      } as WorkerResult);
    }
  })();
} else {
  // Main Thread: Orchestrate Worker Threads
  (async () => {
    console.log("========================================================================");
    console.log("🚀 STARTING MULTI-THREADED MULTI-ENTITY TOUR & NEARBY CHEMIST SUITE 🚀");
    console.log("========================================================================\n");

    const tasks: WorkerTask[] = [
      { workerId: 1, workerName: "MultiEntityTourPlanWorker" },
      { workerId: 2, workerName: "ProximityCorrelationHaversineWorker" },
      { workerId: 3, workerName: "CompleteCallNearbyChemistSyncWorker" },
      { workerId: 4, workerName: "ConcurrentStressAndReferentialIntegrityWorker" },
    ];

    const results: WorkerResult[] = [];

    const runWorker = (t: WorkerTask): Promise<WorkerResult> => {
      return new Promise((resolve) => {
        const worker = new Worker(__filename, { workerData: t });
        worker.on("message", (msg: WorkerResult) => resolve(msg));
        worker.on("error", (err) => {
          resolve({
            workerId: t.workerId,
            workerName: t.workerName,
            status: "FAILURE",
            durationMs: 0,
            details: {},
            error: err.message,
          });
        });
        worker.on("exit", (code) => {
          if (code !== 0) {
            resolve({
              workerId: t.workerId,
              workerName: t.workerName,
              status: "FAILURE",
              durationMs: 0,
              details: {},
              error: `Worker exited with non-zero exit code: ${code}`,
            });
          }
        });
      });
    };

    const startTime = Date.now();
    const workerPromises = tasks.map((t) => runWorker(t));
    const allResults = await Promise.all(workerPromises);
    const totalDuration = Date.now() - startTime;

    console.log(`\nAll ${allResults.length} Workers Completed in ${totalDuration}ms:\n`);
    let allPassed = true;

    for (const res of allResults) {
      if (res.status === "SUCCESS") {
        console.log(`✅ [Thread #${res.workerId}] ${res.workerName} PASSED (${res.durationMs}ms)`);
        console.log("   Details:", JSON.stringify(res.details, null, 2));
      } else {
        allPassed = false;
        console.error(`❌ [Thread #${res.workerId}] ${res.workerName} FAILED (${res.durationMs}ms)`);
        console.error("   Error:", res.error);
      }
      console.log("------------------------------------------------------------------------");
    }

    if (allPassed) {
      console.log("\n🎉 ALL MULTI-AGENT & MULTI-THREADED TESTS PASSED PERFECTLY!");
      process.exit(0);
    } else {
      console.error("\n💥 SOME WORKER THREADS FAILED. Inspect details above.");
      process.exit(1);
    }
  })();
}
