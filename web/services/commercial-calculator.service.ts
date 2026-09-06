/**
 * Commercial Calculator Service
 *
 * Implements 100% faithful mathematical formulas from PTR_Profit_Calculator_final.xlsx:
 * - MR Price List (MRP, PTR, PTS)
 * - All Products Calculator (2,300 boxes / 23,000 strips batch quotation, GST, one-time charges)
 * - Scheme Dashboard (Buy 10 + X Free, Chemist discount, Doctor margin/free strips, Stockist discount)
 * - 12-Month Cash Flow Forecast (Credit lag, Staff salary, Working capital trough, Break-even month)
 * - Scheme Sensitivity Matrix (10+0 through 10+10)
 */

export interface ProductItemInput {
  id: string;
  sku: string;
  name: string;
  composition: string;
  packing: string;
  boxes: number;
  stripsPerBox: number;
  boxRate: number; // Cost paid to manufacturer per box (excl. GST)
  mrp: number; // MRP printed per strip
  ptr?: number; // Pre-calculated PTR per strip or calculated from MRP * (1 - chemistDiscount/100)
  pts?: number; // Price to stockist per strip
}

export interface CommercialSimulationInputs {
  chemistFreeStrips: number; // e.g. 0 to 10 (buy 10, get X free)
  chemistDiscountPct: number; // e.g. 20 (%)
  doctorFreeStrips: number; // e.g. 4 (free strips to doctor for every 10 sold)
  doctorMarginPct: number; // e.g. 0 (%)
  stockistMarginPct: number; // e.g. 20 (% off PTR)
  routeToMarket: "DIRECT" | "STOCKIST";
  creditDays: number; // e.g. 45
  sellThroughMonths: number; // e.g. 6
  gstRefundMonths: number; // e.g. 1
  staffMonthlyCost: number; // e.g. 40,000
  cylinderRatePerProduct: number; // e.g. 2,700 (₹1,350 * 2 colors)
  inventoryRatePerProduct: number; // e.g. 3,000
}

export const DEFAULT_PRODUCTS: ProductItemInput[] = [
  {
    id: "prod-1",
    sku: "MET-P-100",
    name: "Metace-P",
    composition: "Aceclofenac 100mg + Paracetamol 325mg",
    packing: "10X10 Blister",
    boxes: 500,
    stripsPerBox: 10,
    boxRate: 63,
    mrp: 68.5,
  },
  {
    id: "prod-2",
    sku: "MET-SP-100",
    name: "Metace-SP",
    composition: "Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg",
    packing: "10X10 Alu Alu",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 101,
    mrp: 130.19,
  },
  {
    id: "prod-3",
    sku: "PAN-DSR-100",
    name: "Pantometa-DSR",
    composition: "Pantoprazole 40mg + Domperidone 30mg (Cap)",
    packing: "10X10 Alu Alu",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 101,
    mrp: 135.19,
  },
  {
    id: "prod-4",
    sku: "RAB-DSR-100",
    name: "Rabemeta-DSR",
    composition: "Rabeprazole Sodium EC 20mg + Domperidone 30mg (Cap)",
    packing: "10X10 Alu Alu",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 92,
    mrp: 110.5,
  },
  {
    id: "prod-5",
    sku: "MET-CV-100",
    name: "Metaclav-CV",
    composition: "Amoxycillin 500mg + Clavulanic Acid 125mg (DPCO)",
    packing: "10X10 Alu Alu",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 474,
    mrp: 196.77,
  },
  {
    id: "prod-6",
    sku: "MET-CEF-200",
    name: "Metacef-200",
    composition: "Cefixime 200mg (DPCO)",
    packing: "10X10 Alu Alu",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 298,
    mrp: 105.1,
  },
  {
    id: "prod-7",
    sku: "MET-COL-650",
    name: "Metacol-650",
    composition: "Paracetamol 650mg",
    packing: "10X15 Blister",
    boxes: 300,
    stripsPerBox: 10,
    boxRate: 112,
    mrp: 32.2,
  },
];

export const DEFAULT_SIMULATION_INPUTS: CommercialSimulationInputs = {
  chemistFreeStrips: 0,
  chemistDiscountPct: 20,
  doctorFreeStrips: 4,
  doctorMarginPct: 0,
  stockistMarginPct: 20,
  routeToMarket: "DIRECT",
  creditDays: 45,
  sellThroughMonths: 6,
  gstRefundMonths: 1,
  staffMonthlyCost: 40000,
  cylinderRatePerProduct: 2700,
  inventoryRatePerProduct: 3000,
};

export const STAFF_MEMBERS = [
  { name: "Krishna Murthy", role: "Part-time (6–10 PM)", monthlySalary: 10000 },
  { name: "Abdul Mannan", role: "Part-time (20 hrs/wk)", monthlySalary: 15000 },
  { name: "Abdul Malik", role: "Part-time (20 hrs/wk)", monthlySalary: 15000 },
];

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ProductEconomicsResult {
  id: string;
  sku: string;
  name: string;
  composition: string;
  packing: string;
  boxes: number;
  totalStrips: number;
  costPerStrip: number;
  mrp: number;
  ptr: number; // Selling rate per strip before free schemes
  pts: number; // Price to stockist per strip
  netReceivedPerStrip: number; // Once free scheme strips are factored in
  profitPerStrip: number;
  profitMarginPct: number;
  totalGoodsCostExclGst: number;
  totalRevenue: number;
  totalProfit: number;
  freeStripsGiven: number;
  breakEvenFreeStrips: number; // Maximum free strips per 10 bought before profit hits 0
  billedStrips: number;
}

export interface SchemeComparisonRow {
  schemeLabel: string;
  freeStrips: number;
  billedStrips: number;
  totalRevenue: number;
  grossProfit: number;
  profitMarginPct: number;
  netProfitKept: number;
  diffVsBaseline: number;
}

export interface MonthlyCashFlowRow {
  month: number;
  salesBilled: number;
  cashCollected: number;
  cashPaidOut: number;
  gstRefund: number;
  netCashThisMonth: number;
  cumulativeCash: number;
}

export interface FullCommercialSimulationResult {
  inputs: CommercialSimulationInputs;
  products: ProductEconomicsResult[];
  summary: {
    totalBoxes: number;
    totalStrips: number;
    goodsCostExclGst: number;
    gstOnGoods: number;
    goodsCostWithGst: number;
    oneTimeChargesExclGst: number;
    gstOnOneTime: number;
    oneTimeChargesWithGst: number;
    totalDay0Investment: number; // Money Put In: Goods with GST + One-Time with GST
    totalRevenue: number; // Money Get Back
    grossProfitBeforeOneTime: number;
    grossProfitAfterOneTime: number; // Profit before staff & doctor
    doctorIncentiveCost: number; // Doctor Margin (% and free strips)
    doctorCostPct: number;
    doctorCostFreeStrips: number;
    staffTotalCost: number;
    totalCashOutlay: number; // Day 0 + Staff + Doctor
    netProfitKept: number; // Profit Actually Kept
    roiOnTotalOutlayPct: number;
    roiOnDay0OutlayPct: number;
    blendedMarginPct: number;
  };
  schemeMatrix: SchemeComparisonRow[];
  cashFlow: {
    troughAmount: number;
    troughMonth: number;
    breakEvenMonth: number;
    workingCapitalRequired: number;
    cashAtMonth12: number;
    uncollectedAtMonth12: number;
    rows: MonthlyCashFlowRow[];
  };
}

export class CommercialCalculatorService {
  /**
   * Evaluates complete commercial economics matching PTR_Profit_Calculator_final.xlsx
   */
  public static simulate(
    inputs: Partial<CommercialSimulationInputs> = {},
    customProducts?: ProductItemInput[]
  ): FullCommercialSimulationResult {
    const config: CommercialSimulationInputs = {
      ...DEFAULT_SIMULATION_INPUTS,
      ...inputs,
    };

    const productsInput = customProducts && customProducts.length > 0 ? customProducts : DEFAULT_PRODUCTS;
    const numProducts = productsInput.length;

    // 1. One-Time Charges Calculation
    const cylinderTotal = numProducts * config.cylinderRatePerProduct;
    const inventoryTotal = numProducts * config.inventoryRatePerProduct;
    const oneTimeChargesExclGst = cylinderTotal + inventoryTotal;
    const gstOnOneTime = round2(oneTimeChargesExclGst * 0.18);
    const oneTimeChargesWithGst = round2(oneTimeChargesExclGst + gstOnOneTime);

    // 2. Product-by-Product Economics
    let totalBoxes = 0;
    let totalStrips = 0;
    let goodsCostExclGst = 0;
    let totalRevenue = 0;

    const productResults: ProductEconomicsResult[] = productsInput.map((p) => {
      const strips = p.boxes * p.stripsPerBox;
      totalBoxes += p.boxes;
      totalStrips += strips;

      const costPerStrip = round2(p.boxRate / p.stripsPerBox);
      const lineGoodsCost = round2(p.boxes * p.boxRate);
      goodsCostExclGst += lineGoodsCost;

      // Rate charged per strip: PTR is calculated 100% directly on MRP (PTS deferred)
      const ptr = round2(p.mrp * (1 - config.chemistDiscountPct / 100));
      const pts = ptr; // PTS concept removed at present; deferred for future release

      const sellingRate = ptr;

      // Scheme: Buy 10, Get X free
      const freeScheme = config.chemistFreeStrips;
      const billedRatio = freeScheme > 0 ? 10 / (10 + freeScheme) : 1;
      const billedStrips = Math.round(strips * billedRatio);
      const freeStripsCount = strips - billedStrips;

      const netReceivedPerStrip = round2(sellingRate * billedRatio);
      const profitPerStrip = round2(netReceivedPerStrip - costPerStrip);
      const lineRevenue = round2(billedStrips * sellingRate);
      totalRevenue += lineRevenue;

      const lineProfit = round2(lineRevenue - lineGoodsCost);
      const profitMarginPct = lineRevenue > 0 ? round2((lineProfit / lineRevenue) * 100) : 0;

      // Break-even free strips: 10 * (sellingRate / costPerStrip - 1)
      const breakEvenFreeStrips =
        costPerStrip > 0 ? Math.max(0, Math.round(10 * (sellingRate / costPerStrip - 1))) : 0;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        composition: p.composition,
        packing: p.packing,
        boxes: p.boxes,
        totalStrips: strips,
        costPerStrip,
        mrp: p.mrp,
        ptr,
        pts,
        netReceivedPerStrip,
        profitPerStrip,
        profitMarginPct,
        totalGoodsCostExclGst: lineGoodsCost,
        totalRevenue: lineRevenue,
        totalProfit: lineProfit,
        freeStripsGiven: freeStripsCount,
        breakEvenFreeStrips,
        billedStrips,
      };
    });

    totalRevenue = round2(totalRevenue);
    goodsCostExclGst = round2(goodsCostExclGst);
    const gstOnGoods = round2(goodsCostExclGst * 0.05);
    const goodsCostWithGst = round2(goodsCostExclGst + gstOnGoods);
    const totalDay0Investment = round2(goodsCostWithGst + oneTimeChargesWithGst);

    const grossProfitBeforeOneTime = round2(totalRevenue - goodsCostExclGst);
    const grossProfitAfterOneTime = round2(grossProfitBeforeOneTime - oneTimeChargesExclGst);

    // 3. Doctor Incentive Cost
    // In the model: Doctor Incentive = (% of PTR) + (free strips given to doctor for every 10 sold)
    const doctorCostPct = round2(totalRevenue * (config.doctorMarginPct / 100));
    // Doctor free strips: doctorFreeStrips / 10 * revenue
    const doctorCostFreeStrips = round2(totalRevenue * (config.doctorFreeStrips / 10));
    const doctorIncentiveCost = round2(doctorCostPct + doctorCostFreeStrips);

    // 4. Staff Salary Costs
    const staffTotalCost = round2(config.staffMonthlyCost * config.sellThroughMonths);

    // 5. Profit Kept & ROI
    const netProfitKept = round2(grossProfitAfterOneTime - staffTotalCost - doctorIncentiveCost);
    const totalCashOutlay = round2(totalDay0Investment + staffTotalCost + doctorIncentiveCost);

    const roiOnTotalOutlayPct =
      totalCashOutlay > 0 ? round2((netProfitKept / totalCashOutlay) * 100) : 0;
    const roiOnDay0OutlayPct =
      totalDay0Investment > 0 ? round2((grossProfitAfterOneTime / totalDay0Investment) * 100) : 0;
    const blendedMarginPct =
      totalRevenue > 0 ? round2((netProfitKept / totalRevenue) * 100) : 0;

    // 6. Scheme Sensitivity Matrix (10+0 to 10+10)
    const baselineRevenue = this.computeRevenueForScheme(0, productsInput, config);
    const baselineNet = round2(
      baselineRevenue - goodsCostExclGst - oneTimeChargesExclGst - staffTotalCost - (baselineRevenue * (config.doctorMarginPct / 100 + config.doctorFreeStrips / 10))
    );

    const schemeMatrix: SchemeComparisonRow[] = [];
    for (let s = 0; s <= 10; s++) {
      const sRevenue = this.computeRevenueForScheme(s, productsInput, config);
      const sBilledRatio = s > 0 ? 10 / (10 + s) : 1;
      const sBilledStrips = Math.round(totalStrips * sBilledRatio);
      const sGrossProfit = round2(sRevenue - goodsCostExclGst);
      const sDoctorCost = round2(sRevenue * (config.doctorMarginPct / 100 + config.doctorFreeStrips / 10));
      const sNetKept = round2(sGrossProfit - oneTimeChargesExclGst - staffTotalCost - sDoctorCost);
      const sMarginPct = sRevenue > 0 ? round2((sGrossProfit / sRevenue) * 100) : 0;

      schemeMatrix.push({
        schemeLabel: `10 + ${s}`,
        freeStrips: s,
        billedStrips: sBilledStrips,
        totalRevenue: sRevenue,
        grossProfit: sGrossProfit,
        profitMarginPct: sMarginPct,
        netProfitKept: sNetKept,
        diffVsBaseline: round2(sNetKept - baselineNet),
      });
    }

    // 7. 12-Month Cash Flow Forecast
    const cashFlow = this.calculateCashFlow({
      totalRevenue,
      totalDay0Investment,
      gstOnGoods,
      creditDays: config.creditDays,
      sellThroughMonths: config.sellThroughMonths,
      gstRefundMonths: config.gstRefundMonths,
      monthlyStaffCost: config.staffMonthlyCost,
    });

    return {
      inputs: config,
      products: productResults,
      summary: {
        totalBoxes,
        totalStrips,
        goodsCostExclGst,
        gstOnGoods,
        goodsCostWithGst,
        oneTimeChargesExclGst,
        gstOnOneTime,
        oneTimeChargesWithGst,
        totalDay0Investment,
        totalRevenue,
        grossProfitBeforeOneTime,
        grossProfitAfterOneTime,
        doctorIncentiveCost,
        doctorCostPct,
        doctorCostFreeStrips,
        staffTotalCost,
        totalCashOutlay,
        netProfitKept,
        roiOnTotalOutlayPct,
        roiOnDay0OutlayPct,
        blendedMarginPct,
      },
      schemeMatrix,
      cashFlow,
    };
  }

  private static computeRevenueForScheme(
    freeStrips: number,
    products: ProductItemInput[],
    config: CommercialSimulationInputs
  ): number {
    const billedRatio = freeStrips > 0 ? 10 / (10 + freeStrips) : 1;
    let rev = 0;
    for (const p of products) {
      const strips = p.boxes * p.stripsPerBox;
      const billedStrips = Math.round(strips * billedRatio);
      const ptr = round2(p.mrp * (1 - config.chemistDiscountPct / 100));
      const pts = round2(ptr * (1 - config.stockistMarginPct / 100));
      const sellingRate = config.routeToMarket === "STOCKIST" ? pts : ptr;
      rev += round2(billedStrips * sellingRate);
    }
    return round2(rev);
  }

  private static calculateCashFlow({
    totalRevenue,
    totalDay0Investment,
    gstOnGoods,
    creditDays,
    sellThroughMonths,
    gstRefundMonths,
    monthlyStaffCost,
  }: {
    totalRevenue: number;
    totalDay0Investment: number;
    gstOnGoods: number;
    creditDays: number;
    sellThroughMonths: number;
    gstRefundMonths: number;
    monthlyStaffCost: number;
  }) {
    const collectionLagMonths = Math.round(creditDays / 30);
    const monthlyBilling = sellThroughMonths > 0 ? totalRevenue / sellThroughMonths : 0;

    const rows: MonthlyCashFlowRow[] = [];
    let runningCash = 0;
    let troughAmount = 0;
    let troughMonth = 0;
    let breakEvenMonth = -1;

    // Month 0
    runningCash = -totalDay0Investment;
    troughAmount = runningCash;
    troughMonth = 0;

    rows.push({
      month: 0,
      salesBilled: 0,
      cashCollected: 0,
      cashPaidOut: totalDay0Investment,
      gstRefund: 0,
      netCashThisMonth: -totalDay0Investment,
      cumulativeCash: round2(runningCash),
    });

    for (let m = 1; m <= 12; m++) {
      const salesBilled = m <= sellThroughMonths ? monthlyBilling : 0;

      // Cash collection lagged by collectionLagMonths
      const billingMonth = m - collectionLagMonths;
      const cashCollected =
        billingMonth > 0 && billingMonth <= sellThroughMonths ? monthlyBilling : 0;

      // Ongoing staff payout
      const cashPaidOut = monthlyStaffCost;

      // GST input credit refunded at specified month
      const gstRefund = m === gstRefundMonths ? gstOnGoods : 0;

      const netCashThisMonth = round2(cashCollected + gstRefund - cashPaidOut);
      runningCash = round2(runningCash + netCashThisMonth);

      if (runningCash < troughAmount) {
        troughAmount = runningCash;
        troughMonth = m;
      }

      if (breakEvenMonth === -1 && runningCash >= 0) {
        breakEvenMonth = m;
      }

      rows.push({
        month: m,
        salesBilled: round2(salesBilled),
        cashCollected: round2(cashCollected),
        cashPaidOut: round2(cashPaidOut),
        gstRefund: round2(gstRefund),
        netCashThisMonth,
        cumulativeCash: runningCash,
      });
    }

    const totalBilled = rows.reduce((s, r) => s + r.salesBilled, 0);
    const totalCollected = rows.reduce((s, r) => s + r.cashCollected, 0);
    const uncollectedAtMonth12 = round2(Math.max(0, totalBilled - totalCollected));
    const cashAtMonth12 = rows[rows.length - 1]?.cumulativeCash ?? 0;
    const workingCapitalRequired = Math.abs(troughAmount);

    return {
      troughAmount,
      troughMonth,
      breakEvenMonth: breakEvenMonth === -1 ? 12 : breakEvenMonth,
      workingCapitalRequired,
      cashAtMonth12,
      uncollectedAtMonth12,
      rows,
    };
  }

  /**
   * Single product forecast demand model (replicates Dashboard Section 5)
   */
  public static simulateSingleProductDemand({
    product,
    chemistCount = 25,
    monthlyStripsPerChemist = 8,
    monthlyGrowthPct = 5,
    freeStripsPer10 = 0,
    discountPct = 20,
  }: {
    product: ProductItemInput;
    chemistCount?: number;
    monthlyStripsPerChemist?: number;
    monthlyGrowthPct?: number;
    freeStripsPer10?: number;
    discountPct?: number;
  }) {
    const unitCost = round2(product.boxRate / product.stripsPerBox);
    const sellingRate = round2(product.mrp * (1 - discountPct / 100));
    const effectiveRate = freeStripsPer10 > 0 ? round2(sellingRate * (10 / (10 + freeStripsPer10))) : sellingRate;
    const unitProfit = round2(effectiveRate - unitCost);

    const month1BilledStrips = chemistCount * monthlyStripsPerChemist;
    const month1FreeStrips = Math.round((month1BilledStrips * freeStripsPer10) / 10);
    const month1TotalStrips = month1BilledStrips + month1FreeStrips;
    const month1Revenue = round2(month1BilledStrips * sellingRate);
    const month1Profit = round2(month1Revenue - month1TotalStrips * unitCost);

    return {
      productName: product.name,
      composition: product.composition,
      unitCost,
      mrp: product.mrp,
      sellingRate,
      effectiveRate,
      unitProfit,
      chemistCount,
      monthlyStripsPerChemist,
      monthlyGrowthPct,
      month1BilledStrips,
      month1FreeStrips,
      month1TotalStrips,
      month1Revenue,
      month1Profit,
    };
  }
}
