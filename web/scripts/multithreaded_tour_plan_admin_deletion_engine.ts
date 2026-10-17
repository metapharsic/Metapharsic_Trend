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
      if (workerType === "RBAC_CROSS_USER_GUARD") {
        console.log(`[Thread ${threadId}: RBAC_CROSS_USER_GUARD] Validating cross-user deletion blocking on ${dbUrl.split("@")[1]}...`);

        // Dynamically find MRs without hardcoding
        let mrUsers = await prisma.user.findMany({
          where: { role: Role.MR, employee: { isNot: null } },
          include: { employee: true },
          take: 2,
        });

        if (mrUsers.length < 2) {
          // Dynamically provision a second MR test user to guarantee non-hardcoded test coverage
          const uniqueEmail = `test_mr_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
          const createdUser = await prisma.user.create({
            data: {
              email: uniqueEmail,
              passwordHash: "$2b$10$wT8m9sK8H9/4j7zZ7bX8ee1",
              role: Role.MR,
              employee: {
                create: {
                  firstName: "Audit",
                  lastName: "MR2",
                  phone: "919999999998",
                },
              },
            },
            include: { employee: true },
          });
          mrUsers.push(createdUser);
        }

        const mr1 = mrUsers[0];
        const mr2 = mrUsers[1];

        const territory = await prisma.territory.findFirst({
          where: { doctors: { some: {} } },
          include: { doctors: { take: 3 } },
        });
        if (!territory) throw new Error("No territory found");

        const targetMonth = new Date("2026-11-01T00:00:00.000Z");

        // Clean any existing plan for MR2 in this month
        await prisma.tourPlan.deleteMany({
          where: { employeeId: mr2.employee!.id, month: targetMonth },
        });

        // Create a draft plan belonging to MR2
        const mr2Plan = await prisma.tourPlan.create({
          data: {
            employeeId: mr2.employee!.id,
            month: targetMonth,
            status: TourPlanStatus.DRAFT,
            days: {
              create: [
                {
                  date: new Date("2026-11-03T00:00:00.000Z"),
                  territoryId: territory.id,
                  plannedDoctorId: territory.doctors[0]?.id || null,
                },
              ],
            },
          },
        });

        // MR1 tries to delete MR2's plan -> MUST be rejected with Forbidden
        let blocked = false;
        try {
          await TourPlanAgentsService.deleteTourPlan({
            tourPlanId: mr2Plan.id,
            requestingUserId: mr1.id,
            requestingRole: Role.MR,
            customDb: prisma,
          });
        } catch (err: any) {
          if (err.message.includes("Forbidden") || err.message.includes("permission")) {
            blocked = true;
          } else {
            throw err;
          }
        }

        if (!blocked) {
          throw new Error("SECURITY FAILURE: MR1 was able to delete MR2's tour plan!");
        }

        // Clean up test plan
        await prisma.tourPlanDay.deleteMany({ where: { tourPlanId: mr2Plan.id } });
        await prisma.tourPlan.delete({ where: { id: mr2Plan.id } });

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            crossUserDeletionBlocked: true,
            mr1Id: mr1.id,
            mr2Id: mr2.id,
            securityPolicy: "MR cannot delete another representative's tour plan",
          },
        });
      } else if (workerType === "POST_APPROVAL_MR_GUARD") {
        console.log(`[Thread ${threadId}: POST_APPROVAL_MR_GUARD] Verifying MR cannot delete an APPROVED plan on ${dbUrl.split("@")[1]}...`);

        const mrUser = await prisma.user.findFirst({
          where: { role: Role.MR, employee: { isNot: null } },
          include: { employee: true },
        });
        if (!mrUser?.employee) throw new Error("MR not found");

        const territory = await prisma.territory.findFirst({
          where: { doctors: { some: {} } },
          include: { doctors: { take: 2 } },
        });
        if (!territory) throw new Error("Territory not found");

        const targetMonth = new Date("2026-10-01T00:00:00.000Z");

        // Clean any existing plan for this month
        await prisma.tourPlan.deleteMany({
          where: { employeeId: mrUser.employee.id, month: targetMonth },
        });

        // Create an APPROVED plan for this MR
        const approvedPlan = await prisma.tourPlan.create({
          data: {
            employeeId: mrUser.employee.id,
            month: targetMonth,
            status: TourPlanStatus.APPROVED,
            days: {
              create: [
                {
                  date: new Date("2026-10-05T00:00:00.000Z"),
                  territoryId: territory.id,
                  plannedDoctorId: territory.doctors[0]?.id || null,
                },
              ],
            },
          },
        });

        // The MR attempts to delete their own APPROVED plan -> MUST be rejected
        let blocked = false;
        try {
          await TourPlanAgentsService.deleteTourPlan({
            tourPlanId: approvedPlan.id,
            requestingUserId: mrUser.id,
            requestingRole: Role.MR,
            customDb: prisma,
          });
        } catch (err: any) {
          if (err.message.includes("forbidden after approval") || err.message.includes("Only Admin can delete")) {
            blocked = true;
          } else {
            throw err;
          }
        }

        if (!blocked) {
          throw new Error("SECURITY FAILURE: MR was able to delete an APPROVED tour plan!");
        }

        // Clean up test plan
        await prisma.tourPlanDay.deleteMany({ where: { tourPlanId: approvedPlan.id } });
        await prisma.tourPlan.delete({ where: { id: approvedPlan.id } });

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            mrApprovedDeletionBlocked: true,
            planId: approvedPlan.id,
            securityPolicy: "MR cannot delete approved plans; strictly admin-only",
          },
        });
      } else if (workerType === "ADMIN_OVERRIDE_DELETION_PROVISIONER") {
        console.log(`[Thread ${threadId}: ADMIN_OVERRIDE_DELETION_PROVISIONER] Testing Admin override deletion on MR plans on ${dbUrl.split("@")[1]}...`);

        // Dynamically find Admin and MR without hardcoding
        let adminUser = await prisma.user.findFirst({
          where: { role: Role.ADMIN },
        });
        if (!adminUser) {
          adminUser = await prisma.user.findFirst({ where: { role: Role.MD } });
        }
        if (!adminUser) throw new Error("No Admin or MD user found in database");

        const mrUser = await prisma.user.findFirst({
          where: { role: Role.MR, employee: { isNot: null } },
          include: { employee: true },
        });
        if (!mrUser?.employee) throw new Error("No MR employee found");

        const territory = await prisma.territory.findFirst({
          where: { doctors: { some: {} } },
          include: { doctors: { take: 7 } },
        });
        if (!territory) throw new Error("No territory found");

        const targetMonth = new Date("2026-09-01T00:00:00.000Z");

        // Clean any existing plan for this month
        await prisma.tourPlan.deleteMany({
          where: { employeeId: mrUser.employee.id, month: targetMonth },
        });

        // 1. Create an APPROVED plan for the MR with 7 doctor calls
        const doctorsToPlan = territory.doctors.slice(0, 7);
        const approvedPlan = await prisma.tourPlan.create({
          data: {
            employeeId: mrUser.employee.id,
            month: targetMonth,
            status: TourPlanStatus.APPROVED,
            days: {
              create: doctorsToPlan.map((doc, idx) => ({
                date: new Date(`2026-09-0${idx + 1}T00:00:00.000Z`),
                territoryId: territory.id,
                plannedDoctorId: doc.id,
                beatName: doc.beatName,
                subArea: doc.subArea,
              })),
            },
          },
          include: { days: true },
        });

        // 2. Admin calls deleteTourPlan on MR's APPROVED plan -> MUST SUCCEED
        const deleteResult = await TourPlanAgentsService.deleteTourPlan({
          tourPlanId: approvedPlan.id,
          requestingUserId: adminUser.id,
          requestingRole: Role.ADMIN,
          customDb: prisma,
        });

        if (!deleteResult.deleted || deleteResult.daysDeleted !== doctorsToPlan.length) {
          throw new Error(`Admin deletion failed: expected ${doctorsToPlan.length} days deleted, got ${deleteResult.daysDeleted}`);
        }

        // 3. Confirm plan and days are completely deleted from DB
        const planInDb = await prisma.tourPlan.findUnique({ where: { id: approvedPlan.id } });
        const daysInDb = await prisma.tourPlanDay.count({ where: { tourPlanId: approvedPlan.id } });

        if (planInDb !== null || daysInDb !== 0) {
          throw new Error("Admin deletion left orphaned records in database!");
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            adminOverrideSuccess: true,
            deletedPlanId: approvedPlan.id,
            daysDeleted: deleteResult.daysDeleted,
            mrName: deleteResult.employeeName,
            authorizedByRole: deleteResult.authorizedByRole,
            verifiedCleanDBSnapshot: "Plan and all daily calls cleanly deleted with zero orphaned rows",
          },
        });
      } else if (workerType === "INTEGRITY_AUDITOR") {
        console.log(`[Thread ${threadId}: INTEGRITY_AUDITOR] Auditing database integrity and zero orphaned days on ${dbUrl.split("@")[1]}...`);

        const totalPlans = await prisma.tourPlan.count();
        const totalDays = await prisma.tourPlanDay.count();
        const totalTerritories = await prisma.territory.count();

        // Verify no orphaned tour plan days
        const allDays = await prisma.tourPlanDay.findMany({
          select: { id: true, tourPlanId: true },
        });

        const planIds = new Set((await prisma.tourPlan.findMany({ select: { id: true } })).map((p) => p.id));
        const orphanedDays = allDays.filter((d) => !planIds.has(d.tourPlanId));

        if (orphanedDays.length > 0) {
          throw new Error(`Integrity violation: Found ${orphanedDays.length} orphaned TourPlanDay rows!`);
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            totalPlans,
            totalDays,
            totalTerritories,
            orphanedDays: 0,
            referentialIntegrity: "100% CLEAN - All daily calls belong to active plans",
          },
        });
      }
    } catch (err: any) {
      console.error(`[Thread ${threadId}: ${workerType}] Error:`, err);
      parentPort?.postMessage({
        threadId,
        status: "FAILED",
        workerType,
        error: err.message || String(err),
      });
    } finally {
      await prisma.$disconnect();
    }
  })();
} else {
  // MAIN THREAD: Multi-Threaded Coordinator
  const runWorker = (threadId: number, workerType: string, dbUrl: string) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { threadId, workerType, dbUrl },
      });

      worker.on("message", (msg) => {
        if (msg.status === "SUCCESS") {
          resolve(msg);
        } else {
          reject(new Error(`Worker ${threadId} failed: ${msg.error}`));
        }
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker ${threadId} stopped with exit code ${code}`));
        }
      });
    });
  };

  (async () => {
    console.log("==========================================================================");
    console.log("   🚀 MULTI-THREADED TOUR PLAN ADMIN DELETION & RBAC ENGINE");
    console.log("==========================================================================\n");

    const databases = [
      { name: "DEVELOPMENT (trend_mr)", url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public" },
      { name: "TEST (trend_mr_test)", url: "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public" },
    ];

    for (const db of databases) {
      console.log(`▶ [ENGINE] Executing Multi-Threaded Deletion Pipeline on ${db.name}...`);
      const startDbTime = Date.now();

      try {
        const results: any = await Promise.all([
          runWorker(1, "RBAC_CROSS_USER_GUARD", db.url),
          runWorker(2, "POST_APPROVAL_MR_GUARD", db.url),
          runWorker(3, "ADMIN_OVERRIDE_DELETION_PROVISIONER", db.url),
          runWorker(4, "INTEGRITY_AUDITOR", db.url),
        ]);

        for (const res of results) {
          console.log(`✅ [Thread ${res.threadId}: ${res.workerType}] Verified in ${res.durationMs}ms`);
          for (const [k, v] of Object.entries(res.data)) {
            console.log(`   ${k}: ${v}`);
          }
        }

        console.log(`⏱️ Completed ${db.name} in ${Date.now() - startDbTime}ms\n`);
      } catch (err: any) {
        console.error(`❌ [ENGINE] Pipeline execution failed on ${db.name}:`, err);
        process.exit(1);
      }
    }

    console.log("🎉 MULTI-THREADED ADMIN DELETION & ZERO-HARDCODE RBAC FULLY VERIFIED ACROSS ALL DATABASES!\n");
  })();
}
