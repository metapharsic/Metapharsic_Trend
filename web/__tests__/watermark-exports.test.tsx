/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { DocumentWatermark } from "../components/ui/document-watermark";
import {
  appendCsvWatermark,
  getWatermarkPngDataUrl,
  injectHtmlWatermark,
  DEFAULT_WATERMARK_COMPANY,
} from "../lib/watermark";
import { buildInventoryCsv, buildInventoryHtml, buildInventoryJson } from "../lib/inventory-exports";
import {
  buildProfitTestingCsv,
  buildProfitTestingHtml,
  buildProfitTestingJson,
  buildReferenceSheetRows,
  computeProfitTestingSheet,
  DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
} from "../lib/profit-testing";

describe("Watermark UI & Text Export Formats (HTML/PDF, CSV, JSON, PNG Tile)", () => {
  it("generates a valid transparent PNG watermark tile in pure TypeScript", () => {
    const dataUrl = getWatermarkPngDataUrl();
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(500);
  });

  it("applies watermarks to inventory, profit testing, and HTML/CSV/JSON exports", () => {
    const prod: any = {
      id: "p1",
      name: "Metamox-CV",
      sku: "MET-CV-100",
      price: 157.4,
      composition: "Amoxicillin 500mg + Clavulanic Acid 125mg",
      strength: "625mg",
      packSize: "10X10",
      mrp: 196.7,
      ptr: 157.4,
      purchaseRate: 47.4,
      stockQty: 2224,
      therapySegment: "Anti-infectives",
      currentBatchNo: "B1",
      currentMfgDate: null,
      currentExpDate: null,
    };

    const invCsv = buildInventoryCsv([prod], true);
    expect(invCsv).toContain("WATERMARK");
    expect(invCsv).toContain(DEFAULT_WATERMARK_COMPANY);

    const invHtml = buildInventoryHtml([prod], true);
    expect(invHtml).toContain("tmr-watermark-layer");
    expect(invHtml).toContain(DEFAULT_WATERMARK_COMPANY);

    const invJson = JSON.parse(buildInventoryJson([prod], true));
    expect(invJson._watermark.company).toBe(DEFAULT_WATERMARK_COMPANY);

    const ptRows = buildReferenceSheetRows([]);
    const pt = computeProfitTestingSheet(DEFAULT_PROFIT_TESTING_ASSUMPTIONS, ptRows);
    expect(buildProfitTestingCsv(DEFAULT_PROFIT_TESTING_ASSUMPTIONS, pt.computedRows, pt.summary)).toContain(
      DEFAULT_WATERMARK_COMPANY
    );
    expect(buildProfitTestingHtml(DEFAULT_PROFIT_TESTING_ASSUMPTIONS, pt.computedRows, pt.summary)).toContain(
      "tmr-watermark-layer"
    );
    expect(
      JSON.parse(buildProfitTestingJson(DEFAULT_PROFIT_TESTING_ASSUMPTIONS, pt.computedRows, pt.summary))._watermark
        .company
    ).toBe(DEFAULT_WATERMARK_COMPANY);

    expect(appendCsvWatermark("A\r\n1")).toContain(DEFAULT_WATERMARK_COMPANY);
    expect(injectHtmlWatermark("<html><head></head><body>Hi</body></html>")).toContain("tmr-watermark-layer");
  });

  it("renders DocumentWatermark for invoices, batch print sheets, and print-only layouts", () => {
    render(
      <DocumentWatermark
        companyName="Metapharsic Lifesciences"
        subtitle="OFFICIAL GST TAX INVOICE • BULK PRINT COPY"
        showCenterSeal
        variant="invoice"
      />
    );
    expect(screen.getByTestId("document-watermark")).toBeInTheDocument();
    expect(screen.getByText("METAPHARSIC LIFESCIENCES")).toBeInTheDocument();
    expect(screen.getByText("OFFICIAL GST TAX INVOICE • BULK PRINT COPY")).toBeInTheDocument();
  });
});
