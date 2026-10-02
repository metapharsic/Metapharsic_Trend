/**
 * Universal Multi-Agent Professional Excel Workbook Engine
 * Powered by ExcelJS for Native .xlsx binary workbooks with:
 * - Executive Brand Typography & C-Suite Color Palette
 * - Multi-Tab Workbook Structure (Executive Dashboard, Deal Closure, Call Logs)
 * - Auto-sized Columns with Word Wrapping (No truncated text or clipped numbers)
 * - Professional Borders, Zebra Striping, Currency & Percentage Formatting
 * - Frozen Header Panes and Auto-Filters
 */

import ExcelJS from "exceljs";

// ============================================================================
// AGENT 1: WORKBOOK DESIGN SYSTEM & STYLING AGENT
// ============================================================================
export const ExcelDesignSystem = {
  palette: {
    midnightNavy: "0F172A",
    headerNavy: "1E293B",
    royalBlue: "1E40AF",
    softBlueBg: "EFF6FF",
    deepEmerald: "065F46",
    emeraldAccent: "10B981",
    softEmeraldBg: "ECFDF5",
    softEmeraldText: "065F46",
    richAmber: "92400E",
    softAmberBg: "FEF3C7",
    softAmberText: "92400E",
    crimsonRose: "9F1239",
    softRoseBg: "FFE4E6",
    softRoseText: "9F1239",
    borderSlate: "CBD5E1",
    zebraRow: "F8FAFC",
    pureWhite: "FFFFFF",
    textDark: "0F172A",
    textMuted: "64748B",
  },
  fonts: {
    title: { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFF" } },
    subtitle: { name: "Segoe UI", size: 10, italic: true, color: { argb: "94A3B8" } },
    sectionHeader: { name: "Segoe UI", size: 12, bold: true, color: { argb: "0F172A" } },
    tableHeader: { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } },
    cellRegular: { name: "Segoe UI", size: 9.5, color: { argb: "1E293B" } },
    cellBold: { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "0F172A" } },
    badgeText: { name: "Segoe UI", size: 9, bold: true },
    kpiValue: { name: "Segoe UI", size: 15, bold: true, color: { argb: "0F172A" } },
    kpiLabel: { name: "Segoe UI", size: 9, bold: true, color: { argb: "475569" } },
    kpiNote: { name: "Segoe UI", size: 8, italic: true, color: { argb: "64748B" } },
  },
  borders: {
    thin: {
      top: { style: "thin" as const, color: { argb: "CBD5E1" } },
      left: { style: "thin" as const, color: { argb: "CBD5E1" } },
      bottom: { style: "thin" as const, color: { argb: "CBD5E1" } },
      right: { style: "thin" as const, color: { argb: "CBD5E1" } },
    },
    headerBottom: {
      bottom: { style: "medium" as const, color: { argb: "0F172A" } },
    },
  },
};

export interface ExcelDashboardExportOptions {
  reportTitle: string;
  reportSubtitle?: string;
  generatedBy?: string;
  scopeMR?: string;
  period?: string;
  kpis: Array<{ label: string; value: string | number; note?: string }>;
  mrSummaryTable?: {
    headers: string[];
    rows: (string | number)[][];
  };
  stageSummaryTable?: {
    headers: string[];
    rows: (string | number)[][];
  };
  detailHeaders: string[];
  detailRows: (string | number)[][];
  // Optional granular call logs for 3rd tab
  callLogsHeaders?: string[];
  callLogsRows?: (string | number)[][];
}

// Helper to auto-fit columns with safety margin
function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 14, maxWidth = 55) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      if (val != null) {
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        // Split by newline if any
        const lines = str.split("\n");
        for (const line of lines) {
          if (line.length > maxLen) maxLen = line.length;
        }
      }
    });
    // Add safety padding of 4 characters
    const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, maxLen + 4));
    column.width = calculatedWidth;
  });
}

// ============================================================================
// AGENT 2: EXECUTIVE DASHBOARD & KPI SHEET BUILDER AGENT
// ============================================================================
function buildExecutiveDashboardSheet(workbook: ExcelJS.Workbook, options: ExcelDashboardExportOptions) {
  const ws = workbook.addWorksheet("📊 Executive Dashboard", {
    views: [{ showGridLines: true }],
  });

  // 1. Executive Banner (Rows 1 to 3)
  ws.mergeCells("A1:K1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "METAPHARSIC LIFESCIENCES — EXECUTIVE INTELLIGENCE DASHBOARD";
  titleCell.font = ExcelDesignSystem.fonts.title;
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.midnightNavy },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:K2");
  const subCell = ws.getCell("A2");
  subCell.value = `${options.reportTitle.toUpperCase()} — ${options.reportSubtitle || "Commercial Reconciliation & Deal Closure Strategy"}`;
  subCell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "93C5FD" } };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.midnightNavy },
  };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 22;

  ws.mergeCells("A3:K3");
  const metaCell = ws.getCell("A3");
  metaCell.value = `Exported: ${new Date().toLocaleString("en-IN")}   |   Scope: ${options.scopeMR || "All Representatives"}   |   Period: ${options.period || "All Time"}   |   Classification: STRICTLY CONFIDENTIAL`;
  metaCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "CBD5E1" } };
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.midnightNavy },
  };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 20;

  // Space row
  ws.getRow(4).height = 12;

  // 2. Section Header: Executive KPI Scorecards
  ws.mergeCells("A5:K5");
  const kpiHeader = ws.getCell("A5");
  kpiHeader.value = "1. EXECUTIVE KPI SCORECARD & STRATEGIC METRICS";
  kpiHeader.font = ExcelDesignSystem.fonts.sectionHeader;
  ws.getRow(5).height = 26;

  // Render KPIs as a 4-column card grid or 2-column tabular cards
  let currentRow = 6;
  const kpis = options.kpis || [];
  for (let i = 0; i < kpis.length; i += 2) {
    const kpi1 = kpis[i];
    const kpi2 = kpis[i + 1];

    ws.getRow(currentRow).height = 28;
    ws.getRow(currentRow + 1).height = 18;

    // Card 1: Columns A - D
    ws.mergeCells(`A${currentRow}:D${currentRow}`);
    const card1Val = ws.getCell(`A${currentRow}`);
    card1Val.value = `${kpi1.label.toUpperCase()}:  ${kpi1.value}`;
    card1Val.font = ExcelDesignSystem.fonts.kpiValue;
    card1Val.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: i % 4 === 0 ? "F0FDF4" : "EFF6FF" },
    };
    card1Val.alignment = { vertical: "middle", indent: 1 };
    card1Val.border = ExcelDesignSystem.borders.thin;

    ws.mergeCells(`A${currentRow + 1}:D${currentRow + 1}`);
    const card1Note = ws.getCell(`A${currentRow + 1}`);
    card1Note.value = `ℹ️  ${kpi1.note || "Operational Metric"}`;
    card1Note.font = ExcelDesignSystem.fonts.kpiNote;
    card1Note.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: i % 4 === 0 ? "F0FDF4" : "EFF6FF" },
    };
    card1Note.alignment = { vertical: "middle", indent: 1 };
    card1Note.border = ExcelDesignSystem.borders.thin;

    // Card 2: Columns F - I (if exists)
    if (kpi2) {
      ws.mergeCells(`F${currentRow}:I${currentRow}`);
      const card2Val = ws.getCell(`F${currentRow}`);
      card2Val.value = `${kpi2.label.toUpperCase()}:  ${kpi2.value}`;
      card2Val.font = ExcelDesignSystem.fonts.kpiValue;
      card2Val.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: i % 4 === 0 ? "EFF6FF" : "F0FDF4" },
      };
      card2Val.alignment = { vertical: "middle", indent: 1 };
      card2Val.border = ExcelDesignSystem.borders.thin;

      ws.mergeCells(`F${currentRow + 1}:I${currentRow + 1}`);
      const card2Note = ws.getCell(`F${currentRow + 1}`);
      card2Note.value = `ℹ️  ${kpi2.note || "Operational Metric"}`;
      card2Note.font = ExcelDesignSystem.fonts.kpiNote;
      card2Note.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: i % 4 === 0 ? "EFF6FF" : "F0FDF4" },
      };
      card2Note.alignment = { vertical: "middle", indent: 1 };
      card2Note.border = ExcelDesignSystem.borders.thin;
    }

    currentRow += 3;
  }

  // 3. Section Header: Field Representative Performance Leaderboard
  currentRow += 1;
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const mrHeader = ws.getCell(`A${currentRow}`);
  mrHeader.value = "2. FIELD REPRESENTATIVE PERFORMANCE & CLOSING LEADERBOARD";
  mrHeader.font = ExcelDesignSystem.fonts.sectionHeader;
  ws.getRow(currentRow).height = 26;
  currentRow++;

  if (options.mrSummaryTable && options.mrSummaryTable.rows.length > 0) {
    const tableHeaders = options.mrSummaryTable.headers;
    const headerRow = ws.getRow(currentRow);
    headerRow.height = 26;

    tableHeaders.forEach((headerText, colIndex) => {
      const cell = headerRow.getCell(colIndex + 1);
      cell.value = headerText.toUpperCase();
      cell.font = ExcelDesignSystem.fonts.tableHeader;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelDesignSystem.palette.royalBlue },
      };
      cell.alignment = {
        horizontal: colIndex === 0 ? "left" : "center",
        vertical: "middle",
      };
      cell.border = ExcelDesignSystem.borders.thin;
    });

    currentRow++;

    // Leaderboard Rows
    options.mrSummaryTable.rows.forEach((rowValues, rowIndex) => {
      const dataRow = ws.getRow(currentRow);
      dataRow.height = 22;
      const isEven = rowIndex % 2 === 0;

      rowValues.forEach((val, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        cell.value = val;
        cell.font = ExcelDesignSystem.fonts.cellRegular;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? ExcelDesignSystem.palette.pureWhite : ExcelDesignSystem.palette.zebraRow },
        };
        cell.border = ExcelDesignSystem.borders.thin;

        // Alignment and Number Formatting
        if (colIndex === 0) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.font = ExcelDesignSystem.fonts.cellBold;
        } else if (typeof val === "number") {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          if (tableHeaders[colIndex].includes("₹") || tableHeaders[colIndex].includes("Value")) {
            cell.numFmt = "₹#,##0.00";
          } else {
            cell.numFmt = "#,##0";
          }
        } else if (String(val).endsWith("%")) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }

        // Special Badge for Grade (last column)
        if (colIndex === rowValues.length - 1 && typeof val === "string") {
          cell.font = ExcelDesignSystem.fonts.badgeText;
          if (val.includes("A")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "065F46" } };
          } else if (val.includes("B")) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBEAFE" } };
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "1E40AF" } };
          }
        }
      });
      currentRow++;
    });
  }

  // 4. Section Header: Pipeline Deal Stages Breakdown
  currentRow += 2;
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const stageHeader = ws.getCell(`A${currentRow}`);
  stageHeader.value = "3. COMMERCIAL PIPELINE STAGES & TACTICAL PLAYBOOK";
  stageHeader.font = ExcelDesignSystem.fonts.sectionHeader;
  ws.getRow(currentRow).height = 26;
  currentRow++;

  if (options.stageSummaryTable && options.stageSummaryTable.rows.length > 0) {
    const stageHeaders = options.stageSummaryTable.headers;
    const stageHeaderRow = ws.getRow(currentRow);
    stageHeaderRow.height = 24;

    stageHeaders.forEach((h, colIndex) => {
      const cell = stageHeaderRow.getCell(colIndex + 1);
      cell.value = h.toUpperCase();
      cell.font = ExcelDesignSystem.fonts.tableHeader;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelDesignSystem.palette.headerNavy },
      };
      cell.alignment = {
        horizontal: colIndex === 0 ? "left" : colIndex === 1 ? "center" : "left",
        vertical: "middle",
      };
      cell.border = ExcelDesignSystem.borders.thin;
    });

    currentRow++;

    options.stageSummaryTable.rows.forEach((rowVals, rIdx) => {
      const sRow = ws.getRow(currentRow);
      sRow.height = 22;
      const isEven = rIdx % 2 === 0;

      rowVals.forEach((val, cIdx) => {
        const cell = sRow.getCell(cIdx + 1);
        cell.value = val;
        cell.font = ExcelDesignSystem.fonts.cellRegular;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? ExcelDesignSystem.palette.pureWhite : ExcelDesignSystem.palette.zebraRow },
        };
        cell.border = ExcelDesignSystem.borders.thin;

        if (cIdx === 0) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.font = ExcelDesignSystem.fonts.cellBold;
        } else if (cIdx === 1) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "#,##0";
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
      currentRow++;
    });
  }

  // Set column widths for Dashboard
  ws.getColumn(1).width = 30; // MR Name / Metric
  ws.getColumn(2).width = 16; // Total Calls
  ws.getColumn(3).width = 16; // Doctor Calls
  ws.getColumn(4).width = 16; // Chemist Calls
  ws.getColumn(5).width = 16; // Boxes
  ws.getColumn(6).width = 18; // POB
  ws.getColumn(7).width = 20; // Pipeline
  ws.getColumn(8).width = 14; // Hot Deals
  ws.getColumn(9).width = 18; // Close This Week
  ws.getColumn(10).width = 16; // Win Rate %
  ws.getColumn(11).width = 14; // Grade
}

// ============================================================================
// AGENT 3: DEAL CLOSURE & HOT DEALS SHEET BUILDER AGENT
// ============================================================================
function buildDealClosureSheet(workbook: ExcelJS.Workbook, options: ExcelDashboardExportOptions) {
  const ws = workbook.addWorksheet("🎯 Deal Closure & Hot Leads", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  // Title Banner (Rows 1 to 2)
  ws.mergeCells("A1:V1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "AI DEAL CLOSURE INTELLIGENCE — PRIORITIZED COMMERCIAL OPPORTUNITIES & HOT LEADS";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.deepEmerald },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:V2");
  const subCell = ws.getCell("A2");
  subCell.value = `Scope: ${options.scopeMR || "All Representatives"} | Reconciled with Live ERP Secondary Orders & Invoices | Top AI Recommendations`;
  subCell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "D1FAE5" } };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.deepEmerald },
  };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // Spacer row
  ws.getRow(3).height = 8;

  // Column Headers (Row 4)
  const headerRow = ws.getRow(4);
  headerRow.height = 28;

  const headers = options.detailHeaders;
  headers.forEach((headerText, colIndex) => {
    const cell = headerRow.getCell(colIndex + 1);
    cell.value = headerText.toUpperCase();
    cell.font = ExcelDesignSystem.fonts.tableHeader;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelDesignSystem.palette.headerNavy },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = ExcelDesignSystem.borders.thin;
  });

  // Enable Auto-filter on Row 4
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: headers.length },
  };

  // Populate Data Rows (Row 5+)
  let currentRow = 5;
  options.detailRows.forEach((rowValues, rowIndex) => {
    const dataRow = ws.getRow(currentRow);
    dataRow.height = 38; // Generous height for wrapped comments & guidance
    const isEven = rowIndex % 2 === 0;

    rowValues.forEach((val, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.value = val;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? ExcelDesignSystem.palette.pureWhite : ExcelDesignSystem.palette.zebraRow },
      };
      cell.border = ExcelDesignSystem.borders.thin;

      const header = headers[colIndex] || "";

      // Smart Alignment & Formatting
      if (header.includes("Name") || header.includes("Customer")) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
        cell.font = ExcelDesignSystem.fonts.cellBold;
      } else if (header.includes("MR Field Comments") || header.includes("Guidance") || header.includes("Reason")) {
        cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        // Highlight MR comments in soft cream
        if (header.includes("MR Field Comments")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEB" } };
        }
      } else if (header.includes("Can Close This Week")) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = ExcelDesignSystem.fonts.badgeText;
        if (String(val).includes("YES")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "065F46" } };
        } else {
          cell.font = { name: "Segoe UI", size: 9, color: { argb: "94A3B8" } };
        }
      } else if (header.includes("Priority")) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = ExcelDesignSystem.fonts.badgeText;
        if (String(val).includes("CRITICAL")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E6" } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "9F1239" } };
        } else if (String(val).includes("HIGH")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "92400E" } };
        }
      } else if (header.includes("Probability") || String(val).endsWith("%")) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = ExcelDesignSystem.fonts.cellBold;
      } else if (typeof val === "number" || header.includes("Total Invoiced") || header.includes("Estimated Deal Value")) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (typeof val === "number") {
          cell.numFmt = "₹#,##0.00";
        }
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    currentRow++;
  });

  // Calculate customized generous column widths
  headers.forEach((h, idx) => {
    const col = ws.getColumn(idx + 1);
    if (h.includes("Customer") || h.includes("Name")) col.width = 28;
    else if (h.includes("MR Field Comments")) col.width = 46;
    else if (h.includes("Guidance")) col.width = 54;
    else if (h.includes("Close This Week Reason")) col.width = 42;
    else if (h.includes("Deal Stage")) col.width = 24;
    else if (h.includes("Category")) col.width = 24;
    else if (h.includes("Assigned MR")) col.width = 22;
    else if (h.includes("Territory")) col.width = 20;
    else if (h.includes("Invoiced") || h.includes("Deal Value")) col.width = 20;
    else if (h.includes("Can Close")) col.width = 22;
    else if (h.includes("Probability") || h.includes("Tier") || h.includes("Priority")) col.width = 16;
    else col.width = 18;
  });
}

// ============================================================================
// AGENT 4: COMPLETE DCR CALL LOGS SHEET BUILDER AGENT
// ============================================================================
function buildCallLogsSheet(workbook: ExcelJS.Workbook, options: ExcelDashboardExportOptions) {
  if (!options.callLogsHeaders || !options.callLogsRows || options.callLogsRows.length === 0) {
    return;
  }

  const ws = workbook.addWorksheet("📋 All Customer Call Reports", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  // Title Banner (Rows 1 to 2)
  ws.mergeCells("A1:P1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "METAPHARSIC LIFESCIENCES — DAILY CALL REPORTS (DCR) & FIELD FEEDBACK AUDIT LOG";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.royalBlue },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:P2");
  const subCell = ws.getCell("A2");
  subCell.value = `Total Logged Visits: ${options.callLogsRows.length} | Complete MR Voice-of-Customer Detailing & Quality Audit`;
  subCell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "DBEAFE" } };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.royalBlue },
  };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;

  // Header Row (Row 4)
  const headerRow = ws.getRow(4);
  headerRow.height = 26;
  const headers = options.callLogsHeaders;

  headers.forEach((h, colIndex) => {
    const cell = headerRow.getCell(colIndex + 1);
    cell.value = h.toUpperCase();
    cell.font = ExcelDesignSystem.fonts.tableHeader;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelDesignSystem.palette.headerNavy },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = ExcelDesignSystem.borders.thin;
  });

  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: headers.length },
  };

  // Populate Data Rows
  let currentRow = 5;
  options.callLogsRows.forEach((rowVals, rIdx) => {
    const row = ws.getRow(currentRow);
    row.height = 34; // Allow 2 lines of wrapped feedback
    const isEven = rIdx % 2 === 0;

    rowVals.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.font = ExcelDesignSystem.fonts.cellRegular;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? ExcelDesignSystem.palette.pureWhite : ExcelDesignSystem.palette.zebraRow },
      };
      cell.border = ExcelDesignSystem.borders.thin;

      const header = headers[cIdx] || "";

      if (header.includes("Comments") || header.includes("Feedback")) {
        cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEFCE8" } }; // Soft highlight
      } else if (header.includes("Customer") || header.includes("Name")) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
        cell.font = ExcelDesignSystem.fonts.cellBold;
      } else if (header.includes("CQS") || header.includes("Score") || header.includes("Duration") || header.includes("Boxes")) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    currentRow++;
  });

  // Column Widths for Call Logs
  headers.forEach((h, idx) => {
    const col = ws.getColumn(idx + 1);
    if (h.includes("Comments") || h.includes("Feedback")) col.width = 48;
    else if (h.includes("Customer") || h.includes("Name")) col.width = 28;
    else if (h.includes("Representative") || h.includes("MR")) col.width = 22;
    else if (h.includes("Territory")) col.width = 20;
    else if (h.includes("Purpose") || h.includes("Follow-Up")) col.width = 26;
    else if (h.includes("Date")) col.width = 18;
    else col.width = 16;
  });
}

// ============================================================================
// AGENT 5: WORKBOOK MASTER ASSEMBLY & EXPORT ORCHESTRATOR
// ============================================================================
export async function generateProfessionalExcelWorkbook(options: ExcelDashboardExportOptions): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Metapharsic LifeSciences AI Enterprise";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Build Tab 1: Executive Dashboard
  buildExecutiveDashboardSheet(workbook, options);

  // 2. Build Tab 2: Deal Closure Intelligence & Hot Leads
  buildDealClosureSheet(workbook, options);

  // 3. Build Tab 3: Complete DCR Call Logs & Feedback (if provided)
  if (options.callLogsHeaders && options.callLogsRows) {
    buildCallLogsSheet(workbook, options);
  }

  // Generate binary XLSX buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Downloads a high-impact, professional client-ready .xlsx workbook directly in the user's browser
 */
export async function downloadExcelReportWithDashboard(options: ExcelDashboardExportOptions, filename: string) {
  try {
    // Ensure filename ends with .xlsx
    const xlsxFilename = filename.endsWith(".xlsx") ? filename : filename.replace(/\.csv$/, "") + ".xlsx";

    const buffer = await generateProfessionalExcelWorkbook(options);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    if (typeof window !== "undefined") {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = xlsxFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("[ExcelExport] Failed to generate professional Excel workbook:", error);
    // Fallback to CSV if ExcelJS fails in legacy browsers
    const csv = generateExcelReportWithDashboard(options);
    downloadFile(csv, filename.replace(/\.xlsx$/, ".csv"));
  }
}

/**
 * Legacy CSV export fallback generator
 */
export function generateExcelReportWithDashboard(options: ExcelDashboardExportOptions): string {
  const lines: string[] = [];
  const BOM = "\uFEFF";

  function formatForCsv(val: any): string {
    if (val == null) return "";
    const str = String(val).trim();
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  lines.push("METAPHARSIC LIFESCIENCES — EXECUTIVE INTELLIGENCE DASHBOARD");
  lines.push(options.reportTitle);
  lines.push(`Generated: ${new Date().toLocaleString("en-IN")} | Scope: ${options.scopeMR || "All Representatives"}`);
  lines.push("");

  lines.push("--- EXECUTIVE KPI SCORECARD ---");
  lines.push(["Metric KPI", "Current Value", "Benchmark / Context"].map(formatForCsv).join(","));
  for (const kpi of options.kpis) {
    lines.push([kpi.label, String(kpi.value), kpi.note || ""].map(formatForCsv).join(","));
  }
  lines.push("");

  if (options.mrSummaryTable?.rows.length) {
    lines.push("--- FIELD REPRESENTATIVE PERFORMANCE & CLOSING LEADERBOARD ---");
    lines.push(options.mrSummaryTable.headers.map(formatForCsv).join(","));
    for (const r of options.mrSummaryTable.rows) {
      lines.push(r.map(formatForCsv).join(","));
    }
    lines.push("");
  }

  lines.push("--- GRANULAR AUDIT & DETAILED TRANSACTION RECORDS ---");
  lines.push(options.detailHeaders.map(formatForCsv).join(","));
  for (const row of options.detailRows) {
    lines.push(row.map(formatForCsv).join(","));
  }

  return BOM + lines.join("\r\n");
}

export function generateExcelCsv(headers: string[], rows: (string | number)[][], title?: string): string {
  return generateExcelReportWithDashboard({
    reportTitle: title || "Data Export",
    kpis: [],
    detailHeaders: headers,
    detailRows: rows,
  });
}

export function downloadFile(content: string, filename: string, mimeType = "text/csv;charset=utf-8;") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportCurrentPageToExcel(customTitle?: string): { success: boolean; rowsCount: number; message: string } {
  if (typeof window === "undefined") {
    return { success: false, rowsCount: 0, message: "Window not defined" };
  }
  const cleanPath = window.location.pathname.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "") || "Dashboard";
  const filename = `Metapharsic_${cleanPath}_${new Date().toISOString().slice(0, 10)}.csv`;
  const table = document.querySelector("table");
  if (!table) return { success: false, rowsCount: 0, message: "No table found" };

  const headers: string[] = [];
  table.querySelectorAll("thead th").forEach((th) => headers.push((th.textContent || "").trim()));
  const rows: (string | number)[][] = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const rowVals: string[] = [];
    tr.querySelectorAll("td").forEach((td) => rowVals.push((td.textContent || "").trim()));
    if (rowVals.length) rows.push(rowVals);
  });

  const csv = generateExcelReportWithDashboard({
    reportTitle: customTitle || cleanPath,
    kpis: [],
    detailHeaders: headers,
    detailRows: rows,
  });
  downloadFile(csv, filename);
  return { success: true, rowsCount: rows.length, message: `Exported ${rows.length} rows.` };
}
