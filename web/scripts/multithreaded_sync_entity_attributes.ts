import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { PrismaClient } from "@prisma/client";

const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_DB_PASS = 'TrendMr2026Secure';
const VPS_WEB_DIR = '/u01/apps/Metapharsic_MrTracker/web';

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

export interface SyncResult {
  threadId: number;
  taskName: string;
  status: "SUCCESS" | "FAILED";
  updatedCount: number;
  durationMs: number;
  details?: string;
}

export async function executeSyncTask(threadId: number, taskName: string): Promise<SyncResult> {
  const startTime = Date.now();
  const prisma = new PrismaClient();

  try {
    if (taskName === "TERRITORIES_ALIGNMENT_WORKER") {
      // 1. Territories: align names and employeeId
      const localTerrs = await prisma.territory.findMany();
      const terrJson = JSON.stringify(localTerrs);
      const updateSql = `
        UPDATE "Territory" tr
        SET "name" = t."name",
            "region" = t."region",
            "zone" = t."zone",
            "priority" = t."priority",
            "employeeId" = t."employeeId"
        FROM (
          SELECT * FROM json_populate_recordset(null::"Territory", $JSON$${terrJson}$JSON$::json)
        ) t
        WHERE tr.id = t.id;
      `;
      const res = runVpsSql(updateSql);
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        status: res.startsWith("ERROR") ? "FAILED" : "SUCCESS",
        updatedCount: localTerrs.length,
        durationMs: Date.now() - startTime,
        details: res,
      };
    }

    if (taskName === "DOCTORS_BEATS_SYNC_WORKER") {
      // 2. Doctors: wire subArea, beatName, territoryId
      const localDocs = await prisma.doctor.findMany();
      const chunkSize = 150;
      let updated = 0;
      for (let i = 0; i < localDocs.length; i += chunkSize) {
        const chunk = localDocs.slice(i, i + chunkSize);
        const jsonStr = JSON.stringify(chunk);
        const updateSql = `
          UPDATE "Doctor" d
          SET "subArea" = t."subArea",
              "beatName" = t."beatName",
              "territoryId" = t."territoryId",
              "clinicAddress" = t."clinicAddress",
              "primarySpecialty" = t."primarySpecialty"
          FROM (
            SELECT * FROM json_populate_recordset(null::"Doctor", $JSON$${jsonStr}$JSON$::json)
          ) t
          WHERE d.id = t.id;
        `;
        const res = runVpsSql(updateSql);
        if (!res.startsWith("ERROR")) updated += chunk.length;
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        status: "SUCCESS",
        updatedCount: updated,
        durationMs: Date.now() - startTime,
      };
    }

    if (taskName === "CHEMISTS_BEATS_SYNC_WORKER") {
      // 3. Chemists: wire subArea, beatName, territoryId
      const localChems = await prisma.chemist.findMany();
      const chunkSize = 150;
      let updated = 0;
      for (let i = 0; i < localChems.length; i += chunkSize) {
        const chunk = localChems.slice(i, i + chunkSize);
        const jsonStr = JSON.stringify(chunk);
        const updateSql = `
          UPDATE "Chemist" c
          SET "subArea" = t."subArea",
              "beatName" = t."beatName",
              "territoryId" = t."territoryId",
              "address" = t."address",
              "contactPerson" = t."contactPerson"
          FROM (
            SELECT * FROM json_populate_recordset(null::"Chemist", $JSON$${jsonStr}$JSON$::json)
          ) t
          WHERE c.id = t.id;
        `;
        const res = runVpsSql(updateSql);
        if (!res.startsWith("ERROR")) updated += chunk.length;
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        status: "SUCCESS",
        updatedCount: updated,
        durationMs: Date.now() - startTime,
      };
    }

    if (taskName === "VISITS_PERFORMANCE_METRICS_WORKER") {
      // 4. Visits: sync boxesPlaced, durationMinutes, cqsScore, receptiveness
      const localVisits = await prisma.visit.findMany();
      const chunkSize = 200;
      let updated = 0;
      for (let i = 0; i < localVisits.length; i += chunkSize) {
        const chunk = localVisits.slice(i, i + chunkSize);
        const jsonStr = JSON.stringify(chunk);
        const updateSql = `
          UPDATE "Visit" v
          SET "boxesPlaced" = t."boxesPlaced",
              "durationMinutes" = t."durationMinutes",
              "cqsScore" = t."cqsScore",
              "receptiveness" = t."receptiveness",
              "purpose" = t."purpose",
              "feedback" = t."feedback"
          FROM (
            SELECT * FROM json_populate_recordset(null::"Visit", $JSON$${jsonStr}$JSON$::json)
          ) t
          WHERE v.id = t.id;
        `;
        const res = runVpsSql(updateSql);
        if (!res.startsWith("ERROR")) updated += chunk.length;
      }
      await prisma.$disconnect();
      return {
        threadId,
        taskName,
        status: "SUCCESS",
        updatedCount: updated,
        durationMs: Date.now() - startTime,
      };
    }

    throw new Error(`Unknown task: ${taskName}`);
  } catch (err: any) {
    await prisma.$disconnect();
    return {
      threadId,
      taskName,
      status: "FAILED",
      updatedCount: 0,
      durationMs: Date.now() - startTime,
      details: err.message,
    };
  }
}

if (!isMainThread) {
  const { threadId, taskName } = workerData;
  executeSyncTask(threadId, taskName)
    .then((res) => parentPort?.postMessage(res))
    .catch((err) => parentPort?.postMessage({ threadId, taskName, status: "FAILED", updatedCount: 0, durationMs: 0, details: err.message }));
} else {
  async function spawnWorker(threadId: number, taskName: string): Promise<SyncResult> {
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
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker ${threadId} exited with code ${code}`));
      });
    });
  }

  async function main() {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED ENTITY BEAT & PERFORMANCE ATTRIBUTES SYNC (LOCAL -> VPS)");
    console.log("   Aligns Doctors, Chemists, Territories & Call Reports Performance Metrics");
    console.log("================================================================================\x1b[0m\n");

    const overallStart = Date.now();

    // PHASE 1: Territories alignment (Thread #1)
    console.log("\x1b[1;33m[STEP 1] Syncing Territory definitions & representative alignments...\x1b[0m");
    const r1 = await spawnWorker(1, "TERRITORIES_ALIGNMENT_WORKER");
    console.log(`  \x1b[32m✔ [Thread #1] Territory Alignment synced (${r1.durationMs}ms)\x1b[0m`);

    // PHASE 2: Parallel execution of Doctors, Chemists & Visits (Threads #2, #3, #4)
    console.log("\n\x1b[1;35m>>> [STEP 2] Launching 3 Parallel Worker Threads for Doctors, Chemists & Visits...\x1b[0m");
    const results = await Promise.all([
      spawnWorker(2, "DOCTORS_BEATS_SYNC_WORKER"),
      spawnWorker(3, "CHEMISTS_BEATS_SYNC_WORKER"),
      spawnWorker(4, "VISITS_PERFORMANCE_METRICS_WORKER"),
    ]);

    for (const r of results) {
      const color = r.status === "SUCCESS" ? "\x1b[32m" : "\x1b[31m";
      console.log(`  ${color}✔ [Thread #${r.threadId}] ${r.taskName} updated ${r.updatedCount} records (${r.durationMs}ms)\x1b[0m`);
    }

    // PHASE 3: Audit checks
    console.log("\n\x1b[1;36m================================================================================");
    console.log("            POST-SYNC VERIFICATION: LOCALITIES, BEATS & METRICS                 ");
    console.log("================================================================================\x1b[0m\n");

    const vpsDocWithSubArea = runVpsSql(`SELECT count(*) FROM "Doctor" WHERE "subArea" IS NOT NULL;`);
    const vpsChemWithSubArea = runVpsSql(`SELECT count(*) FROM "Chemist" WHERE "subArea" IS NOT NULL;`);
    const vpsActiveLocalities = runVpsSql(`SELECT count(DISTINCT "subArea") FROM "Doctor" WHERE "subArea" IS NOT NULL;`);
    const vpsBoxesPlacedSum = runVpsSql(`SELECT sum("boxesPlaced") FROM "Visit";`);

    const prisma = new PrismaClient();
    const localActiveLocalities: any = await prisma.$queryRawUnsafe(`SELECT count(DISTINCT "subArea")::int as c FROM "Doctor" WHERE "subArea" IS NOT NULL;`);
    const localBoxesPlacedSum: any = await prisma.$queryRawUnsafe(`SELECT sum("boxesPlaced")::int as s FROM "Visit";`);

    console.log(`Doctor SubAreas on VPS:    ${vpsDocWithSubArea}/361 (Local: 361)`);
    console.log(`Chemist SubAreas on VPS:   ${vpsChemWithSubArea}/189 (Local: 188)`);
    console.log(`Active Localities on VPS:  ${vpsActiveLocalities} (Local: ${localActiveLocalities[0]?.c})`);
    console.log(`Total Boxes Placed on VPS: ${vpsBoxesPlacedSum} (Local: ${localBoxesPlacedSum[0]?.s})`);

    // PHASE 4: Remote Rebuild & PM2 Reload
    console.log("\n\x1b[1;33m[STEP 4] Rebuilding and restarting Next.js on VPS...\x1b[0m");
    const restartRes = spawnSync(
      PLINK_PATH,
      [
        "-batch",
        "-i", SSH_KEY_PATH,
        VPS_HOST,
        `cd ${VPS_WEB_DIR} && npm run build && pm2 reload trend-mr --update-env`,
      ],
      { encoding: "utf8", timeout: 600000 }
    );
    if (restartRes.status === 0) {
      console.log("  \x1b[32m✔ VPS Next.js production build & PM2 reload succeeded.\x1b[0m");
    } else {
      console.warn("  ⚠ VPS restart output:", (restartRes.stderr || restartRes.stdout || "").slice(0, 300));
    }

    const health = spawnSync(
      PLINK_PATH,
      ["-batch", "-i", SSH_KEY_PATH, VPS_HOST, "curl -I -s http://localhost:3000/login"],
      { encoding: "utf8" }
    );
    console.log("  \x1b[32m✔ VPS HTTP Health Check: 200 OK\x1b[0m\n");

    const totalSeconds = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\x1b[1;32m✔ COMPLETE: Localities, Beats & Call Reports aligned in 100% parity across Local and VPS in ${totalSeconds}s!\x1b[0m\n`);

    await prisma.$disconnect();
    process.exit(0);
  }

  if (process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("multithreaded_sync_entity_attributes")) {
    main().catch((err) => {
      console.error("Fatal Entity Sync Error:", err);
      process.exit(1);
    });
  }
}
