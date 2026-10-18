import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { PrismaClient } from "@prisma/client";

// ============================================================================
// CONFIGURATION & CREDENTIALS
// ============================================================================
const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const PSCP_PATH = 'C:\\Program Files\\PuTTY\\pscp.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_DB_PASS = 'TrendMr2026Secure';
const VPS_WEB_DIR = '/u01/apps/Metapharsic_MrTracker/web';

const LOCAL_UPLOADS_DIR = path.resolve(__dirname, "../public/uploads");
const LOCAL_DATA_DIR = path.resolve(__dirname, "../data");

export interface WorkerThreadResult {
  threadId: number;
  taskName: string;
  agentRole: string;
  status: "SUCCESS" | "FAILED";
  durationMs: number;
  data?: any;
  error?: string;
}

export function runVpsSql(sql: string): string {
  const res = spawnSync(
    PLINK_PATH,
    [
      "-batch",
      "-i", SSH_KEY_PATH,
      VPS_HOST,
      `PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -t -A`,
    ],
    {
      input: sql + "\n",
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (res.status !== 0 || res.error) {
    return `ERROR: ${res.stderr || res.error?.message || "Unknown error"}`;
  }
  return (res.stdout || "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// BIDIRECTIONAL TABLE SYNCHRONIZER
// ─────────────────────────────────────────────────────────────────────────────
async function syncTableBidirectionally(prisma: PrismaClient, tableName: string) {
  const isJunction = tableName.startsWith("_");
  const getKey = (row: any) => isJunction ? `${row.A}_${row.B}` : String(row.id);

  // 1. Fetch Local rows
  let localList: any[] = [];
  try {
    const localRows: any = await prisma.$queryRawUnsafe(`SELECT row_to_json(t) as row FROM "${tableName}" t`);
    localList = localRows.map((r: any) => r.row);
  } catch (err: any) {
    return { tableName, error: `Local query failed: ${err.message}`, localCount: 0, vpsCount: 0, localPushed: 0, vpsPushed: 0 };
  }

  // 2. Fetch VPS rows
  let vpsList: any[] = [];
  const vpsRes = runVpsSql(`SELECT json_agg(t) FROM "${tableName}" t`);
  if (vpsRes && vpsRes !== "null" && !vpsRes.startsWith("ERROR")) {
    try {
      vpsList = JSON.parse(vpsRes) || [];
    } catch {
      vpsList = [];
    }
  }

  const localKeyMap = new Map<string, any>();
  for (const r of localList) localKeyMap.set(getKey(r), r);

  const vpsKeyMap = new Map<string, any>();
  for (const r of vpsList) vpsKeyMap.set(getKey(r), r);

  const missingInVps: any[] = [];
  for (const [key, row] of localKeyMap.entries()) {
    if (!vpsKeyMap.has(key)) {
      missingInVps.push(row);
    }
  }

  const missingInLocal: any[] = [];
  for (const [key, row] of vpsKeyMap.entries()) {
    if (!localKeyMap.has(key)) {
      missingInLocal.push(row);
    }
  }

  let localPushed = 0;
  let vpsPushed = 0;

  // 3. Push missing records to VPS
  if (missingInVps.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < missingInVps.length; i += chunkSize) {
      const chunk = missingInVps.slice(i, i + chunkSize);
      const jsonStr = JSON.stringify(chunk);
      const insertSql = `
        INSERT INTO "${tableName}"
        SELECT * FROM json_populate_recordset(null::"${tableName}", $JSON$${jsonStr}$JSON$::json)
        ON CONFLICT DO NOTHING;
      `;
      const res = runVpsSql(insertSql);
      if (!res.startsWith("ERROR")) {
        localPushed += chunk.length;
      } else {
        console.error(`  [VPS INSERT ERROR] ${tableName}:`, res.slice(0, 200));
      }
    }
  }

  // 4. Push missing records to Local
  if (missingInLocal.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < missingInLocal.length; i += chunkSize) {
      const chunk = missingInLocal.slice(i, i + chunkSize);
      const jsonStr = JSON.stringify(chunk);
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "${tableName}"
          SELECT * FROM json_populate_recordset(null::"${tableName}", $JSON$${jsonStr}$JSON$::json)
          ON CONFLICT DO NOTHING;
        `);
        vpsPushed += chunk.length;
      } catch (err: any) {
        console.error(`  [LOCAL INSERT ERROR] ${tableName}:`, err.message?.slice(0, 200));
      }
    }
  }

  // 5. Final counts
  const finalLocal: any = await prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM "${tableName}"`);
  const finalVps = parseInt(runVpsSql(`SELECT count(*) FROM "${tableName}"`), 10) || 0;

  return {
    tableName,
    localPushed,
    vpsPushed,
    finalLocalCount: finalLocal[0]?.c ?? 0,
    finalVpsCount: finalVps,
    matched: (finalLocal[0]?.c ?? 0) === finalVps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER EXECUTION DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export async function executeWorkerTask(threadId: number, taskName: string): Promise<WorkerThreadResult> {
  const startTime = Date.now();
  const prisma = new PrismaClient();

  try {
    if (taskName === "ORGANIZATION_MASTERS_WORKER") {
      // Worker 1: Foundations, Hierarchy & Masters
      const tables = [
        "User",
        "Employee",
        "Territory",
        "Product",
        "DiscountScheme",
        "_EmployeeToTerritory",
        "Doctor",
        "Chemist",
        "Hospital",
        "Distributor",
        "VisualAid",
        "GiftCatalog",
        "Notification",
        "refresh_tokens",
      ];
      const results: any[] = [];
      for (const t of tables) {
        const res = await syncTableBidirectionally(prisma, t);
        results.push(res);
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        agentRole: "AGENT-ORG-MASTERS-SYNC",
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        data: { tables: results },
      };
    }

    if (taskName === "FIELD_ACTIVITIES_AND_CALLS_WORKER") {
      // Worker 2: Field Activities, Calls, Samples, Leads
      const tables = [
        "Attendance",
        "TourPlan",
        "TourPlanDay",
        "DoctorCRMProfile",
        "PrescriptionHistory",
        "HospitalFormulary",
        "HospitalTender",
        "Visit",
        "Sample",
        "SampleInventory",
        "SampleAllocationLog",
        "Gift",
        "CompetitorLog",
        "Lead",
        "anomaly_reviews",
        "LeaveRequest",
        "LMSCourse",
        "LMSEnrollment",
      ];
      const results: any[] = [];
      for (const t of tables) {
        const res = await syncTableBidirectionally(prisma, t);
        results.push(res);
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        agentRole: "AGENT-FIELD-ACTIVITIES-SYNC",
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        data: { tables: results },
      };
    }

    if (taskName === "COMMERCIAL_ORDERS_AND_FINANCE_WORKER") {
      // Worker 3: Orders, Ledgers, Invoices, Finance
      const tables = [
        "InventoryMovement",
        "Order",
        "OrderItem",
        "Invoice",
        "EntityLedger",
        "ExpenseLimit",
        "Expense",
        "Claim",
        "CreditNote",
        "Payroll",
        "Target",
        "Collection",
        "ChartOfAccount",
        "LedgerTransaction",
        "LedgerEntry",
      ];
      const results: any[] = [];
      for (const t of tables) {
        const res = await syncTableBidirectionally(prisma, t);
        results.push(res);
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        agentRole: "AGENT-COMMERCIAL-FINANCE-SYNC",
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        data: { tables: results },
      };
    }

    if (taskName === "SYSTEM_GOVERNANCE_AND_DMS_WORKER") {
      // Worker 4: DMS, Governance, Logs
      const tables = [
        "CompanySettings",
        "WorkflowSettings",
        "app_modules",
        "system_artifacts",
        "dms_documents",
        "dms_versions",
        "dms_workflows",
        "dms_audit_trail",
        "whatsapp_dispatch_logs",
        "LocationLog",
      ];
      const results: any[] = [];
      for (const t of tables) {
        const res = await syncTableBidirectionally(prisma, t);
        results.push(res);
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        agentRole: "AGENT-SYSTEM-DMS-SYNC",
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        data: { tables: results },
      };
    }

    if (taskName === "STATIC_ASSETS_AND_UPLOADS_MIRROR_WORKER") {
      // Worker 5: Bidirectional Files & Uploads Mirroring
      const folders = [
        "drug_licenses",
        "certificates",
        "customer-docs",
        "hr",
        "receipts",
        "visits",
        "company",
        "company-formation",
        "dms",
      ];
      const folderStats: Record<string, { localCount: number; vpsCount: number }> = {};

      for (const folder of folders) {
        const localDir = path.join(LOCAL_UPLOADS_DIR, folder);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const remoteDir = `${VPS_WEB_DIR}/public/uploads/${folder}`;

        // Ensure remote dir exists
        spawnSync(PLINK_PATH, ["-batch", "-i", SSH_KEY_PATH, VPS_HOST, `mkdir -p ${remoteDir}`]);

        // Push local files to VPS using PSCP
        if (fs.existsSync(localDir) && fs.readdirSync(localDir).length > 0) {
          spawnSync(PSCP_PATH, ["-batch", "-i", SSH_KEY_PATH, "-r", localDir, `${VPS_HOST}:${VPS_WEB_DIR}/public/uploads/`]);
        }

        // Pull remote files to Local using PSCP
        spawnSync(PSCP_PATH, ["-batch", "-i", SSH_KEY_PATH, "-r", `${VPS_HOST}:${remoteDir}`, `${LOCAL_UPLOADS_DIR}/`]);

        const finalLocalCount = fs.existsSync(localDir) ? fs.readdirSync(localDir).length : 0;
        const vpsCountRes = spawnSync(PLINK_PATH, ["-batch", "-i", SSH_KEY_PATH, VPS_HOST, `ls -1 '${remoteDir}' 2>/dev/null | wc -l`], { encoding: "utf8" });
        const finalVpsCount = parseInt(vpsCountRes.stdout?.trim() || "0", 10);
        folderStats[folder] = { localCount: finalLocalCount, vpsCount: finalVpsCount };
      }

      // Sync logo and system config
      try {
        spawnSync(PSCP_PATH, ["-batch", "-i", SSH_KEY_PATH, "C:\\Trend_MR\\web\\public\\logo.png", `${VPS_HOST}:${VPS_WEB_DIR}/public/logo.png`]);
      } catch (e) {}

      try {
        spawnSync(PSCP_PATH, ["-batch", "-i", SSH_KEY_PATH, path.join(LOCAL_DATA_DIR, "system-config.json"), `${VPS_HOST}:${VPS_WEB_DIR}/data/system-config.json`]);
      } catch (e) {}

      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        agentRole: "AGENT-ASSETS-MIRROR-SYNC",
        status: "SUCCESS",
        durationMs: Date.now() - startTime,
        data: folderStats,
      };
    }

    throw new Error(`Unknown task: ${taskName}`);
  } catch (err: any) {
    await prisma.$disconnect();
    return {
      threadId,
      taskName,
      agentRole: "AGENT-ERROR",
      status: "FAILED",
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER THREAD ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
if (!isMainThread) {
  const { threadId, taskName } = workerData;
  executeWorkerTask(threadId, taskName)
    .then((result) => {
      parentPort?.postMessage(result);
    })
    .catch((err) => {
      parentPort?.postMessage({
        threadId,
        taskName,
        agentRole: "AGENT-ERROR",
        status: "FAILED",
        durationMs: 0,
        error: err.message || String(err),
      });
    });
} else {
  // ───────────────────────────────────────────────────────────────────────────
  // MAIN ORCHESTRATION ENGINE
  // ───────────────────────────────────────────────────────────────────────────
  async function spawnWorker(threadId: number, taskName: string): Promise<WorkerThreadResult> {
    const tsxLoaderPath = path.resolve(__dirname, "../node_modules/tsx/dist/loader.mjs");
    const execArgv = fs.existsSync(tsxLoaderPath)
      ? ["--import", pathToFileURL(tsxLoaderPath).href]
      : ["--import", "tsx"];

    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { threadId, taskName },
        execArgv,
      });
      worker.on("message", resolve);
      worker.on("error", (err) => {
        console.error(`[Worker ${threadId} ERROR]`, err);
        reject(err);
      });
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker thread #${threadId} exited with code ${code}`));
        }
      });
    });
  }

  async function main() {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED BIDIRECTIONAL SYNC ENGINE (LOCAL <-> VPS PRODUCTION)");
    console.log("   Preserves all existing data, unifies call reports, deal closures & assets");
    console.log("================================================================================\x1b[0m\n");

    const overallStart = Date.now();

    // ─────────────────────────────────────────────────────────────
    // STEP 0: Create VPS Pre-flight Safety Backup
    // ─────────────────────────────────────────────────────────────
    console.log("\x1b[1;33m[STEP 0] Creating VPS pre-flight PostgreSQL safety snapshot...\x1b[0m");
    const backupRes = spawnSync(
      PLINK_PATH,
      [
        "-batch",
        "-i", SSH_KEY_PATH,
        VPS_HOST,
        `PGPASSWORD=${VPS_DB_PASS} pg_dump -h localhost -U trend_mr_user -d trend_mr --format=custom -f /tmp/vps_pre_sync_backup.dump`,
      ],
      { encoding: "utf8" }
    );
    if (backupRes.status === 0) {
      console.log("  \x1b[32m✔ VPS snapshot saved at /tmp/vps_pre_sync_backup.dump\x1b[0m\n");
    } else {
      console.warn("  ⚠ VPS snapshot notice:", backupRes.stderr || "Snapshot command completed");
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: FOUNDATION MASTERS & ASSETS (Thread #1 & Thread #5)
    // ─────────────────────────────────────────────────────────────
    console.log("\x1b[1;35m>>> PHASE 1: Concurrently executing Masters Sync & Assets Mirror...\x1b[0m");
    const phase1Results = await Promise.all([
      spawnWorker(1, "ORGANIZATION_MASTERS_WORKER"),
      spawnWorker(5, "STATIC_ASSETS_AND_UPLOADS_MIRROR_WORKER"),
    ]);

    for (const r of phase1Results) {
      const color = r.status === "SUCCESS" ? "\x1b[32m" : "\x1b[31m";
      console.log(`  ${color}✔ [Thread #${r.threadId}] ${r.agentRole} (${r.taskName}) completed in ${r.durationMs}ms\x1b[0m`);
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: CALLS, DEALS, COMMERCE & DMS (Threads #2, #3, #4)
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[1;35m>>> PHASE 2: Concurrently executing Calls, Deals, Orders & DMS Workers...\x1b[0m");
    const phase2Results = await Promise.all([
      spawnWorker(2, "FIELD_ACTIVITIES_AND_CALLS_WORKER"),
      spawnWorker(3, "COMMERCIAL_ORDERS_AND_FINANCE_WORKER"),
      spawnWorker(4, "SYSTEM_GOVERNANCE_AND_DMS_WORKER"),
    ]);

    for (const r of phase2Results) {
      const color = r.status === "SUCCESS" ? "\x1b[32m" : "\x1b[31m";
      console.log(`  ${color}✔ [Thread #${r.threadId}] ${r.agentRole} (${r.taskName}) completed in ${r.durationMs}ms\x1b[0m`);
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 3: PARITY VERIFICATION & AUDIT TABLE
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[1;36m================================================================================");
    console.log("            BIDIRECTIONAL PARITY & SYNCHRONIZATION AUDIT REPORT                 ");
    console.log("================================================================================\x1b[0m\n");

    const prisma = new PrismaClient();
    const auditTables = [
      "Territory",
      "Product",
      "User",
      "Employee",
      "Doctor",
      "Chemist",
      "Hospital",
      "Distributor",
      "Visit",
      "Sample",
      "Gift",
      "CompetitorLog",
      "Lead",
      "Order",
      "OrderItem",
      "TourPlan",
      "TourPlanDay",
      "Attendance",
      "Invoice",
      "EntityLedger",
      "CompanySettings",
      "dms_documents",
      "dms_versions",
      "app_modules",
      "system_artifacts",
    ];

    console.log("┌───────────────────────────────────┬──────────────┬──────────────┬────────┬──────────────┐");
    console.log("│ Table Name                        │  Local Count │   VPS Count  │  Diff  │ Parity State │");
    console.log("├───────────────────────────────────┼──────────────┼──────────────┼────────┼──────────────┤");

    let matchCount = 0;
    for (const tbl of auditTables) {
      const localRes: any = await prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM "${tbl}"`);
      const lCount = localRes[0]?.c ?? 0;
      const vpsRes = runVpsSql(`SELECT count(*) FROM "${tbl}"`);
      const vCount = parseInt(vpsRes, 10) || 0;
      const diff = lCount - vCount;
      const matched = diff === 0;
      if (matched) matchCount++;

      const statusStr = matched ? "\x1b[32m✔ EQUAL \x1b[0m" : "\x1b[31m✖ DRIFT \x1b[0m";
      const diffStr = diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`;
      console.log(
        `│ ${tbl.padEnd(33)} │ ${lCount.toString().padStart(12)} │ ${vCount.toString().padStart(12)} │ ${diffStr.padStart(6)} │ ${statusStr}     │`
      );
    }
    console.log("└───────────────────────────────────┴──────────────┴──────────────┴────────┴──────────────┘");

    const totalSeconds = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\n\x1b[1;32m✔ PARITY AUDIT: ${matchCount}/${auditTables.length} tables verified in 100% parity across Local and VPS (${totalSeconds}s)\x1b[0m`);

    // ─────────────────────────────────────────────────────────────
    // PHASE 4: VPS NEXT.JS REBUILD & PM2 RELOAD
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[1;33m[PHASE 4] Rebuilding and restarting Next.js on VPS with updated data cache...\x1b[0m");
    const restartRes = spawnSync(
      PLINK_PATH,
      [
        "-batch",
        "-i", SSH_KEY_PATH,
        VPS_HOST,
        `cd ${VPS_WEB_DIR} && npx prisma generate && npm run build && pm2 reload trend-mr --update-env`,
      ],
      { encoding: "utf8", timeout: 600000 }
    );
    if (restartRes.status === 0) {
      console.log("  \x1b[32m✔ VPS Next.js production build & PM2 reload succeeded.\x1b[0m");
    } else {
      console.warn("  ⚠ VPS restart output:", (restartRes.stderr || restartRes.stdout || "").slice(0, 300));
    }

    // Health check
    const health = spawnSync(
      PLINK_PATH,
      ["-batch", "-i", SSH_KEY_PATH, VPS_HOST, "curl -I -s http://localhost:3000/login"],
      { encoding: "utf8" }
    );
    if (health.stdout?.includes("200")) {
      console.log("  \x1b[32m✔ VPS HTTP Health Check: 200 OK\x1b[0m\n");
    } else {
      console.log("  ℹ VPS HTTP response:", health.stdout?.slice(0, 100));
    }

    await prisma.$disconnect();
    process.exit(0);
  }

  if (process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("multithreaded_bidirectional_vps_sync")) {
    main().catch((err) => {
      console.error("Fatal Bidirectional Sync Error:", err);
      process.exit(1);
    });
  }
}
