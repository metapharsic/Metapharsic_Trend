/**
 * @jest-environment node
 */
import ExcelJS from "exceljs";
import { applyWorkbookWatermark, DEFAULT_WATERMARK_COMPANY } from "../lib/watermark";
import { generateExcelCsv, generateProfessionalExcelWorkbook } from "../lib/excel-export";

describe("ExcelJS Workbook Binary Watermarks", () => {
  it("embeds background PNG watermark & print header/footer across all sheets", async () => {
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Summary");
    const ws2 = wb.addWorksheet("Details");
    ws1.addRow(["Item", "Qty"]);
    ws2.addRow(["Line", 10]);

    applyWorkbookWatermark(wb, { documentTitle: "Unit Test Workbook" });
    expect(wb.company).toBe(DEFAULT_WATERMARK_COMPANY);
    expect(ws1.headerFooter.oddHeader).toContain(DEFAULT_WATERMARK_COMPANY);
    expect(ws2.headerFooter.oddFooter).toContain(DEFAULT_WATERMARK_COMPANY);

    const buf = await wb.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buf as ArrayBuffer);
    expect(loaded.getWorksheet("Summary")?.getBackgroundImageId()).toBeDefined();
    expect(loaded.getWorksheet("Details")?.getBackgroundImageId()).toBeDefined();
  });

  it("watermarks universal professional Excel & CSV exports", async () => {
    expect(generateExcelCsv(["Col1"], [["Val1"]], "Demo")).toContain("WATERMARK");

    const profBuf = await generateProfessionalExcelWorkbook({
      reportTitle: "Executive Report",
      kpis: [{ label: "Sales", value: 100 }],
      detailHeaders: ["A"],
      detailRows: [["X"]],
    });
    const wbProf = new ExcelJS.Workbook();
    await wbProf.xlsx.load(profBuf);
    expect(wbProf.worksheets.length).toBeGreaterThanOrEqual(2);
    for (const sheet of wbProf.worksheets) {
      expect(sheet.getBackgroundImageId()).toBeDefined();
    }
  });
});
