import { multiAgentCouncil, GranularMrReport, AgentExecutionResult } from "../lib/multi-agent-council";
import { db } from "../lib/db";
import * as fs from "fs";
import * as path from "path";

function formatCurrency(num: number): string {
  return "₹" + Math.round(num).toLocaleString("en-IN");
}

function printStatusBadge(status: string): string {
  switch (status) {
    case "ONLINE_PASS":
      return "\x1b[32m[ ONLINE - PASS ]\x1b[0m";
    case "ONLINE_WARNING":
      return "\x1b[33m[ ONLINE - WARNING ]\x1b[0m";
    case "ONLINE_ALERT":
      return "\x1b[31m[ ONLINE - ALERT ]\x1b[0m";
    default:
      return `\x1b[36m[ ${status} ]\x1b[0m`;
  }
}

function printGradeBadge(grade: string): string {
  switch (grade) {
    case "A+":
    case "A":
      return `\x1b[1;32m${grade}\x1b[0m`;
    case "B":
      return `\x1b[1;34m${grade}\x1b[0m`;
    case "C":
      return `\x1b[1;33m${grade}\x1b[0m`;
    default:
      return `\x1b[1;31m${grade}\x1b[0m`;
  }
}

async function run() {
  console.log("\x1b[1;36m================================================================================");
  console.log("       TREND MR PHARMA OS - MULTI-AGENT COUNCIL REPORT GENERATOR");
  console.log("             (Cross-Platform Runner: Local & VPS Production)");
  console.log("================================================================================\x1b[0m\n");

  const startTime = Date.now();
  console.log("Initializing Multi-Agent Council Domain Workers...\n");

  const reports = await multiAgentCouncil.generateAllMrReports();

  console.log(`\x1b[32mSuccessfully evaluated ${reports.length} Medical Representatives (MRs) with 8/8 Domain Agents.\x1b[0m\n`);

  for (const report of reports) {
    console.log("\x1b[1;35m" + "─".repeat(80));
    console.log(` MR: ${report.fullName.toUpperCase()} | Email: ${report.email} | Phone: ${report.phone}`);
    console.log(` Territories: ${report.territories.map((t) => t.name).join(", ") || "None"} | Role: ${report.role}`);
    console.log(` Council Grade: ${printGradeBadge(report.councilEvaluation.overallGrade)} (Score: ${report.councilEvaluation.councilScore}/100) | Env: ${report.environment}`);
    console.log("─".repeat(80) + "\x1b[0m");

    console.log("\n\x1b[1;33m>>> MULTI-AGENT COUNCIL STATUS & DOMAIN AUDIT:\x1b[0m");
    console.log("┌──────────────────────────────┬────────────────────────────┬────────┬──────────┬───────────┐");
    console.log("│ Agent Code                   │ Domain Scope               │ Status │ Score    │ Latency   │");
    console.log("├──────────────────────────────┼────────────────────────────┼────────┼──────────┼───────────┤");

    for (const agent of report.councilEvaluation.agentStatuses) {
      const codePadded = agent.agentCode.padEnd(28, " ");
      const domainPadded = (agent.domain.length > 26 ? agent.domain.slice(0, 23) + "..." : agent.domain).padEnd(26, " ");
      const statusStr = agent.status === "ONLINE_PASS" ? "PASS" : agent.status === "ONLINE_WARNING" ? "WARN" : "ALERT";
      const scoreStr = `${agent.score}/100`.padEnd(8, " ");
      const latStr = `${agent.executionTimeMs}ms`.padEnd(9, " ");
      console.log(`│ ${codePadded} │ ${domainPadded} │ ${statusStr.padEnd(6, " ")} │ ${scoreStr} │ ${latStr} │`);
    }
    console.log("└──────────────────────────────┴────────────────────────────┴────────┴──────────┴───────────┘");

    // Print Granular Metrics
    console.log("\n\x1b[1;34m>>> GRANULAR METRICS BREAKDOWN:\x1b[0m");
    console.log(` • DCR Calls: ${report.dcrSummary.totalVisits} visits (${report.dcrSummary.doctorVisits} Doctors, ${report.dcrSummary.chemistVisits} Chemists, ${report.dcrSummary.hospitalVisits} Hospitals)`);
    console.log(`   - Avg Call Duration: ${report.dcrSummary.avgDurationMinutes} mins | Avg CQS Score: ${report.dcrSummary.avgCqsScore ?? "N/A"}/10.0 | Boxes Placed: ${report.dcrSummary.totalBoxesPlaced}`);
    console.log(` • Commercial Orders: ${report.commercialSummary.totalOrdersCount} booked (${report.commercialSummary.deliveredOrdersCount} Delivered, ${report.commercialSummary.pendingOrdersCount} Pending)`);
    console.log(`   - Total Revenue (PTR): ${formatCurrency(report.commercialSummary.totalRevenuePtr)} | PTS Value: ${formatCurrency(report.commercialSummary.totalRevenuePts)} | Volume: ${report.commercialSummary.totalUnitsBooked} units`);
    console.log(`   - Collections: ${formatCurrency(report.commercialSummary.collections.totalCollected)}`);
    console.log(` • Tour & Routing: ${report.routingSummary.tourPlansCount} Tour Plans | Geofence Adherence: ${report.routingSummary.geofenceCompliancePercent}% | Mock GPS Flags: ${report.routingSummary.gpsMockFlagsCount}`);
    console.log(` • Expenses & HRMS: ${formatCurrency(report.expenseHrmsSummary.totalExpensesApproved)} Approved Claims | Attendance Days: ${report.expenseHrmsSummary.attendanceDaysLogged} | ROI: ${report.expenseHrmsSummary.expenseToSalesRoiPercent}% of sales`);
    console.log(` • Financial P&L: Gross Profit: ${formatCurrency(report.financeSummary.grossProfit)} - Expenses: ${formatCurrency(report.financeSummary.fieldExpenses)} = Net Contribution: ${formatCurrency(report.financeSummary.netTerritoryContribution)} (Margin: ${report.financeSummary.netMarginPercent}%)`);

    // Top SKUs
    if (report.commercialSummary.skuBreakdown.length > 0) {
      console.log("\n   Top Product SKUs Sold by MR:");
      for (const sku of report.commercialSummary.skuBreakdown.slice(0, 5)) {
        console.log(`    - [${sku.sku}] ${sku.productName}: ${sku.units} units | Revenue: ${formatCurrency(sku.revenuePtr)} | Gross Profit: ${formatCurrency(sku.grossMargin)}`);
      }
    }

    // Granular DCR Logs Sample
    if (report.dcrSummary.visits.length > 0) {
      console.log("\n   Recent Granular DCR Calls:");
      for (const v of report.dcrSummary.visits.slice(0, 5)) {
        console.log(`    - ${v.timestamp.slice(0, 10)} | ${v.targetType.padEnd(8)} | ${v.targetName} | Purpose: ${v.purpose} | CQS: ${v.cqsScore ?? "-"} | Dur: ${v.durationMinutes ?? "-"}m`);
      }
      if (report.dcrSummary.visits.length > 5) {
        console.log(`      ... and ${report.dcrSummary.visits.length - 5} more detailed visit records.`);
      }
    }

    // Agent Findings & Risk factors
    if (report.councilEvaluation.keyRiskFactors.length > 0) {
      console.log("\n   \x1b[33mCouncil Warning Flags:\x1b[0m");
      for (const w of report.councilEvaluation.keyRiskFactors) {
        console.log(`    ! ${w}`);
      }
    }

    if (report.councilEvaluation.actionItems.length > 0) {
      console.log("\n   \x1b[32mCouncil Recommended Action Items:\x1b[0m");
      for (const a of report.councilEvaluation.actionItems) {
        console.log(`    ✓ ${a}`);
      }
    }
    console.log("\n");
  }

  // Export reports to file
  const outDir = path.resolve(__dirname, "../reports-output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, "mr-multiagent-reports.json");
  fs.writeFileSync(jsonPath, JSON.stringify(reports, null, 2));

  // Generate complete Markdown artifact
  const mdPath = path.join(outDir, "mr-multiagent-detailed-report.md");
  let mdContent = `# Trend MR Pharma OS — Multi-Agent Granular MR Audit & Performance Report\n\n`;
  mdContent += `**Generated**: ${new Date().toISOString()} | **Total MRs Audited**: ${reports.length}\n\n`;
  mdContent += `## Multi-Agent Council Summary\n\n`;
  mdContent += `All 8 Domain Council Agents were executed against each MR to verify full operational, commercial, routing, financial, and data integrity metrics.\n\n`;

  for (const rep of reports) {
    mdContent += `### MR: ${rep.fullName} (${rep.email})\n\n`;
    mdContent += `- **Territories**: ${rep.territories.map((t) => t.name).join(", ") || "None"}\n`;
    mdContent += `- **Council Grade**: **${rep.councilEvaluation.overallGrade}** (Score: ${rep.councilEvaluation.councilScore}/100)\n`;
    mdContent += `- **Executive Summary**: ${rep.councilEvaluation.executiveSummary}\n\n`;

    mdContent += `#### Multi-Agent Domain Status Matrix\n\n`;
    mdContent += `| Agent Code | Domain | Status | Score | Findings Count | Latency |\n`;
    mdContent += `|:---|:---|:---:|:---:|:---:|:---:|\n`;
    for (const a of rep.councilEvaluation.agentStatuses) {
      mdContent += `| \`${a.agentCode}\` | ${a.domain} | **${a.status}** | ${a.score}/100 | ${a.findings.length} findings | ${a.executionTimeMs}ms |\n`;
    }
    mdContent += `\n`;

    mdContent += `#### Granular Commercial & Sales Performance\n\n`;
    mdContent += `- **Total Orders**: ${rep.commercialSummary.totalOrdersCount} (${rep.commercialSummary.deliveredOrdersCount} Delivered, ${rep.commercialSummary.pendingOrdersCount} Pending)\n`;
    mdContent += `- **Total Revenue (PTR)**: ₹${Math.round(rep.commercialSummary.totalRevenuePtr).toLocaleString("en-IN")}\n`;
    mdContent += `- **PTS Cost of Goods**: ₹${Math.round(rep.commercialSummary.totalRevenuePts).toLocaleString("en-IN")}\n`;
    mdContent += `- **Gross Profit Margin**: ₹${Math.round(rep.financeSummary.grossProfit).toLocaleString("en-IN")}\n`;
    mdContent += `- **Field Expenses Deducted**: ₹${Math.round(rep.financeSummary.fieldExpenses).toLocaleString("en-IN")}\n`;
    mdContent += `- **Net Territory Contribution**: **₹${Math.round(rep.financeSummary.netTerritoryContribution).toLocaleString("en-IN")}** (${rep.financeSummary.netMarginPercent}%)\n\n`;

    if (rep.commercialSummary.skuBreakdown.length > 0) {
      mdContent += `##### SKU-Level Sales Breakdown\n\n`;
      mdContent += `| SKU | Product Name | Units Booked | PTR Revenue | PTS Cost | Gross Profit |\n`;
      mdContent += `|:---|:---|:---:|:---:|:---:|:---:|\n`;
      for (const s of rep.commercialSummary.skuBreakdown) {
        mdContent += `| \`${s.sku}\` | ${s.productName} | ${s.units} | ₹${Math.round(s.revenuePtr).toLocaleString("en-IN")} | ₹${Math.round(s.revenuePts).toLocaleString("en-IN")} | ₹${Math.round(s.grossMargin).toLocaleString("en-IN")} |\n`;
      }
      mdContent += `\n`;
    }

    mdContent += `#### Granular Field DCR & Call Log Summary\n\n`;
    mdContent += `- **Total Calls**: ${rep.dcrSummary.totalVisits} (Doctors: ${rep.dcrSummary.doctorVisits}, Chemists: ${rep.dcrSummary.chemistVisits}, Hospitals: ${rep.dcrSummary.hospitalVisits})\n`;
    mdContent += `- **Avg Duration**: ${rep.dcrSummary.avgDurationMinutes} mins | **Avg CQS**: ${rep.dcrSummary.avgCqsScore ?? "N/A"}/10.0 | **Boxes Placed**: ${rep.dcrSummary.totalBoxesPlaced}\n\n`;

    if (rep.dcrSummary.visits.length > 0) {
      mdContent += `##### Granular Call Logs\n\n`;
      mdContent += `| Date | Target Type | Entity Name | Purpose | Duration | CQS Score | Boxes |\n`;
      mdContent += `|:---|:---:|:---|:---|:---:|:---:|:---:|\n`;
      for (const v of rep.dcrSummary.visits) {
        mdContent += `| ${v.timestamp.slice(0, 10)} | ${v.targetType} | ${v.targetName} | ${v.purpose} | ${v.durationMinutes ?? "-"}m | ${v.cqsScore ?? "-"} | ${v.boxesPlaced ?? "-"} |\n`;
      }
      mdContent += `\n`;
    }

    if (rep.councilEvaluation.keyRiskFactors.length > 0) {
      mdContent += `#### Council Risk Warnings\n\n`;
      for (const w of rep.councilEvaluation.keyRiskFactors) {
        mdContent += `- ⚠️ ${w}\n`;
      }
      mdContent += `\n`;
    }

    if (rep.councilEvaluation.actionItems.length > 0) {
      mdContent += `#### Recommended Action Items\n\n`;
      for (const a of rep.councilEvaluation.actionItems) {
        mdContent += `- ✅ ${a}\n`;
      }
      mdContent += `\n`;
    }

    mdContent += `---\n\n`;
  }

  fs.writeFileSync(mdPath, mdContent);

  console.log(`\x1b[32m[✓] Granular JSON saved to:\x1b[0m ${jsonPath}`);
  console.log(`\x1b[32m[✓] Granular Markdown report saved to:\x1b[0m ${mdPath}`);
  console.log(`\x1b[1;36mTotal execution time: ${Date.now() - startTime}ms\x1b[0m\n`);
}

run()
  .catch((err) => {
    console.error("Multi-Agent Council execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
