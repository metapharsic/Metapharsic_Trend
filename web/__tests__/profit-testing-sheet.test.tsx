/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfitTestingSheet } from "../components/admin/profit-testing-sheet";
import {
  buildReferenceSheetRows,
  buildRowsFromCatalogProducts,
  computeProfitTestingSheet,
  DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
} from "../lib/profit-testing";
import { apiClient } from "../lib/api-client";

jest.mock("../lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

const MOCK_CATALOG_PRODUCTS = [
  {
    id: "prod-cv",
    name: "Metamox-CV",
    sku: "MET-CV-100",
    packSize: "10X10 Alu Alu",
    mrp: 196.7,
    ptr: 157.4,
    pts: 125.92,
    purchaseRate: 47.4,
    gstPct: 5,
  },
  {
    id: "prod-p",
    name: "Metace-P",
    sku: "MET-P-100",
    packSize: "10X10 Blister",
    mrp: 68.5,
    ptr: 54.8,
    pts: 43.84,
    purchaseRate: 6.35,
    gstPct: 5,
  },
];

describe("Profit Testing Sheet calculation engine & UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        data: { products: MOCK_CATALOG_PRODUCTS, total: MOCK_CATALOG_PRODUCTS.length },
      },
    });
  });

  it("matches exact line-by-line & summary values for the reference Profit Testing Sheet (PTR cost basis, 10+5 free)", () => {
    const rows = buildReferenceSheetRows([], 10);
    const { computedRows, summary } = computeProfitTestingSheet(
      DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
      rows
    );

    // Row 1: Metaclav-CV (10 billed, 5 free, PTR 157.42)
    const r1 = computedRows[0];
    expect(r1.item).toBe("Metaclav-CV");
    expect(r1.totalQty).toBe(15);
    expect(r1.billedSales).toBe(1574.2);
    expect(r1.salesGst).toBe(0);
    expect(r1.invoiceTotal).toBe(1574.2);
    expect(r1.freeValueAtPtr).toBe(787.1);
    expect(r1.freeStripCost).toBe(787.1);
    expect(r1.purchaseCost).toBe(2361.3);
    expect(r1.purchaseGst).toBe(118.07);
    expect(r1.cashOutlayInclGst).toBe(2479.37);
    expect(r1.grossProfit).toBe(-787.1);
    expect(r1.doctorCost).toBe(314.84);
    expect(r1.netProfit).toBe(-1101.94);
    expect(r1.netMarginPct).toBe(-70);

    // Reference Summary Totals (7 active SKUs)
    expect(summary.activeRowsCount).toBe(7);
    expect(summary.totalBilledQty).toBe(70);
    expect(summary.totalFreeQty).toBe(35);
    expect(summary.totalQty).toBe(105);
    expect(summary.billedSalesExclGst).toBe(6227.6);
    expect(summary.salesGstCollected).toBe(0);
    expect(summary.invoiceTotalInclGst).toBe(6227.6);
    expect(summary.freeValueAtPtr).toBe(3113.8);
    expect(summary.freeStripCost).toBe(3113.8);
    expect(summary.purchaseCostExclGst).toBe(9341.4);
    expect(summary.purchaseGstPaid).toBe(467.07);
    expect(summary.purchaseCashOutlayInclGst).toBe(9808.47);
    expect(summary.grossProfitAfterInputGstCredit).toBe(-3113.8);
    expect(summary.doctorCommission).toBe(1245.52);
    expect(summary.lineItemNetProfitBeforeOtherCharges).toBe(-4359.32);
    expect(summary.otherCharges).toBe(2500);
    expect(summary.netProfitEarnings).toBe(-6859.32);
    expect(summary.inputGstCredit).toBe(467.07);
    expect(summary.cashEarningsBeforeInputGstCredit).toBe(-7326.39);
    expect(summary.netGstPosition).toBe(-467.07);
  });

  it("computes positive net profit under Catalog Purchase Rate cost basis and respects Sales GST & NON_RECOVERABLE mode", () => {
    const rows = buildReferenceSheetRows([], 10);
    const { summary } = computeProfitTestingSheet(
      {
        ...DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
        costBasisMode: "CATALOG_PURCHASE_RATE",
        salesGstPct: 5,
      },
      rows
    );

    expect(summary.salesGstCollected).toBe(311.39);
    expect(summary.invoiceTotalInclGst).toBe(6538.99);
    // Real catalog purchase cost (15 strips each @ factory rates: 123.99 * 15 = 1859.85) << billed sales 6227.60
    expect(summary.purchaseCostExclGst).toBe(1859.85);
    expect(summary.purchaseGstPaid).toBe(93.01);
    expect(summary.grossProfitAfterInputGstCredit).toBe(4367.75);
    expect(summary.lineItemNetProfitBeforeOtherCharges).toBe(3122.23);
    expect(summary.netProfitEarnings).toBe(622.23);
    expect(summary.cashEarningsBeforeInputGstCredit).toBe(529.22);
    expect(summary.netGstPosition).toBe(218.38);
    expect(summary.netMarginPct).toBe(9.99);

    const nonRec = computeProfitTestingSheet(
      {
        ...DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
        costBasisMode: "CATALOG_PURCHASE_RATE",
        taxTreatment: "NON_RECOVERABLE",
      },
      rows
    );
    expect(nonRec.summary.inputGstCredit).toBe(0);
    expect(nonRec.summary.grossProfitAfterInputGstCredit).toBeLessThan(
      summary.grossProfitAfterInputGstCredit
    );
  });

  it("builds rows cleanly from live catalog products without trailing empty rows", () => {
    const refRows = buildReferenceSheetRows([]);
    expect(refRows).toHaveLength(7);

    const catalogRows = buildRowsFromCatalogProducts(
      MOCK_CATALOG_PRODUCTS.map((p) => ({ ...p, marginStructure: null })),
      10,
      2
    );
    expect(catalogRows).toHaveLength(2);
    expect(catalogRows[0].item).toBe("Metamox-CV");
    expect(catalogRows[0].billedQty).toBe(10);
    expect(catalogRows[0].freeQty).toBe(2);
    expect(catalogRows[1].item).toBe("Metace-P");
  });

  it("renders Profit Testing Sheet UI, syncs live catalog read-only, and recalculates on input changes", async () => {
    render(<ProfitTestingSheet />);

    expect(await screen.findByText("Profit Testing Sheet")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/products?limit=100");
    // Only the 7 active reference rows render by default (no empty rows 8, 9, 10)
    expect(screen.queryByLabelText("Item name row 8")).not.toBeInTheDocument();

    // Reference sheet initial net profit displayed
    expect(screen.getByTestId("summary-net-profit-hero")).toHaveTextContent("(₹6,859.32)");

    // Switch cost basis from PTR to Catalog Purchase Rate
    fireEvent.change(screen.getByLabelText("Cost Basis"), {
      target: { value: "CATALOG_PURCHASE_RATE" },
    });
    expect(await screen.findByText("Net Profitable")).toBeInTheDocument();

    // Overwrite Row 1 Sell Rate to ₹200 and verify both Billed Sales & Invoice Total update immediately
    fireEvent.change(screen.getByLabelText("Sell Rate row 1"), {
      target: { value: "200" },
    });
    expect((await screen.findAllByText("₹2,000.00")).length).toBeGreaterThanOrEqual(2);

    // Load live catalog into sheet
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Load Live Catalog/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /Load Live Catalog/i }));
    expect(screen.getByDisplayValue("Metamox-CV")).toBeInTheDocument();

    // Toggle Compact Fit View <-> All 23 Sheet Columns
    expect(screen.getByText("Sales GST")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Compact Fit View/i }));
    expect(screen.queryByText("Sales GST")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All 23 Sheet Columns/i }));
    expect(screen.getByText("Sales GST")).toBeInTheDocument();
  });
});
