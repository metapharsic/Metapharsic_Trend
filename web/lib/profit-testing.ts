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
  purchaseCostExclGst: number;
  purchaseGstPaid: number;
  purchaseCashOutlayInclGst: number;
  grossProfitAfterInputGstCredit: number;
  doctorCommission: number;
  effectiveDoctorPct: number;
  lineItemNetProfitBeforeOtherCharges: number;
  otherCharges: number;
  totalOperatingCost: number;
  netProfitEarnings: number;
  netMarginPct: number;
  returnOnTotalCostPct: number;
  cashEarningsBeforeInputGstCredit: number;
  inputGstCredit: number;
  netGstPosition: number;
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
 * Builds 10 rows using the exact reference preset and enriches catalogPurchaseRate/productId
 * when matching SKUs exist in the live database catalog.
 */
export function buildReferenceSheetRows(
  catalog: CatalogProductOption[] = [],
  minRows = 10
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

/** Builds rows strictly from the live PostgreSQL Product catalog, padded up to 10 lines. */
export function buildRowsFromCatalogProducts(
  catalog: CatalogProductOption[],
  defaultBilledQty = 10,
  defaultFreeQty = 5,
  minRows = 10
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

  const grossProfitAfterInputGstCredit = round2(billedSalesExclGst - effectiveTotalPurchasePnl);
  const doctorCommission = sum((r) => r.doctorCost);
  const effectiveDoctorPct =
    billedSalesExclGst > 0 ? Math.round((doctorCommission / billedSalesExclGst) * 1000) / 10 : globalDocPct;

  const otherCharges = round2(Math.max(0, Number(assumptions.otherCharges || 0)));
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
    purchaseCostExclGst,
    purchaseGstPaid,
    purchaseCashOutlayInclGst,
    grossProfitAfterInputGstCredit,
    doctorCommission,
    effectiveDoctorPct,
    lineItemNetProfitBeforeOtherCharges,
    otherCharges,
    totalOperatingCost,
    netProfitEarnings,
    netMarginPct,
    returnOnTotalCostPct,
    cashEarningsBeforeInputGstCredit,
    inputGstCredit,
    netGstPosition,
    taxTreatmentLabel: isRecoverable
      ? "Purchase GST recoverable"
      : "Purchase GST non-recoverable (expensed)",
  };

  return { computedRows, summary };
}

/**
 * Generates and downloads a live-formula Excel (.xlsx) Profit Testing Sheet
 * matching the Blue/Yellow input and Green linked-value convention.
 */
export async function downloadProfitTestingExcel(
  assumptions: ProfitTestingAssumptions,
  rows: ProfitTestingComputedRow[],
  summary: ProfitTestingSummary
): Promise<void> {
  const ExcelJSRuntime = (await import("exceljs")).default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "Trend MR Pharma OS";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet("Profit Testing Sheet", {
    views: [{ state: "frozen", ySplit: 8, xSplit: 2 }],
  });

  const BLUE_INPUT_FILL = "DBEAFE";
  const AMBER_INPUT_FILL = "FEF3C7";
  const GREEN_LINK_FILL = "ECFDF5";
  const NAVY_FILL = "0F172A";
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
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:W2");
  const subCell = ws.getCell("A2");
  subCell.value =
    "Blue/yellow cells are inputs. Green cells are linked formula values. GST is shown separately so profit, cash outlay, and tax credit stay transparent.";
  subCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_SUB_FILL } };
  ws.getRow(2).height = 20;

  // Key Assumptions Section (Rows 4-6)
  ws.getCell("A4").value = "Key Assumptions";
  ws.getCell("A4").font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "0F172A" } };

  ws.getCell("A5").value = "Doctor commission %";
  ws.getCell("B5").value = assumptions.doctorCommissionPct / 100;
  ws.getCell("B5").numFmt = PCT_FMT;
  ws.getCell("B5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.getCell("D5").value = "Purchase GST %";
  ws.getCell("E5").value = assumptions.purchaseGstPct / 100;
  ws.getCell("E5").numFmt = PCT_FMT;
  ws.getCell("E5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.getCell("G5").value = "Tax treatment";
  ws.getCell("H5").value = summary.taxTreatmentLabel;
  ws.getCell("H5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_INPUT_FILL } };

  ws.getCell("A6").value = "Other charges";
  ws.getCell("B6").value = assumptions.otherCharges;
  ws.getCell("B6").numFmt = RUPEE_FMT;
  ws.getCell("B6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_INPUT_FILL } };

  ws.getCell("D6").value = "Sales GST %";
  ws.getCell("E6").value = assumptions.salesGstPct / 100;
  ws.getCell("E6").numFmt = PCT_FMT;
  ws.getCell("E6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_INPUT_FILL } };

  ws.getCell("G6").value = "Cost basis / Sell basis";
  ws.getCell("H6").value = `${assumptions.costBasisMode} / ${assumptions.sellingPriceBasis} per strip`;
  ws.getCell("H6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };

  for (const rNum of [5, 6]) {
    const r = ws.getRow(rNum);
    r.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: "Segoe UI", size: 10, bold: [2, 5, 8].includes(Number(c.col)) };
    });
  }

  // Table Headers (Row 8)
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
  const hdrRow = ws.getRow(8);
  hdrRow.values = headers;
  hdrRow.height = 28;
  hdrRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });

  const firstDataRow = 9;
  const isRecoverable = assumptions.taxTreatment === "RECOVERABLE_ITC";

  rows.forEach((row, idx) => {
    const rIdx = firstDataRow + idx;
    const xlRow = ws.getRow(rIdx);
    xlRow.getCell(1).value = row.no;
    xlRow.getCell(2).value = row.item || "";
    xlRow.getCell(3).value = row.packing || "";
    xlRow.getCell(4).value = row.billedQty || 0;
    xlRow.getCell(5).value = row.freeQty || 0;
    xlRow.getCell(6).value = { formula: `=D${rIdx}+E${rIdx}`, result: row.totalQty };
    xlRow.getCell(7).value = row.mrp || 0;
    xlRow.getCell(8).value = row.ptr || 0;
    xlRow.getCell(9).value = row.costPerStrip || 0;
    xlRow.getCell(10).value = row.sellRate || 0;
    xlRow.getCell(11).value = { formula: `=D${rIdx}*J${rIdx}`, result: row.billedSales };
    xlRow.getCell(12).value = { formula: `=K${rIdx}*$E$6`, result: row.salesGst };
    xlRow.getCell(13).value = { formula: `=K${rIdx}+L${rIdx}`, result: row.invoiceTotal };
    xlRow.getCell(14).value = { formula: `=E${rIdx}*H${rIdx}`, result: row.freeValueAtPtr };
    xlRow.getCell(15).value = { formula: `=E${rIdx}*I${rIdx}`, result: row.freeStripCost };
    xlRow.getCell(16).value = { formula: `=F${rIdx}*I${rIdx}`, result: row.purchaseCost };
    xlRow.getCell(17).value = { formula: `=P${rIdx}*$E$5`, result: row.purchaseGst };
    xlRow.getCell(18).value = { formula: `=P${rIdx}+Q${rIdx}`, result: row.cashOutlayInclGst };
    xlRow.getCell(19).value = {
      formula: isRecoverable ? `=K${rIdx}-P${rIdx}` : `=K${rIdx}-R${rIdx}`,
      result: row.grossProfit,
    };
    xlRow.getCell(20).value = (row.doctorPct || 0) / 100;
    xlRow.getCell(21).value = { formula: `=K${rIdx}*T${rIdx}`, result: row.doctorCost };
    xlRow.getCell(22).value = { formula: `=S${rIdx}-U${rIdx}`, result: row.netProfit };
    xlRow.getCell(23).value = {
      formula: `=IF(K${rIdx}>0,V${rIdx}/K${rIdx},0)`,
      result: (row.netMarginPct || 0) / 100,
    };

    const rupeeCols = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22];
    const inputCols = [2, 4, 5, 10, 20];
    const linkedCols = [6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23];

    for (let c = 1; c <= 23; c++) {
      const cell = xlRow.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = { name: "Segoe UI", size: 9.5 };
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

  const lastDataRow = firstDataRow + rows.length - 1;
  const totalRowIdx = lastDataRow + 1;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.getCell(2).value = "TOTAL";
  for (const colIdx of [4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22]) {
    const colLetter = ws.getColumn(colIdx).letter;
    totalRow.getCell(colIdx).value = {
      formula: `=SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
    };
  }
  totalRow.getCell(23).value = {
    formula: `=IF(K${totalRowIdx}>0,V${totalRowIdx}/K${totalRowIdx},0)`,
    result: summary.netMarginPct / 100,
  };
  totalRow.height = 22;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
    cell.border = THIN_BORDER;
    if (colNumber >= 11 && colNumber <= 22 && colNumber !== 20) cell.numFmt = RUPEE_FMT;
    if (colNumber === 23) cell.numFmt = PCT_FMT;
  });

  // Earnings Summary Block below totals
  const sumStart = totalRowIdx + 2;
  ws.getCell(`A${sumStart}`).value = "Earnings Summary";
  ws.getCell(`A${sumStart}`).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "0F172A" } };
  ws.getCell(`D${sumStart}`).value = "How to Use";
  ws.getCell(`D${sumStart}`).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "0F172A" } };

  const summaryRows: Array<{ label: string; formula: string; result: number; fmt: string; bold?: boolean }> = [
    { label: "Billed sales excl. GST", formula: `=K${totalRowIdx}`, result: summary.billedSalesExclGst, fmt: RUPEE_FMT },
    { label: "Sales GST collected", formula: `=L${totalRowIdx}`, result: summary.salesGstCollected, fmt: RUPEE_FMT },
    { label: "Invoice total incl. GST", formula: `=M${totalRowIdx}`, result: summary.invoiceTotalInclGst, fmt: RUPEE_FMT },
    { label: "Free value @ PTR (not billed)", formula: `=N${totalRowIdx}`, result: summary.freeValueAtPtr, fmt: RUPEE_FMT },
    { label: "Free strip cost", formula: `=O${totalRowIdx}`, result: summary.freeStripCost, fmt: RUPEE_FMT },
    { label: "Purchase cost excl. GST", formula: `=P${totalRowIdx}`, result: summary.purchaseCostExclGst, fmt: RUPEE_FMT },
    { label: "Purchase GST paid", formula: `=Q${totalRowIdx}`, result: summary.purchaseGstPaid, fmt: RUPEE_FMT },
    { label: "Purchase cash outlay incl. GST", formula: `=R${totalRowIdx}`, result: summary.purchaseCashOutlayInclGst, fmt: RUPEE_FMT },
    { label: "Gross profit after input GST credit", formula: `=S${totalRowIdx}`, result: summary.grossProfitAfterInputGstCredit, fmt: RUPEE_FMT, bold: true },
    { label: "Doctor commission", formula: `=U${totalRowIdx}`, result: summary.doctorCommission, fmt: RUPEE_FMT },
    { label: "Line-item net profit (before other charges)", formula: `=V${totalRowIdx}`, result: summary.lineItemNetProfitBeforeOtherCharges, fmt: RUPEE_FMT },
    { label: "Other charges", formula: `=B6`, result: summary.otherCharges, fmt: RUPEE_FMT },
    { label: "Net profit / earnings", formula: `=V${totalRowIdx}-B6`, result: summary.netProfitEarnings, fmt: RUPEE_FMT, bold: true },
    {
      label: "Net margin",
      formula: `=IF(K${totalRowIdx}>0,(V${totalRowIdx}-B6)/K${totalRowIdx},0)`,
      result: summary.netMarginPct / 100,
      fmt: PCT_FMT,
    },
    {
      label: "Return on total cost",
      formula: isRecoverable
        ? `=IF((P${totalRowIdx}+U${totalRowIdx}+B6)>0,(V${totalRowIdx}-B6)/(P${totalRowIdx}+U${totalRowIdx}+B6),0)`
        : `=IF((R${totalRowIdx}+U${totalRowIdx}+B6)>0,(V${totalRowIdx}-B6)/(R${totalRowIdx}+U${totalRowIdx}+B6),0)`,
      result: summary.returnOnTotalCostPct / 100,
      fmt: PCT_FMT,
    },
    {
      label: "Cash earnings before input GST credit",
      formula: isRecoverable ? `=V${totalRowIdx}-B6-Q${totalRowIdx}` : `=V${totalRowIdx}-B6`,
      result: summary.cashEarningsBeforeInputGstCredit,
      fmt: RUPEE_FMT,
      bold: true,
    },
    {
      label: "Input GST credit",
      formula: isRecoverable ? `=Q${totalRowIdx}` : `=0`,
      result: summary.inputGstCredit,
      fmt: RUPEE_FMT,
    },
    {
      label: "Net GST payable / (ITC credit)",
      formula: isRecoverable ? `=L${totalRowIdx}-Q${totalRowIdx}` : `=L${totalRowIdx}`,
      result: summary.netGstPosition,
      fmt: RUPEE_FMT,
    },
  ];

  const howToUseLines = [
    "1. Select an item in column B (live catalog synced).",
    "2. Enter billed quantity in column D and free quantity in column E.",
    "3. Selling rate defaults to PTR; overwrite column J to test another price.",
    "4. Purchase GST is included in cash outlay and shown separately as recoverable input credit.",
    "5. Final Net profit / earnings and Cash earnings before claiming input GST update live.",
  ];

  summaryRows.forEach((s, idx) => {
    const rIdx = sumStart + 1 + idx;
    const r = ws.getRow(rIdx);
    r.getCell(1).value = s.label;
    r.getCell(2).value = { formula: s.formula, result: s.result };
    r.getCell(2).numFmt = s.fmt;
    r.getCell(1).font = { name: "Segoe UI", size: 9.5, bold: Boolean(s.bold) };
    r.getCell(2).font = {
      name: "Segoe UI",
      size: 9.5,
      bold: Boolean(s.bold),
      color: { argb: s.result < 0 ? "B91C1C" : "065F46" },
    };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_LINK_FILL } };
    r.getCell(1).border = THIN_BORDER;
    r.getCell(2).border = THIN_BORDER;

    if (howToUseLines[idx]) {
      ws.mergeCells(`D${rIdx}:J${rIdx}`);
      const hCell = r.getCell(4);
      hCell.value = howToUseLines[idx];
      hCell.font = { name: "Segoe UI", size: 9.5, color: { argb: "334155" } };
    }
  });

  // Clean readable column widths
  const widths = [6, 20, 16, 11, 10, 10, 11, 11, 13, 11, 14, 12, 14, 15, 14, 14, 13, 18, 14, 11, 13, 14, 11];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Profit_Testing_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
