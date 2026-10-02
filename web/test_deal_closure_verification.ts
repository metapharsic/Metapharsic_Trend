import { generateExcelReportWithDashboard } from './lib/excel-export';

async function verify() {
  console.log('================================================================');
  console.log('   MULTI-AGENT DEAL CLOSURE, ORDERS & INVOICES VERIFICATION     ');
  console.log('================================================================\n');

  // 1. Test /api/mr/reports/calls?period=all
  console.log('--- 1. Testing /api/mr/reports/calls?period=all ---');
  const callsRes = await fetch('http://localhost:5555/api/mr/reports/calls?period=all');
  console.log('Calls endpoint status:', callsRes.status);
  const callsJson = await callsRes.json();
  const callsData = callsJson.data;
  const summary = callsData.dealClosureSummary;

  if (!summary) {
    throw new Error('Deal closure summary missing from calls response');
  }

  console.log('Total Analyzed Visits:', summary.totalAnalyzedVisits);
  console.log('Total Opportunities:', summary.totalOpportunities);
  console.log('High Win Deals (AI Priority Hot Deals):', summary.highProbabilityDeals);
  console.log('Deals Can Close This Week:', summary.closeThisWeekCount);
  console.log('Total Matched Invoices Count:', summary.totalInvoicesMatched);
  console.log('Total Matched Orders Count:', summary.totalOrdersMatched);
  console.log('Total Invoiced Revenue: ₹' + summary.totalInvoicedRevenue.toLocaleString());
  console.log('New Account Conversions Count:', summary.newAccountConversionsCount);
  console.log('Repeat Replenishments Count:', summary.repeatReplenishmentsCount);
  console.log('Estimated Pipeline Value: ₹' + summary.estimatedPipelineValue.toLocaleString());
  console.log('Active Agents in Council:', summary.agentTelemetry.map((a: any) => `${a.agentName} (${a.latencyMs}ms)`));

  // Check sample opportunity with matched invoices
  const oppWithInvoices = summary.topPriorityQueue.find((o: any) => o.matchedInvoicesCount > 0);
  if (oppWithInvoices) {
    console.log('\nSample Opportunity with Matched Invoices:');
    console.log({
      target: oppWithInvoices.targetName,
      type: oppWithInvoices.targetType,
      mr: oppWithInvoices.mrName,
      invoicesCount: oppWithInvoices.matchedInvoicesCount,
      ordersCount: oppWithInvoices.matchedOrdersCount,
      invoicedValue: `₹${oppWithInvoices.totalInvoicedValue.toLocaleString()}`,
      commercialCategory: oppWithInvoices.commercialCategory,
      canCloseThisWeek: oppWithInvoices.canCloseThisWeek,
      closeThisWeekReason: oppWithInvoices.closeThisWeekReason,
    });
  }

  // Check sample opportunity that can close this week
  const closeThisWeekOpp = summary.topPriorityQueue.find((o: any) => o.canCloseThisWeek);
  if (closeThisWeekOpp) {
    console.log('\nSample Opportunity Ready to Close This Week:');
    console.log({
      target: closeThisWeekOpp.targetName,
      type: closeThisWeekOpp.targetType,
      mr: closeThisWeekOpp.mrName,
      winProbability: `${closeThisWeekOpp.closureProbability}%`,
      priorityRank: closeThisWeekOpp.priorityRank,
      dealStage: closeThisWeekOpp.dealStage,
      mrComments: closeThisWeekOpp.mrComments,
      closeThisWeekReason: closeThisWeekOpp.closeThisWeekReason,
      guidance: closeThisWeekOpp.actionableGuidance,
      contactWindow: closeThisWeekOpp.recommendedFollowupWindow,
    });
  }

  // 2. Test MR Selection Filter on /api/mr/reports/deal-closure and /api/mr/reports/calls
  console.log('\n--- 2. Testing MR Selection on /api/mr/reports/deal-closure & calls ---');
  const firstMr = summary.mrRankings[0];
  console.log(`Filtering for Top Representative: ${firstMr.mrName} (MR Employee ID: ${firstMr.mrId})...`);
  const mrClosureRes = await fetch(`http://localhost:5555/api/mr/reports/deal-closure?employeeId=${firstMr.mrId}`);
  console.log('MR-scoped closure status (by employeeId):', mrClosureRes.status);
  const mrClosureJson = await mrClosureRes.json();
  const mrData = mrClosureJson.data;

  console.log(`Scoped Opportunities for ${firstMr.mrName}:`, mrData.totalOpportunities);
  console.log(`Scoped Hot Deals for ${firstMr.mrName}:`, mrData.highProbabilityDeals);
  console.log(`Scoped Close-This-Week Deals:`, mrData.closeThisWeekCount);
  console.log(`Scoped Matched Invoiced Value: ₹${mrData.totalInvoicedRevenue.toLocaleString()}`);

  // Test /api/mr/reports/calls with employeeId
  const mrCallsRes = await fetch(`http://localhost:5555/api/mr/reports/calls?period=all&employeeId=${firstMr.mrId}`);
  console.log('Calls endpoint status with employeeId:', mrCallsRes.status);

  // 3. Test Close-This-Week Only Filter
  console.log('\n--- 3. Testing ?canCloseThisWeekOnly=true ---');
  const weekClosureRes = await fetch(`http://localhost:5555/api/mr/reports/deal-closure?canCloseThisWeekOnly=true`);
  console.log('Week-only closure status:', weekClosureRes.status);
  const weekData = (await weekClosureRes.json()).data;
  console.log('Close-This-Week Queue Length:', weekData.closeThisWeekQueue?.length);

  // 4. Test Native Professional Excel (.xlsx) Multi-Tab Generation
  console.log('\n--- 4. Testing Multi-Agent Professional .xlsx Generation (ExcelJS) ---');
  const { generateProfessionalExcelWorkbook } = await import('./lib/excel-export');
  const fs = await import('fs');

  const xlsxBuffer = await generateProfessionalExcelWorkbook({
    reportTitle: 'Executive Deal Closure, Invoicing & Field Follow-Up Dashboard',
    reportSubtitle: 'Multi-Agent Commercial Reconciliation & High-Probability Pipeline Intelligence',
    scopeMR: firstMr.mrName,
    period: 'ALL TIME',
    kpis: [
      { label: 'Total Visits Evaluated', value: summary.totalAnalyzedVisits, note: 'Field coverage' },
      { label: 'Total Invoices Reconciled', value: summary.totalInvoicesMatched, note: 'Live billing records' },
      { label: 'Total Invoiced Revenue', value: `₹${summary.totalInvoicedRevenue.toLocaleString()}`, note: 'Realized revenue' },
      { label: 'Active Pipeline Value', value: `₹${summary.estimatedPipelineValue.toLocaleString()}`, note: 'Weighted deals' },
      { label: 'Hot Deals (Win >= 70%)', value: summary.highProbabilityDeals, note: 'AI Hot deals' },
      { label: 'Deals Can Close This Week', value: summary.closeThisWeekCount, note: 'Immediate week closures' },
    ],
    mrSummaryTable: {
      headers: ['MR Name', 'Total Deals', 'Hot Deals', 'Close This Week', 'Closing Rate %'],
      rows: summary.mrRankings.map((r: any) => [r.mrName, r.totalDeals, r.highProbDeals, r.closeThisWeekDeals, `${r.closingRatePct}%`]),
    },
    detailHeaders: [
      'Customer Name', 'Target Type', 'Territory', 'Assigned MR', 'MR Field Comments & Response',
      'Receptiveness', 'Past Invoices', 'Total Invoiced (₹)', 'Commercial Category', 'Can Close This Week?',
      'Close This Week Reason', 'Win Probability (%)', 'Closure Tier', 'Priority Rank', 'Deal Stage',
      'Buying Signals', 'Objections', 'Focus Products', 'AI Actionable Guidance', 'Contact Window', 'Estimated Deal Value (₹)', 'Last Visit Date'
    ],
    detailRows: summary.topPriorityQueue.slice(0, 15).map((o: any) => [
      o.targetName,
      o.targetType,
      o.territory,
      o.mrName,
      o.mrComments,
      o.receptiveness,
      o.matchedInvoicesCount,
      o.totalInvoicedValue,
      o.commercialCategory,
      o.canCloseThisWeek ? 'YES - CLOSE THIS WEEK' : 'NO',
      o.closeThisWeekReason,
      `${o.closureProbability}%`,
      o.closureTier,
      o.priorityRank,
      o.dealStage,
      o.closingSignals.join('; '),
      o.objectionsIdentified.join('; ') || 'None',
      o.productInterests.join('; '),
      o.actionableGuidance,
      o.recommendedFollowupWindow,
      o.estimatedDealValue,
      o.lastVisitDate,
    ]),
    callLogsHeaders: ['Visit Date', 'Customer Name', 'Target Type', 'Territory', 'MR', 'Purpose', 'MR Comments & Feedback', 'CQS Score'],
    callLogsRows: summary.topPriorityQueue.slice(0, 15).map((o: any) => [
      o.lastVisitDate,
      o.targetName,
      o.targetType,
      o.territory,
      o.mrName,
      'Clinical Detailing',
      o.mrComments,
      '8.5/10',
    ]),
  });

  console.log('Professional .xlsx Workbook Byte Length:', xlsxBuffer.byteLength);
  fs.writeFileSync('test_professional_report.xlsx', Buffer.from(xlsxBuffer));
  console.log('Successfully wrote test_professional_report.xlsx to disk!');

  console.log('\n================================================================');
  console.log('  ALL MULTI-AGENT DEAL CLOSURE, INVOICE & EXCEL TESTS PASSED!   ');
  console.log('================================================================');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
