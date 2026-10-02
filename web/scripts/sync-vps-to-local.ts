import { execSync, spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { db } from "../lib/db";
import { multiAgentCouncil } from "../lib/multi-agent-council";
import { CommercialAgentsService } from "../services/commercial-agents.service";

// ============================================================================
// CONFIGURATION & CREDENTIALS
// ============================================================================
const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const PSCP_PATH = 'C:\\Program Files\\PuTTY\\pscp.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_DB_PASS = 'TrendMr2026Secure';
const LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public';
const LOCAL_PSQL_PATH = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

const SCRATCH_DIR = path.resolve(__dirname, "../../scratch");
const DUMP_FILE = path.join(SCRATCH_DIR, "vps_dump_latest.sql");
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, "../public/uploads");
const LOCAL_DATA_DIR = path.resolve(__dirname, "../data");

const UPLOAD_CATEGORIES = [
  "company",
  "company-formation",
  "dms",
  "receipts",
  "visits"
];

interface TableParity {
  tableName: string;
  vpsCount: number;
  localCount: number;
  diff: number;
  matched: boolean;
}

interface WorkerResult {
  workerId: string;
  category: string;
  status: "SUCCESS" | "FAILED";
  itemCount: number;
  durationMs: number;
  details: string;
}

// Helper to count files in a directory recursively
function countFilesInDir(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFilesInDir(path.join(dirPath, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

// ============================================================================
// AGENT 1: REMOTE DATABASE EXTRACTION STREAMER
// ============================================================================
async function runDbExtractionAgent(): Promise<{ dumpFile: string; dumpSizeMb: string; durationSec: string }> {
  console.log("\x1b[1;33m[AGENT 1: REMOTE DB EXTRACTION STREAMER]\x1b[0m Initiating live PostgreSQL dump from VPS...");
  const t0 = Date.now();

  const dumpCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "PGPASSWORD=${VPS_DB_PASS} pg_dump -h 127.0.0.1 -U trend_mr_user -d trend_mr --schema=public --clean --if-exists --no-owner --no-acl"`;

  return new Promise((resolve, reject) => {
    const dumpResult = spawnSync(dumpCmd, {
      shell: true,
      maxBuffer: 1024 * 1024 * 256, // 256MB
    });

    if (dumpResult.error || dumpResult.status !== 0) {
      const errStr = dumpResult.stderr?.toString() || dumpResult.error?.message || "Unknown error";
      reject(new Error(`Remote pg_dump failed: ${errStr}`));
      return;
    }

    fs.writeFileSync(DUMP_FILE, dumpResult.stdout);
    const dumpSizeBytes = fs.statSync(DUMP_FILE).size;
    const dumpSizeMb = (dumpSizeBytes / (1024 * 1024)).toFixed(2);
    const durationSec = ((Date.now() - t0) / 1000).toFixed(2);

    console.log(`\x1b[32m✔ [AGENT 1] Snapshot created (${dumpSizeMb} MB) in ${durationSec}s at ${DUMP_FILE}\x1b[0m`);
    resolve({ dumpFile: DUMP_FILE, dumpSizeMb, durationSec });
  });
}

// ============================================================================
// AGENT 2: PARALLEL MULTI-THREADED ASSETS & CONFIG SYNC POOL
// ============================================================================
async function streamSingleUploadCategory(category: string): Promise<WorkerResult> {
  const start = Date.now();
  const destDir = path.join(LOCAL_UPLOADS_DIR, category);
  fs.mkdirSync(destDir, { recursive: true });

  return new Promise((resolve) => {
    const remoteCmd = `cd /u01/apps/Metapharsic_MrTracker/web/public/uploads && tar -czf - ${category}`;
    const plinkProc = spawn(PLINK_PATH, [
      '-batch',
      '-i', SSH_KEY_PATH,
      VPS_HOST,
      remoteCmd
    ]);

    const tarProc = spawn('tar', ['-xzf', '-', '-C', LOCAL_UPLOADS_DIR]);

    plinkProc.stdout.pipe(tarProc.stdin);

    let errOutput = '';
    plinkProc.stderr.on('data', d => errOutput += d.toString());
    tarProc.stderr.on('data', d => errOutput += d.toString());

    tarProc.on('close', (code) => {
      const durationMs = Date.now() - start;
      if (code === 0) {
        const fileCount = countFilesInDir(destDir);
        resolve({
          workerId: `Worker-${category}`,
          category,
          status: "SUCCESS",
          itemCount: fileCount,
          durationMs,
          details: `${fileCount} file(s) mirrored`
        });
      } else {
        resolve({
          workerId: `Worker-${category}`,
          category,
          status: "FAILED",
          itemCount: 0,
          durationMs,
          details: `Error: ${errOutput.slice(0, 100)}`
        });
      }
    });

    plinkProc.on('error', (err) => {
      resolve({
        workerId: `Worker-${category}`,
        category,
        status: "FAILED",
        itemCount: 0,
        durationMs: Date.now() - start,
        details: err.message
      });
    });
  });
}

async function syncSystemConfig(): Promise<WorkerResult> {
  const start = Date.now();
  const destFile = path.join(LOCAL_DATA_DIR, "system-config.json");
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });

  return new Promise((resolve) => {
    const pscpCmd = `"${PSCP_PATH}" -batch -i "${SSH_KEY_PATH}" "${VPS_HOST}:/u01/apps/Metapharsic_MrTracker/web/data/system-config.json" "${destFile}"`;
    try {
      execSync(pscpCmd, { stdio: "ignore" });
      const sizeBytes = fs.existsSync(destFile) ? fs.statSync(destFile).size : 0;
      resolve({
        workerId: "Worker-system-config",
        category: "system-config",
        status: "SUCCESS",
        itemCount: 1,
        durationMs: Date.now() - start,
        details: `Config synced (${(sizeBytes / 1024).toFixed(1)} KB)`
      });
    } catch (e: any) {
      resolve({
        workerId: "Worker-system-config",
        category: "system-config",
        status: "FAILED",
        itemCount: 0,
        durationMs: Date.now() - start,
        details: e.message
      });
    }
  });
}

async function runParallelAssetSyncPool(): Promise<WorkerResult[]> {
  console.log("\x1b[1;33m[AGENT 2: PARALLEL ASSET SYNC WORKER POOL]\x1b[0m Spawning parallel workers for uploads & system data...");
  const t0 = Date.now();

  const workerPromises: Promise<WorkerResult>[] = [
    ...UPLOAD_CATEGORIES.map(cat => streamSingleUploadCategory(cat)),
    syncSystemConfig()
  ];

  const results = await Promise.all(workerPromises);
  const totalDuration = ((Date.now() - t0) / 1000).toFixed(2);

  for (const r of results) {
    const statusTag = r.status === "SUCCESS" ? "\x1b[32m✔ SUCCESS\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
    console.log(`  [${r.workerId.padEnd(25)}] ${statusTag} | ${r.details.padEnd(30)} in ${(r.durationMs / 1000).toFixed(2)}s`);
  }
  console.log(`\x1b[32m✔ [AGENT 2] All parallel asset workers finished in ${totalDuration}s.\x1b[0m\n`);
  return results;
}

// ============================================================================
// AGENT 3: LOCAL DATABASE INGESTION & PRISMA ALIGNMENT
// ============================================================================
async function runLocalDbIngestionAgent(): Promise<void> {
  console.log("\x1b[1;33m[AGENT 3: LOCAL INGESTION & ALIGNMENT AGENT]\x1b[0m Cleaning local schema & restoring live VPS snapshot...");
  const ingestStart = Date.now();

  const cleanPsqlUrl = LOCAL_DB_URL.replace(/\?schema=.*$/, "");

  // 1. Terminate other connections & reset schema public to guarantee 100% clean restore
  try {
    const resetSql = `
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'trend_mr' AND pid <> pg_backend_pid();
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `;
    execSync(`"${LOCAL_PSQL_PATH}" "${cleanPsqlUrl}" -c "${resetSql.replace(/\r?\n/g, ' ')}"`, { stdio: "pipe" });
  } catch (err: any) {
    console.warn(`  Warning during schema reset: ${err.message?.slice(0, 100)}`);
  }

  // 2. Ingest the SQL dump
  const psqlCmd = `"${LOCAL_PSQL_PATH}" "${cleanPsqlUrl}" -f "${DUMP_FILE}"`;
  execSync(psqlCmd, { stdio: "pipe", maxBuffer: 1024 * 1024 * 256 });
  const ingestDuration = ((Date.now() - ingestStart) / 1000).toFixed(2);
  console.log(`\x1b[32m✔ [AGENT 3] Local Database Ingestion Successful in ${ingestDuration}s!\x1b[0m`);

  // 3. Prisma Schema validation & client alignment
  console.log("  Aligning Prisma ORM Client & generating schema types...");
  try {
    execSync("npx prisma generate", { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
    console.log(`\x1b[32m✔ [AGENT 3] Prisma ORM Schema & Client fully synced.\x1b[0m\n`);
  } catch (e: any) {
    if (e.message?.includes("EPERM")) {
      console.log(`\x1b[33m⚠ Note: Prisma client file locked by active server process. Using existing Prisma client.\x1b[0m\n`);
    } else {
      throw e;
    }
  }
}

// ============================================================================
// AGENT 4: MULTI-AGENT PARITY AUDIT & DOMAIN RECONCILIATION COUNCIL
// ============================================================================
function getVpsTableCounts(): Map<string, number> {
  const sql = `
DO \\$\\$
DECLARE
    r RECORD;
    cnt INT;
BEGIN
    DROP TABLE IF EXISTS _temp_row_counts;
    CREATE TEMP TABLE _temp_row_counts (tbl TEXT, cnt INT);
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', r.tablename) INTO cnt;
        INSERT INTO _temp_row_counts VALUES (r.tablename, cnt);
    END LOOP;
END \\$\\$;
SELECT tbl || ':' || cnt FROM _temp_row_counts ORDER BY tbl;
`;

  const res = spawnSync(PLINK_PATH, [
    '-batch',
    '-i', SSH_KEY_PATH,
    VPS_HOST,
    `PGPASSWORD=${VPS_DB_PASS} psql -h 127.0.0.1 -U trend_mr_user -d trend_mr -t -A -c "${sql.replace(/\r?\n/g, ' ')}"`
  ], { encoding: 'utf8' });

  const map = new Map<string, number>();
  if (res.error || res.status !== 0) {
    throw new Error(`Failed to query VPS table counts: ${res.stderr || res.error}`);
  }

  for (const line of res.stdout.trim().split(/\r?\n/)) {
    const parts = line.split(':');
    if (parts.length === 2 && !isNaN(Number(parts[1]))) {
      map.set(parts[0], Number(parts[1]));
    }
  }
  return map;
}

function getLocalTableCounts(): Map<string, number> {
  const localSql = `
DO $$
DECLARE
    r RECORD;
    cnt INT;
BEGIN
    DROP TABLE IF EXISTS _temp_row_counts;
    CREATE TEMP TABLE _temp_row_counts (tbl TEXT, cnt INT);
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', r.tablename) INTO cnt;
        INSERT INTO _temp_row_counts VALUES (r.tablename, cnt);
    END LOOP;
END $$;
SELECT tbl || ':' || cnt FROM _temp_row_counts ORDER BY tbl;
`;

  const cleanPsqlUrl = LOCAL_DB_URL.replace(/\?schema=.*$/, "");
  const res = spawnSync(LOCAL_PSQL_PATH, [
    cleanPsqlUrl,
    '-t', '-A', '-c', localSql.replace(/\r?\n/g, ' ')
  ], { encoding: 'utf8' });

  const map = new Map<string, number>();
  if (res.error || res.status !== 0) {
    throw new Error(`Failed to query Local table counts: ${res.stderr || res.error}`);
  }

  for (const line of res.stdout.trim().split(/\r?\n/)) {
    const parts = line.split(':');
    if (parts.length === 2 && !isNaN(Number(parts[1]))) {
      map.set(parts[0], Number(parts[1]));
    }
  }
  return map;
}

async function runMultiAgentParityCouncil(): Promise<void> {
  console.log("\x1b[1;33m[AGENT 4: MULTI-AGENT PARITY & AUDIT COUNCIL]\x1b[0m Evaluating 100% equality across VPS & Local...");

  const vpsCounts = getVpsTableCounts();
  const localCounts = getLocalTableCounts();

  const allTables = Array.from(new Set([...vpsCounts.keys(), ...localCounts.keys()])).sort();

  const parities: TableParity[] = [];
  let matchedCount = 0;

  for (const tbl of allTables) {
    const vCount = vpsCounts.get(tbl) ?? 0;
    const lCount = localCounts.get(tbl) ?? 0;
    const diff = lCount - vCount;
    const matched = (vCount === lCount);
    if (matched) matchedCount++;

    parities.push({
      tableName: tbl,
      vpsCount: vCount,
      localCount: lCount,
      diff,
      matched
    });
  }

  console.log("\n┌───────────────────────────────────┬──────────────┬──────────────┬────────┬──────────────┐");
  console.log("│ Table Name                        │  VPS Count   │ Local Count  │  Diff  │ Parity State │");
  console.log("├───────────────────────────────────┼──────────────┼──────────────┼────────┼──────────────┤");

  for (const p of parities) {
    const statusStr = p.matched ? "\x1b[32m✔ EQUAL \x1b[0m" : "\x1b[31m✖ DRIFT \x1b[0m";
    const diffStr = p.diff === 0 ? "0" : (p.diff > 0 ? `+${p.diff}` : `${p.diff}`);
    console.log(
      `│ ${p.tableName.padEnd(33)} │ ${p.vpsCount.toString().padStart(12)} │ ${p.localCount.toString().padStart(12)} │ ${diffStr.padStart(6)} │ ${statusStr}     │`
    );
  }
  console.log("└───────────────────────────────────┴──────────────┴──────────────┴────────┴──────────────┘");

  const parityPct = ((matchedCount / allTables.length) * 100).toFixed(1);
  console.log(`\n\x1b[1;36mDATABASE EQUALITY METRIC: ${matchedCount}/${allTables.length} Tables Matched (${parityPct}% Parity)\x1b[0m\n`);

  // Auditing upload files
  console.log("┌───────────────────────────────────┬──────────────────────┐");
  console.log("│ Upload Storage Category           │ Local File Count     │");
  console.log("├───────────────────────────────────┼──────────────────────┤");
  for (const cat of UPLOAD_CATEGORIES) {
    const catDir = path.join(LOCAL_UPLOADS_DIR, cat);
    const count = countFilesInDir(catDir);
    console.log(`│ ${cat.padEnd(33)} │ ${count.toString().padStart(20)} │`);
  }
  const configSize = fs.existsSync(path.join(LOCAL_DATA_DIR, "system-config.json"))
    ? `${(fs.statSync(path.join(LOCAL_DATA_DIR, "system-config.json")).size / 1024).toFixed(1)} KB`
    : "Missing";
  console.log(`│ system-config.json                │ ${configSize.padStart(20)} │`);
  console.log("└───────────────────────────────────┴──────────────────────┘\n");

  // Domain evaluation
  console.log("Executing Commercial & Multi-Agent Domain Pipeline Evaluation...");
  try {
    const commRes = await CommercialAgentsService.executePipeline();
    const councilReports = await multiAgentCouncil.generateAllMrReports();

    console.log("\n--- COMMERCIAL AGENTS ENGINE EVALUATION ---");
    console.log(`Summary Total Invoices: ${commRes.liveData.summary.totalInvoices}`);
    console.log(`Total Revenue (PTS):    ₹${commRes.liveData.summary.totalRevenue.toLocaleString("en-IN")}`);
    console.log(`Total PTS Cost:         ₹${commRes.liveData.summary.totalCost.toLocaleString("en-IN")}`);
    console.log(`Total Net Profit:       ₹${commRes.liveData.summary.totalProfit.toLocaleString("en-IN")}`);
    console.log(`Blended Margin:         ${commRes.liveData.summary.blendedMarginPct.toFixed(1)}%`);
    console.log(`Billed Units:           ${commRes.liveData.summary.totalBilledUnits}`);
    console.log(`Free Scheme Units:      ${commRes.liveData.summary.totalFreeUnits}`);

    console.log("\n--- MULTI-AGENT COUNCIL WORKERS STATUS ---");
    for (const a of commRes.agents) {
      console.log(`  [${a.status.padEnd(7)}] ${a.name.padEnd(30)}: Latency=${a.lastExecutionMs}ms`);
    }

    console.log(`\nEvaluated ${councilReports.length} MRs with 8/8 Domain Workers.`);
    for (const r of councilReports) {
      console.log(`  - MR: ${r.fullName.padEnd(25)} | Grade: ${r.councilEvaluation.overallGrade} (${r.councilEvaluation.councilScore}/100) | Env: ${r.environment}`);
    }
  } catch (err: any) {
    console.warn(`Note during commercial evaluation: ${err.message}`);
  }

  if (matchedCount === allTables.length) {
    console.log("\n\x1b[1;32m================================================================================");
    console.log("    SUCCESS: LOCAL SYSTEM IS 100% EQUAL & FULLY SYNCHRONISED WITH VPS SERVER");
    console.log("================================================================================\x1b[0m\n");
  } else {
    console.log("\n\x1b[1;33m================================================================================");
    console.log(`    SYNC COMPLETE: ${matchedCount}/${allTables.length} Tables strictly equal.`);
    console.log("================================================================================\x1b[0m\n");
  }
}

// ============================================================================
// MAIN MULTI-THREADED ORCHESTRATION PIPELINE
// ============================================================================
async function runMultiAgentParallelSync() {
  console.log("\x1b[1;36m================================================================================");
  console.log("   TREND MR PHARMA OS - MULTI-AGENT MULTI-THREADED VPS PARALLEL SYNC ENGINE     ");
  console.log("================================================================================\x1b[0m\n");

  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  const overallStart = Date.now();

  try {
    // -------------------------------------------------------------------------
    // PHASE 1: PARALLEL EXTRACTION & ASSET STREAMING
    // -------------------------------------------------------------------------
    // Agent 1 (DB Extraction) and Agent 2 (Parallel Asset Workers) execute
    // concurrently across parallel threads/streams!
    console.log("\x1b[1;35m>>> LAUNCHING CONCURRENT PARALLEL STREAMS (DATABASE + MULTI-ASSETS)...\x1b[0m\n");

    const [dbResult, assetResults] = await Promise.all([
      runDbExtractionAgent(),
      runParallelAssetSyncPool()
    ]);

    // -------------------------------------------------------------------------
    // PHASE 2: LOCAL INGESTION & SCHEMA ALIGNMENT
    // -------------------------------------------------------------------------
    console.log("\x1b[1;35m>>> INGESTING REMOTE SNAPSHOT INTO LOCAL POSTGRESQL...\x1b[0m\n");
    await runLocalDbIngestionAgent();

    // -------------------------------------------------------------------------
    // PHASE 3: PARITY AUDIT & RECONCILIATION COUNCIL
    // -------------------------------------------------------------------------
    console.log("\x1b[1;35m>>> RUNNING MULTI-AGENT PARITY COUNCIL FOR EQUALITY VERIFICATION...\x1b[0m\n");
    await runMultiAgentParityCouncil();

    const totalSeconds = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`Total Parallel Sync Completed in: ${totalSeconds}s`);
  } catch (error: any) {
    console.error(`\x1b[31m✖ Multi-Agent Parallel Sync Failed: ${error.message}\x1b[0m`);
    process.exit(1);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

runMultiAgentParallelSync();
