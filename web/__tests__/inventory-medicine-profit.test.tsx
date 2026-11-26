/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryPage from "../app/(dashboard)/inventory/page";
import { apiClient } from "../lib/api-client";

jest.mock("../lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

const MOCK_ADMIN_PRODUCTS = [
  {
    id: "prod-cv",
    name: "Metamox-CV",
    sku: "MET-CV-100",
    price: 157.4,
    composition: "Amoxicillin 500mg + Clavulanic Acid 125mg",
    strength: "625mg",
    packSize: "10X10 Alu Alu",
    mrp: 196.7,
    ptr: 157.4,
    pts: 157.4,
    purchaseRate: 47.4,
    costBasisExact: true,
    costBasisSource: "purchaseRate",
    grossMarginPct: 69.9,
    stockQty: 2224,
    stockBoxes: 222.4,
    earliestStockQty: 300,
    mrSampleQty: 150,
    stockValue: 350057.6,
    stockValueAtCost: 105417.6,
    unitProfit: 110,
    potentialStockProfit: 244640,
    therapySegment: "Anti-infectives",
    hsnCode: "30049099",
    gstPct: 5,
    currentBatchNo: "TB26-0108D",
    currentMfgDate: "2026-05-01T00:00:00.000Z",
    currentExpDate: "2028-04-30T00:00:00.000Z",
    lastMovementAt: "2026-11-26T13:39:00.000Z",
    forecast: { burnRatePerDay: 4.5, daysRemaining: 494 },
    profitAnalytics: {
      invoicedCount: 48,
      invoicedBilledQty: 496,
      invoicedFreeQty: 280,
      freeRatioPct: 36.08,
      realizedRevenue: 77235.94,
      realizedCost: 36782.4,
      billedCostOnly: 23510.4,
      freeCostBurden: 13272,
      realizedProfit: 40453.54,
      realizedMarginPct: 52.38,
      exactCost: true,
    },
  },
];

describe("Central Product Inventory — 360° Medicine Knowledge & Profit Intelligence", () => {
  beforeEach(() => {
    const fakePayload = btoa(JSON.stringify({ sub: "admin-1", role: "ADMIN" }));
    localStorage.setItem("accessToken", `hdr.${fakePayload}.sig`);

    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/products") {
        return Promise.resolve({ data: { data: { products: MOCK_ADMIN_PRODUCTS } } });
      }
      if (url === "/api/manager/mr-stock") {
        return Promise.resolve({ data: { data: { reps: [] } } });
      }
      if (url === "/api/team") {
        return Promise.resolve({ data: { data: { team: [] } } });
      }
      if (url === "/api/products/prod-cv/intelligence") {
        return Promise.resolve({
          data: {
            data: {
              monthlyTrend: [
                {
                  month: "2026-11",
                  invoicesCount: 6,
                  billedQty: 80,
                  freeQty: 58,
                  revenue: 12592,
                  cost: 6541.2,
                  profit: 6050.8,
                  marginPct: 48.05,
                },
              ],
              topChemists: [
                {
                  chemistId: "ch-1",
                  chemistName: "Raza Medical Store",
                  area: "Charminar",
                  invoicesCount: 8,
                  billedQty: 90,
                  freeQty: 45,
                  totalUnits: 135,
                  revenue: 14166,
                  profit: 7767,
                  marginPct: 54.83,
                  lastOrderDate: "2026-11-23T17:29:20.597Z",
                },
              ],
              mrBreakdown: [
                {
                  employeeId: "mr-1",
                  mrName: "Abdul Malik",
                  invoicesCount: 25,
                  billedQty: 270,
                  freeQty: 150,
                  sampleQtyHeld: 70,
                  lastSampleGivenAt: "2026-08-22T12:57:09.208Z",
                  revenue: 42498,
                  profit: 22590,
                  marginPct: 53.16,
                },
              ],
              schemeMix: [
                {
                  ratioLabel: "10+5",
                  linesCount: 24,
                  billedQty: 240,
                  freeQty: 120,
                  revenue: 37776,
                  cost: 17064,
                  profit: 20712,
                  marginPct: 54.83,
                },
              ],
              recentInvoices: [
                {
                  invoiceNo: "INV-1795454960591-DE0C6D",
                  date: "2026-11-23T17:29:20.597Z",
                  partyName: "Raza Medical Store",
                  area: "Charminar",
                  mrName: "Abdul Malik",
                  billedQty: 10,
                  freeQty: 5,
                  unitRate: 157.4,
                  lineRevenue: 1574,
                  lineCost: 711,
                  lineProfit: 863,
                  lineMarginPct: 54.83,
                },
              ],
            },
          },
        });
      }
      if (url === "/api/products/prod-cv/movements") {
        return Promise.resolve({
          data: {
            data: {
              movements: [
                {
                  id: "mov-1",
                  type: "MANUAL_ADJUSTMENT",
                  delta: 2218,
                  quantityAfter: 2224,
                  note: "Opening 300 boxes (3000 strips) - 496 billed - 280 free across 100 invoices = 2224 strips",
                  createdAt: "2026-11-26T13:39:00.000Z",
                  employee: { firstName: "System", lastName: "Admin" },
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("renders Medicine Cards with enhanced banner & download menus, switches to Full Table without PTS, and explores all 4 Dossier tabs", async () => {
    const createObjectUrlSpy = jest.fn(() => "blob:mock-url");
    const revokeObjectUrlSpy = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { writable: true, value: createObjectUrlSpy });
    Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: revokeObjectUrlSpy });
    const anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const mockPrintWin = {
      document: { open: jest.fn(), write: jest.fn(), close: jest.fn() },
      focus: jest.fn(),
      print: jest.fn(),
    } as unknown as Window;
    const windowOpenSpy = jest.spyOn(window, "open").mockReturnValue(mockPrintWin);

    render(<InventoryPage />);

    expect((await screen.findAllByText("Metamox-CV")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Beta-Lactam Antibiotic + Beta-Lactamase Inhibitor")).toBeInTheDocument();
    expect(screen.getByText("₹47.40 / +₹110.00")).toBeInTheDocument();
    expect(screen.getByText("PTR Billing Only")).toBeInTheDocument();
    expect(screen.getByText(/2,224 Strips \(222\.4 Boxes\)/i)).toBeInTheDocument();

    // Open Portfolio Download Report menu and verify all 5 formats
    const downloadReportBtn = screen.getByRole("button", { name: /Download Report/i });
    fireEvent.click(downloadReportBtn);
    expect(screen.getByRole("menuitem", { name: /Excel Workbook \(\.xlsx\)/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /CSV Spreadsheet \(\.csv\)/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Styled HTML Report \(\.html\)/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Print \/ Save as PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /JSON Audit Snapshot \(\.json\)/i })).toBeInTheDocument();

    // Trigger CSV download and verify anchor click + blob URL
    fireEvent.click(screen.getByRole("menuitem", { name: /CSV Spreadsheet \(\.csv\)/i }));
    await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalledTimes(1));
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);

    // Trigger Print / PDF report
    fireEvent.click(screen.getByRole("button", { name: /Download Report/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Print \/ Save as PDF/i }));
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);

    // Verify Full Table hides PTS
    fireEvent.click(screen.getByRole("button", { name: /^Full Table$/i }));
    expect(screen.queryByRole("columnheader", { name: /^PTS$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^PTR$/i })).toBeInTheDocument();

    // Switch back to Medicine Cards & open full 4-tab Medicine Dossier
    fireEvent.click(screen.getByRole("button", { name: /^Medicine Cards$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Know Medicine & Profit/i }));

    await waitFor(() => expect(screen.getByText("Unit Economics / Strip")).toBeInTheDocument());
    expect(screen.getByText("(₹13,272.00)")).toBeInTheDocument();

    // Open Download Dossier menu inside MedicineDetailModal and trigger JSON snapshot
    const dossierDownloadBtn = screen.getByRole("button", { name: /Download Dossier/i });
    fireEvent.click(dossierDownloadBtn);
    expect(screen.getByRole("menuitem", { name: /Excel Workbook \(\.xlsx\)/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Styled HTML Report \(\.html\)/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Print \/ Save as PDF/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /JSON Audit Snapshot \(\.json\)/i }));
    await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalledTimes(2));

    // Simulate 20% doctor commission inside Overview & Profit tab
    fireEvent.click(screen.getByRole("button", { name: /20% Doc/i }));
    expect(screen.getByText(/25,006\.35/)).toBeInTheDocument();

    // Tab 2: Clinical & Detailing
    fireEvent.click(screen.getByRole("button", { name: /Clinical & Detailing/i }));
    expect(screen.getByText("Primary Clinical Indications")).toBeInTheDocument();
    expect(screen.getByText(/clavulanic acid irreversibly inactivates/i)).toBeInTheDocument();

    // Tab 3: Chemists, MRs & Sales
    fireEvent.click(screen.getByRole("button", { name: /Chemists, MRs & Sales/i }));
    await waitFor(() => expect(screen.getAllByText("Raza Medical Store").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Abdul Malik").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10+5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("INV-1795454960591-DE0C6D")).toBeInTheDocument();

    // Tab 4: Stock Ledger
    fireEvent.click(screen.getByRole("button", { name: /Stock Ledger/i }));
    await waitFor(() => expect(screen.getByText(/Opening 300 boxes/)).toBeInTheDocument());
  });
});
