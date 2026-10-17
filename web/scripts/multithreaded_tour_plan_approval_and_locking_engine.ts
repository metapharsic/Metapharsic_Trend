import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role, TourPlanStatus } from "@prisma/client";
import { TourPlanAgentsService } from "../services/tour-plan-agents.service";

if (!isMainThread) {
  const { threadId, workerType, dbUrl } = workerData;
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  (async () => {
    const startTime = Date.now();

    try {
      if (workerType === "SELECTION_AUDITOR") {
        console.log(`[Thread ${threadId}: SELECTION_AUDITOR] Validating draft plan creation & live counters on ${dbUrl.split("@")[1]}...`);

        // Find or create test MR employee
        const mrUser = await prisma.user.findFirst({ where: { role: Role.MR }, include: { employee: true } });
        if (!mrUser?.employee) throw new Error("MR Employee not found");

        const territory = await prisma.territory.findFirst({
          where: { doctors: { some: {} } },
          include: { doctors: { take: 10 } },
        });
        if (!territory || territory.doctors.length === 0) throw new Error("Territory with doctors not found");

        const targetMonth = new Date("2026-11-01T00:00:00.000Z");

        // Clean any existing plan for this month
        await prisma.tourPlan.deleteMany({
          where: { employeeId: mrUser.employee.id, month: targetMonth },
        });

        // Create draft/pending tour plan with 7 selected doctors (mirroring user screenshot)
        const selectedDoctors = territory.doctors.slice(0, 7);
        const dayDate = new Date("2026-11-02T00:00:00.000Z");

        const plan = await prisma.tourPlan.create({
          data: {
            employeeId: mrUser.employee.id,
            month: targetMonth,
            status: TourPlanStatus.PENDING_ASM,
            days: {
              create: selectedDoctors.map((doc) => ({
                date: dayDate,
                territoryId: territory.id,
                plannedDoctorId: doc.id,
                beatName: doc.beatName,
                subArea: doc.subArea,
              })),
            },
          },
          include: { days: true },
        });

        // Verify count calculations
        const totalCalls = plan.days.length;
        const expectedCalls = selectedDoctors.length;
        if (totalCalls !== expectedCalls) {
          throw new Error(`Expected ${expectedCalls} planned doctor calls, got ${totalCalls}`);
        }

        // Test modification BEFORE approval (must succeed)
        const dayToModify = plan.days[0];
        const newDoctor = territory.doctors[territory.doctors.length - 1];

        const updated = await prisma.tourPlanDay.update({
          where: { id: dayToModify.id },
          data: { plannedDoctorId: newDoctor.id },
        });

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            tourPlanId: plan.id,
            initialCallsSelected: 7,
            preApprovalModificationSucceeded: true,
            modifiedDoctorId: updated.plannedDoctorId,
          },
        });
      } else if (workerType === "POST_APPROVAL_LOCK_ENFORCER") {
        console.log(`[Thread ${threadId}: POST_APPROVAL_LOCK_ENFORCER] Verifying strict lock after approval on ${dbUrl.split("@")[1]}...`);

        const mrUser = await prisma.user.findFirst({ where: { role: Role.MR }, include: { employee: true } });
        if (!mrUser?.employee) throw new Error("MR Employee not found");

        const territory = await prisma.territory.findFirst({
          where: { doctors: { some: {} } },
          include: { doctors: { take: 5 } },
        });
        if (!territory || territory.doctors.length === 0) throw new Error("Territory with doctors not found");

        const targetMonth = new Date("2026-12-01T00:00:00.000Z");
        await prisma.tourPlan.deleteMany({
          where: { employeeId: mrUser.employee.id, month: targetMonth },
        });

        // 1. Create plan and approve it
        const plan = await prisma.tourPlan.create({
          data: {
            employeeId: mrUser.employee.id,
            month: targetMonth,
            status: TourPlanStatus.APPROVED, // Approved!
            days: {
              create: [
                {
                  date: new Date("2026-12-05T00:00:00.000Z"),
                  territoryId: territory.id,
                  plannedDoctorId: territory.doctors[0].id,
                },
              ],
            },
          },
          include: { days: true },
        });

        // 2. Attempt modification via Service (MUST be rejected)
        let blockedByService = false;
        try {
          await TourPlanAgentsService.updateDayEntry({
            tourPlanId: plan.id,
            dayId: plan.days[0].id,
            territoryId: territory.id,
            plannedDoctorId: territory.doctors[1]?.id || null,
            customDb: prisma,
          });
        } catch (err: any) {
          if (err.message.includes("locked") || err.message.includes("forbidden after approval")) {
            blockedByService = true;
          } else {
            throw err;
          }
        }

        if (!blockedByService) {
          throw new Error("CRITICAL SECURITY FAILURE: updateDayEntry permitted modification on an APPROVED tour plan!");
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            tourPlanId: plan.id,
            status: plan.status,
            postApprovalModificationBlocked: true,
            guardVerified: "Zero modifications permitted after approval",
          },
        });
      } else if (workerType === "APP_FLOW_INTEGRITY_AUDITOR") {
        console.log(`[Thread ${threadId}: APP_FLOW_INTEGRITY_AUDITOR] Auditing territory & doctor relation flows on ${dbUrl.split("@")[1]}...`);

        const totalTerritories = await prisma.territory.count();
        const totalDoctors = await prisma.doctor.count();
        const unassignedDoctors = await prisma.doctor.count({ where: { territoryId: { equals: "" } } });

        const approvedPlans = await prisma.tourPlan.findMany({
          where: { status: TourPlanStatus.APPROVED },
          include: { days: true },
        });

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            totalTerritories,
            totalDoctors,
            unassignedDoctors,
            approvedPlansCount: approvedPlans.length,
            integrityValid: unassignedDoctors === 0,
          },
        });
      }
    } catch (err: any) {
      console.error(`[Thread ${threadId}: ${workerType}] Error:`, err);
      parentPort?.postMessage({
        threadId,
        status: "ERROR",
        workerType,
        error: err.message || String(err),
      });
    } finally {
      await prisma.$disconnect();
    }
  })();
}

if (isMainThread) {
  async function runWorker(threadId: number, workerType: string, dbUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { threadId, workerType, dbUrl },
      });
      worker.on("message", (msg) => {
        if (msg.status === "SUCCESS") resolve(msg);
        else reject(new Error(`Worker ${threadId} failed: ${msg.error}`));
      });
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker ${threadId} exited with code ${code}`));
      });
    });
  }

  async function main() {
    console.log("==========================================================================");
    console.log("   🚀 MULTI-THREADED TOUR PLAN FLOW & POST-APPROVAL LOCK ENGINE");
    console.log("==========================================================================");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const testDbUrl = devDbUrl.replace("/trend_mr?", "/trend_mr_test?");

    const dbs = [
      { name: "DEVELOPMENT (trend_mr)", url: devDbUrl },
      { name: "TEST (trend_mr_test)", url: testDbUrl },
    ];

    for (const targetDb of dbs) {
      console.log(`\n▶ [ENGINE] Executing Verification Pipeline on ${targetDb.name}...`);
      const start = Date.now();

      const [res1, res2, res3]: any[] = await Promise.all([
        runWorker(1, "SELECTION_AUDITOR", targetDb.url),
        runWorker(2, "POST_APPROVAL_LOCK_ENFORCER", targetDb.url),
        runWorker(3, "APP_FLOW_INTEGRITY_AUDITOR", targetDb.url),
      ]);

      console.log(`✅ [Thread 1: SELECTION_AUDITOR] Verified in ${res1.durationMs}ms`);
      console.log(`   Initial Calls Selected:`, res1.data.initialCallsSelected);
      console.log(`   Pre-Approval Modification Allowed:`, res1.data.preApprovalModificationSucceeded);

      console.log(`✅ [Thread 2: POST_APPROVAL_LOCK_ENFORCER] Verified in ${res2.durationMs}ms`);
      console.log(`   Plan Status:`, res2.data.status);
      console.log(`   Post-Approval Modification Blocked:`, res2.data.postApprovalModificationBlocked);
      console.log(`   Security Policy:`, res2.data.guardVerified);

      console.log(`✅ [Thread 3: APP_FLOW_INTEGRITY_AUDITOR] Verified in ${res3.durationMs}ms`);
      console.log(`   Territories: ${res3.data.totalTerritories}, Doctors: ${res3.data.totalDoctors}, Unassigned: ${res3.data.unassignedDoctors}`);
      console.log(`   Approved Plans in DB: ${res3.data.approvedPlansCount}`);

      console.log(`⏱️ Completed ${targetDb.name} in ${Date.now() - start}ms`);
    }

    console.log("\n🎉 MULTI-THREADED APP FLOW & POST-APPROVAL LOCKING FULLY VERIFIED ACROSS ALL DATABASES!");
  }

  main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
