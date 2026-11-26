import { computeShelfLife, getMedicineReference, type ClinicalReference, type ShelfLifeStatus } from "./medicine-reference";

export interface ExportableProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  composition: string | null;
  strength: string | null;
  packSize: string | null;
  mrp: number | null;
  ptr: number | null;
  purchaseRate?: number | null;
  costBasisExact?: boolean;
  costBasisSource?: string;
  grossMarginPct?: number | null;
  stockQty: number;
  stockBoxes?: number;
  earliestStockQty?: number;
  mrSampleQty?: number;
  stockValue?: number;
  stockValueAtCost?: number | null;
  unitProfit?: number;
  potentialStockProfit?: number;
  therapySegment: string | null;
  hsnCode?: string | null;
  gstPct?: number | null;
  currentBatchNo: string | null;
  currentMfgDate: string | null;
  currentExpDate: string | null;
  lastMovementAt?: string;
  forecast?: { burnRatePerDay: number; daysRemaining: number | null };
  profitAnalytics?: {
    invoicedCount: number;
    invoicedBilledQty: number;
    invoicedFreeQty: number;
    freeRatioPct: number;
    realizedRevenue: number;
    realizedCost: number;
    billedCostOnly: number;
    freeCostBurden: number;
    realizedProfit: number;
    realizedMarginPct: number | null;
    exactCost: boolean;
  };
}

export interface ExportableMedicineIntel {
  clinicalProfile?: ClinicalReference;
  shelfLife?: ShelfLifeStatus;
  monthlyTrend?: Array<{
    month: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
  }>;
  topChemists?: Array<{
    chemistId: string;
    chemistName: string;
    area: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    totalUnits: number;
    revenue: number;
    profit: number;
    marginPct: number | null;
    lastOrderDate: string;
  }>;
  mrBreakdown?: Array<{
    employeeId: string;
    mrName: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    sampleQtyHeld: number;
    lastSampleGivenAt: string | null;
    revenue: number;
    profit: number;
    marginPct: number | null;
  }>;
  schemeMix?: Array<{
    ratioLabel: string;
    linesCount: number;
    billedQty: number;
    freeQty: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
  }>;
  recentInvoices?: Array<{
    invoiceNo: string;
    date: string;
    partyName: string;
    area: string;
    mrName: string;
    billedQty: number;
    freeQty: number;
    unitRate: number;
    lineRevenue: number;
    lineCost: number;
    lineProfit: number;
    lineMarginPct: number | null;
  }>;
}

const RUPEE_FMT = '"₹"#,##0.00;("₹"#,##0.00);"-"';
const INT_FMT = "#,##0";
const BOX_FMT = "#,##0.0";
const PCT_FMT = "0.0%";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(val: string | number): string {
  const s = String(val ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escHtml(val: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inrText(val: number): string {
  const abs = Math.abs(val);
  const s = `₹${abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return val < -0.004 ? `(${s})` : s;
}

function readSellingPtr(p: Pick<ExportableProduct, "ptr" | "price">): number {
  if (p.ptr != null && Number(p.ptr) > 0) return Number(p.ptr);
  return Number(p.price || 0);
}

function extractMetrics(p: ExportableProduct) {
  const ptr = readSellingPtr(p);
  const mrp = Number(p.mrp ?? 0);
  const cost = Number(p.purchaseRate ?? 0);
  const unitProfit = p.unitProfit ?? round2(ptr - cost);
  const grossMarginRatio = ptr > 0 && cost > 0 ? (ptr - cost) / ptr : 0;
  const strips = Number(p.stockQty || 0);
  const boxes = p.stockBoxes ?? round2(strips / 10);
  const stockCost = Number(p.stockValueAtCost ?? round2(strips * cost));
  const stockPtr = Number(p.stockValue ?? round2(strips * ptr));
  const potentialProfit = Number(p.potentialStockProfit ?? round2(stockPtr - stockCost));
  const pa = p.profitAnalytics;
  const invoicedCount = pa?.invoicedCount ?? 0;
  const billed = pa?.invoicedBilledQty ?? 0;
  const free = pa?.invoicedFreeQty ?? 0;
  const revenue = pa?.realizedRevenue ?? 0;
  const totalCogs = pa?.realizedCost ?? 0;
  const freeBurden = pa?.freeCostBurden ?? round2(free * cost);
  const realizedProfit = pa?.realizedProfit ?? 0;
  const netMarginRatio = revenue > 0 ? realizedProfit / revenue : 0;
  return {
    ptr,
    mrp,
    cost,
    unitProfit,
    grossMarginRatio,
    strips,
    boxes,
    stockCost,
    stockPtr,
    potentialProfit,
    invoicedCount,
    billed,
    free,
    revenue,
    totalCogs,
    freeBurden,
    realizedProfit,
    netMarginRatio,
  };
}

export function buildInventoryCsv(products: ExportableProduct[], isAdmin: boolean): string {
  const headers = isAdmin
    ? [
        "No.",
        "Medicine",
        "SKU",
        "Pack Size",
        "Composition",
        "Therapeutic Class",
        "Target Specialties",
        "Batch No",
        "Expiry",
        "Shelf Life",
        "MRP",
        "PTR",
        "Purchase Cost",
        "Unit Profit/Strip",
        "PTR Gross Margin %",
        "Stock (Strips)",
        "Stock (Boxes)",
        "MR Samples",
        "Stock Cost Outlay",
        "Stock Value @ PTR",
        "Potential Stock Profit",
        "Invoices",
        "Billed Qty",
        "Free Qty",
        "Realized Revenue Excl GST",
        "Realized Cost Incl Free",
        "Free Scheme Cost Burden",
        "Realized Net Profit",
        "Realized Net Margin %",
      ]
    : ["No.", "Medicine", "SKU", "Pack Size", "Composition", "Therapeutic Class", "Target Specialties", "MRP", "PTR"];

  const rows = products.map((p, idx) => {
    const clinical = getMedicineReference(p);
    const shelf = computeShelfLife(p.currentExpDate);
    if (!isAdmin) {
      return [
        idx + 1,
        p.name,
        p.sku,
        p.packSize || "",
        p.composition || "",
        clinical.therapeuticClass,
        clinical.targetSpecialties.join("; "),
        Number(p.mrp || 0).toFixed(2),
        readSellingPtr(p).toFixed(2),
      ];
    }
    const m = extractMetrics(p);
    return [
      idx + 1,
      p.name,
      p.sku,
      p.packSize || "",
      p.composition || "",
      clinical.therapeuticClass,
      clinical.targetSpecialties.join("; "),
      p.currentBatchNo || "",
      p.currentExpDate ? p.currentExpDate.slice(0, 10) : "",
      shelf.label,
      m.mrp.toFixed(2),
      m.ptr.toFixed(2),
      m.cost.toFixed(2),
      m.unitProfit.toFixed(2),
      (m.grossMarginRatio * 100).toFixed(1),
      m.strips,
      m.boxes.toFixed(1),
      p.mrSampleQty ?? 0,
      m.stockCost.toFixed(2),
      m.stockPtr.toFixed(2),
      m.potentialProfit.toFixed(2),
      m.invoicedCount,
      m.billed,
      m.free,
      m.revenue.toFixed(2),
      m.totalCogs.toFixed(2),
      m.freeBurden.toFixed(2),
      m.realizedProfit.toFixed(2),
      (m.netMarginRatio * 100).toFixed(1),
    ];
  });

  return "\uFEFF" + [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

export function downloadInventoryCsv(products: ExportableProduct[], isAdmin: boolean): void {
  const csv = buildInventoryCsv(products, isAdmin);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, `Central_Inventory_Profit_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function buildInventoryJson(products: ExportableProduct[], isAdmin: boolean): string {
  const payload = {
    generatedAt: new Date().toISOString(),
    billingBasis: "PTR Only (PTS removed)",
    scope: isAdmin ? "ADMIN_FULL_PROFIT" : "CATALOG_CLINICAL_ONLY",
    totalProducts: products.length,
    products: products.map((p) => {
      const clinicalProfile = getMedicineReference(p);
      const shelfLife = computeShelfLife(p.currentExpDate);
      if (!isAdmin) {
        return {
          name: p.name,
          sku: p.sku,
          packSize: p.packSize,
          composition: p.composition,
          mrp: Number(p.mrp || 0),
          ptr: readSellingPtr(p),
          clinicalProfile,
        };
      }
      return {
        ...p,
        clinicalProfile,
        shelfLife,
        computedMetrics: extractMetrics(p),
      };
    }),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadInventoryJson(products: ExportableProduct[], isAdmin: boolean): void {
  const json = buildInventoryJson(products, isAdmin);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  triggerBlobDownload(blob, `Central_Inventory_Audit_${new Date().toISOString().slice(0, 10)}.json`);
}

export function buildInventoryHtml(products: ExportableProduct[], isAdmin: boolean): string {
  const metrics = products.map((p) => ({
    p,
    m: extractMetrics(p),
    clinical: getMedicineReference(p),
    shelf: computeShelfLife(p.currentExpDate),
  }));

  const totals = metrics.reduce(
    (acc, x) => {
      acc.strips += x.m.strips;
      acc.boxes += x.m.boxes;
      acc.samples += x.p.mrSampleQty ?? 0;
      acc.stockCost += x.m.stockCost;
      acc.stockPtr += x.m.stockPtr;
      acc.potentialProfit += x.m.potentialProfit;
      acc.revenue += x.m.revenue;
      acc.cogs += x.m.totalCogs;
      acc.freeBurden += x.m.freeBurden;
      acc.realizedProfit += x.m.realizedProfit;
      acc.billed += x.m.billed;
      acc.free += x.m.free;
      return acc;
    },
    { strips: 0, boxes: 0, samples: 0, stockCost: 0, stockPtr: 0, potentialProfit: 0, revenue: 0, cogs: 0, freeBurden: 0, realizedProfit: 0, billed: 0, free: 0 }
  );

  const tableRows = metrics
    .map(
      ({ p, m, clinical, shelf }, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td><strong>${escHtml(p.name)}</strong><div class="sub">${escHtml(p.sku)} · ${escHtml(p.packSize || "")}</div></td>
        <td>${escHtml(p.composition || "-")}<div class="sub">${escHtml(clinical.therapeuticClass)}</div></td>
        <td class="r">${inrText(m.mrp)}</td>
        <td class="r"><strong>${inrText(m.ptr)}</strong></td>
        ${
          isAdmin
            ? `
          <td class="r">${inrText(m.cost)}</td>
          <td class="r pos">+${inrText(m.unitProfit)}</td>
          <td class="r">${m.strips.toLocaleString("en-IN")} (${m.boxes.toFixed(1)}b)</td>
          <td class="r">${inrText(m.stockPtr)}</td>
          <td class="r pos">${inrText(m.potentialProfit)}</td>
          <td class="r">${m.billed}+${m.free} (${m.invoicedCount})</td>
          <td class="r">${inrText(m.revenue)}</td>
          <td class="r neg">(${inrText(m.freeBurden)})</td>
          <td class="r ${m.realizedProfit >= 0 ? "pos" : "neg"}"><strong>${inrText(m.realizedProfit)}</strong> (${(m.netMarginRatio * 100).toFixed(1)}%)</td>
          <td>${escHtml(p.currentBatchNo || "—")}<div class="sub">${escHtml(shelf.label)}</div></td>
        `
            : `<td>${escHtml(clinical.targetSpecialties.join(", "))}</td>`
        }
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Central Product Inventory & Profit Intelligence</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 18px; background: #f8fafc; font-size: 11px; }
  .hero { background: #0f172a; color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 14px; }
  .hero h1 { margin: 0; font-size: 19px; }
  .hero p { margin: 4px 0 0; color: #cbd5e1; font-size: 11px; }
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .kpi { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
  .kpi .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 700; }
  .kpi .val { font-size: 16px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; background: #fff; margin-bottom: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; }
  thead th { background: #1e293b; color: #fff; font-size: 9.5px; text-transform: uppercase; white-space: nowrap; }
  tfoot td { background: #e2e8f0; font-weight: 700; }
  .sub { font-size: 9.5px; color: #64748b; margin-top: 2px; }
  .c { text-align: center; } .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pos { color: #047857; font-weight: 700; } .neg { color: #be123c; font-weight: 700; }
</style>
</head>
<body>
  <div class="hero">
    <h1>Central Product Inventory — Medicine Knowledge &amp; Profit Report</h1>
    <p>Generated ${escHtml(new Date().toLocaleString("en-IN"))} · Billing Basis: PTR Only (PTS removed) · ${products.length} Active Medicines</p>
  </div>
  ${
    isAdmin
      ? `<div class="kpis">
    <div class="kpi"><div class="lbl">Warehouse Stock</div><div class="val">${totals.strips.toLocaleString("en-IN")} strips (${totals.boxes.toFixed(1)} boxes)</div></div>
    <div class="kpi"><div class="lbl">Stock Cost Outlay</div><div class="val">${inrText(totals.stockCost)}</div></div>
    <div class="kpi"><div class="lbl">Potential Stock Profit (@ PTR)</div><div class="val pos">${inrText(totals.potentialProfit)}</div></div>
    <div class="kpi"><div class="lbl">Realized Invoice Profit</div><div class="val pos">${inrText(totals.realizedProfit)} (${totals.revenue > 0 ? ((totals.realizedProfit / totals.revenue) * 100).toFixed(1) : "0.0"}%)</div></div>
  </div>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th>#</th><th>Medicine</th><th>Formula &amp; Class</th><th>MRP</th><th>PTR</th>
        ${
          isAdmin
            ? `<th>Cost</th><th>+Unit Profit</th><th>Stock (Strips/Box)</th><th>Stock Value</th><th>Stock Profit</th><th>Sold (B+F)</th><th>Revenue</th><th>Free Burden</th><th>Realized Profit</th><th>Batch &amp; Shelf Life</th>`
            : `<th>Target Specialties</th>`
        }
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    ${
      isAdmin
        ? `<tfoot><tr>
        <td class="c">Σ</td><td>PORTFOLIO TOTAL (${products.length} SKUs)</td><td></td><td></td><td></td><td></td><td></td>
        <td class="r">${totals.strips.toLocaleString("en-IN")} (${totals.boxes.toFixed(1)}b)</td>
        <td class="r">${inrText(totals.stockPtr)}</td>
        <td class="r pos">${inrText(totals.potentialProfit)}</td>
        <td class="r">${totals.billed}+${totals.free}</td>
        <td class="r">${inrText(totals.revenue)}</td>
        <td class="r neg">(${inrText(totals.freeBurden)})</td>
        <td class="r pos">${inrText(totals.realizedProfit)}</td>
        <td>MR Samples: ${totals.samples}</td>
      </tr></tfoot>`
        : ""
    }
  </table>
</body>
</html>`;
}

export function downloadInventoryHtml(products: ExportableProduct[], isAdmin: boolean): void {
  const html = buildInventoryHtml(products, isAdmin);
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  triggerBlobDownload(blob, `Central_Inventory_Report_${new Date().toISOString().slice(0, 10)}.html`);
}

export function printInventoryPdf(products: ExportableProduct[], isAdmin: boolean): void {
  const html = buildInventoryHtml(products, isAdmin);
  const w = window.open("", "_blank");
  if (!w) {
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

/** Multi-sheet Excel Workbook with LIVE OpenXML formulas (no leading '='). */
export async function downloadInventoryExcel(products: ExportableProduct[], isAdmin: boolean): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trend MR Pharma OS";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  const NAVY = "0F172A";
  const SUB_NAVY = "1E293B";
  const SLATE_BG = "F1F5F9";
  const GREEN_BG = "ECFDF5";
  const THIN = {
    top: { style: "thin" as const, color: { argb: "CBD5E1" } },
    left: { style: "thin" as const, color: { argb: "CBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "CBD5E1" } },
    right: { style: "thin" as const, color: { argb: "CBD5E1" } },
  };

  // Sheet 1: Live Stock & Profit Intelligence
  const ws = wb.addWorksheet("Central Stock & Profit", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const lastColLetter = isAdmin ? "AC" : "K";
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.getCell("A1").value = "Central Product Inventory — Stock Valuation & Realized Profit Statement";
  ws.getCell("A1").font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;

  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell("A2").value = `Generated ${new Date().toLocaleString("en-IN")} · Invoicing Basis: PTR Only (PTS removed) · 1 Box = 10 Strips · All green cells use live Excel formulas`;
  ws.getCell("A2").font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "334155" } };
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE_BG } };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 20;

  const headers = isAdmin
    ? [
        "No.",
        "Medicine",
        "SKU",
        "Pack",
        "Composition",
        "Therapeutic Class",
        "Target Specialties",
        "Batch No",
        "Expiry",
        "MRP (₹)",
        "PTR (₹)",
        "Purchase Cost (₹)",
        "Unit Profit / Strip",
        "PTR Margin %",
        "Stock (Strips)",
        "Stock (Boxes)",
        "MR Samples",
        "Stock Cost Outlay",
        "Stock Value @ PTR",
        "Potential Stock Profit",
        "Invoices",
        "Billed Qty",
        "Free Qty",
        "Invoiced Revenue",
        "COGS Incl. Free",
        "Free Cost Burden",
        "Realized Profit",
        "Realized Margin %",
        "Profit Share %",
      ]
    : ["No.", "Medicine", "SKU", "Pack", "Composition", "Therapeutic Class", "Target Specialties", "Batch No", "Expiry", "MRP (₹)", "PTR (₹)"];

  const hdrRow = ws.getRow(4);
  hdrRow.values = headers;
  hdrRow.height = 28;
  hdrRow.eachCell((c) => {
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUB_NAVY } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = THIN;
  });

  const firstRow = 5;
  const lastRow = Math.max(firstRow, firstRow + products.length - 1);
  const totalRowIdx = products.length > 0 ? firstRow + products.length : firstRow;

  products.forEach((p, idx) => {
    const r = firstRow + idx;
    const xl = ws.getRow(r);
    xl.height = 22;
    const m = extractMetrics(p);
    const clinical = getMedicineReference(p);

    xl.getCell(1).value = idx + 1;
    xl.getCell(2).value = p.name;
    xl.getCell(3).value = p.sku;
    xl.getCell(4).value = p.packSize || "";
    xl.getCell(5).value = p.composition || "";
    xl.getCell(6).value = clinical.therapeuticClass;
    xl.getCell(7).value = clinical.targetSpecialties.join(", ");
    xl.getCell(8).value = p.currentBatchNo || "";
    xl.getCell(9).value = p.currentExpDate ? p.currentExpDate.slice(0, 10) : "";
    xl.getCell(10).value = m.mrp;
    xl.getCell(11).value = m.ptr;

    if (isAdmin) {
      xl.getCell(12).value = m.cost;
      xl.getCell(13).value = { formula: `K${r}-L${r}`, result: m.unitProfit };
      xl.getCell(14).value = { formula: `IF(K${r}>0,(K${r}-L${r})/K${r},0)`, result: m.grossMarginRatio };
      xl.getCell(15).value = m.strips;
      xl.getCell(16).value = { formula: `O${r}/10`, result: m.boxes };
      xl.getCell(17).value = p.mrSampleQty ?? 0;
      xl.getCell(18).value = { formula: `O${r}*L${r}`, result: m.stockCost };
      xl.getCell(19).value = { formula: `O${r}*K${r}`, result: m.stockPtr };
      xl.getCell(20).value = { formula: `S${r}-R${r}`, result: m.potentialProfit };
      xl.getCell(21).value = m.invoicedCount;
      xl.getCell(22).value = m.billed;
      xl.getCell(23).value = m.free;
      xl.getCell(24).value = m.revenue;
      xl.getCell(25).value = { formula: `(V${r}+W${r})*L${r}`, result: m.totalCogs };
      xl.getCell(26).value = { formula: `W${r}*L${r}`, result: m.freeBurden };
      xl.getCell(27).value = { formula: `X${r}-Y${r}`, result: m.realizedProfit };
      xl.getCell(28).value = { formula: `IF(X${r}>0,AA${r}/X${r},0)`, result: m.netMarginRatio };
      xl.getCell(29).value = {
        formula: `IF($AA$${totalRowIdx}>0,AA${r}/$AA$${totalRowIdx},0)`,
        result: 0,
      };
    }

    const formulaCols = new Set([13, 14, 16, 18, 19, 20, 25, 26, 27, 28, 29]);
    const rupeeCols = new Set([10, 11, 12, 13, 18, 19, 20, 24, 25, 26, 27]);
    const pctCols = new Set([14, 28, 29]);
    const intCols = new Set([15, 17, 21, 22, 23]);

    const colMax = isAdmin ? 29 : 11;
    for (let c = 1; c <= colMax; c++) {
      const cell = xl.getCell(c);
      cell.border = THIN;
      cell.font = {
        name: "Segoe UI",
        size: 9.5,
        bold: c === 2 || c === 27 || c === 20,
        color: { argb: c === 27 && m.realizedProfit < 0 ? "B91C1C" : formulaCols.has(c) && isAdmin ? "065F46" : "0F172A" },
      };
      cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : c >= 10 ? "right" : "left" };
      if (rupeeCols.has(c)) cell.numFmt = RUPEE_FMT;
      if (pctCols.has(c)) cell.numFmt = PCT_FMT;
      if (intCols.has(c)) cell.numFmt = INT_FMT;
      if (c === 16) cell.numFmt = BOX_FMT;
      if (isAdmin && formulaCols.has(c)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      }
    }
  });

  if (isAdmin && products.length > 0) {
    // Recompute cached share % accurately once all rows summed
    const totalRealized = products.reduce((s, p) => s + extractMetrics(p).realizedProfit, 0);
    products.forEach((p, idx) => {
      const r = firstRow + idx;
      const cell = ws.getCell(r, 29);
      const val = extractMetrics(p).realizedProfit;
      cell.value = {
        formula: `IF($AA$${totalRowIdx}>0,AA${r}/$AA$${totalRowIdx},0)`,
        result: totalRealized > 0 ? val / totalRealized : 0,
      };
    });

    const tr = ws.getRow(totalRowIdx);
    tr.height = 24;
    tr.getCell(1).value = "Σ";
    tr.getCell(2).value = `PORTFOLIO TOTAL (${products.length} SKUs)`;

    for (const colIdx of [15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27]) {
      const letter = ws.getColumn(colIdx).letter;
      tr.getCell(colIdx).value = { formula: `SUM(${letter}${firstRow}:${letter}${lastRow})` };
    }
    tr.getCell(28).value = { formula: `IF(X${totalRowIdx}>0,AA${totalRowIdx}/X${totalRowIdx},0)` };
    tr.getCell(29).value = { formula: `SUM(AC${firstRow}:AC${lastRow})`, result: 1 };

    for (let c = 1; c <= 29; c++) {
      const cell = tr.getCell(c);
      cell.border = THIN;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
      cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "0F172A" } };
      cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : c >= 10 ? "right" : "left" };
      if ([18, 19, 20, 24, 25, 26, 27].includes(c)) cell.numFmt = RUPEE_FMT;
      if ([15, 17, 22, 23].includes(c)) cell.numFmt = INT_FMT;
      if (c === 16) cell.numFmt = BOX_FMT;
      if (c === 28 || c === 29) cell.numFmt = PCT_FMT;
    }
  }

  const s1Widths = isAdmin
    ? [6, 20, 14, 15, 36, 32, 30, 13, 12, 11, 11, 13, 14, 12, 12, 12, 11, 16, 16, 17, 9, 10, 10, 16, 15, 15, 16, 13, 12]
    : [6, 22, 14, 16, 38, 34, 34, 14, 12, 12, 12];
  s1Widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  // Sheet 2: Clinical Pharmacology & Detailing Booklet (Know Each Medicine)
  const wsClin = wb.addWorksheet("Clinical & Detailing Guide", {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  wsClin.mergeCells("A1:J1");
  wsClin.getCell("A1").value = "Know Each Medicine — Clinical Reference, Detailing USP & Storage Guide";
  wsClin.getCell("A1").font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFF" } };
  wsClin.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  wsClin.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsClin.getRow(1).height = 26;

  const clinHdr = wsClin.getRow(3);
  clinHdr.values = [
    "Medicine",
    "SKU",
    "Composition & Pack",
    "Therapeutic Class",
    "Target Doctor Specialties",
    "Clinical Indications",
    "Mechanism of Action",
    "Standard Dosing",
    "MR Detailing Highlights (USP)",
    "Safety & Storage / Shelf Life",
  ];
  clinHdr.height = 24;
  clinHdr.eachCell((c) => {
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUB_NAVY } };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c.border = THIN;
  });

  products.forEach((p, idx) => {
    const r = 4 + idx;
    const xl = wsClin.getRow(r);
    xl.height = 68;
    const ref = getMedicineReference(p);
    const shelf = computeShelfLife(p.currentExpDate);
    xl.values = [
      p.name,
      p.sku,
      `${p.composition || "-"}\nPack: ${p.packSize || "N/A"}`,
      ref.therapeuticClass,
      ref.targetSpecialties.join(", "),
      ref.indications.map((x) => `• ${x}`).join("\n"),
      ref.mechanismOfAction,
      ref.standardDosage,
      ref.detailingHighlights.map((x) => `• ${x}`).join("\n"),
      `${ref.precautionsAndStorage}\nBatch: ${p.currentBatchNo || "N/A"} (${shelf.label})`,
    ];
    xl.eachCell((c) => {
      c.border = THIN;
      c.font = { name: "Segoe UI", size: 9, bold: Number(c.col) === 1 };
      c.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    });
  });

  [20, 14, 28, 28, 24, 42, 42, 32, 42, 38].forEach((w, idx) => {
    wsClin.getColumn(idx + 1).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBlobDownload(blob, `Central_Product_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Single-Medicine Dossier Multi-Format Exports */
export function buildSingleMedicineHtml(
  product: ExportableProduct,
  intel: ExportableMedicineIntel | null,
  isAdmin: boolean,
  docPctSim: number
): string {
  const clinical = intel?.clinicalProfile ?? getMedicineReference(product);
  const shelf = intel?.shelfLife ?? computeShelfLife(product.currentExpDate);
  const m = extractMetrics(product);
  const docCost = round2((m.revenue * docPctSim) / 100);
  const netAfterDoc = round2(m.realizedProfit - docCost);

  const chemistRows = (intel?.topChemists ?? [])
    .slice(0, 15)
    .map(
      (c) => `<tr><td>${escHtml(c.chemistName)}<div class="sub">${escHtml(c.area)}</div></td><td class="r">${c.invoicesCount}</td><td class="r">${c.billedQty}+${c.freeQty}</td><td class="r">${inrText(c.revenue)}</td><td class="r pos">${inrText(c.profit)}</td></tr>`
    )
    .join("");

  const mrRows = (intel?.mrBreakdown ?? [])
    .map(
      (mr) => `<tr><td>${escHtml(mr.mrName)}</td><td class="r">${mr.billedQty}+${mr.freeQty} (${mr.invoicesCount})</td><td class="r">${inrText(mr.revenue)}</td><td class="r pos">${inrText(mr.profit)}</td><td class="r">${mr.sampleQtyHeld}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Medicine Dossier — ${escHtml(product.name)}</title>
<style>
  @page { size: portrait; margin: 12mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 18px; background: #fff; font-size: 11px; }
  .banner { background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 10px; margin-bottom: 12px; }
  .banner h1 { margin: 0; font-size: 18px; }
  .banner p { margin: 4px 0 0; color: #cbd5e1; font-size: 11px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
  .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .kv { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; }
  th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; text-align: left; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .sub { font-size: 9px; color: #64748b; }
  .pos { color: #047857; font-weight: 700; } .neg { color: #be123c; font-weight: 700; }
  ul { margin: 4px 0; padding-left: 16px; }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escHtml(product.name)} (${escHtml(product.sku)}) — 360° Medicine Dossier</h1>
    <p>${escHtml(clinical.therapeuticClass)} · ${escHtml(product.composition || "")} · Pack ${escHtml(product.packSize || "N/A")} · Shelf Life: ${escHtml(shelf.label)}</p>
  </div>
  <div class="grid">
    <div class="card">
      <h3>Clinical &amp; Detailing Reference</h3>
      <p><strong>Target Specialties:</strong> ${escHtml(clinical.targetSpecialties.join(", "))}</p>
      <p><strong>Dosage:</strong> ${escHtml(clinical.standardDosage)}</p>
      <p><strong>Mechanism:</strong> ${escHtml(clinical.mechanismOfAction)}</p>
      <p><strong>Indications:</strong></p>
      <ul>${clinical.indications.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>
      <p><strong>Storage / Safety:</strong> ${escHtml(clinical.precautionsAndStorage)}</p>
    </div>
    ${
      isAdmin
        ? `<div class="card">
      <h3>Pricing, Stock &amp; Realized P&amp;L</h3>
      <div class="kv"><span>MRP / PTR / Cost</span><strong>${inrText(m.mrp)} / ${inrText(m.ptr)} / ${inrText(m.cost)}</strong></div>
      <div class="kv"><span>Unit Profit / Strip</span><strong class="pos">+${inrText(m.unitProfit)} (${(m.grossMarginRatio * 100).toFixed(1)}%)</strong></div>
      <div class="kv"><span>Warehouse Stock</span><strong>${m.strips.toLocaleString("en-IN")} strips (${m.boxes.toFixed(1)} boxes)</strong></div>
      <div class="kv"><span>Potential Stock Profit (@ PTR)</span><strong class="pos">${inrText(m.potentialProfit)}</strong></div>
      <div class="kv"><span>Invoiced Units (Billed + Free)</span><strong>${m.billed} billed + ${m.free} free (${m.invoicedCount} inv)</strong></div>
      <div class="kv"><span>Realized Revenue (Excl. GST)</span><strong>${inrText(m.revenue)}</strong></div>
      <div class="kv"><span>Free Scheme Cost Burden</span><span class="neg">(${inrText(m.freeBurden)})</span></div>
      <div class="kv"><span>Realized Profit${docPctSim > 0 ? ` (after ${docPctSim}% Doc)` : ""}</span><strong class="${netAfterDoc >= 0 ? "pos" : "neg"}">${inrText(netAfterDoc)}</strong></div>
    </div>`
        : `<div class="card"><h3>Commercial Ladder (PTR Billing)</h3>
      <div class="kv"><span>MRP</span><strong>${inrText(m.mrp)}</strong></div>
      <div class="kv"><span>PTR (Sell Rate)</span><strong>${inrText(m.ptr)}</strong></div>
    </div>`
    }
  </div>
  ${
    isAdmin && chemistRows
      ? `<div class="card" style="margin-bottom:10px"><h3>Top Buying Chemists</h3><table><thead><tr><th>Chemist</th><th class="r">Inv</th><th class="r">Billed+Free</th><th class="r">Revenue</th><th class="r">Profit</th></tr></thead><tbody>${chemistRows}</tbody></table></div>`
      : ""
  }
  ${
    isAdmin && mrRows
      ? `<div class="card"><h3>MR Sales &amp; Sample Carry</h3><table><thead><tr><th>MR</th><th class="r">Sold (B+F)</th><th class="r">Revenue</th><th class="r">Profit</th><th class="r">Samples</th></tr></thead><tbody>${mrRows}</tbody></table></div>`
      : ""
  }
</body>
</html>`;
}

export function downloadSingleMedicineHtml(
  product: ExportableProduct,
  intel: ExportableMedicineIntel | null,
  isAdmin: boolean,
  docPctSim: number
): void {
  const html = buildSingleMedicineHtml(product, intel, isAdmin, docPctSim);
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  triggerBlobDownload(blob, `${product.sku}_Medicine_Dossier_${new Date().toISOString().slice(0, 10)}.html`);
}

export function printSingleMedicinePdf(
  product: ExportableProduct,
  intel: ExportableMedicineIntel | null,
  isAdmin: boolean,
  docPctSim: number
): void {
  const html = buildSingleMedicineHtml(product, intel, isAdmin, docPctSim);
  const w = window.open("", "_blank");
  if (!w) {
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

export function downloadSingleMedicineJson(
  product: ExportableProduct,
  intel: ExportableMedicineIntel | null,
  isAdmin: boolean
): void {
  const clinicalProfile = intel?.clinicalProfile ?? getMedicineReference(product);
  const shelfLife = intel?.shelfLife ?? computeShelfLife(product.currentExpDate);
  const payload = isAdmin
    ? { generatedAt: new Date().toISOString(), product, clinicalProfile, shelfLife, intelligence: intel }
    : { generatedAt: new Date().toISOString(), name: product.name, sku: product.sku, clinicalProfile, shelfLife };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  triggerBlobDownload(blob, `${product.sku}_Dossier_${new Date().toISOString().slice(0, 10)}.json`);
}

export async function downloadSingleMedicineExcel(
  product: ExportableProduct,
  intel: ExportableMedicineIntel | null,
  isAdmin: boolean,
  docPctSim: number
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trend MR Pharma OS";
  wb.calcProperties = { fullCalcOnLoad: true };

  const m = extractMetrics(product);
  const clinical = intel?.clinicalProfile ?? getMedicineReference(product);
  const shelf = intel?.shelfLife ?? computeShelfLife(product.currentExpDate);
  const NAVY = "0F172A";
  const GREEN_BG = "ECFDF5";
  const THIN = {
    top: { style: "thin" as const, color: { argb: "CBD5E1" } },
    left: { style: "thin" as const, color: { argb: "CBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "CBD5E1" } },
    right: { style: "thin" as const, color: { argb: "CBD5E1" } },
  };

  const ws = wb.addWorksheet("Medicine Dossier");
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = `${product.name} (${product.sku}) — Medicine Knowledge & Profit Dossier`;
  ws.getCell("A1").font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getRow(1).height = 26;

  const infoRows: Array<[string, string | number]> = [
    ["Therapeutic Class", clinical.therapeuticClass],
    ["Composition", `${product.composition || ""} (${product.packSize || "N/A"})`],
    ["Target Doctor Specialties", clinical.targetSpecialties.join(", ")],
    ["Standard Dosing", clinical.standardDosage],
    ["Clinical Indications", clinical.indications.join(" | ")],
    ["Mechanism of Action", clinical.mechanismOfAction],
    ["Batch & Shelf Life", `${product.currentBatchNo || "N/A"} (${shelf.label})`],
  ];
  infoRows.forEach((pair, idx) => {
    const r = 3 + idx;
    ws.getCell(r, 1).value = pair[0];
    ws.getCell(r, 1).font = { name: "Segoe UI", size: 9.5, bold: true };
    ws.mergeCells(`B${r}:D${r}`);
    ws.getCell(r, 2).value = pair[1];
    ws.getCell(r, 2).alignment = { wrapText: true, vertical: "middle" };
    for (let c = 1; c <= 4; c++) ws.getCell(r, c).border = THIN;
    ws.getRow(r).height = pair[0].includes("Indications") || pair[0].includes("Mechanism") ? 36 : 20;
  });

  if (isAdmin) {
    const finStart = 11;
    ws.mergeCells(`A${finStart}:D${finStart}`);
    ws.getCell(`A${finStart}`).value = "FINANCIAL, STOCK & PROFIT MODEL (LIVE FORMULAS)";
    ws.getCell(`A${finStart}`).font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFF" } };
    ws.getCell(`A${finStart}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
    ws.getRow(finStart).height = 22;

    const rMrp = finStart + 1;
    const rPtr = finStart + 2;
    const rCost = finStart + 3;
    const rUnitProfit = finStart + 4;
    const rStrips = finStart + 5;
    const rBoxes = finStart + 6;
    const rStockCost = finStart + 7;
    const rStockPtr = finStart + 8;
    const rPotProfit = finStart + 9;
    const rBilled = finStart + 10;
    const rFree = finStart + 11;
    const rRev = finStart + 12;
    const rCogs = finStart + 13;
    const rFreeBurden = finStart + 14;
    const rGrossProfit = finStart + 15;
    const rDocPct = finStart + 16;
    const rNetAfterDoc = finStart + 17;

    const finRows: Array<{ r: number; lbl: string; val: number | { formula: string; result: number }; fmt: string; bold?: boolean }> = [
      { r: rMrp, lbl: "MRP per Strip", val: m.mrp, fmt: RUPEE_FMT },
      { r: rPtr, lbl: "PTR (Invoice Sell Rate)", val: m.ptr, fmt: RUPEE_FMT },
      { r: rCost, lbl: "Purchase Cost per Strip", val: m.cost, fmt: RUPEE_FMT },
      { r: rUnitProfit, lbl: "Unit Profit per Strip", val: { formula: `B${rPtr}-B${rCost}`, result: m.unitProfit }, fmt: RUPEE_FMT, bold: true },
      { r: rStrips, lbl: "Warehouse Stock (Strips)", val: m.strips, fmt: INT_FMT },
      { r: rBoxes, lbl: "Warehouse Stock (Boxes @ 10u)", val: { formula: `B${rStrips}/10`, result: m.boxes }, fmt: BOX_FMT },
      { r: rStockCost, lbl: "Stock Cost Outlay", val: { formula: `B${rStrips}*B${rCost}`, result: m.stockCost }, fmt: RUPEE_FMT },
      { r: rStockPtr, lbl: "Stock Value @ PTR", val: { formula: `B${rStrips}*B${rPtr}`, result: m.stockPtr }, fmt: RUPEE_FMT },
      { r: rPotProfit, lbl: "Potential Stock Profit (@ PTR)", val: { formula: `B${rStockPtr}-B${rStockCost}`, result: m.potentialProfit }, fmt: RUPEE_FMT, bold: true },
      { r: rBilled, lbl: "Invoiced Billed Strips", val: m.billed, fmt: INT_FMT },
      { r: rFree, lbl: "Invoiced Free Scheme Strips", val: m.free, fmt: INT_FMT },
      { r: rRev, lbl: "Realized Invoiced Sales (Excl. GST)", val: m.revenue, fmt: RUPEE_FMT },
      { r: rCogs, lbl: "Total COGS Absorbed (Billed + Free)", val: { formula: `(B${rBilled}+B${rFree})*B${rCost}`, result: m.totalCogs }, fmt: RUPEE_FMT },
      { r: rFreeBurden, lbl: "Free Scheme Cost Burden", val: { formula: `B${rFree}*B${rCost}`, result: m.freeBurden }, fmt: RUPEE_FMT },
      { r: rGrossProfit, lbl: "Realized Profit (Before Doc %)", val: { formula: `B${rRev}-B${rCogs}`, result: m.realizedProfit }, fmt: RUPEE_FMT, bold: true },
      { r: rDocPct, lbl: "Doctor Commission % (Assumption)", val: docPctSim / 100, fmt: PCT_FMT },
      {
        r: rNetAfterDoc,
        lbl: "Est. Net Profit After Doctor %",
        val: { formula: `B${rGrossProfit}-(B${rRev}*B${rDocPct})`, result: round2(m.realizedProfit - (m.revenue * docPctSim) / 100) },
        fmt: RUPEE_FMT,
        bold: true,
      },
    ];

    finRows.forEach((item) => {
      const xl = ws.getRow(item.r);
      xl.height = 20;
      xl.getCell(1).value = item.lbl;
      xl.getCell(1).font = { name: "Segoe UI", size: 9.5, bold: Boolean(item.bold) };
      xl.getCell(1).border = THIN;
      const cell = xl.getCell(2);
      cell.value = item.val;
      cell.numFmt = item.fmt;
      cell.font = { name: "Segoe UI", size: 9.5, bold: Boolean(item.bold), color: { argb: typeof item.val === "object" ? "065F46" : "0F172A" } };
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = THIN;
      if (typeof item.val === "object") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      }
    });
  }

  [36, 22, 22, 22].forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  if (isAdmin && intel?.topChemists?.length) {
    const wsCh = wb.addWorksheet("Top Chemists & MRs");
    wsCh.getRow(1).values = ["Chemist Name", "Area", "Invoices", "Billed Qty", "Free Qty", "Revenue (₹)", "Profit (₹)"];
    wsCh.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.border = THIN;
    });
    intel.topChemists.forEach((ch, idx) => {
      const r = 2 + idx;
      const xl = wsCh.getRow(r);
      xl.values = [ch.chemistName, ch.area, ch.invoicesCount, ch.billedQty, ch.freeQty, ch.revenue, ch.profit];
      xl.getCell(6).numFmt = RUPEE_FMT;
      xl.getCell(7).numFmt = RUPEE_FMT;
      xl.eachCell((c) => { c.border = THIN; });
    });
    [32, 24, 10, 12, 12, 16, 16].forEach((w, idx) => {
      wsCh.getColumn(idx + 1).width = w;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBlobDownload(blob, `${product.sku}_Medicine_Dossier_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
