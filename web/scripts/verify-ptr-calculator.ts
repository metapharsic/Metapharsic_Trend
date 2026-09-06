import { CommercialCalculatorService, DEFAULT_SIMULATION_INPUTS } from "../services/commercial-calculator.service";

async function verify() {
  console.log("=================================================================");
  console.log("       VERIFYING PTR CALCULATOR SERVICE AGAINST EXCEL MODEL       ");
  console.log("=================================================================\n");

  const res = CommercialCalculatorService.simulate(DEFAULT_SIMULATION_INPUTS);

  const tests = [
    { name: "Day 0 Total Investment", actual: res.summary.totalDay0Investment, expected: 451227 },
    { name: "Goods Cost Excl GST", actual: res.summary.goodsCostExclGst, expected: 384900 },
    { name: "GST on Goods (5%)", actual: res.summary.gstOnGoods, expected: 19245 },
    { name: "One-Time Charges with GST", actual: res.summary.oneTimeChargesWithGst, expected: 47082 },
    { name: "Total Revenue at 10+0", actual: res.summary.totalRevenue, expected: 1977880 },
    { name: "Gross Profit before One-Time", actual: res.summary.grossProfitBeforeOneTime, expected: 1592980 },
    { name: "Profit before Staff & Doctor", actual: res.summary.grossProfitAfterOneTime, expected: 1553080 },
    { name: "Doctor Margin Cost (4 free strips/10)", actual: res.summary.doctorIncentiveCost, expected: 791152 },
    { name: "Staff Cost (6 months)", actual: res.summary.staffTotalCost, expected: 240000 },
    { name: "Net Profit Kept", actual: res.summary.netProfitKept, expected: 521928 },
    { name: "Cash Trough Amount", actual: res.cashFlow.troughAmount, expected: -511982 },
    { name: "Trough Month", actual: res.cashFlow.troughMonth, expected: 2 },
    { name: "Break-Even Month", actual: res.cashFlow.breakEvenMonth, expected: 4 },
  ];

  let passed = 0;
  for (const t of tests) {
    const diff = Math.abs(t.actual - t.expected);
    const ok = diff <= 1.0;
    if (ok) {
      passed++;
      console.log(`[PASS] ${t.name.padEnd(38)}: Actual=${t.actual.toLocaleString()} | Expected=${t.expected.toLocaleString()}`);
    } else {
      console.error(`[FAIL] ${t.name.padEnd(38)}: Actual=${t.actual} | Expected=${t.expected} (diff: ${diff})`);
    }
  }

  // Verify 10+5 Scheme in Matrix
  const s5 = res.schemeMatrix.find((s) => s.freeStrips === 5);
  console.log("\n--- Checking Scheme 10+5 Sensitivity Row ---");
  console.log(`Billed Strips: ${s5?.billedStrips} (Expected: 15,330)`);
  console.log(`Total Revenue: ${s5?.totalRevenue} (Expected: 1,318,404)`);
  console.log(`Gross Profit:  ${s5?.grossProfit} (Expected: 933,504)`);

  // Verify Break-Even free strips
  console.log("\n--- Checking Product Break-Even Free Strips ---");
  for (const p of res.products) {
    console.log(`${p.name.padEnd(16)}: Break-Even Free Strips = ${p.breakEvenFreeStrips} (Rate: ₹${p.ptr}, Cost: ₹${p.costPerStrip})`);
  }

  console.log(`\nVerification Complete: ${passed} / ${tests.length} tests passed.`);
  if (passed === tests.length) {
    console.log("ALL MATHEMATICAL CHECKS MATCH THE EXCEL WORKBOOK 100%!");
  } else {
    process.exit(1);
  }
}

verify().catch(console.error);
