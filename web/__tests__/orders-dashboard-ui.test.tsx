/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrdersDashboard from "../app/(dashboard)/orders/page";
import { apiClient } from "../lib/api-client";

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: any;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

jest.mock("../lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../components/edit-invoice-modal", () => ({
  EditInvoiceModal: () => <div data-testid="edit-invoice-modal" />,
}));

jest.mock("../components/prescribed-doctor-picker", () => ({
  PrescribedDoctorPicker: () => <div data-testid="prescribed-doctor-picker" />,
}));

jest.mock("../components/orders/invoicing-charts", () => ({
  InvoicingCharts: () => <div data-testid="invoicing-charts" />,
}));

jest.mock("../lib/orders-excel-export", () => ({
  downloadOrdersInvoicingExcel: jest.fn().mockResolvedValue(undefined),
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

function makeAdminJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "user-admin-1", role: "ADMIN" }));
  return `${header}.${payload}.sig`;
}

const sampleOrdersResponse = {
  orders: [
    {
      id: "ord-11112222",
      status: "PENDING",
      createdAt: "2026-11-25T09:00:00.000Z",
      chemist: {
        id: "chem-1",
        name: "Apollo Pharmacy",
        subArea: "Banjara Hills",
        beatName: "Beat Alpha",
        territory: { id: "ter-1", name: "Hyderabad South" },
      },
      doctor: { id: "doc-1", fullName: "Dr. Meera Nair", primarySpecialty: "Cardiology" },
      employee: { id: "emp-1", firstName: "Abdul", lastName: "Mannan" },
      distributor: { id: "dist-1", name: "MedLife Distributors" },
      items: [
        {
          id: "oi-1",
          quantity: 10,
          freeQty: 2,
          price: "120",
          discountPct: 5,
          gstPct: 12,
          batchNo: "B-204",
          expDate: "2027-08-01",
          product: { id: "prod-1", name: "CardioCare 10mg", sku: "CC-10" },
        },
      ],
      invoice: { id: "inv-1", invoiceNo: "INV-202611-1111", amount: "1200", grandTotal: "1344", paid: false },
      chemistOutstanding: 3500,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  statusCounts: { PENDING: 1, CONFIRMED: 2, SHIPPED: 0, DELIVERED: 3, CANCELLED: 0 },
};

const sampleInvoicesResponse = {
  invoices: [
    {
      id: "inv-1",
      orderId: "ord-11112222",
      invoiceNo: "INV-202611-1111",
      amount: "1200",
      grandTotal: "1344",
      paid: false,
      createdAt: "2026-11-25T09:00:00.000Z",
      order: {
        id: "ord-11112222",
        status: "PENDING",
        chemist: {
          id: "chem-1",
          name: "Apollo Pharmacy",
          subArea: "Banjara Hills",
          beatName: "Beat Alpha",
          territory: { id: "ter-1", name: "Hyderabad South" },
        },
        distributor: { id: "dist-1", name: "MedLife Distributors" },
        doctor: { id: "doc-1", fullName: "Dr. Meera Nair", primarySpecialty: "Cardiology" },
        employee: { id: "emp-1", firstName: "Abdul", lastName: "Mannan", user: { role: "MR" } },
        items: [],
      },
      revenue: 1200,
      cost: 800,
      profitAmount: 400,
      profitPct: 33.3,
      profitItems: [
        {
          id: "oi-1",
          productId: "prod-1",
          productName: "CardioCare 10mg",
          quantity: 10,
          freeQty: 2,
          billedPrice: 120,
          costBasis: 66.67,
          costBasisSource: "purchaseRate",
          lineRevenue: 1200,
          lineCost: 800,
          lineProfit: 400,
          lineProfitPct: 33.3,
        },
      ],
    },
  ],
  pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
  totals: {
    revenue: 42000,
    cost: 28000,
    profitAmount: 14000,
    profitPct: 33.3,
    purchaseProfitAmount: 14000,
    purchaseCostComplete: true,
  },
};

const sampleSummaryResponse = {
  summary: {
    totalInvoicedAmount: 42000,
    totalInvoicesCount: 25,
    totalPaidAmount: 26000,
    totalUnpaidAmount: 16000,
    collectionRatePct: 61.9,
    totalPendingOrdersCount: 1,
    totalPendingOrdersAmount: 5400,
    cadence: "ALL",
  },
  agingSummary: {
    current0To15Count: 3,
    current0To15Amount: 7000,
    aging16To30Count: 1,
    aging16To30Amount: 4000,
    overdue30PlusCount: 2,
    overdue30PlusAmount: 5000,
  },
  cadenceBreakdowns: [
    {
      bucketKey: "2026-11",
      bucketLabel: "November 2026",
      invoicedAmount: 42000,
      invoiceCount: 25,
      paidAmount: 26000,
      unpaidAmount: 16000,
      pendingOrdersCount: 1,
      pendingOrdersAmount: 5400,
    },
  ],
  areaBreakdowns: [
    {
      territoryId: "ter-1",
      territoryName: "Hyderabad South",
      subArea: "Banjara Hills",
      totalInvoiced: 42000,
      invoiceCount: 25,
      paidAmount: 26000,
      unpaidAmount: 16000,
      pendingOrdersCount: 1,
      pendingOrdersAmount: 5400,
    },
  ],
  personBreakdowns: [
    {
      employeeId: "emp-1",
      employeeName: "Abdul Mannan",
      role: "MR",
      totalInvoiced: 42000,
      invoiceCount: 25,
      paidAmount: 26000,
      unpaidAmount: 16000,
      pendingOrdersCount: 1,
      pendingOrdersAmount: 5400,
    },
  ],
  uninvoicedOrders: [
    {
      id: "ord-unbilled-1",
      orderDate: "2026-11-25T07:00:00.000Z",
      amount: 5400,
      chemistName: "MedPlus Chemist",
      doctorName: "Dr. Arvind Kumar",
      territoryName: "Hyderabad South",
      subArea: "Jubilee Hills",
      employeeName: "Abdul Mannan",
      itemsCount: 3,
    },
  ],
};

describe("Orders & Invoicing Central UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem("accessToken", makeAdminJwt());

    mockedGet.mockImplementation((url: string, config?: any) => {
      if (url === "/api/orders/secondary") {
        return Promise.resolve({ data: { data: sampleOrdersResponse } });
      }
      if (url === "/api/orders/ord-11112222") {
        return Promise.resolve({ data: { data: { order: sampleOrdersResponse.orders[0] } } });
      }
      if (url === "/api/invoices") {
        return Promise.resolve({ data: { data: sampleInvoicesResponse } });
      }
      if (url === "/api/invoices/summary") {
        return Promise.resolve({ data: { data: sampleSummaryResponse } });
      }
      if (url === "/api/orders/history") {
        return Promise.resolve({
          data: {
            data: {
              transactions: [
                {
                  id: "inv-1",
                  orderId: "ord-11112222",
                  type: "INVOICE",
                  date: "2026-11-25T09:00:00.000Z",
                  referenceNo: "INV-202611-1111",
                  partyName: "Apollo Pharmacy",
                  amount: 1200,
                  description: "Invoice Generated (Unpaid)",
                },
              ],
              pagination: { page: 1, limit: 30, total: 1, totalPages: 1 },
              totals: { ordersAmt: 1200, invoicedAmt: 1200, collectedAmt: 0 },
            },
          },
        });
      }
      if (url === "/api/orders/booking-context") {
        return Promise.resolve({
          data: {
            data: {
              activeSchemes: [
                { id: "sch-1", name: "Monsoon 10+1", productId: "prod-1", minQuantity: 10, discountPct: 10 },
              ],
              chemistCredit: config?.params?.chemistId
                ? {
                    chemistId: config.params.chemistId,
                    chemistName: "Apollo Pharmacy",
                    creditLimit: 50000,
                    outstanding: 12000,
                    availableHeadroom: 38000,
                    status: "OK",
                    unpaidInvoicesCount: 2,
                  }
                : null,
            },
          },
        });
      }
      if (url === "/api/manager/entities" || url === "/api/mr/entities") {
        return Promise.resolve({
          data: {
            data: {
              entities:
                config?.params?.type === "CHEMIST"
                  ? [{ id: "chem-1", name: "Apollo Pharmacy", territoryName: "Hyderabad South" }]
                  : [{ id: "dist-1", name: "MedLife Distributors" }],
            },
          },
        });
      }
      if (url === "/api/mr/territories") {
        return Promise.resolve({ data: { data: { territories: [] } } });
      }
      if (url === "/api/products") {
        return Promise.resolve({
          data: {
            data: {
              products: [{ id: "prod-1", name: "CardioCare 10mg", sku: "CC-10", price: "120", ptr: "120", mrp: "160", stockQty: 50 }],
            },
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  it("supports server-filtered orders, inline SKU breakdown, slide-over drawer, and bulk status transitions", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { data: { message: "Updated 1 order to CONFIRMED." } },
    });

    render(<OrdersDashboard />);

    expect(await screen.findByText("Orders & Invoicing Central")).toBeInTheDocument();
    expect((await screen.findAllByText("Apollo Pharmacy")).length).toBeGreaterThan(0);

    // Expand inline SKUs
    fireEvent.click(screen.getAllByRole("button", { name: /Expand SKUs/i })[0]);
    expect((await screen.findAllByText("CardioCare 10mg")).length).toBeGreaterThan(0);

    // Open slide-over Inspector Drawer
    fireEvent.click(screen.getAllByTitle("Inspect Order & Dispatch Drawer")[0]);
    expect(await screen.findByText("Commercial Audit Inspector")).toBeInTheDocument();
    expect(await screen.findByText("Full Print View")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close inspector drawer/i }));

    // Bulk status transition (use the bulk action bar button at index 0)
    fireEvent.click(screen.getAllByLabelText("Select order ord-11112222")[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /^Mark CONFIRMED$/i })[0]);

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/orders/bulk-status", {
        orderIds: ["ord-11112222"],
        status: "CONFIRMED",
      })
    );

    // Click Pending KPI card -> server status filter
    fireEvent.click(screen.getByRole("button", { name: /^Pending/i }));
    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/orders/secondary", {
        params: { page: 1, limit: 20, status: "PENDING" },
      })
    );
  });

  it("supports Invoicing Hub: QA selectors, aging, bulk print link, inline collection settlement, and timeline buckets", async () => {
    mockedPost.mockImplementation((url: string) => {
      if (url === "/api/mr/collections") {
        return Promise.resolve({ data: { data: { collection: { id: "col-1" } } } });
      }
      if (url === "/api/invoices/generate-batch") {
        return Promise.resolve({ data: { data: { message: "Generated 1 invoice successfully." } } });
      }
      return Promise.reject(new Error(`Unexpected POST ${url}`));
    });

    render(<OrdersDashboard />);
    expect(await screen.findByText("Orders & Invoicing Central")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Generated Invoices/i }));

    // Verify required QA testids + read-only profit banner + aging card
    expect(await screen.findByTestId("invoice-search-q")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-search-customer")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-search-paid")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-total-profit")).toHaveTextContent("₹14,000");
    expect(screen.getByText(/30\+d Overdue \(2\)/i)).toBeInTheDocument();

    // Toggle Charts
    fireEvent.click(screen.getByRole("button", { name: /Visual Analytics/i }));
    expect(await screen.findByTestId("invoicing-charts")).toBeInTheDocument();

    // Select invoice checkbox -> Bulk Print button appears
    fireEvent.click(screen.getByLabelText("Select invoice INV-202611-1111"));
    expect(screen.getByRole("link", { name: /Bulk Print \(1\)/i })).toHaveAttribute(
      "href",
      "/invoices/batch-print?ids=ord-11112222"
    );

    // Open inline Collect Payment Modal
    fireEvent.click(screen.getByTitle("Record Payment Collection"));
    expect(await screen.findByText("Record Payment Collection")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/UPI-431982/i), { target: { value: "UPI-9988" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm Collection/i }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/mr/collections",
        expect.objectContaining({
          chemistId: "chem-1",
          invoiceId: "inv-1",
          amount: 1344,
          refNumber: "UPI-9988",
        })
      )
    );

    // Test pagination Next on invoices tab
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/invoices", {
        params: expect.objectContaining({ page: 2, limit: 20 }),
      })
    );

    // Unbilled queue selective generation
    fireEvent.click(screen.getByRole("button", { name: /Unbilled Queue/i }));
    expect(await screen.findByText("MedPlus Chemist")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select order ord-unbilled-1"));
    fireEvent.click(screen.getByRole("button", { name: /Generate Selected \(1\)/i }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/invoices/generate-batch",
        expect.objectContaining({ orderIds: ["ord-unbilled-1"] })
      )
    );
  });

  it("shows live chemist credit headroom and enforces orders.yaml validations in NewOrderModal", async () => {
    render(<OrdersDashboard />);
    expect(await screen.findByText("Orders & Invoicing Central")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /New Sale/i }));
    expect(await screen.findByText("Book Secondary Order")).toBeInTheDocument();

    // Validation check before chemist selected
    fireEvent.click(screen.getByRole("button", { name: /Book Order & Issue Tax Invoice/i }));
    expect(await screen.findByText("Select a chemist.")).toBeInTheDocument();

    // Select chemist -> shows live credit headroom
    fireEvent.focus(screen.getByPlaceholderText(/Search chemist name/i));
    const chemistMatches = await screen.findAllByText("Apollo Pharmacy", { selector: "p.text-sm" });
    fireEvent.click(chemistMatches[chemistMatches.length - 1]);
    expect(await screen.findByText(/Headroom: ₹38,000/i)).toBeInTheDocument();
  });

  it("loads paginated ledger history on Complete History tab", async () => {
    render(<OrdersDashboard />);
    expect(await screen.findByText("Orders & Invoicing Central")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Complete History/i }));
    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/orders/history", {
        params: expect.objectContaining({ page: 1, limit: 30 }),
      })
    );
    expect(await screen.findByText("INV-202611-1111")).toBeInTheDocument();
  });
});
