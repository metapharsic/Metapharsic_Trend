import fs from "fs";
import path from "path";
import { ItemHistoryAgentsService } from "../services/item-history-agents.service";

async function main() {
  console.log("================================================================================");
  console.log("   SUPPLY CHAIN ITEM HISTORY & TRANSACTION AUDIT REPORT (MULTI-AGENT MODEL)    ");
  console.log("================================================================================\n");

  const report = await ItemHistoryAgentsService.generateItemAuditReport();
  const { product, summaryStats, chronologicalLedger, multiAgentCouncil } = report;

  console.log(`?? ITEM PROFILE: ${product.name} [SKU: ${product.sku}]`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`  Composition:         ${product.composition || "N/A"} | Pack Size: ${product.packSize || "N/A"}`);
  console.log(`  HSN Code:            ${product.hsnCode || "3004.90.99"}`);
  console.log(`  Price Hierarchy:     MRP ?${product.mrp} | PTR ?${product.ptr} | PTS ?${product.pts} | Purchase Rate ?${product.purchaseRate}`);
  console.log(`  Current Warehouse:   ${product.currentStockQty} units (Batch: ${product.currentBatchNo || "N/A"})`);
  console.log(`  Reorder Status:      [${product.reorderStatus}] (Threshold: ${product.reorderLevel} units)\n`);

  console.log("?? MULTI-AGENT COUNCIL STATUS BOARD:");
  console.log("+------------------------------------------------------------------------------------------------+");
  console.log("¦ Agent Code                ¦ Agent Name / Domain Scope         ¦ Status       ¦ Score ¦ Latency ¦");
  console.log("+---------------------------+-----------------------------------+--------------+-------+---------¦");
  for (const a of multiAgentCouncil.agents) {
    const codeStr = a.agentCode.padEnd(25);
    const nameStr = a.agentName.padEnd(33);
    const statusStr = a.status.padEnd(12);
    const scoreStr = `${a.score}/100`.padEnd(5);
    const latStr = `${a.latencyMs}ms`.padStart(7);
    console.log(`¦ ${codeStr} ¦ ${nameStr} ¦ ${statusStr} ¦ ${scoreStr} ¦ ${latStr} ¦`);
  }
  console.log("+------------------------------------------------------------------------------------------------+");
  console.log(`  Council Overall Grade: ${multiAgentCouncil.overallStatus} (Score: ${multiAgentCouncil.overallScore}/100)\n`);

  console.log("?? TRANSACTION FREQUENCY & LIFECYCLE SUMMARY:");
  console.log("--------------------------------------------------------------------------------");
  console.log(`  ?? TOTAL TRANSACTION FREQUENCY:  ${summaryStats.totalTransactionsCount} times transactions executed on item`);
  console.log(`  • Purchase Requisitions (PR):   ${summaryStats.prCount} raised`);
  console.log(`  • Purchase Orders (PO):         ${summaryStats.poCount} issued`);
  console.log(`  • Goods Receipt Notes (GRN):    ${summaryStats.grnCount} received`);
  console.log(`  • Warehouse Stock Inward:       ${summaryStats.inwardTransactionsCount} restock batches (${summaryStats.cumulativeInwardQty} units)`);
  console.log(`  • Outward Dispatches & DC:      ${summaryStats.outwardTransactionsCount} dispatches (${summaryStats.cumulativeOutwardQty} units)`);
  console.log(`  • Delivery Challan (DC) Issued: ${summaryStats.deliveryChallanCount} challans/invoices`);
  console.log(`  • Sample Allocations (MR):      ${summaryStats.sampleAllocationCount} rep assignments`);
  console.log(`  • Stock Adjustments:            ${summaryStats.adjustmentCount} ledger edits`);
  console.log(`  • Total Billed Revenue:         ?${summaryStats.totalSalesValue.toLocaleString()}`);
  console.log(`  • Total Procurement Cost:       ?${summaryStats.totalProcurementCost.toLocaleString()}`);
  console.log(`  • Cumulative Gross Margin:      ?${summaryStats.grossProfit.toLocaleString()}`);
  console.log(`  • Inventory Turnover Rate:      ${summaryStats.inventoryTurnoverRate}x\n`);

  console.log("?? CHRONOLOGICAL ITEM AUDIT LEDGER (LIFECYCLE TIMELINE):");
  console.log("--------------------------------------------------------------------------------");
  console.log("Date / Time           | Stage        | Event Type      | Ref No        | Batch       | Delta | Balance | Performed By            | Notes / Details");
  console.log("----------------------+--------------+-----------------+---------------+-------------+-------+---------+-------------------------+------------------------------------------");
  
  for (const e of chronologicalLedger) {
    const dt = e.timestamp.slice(0, 19).replace("T", " ");
    const stage = e.stage.padEnd(12);
    const type = e.eventType.padEnd(15);
    const ref = e.referenceNo.padEnd(13);
    const batch = (e.batchNo || "N/A").padEnd(11);
    const delta = (e.deltaQty > 0 ? `+${e.deltaQty}` : `${e.deltaQty}`).padStart(5);
    const bal = `${e.balanceAfter}`.padStart(7);
    const user = e.performedBy.padEnd(23);
    const notes = e.notes;
    console.log(`${dt} | ${stage} | ${type} | ${ref} | ${batch} | ${delta} | ${bal} | ${user} | ${notes}`);
  }
  console.log("--------------------------------------------------------------------------------\n");

  // Save reports
  const outDir = path.join(process.cwd(), "reports-output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, "item-supply-chain-history-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const mdLines = [
    `# Supply Chain Item History & Multi-Agent Audit Report`,
    ``,
    `**Product**: ${product.name} (SKU: \`${product.sku}\`)  `,
    `**Current Stock**: ${product.currentStockQty} units | **Reorder Status**: ${product.reorderStatus}  `,
    `**Report Generated**: ${new Date().toISOString()}  `,
    ``,
    `## Executive Summary & Transaction Frequency`,
    `- **Total Times Transaction Happened on Item**: **${summaryStats.totalTransactionsCount} times**`,
    `- **Purchase Requisitions (PR)**: ${summaryStats.prCount}`,
    `- **Purchase Orders (PO)**: ${summaryStats.poCount}`,
    `- **Goods Receipt Notes (GRN)**: ${summaryStats.grnCount}`,
    `- **Warehouse Stock Inward**: ${summaryStats.inwardTransactionsCount} restocks (${summaryStats.cumulativeInwardQty} units)`,
    `- **Outward Dispatches & DC**: ${summaryStats.outwardTransactionsCount} dispatches (${summaryStats.cumulativeOutwardQty} units)`,
    `- **Delivery Challans (DC) Issued**: ${summaryStats.deliveryChallanCount}`,
    `- **Total Procurement Cost**: ?${summaryStats.totalProcurementCost.toLocaleString()}`,
    `- **Total Billed Sales Revenue**: ?${summaryStats.totalSalesValue.toLocaleString()}`,
    `- **Gross Profit Margin**: ?${summaryStats.grossProfit.toLocaleString()}`,
    `- **Inventory Turnover Rate**: ${summaryStats.inventoryTurnoverRate}x`,
    ``,
    `## Multi-Agent Council Status`,
    `| Agent Code | Agent Name & Scope | Status | Score | Latency |`,
    `|---|---|---|---|---|`,
  ];

  for (const a of multiAgentCouncil.agents) {
    mdLines.push(`| \`${a.agentCode}\` | ${a.agentName} | **${a.status}** | ${a.score}/100 | ${a.latencyMs}ms |`);
  }

  mdLines.push(
    ``,
    `### Agent Findings & Diagnostics`,
  );

  for (const a of multiAgentCouncil.agents) {
    mdLines.push(`#### ${a.agentName} (\`${a.agentCode}\`)`);
    for (const f of a.findings) {
      mdLines.push(`- ? ${f}`);
    }
    for (const w of a.warnings) {
      mdLines.push(`- ?? ${w}`);
    }
  }

  mdLines.push(
    ``,
    `## Chronological Supply Chain Audit Ledger`,
    `| Date/Time | Stage | Event Type | Ref No | Batch | Delta | Balance | Performed By | Notes |`,
    `|---|---|---|---|---|---|---|---|---|`
  );

  for (const e of chronologicalLedger) {
    const dt = e.timestamp.slice(0, 19).replace("T", " ");
    const delta = e.deltaQty > 0 ? `+${e.deltaQty}` : `${e.deltaQty}`;
    mdLines.push(`| ${dt} | ${e.stage} | ${e.eventType} | \`${e.referenceNo}\` | \`${e.batchNo || "N/A"}\` | ${delta} | ${e.balanceAfter} | ${e.performedBy} | ${e.notes} |`);
  }

  const mdPath = path.join(outDir, "item-supply-chain-history-report.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf8");

  console.log(`[?] JSON report saved to: ${jsonPath}`);
  console.log(`[?] Markdown report saved to: ${mdPath}`);
  console.log("SUCCESS: Item supply chain multi-agent verification completed.");
}

main().catch(console.error).finally(() => process.exit(0));
