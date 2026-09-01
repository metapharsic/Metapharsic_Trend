/**
 * Universal Excel / Spreadsheet Export Engine
 * Scans the active page for table data, KPI cards, or registered datasets
 * and generates clean, Excel-compatible (.csv / .xls compatible) spreadsheets with UTF-8 BOM.
 */

export interface ExportTableData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}

/**
 * Strips HTML, icons, badge noise and trims cell text
 */
function cleanCellText(cell: Element): string {
  // Clone to avoid modifying actual DOM
  const clone = cell.cloneNode(true) as HTMLElement;

  // Remove buttons, SVG icons, carets, select elements, inputs
  const unwanted = clone.querySelectorAll("button, svg, select, input, .lucide, [data-export-ignore]");
  unwanted.forEach((el) => el.remove());

  let text = clone.innerText || clone.textContent || "";
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Formats a value for Excel CSV, escaping quotes and wrapping in quotes if needed
 */
function formatForCsv(val: string | number | null | undefined): string {
  if (val == null) return "";
  const str = String(val).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts array of rows to CSV string with UTF-8 BOM for Excel compatibility
 */
export function generateExcelCsv(headers: string[], rows: (string | number)[][], title?: string): string {
  const lines: string[] = [];

  // UTF-8 BOM so Excel opens it with proper encoding (Rupee ₹, Unicode, Accents)
  const BOM = "\uFEFF";

  if (title) {
    lines.push(formatForCsv(`METAPHARSIC LIFESCIENCES — ${title.toUpperCase()}`));
    lines.push(formatForCsv(`Exported on: ${new Date().toLocaleString("en-IN")}`));
    lines.push("");
  }

  lines.push(headers.map(formatForCsv).join(","));

  for (const row of rows) {
    lines.push(row.map(formatForCsv).join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Triggers a client-side file download
 */
export function downloadFile(content: string, filename: string, mimeType = "text/csv;charset=utf-8;") {
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

/**
 * Scans the current page and exports any table found into Excel.
 * If no table is found, exports all KPI metric cards on the page.
 */
export function exportCurrentPageToExcel(customTitle?: string): { success: boolean; rowsCount: number; message: string } {
  if (typeof window === "undefined") {
    return { success: false, rowsCount: 0, message: "Window not defined" };
  }

  const pathname = window.location.pathname;
  const cleanPath = pathname === "/" ? "Dashboard" : pathname.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "");
  const pageTitle = customTitle || document.title.replace(/\|.*$/, "").trim() || cleanPath;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Metapharsic_${cleanPath}_${dateStr}.csv`;

  // 1. Check if the page registered a custom high-fidelity dataset
  const customData = (window as any).__pageExportData as ExportTableData | undefined;
  if (customData && customData.headers?.length && customData.rows?.length) {
    const csv = generateExcelCsv(customData.headers, customData.rows, customData.title || pageTitle);
    downloadFile(csv, filename);
    return {
      success: true,
      rowsCount: customData.rows.length,
      message: `Exported ${customData.rows.length} rows from page dataset to Excel.`,
    };
  }

  // 2. Scan for HTML <table> elements on the active page
  const tables = Array.from(document.querySelectorAll("table"));
  if (tables.length > 0) {
    // Collect all table rows (or the primary table with the most rows)
    let bestTable = tables[0];
    let maxRows = 0;
    for (const t of tables) {
      const rowCount = t.querySelectorAll("tbody tr, tr").length;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        bestTable = t;
      }
    }

    // Extract headers
    let headerCells = Array.from(bestTable.querySelectorAll("thead th, thead td"));
    if (headerCells.length === 0) {
      // Fallback to first row
      const firstRow = bestTable.querySelector("tr");
      if (firstRow) {
        headerCells = Array.from(firstRow.querySelectorAll("th, td"));
      }
    }

    const headers = headerCells.map(cleanCellText).filter(Boolean);

    // Extract rows
    const rowElements = Array.from(bestTable.querySelectorAll("tbody tr"));
    const finalRowElements = rowElements.length > 0 ? rowElements : Array.from(bestTable.querySelectorAll("tr")).slice(1);

    const rows: (string | number)[][] = [];

    for (const tr of finalRowElements) {
      const cells = Array.from(tr.querySelectorAll("td, th"));
      if (cells.length === 0) continue;
      const rowData = cells.map(cleanCellText);
      // Skip empty or purely decorative rows
      if (rowData.every((c) => c === "")) continue;
      rows.push(rowData);
    }

    if (rows.length > 0) {
      // Ensure headers match width
      const colCount = Math.max(headers.length, ...rows.map((r) => r.length));
      const adjustedHeaders = headers.length > 0 ? headers : Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
      while (adjustedHeaders.length < colCount) {
        adjustedHeaders.push(`Column ${adjustedHeaders.length + 1}`);
      }

      const csv = generateExcelCsv(adjustedHeaders, rows, pageTitle);
      downloadFile(csv, filename);

      return {
        success: true,
        rowsCount: rows.length,
        message: `Successfully exported ${rows.length} rows to Excel (${filename}).`,
      };
    }
  }

  // 3. Fallback: If no table exists on page, scan for KPI cards / stat tiles
  const cards = Array.from(document.querySelectorAll("[class*='rounded-2xl'], [class*='rounded-xl'], [class*='shadow']"))
    .filter((el) => {
      const text = (el as HTMLElement).innerText || "";
      return text.length > 0 && text.length < 200 && /\d/.test(text);
    });

  if (cards.length > 0) {
    const kpiRows: (string | number)[][] = [];
    const seen = new Set<string>();

    for (const card of cards) {
      const textLines = (card as HTMLElement).innerText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (textLines.length >= 2) {
        const metricValue = textLines.find((l) => /^₹?[\d,.]+(%|m|k|L|Cr)?$/i.test(l)) || textLines[1];
        const metricLabel = textLines.find((l) => l !== metricValue && l.length > 2) || textLines[0];

        const key = `${metricLabel}:${metricValue}`;
        if (!seen.has(key) && metricLabel && metricValue) {
          seen.add(key);
          kpiRows.push([metricLabel, metricValue]);
        }
      }
    }

    if (kpiRows.length > 0) {
      const csv = generateExcelCsv(["KPI Metric / Metric Name", "Value"], kpiRows, `${pageTitle} — KPI Executive Summary`);
      downloadFile(csv, `Metapharsic_${cleanPath}_KPIs_${dateStr}.csv`);
      return {
        success: true,
        rowsCount: kpiRows.length,
        message: `Exported ${kpiRows.length} KPI metrics to Excel.`,
      };
    }
  }

  return {
    success: false,
    rowsCount: 0,
    message: "No tabular data or metrics found to export on this page.",
  };
}
