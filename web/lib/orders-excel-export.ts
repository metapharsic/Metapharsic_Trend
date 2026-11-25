import ExcelJS from "exceljs";
import { ExcelDesignSystem } from "@/lib/excel-export";

export interface OrdersWorkbookInput {
  cadence: string;
  scopeLabel: string;
  isAdmin: boolean;
  summary: {
    totalInvoicedAmount: number;
    totalInvoicesCount: number;
    totalPaidAmount: number;
    totalUnpaidAmount: number;
    collectionRatePct?: number;
    totalPendingOrdersCount: number;
    totalPendingOrdersAmount: number;
  } | null;
  agingSummary: {
    current0To15Count: number;
    current0To15Amount: number;
    aging16To30Count: number;
    aging16To30Amount: number;
    overdue30PlusCount: number;
    overdue30PlusAmount: number;
  } | null;
  invoiceTotals: {
    revenue: number;
    cost?: number;
    profitAmount: number;
    profitPct?: number | null;
  } | null;
  orders: any[];
  invoices: any[];
  areaBreakdowns: any[];
  personBreakdowns: any[];
  uninvoicedOrders: any[];
}

function styleHeaderRow(row: ExcelJS.Row, fillArgb = ExcelDesignSystem.palette.midnightNavy) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = ExcelDesignSystem.borders.thin;
  });
}

function autoSizeSheet(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 4, 14), 46);
  });
}

function formatRupeeColumns(ws: ExcelJS.Worksheet, startRow: number, colIndexes: number[]) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (const cIdx of colIndexes) {
      const cell = row.getCell(cIdx);
      if (typeof cell.value === "number") {
        cell.numFmt = "₹#,##0";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    }
  }
}

export async function downloadOrdersInvoicingExcel(input: OrdersWorkbookInput): Promise<void> {
  if (typeof window === "undefined") return;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Trend MR Pharma OS";
  wb.created = new Date();

  const summary = input.summary;
  const aging = input.agingSummary;

  // ── Sheet 1: Executive Summary & Aging ─────────────────────────────────────
  const wsSummary = wb.addWorksheet("Executive Summary", { views: [{ state: "frozen", ySplit: 3 }] });
  const banner = wsSummary.addRow(["ORDERS & INVOICING CENTRAL — COMMERCIAL & GST REPORT"]);
  banner.font = ExcelDesignSystem.fonts.title;
  banner.height = 30;
  banner.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ExcelDesignSystem.palette.midnightNavy } };
  wsSummary.mergeCells("A1:D1");

  const meta = wsSummary.addRow([
    `Cadence: ${input.cadence}`,
    `Scope: ${input.scopeLabel}`,
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    "",
  ]);
  meta.font = ExcelDesignSystem.fonts.cellMuted;
  wsSummary.addRow([]);

  const kpiHeader = wsSummary.addRow(["Commercial Metric", "Count / Ratio", "Value (INR)", "Notes"]);
  styleHeaderRow(kpiHeader, ExcelDesignSystem.palette.headerNavy);

  const kpiRows: Array<[string, string | number, number | string, string]> = [
    ["Total Invoiced Revenue", summary?.totalInvoicesCount ?? input.invoices.length, summary?.totalInvoicedAmount ?? 0, "Active filtered tax invoices"],
    ["Collected (Paid Invoices)", `${summary?.collectionRatePct ?? 0}% settled`, summary?.totalPaidAmount ?? 0, "Realized against invoices"],
    ["Open Unpaid Receivables", "-", summary?.totalUnpaidAmount ?? 0, "Pending chemist collections"],
    ["Unbilled Orders Backlog", summary?.totalPendingOrdersCount ?? input.uninvoicedOrders.length, summary?.totalPendingOrdersAmount ?? 0, "Orders awaiting GST invoice generation"],
  ];

  if (aging) {
    kpiRows.push(
      ["Unpaid Aging (0–15 Days)", aging.current0To15Count, aging.current0To15Amount, "Fresh credit cycle"],
      ["Unpaid Aging (16–30 Days)", aging.aging16To30Count, aging.aging16To30Amount, "Follow-up recommended"],
      ["Unpaid Overdue (30+ Days)", aging.overdue30PlusCount, aging.overdue30PlusAmount, "Priority collection alert"]
    );
  }

  if (input.isAdmin && input.invoiceTotals) {
    kpiRows.push(
      ["Admin Read-Only Revenue", "-", input.invoiceTotals.revenue, "All matching invoices"],
      ["Admin Est. Cost Basis", "-", input.invoiceTotals.cost ?? 0, "Resolved via lib/pricing.ts"],
      [
        "Admin Net Profit & Margin",
        input.invoiceTotals.revenue > 0
          ? `${((input.invoiceTotals.profitAmount / input.invoiceTotals.revenue) * 100).toFixed(1)}%`
          : "0.0%",
        input.invoiceTotals.profitAmount,
        "Computed without mutating invoices",
      ]
    );
  }

  for (const r of kpiRows) {
    const row = wsSummary.addRow(r);
    row.eachCell((cell) => {
      cell.border = ExcelDesignSystem.borders.thin;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
    });
    row.getCell(1).font = ExcelDesignSystem.fonts.cellBold;
  }
  formatRupeeColumns(wsSummary, 5, [3]);
  autoSizeSheet(wsSummary);

  // ── Sheet 2: GST Tax Invoices Register ─────────────────────────────────────
  const wsInvoices = wb.addWorksheet("Invoices Register", { views: [{ state: "frozen", ySplit: 1 }] });
  const invHeaders = [
    "Invoice No",
    "Date",
    "Chemist",
    "Territory",
    "SubArea / Beat",
    "Prescribed Doctor",
    "Booked By (MR)",
    "Distributor",
    "Status",
    "Invoice Amount (₹)",
    ...(input.isAdmin ? ["Cost Basis (₹)", "Profit (₹)", "Margin %"] : []),
  ];
  const invHeadRow = wsInvoices.addRow(invHeaders);
  styleHeaderRow(invHeadRow, ExcelDesignSystem.palette.deepEmerald);
  wsInvoices.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + invHeaders.length)}1` };

  for (const inv of input.invoices) {
    const docName = inv.order?.doctor ? `Dr. ${inv.order.doctor.fullName}` : "Direct Counter";
    const mrName = inv.order?.employee
      ? `${inv.order.employee.firstName} ${inv.order.employee.lastName}`
      : "Central";
    const areaLabel = [inv.order?.chemist?.subArea, inv.order?.chemist?.beatName].filter(Boolean).join(" / ") || "—";
    const baseCols: (string | number)[] = [
      inv.invoiceNo,
      new Date(inv.createdAt).toLocaleDateString("en-IN"),
      inv.order?.chemist?.name || "Unknown Chemist",
      inv.order?.chemist?.territory?.name || "General",
      areaLabel,
      docName,
      mrName,
      inv.order?.distributor?.name || "—",
      inv.paid ? "PAID" : "UNPAID",
      Math.round(Number(inv.amount || 0)),
    ];
    if (input.isAdmin) {
      baseCols.push(
        Math.round(Number(inv.cost || 0)),
        Math.round(Number(inv.profitAmount || 0)),
        inv.profitPct != null ? `${inv.profitPct.toFixed(1)}%` : "—"
      );
    }
    const r = wsInvoices.addRow(baseCols);
    r.eachCell((cell) => {
      cell.border = ExcelDesignSystem.borders.thin;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
    });
  }
  formatRupeeColumns(wsInvoices, 2, input.isAdmin ? [10, 11, 12] : [10]);
  autoSizeSheet(wsInvoices);

  // ── Sheet 3: Secondary Orders Register ─────────────────────────────────────
  const wsOrders = wb.addWorksheet("Orders Pipeline", { views: [{ state: "frozen", ySplit: 1 }] });
  const ordHeaders = [
    "Order ID",
    "Date",
    "Status",
    "Chemist",
    "Territory",
    "Distributor",
    "Prescribed Doctor",
    "MR",
    "SKUs",
    "Billed Units",
    "Free Units",
    "Order Value (₹)",
    "Chemist Due (₹)",
    "Invoice Ref",
  ];
  const ordHeadRow = wsOrders.addRow(ordHeaders);
  styleHeaderRow(ordHeadRow, ExcelDesignSystem.palette.royalBlue);
  wsOrders.autoFilter = { from: "A1", to: "N1" };

  for (const o of input.orders) {
    const val = (o.items || []).reduce((s: number, it: any) => s + Number(it.price || 0) * (it.quantity || 0), 0);
    const billedQty = (o.items || []).reduce((s: number, it: any) => s + (it.quantity || 0), 0);
    const freeQty = (o.items || []).reduce((s: number, it: any) => s + (it.freeQty || 0), 0);
    const r = wsOrders.addRow([
      String(o.id).slice(0, 8).toUpperCase(),
      new Date(o.createdAt).toLocaleDateString("en-IN"),
      o.status,
      o.chemist?.name || "—",
      o.chemist?.territory?.name || "General",
      o.distributor?.name || "—",
      o.doctor ? `Dr. ${o.doctor.fullName}` : "Direct",
      o.employee ? `${o.employee.firstName} ${o.employee.lastName}` : "Central",
      (o.items || []).length,
      billedQty,
      freeQty,
      Math.round(val),
      o.chemistOutstanding != null ? Math.round(Number(o.chemistOutstanding)) : 0,
      o.invoice?.invoiceNo || "PENDING",
    ]);
    r.eachCell((cell) => {
      cell.border = ExcelDesignSystem.borders.thin;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
    });
  }
  formatRupeeColumns(wsOrders, 2, [12, 13]);
  autoSizeSheet(wsOrders);

  // ── Sheet 4: Area & Rep Performance ────────────────────────────────────────
  const wsDim = wb.addWorksheet("Area & Rep Breakdown");
  const areaTitle = wsDim.addRow(["TERRITORY & SUB-AREA BREAKDOWN"]);
  areaTitle.font = ExcelDesignSystem.fonts.sectionHeader;
  const areaHdr = wsDim.addRow([
    "Territory",
    "Sub-Area",
    "Invoices",
    "Invoiced (₹)",
    "Paid (₹)",
    "Unpaid (₹)",
    "Pending Orders",
    "Pending Value (₹)",
  ]);
  styleHeaderRow(areaHdr, ExcelDesignSystem.palette.headerNavy);

  for (const a of input.areaBreakdowns) {
    const r = wsDim.addRow([
      a.territoryName,
      a.subArea || "All Beats",
      a.invoiceCount,
      Math.round(a.totalInvoiced || 0),
      Math.round(a.paidAmount || 0),
      Math.round(a.unpaidAmount || 0),
      a.pendingOrdersCount || 0,
      Math.round(a.pendingOrdersAmount || 0),
    ]);
    r.eachCell((cell) => {
      cell.border = ExcelDesignSystem.borders.thin;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
    });
  }

  wsDim.addRow([]);
  const repTitle = wsDim.addRow(["MEDICAL REPRESENTATIVE (MR) PERFORMANCE"]);
  repTitle.font = ExcelDesignSystem.fonts.sectionHeader;
  const repHdr = wsDim.addRow([
    "Representative",
    "Role",
    "Invoices",
    "Invoiced (₹)",
    "Paid (₹)",
    "Unpaid (₹)",
    "Pending Orders",
    "Pending Value (₹)",
  ]);
  styleHeaderRow(repHdr, ExcelDesignSystem.palette.deepEmerald);

  for (const p of input.personBreakdowns) {
    const r = wsDim.addRow([
      p.employeeName,
      p.role || "MR",
      p.invoiceCount,
      Math.round(p.totalInvoiced || 0),
      Math.round(p.paidAmount || 0),
      Math.round(p.unpaidAmount || 0),
      p.pendingOrdersCount || 0,
      Math.round(p.pendingOrdersAmount || 0),
    ]);
    r.eachCell((cell) => {
      cell.border = ExcelDesignSystem.borders.thin;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
    });
  }
  formatRupeeColumns(wsDim, 3, [4, 5, 6, 8]);
  autoSizeSheet(wsDim);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `TrendMR_Orders_Invoicing_${new Date().toISOString().slice(0, 10)}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
