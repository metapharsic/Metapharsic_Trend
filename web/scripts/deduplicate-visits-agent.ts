import { VisitDeduplicationAgentsService } from "../services/visit-deduplication-agents.service";
import { db } from "../lib/db";

async function runDeduplicationAgentSuite() {
  console.log("\x1b[1;36m================================================================================");
  console.log("   TREND MR PHARMA OS - MULTI-AGENT CALL DEDUPLICATION & INTEGRITY SUITE");
  console.log("================================================================================\x1b[0m\n");

  console.log("\x1b[1;33m[AGENT 1: VISIT DUPLICATION AUDIT AGENT]\x1b[0m Scanning visit ledger for duplicate entries...");
  const audit = await VisitDeduplicationAgentsService.auditDuplicates();

  console.log(`  Scanned ${audit.totalVisitsScanned} total field visits in database.`);
  console.log(`  Identified ${audit.clustersFound} duplicate clusters containing ${audit.totalDuplicateRecords} redundant duplicate records.\n`);

  if (audit.clusters.length > 0) {
    console.log("┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
    console.log("│                                   DUPLICATE CALLS AUDIT BREAKDOWN MATRIX                                        │");
    console.log("├────────────┬─────────────────────────────┬──────────────┬────────────────────────────────┬───────┬──────────────┤");
    console.log("│ Date       │ MR (Field Representative)   │ Target Type  │ Target Name                    │ Total │ Redundant    │");
    console.log("├────────────┼─────────────────────────────┼──────────────┼────────────────────────────────┼───────┼──────────────┤");

    for (const c of audit.clusters) {
      const dateCol = c.date.padEnd(10);
      const mrCol = c.employeeName.slice(0, 27).padEnd(27);
      const typeCol = c.targetType.padEnd(12);
      const nameCol = c.targetName.slice(0, 30).padEnd(30);
      const totalCol = c.totalCount.toString().padStart(5);
      const dupeCol = c.duplicateVisitIds.length.toString().padStart(12);
      console.log(`│ ${dateCol} │ ${mrCol} │ ${typeCol} │ ${nameCol} │ ${totalCol} │ ${dupeCol} │`);
    }
    console.log("└────────────┴─────────────────────────────┴──────────────┴────────────────────────────────┴───────┴──────────────┘\n");

    console.log("\x1b[1;33m[AGENT 2: VISIT DEDUPLICATION RECONCILIATION AGENT]\x1b[0m Reconciling ledger & purging redundant copies...");
    const purgeRes = await VisitDeduplicationAgentsService.reconcileAndPurgeDuplicates();

    console.log(`\x1b[32m✔ Reconciliation Agent Complete!\x1b[0m`);
    console.log(`  - Purged Redundant Duplicate Records: ${purgeRes.purgedCount}`);
    console.log(`  - Preserved Master Original Records:  ${purgeRes.preservedOriginalsCount}`);
    console.log(`  - Processing Duration:               ${purgeRes.durationMs}ms\n`);
  } else {
    console.log("\x1b[32m✔ Ledger is completely clean! No duplicate visits detected.\x1b[0m\n");
  }

  const finalCount = await db.visit.count();
  console.log(`\x1b[1;32m================================================================================`);
  console.log(`   SUCCESS: CALL DEDUPLICATION COMPLETED. CURRENT CLEAN VISITS IN LEDGER: ${finalCount}`);
  console.log(`================================================================================\x1b[0m\n`);

  await db.$disconnect();
  process.exit(0);
}

runDeduplicationAgentSuite().catch(async (e) => {
  console.error("\x1b[31m✖ Deduplication Agent Suite Error:\x1b[0m", e);
  await db.$disconnect();
  process.exit(1);
});
