import type ExcelJS from "exceljs";
import { costBasis, type CostBasisSource } from "@/lib/pricing";

export type TaxTreatment = "RECOVERABLE_ITC" | "NON_RECOVERABLE";
export type CostBasisMode = "PTR" | "CATALOG_PURCHASE_RATE" | "CATALOG_PTS";
export type SellingPriceBasis = "PTR" | "MRP" | "PTS";

export interface ProfitTestingAssumptions {
  doctorCommissionPct: number; // e.g. 20.0 (%)
  purchaseGstPct: number; // e.g. 5.0 (0.05 in sheet)
  salesGstPct: number; // e.g. 0.0 (%)
  otherCharges: number; // e.g. 2500.00 (₹)
  taxTreatment: TaxTreatment;
  costBasisMode: CostBasisMode;
  sellingPriceBasis: SellingPriceBasis;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  sku?: string;
  packSize?: string | null;
  mrp: number;
  ptr: number;
  pts: number;
  purchaseRate?: number | null;
  marginStructure?: string | null;
  gstPct?: number | null;
}

export interface ProfitTestingRowInput {
  id: string;
  productId: string | null;
  item: string;
  packing: string;
  billedQty: number;
  freeQty: number;
  mrp: number;
  ptr: number;
  pts: number;
  catalogPurchaseRate: number;
  marginStructure?: string | null;
  costPerStripOverride: number | null;
  sellRateOverride: number | null;
  doctorPctOverride: number | null;
}

export interface ProfitTestingComputedRow extends ProfitTestingRowInput {
  no: number;
  isActive: boolean;
  totalQty: number;
  costPerStrip: number;
  costBasisSource: string;
  sellRate: number;
  billedSales: number;
  salesGst: number;
  invoiceTotal: number;
  freeValueAtPtr: number;
  freeStripCost: number;
  purchaseCost: number;
  purchaseGst: number;
  cashOutlayInclGst: number;
  grossProfit: number;
  doctorPct: number;
  doctorCost: number;
  netProfit: number;
  netMarginPct: number;
}

export interface ProfitTestingSummary {
  activeRowsCount: number;
  totalBilledQty: number;
  totalFreeQty: number;
  totalQty: number;
  billedSalesExclGst: number;
  salesGstCollected: number;
  invoiceTotalInclGst: number;
  freeValueAtPtr: number;
  freeStripCost: number;
  billedUnitsCost: number;
  purchaseCostExclGst: number;
  purchaseGstPaid: number;
  purchaseCashOutlayInclGst: number;
  grossProfitAfterInputGstCredit: number;
  grossMarginPct: number;
  doctorCommission: number;
  effectiveDoctorPct: number;
  lineItemNetProfitBeforeOtherCharges: number;
  otherCharges: number;
  otherChargesPctOfSales: number;
  totalOperatingCost: number;
  netProfitEarnings: number;
  netMarginPct: number;
  returnOnTotalCostPct: number;
  cashEarningsBeforeInputGstCredit: number;
  inputGstCredit: number;
  netGstPosition: number;
  avgSellRatePerBilledStrip: number;
  effectiveRealizationPerTotalStrip: number;
  freeDilutionPct: number;
  netProfitPerBilledStrip: number;
  netProfitPerTotalStrip: number;
  breakEvenRevenueRequired: number | null;
  sellRateUpliftPctToBreakEven: number | null;
  taxTreatmentLabel: string;
}

export const DEFAULT_PROFIT_TESTING_ASSUMPTIONS: ProfitTestingAssumptions = {
  doctorCommissionPct: 20,
  purchaseGstPct: 5,
  salesGstPct: 0,
  otherCharges: 2500,
  taxTreatment: "RECOVERABLE_ITC",
  costBasisMode: "PTR",
  sellingPriceBasis: "PTR",
};

/** Exact 7-row SKU scenario from the user's Profit Testing Sheet + 3 blank rows (rows 8-10). */
export const SHEET_REFERENCE_ITEMS: Array<{
  item: string;
  packing: string;
  mrp: number;
  ptr: number;
  pts: number;
  catalogPurchaseRate: number;
  billedQty: number;
  freeQty: number;
}> = [
  { item: "Metaclav-CV", packing: "10X10 Alu Alu", mrp: 196.77, ptr: 157.42, pts: 125.94, catalogPurchaseRate: 47.4, billedQty: 10, freeQty: 5 },
  { item: "Metacef-200", packing: "10X10 Alu Alu", mrp: 105.1, ptr: 84.08, pts: 75.67, catalogPurchaseRate: 29.8, billedQty: 10, freeQty: 5 },
  { item: "Metace-P", packing: "10X10 Blister", mrp: 68.5, ptr: 54.8, pts: 43.84, catalogPurchaseRate: 6.35, billedQty: 10, freeQty: 5 },
  { item: "Metace-SP", packing: "10X10 Alu Alu", mrp: 130.19, ptr: 104.15, pts: 83.32, catalogPurchaseRate: 10.1, billedQty: 10, freeQty: 5 },
  { item: "Pantometa-DSR", packing: "10X10 Alu Alu", mrp: 135.19, ptr: 108.15, pts: 86.52, catalogPurchaseRate: 10.1, billedQty: 10, freeQty: 5 },
  { item: "Rabemeta-DSR", packing: "10X10 Alu Alu", mrp: 110.5, ptr: 88.4, pts: 70.72, catalogPurchaseRate: 9.22, billedQty: 10, freeQty: 5 },
  { item: "Metacol-650", packing: "10X15 Blister", mrp: 32.2, ptr: 25.76, pts: 22.54, catalogPurchaseRate: 11.02, billedQty: 10, freeQty: 5 },
];

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function createBlankTestingRow(idx: number): ProfitTestingRowInput {
  return {
    id: `pt-row-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    productId: null,
    item: "",
    packing: "",
    billedQty: 0,
    freeQty: 0,
    mrp: 0,
    ptr: 0,
    pts: 0,
    catalogPurchaseRate: 0,
    marginStructure: null,
    costPerStripOverride: null,
    sellRateOverride: null,
    doctorPctOverride: null,
  };
}

/**
 * Builds rows using the reference preset and enriches catalogPurchaseRate/productId
 * when matching SKUs exist in the live database catalog.
 */
export function buildReferenceSheetRows(
  catalog: CatalogProductOption[] = [],
  minRows = 0
): ProfitTestingRowInput[] {
  const catalogByNormalizedName = new Map<string, CatalogProductOption>();
  for (const p of catalog) {
    catalogByNormalizedName.set(p.name.trim().toLowerCase(), p);
  }

  const rows: ProfitTestingRowInput[] = SHEET_REFERENCE_ITEMS.map((ref, idx) => {
    const normalized = ref.item.trim().toLowerCase();
    const matched =
      catalogByNormalizedName.get(normalized) ||
      (normalized === "metaclav-cv" ? catalogByNormalizedName.get("metamox-cv") : undefined);

    const catalogRate = matched
      ? costBasis({
          purchaseRate: matched.purchaseRate,
          pts: matched.pts,
          ptr: matched.ptr,
          marginStructure: matched.marginStructure,
        }).value
      : ref.catalogPurchaseRate;

    const matchedPts = matched ? Number(matched.pts) : 0;

    return {
      id: `pt-ref-${idx + 1}`,
      productId: matched?.id ?? null,
      item: ref.item,
      packing: ref.packing,
      billedQty: ref.billedQty,
      freeQty: ref.freeQty,
      mrp: ref.mrp,
      ptr: ref.ptr,
      pts: matchedPts > 0 ? matchedPts : ref.pts,
      catalogPurchaseRate: round2(catalogRate),
      marginStructure: matched?.marginStructure ?? null,
      costPerStripOverride: null,
      sellRateOverride: null,
      doctorPctOverride: null,
    };
  });

  while (rows.length < minRows) {
    rows.push(createBlankTestingRow(rows.length + 1));
  }
  return rows;
}

/** Builds rows strictly from the live PostgreSQL Product catalog without blank placeholder rows. */
export function buildRowsFromCatalogProducts(
  catalog: CatalogProductOption[],
  defaultBilledQty = 10,
  defaultFreeQty = 5,
  minRows = 0
): ProfitTestingRowInput[] {
  const rows: ProfitTestingRowInput[] = catalog.map((p, idx) => {
    const basis = costBasis({
      purchaseRate: p.purchaseRate,
      pts: p.pts,
      ptr: p.ptr,
      marginStructure: p.marginStructure,
    });
    return {
      id: `pt-cat-${p.id}-${idx + 1}`,
      productId: p.id,
      item: p.name,
      packing: p.packSize || "10X10 Standard",
      billedQty: defaultBilledQty,
      freeQty: defaultFreeQty,
      mrp: round2(Number(p.mrp || 0)),
      ptr: round2(Number(p.ptr || 0)),
      pts: round2(Number(p.pts || 0)),
      catalogPurchaseRate: round2(basis.value),
      marginStructure: p.marginStructure ?? null,
      costPerStripOverride: null,
      sellRateOverride: null,
      doctorPctOverride: null,
    };
  });

  while (rows.length < minRows) {
    rows.push(createBlankTestingRow(rows.length + 1));
  }
  return rows;
}

function resolveRowCostPerStrip(
  row: ProfitTestingRowInput,
  mode: CostBasisMode
): { amount: number; sourceLabel: string } {
  if (row.costPerStripOverride !== null && Number.isFinite(row.costPerStripOverride)) {
    return { amount: round2(Math.max(0, row.costPerStripOverride)), sourceLabel: "Manual Override" };
  }
  switch (mode) {
    case "CATALOG_PURCHASE_RATE": {
      if (row.catalogPurchaseRate > 0) {
        return { amount: round2(row.catalogPurchaseRate), sourceLabel: "Catalog Purchase Rate" };
      }
      const derived = costBasis({
        purchaseRate: row.catalogPurchaseRate,
        pts: row.pts,
        ptr: row.ptr,
        marginStructure: row.marginStructure,
      });
      const labelBySource: Record<CostBasisSource, string> = {
        purchaseRate: "Catalog Purchase Rate",
        pts: "Derived from PTS",
        ptr: "Derived from PTR",
        price: "Derived from MRP",
        none: "No Cost Data",
      };
      return { amount: round2(derived.value), sourceLabel: labelBySource[derived.source] };
    }
    case "CATALOG_PTS":
      return { amount: round2(Math.max(0, row.pts)), sourceLabel: "Catalog PTS" };
    case "PTR":
    default:
      return { amount: round2(Math.max(0, row.ptr)), sourceLabel: "PTR Basis" };
  }
}

function resolveRowSellRate(row: ProfitTestingRowInput, basis: SellingPriceBasis): number {
  if (row.sellRateOverride !== null && Number.isFinite(row.sellRateOverride)) {
    return round2(Math.max(0, row.sellRateOverride));
  }
  switch (basis) {
    case "MRP":
      return round2(Math.max(0, row.mrp));
    case "PTS":
      return round2(Math.max(0, row.pts));
    case "PTR":
    default:
      return round2(Math.max(0, row.ptr));
  }
}

/**
 * Pure audit-grade computation for the 23-column Profit Testing Sheet and 16-metric Earnings Summary.
 * Keeps Purchase GST and Sales GST cleanly separated so Cash Outlay, Gross Profit after ITC,
 * and Cash Earnings before Input GST Credit match statutory accounting.
 */
export function computeProfitTestingSheet(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingRowInput[]
): {
  computedRows: ProfitTestingComputedRow[];
  summary: ProfitTestingSummary;
} {
  const globalDocPct = Number.isFinite(assumptions.doctorCommissionPct)
    ? Math.max(0, assumptions.doctorCommissionPct)
    : 0;
  const purchaseGstRate = Math.max(0, Number(assumptions.purchaseGstPct || 0)) / 100;
  const salesGstRate = Math.max(0, Number(assumptions.salesGstPct || 0)) / 100;
  const isRecoverable = assumptions.taxTreatment === "RECOVERABLE_ITC";

  const computedRows: ProfitTestingComputedRow[] = rows.map((row, index) => {
    const billedQty = Math.max(0, Number(row.billedQty || 0));
    const freeQty = Math.max(0, Number(row.freeQty || 0));
    const totalQty = billedQty + freeQty;
    const isActive = Boolean(row.item.trim()) || billedQty > 0 || freeQty > 0;

    const { amount: costPerStrip, sourceLabel: costBasisSource } = resolveRowCostPerStrip(
      row,
      assumptions.costBasisMode
    );
    const sellRate = resolveRowSellRate(row, assumptions.sellingPriceBasis);
    const doctorPct =
      row.doctorPctOverride !== null && Number.isFinite(row.doctorPctOverride)
        ? Math.max(0, row.doctorPctOverride)
        : globalDocPct;

    const billedSales = round2(billedQty * sellRate);
    const salesGst = round2(billedSales * salesGstRate);
    const invoiceTotal = round2(billedSales + salesGst);

    const freeValueAtPtr = round2(freeQty * Math.max(0, row.ptr));
    const freeStripCost = round2(freeQty * costPerStrip);
    const purchaseCost = round2(totalQty * costPerStrip);
    const purchaseGst = round2(purchaseCost * purchaseGstRate);
    const cashOutlayInclGst = round2(purchaseCost + purchaseGst);

    const effectivePnlPurchaseCost = isRecoverable ? purchaseCost : cashOutlayInclGst;
    const grossProfit = round2(billedSales - effectivePnlPurchaseCost);
    const doctorCost = round2(billedSales * (doctorPct / 100));
    const netProfit = round2(grossProfit - doctorCost);
    const netMarginPct = billedSales > 0 ? Math.round((netProfit / billedSales) * 10000) / 100 : 0;

    return {
      ...row,
      no: index + 1,
      isActive,
      totalQty,
      costPerStrip,
      costBasisSource,
      sellRate,
      billedSales,
      salesGst,
      invoiceTotal,
      freeValueAtPtr,
      freeStripCost,
      purchaseCost,
      purchaseGst,
      cashOutlayInclGst,
      grossProfit,
      doctorPct,
      doctorCost,
      netProfit,
      netMarginPct,
    };
  });

  const activeRows = computedRows.filter((r) => r.isActive);
  const sum = (picker: (r: ProfitTestingComputedRow) => number) =>
    round2(activeRows.reduce((acc, r) => acc + picker(r), 0));

  const totalBilledQty = activeRows.reduce((acc, r) => acc + r.billedQty, 0);
  const totalFreeQty = activeRows.reduce((acc, r) => acc + r.freeQty, 0);
  const totalQty = totalBilledQty + totalFreeQty;

  const billedSalesExclGst = sum((r) => r.billedSales);
  const salesGstCollected = sum((r) => r.salesGst);
  const invoiceTotalInclGst = round2(billedSalesExclGst + salesGstCollected);
  const freeValueAtPtr = sum((r) => r.freeValueAtPtr);
  const freeStripCost = sum((r) => r.freeStripCost);
  const purchaseCostExclGst = sum((r) => r.purchaseCost);
  const purchaseGstPaid = sum((r) => r.purchaseGst);
  const purchaseCashOutlayInclGst = round2(purchaseCostExclGst + purchaseGstPaid);

  const effectiveTotalPurchasePnl = isRecoverable
    ? purchaseCostExclGst
    : purchaseCashOutlayInclGst;
  const billedUnitsCost = round2(Math.max(0, purchaseCostExclGst - freeStripCost));

  const grossProfitAfterInputGstCredit = round2(billedSalesExclGst - effectiveTotalPurchasePnl);
  const grossMarginPct =
    billedSalesExclGst > 0
      ? Math.round((grossProfitAfterInputGstCredit / billedSalesExclGst) * 10000) / 100
      : 0;
  const doctorCommission = sum((r) => r.doctorCost);
  const effectiveDoctorPct =
    billedSalesExclGst > 0 ? Math.round((doctorCommission / billedSalesExclGst) * 1000) / 10 : globalDocPct;

  const otherCharges = round2(Math.max(0, Number(assumptions.otherCharges || 0)));
  const otherChargesPctOfSales =
    billedSalesExclGst > 0 ? Math.round((otherCharges / billedSalesExclGst) * 10000) / 100 : 0;
  const lineItemNetProfitBeforeOtherCharges = round2(
    grossProfitAfterInputGstCredit - doctorCommission
  );
  const netProfitEarnings = round2(lineItemNetProfitBeforeOtherCharges - otherCharges);
  const netMarginPct =
    billedSalesExclGst > 0
      ? Math.round((netProfitEarnings / billedSalesExclGst) * 10000) / 100
      : 0;

  const totalOperatingCost = round2(effectiveTotalPurchasePnl + doctorCommission + otherCharges);
  const returnOnTotalCostPct =
    totalOperatingCost > 0
      ? Math.round((netProfitEarnings / totalOperatingCost) * 10000) / 100
      : 0;

  const inputGstCredit = isRecoverable ? purchaseGstPaid : 0;
  // Cash earnings before claiming Input GST Credit: Sales GST collected belongs to govt,
  // while Input GST Credit paid on purchases remains an out-of-pocket cash outflow until claimed/offset.
  const cashEarningsBeforeInputGstCredit = round2(netProfitEarnings - inputGstCredit);
  const netGstPosition = round2(salesGstCollected - inputGstCredit);

  const avgSellRatePerBilledStrip =
    totalBilledQty > 0 ? round2(billedSalesExclGst / totalBilledQty) : 0;
  const effectiveRealizationPerTotalStrip =
    totalQty > 0 ? round2(billedSalesExclGst / totalQty) : 0;
  const freeDilutionPct =
    totalQty > 0 ? Math.round((totalFreeQty / totalQty) * 10000) / 100 : 0;
  const netProfitPerBilledStrip =
    totalBilledQty > 0 ? round2(netProfitEarnings / totalBilledQty) : 0;
  const netProfitPerTotalStrip =
    totalQty > 0 ? round2(netProfitEarnings / totalQty) : 0;

  const doctorShare = effectiveDoctorPct / 100;
  const breakEvenRevenueRequired =
    doctorShare < 0.999 && totalOperatingCost > 0
      ? round2((effectiveTotalPurchasePnl + otherCharges) / (1 - doctorShare))
      : null;
  const sellRateUpliftPctToBreakEven =
    billedSalesExclGst > 0 && breakEvenRevenueRequired !== null && netProfitEarnings < 0
      ? Math.round(((breakEvenRevenueRequired - billedSalesExclGst) / billedSalesExclGst) * 1000) / 10
      : 0;

  const summary: ProfitTestingSummary = {
    activeRowsCount: activeRows.length,
    totalBilledQty,
    totalFreeQty,
    totalQty,
    billedSalesExclGst,
    salesGstCollected,
    invoiceTotalInclGst,
    freeValueAtPtr,
    freeStripCost,
    billedUnitsCost,
    purchaseCostExclGst,
    purchaseGstPaid,
    purchaseCashOutlayInclGst,
    grossProfitAfterInputGstCredit,
    grossMarginPct,
    doctorCommission,
    effectiveDoctorPct,
    lineItemNetProfitBeforeOtherCharges,
    otherCharges,
    otherChargesPctOfSales,
    totalOperatingCost,
    netProfitEarnings,
    netMarginPct,
    returnOnTotalCostPct,
    cashEarningsBeforeInputGstCredit,
    inputGstCredit,
    netGstPosition,
    avgSellRatePerBilledStrip,
    effectiveRealizationPerTotalStrip,
    freeDilutionPct,
    netProfitPerBilledStrip,
    netProfitPerTotalStrip,
    breakEvenRevenueRequired,
    sellRateUpliftPctToBreakEven,
    taxTreatmentLabel: isRecoverable
      ? "Purchase GST recoverable"
      : "Purchase GST non-recoverable (expensed)",
  };

  return { computedRows, summary };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtmlText(val: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInrText(value: number): string {
  const abs = Math.abs(value);
  const formatted = `₹${abs.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return value < -0.004 ? `(${formatted})` : formatted;
}

function summaryMetricsList(
  assumptions: ProfitTestingAssumptions,
  summary: ProfitTestingSummary
): Array<{ label: string; value: number; isPct?: boolean; bold?: boolean }> {
  return [
    { label: "Billed sales excl. GST", value: summary.billedSalesExclGst },
    { label: `Sales GST collected (${assumptions.salesGstPct}%)`, value: summary.salesGstCollected },
    { label: "Invoice total incl. GST", value: summary.invoiceTotalInclGst, bold: true },
    { label: "Free value @ PTR (not billed)", value: summary.freeValueAtPtr },
    { label: "Billed units cost (excl. GST)", value: summary.billedUnitsCost },
    { label: "Free strip cost", value: summary.freeStripCost },
    { label: "Purchase cost excl. GST", value: summary.purchaseCostExclGst },
    { label: `Purchase GST paid (${assumptions.purchaseGstPct}%)`, value: summary.purchaseGstPaid },
    { label: "Purchase cash outlay incl. GST", value: summary.purchaseCashOutlayInclGst },
    {
      label:
        assumptions.taxTreatment === "RECOVERABLE_ITC"
          ? "Gross profit after input GST credit"
          : "Gross profit after non-recoverable GST",
      value: summary.grossProfitAfterInputGstCredit,
      bold: true,
    },
    { label: "Gross margin (% of Billed Sales)", value: summary.grossMarginPct, isPct: true },
    { label: `Doctor commission (${summary.effectiveDoctorPct.toFixed(1)}%)`, value: summary.doctorCommission },
    {
      label: "Line-item net profit (before other charges)",
      value: summary.lineItemNetProfitBeforeOtherCharges,
    },
    { label: "Less: Other charges", value: summary.otherCharges },
    { label: "Net profit / earnings (After Other Charges)", value: summary.netProfitEarnings, bold: true },
    { label: "Net margin (% of Billed Sales)", value: summary.netMarginPct, isPct: true },
    { label: `Return on total cost (₹${summary.totalOperatingCost.toFixed(2)})`, value: summary.returnOnTotalCostPct, isPct: true },
    { label: "Cash earnings before input GST credit", value: summary.cashEarningsBeforeInputGstCredit, bold: true },
    { label: "Input GST credit (Recoverable ITC)", value: summary.inputGstCredit },
    { label: "Net GST payable / (ITC credit carryforward)", value: summary.netGstPosition },
    { label: "Avg sell rate / billed strip", value: summary.avgSellRatePerBilledStrip },
    { label: "Effective realization / total strip", value: summary.effectiveRealizationPerTotalStrip },
    { label: "Free qty dilution (% of Total Qty)", value: summary.freeDilutionPct, isPct: true },
    { label: "Break-even billed revenue required", value: summary.breakEvenRevenueRequired ?? 0, bold: true },
  ];
}

/** Builds a clean UTF-8 BOM CSV string containing Key Assumptions, Line Items + Totals, and Earnings Summary. */
export function buildProfitTestingCsv(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary
): string {
  const lines: string[] = [];
  const push = (cols: Array<string | number>) => lines.push(cols.map(escapeCsvCell).join(","));

  push(["Profit Testing Sheet — Trend MR Pharma OS", `Exported: ${new Date().toISOString().slice(0, 10)}`]);
  push([]);
  push(["Key Assumptions", "Value", "Assumptions (GST / Basis)", "Value"]);
  push(["Doctor commission %", `${assumptions.doctorCommissionPct}%`, "Purchase GST %", `${assumptions.purchaseGstPct}%`]);
  push(["Other charges (INR)", assumptions.otherCharges.toFixed(2), "Sales GST %", `${assumptions.salesGstPct}%`]);
  push(["Tax treatment", summary.taxTreatmentLabel, "Cost / Selling Basis", `${assumptions.costBasisMode} / ${assumptions.sellingPriceBasis}`]);
  push([]);

  push([
    "No.",
    "Item",
    "Packing",
    "Billed Qty",
    "Free Qty",
    "Total Qty",
    "MRP",
    "PTR",
    "Cost / Strip",
    "Sell Rate",
    "Billed Sales",
    "Sales GST",
    "Invoice Total",
    "Free Value @ PTR",
    "Free Strip Cost",
    "Purchase Cost",
    "Purchase GST",
    "Cash Outlay Incl. GST",
    "Gross Profit",
    "Doctor %",
    "Doctor Cost",
    "Net Profit",
    "Net Margin %",
  ]);

  for (const r of rows) {
    push([
      r.no,
      r.item,
      r.packing,
      r.billedQty,
      r.freeQty,
      r.totalQty,
      r.mrp.toFixed(2),
      r.ptr.toFixed(2),
      r.costPerStrip.toFixed(2),
      r.sellRate.toFixed(2),
      r.billedSales.toFixed(2),
      r.salesGst.toFixed(2),
      r.invoiceTotal.toFixed(2),
      r.freeValueAtPtr.toFixed(2),
      r.freeStripCost.toFixed(2),
      r.purchaseCost.toFixed(2),
      r.purchaseGst.toFixed(2),
      r.cashOutlayInclGst.toFixed(2),
      r.grossProfit.toFixed(2),
      `${r.doctorPct.toFixed(1)}%`,
      r.doctorCost.toFixed(2),
      r.netProfit.toFixed(2),
      `${r.netMarginPct.toFixed(1)}%`,
    ]);
  }

  push([
    "TOTAL",
    `${summary.activeRowsCount} SKUs`,
    "",
    summary.totalBilledQty,
    summary.totalFreeQty,
    summary.totalQty,
    "",
    "",
    "",
    "",
    summary.billedSalesExclGst.toFixed(2),
    summary.salesGstCollected.toFixed(2),
    summary.invoiceTotalInclGst.toFixed(2),
    summary.freeValueAtPtr.toFixed(2),
    summary.freeStripCost.toFixed(2),
    summary.purchaseCostExclGst.toFixed(2),
    summary.purchaseGstPaid.toFixed(2),
    summary.purchaseCashOutlayInclGst.toFixed(2),
    summary.grossProfitAfterInputGstCredit.toFixed(2),
    `${summary.effectiveDoctorPct.toFixed(1)}%`,
    summary.doctorCommission.toFixed(2),
    summary.lineItemNetProfitBeforeOtherCharges.toFixed(2),
    summary.billedSalesExclGst > 0
      ? `${((summary.lineItemNetProfitBeforeOtherCharges / summary.billedSalesExclGst) * 100).toFixed(1)}%`
      : "0.0%",
  ]);

  push([]);
  push(["Earnings Summary", "Amount / %"]);
  for (const m of summaryMetricsList(assumptions, summary)) {
    push([m.label, m.isPct ? `${m.value.toFixed(1)}%` : m.value.toFixed(2)]);
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function downloadProfitTestingCsv(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary
): void {
  const csv = buildProfitTestingCsv(assumptions, rows, summary);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, `Profit_Testing_Sheet_${new Date().toISOString().slice(0, 10)}.csv`);
}

/** Builds a clean structured JSON snapshot for integrations or audit archives. */
export function buildProfitTestingJson(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary,
  catalogComparison?: ProfitTestingSummary | null
): string {
  return JSON.stringify(
    {
      reportTitle: "Profit Testing Sheet — Trend MR Pharma OS",
      exportedAt: new Date().toISOString(),
      assumptions,
      summary,
      catalogPurchaseRateComparison: catalogComparison ?? null,
      rows,
    },
    null,
    2
  );
}

export function downloadProfitTestingJson(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary,
  catalogComparison?: ProfitTestingSummary | null
): void {
  const json = buildProfitTestingJson(assumptions, rows, summary, catalogComparison);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  triggerBlobDownload(blob, `Profit_Testing_Sheet_${new Date().toISOString().slice(0, 10)}.json`);
}

/** Builds a self-contained formatted HTML financial statement ready to print or email. */
export function buildProfitTestingHtml(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary,
  catalogComparison?: ProfitTestingSummary | null
): string {
  const metrics = summaryMetricsList(assumptions, summary);
  const bodyRows = rows
    .map(
      (r) => `
      <tr>
        <td class="c">${r.no}</td>
        <td class="l input">${escapeHtmlText(r.item || "-")}</td>
        <td class="l">${escapeHtmlText(r.packing || "-")}</td>
        <td class="r input">${r.billedQty}</td>
        <td class="r input">${r.freeQty}</td>
        <td class="r link">${r.totalQty}</td>
        <td class="r">${formatInrText(r.mrp)}</td>
        <td class="r">${formatInrText(r.ptr)}</td>
        <td class="r">${formatInrText(r.costPerStrip)}</td>
        <td class="r input">${formatInrText(r.sellRate)}</td>
        <td class="r link">${formatInrText(r.billedSales)}</td>
        <td class="r link">${formatInrText(r.salesGst)}</td>
        <td class="r link">${formatInrText(r.invoiceTotal)}</td>
        <td class="r link">${formatInrText(r.freeValueAtPtr)}</td>
        <td class="r link">${formatInrText(r.freeStripCost)}</td>
        <td class="r link">${formatInrText(r.purchaseCost)}</td>
        <td class="r link">${formatInrText(r.purchaseGst)}</td>
        <td class="r link">${formatInrText(r.cashOutlayInclGst)}</td>
        <td class="r link ${r.grossProfit < 0 ? "neg" : "pos"}">${formatInrText(r.grossProfit)}</td>
        <td class="r input">${r.doctorPct.toFixed(1)}%</td>
        <td class="r link">${formatInrText(r.doctorCost)}</td>
        <td class="r link ${r.netProfit < 0 ? "neg" : "pos"}">${formatInrText(r.netProfit)}</td>
        <td class="r link ${r.netMarginPct < 0 ? "neg" : "pos"}">${r.netMarginPct.toFixed(1)}%</td>
      </tr>`
    )
    .join("");

  const summaryHtml = metrics
    .map(
      (m) => `
      <tr class="${m.bold ? "bold" : ""}">
        <td>${escapeHtmlText(m.label)}</td>
        <td class="r ${m.value < 0 ? "neg" : "pos"}">${m.isPct ? `${m.value.toFixed(1)}%` : formatInrText(m.value)}</td>
      </tr>`
    )
    .join("");

  const compHtml = catalogComparison
    ? `<div class="card">
        <h3>Catalog Purchase Rate Comparison</h3>
        <table>
          <tr><td>Actual Purchase Cost Excl. GST</td><td class="r"><strong>${formatInrText(catalogComparison.purchaseCostExclGst)}</strong></td></tr>
          <tr><td>Actual Gross Profit</td><td class="r ${catalogComparison.grossProfitAfterInputGstCredit < 0 ? "neg" : "pos"}"><strong>${formatInrText(catalogComparison.grossProfitAfterInputGstCredit)}</strong></td></tr>
          <tr><td>Actual Net Profit / Earnings</td><td class="r ${catalogComparison.netProfitEarnings < 0 ? "neg" : "pos"}"><strong>${formatInrText(catalogComparison.netProfitEarnings)} (${catalogComparison.netMarginPct.toFixed(1)}%)</strong></td></tr>
        </table>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Profit Testing Sheet — Trend MR Pharma OS</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #0f172a; margin: 20px; background: #f8fafc; font-size: 11px; }
  .banner { background: #0f172a; color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 14px; }
  .banner h1 { margin: 0; font-size: 20px; }
  .banner p { margin: 4px 0 0; color: #cbd5e1; font-size: 11px; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
  .card h3 { margin: 0 0 8px; font-size: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; }
  .kv { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
  table { width: 100%; border-collapse: collapse; background: #fff; margin-bottom: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; white-space: nowrap; }
  thead th { background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; }
  .super th { background: #1e293b; color: #93c5fd; font-size: 9px; letter-spacing: 0.06em; }
  tfoot td { background: #e2e8f0; font-weight: 700; }
  .l { text-align: left; } .c { text-align: center; } .r { text-align: right; font-variant-numeric: tabular-nums; }
  .input { background: #fef3c7; color: #0c4a6e; font-weight: 600; }
  .link { background: #ecfdf5; }
  .neg { color: #b91c1c; font-weight: 700; } .pos { color: #065f46; font-weight: 700; }
  .bold td { font-weight: 700; background: #f1f5f9; }
  .bottom { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; align-items: start; }
</style>
</head>
<body>
  <div class="banner">
    <h1>Profit Testing Sheet — Trend MR Pharma OS</h1>
    <p>Generated ${escapeHtmlText(new Date().toLocaleString("en-IN"))} · Cost Basis: ${escapeHtmlText(assumptions.costBasisMode)} · Sell Basis: ${escapeHtmlText(assumptions.sellingPriceBasis)} · Tax: ${escapeHtmlText(summary.taxTreatmentLabel)}</p>
  </div>
  <div class="grid">
    <div class="card"><h3>Key Assumptions</h3>
      <div class="kv"><span>Doctor commission %</span><strong>${assumptions.doctorCommissionPct.toFixed(1)}%</strong></div>
      <div class="kv"><span>Other charges</span><strong>${formatInrText(assumptions.otherCharges)}</strong></div>
    </div>
    <div class="card"><h3>GST Rates</h3>
      <div class="kv"><span>Purchase GST %</span><strong>${assumptions.purchaseGstPct.toFixed(1)}%</strong></div>
      <div class="kv"><span>Sales GST %</span><strong>${assumptions.salesGstPct.toFixed(1)}%</strong></div>
    </div>
    <div class="card"><h3>Totals Headline</h3>
      <div class="kv"><span>Billed Sales Excl. GST</span><strong>${formatInrText(summary.billedSalesExclGst)}</strong></div>
      <div class="kv"><span>Net Profit / Earnings</span><strong class="${summary.netProfitEarnings < 0 ? "neg" : "pos"}">${formatInrText(summary.netProfitEarnings)} (${summary.netMarginPct.toFixed(1)}%)</strong></div>
    </div>
  </div>
  <table>
    <thead>
      <tr class="super"><th colspan="3">Item Details</th><th colspan="3">Quantities</th><th colspan="4">Pricing &amp; Cost Basis</th><th colspan="3">Sales &amp; Output GST</th><th colspan="2">Free Scheme</th><th colspan="3">Purchase &amp; Input GST</th><th colspan="5">Profit &amp; Doctor Economics</th></tr>
      <tr><th>No.</th><th>Item</th><th>Packing</th><th>Billed</th><th>Free</th><th>Total</th><th>MRP</th><th>PTR</th><th>Cost/Strip</th><th>Sell Rate</th><th>Billed Sales</th><th>Sales GST</th><th>Invoice Total</th><th>Free @ PTR</th><th>Free Cost</th><th>Purchase Cost</th><th>Purch GST</th><th>Cash Outlay</th><th>Gross Profit</th><th>Doc %</th><th>Doc Cost</th><th>Net Profit</th><th>Margin</th></tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td class="c">Σ</td><td class="l">LINE TOTAL (${summary.activeRowsCount} SKUs)</td><td></td>
        <td class="r">${summary.totalBilledQty}</td><td class="r">${summary.totalFreeQty}</td><td class="r">${summary.totalQty}</td>
        <td colspan="4" class="r">Before Other Charges →</td>
        <td class="r">${formatInrText(summary.billedSalesExclGst)}</td><td class="r">${formatInrText(summary.salesGstCollected)}</td><td class="r">${formatInrText(summary.invoiceTotalInclGst)}</td>
        <td class="r">${formatInrText(summary.freeValueAtPtr)}</td><td class="r">${formatInrText(summary.freeStripCost)}</td>
        <td class="r">${formatInrText(summary.purchaseCostExclGst)}</td><td class="r">${formatInrText(summary.purchaseGstPaid)}</td><td class="r">${formatInrText(summary.purchaseCashOutlayInclGst)}</td>
        <td class="r ${summary.grossProfitAfterInputGstCredit < 0 ? "neg" : "pos"}">${formatInrText(summary.grossProfitAfterInputGstCredit)}</td>
        <td class="r">${summary.effectiveDoctorPct.toFixed(1)}%</td><td class="r">${formatInrText(summary.doctorCommission)}</td>
        <td class="r ${summary.lineItemNetProfitBeforeOtherCharges < 0 ? "neg" : "pos"}">${formatInrText(summary.lineItemNetProfitBeforeOtherCharges)}</td>
        <td class="r">${summary.billedSalesExclGst > 0 ? ((summary.lineItemNetProfitBeforeOtherCharges / summary.billedSalesExclGst) * 100).toFixed(1) : "0.0"}%</td>
      </tr>
    </tfoot>
  </table>
  <div class="bottom">
    <div class="card"><h3>Earnings Summary</h3><table>${summaryHtml}</table></div>
    ${compHtml}
  </div>
</body>
</html>`;
}

export function downloadProfitTestingHtml(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary,
  catalogComparison?: ProfitTestingSummary | null
): void {
  const html = buildProfitTestingHtml(assumptions, rows, summary, catalogComparison);
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  triggerBlobDownload(blob, `Profit_Testing_Sheet_${new Date().toISOString().slice(0, 10)}.html`);
}

/**
 * Generates and downloads a formatted 2-sheet live-formula Excel (.xlsx) workbook
 * matching the Blue/Yellow input and Green linked-value convention without column clipping.
 */
export async function downloadProfitTestingExcel(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary,
  catalogComparison?: ProfitTestingSummary | null
): Promise<void> {
  const ExcelJSRuntime = (await import("exceljs")).default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "Trend MR Pharma OS";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet("Profit Testing Sheet", {
    views: [{ state: "frozen", ySplit: 9, xSplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const BLUE_INPUT_FILL = "DBEAFE";
  const AMBER_INPUT_FILL = "FEF3C7";
  const GREEN_LINK_FILL = "ECFDF5";
  const NAVY_FILL = "0F172A";
  const SUPER_NAVY_FILL = "1E293B";
  const SLATE_SUB_FILL = "F1F5F9";
  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "CBD5E1" } },
    left: { style: "thin", color: { argb: "CBD5E1" } },
    bottom: { style: "thin", color: { argb: "CBD5E1" } },
    right: { style: "thin", color: { argb: "CBD5E1" } },
  };
  const RUPEE_FMT = '₹#,##0.00;(₹#,##0.00);"-"';
  const PCT_FMT = "0.0%";

  // Title + Subtitle (Rows 1-2)
  ws.mergeCells("A1:W1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "Profit Testing Sheet — Trend MR Pharma OS";
  titleCell.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:W2");
  const subCell = ws.getCell("A2");
  subCell.value =
    "Blue/amber cells are editable inputs. Green cells are linked formula values. Purchase & Sales GST are separated so profit, cash outlay, and input tax credit stay clear.";
  subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 22;

  // Key Assumptions Section (Rows 4-6) placed in wide columns (never Column A width 6!)
  ws.mergeCells("B4:F4");
  ws.getCell("B4").value = "KEY ASSUMPTIONS";
  ws.getCell("B4").font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "0F172A" } };
  ws.getRow(4).height = 22;

  ws.getCell("B5").value = "Doctor commission %";
  ws.getCell("C5").value = assumptions.doctorCommissionPct / 100;
  ws.getCell("C5").numFmt = PCT_FMT;
  ws.getCell("C5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.mergeCells("D5:E5");
  ws.getCell("D5").value = "Purchase GST %";
  ws.getCell("F5").value = assumptions.purchaseGstPct / 100;
  ws.getCell("F5").numFmt = PCT_FMT;
  ws.getCell("F5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.mergeCells("G5:H5");
  ws.getCell("G5").value = "Tax treatment";
  ws.mergeCells("I5:L5");
  ws.getCell("I5").value = summary.taxTreatmentLabel;
  ws.getCell("I5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_INPUT_FILL } };

  ws.getCell("B6").value = "Other charges (₹)";
  ws.getCell("C6").value = assumptions.otherCharges;
  ws.getCell("C6").numFmt = RUPEE_FMT;
  ws.getCell("C6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_INPUT_FILL } };

  ws.mergeCells("D6:E6");
  ws.getCell("D6").value = "Sales GST %";
  ws.getCell("F6").value = assumptions.salesGstPct / 100;
  ws.getCell("F6").numFmt = PCT_FMT;
  ws.getCell("F6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.mergeCells("G6:H6");
  ws.getCell("G6").value = "Cost / Selling basis";
  ws.mergeCells("I6:L6");
  ws.getCell("I6").value = `${assumptions.costBasisMode} / ${assumptions.sellingPriceBasis} per strip`;
  ws.getCell("I6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };

  for (const rNum of [5, 6]) {
    const r = ws.getRow(rNum);
    r.height = 22;
    for (let col = 2; col <= 12; col++) {
      const c = r.getCell(col);
      c.border = THIN_BORDER;
      const isValue = [3, 6, 9, 10, 11, 12].includes(col);
      c.font = { name: "Segoe UI", size: 10, bold: isValue };
      c.alignment = { vertical: "middle", horizontal: col === 3 || col === 6 ? "right" : "left" };
    }
  }

  // Row 8: Section Super-Headers
  const superGroups: Array<[string, string]> = [
    ["A8:C8", "ITEM DETAILS"],
    ["D8:F8", "QUANTITIES"],
    ["G8:J8", "PRICING & COST RATE"],
    ["K8:M8", "REVENUE & OUTPUT GST"],
    ["N8:O8", "FREE SCHEME"],
    ["P8:R8", "PURCHASE & INPUT GST"],
    ["S8:W8", "PROFIT & DOCTOR PAYOUT"],
  ];
  ws.getRow(8).height = 20;
  for (const [range, label] of superGroups) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = label;
    cell.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "93C5FD" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUPER_NAVY_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  }

  // Row 9: Table Headers
  const headers = [
    "No.",
    "Item",
    "Packing",
    "Billed Qty",
    "Free Qty",
    "Total Qty",
    "MRP",
    "PTR",
    "Cost / Strip",
    "Sell Rate",
    "Billed Sales",
    "Sales GST",
    "Invoice Total",
    "Free Value @ PTR",
    "Free Strip Cost",
    "Purchase Cost",
    "Purchase GST",
    "Cash Outlay Incl. GST",
    "Gross Profit",
    "Doctor %",
    "Doctor Cost",
    "Net Profit",
    "Net Margin",
  ];
  const hdrRow = ws.getRow(9);
  hdrRow.values = headers;
  hdrRow.height = 30;
  hdrRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });

  const firstDataRow = 10;
  const isRecoverable = assumptions.taxTreatment === "RECOVERABLE_ITC";

  rows.forEach((row, idx) => {
    const rIdx = firstDataRow + idx;
    const xlRow = ws.getRow(rIdx);
    xlRow.height = 21;
    xlRow.getCell(1).value = row.no;
    xlRow.getCell(2).value = row.item || "";
    xlRow.getCell(3).value = row.packing || "";
    xlRow.getCell(4).value = row.billedQty || 0;
    xlRow.getCell(5).value = row.freeQty || 0;
    xlRow.getCell(6).value = { formula: `D${rIdx}+E${rIdx}`, result: row.totalQty };
    xlRow.getCell(7).value = row.mrp || 0;
    xlRow.getCell(8).value = row.ptr || 0;

    if (row.costPerStripOverride === null && assumptions.costBasisMode === "PTR") {
      xlRow.getCell(9).value = { formula: `H${rIdx}`, result: row.costPerStrip };
    } else {
      xlRow.getCell(9).value = row.costPerStrip || 0;
    }

    if (row.sellRateOverride === null && assumptions.sellingPriceBasis === "PTR") {
      xlRow.getCell(10).value = { formula: `H${rIdx}`, result: row.sellRate };
    } else if (row.sellRateOverride === null && assumptions.sellingPriceBasis === "MRP") {
      xlRow.getCell(10).value = { formula: `G${rIdx}`, result: row.sellRate };
    } else {
      xlRow.getCell(10).value = row.sellRate || 0;
    }

    xlRow.getCell(11).value = { formula: `D${rIdx}*J${rIdx}`, result: row.billedSales };
    xlRow.getCell(12).value = { formula: `K${rIdx}*$F$6`, result: row.salesGst };
    xlRow.getCell(13).value = { formula: `K${rIdx}+L${rIdx}`, result: row.invoiceTotal };
    xlRow.getCell(14).value = { formula: `E${rIdx}*H${rIdx}`, result: row.freeValueAtPtr };
    xlRow.getCell(15).value = { formula: `E${rIdx}*I${rIdx}`, result: row.freeStripCost };
    xlRow.getCell(16).value = { formula: `F${rIdx}*I${rIdx}`, result: row.purchaseCost };
    xlRow.getCell(17).value = { formula: `P${rIdx}*$F$5`, result: row.purchaseGst };
    xlRow.getCell(18).value = { formula: `P${rIdx}+Q${rIdx}`, result: row.cashOutlayInclGst };
    xlRow.getCell(19).value = {
      formula: isRecoverable ? `K${rIdx}-P${rIdx}` : `K${rIdx}-R${rIdx}`,
      result: row.grossProfit,
    };

    if (row.doctorPctOverride === null) {
      xlRow.getCell(20).value = { formula: `$C$5`, result: (row.doctorPct || 0) / 100 };
    } else {
      xlRow.getCell(20).value = (row.doctorPct || 0) / 100;
    }

    xlRow.getCell(21).value = { formula: `K${rIdx}*T${rIdx}`, result: row.doctorCost };
    xlRow.getCell(22).value = { formula: `S${rIdx}-U${rIdx}`, result: row.netProfit };
    xlRow.getCell(23).value = {
      formula: `IF(K${rIdx}>0,V${rIdx}/K${rIdx},0)`,
      result: (row.netMarginPct || 0) / 100,
    };

    const rupeeCols = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22];
    const inputCols = [2, 4, 5, 10, 20];
    const linkedCols = [6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23];

    for (let c = 1; c <= 23; c++) {
      const cell = xlRow.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 1 ? "center" : c === 2 || c === 3 ? "left" : "right",
      };
      if (rupeeCols.includes(c)) cell.numFmt = RUPEE_FMT;
      if (c === 20 || c === 23) cell.numFmt = PCT_FMT;
      if (inputCols.includes(c)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };
      } else if (linkedCols.includes(c)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };
      }
      if ((c === 19 && row.grossProfit < 0) || (c === 22 && row.netProfit < 0) || (c === 23 && row.netMarginPct < 0)) {
        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "B91C1C" } };
      }
    }
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + rows.length - 1);
  const totalRowIdx = rows.length > 0 ? firstDataRow + rows.length : firstDataRow;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.getCell(1).value = "Σ";
  totalRow.getCell(2).value = `LINE TOTAL (${summary.activeRowsCount} SKUs)`;
  if (rows.length > 0) {
    for (const colIdx of [4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22]) {
      const colLetter = ws.getColumn(colIdx).letter;
      totalRow.getCell(colIdx).value = {
        formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
      };
    }
    totalRow.getCell(20).value = {
      formula: `IF(K${totalRowIdx}>0,U${totalRowIdx}/K${totalRowIdx},0)`,
      result: summary.effectiveDoctorPct / 100,
    };
    totalRow.getCell(23).value = {
      formula: `IF(K${totalRowIdx}>0,V${totalRowIdx}/K${totalRowIdx},0)`,
      result: summary.netMarginPct / 100,
    };
  }
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 1 ? "center" : colNumber === 2 || colNumber === 3 ? "left" : "right",
    };
    if (colNumber >= 11 && colNumber <= 22 && colNumber !== 20) cell.numFmt = RUPEE_FMT;
    if (colNumber === 20 || colNumber === 23) cell.numFmt = PCT_FMT;
  });

  // Enhanced CFO Earnings & Cash Flow Statement (Sheet 1, Columns A..H) + Unit Economics & Break-Even KPIs (Columns J..P)
  const hasRows = rows.length > 0;
  const sumStart = totalRowIdx + 2;

  ws.mergeCells(`A${sumStart}:B${sumStart}`);
  ws.getCell(`A${sumStart}`).value = "EARNINGS & CASH FLOW STATEMENT";
  ws.getCell(`C${sumStart}`).value = "AMOUNT / VALUE";
  ws.getCell(`D${sumStart}`).value = "% OF SALES";
  ws.mergeCells(`E${sumStart}:H${sumStart}`);
  ws.getCell(`E${sumStart}`).value = "EXCEL FORMULA AUDIT";
  for (let col = 1; col <= 8; col++) {
    const c = ws.getCell(sumStart, col);
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
    c.alignment = { vertical: "middle", horizontal: col === 3 || col === 4 ? "right" : "left", indent: col <= 2 || col >= 5 ? 1 : 0 };
    c.border = THIN_BORDER;
  }

  ws.mergeCells(`J${sumStart}:L${sumStart}`);
  ws.getCell(`J${sumStart}`).value = "UNIT ECONOMICS & BREAK-EVEN KPIs";
  ws.getCell(`M${sumStart}`).value = "VALUE";
  ws.mergeCells(`N${sumStart}:P${sumStart}`);
  ws.getCell(`N${sumStart}`).value = "BENCHMARK / FORMULA NOTE";
  for (let col = 10; col <= 16; col++) {
    const c = ws.getCell(sumStart, col);
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUPER_NAVY_FILL } };
    c.alignment = { vertical: "middle", horizontal: col === 13 ? "right" : "left", indent: col !== 13 ? 1 : 0 };
    c.border = THIN_BORDER;
  }
  ws.getRow(sumStart).height = 24;

  // Deterministic row allocation so internal formulas & Sheet 2 cross-references stay 100% aligned
  let cursor = sumStart + 1;
  const sec1Row = cursor++;
  const rBilledSales = cursor++;
  const rSalesGst = cursor++;
  const rInvoiceTotal = cursor++;
  const rFreeVal = cursor++;

  const sec2Row = cursor++;
  const rBilledUnitCost = cursor++;
  const rFreeCost = cursor++;
  const rPurchaseCost = cursor++;
  const rPurchaseGst = cursor++;
  const rCashOutlay = cursor++;
  const rGrossProfit = cursor++;
  const rGrossMargin = cursor++;

  const sec3Row = cursor++;
  const rDocComm = cursor++;
  const rLineNet = cursor++;
  const rOtherCharges = cursor++;
  const rNetProfit = cursor++;
  const rNetMargin = cursor++;
  const rReturnOnCost = cursor++;

  const sec4Row = cursor++;
  const rCashEarnings = cursor++;
  const rItcCredit = cursor++;
  const rNetGstPos = cursor++;

  const pnlCostRef = isRecoverable ? `C${rPurchaseCost}` : `C${rCashOutlay}`;

  type SummarySheetEntry =
    | { kind: "section"; rIdx: number; title: string }
    | {
        kind: "row";
        key: string;
        rIdx: number;
        label: string;
        formula: string;
        result: number;
        compVal?: number | null;
        fmt: string;
        isPct?: boolean;
        showPctOfSales?: boolean;
        bold?: boolean;
        highlight?: "profit" | "cash" | "neutral";
        note: string;
      };

  const getCompField = (picker: (s: ProfitTestingSummary) => number): number | null =>
    catalogComparison ? picker(catalogComparison) : null;

  const summaryEntries: SummarySheetEntry[] = [
    { kind: "section", rIdx: sec1Row, title: "1. REVENUE & SCHEME IMPACT" },
    {
      kind: "row",
      key: "billedSales",
      rIdx: rBilledSales,
      label: "Billed sales excl. GST",
      formula: hasRows ? `K${totalRowIdx}` : "0",
      result: summary.billedSalesExclGst,
      compVal: getCompField((s) => s.billedSalesExclGst),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      note: "Net taxable revenue across billed strips",
    },
    {
      kind: "row",
      key: "salesGst",
      rIdx: rSalesGst,
      label: `Sales GST collected (${assumptions.salesGstPct}%)`,
      formula: hasRows ? `L${totalRowIdx}` : "0",
      result: summary.salesGstCollected,
      compVal: getCompField((s) => s.salesGstCollected),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Output GST collected from stockist (govt liability)",
    },
    {
      kind: "row",
      key: "invoiceTotal",
      rIdx: rInvoiceTotal,
      label: "Invoice total incl. GST",
      formula: `C${rBilledSales}+C${rSalesGst}`,
      result: summary.invoiceTotalInclGst,
      compVal: getCompField((s) => s.invoiceTotalInclGst),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      note: "Total customer invoice receivable",
    },
    {
      kind: "row",
      key: "freeVal",
      rIdx: rFreeVal,
      label: "Free value @ PTR (not billed)",
      formula: hasRows ? `N${totalRowIdx}` : "0",
      result: summary.freeValueAtPtr,
      compVal: getCompField((s) => s.freeValueAtPtr),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Commercial value of scheme strips @ PTR",
    },
    { kind: "section", rIdx: sec2Row, title: "2. COGS & INPUT TAX RECONCILIATION" },
    {
      kind: "row",
      key: "billedUnitCost",
      rIdx: rBilledUnitCost,
      label: "Billed units cost (excl. GST)",
      formula: hasRows ? `P${totalRowIdx}-O${totalRowIdx}` : "0",
      result: summary.billedUnitsCost,
      compVal: getCompField((s) => s.billedUnitsCost),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Direct inventory cost of revenue-generating strips",
    },
    {
      kind: "row",
      key: "freeCost",
      rIdx: rFreeCost,
      label: "Free strip cost (scheme burden)",
      formula: hasRows ? `O${totalRowIdx}` : "0",
      result: summary.freeStripCost,
      compVal: getCompField((s) => s.freeStripCost),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Cost absorbed on promotional free strips",
    },
    {
      kind: "row",
      key: "purchaseCost",
      rIdx: rPurchaseCost,
      label: "Total purchase cost excl. GST",
      formula: hasRows ? `P${totalRowIdx}` : "0",
      result: summary.purchaseCostExclGst,
      compVal: getCompField((s) => s.purchaseCostExclGst),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      note: "Total COGS before GST (billed + free units)",
    },
    {
      kind: "row",
      key: "purchaseGst",
      rIdx: rPurchaseGst,
      label: `Purchase GST paid (${assumptions.purchaseGstPct}%)`,
      formula: hasRows ? `Q${totalRowIdx}` : "0",
      result: summary.purchaseGstPaid,
      compVal: getCompField((s) => s.purchaseGstPaid),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Input GST paid on total purchase qty",
    },
    {
      kind: "row",
      key: "cashOutlay",
      rIdx: rCashOutlay,
      label: "Purchase cash outlay incl. GST",
      formula: `C${rPurchaseCost}+C${rPurchaseGst}`,
      result: summary.purchaseCashOutlayInclGst,
      compVal: getCompField((s) => s.purchaseCashOutlayInclGst),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Immediate supplier payment incl. GST",
    },
    {
      kind: "row",
      key: "grossProfit",
      rIdx: rGrossProfit,
      label: isRecoverable
        ? "Gross profit after input GST credit"
        : "Gross profit after non-recoverable GST",
      formula: `C${rBilledSales}-${pnlCostRef}`,
      result: summary.grossProfitAfterInputGstCredit,
      compVal: getCompField((s) => s.grossProfitAfterInputGstCredit),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      highlight: "profit",
      note: isRecoverable
        ? "Billed sales less Purchase cost excl. GST"
        : "Billed sales less Purchase outlay incl. GST",
    },
    {
      kind: "row",
      key: "grossMargin",
      rIdx: rGrossMargin,
      label: "Gross margin (% of Billed Sales)",
      formula: `IF(C${rBilledSales}>0,C${rGrossProfit}/C${rBilledSales},0)`,
      result: summary.grossMarginPct / 100,
      compVal: getCompField((s) => s.grossMarginPct),
      fmt: PCT_FMT,
      isPct: true,
      note: "Gross contribution ratio prior to doctor payout",
    },
    { kind: "section", rIdx: sec3Row, title: "3. OPERATING DEDUCTIONS & P&L" },
    {
      kind: "row",
      key: "docComm",
      rIdx: rDocComm,
      label: `Doctor commission (${summary.effectiveDoctorPct.toFixed(1)}% eff.)`,
      formula: hasRows ? `U${totalRowIdx}` : "0",
      result: summary.doctorCommission,
      compVal: getCompField((s) => s.doctorCommission),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Aggregate doctor commission across SKUs",
    },
    {
      kind: "row",
      key: "lineNet",
      rIdx: rLineNet,
      label: "Line-item net profit (before other charges)",
      formula: `C${rGrossProfit}-C${rDocComm}`,
      result: summary.lineItemNetProfitBeforeOtherCharges,
      compVal: getCompField((s) => s.lineItemNetProfitBeforeOtherCharges),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Contribution remaining for fixed/field overheads",
    },
    {
      kind: "row",
      key: "otherCharges",
      rIdx: rOtherCharges,
      label: "Less: Other charges",
      formula: `C6`,
      result: summary.otherCharges,
      compVal: getCompField((s) => s.otherCharges),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: "Scheme freight, promo & batch overhead",
    },
    {
      kind: "row",
      key: "netProfit",
      rIdx: rNetProfit,
      label: "Net profit / earnings",
      formula: `C${rLineNet}-C${rOtherCharges}`,
      result: summary.netProfitEarnings,
      compVal: getCompField((s) => s.netProfitEarnings),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      highlight: "profit",
      note: "Bottom-line GAAP batch profit after all expenses",
    },
    {
      kind: "row",
      key: "netMargin",
      rIdx: rNetMargin,
      label: "Net margin (% of Billed Sales)",
      formula: `IF(C${rBilledSales}>0,C${rNetProfit}/C${rBilledSales},0)`,
      result: summary.netMarginPct / 100,
      compVal: getCompField((s) => s.netMarginPct),
      fmt: PCT_FMT,
      isPct: true,
      bold: true,
      note: "Final net margin on net billed revenue",
    },
    {
      kind: "row",
      key: "returnOnCost",
      rIdx: rReturnOnCost,
      label: "Return on total operating cost",
      formula: `IF((${pnlCostRef}+C${rDocComm}+C${rOtherCharges})>0,C${rNetProfit}/(${pnlCostRef}+C${rDocComm}+C${rOtherCharges}),0)`,
      result: summary.returnOnTotalCostPct / 100,
      compVal: getCompField((s) => s.returnOnTotalCostPct),
      fmt: PCT_FMT,
      isPct: true,
      note: "Net profit divided by total batch cost base",
    },
    { kind: "section", rIdx: sec4Row, title: "4. CASH FLOW & GST POSITION" },
    {
      kind: "row",
      key: "cashEarnings",
      rIdx: rCashEarnings,
      label: "Cash earnings before input GST credit",
      formula: isRecoverable ? `C${rNetProfit}-C${rPurchaseGst}` : `C${rNetProfit}`,
      result: summary.cashEarningsBeforeInputGstCredit,
      compVal: getCompField((s) => s.cashEarningsBeforeInputGstCredit),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      highlight: "cash",
      note: "Immediate cash surplus/(deficit) prior to ITC claim",
    },
    {
      kind: "row",
      key: "itcCredit",
      rIdx: rItcCredit,
      label: "Input GST credit (Recoverable ITC)",
      formula: isRecoverable ? `C${rPurchaseGst}` : "0",
      result: summary.inputGstCredit,
      compVal: getCompField((s) => s.inputGstCredit),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      note: isRecoverable ? "Claimable input credit reducing net GST" : "Expensed into COGS (no ITC)",
    },
    {
      kind: "row",
      key: "netGstPos",
      rIdx: rNetGstPos,
      label: "Net GST payable / (ITC credit carryforward)",
      formula: `C${rSalesGst}-C${rItcCredit}`,
      result: summary.netGstPosition,
      compVal: getCompField((s) => s.netGstPosition),
      fmt: RUPEE_FMT,
      showPctOfSales: true,
      bold: true,
      highlight: "cash",
      note: "Output GST less recoverable ITC; negative = credit carryforward",
    },
  ];

  summaryEntries.forEach((entry) => {
    const r = ws.getRow(entry.rIdx);
    if (entry.kind === "section") {
      r.height = 19;
      ws.mergeCells(`A${entry.rIdx}:H${entry.rIdx}`);
      const sc = r.getCell(1);
      sc.value = entry.title;
      sc.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "1E293B" } };
      sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
      sc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      for (let col = 1; col <= 8; col++) r.getCell(col).border = THIN_BORDER;
      return;
    }

    r.height = entry.bold ? 22 : 20;
    ws.mergeCells(`A${entry.rIdx}:B${entry.rIdx}`);
    r.getCell(1).value = entry.label;
    r.getCell(1).font = { name: "Segoe UI", size: 9.5, bold: Boolean(entry.bold), color: { argb: "0F172A" } };
    r.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const valCell = r.getCell(3);
    valCell.value = { formula: entry.formula, result: entry.result };
    valCell.numFmt = entry.fmt;
    valCell.font = {
      name: "Segoe UI",
      size: 9.5,
      bold: Boolean(entry.bold),
      color: { argb: entry.result < -0.0001 ? "B91C1C" : "065F46" },
    };
    valCell.alignment = { vertical: "middle", horizontal: "right" };
    valCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          entry.highlight === "profit"
            ? entry.result < 0
              ? "FEE2E2"
              : "DCFCE7"
            : entry.highlight === "cash"
            ? "E0F2FE"
            : GREEN_LINK_FILL,
      },
    };

    const pctCell = r.getCell(4);
    if (entry.showPctOfSales) {
      const salesDenom = summary.billedSalesExclGst;
      const pctRes = salesDenom > 0 ? entry.result / salesDenom : 0;
      pctCell.value = {
        formula: `IF($C$${rBilledSales}>0,C${entry.rIdx}/$C$${rBilledSales},0)`,
        result: pctRes,
      };
      pctCell.numFmt = PCT_FMT;
      pctCell.font = {
        name: "Segoe UI",
        size: 9,
        bold: Boolean(entry.bold),
        color: { argb: pctRes < -0.0001 ? "B91C1C" : "334155" },
      };
      pctCell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      pctCell.value = "—";
      pctCell.font = { name: "Segoe UI", size: 9, color: { argb: "94A3B8" } };
      pctCell.alignment = { vertical: "middle", horizontal: "center" };
    }

    ws.mergeCells(`E${entry.rIdx}:H${entry.rIdx}`);
    const refCell = r.getCell(5);
    refCell.value = `=${entry.formula}`;
    refCell.font = { name: "Consolas", size: 8.5, color: { argb: "475569" } };
    refCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    for (let col = 1; col <= 8; col++) {
      r.getCell(col).border = THIN_BORDER;
      if (entry.bold && col !== 3) {
        r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
      }
    }
  });

  // Right Panel on Sheet 1: Unit Economics & Break-Even KPIs (Rows sumStart+1..sumStart+7, Cols J..P)
  const rKpiAvgSell = sumStart + 1;
  const rKpiEffReal = sumStart + 2;
  const rKpiDilution = sumStart + 3;
  const rKpiNetPerBilled = sumStart + 4;
  const rKpiNetPerTotal = sumStart + 5;
  const rKpiBreakEven = sumStart + 6;
  const rKpiUplift = sumStart + 7;

  const kpiEntries: Array<{
    rIdx: number;
    label: string;
    formula: string;
    result: number;
    fmt: string;
    isPct?: boolean;
    bold?: boolean;
    note: string;
  }> = [
    {
      rIdx: rKpiAvgSell,
      label: "Avg sell rate / billed strip",
      formula: hasRows ? `IF(D${totalRowIdx}>0,C${rBilledSales}/D${totalRowIdx},0)` : "0",
      result: summary.avgSellRatePerBilledStrip,
      fmt: RUPEE_FMT,
      note: "Weighted avg billed realization per sold strip",
    },
    {
      rIdx: rKpiEffReal,
      label: "Effective realization / total strip",
      formula: hasRows ? `IF(F${totalRowIdx}>0,C${rBilledSales}/F${totalRowIdx},0)` : "0",
      result: summary.effectiveRealizationPerTotalStrip,
      fmt: RUPEE_FMT,
      note: "Billed sales spread across Billed + Free strips",
    },
    {
      rIdx: rKpiDilution,
      label: "Free scheme dilution (% of total qty)",
      formula: hasRows ? `IF(F${totalRowIdx}>0,E${totalRowIdx}/F${totalRowIdx},0)` : "0",
      result: summary.freeDilutionPct / 100,
      fmt: PCT_FMT,
      isPct: true,
      note: "Share of physical stock issued free (0 billing)",
    },
    {
      rIdx: rKpiNetPerBilled,
      label: "Net profit / billed strip",
      formula: hasRows ? `IF(D${totalRowIdx}>0,C${rNetProfit}/D${totalRowIdx},0)` : "0",
      result: summary.netProfitPerBilledStrip,
      fmt: RUPEE_FMT,
      note: "Net bottom-line per billed strip sold",
    },
    {
      rIdx: rKpiNetPerTotal,
      label: "Net profit / total strip (incl. free)",
      formula: hasRows ? `IF(F${totalRowIdx}>0,C${rNetProfit}/F${totalRowIdx},0)` : "0",
      result: summary.netProfitPerTotalStrip,
      fmt: RUPEE_FMT,
      note: "Net bottom-line per physical unit dispatched",
    },
    {
      rIdx: rKpiBreakEven,
      label: "Break-even billed revenue required",
      formula: `IF((1-IF(C${rBilledSales}>0,C${rDocComm}/C${rBilledSales},C5))>0,(${pnlCostRef}+C${rOtherCharges})/(1-IF(C${rBilledSales}>0,C${rDocComm}/C${rBilledSales},C5)),0)`,
      result: summary.breakEvenRevenueRequired ?? 0,
      fmt: RUPEE_FMT,
      bold: true,
      note: "Min billed revenue excl. GST needed for ₹0 profit",
    },
    {
      rIdx: rKpiUplift,
      label: "Revenue / price uplift to break even",
      formula: `IF(AND(C${rNetProfit}<0,C${rBilledSales}>0,M${rKpiBreakEven}>0),(M${rKpiBreakEven}-C${rBilledSales})/C${rBilledSales},0)`,
      result: (summary.sellRateUpliftPctToBreakEven ?? 0) / 100,
      fmt: PCT_FMT,
      isPct: true,
      bold: true,
      note: "Sell rate uplift required when operating at a loss",
    },
  ];

  kpiEntries.forEach((k) => {
    const r = ws.getRow(k.rIdx);
    ws.mergeCells(`J${k.rIdx}:L${k.rIdx}`);
    r.getCell(10).value = k.label;
    r.getCell(10).font = { name: "Segoe UI", size: 9.5, bold: Boolean(k.bold), color: { argb: "0F172A" } };
    r.getCell(10).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const valCell = r.getCell(13);
    valCell.value = { formula: k.formula, result: k.result };
    valCell.numFmt = k.fmt;
    valCell.font = {
      name: "Segoe UI",
      size: 9.5,
      bold: Boolean(k.bold),
      color: { argb: k.result < -0.0001 ? "B91C1C" : "065F46" },
    };
    valCell.alignment = { vertical: "middle", horizontal: "right" };
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };

    ws.mergeCells(`N${k.rIdx}:P${k.rIdx}`);
    r.getCell(14).value = k.note;
    r.getCell(14).font = { name: "Segoe UI", size: 8.5, color: { argb: "475569" } };
    r.getCell(14).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    for (let col = 10; col <= 16; col++) {
      r.getCell(col).border = THIN_BORDER;
      if (k.bold && col !== 13) {
        r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
      }
    }
  });

  // Right Panel Continued: HOW TO USE & FORMULA GUIDE (Starting Row sumStart + 9)
  const howHeaderRow = sumStart + 9;
  ws.mergeCells(`J${howHeaderRow}:P${howHeaderRow}`);
  ws.getCell(`J${howHeaderRow}`).value = "HOW TO USE THIS LIVE FORMULA MODEL";
  for (let col = 10; col <= 16; col++) {
    const c = ws.getCell(howHeaderRow, col);
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.border = THIN_BORDER;
  }

  const howToUseLines = [
    "1. Blue/amber cells (Doctor % C5, Other charges C6, GST F5/F6, Qty D/E, Sell Rate J) drive all green cells.",
    "2. Green cells recalculate in real time across Sheet 1 & Sheet 2 ('Executive Summary').",
    "3. Overwrite Sell Rate (Col J) or Cost/Strip (Col I) per SKU to stress-test discounts or scheme ratios.",
    "4. Purchase GST is separated from COGS when ITC Recoverable is active and reconciled in Section 4.",
    "5. Break-Even Billed Revenue tells you minimum sales excl. GST needed to absorb schemes, doctor % & fixed costs.",
  ];
  howToUseLines.forEach((line, idx) => {
    const rIdx = howHeaderRow + 1 + idx;
    ws.mergeCells(`J${rIdx}:P${rIdx}`);
    const cell = ws.getCell(rIdx, 10);
    cell.value = line;
    cell.font = { name: "Segoe UI", size: 9, color: { argb: "334155" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    for (let col = 10; col <= 16; col++) ws.getCell(rIdx, col).border = THIN_BORDER;
  });

  // Generous non-truncating widths so currency values & CFO labels never display ###
  const widths = [6, 36, 18, 13, 12, 12, 13, 13, 18, 14, 16, 14, 18, 17, 16, 16, 14, 20, 16, 12, 15, 16, 13];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  // Sheet 2: Executive Financial Statement (100% live cross-sheet OpenXML links to Sheet 1)
  const sheet1Ref = `'Profit Testing Sheet'`;
  const wsExec = wb.addWorksheet("Executive Summary", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  wsExec.mergeCells("A1:F1");
  wsExec.getCell("A1").value = "Profit Testing — Executive P&L, Cash Flow & Cost Basis Comparison";
  wsExec.getCell("A1").font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  wsExec.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
  wsExec.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsExec.getRow(1).height = 28;

  // Live Assumption Strip on Sheet 2 (Rows 2-3, linked directly to Sheet 1)
  const assumptionLinks: Array<{ row: number; labelCol: number; label: string; valCol: number; formula: string; result: number | string; fmt?: string }> = [
    { row: 2, labelCol: 1, label: "Doctor Commission %", valCol: 2, formula: `${sheet1Ref}!C5`, result: assumptions.doctorCommissionPct / 100, fmt: PCT_FMT },
    { row: 2, labelCol: 3, label: "Purchase GST %", valCol: 4, formula: `${sheet1Ref}!F5`, result: assumptions.purchaseGstPct / 100, fmt: PCT_FMT },
    { row: 2, labelCol: 5, label: "Sales GST %", valCol: 6, formula: `${sheet1Ref}!F6`, result: assumptions.salesGstPct / 100, fmt: PCT_FMT },
    { row: 3, labelCol: 1, label: "Other Charges", valCol: 2, formula: `${sheet1Ref}!C6`, result: assumptions.otherCharges, fmt: RUPEE_FMT },
    { row: 3, labelCol: 3, label: "Tax Treatment", valCol: 4, formula: `${sheet1Ref}!I5`, result: summary.taxTreatmentLabel },
    { row: 3, labelCol: 5, label: "Active Cost / Sell Basis", valCol: 6, formula: `${sheet1Ref}!I6`, result: `${assumptions.costBasisMode} / ${assumptions.sellingPriceBasis}` },
  ];
  for (const rNum of [2, 3]) {
    wsExec.getRow(rNum).height = 21;
  }
  assumptionLinks.forEach((a) => {
    const lc = wsExec.getCell(a.row, a.labelCol);
    lc.value = a.label;
    lc.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "475569" } };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
    lc.border = THIN_BORDER;

    const vc = wsExec.getCell(a.row, a.valCol);
    vc.value = { formula: a.formula, result: a.result };
    if (a.fmt) vc.numFmt = a.fmt;
    vc.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "0F172A" } };
    vc.alignment = { vertical: "middle", horizontal: a.fmt ? "right" : "left" };
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };
    vc.border = THIN_BORDER;
  });

  const execHdrRowIdx = 5;
  const execHdr = wsExec.getRow(execHdrRowIdx);
  execHdr.values = [
    "Executive P&L / Cash Flow Line Item",
    `Active (${assumptions.costBasisMode})`,
    "% of Sales",
    "Catalog Purchase Rate Ref.",
    "Delta vs Catalog",
    "FP&A & Tax Basis Notes",
  ];
  execHdr.height = 24;
  execHdr.eachCell((c) => {
    const colNum = Number(c.col);
    const isNum = colNum >= 2 && colNum <= 5;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUPER_NAVY_FILL } };
    c.alignment = { vertical: "middle", horizontal: isNum ? "right" : "left" };
    c.border = THIN_BORDER;
  });

  const execBilledSalesRow = execHdrRowIdx + 2; // Row 6 = Section 1, Row 7 = Billed sales excl. GST
  let execCursor = execHdrRowIdx + 1;

  summaryEntries.forEach((entry) => {
    const rIdx = execCursor++;
    const row = wsExec.getRow(rIdx);
    if (entry.kind === "section") {
      row.height = 19;
      wsExec.mergeCells(`A${rIdx}:F${rIdx}`);
      const c = row.getCell(1);
      c.value = entry.title;
      c.font = { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "1E293B" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      for (let col = 1; col <= 6; col++) row.getCell(col).border = THIN_BORDER;
      return;
    }

    row.height = entry.bold ? 22 : 20;
    row.getCell(1).value = entry.label;
    row.getCell(2).value = {
      formula: `${sheet1Ref}!C${entry.rIdx}`,
      result: entry.result,
    };
    row.getCell(2).numFmt = entry.fmt;

    if (entry.showPctOfSales) {
      const salesDenom = summary.billedSalesExclGst;
      const pctRes = salesDenom > 0 ? entry.result / salesDenom : 0;
      row.getCell(3).value = {
        formula: `IF($B$${execBilledSalesRow}>0,B${rIdx}/$B$${execBilledSalesRow},0)`,
        result: pctRes,
      };
      row.getCell(3).numFmt = PCT_FMT;
    } else {
      row.getCell(3).value = "—";
    }

    const compValNormalized =
      entry.compVal !== null && entry.compVal !== undefined
        ? entry.isPct
          ? entry.compVal / 100
          : entry.compVal
        : null;

    if (compValNormalized !== null) {
      row.getCell(4).value = compValNormalized;
      row.getCell(4).numFmt = entry.fmt;
      row.getCell(5).value = {
        formula: `B${rIdx}-D${rIdx}`,
        result: entry.result - compValNormalized,
      };
      row.getCell(5).numFmt = entry.isPct ? "+0.0%;-0.0%;0.0%" : RUPEE_FMT;
    } else {
      row.getCell(4).value = "Active Mode";
      row.getCell(5).value = "—";
    }

    row.getCell(6).value = entry.note;

    row.eachCell((c) => {
      const colNum = Number(c.col);
      c.border = THIN_BORDER;
      const valColor =
        colNum === 2 && entry.result < -0.0001
          ? "B91C1C"
          : colNum === 4 && typeof compValNormalized === "number" && compValNormalized < -0.0001
          ? "B91C1C"
          : colNum === 5 && typeof compValNormalized === "number" && entry.result - compValNormalized < -0.0001
          ? "B91C1C"
          : colNum === 5 && typeof compValNormalized === "number" && entry.result - compValNormalized > 0.0001
          ? "065F46"
          : "0F172A";

      c.font = {
        name: "Segoe UI",
        size: colNum === 6 ? 8.5 : 9.5,
        bold: Boolean(entry.bold),
        color: { argb: valColor },
      };
      c.alignment = {
        vertical: "middle",
        horizontal: colNum >= 2 && colNum <= 5 ? "right" : "left",
      };
      if (colNum === 2) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };
      } else if (entry.bold) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
      }
    });
  });

  // Executive Sheet Unit Economics & Break-Even Block (Cross-sheet linked from Sheet 1 Col M)
  execCursor += 1;
  const kpiSecRowIdx = execCursor++;
  wsExec.mergeCells(`A${kpiSecRowIdx}:F${kpiSecRowIdx}`);
  wsExec.getCell(`A${kpiSecRowIdx}`).value = "UNIT ECONOMICS, REALIZATION & BREAK-EVEN KPIs (CROSS-SHEET LIVE LINKS)";
  wsExec.getCell(`A${kpiSecRowIdx}`).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
  wsExec.getCell(`A${kpiSecRowIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUPER_NAVY_FILL } };
  wsExec.getCell(`A${kpiSecRowIdx}`).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsExec.getRow(kpiSecRowIdx).height = 22;
  for (let col = 1; col <= 6; col++) wsExec.getCell(kpiSecRowIdx, col).border = THIN_BORDER;

  const compKpis: Record<number, number | null> = {
    [rKpiAvgSell]: catalogComparison ? catalogComparison.avgSellRatePerBilledStrip : null,
    [rKpiEffReal]: catalogComparison ? catalogComparison.effectiveRealizationPerTotalStrip : null,
    [rKpiDilution]: catalogComparison ? catalogComparison.freeDilutionPct / 100 : null,
    [rKpiNetPerBilled]: catalogComparison ? catalogComparison.netProfitPerBilledStrip : null,
    [rKpiNetPerTotal]: catalogComparison ? catalogComparison.netProfitPerTotalStrip : null,
    [rKpiBreakEven]: catalogComparison ? catalogComparison.breakEvenRevenueRequired ?? 0 : null,
    [rKpiUplift]: catalogComparison ? (catalogComparison.sellRateUpliftPctToBreakEven ?? 0) / 100 : null,
  };

  kpiEntries.forEach((k) => {
    const rIdx = execCursor++;
    const row = wsExec.getRow(rIdx);
    row.height = k.bold ? 22 : 20;
    row.getCell(1).value = k.label;
    row.getCell(2).value = {
      formula: `${sheet1Ref}!M${k.rIdx}`,
      result: k.result,
    };
    row.getCell(2).numFmt = k.fmt;
    row.getCell(3).value = "—";
    const cVal = compKpis[k.rIdx];
    if (cVal !== null && cVal !== undefined) {
      row.getCell(4).value = cVal;
      row.getCell(4).numFmt = k.fmt;
      row.getCell(5).value = { formula: `B${rIdx}-D${rIdx}`, result: k.result - cVal };
      row.getCell(5).numFmt = k.isPct ? "+0.0%;-0.0%;0.0%" : RUPEE_FMT;
    } else {
      row.getCell(4).value = "Active Mode";
      row.getCell(5).value = "—";
    }
    row.getCell(6).value = k.note;
    row.eachCell((c) => {
      const colNum = Number(c.col);
      c.border = THIN_BORDER;
      c.font = {
        name: "Segoe UI",
        size: colNum === 6 ? 8.5 : 9.5,
        bold: Boolean(k.bold),
        color: { argb: colNum === 2 && k.result < -0.0001 ? "B91C1C" : "0F172A" },
      };
      c.alignment = { vertical: "middle", horizontal: colNum >= 2 && colNum <= 5 ? "right" : "left" };
      if (colNum === 2) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };
      } else if (k.bold) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
      }
    });
  });

  [42, 22, 14, 24, 20, 44].forEach((w, idx) => {
    wsExec.getColumn(idx + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBlobDownload(blob, `Profit_Testing_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
