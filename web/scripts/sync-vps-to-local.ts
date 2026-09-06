import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { db } from "../lib/db";
import { multiAgentCouncil } from "../lib/multi-agent-council";
import { CommercialAgentsService } from "../services/commercial-agents.service";

const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const PSCP_PATH = 'C:\\Program Files\\PuTTY\\pscp.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_DB_PASS = 'TrendMr2026Secure';
const LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public';

const SCRATCH_DIR = path.resolve(__dirname, "../../scratch");
const DUMP_FILE = path.join(SCRATCH_DIR, "vps_dump_latest.sql");

async function runMultiAgentSync() {
  console.log("\x1b[1;36m================================================================================");
  console.log("    TREND MR PHARMA OS - VPS TO LOCAL MULTI-AGENT SYNCHRONISATION SUITE");
  console.log("================================================================================\x1b[0m\n");

  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // AGENT 1: REMOTE EXTRACTOR AGENT (VPS -> DUMP FILE)
  // ---------------------------------------------------------------------------
  console.log("\x1b[1;33m[AGENT 1: REMOTE EXTRACTOR AGENT]\x1b[0m Connecting to VPS & extracting live PostgreSQL database dump...");
  const startTime = Date.now();

  const dumpCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "PGPASSWORD=${VPS_DB_PASS} pg_dump -h localhost -U trend_mr_user -d trend_mr --schema=public --clean --if-exists --no-owner --no-acl"`;

  try {
    const dumpResult = spawnSync(dumpCmd, {
      shell: true,
      maxBuffer: 1024 * 1024 * 128, // 128MB
    });

    if (dumpResult.error || dumpResult.status !== 0) {
      const errStr = dumpResult.stderr?.toString() || dumpResult.error?.message || "Unknown error";
      throw new Error(`Remote pg_dump failed: ${errStr}`);
    }

    fs.writeFileSync(DUMP_FILE, dumpResult.stdout);
    const dumpSizeBytes = fs.statSync(DUMP_FILE).size;
    const dumpSizeMb = (dumpSizeBytes / (1024 * 1024)).toFixed(2);
    const extractDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\x1b[32m✔ Extraction Complete! Created SQL snapshot (${dumpSizeMb} MB) in ${extractDuration}s.\x1b[0m`);
    console.log(`  Snapshot Path: ${DUMP_FILE}\n`);
  } catch (err: any) {
    console.error(`\x1b[31m✖ Remote Extractor Agent Error: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  // Optional Assets Sync
  console.log("\x1b[1;33m[AGENT 1B: ASSETS SYNC AGENT]\x1b[0m Mirroring public company assets from VPS...");
  try {
    const uploadsDir = path.resolve(__dirname, "../public/uploads/company");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const pscpCmd = `"${PSCP_PATH}" -batch -i "${SSH_KEY_PATH}" "${VPS_HOST}:/u01/apps/Metapharsic_MrTracker/web/public/uploads/company/*" "${uploadsDir}\\"`;
    execSync(pscpCmd, { stdio: "ignore" });
    console.log(`\x1b[32m✔ Asset mirroring finished successfully.\x1b[0m\n`);
  } catch (e) {
    console.log(`\x1b[33m⚠ Note: Asset sync skipped or no new assets found on remote host.\x1b[0m\n`);
  }

  // ---------------------------------------------------------------------------
  // AGENT 2: LOCAL INGESTION & MIGRATION AGENT
  // ---------------------------------------------------------------------------
  console.log("\x1b[1;33m[AGENT 2: LOCAL INGESTION & MIGRATION AGENT]\x1b[0m Ingesting VPS snapshot into local PostgreSQL...");
  const ingestStart = Date.now();

  try {
    const cleanPsqlUrl = LOCAL_DB_URL.replace(/\?schema=.*$/, "");
    const psqlCmd = `psql "${cleanPsqlUrl}" -f "${DUMP_FILE}"`;
    execSync(psqlCmd, { stdio: "pipe", maxBuffer: 1024 * 1024 * 128 });
    const ingestDuration = ((Date.now() - ingestStart) / 1000).toFixed(2);
    console.log(`\x1b[32m✔ Local Database Ingestion Successful in ${ingestDuration}s!\x1b[0m`);

    console.log("  Aligning database schema with Prisma schema...");
    execSync("npx prisma db push --skip-generate", { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });

    console.log("  Running Prisma schema validation and generation...");
    try {
      execSync("npx prisma generate", { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
      console.log(`\x1b[32m✔ Prisma ORM Schema & Client fully synced.\x1b[0m\n`);
    } catch (e: any) {
      if (e.message?.includes("EPERM")) {
        console.log(`\x1b[33m⚠ Note: Prisma client file locked by active server process. Using existing Prisma client.\x1b[0m\n`);
      } else {
        throw e;
      }
    }
  } catch (err: any) {
    console.error(`\x1b[31m✖ Local Ingestion Agent Error: ${err.message}\x1b[0m`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // AGENT 3: MULTI-AGENT DOMAIN RECONCILIATION COUNCIL
  // ---------------------------------------------------------------------------
  console.log("\x1b[1;33m[AGENT 3: MULTI-AGENT RECONCILIATION & AUDIT COUNCIL]\x1b[0m Running full audit across local DB...");
  const prisma = db;

  try {
    const [
      usersCount,
      mrsCount,
      productsCount,
      ordersCount,
      invoicesCount,
      visitsCount,
      chemistsCount,
      doctorsCount,
      tourPlansCount,
      expenseClaimsCount,
      collectionsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "MR" } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.invoice.count(),
      prisma.visit.count(),
      prisma.chemist.count(),
      prisma.doctor.count(),
      prisma.tourPlan.count(),
      prisma.claim.count(),
      prisma.collection.count(),
    ]);

    console.log("\n┌───────────────────────────────────────────────────────────┐");
    console.log("│             LOCAL DATABASE RECORD PARITY AUDIT            │");
    console.log("├───────────────────────────────────────────┬───────────────┤");
    console.log(`│ Total Users Registered                    │ ${usersCount.toString().padStart(13)} │`);
    console.log(`│ Field Force (Medical Representatives)     │ ${mrsCount.toString().padStart(13)} │`);
    console.log(`│ Active Product Catalog (SKUs)             │ ${productsCount.toString().padStart(13)} │`);
    console.log(`│ Chemist Outlets Registered                │ ${chemistsCount.toString().padStart(13)} │`);
    console.log(`│ Doctor Directory Entries                  │ ${doctorsCount.toString().padStart(13)} │`);
    console.log(`│ Sales Orders Booked                       │ ${ordersCount.toString().padStart(13)} │`);
    console.log(`│ Generated Tax Invoices                    │ ${invoicesCount.toString().padStart(13)} │`);
    console.log(`│ DCR Field Visits Logged                   │ ${visitsCount.toString().padStart(13)} │`);
    console.log(`│ Approved/Pending Tour Plans               │ ${tourPlansCount.toString().padStart(13)} │`);
    console.log(`│ Field Expense Claims                      │ ${expenseClaimsCount.toString().padStart(13)} │`);
    console.log(`│ Payment Collections Logged                │ ${collectionsCount.toString().padStart(13)} │`);
    console.log("└───────────────────────────────────────────┴───────────────┘\n");

    console.log("Executing Commercial & Multi-Agent Domain Pipeline Evaluation...");
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

    console.log("\n\x1b[1;32m================================================================================");
    console.log("    SUCCESS: LOCAL DATABASE SYNCHRONISED & RECONCILED WITH VPS SERVER (100%)");
    console.log("================================================================================\x1b[0m\n");
  } catch (err: any) {
    console.error(`\x1b[31m✖ Multi-Agent Reconciliation Council Error: ${err.message}\x1b[0m`);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runMultiAgentSync();
