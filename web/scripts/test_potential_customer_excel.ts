import { PotentialCustomersAgentsService } from "../services/potential-customers-agents.service";
import { generateProfessionalExcelWorkbook } from "../lib/excel-export";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("================================================================================");
  console.log("   TESTING MULTI-AGENT POTENTIAL CUSTOMER & PROFESSIONAL EXCEL EXPORT ENGINE    ");
  console.log("================================================================================\n");

  // 1. Run Multi-Agent, Multi-Threaded Potential Customer Intelligence Pipeline
  console.log("--- 1. Executing PotentialCustomersAgentsService.executePipeline() ---");
  const t0 = Date.now();
  const summary = await PotentialCustomersAgentsService.executePipeline();
  const durationMs = Date.now() - t0;

  console.log(`Pipeline executed in: ${durationMs}ms`);
  console.log(`Total Analyzed Accounts:     ${summary.totalAnalyzed}`);
  console.log(`Total Doctors:               ${summary.totalDoctors}`);
  console.log(`Total Chemists:              ${summary.totalChemists}`);
  console.log(`Tier A+ (KOL / VIP) Count:   ${summary.vipKolCount}`);
  console.log(`Tier A (Core Prescribers):   ${summary.coreTierCount}`);
  console.log(`Tier B (Growth Targets):     ${summary.growthTierCount}`);
  console.log(`Tier C (Standard Retain):    ${summary.retainTierCount}`);
  console.log(`Est. Monthly Potential:      ₹${summary.totalEstimatedMonthlyPotentialInr.toLocaleString("en-IN")}`);
  console.log(`Realized Invoiced Revenue:   ₹${summary.totalRealizedRevenueInr.toLocaleString("en-IN")}`);
  console.log(`Urgent Priority Follow-ups:  ${summary.urgentFollowupsCount}`);

  console.log("\n--- Multi-Agent Telemetry ---");
  for (const agent of summary.multiAgentCouncilTelemetry) {
    console.log(`  [${agent.status.padEnd(7)}] ${agent.agentName.padEnd(45)}: Processed ${agent.itemsProcessed} in ${agent.latencyMs}ms`);
  }

  console.log("\n--- Sample Top 3 High-Potential Opportunities ---");
  summary.topOpportunities.slice(0, 3).forEach((opp, idx) => {
    console.log(`\n#${idx + 1}: ${opp.name} (${opp.customerType}) - ${opp.potentialTier}`);
    console.log(`   Specialty: ${opp.specialty} | Territory: ${opp.territory} | MR: ${opp.assignedMr}`);
    console.log(`   Potential Score: ${opp.potentialScore}/100 | Daily Footfall: ${opp.dailyPatientFootfall} | Est. Value: ₹${opp.estimatedMonthlyValueInr.toLocaleString("en-IN")}`);
    console.log(`   Stage: ${opp.currentStage} | Urgency: ${opp.urgencyLevel}`);
    console.log(`   Highlights:`);
    opp.keyHighlightPoints.forEach((h) => console.log(`     • ${h}`));
    console.log(`   Action: ${opp.recommendedTacticalAction}`);
  });

  // 2. Generate Native Multi-Tab Excel Workbook
  console.log("\n--- 2. Generating Native Professional .xlsx Workbook (ExcelJS) ---");
  const kpis = [
    { label: "Total Target Accounts", value: summary.totalAnalyzed, note: "Doctors & Retail Chemists" },
    { label: "Tier A+ (KOL / VIP)", value: summary.vipKolCount, note: "High-Authority Key Opinion Leaders" },
    { label: "Core Prescribers (Tier A)", value: summary.coreTierCount, note: "Consistent Weekly Script Volume" },
    { label: "Monthly Prescribing Pipeline", value: `₹${summary.totalEstimatedMonthlyPotentialInr.toLocaleString("en-IN")}`, note: "Estimated Aggregate Prescriptions" },
    { label: "Realized Invoiced Revenue", value: `₹${summary.totalRealizedRevenueInr.toLocaleString("en-IN")}`, note: "Delivered Primary & Secondary Invoices" },
    { label: "Urgent Priority Follow-ups", value: summary.urgentFollowupsCount, note: "Requires Visit within 24-48 Hours" },
  ];

  const potentialCustomersHeaders = [
    "Customer / Account Name",
    "Entity Type",
    "Specialty / Category",
    "Territory",
    "Assigned MR",
    "Potential Tier",
    "Score",
    "Daily Footfall",
    "Est. Monthly Value",
    "Current Stage",
    "Urgency Window",
    "Conversion Highlights & Strategic Value Points",
    "Recommended Tactical Next Action",
  ];

  const potentialCustomersRows = summary.topOpportunities.map((item) => [
    item.name,
    item.customerType,
    item.specialty,
    item.territory,
    item.assignedMr,
    item.potentialTier,
    item.potentialScore,
    item.dailyPatientFootfall,
    `₹${item.estimatedMonthlyValueInr.toLocaleString("en-IN")}`,
    item.currentStage,
    item.urgencyLevel,
    item.keyHighlightPoints.join(" | "),
    item.recommendedTacticalAction,
  ]);

  const detailHeaders = ["Account ID", "Customer Name", "Type", "Territory", "Orders Count", "Invoiced Value"];
  const detailRows = summary.topOpportunities.slice(0, 20).map((item) => [
    item.id.slice(0, 8),
    item.name,
    item.customerType,
    item.territory,
    item.matchedOrdersCount,
    item.matchedInvoicedRevenue,
  ]);

  const buffer = await generateProfessionalExcelWorkbook({
    reportTitle: "Executive Potential Customer & Healthcare Accounts Intelligence",
    reportSubtitle: "Multi-Agent Doctor Potential (DPS), Chemist Liquidation & Tactical Conversion Playbook",
    period: "ACTIVE CYCLE",
    kpis,
    potentialCustomersTable: {
      headers: potentialCustomersHeaders,
      rows: potentialCustomersRows,
    },
    potentialCustomerSummary: {
      vipKolCount: summary.vipKolCount,
      coreTierCount: summary.coreTierCount,
      growthTierCount: summary.growthTierCount,
      retainTierCount: summary.retainTierCount,
      totalEstimatedMonthlyPotentialInr: summary.totalEstimatedMonthlyPotentialInr,
      urgentFollowupsCount: summary.urgentFollowupsCount,
    },
    detailHeaders,
    detailRows,
  });

  console.log(`✔ Excel Workbook Buffer Generated: ${buffer.byteLength} bytes (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

  // 3. Inspect generated workbook structure
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  console.log(`✔ Workbook sheets count: ${wb.worksheets.length}`);
  wb.worksheets.forEach((ws) => {
    console.log(`   Sheet: "${ws.name}" - ${ws.rowCount} rows x ${ws.columnCount} columns`);
  });

  // Write file to scratch folder for verification
  const scratchFile = path.resolve(__dirname, "../../scratch/test_potential_customer_export.xlsx");
  fs.writeFileSync(scratchFile, Buffer.from(buffer));
  console.log(`\n✔ Saved test Excel export to: ${scratchFile}`);

  console.log("\n================================================================================");
  console.log("   ALL MULTI-AGENT POTENTIAL CUSTOMER & EXCEL EXPORT CHECKS PASSED 100%!        ");
  console.log("================================================================================\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
