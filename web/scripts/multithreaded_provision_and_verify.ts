import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role } from "@prisma/client";
import { ModulesService, INITIAL_MODULES_DATA } from "../services/modules.service";

if (!isMainThread) {
  // WORKER THREAD LOGIC
  const { threadId, dbUrl } = workerData;
  const workerPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  (async () => {
    const startTime = Date.now();

    try {
      if (threadId === 1) {
        // Thread 1: AppModule Database Provisioning
        console.log(`[Thread 1] Starting AppModule Database Provisioning on ${dbUrl.split("@")[1]}...`);
        const provisioned = await ModulesService.provisionDefaultModules(workerPrisma);
        const count = await workerPrisma.appModule.count();
        const categories = await workerPrisma.appModule.groupBy({ by: ["category"] });

        parentPort?.postMessage({
          threadId: 1,
          name: "AppModule Provisioning",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            upsertedCount: provisioned.length,
            totalCountInDb: count,
            categoriesCount: categories.length,
          },
        });
      } else if (threadId === 2) {
        // Thread 2: SystemArtifact Database Provisioning
        console.log(`[Thread 2] Starting SystemArtifact Database Provisioning on ${dbUrl.split("@")[1]}...`);
        const artifacts = await ModulesService.provisionDefaultArtifacts(workerPrisma);
        const count = await workerPrisma.systemArtifact.count();
        const types = await workerPrisma.systemArtifact.groupBy({ by: ["artifactType"] });

        parentPort?.postMessage({
          threadId: 2,
          name: "SystemArtifact Provisioning",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            upsertedCount: artifacts.length,
            totalCountInDb: count,
            artifactTypesCount: types.length,
          },
        });
      } else if (threadId === 3) {
        // Thread 3: Multi-Role RBAC & Scoping Logic Resolver
        console.log(`[Thread 3] Resolving Multi-Role RBAC & Scoping Logic...`);
        const allRoles = Object.values(Role);
        const roleBreakdown: Record<string, number> = {};

        for (const role of allRoles) {
          const mods = await ModulesService.getModulesForRole(role, workerPrisma);
          roleBreakdown[role] = mods.length;
          if (mods.length === 0) {
            throw new Error(`Role ${role} resolved 0 modules from database!`);
          }
        }

        // Verify label overrides
        const mrMods = await ModulesService.getModulesForRole(Role.MR, workerPrisma);
        const mrOrders = mrMods.find((m) => m.code === "NAV_SECONDARY_ORDERS");
        if (mrOrders?.label !== "My Orders") {
          throw new Error(`Role MR labelByRole override failed: expected 'My Orders', got '${mrOrders?.label}'`);
        }

        const distMods = await ModulesService.getModulesForRole(Role.DISTRIBUTOR, workerPrisma);
        const distOrders = distMods.find((m) => m.code === "NAV_SECONDARY_ORDERS");
        if (distOrders?.label !== "Orders & Invoices") {
          throw new Error(`Role DISTRIBUTOR labelByRole override failed: expected 'Orders & Invoices', got '${distOrders?.label}'`);
        }

        parentPort?.postMessage({
          threadId: 3,
          name: "Multi-Role RBAC & Scoping Resolver",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            rolesEvaluated: allRoles.length,
            roleBreakdown,
            mrOrdersLabel: mrOrders?.label,
            distOrdersLabel: distOrders?.label,
          },
        });
      } else if (threadId === 4) {
        // Thread 4: Live Database Integrity & Zero-Hardcode Validator
        console.log(`[Thread 4] Validating Live Database Integrity & Dynamic Mutation...`);
        const tempCode = `NAV_DYNAMIC_VERIFY_${Date.now()}`;

        // Create temporary module in DB
        const created = await workerPrisma.appModule.create({
          data: {
            code: tempCode,
            label: "Dynamic Live Verification Module",
            href: "/verify/dynamic",
            icon: "Sparkles",
            category: "Administration & Profile",
            categoryOrder: 6,
            sortOrder: 99,
            roles: [Role.ADMIN],
            isArtifact: true,
            moduleType: "ARTIFACT",
            isActive: true,
          },
        });

        // Query immediately via service
        const adminMods = await ModulesService.getModulesForRole(Role.ADMIN, workerPrisma);
        const found = adminMods.find((m) => m.code === tempCode);

        if (!found) {
          throw new Error("Dynamic DB mutation failed: module was not immediately reflected from PostgreSQL!");
        }

        // Cleanup
        await workerPrisma.appModule.delete({ where: { code: tempCode } });

        parentPort?.postMessage({
          threadId: 4,
          name: "Live Database Dynamic Integrity",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            tempModuleId: created.id,
            verifiedReflection: true,
            zeroHardcodeProven: true,
          },
        });
      }
    } catch (err: any) {
      parentPort?.postMessage({
        threadId,
        status: "FAILED",
        error: err.message || String(err),
      });
    } finally {
      await workerPrisma.$disconnect();
    }
  })();
} else {
  // MAIN THREAD CONTROLLER
  async function runMultiThreadedProvisioning() {
    console.log("================================================================================");
    console.log("   SPAWNING MULTI-THREADED WORKER ENGINE FOR DATABASE PROVISIONING & WIRING     ");
    console.log("================================================================================\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const testDbUrl = "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public";

    const databases = [
      { name: "Development (trend_mr)", url: devDbUrl },
      { name: "Test (trend_mr_test)", url: testDbUrl },
    ];

    for (const targetDb of databases) {
      console.log(`\n🚀 [Phase 1: Parallel Provisioning Threads] Launching Worker 1 & 2 for ${targetDb.name}...`);

      const spawnWorker = (threadId: number): Promise<any> => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(__filename, {
            workerData: { threadId, dbUrl: targetDb.url },
            execArgv: ["--import", "tsx"],
          });

          worker.on("message", (msg) => {
            console.log(`   ✔️ [Thread ${msg.threadId}] ${msg.name || "Worker"} — Status: ${msg.status} (${msg.durationMs}ms)`);
            if (msg.status === "FAILED") {
              reject(new Error(`Thread ${msg.threadId} failed: ${msg.error}`));
            } else {
              resolve(msg);
            }
          });

          worker.on("error", (err) => {
            console.error(`   ❌ [Thread ${threadId}] Worker Error:`, err);
            reject(err);
          });

          worker.on("exit", (code) => {
            if (code !== 0) {
              reject(new Error(`Worker ${threadId} stopped with exit code ${code}`));
            }
          });
        });
      };

      // Phase 1: Provisioning threads in parallel
      await Promise.all([spawnWorker(1), spawnWorker(2)]);
      console.log(`   ✅ Phase 1 Parallel Provisioning complete for ${targetDb.name}!`);

      // Phase 2: Logic Resolution & Verification threads in parallel
      console.log(`\n🔍 [Phase 2: Parallel Resolution & Verification Threads] Launching Worker 3 & 4 for ${targetDb.name}...`);
      await Promise.all([spawnWorker(3), spawnWorker(4)]);
      console.log(`   ✅ Phase 2 Parallel Resolution & Verification complete for ${targetDb.name}!`);
    }

    console.log("\n================================================================================");
    console.log("   ALL HARDCODED VALUES PROVISIONED & VERIFIED FROM POSTGRESQL (100% SUCCESS)   ");
    console.log("================================================================================\n");
  }

  runMultiThreadedProvisioning().catch((err) => {
    console.error("Multi-threaded execution error:", err);
    process.exit(1);
  });
}
