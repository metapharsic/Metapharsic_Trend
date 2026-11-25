/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MrDashboardPage from "../app/(dashboard)/mr/page";
import { apiClient } from "../lib/api-client";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
  },
}));

jest.mock("../components/mr/visit-detail-modal", () => ({
  VisitDetailModal: ({ visitId, onClose }: { visitId: string; onClose: () => void }) => (
    <div data-testid="visit-detail-modal">
      <span>Visit:{visitId}</span>
      <button onClick={onClose}>CloseModal</button>
    </div>
  ),
}));

jest.mock("../components/mr/claim-modal", () => ({
  RaiseClaimModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="raise-claim-modal">
      <button onClick={onClose}>CloseClaim</button>
    </div>
  ),
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

function buildDashboardPayload(overrides: Partial<any> = {}) {
  return {
    todaysVisits: {
      planned: 2,
      list: [
        {
          tourPlanDayId: "tp-day-1",
          type: "DOCTOR",
          doctorId: "doc-101",
          chemistId: null,
          name: "Dr. Arvind Kulkarni",
          tier: "A",
        },
        {
          tourPlanDayId: "tp-day-2",
          type: "CHEMIST",
          doctorId: null,
          chemistId: "chem-202",
          name: "HealthPlus Pharmacy",
          tier: "CHEMIST",
        },
      ],
    },
    pendingVisits: { count: 2 },
    completedVisits: {
      total: 2,
      planned: 1,
      unplanned: 1,
      list: [
        {
          id: "visit-1",
          name: "Dr. Sneha Verma",
          area: "Secunderabad",
          subArea: "Begumpet",
          beatName: "North Beat 2",
          createdAt: "2026-11-25T05:10:00.000Z",
        },
      ],
    },
    salesToday: { amount: 42500 },
    collection: { amount: 18000, today: 18000, week: 52000, month: 145000, outstanding: 31000 },
    samplesDistributed: { units: 24 },
    doctorCoverage: { visited: 14, total: 20, percent: 70 },
    chemistCoverage: { visited: 9, total: 15, percent: 60 },
    travelDistance: { km: 18.4, fixes: 16 },
    gpsStatus: {
      status: "ACTIVE",
      lastFixAt: "2026-11-25T09:50:00.000Z",
      minutesSinceLastFix: 4,
      critical: false,
    },
    expenses: { today: 450, pending: 1, rejected: 0 },
    notifications: [
      {
        code: "TOUR_PLAN_DUE",
        severity: "WARNING",
        message: "Next month's tour plan has not been submitted.",
        action: "Submit it before month end so visits can be approved.",
      },
    ],
    attendance: {
      checkedIn: true,
      checkInTime: "2026-11-25T03:45:00.000Z",
      checkedOut: false,
    },
    employee: { id: "emp-1", name: "Abdul Mannan", isSelf: true },
    invoices: [
      {
        id: "inv-1",
        invoiceNo: "INV-202611-001",
        amount: 22500,
        paid: true,
        createdAt: "2026-11-25T06:00:00.000Z",
        orderId: "ord-1",
        chemistName: "Apollo Pharmacy",
        distributorName: "MedLife Distributors",
      },
      {
        id: "inv-2",
        invoiceNo: "INV-202611-002",
        amount: 20000,
        paid: false,
        createdAt: "2026-11-24T06:00:00.000Z",
        orderId: "ord-2",
        chemistName: "CareWell Chemists",
        distributorName: "Prime Pharma Supply",
      },
    ],
    ...overrides,
  };
}

describe("MrDashboardPage UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders MR command center, routes planned doctor & chemist calls properly, and fixes notification action rendering", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/manager/mrs") {
        return Promise.resolve({ data: { data: { mrs: [] } } });
      }
      if (url === "/api/mr/dashboard") {
        return Promise.resolve({ data: { data: buildDashboardPayload() } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(<MrDashboardPage />);

    // Waits for dashboard content
    expect(await screen.findByText("Abdul")).toBeInTheDocument();
    expect(screen.getByText(/Field Executive/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS Active/i)).toBeInTheDocument();

    // Notification renders prose instruction + valid route link (never href=action prose)
    expect(screen.getByText("Next month's tour plan has not been submitted.")).toBeInTheDocument();
    expect(screen.getByText("Submit it before month end so visits can be approved.")).toBeInTheDocument();
    const tpLink = screen.getByRole("link", { name: /Open Tour Plans/i });
    expect(tpLink).toHaveAttribute("href", "/tour-plans");

    // Planned stops preserve tourPlanDayId and distinguish Doctor vs Chemist
    const doctorStopBtn = screen.getByText("Dr. Arvind Kulkarni").closest("button")!;
    fireEvent.click(doctorStopBtn);
    expect(mockPush).toHaveBeenCalledWith(
      "/mr/calls/new?doctorId=doc-101&name=Dr.%20Arvind%20Kulkarni&tourPlanDayId=tp-day-1"
    );

    const chemistStopBtn = screen.getByText("HealthPlus Pharmacy").closest("button")!;
    fireEvent.click(chemistStopBtn);
    expect(mockPush).toHaveBeenCalledWith(
      "/mr/calls/new?chemistId=chem-202&name=HealthPlus%20Pharmacy&tourPlanDayId=tp-day-2"
    );

    // Completed call shows beat tag and opens VisitDetailModal
    expect(screen.getByText("North Beat 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dr. Sneha Verma").closest("button")!);
    expect(screen.getByTestId("visit-detail-modal")).toHaveTextContent("Visit:visit-1");
    fireEvent.click(screen.getByText("CloseModal"));
    expect(screen.queryByTestId("visit-detail-modal")).not.toBeInTheDocument();

    // Invoice Paid / Unpaid filter tabs work
    expect(screen.getAllByText("INV-202611-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("INV-202611-002").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "UNPAID" }));
    expect(screen.queryAllByText("INV-202611-001").length).toBe(0);
    expect(screen.getAllByText("INV-202611-002").length).toBeGreaterThan(0);
  });

  it("displays accurate error title when check-out fails", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/manager/mrs") {
        return Promise.resolve({ data: { data: { mrs: [] } } });
      }
      if (url === "/api/mr/dashboard") {
        return Promise.resolve({ data: { data: buildDashboardPayload() } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    mockedPost.mockRejectedValueOnce({
      response: { data: { error: { message: "Check-out window unavailable" } } },
    });

    render(<MrDashboardPage />);
    const checkOutBtn = await screen.findByRole("button", { name: /Check Out/i });
    fireEvent.click(checkOutBtn);

    expect(await screen.findByText("Check-out failed")).toBeInTheDocument();
    expect(screen.getByText("Check-out window unavailable")).toBeInTheDocument();
  });

  it("renders Manager Team Activity view with search & drilldown and handles /team-today 403 gracefully", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/manager/mrs") {
        return Promise.resolve({
          data: {
            data: {
              mrs: [
                {
                  id: "u-1",
                  employeeId: "emp-1",
                  firstName: "Abdul",
                  lastName: "Mannan",
                  territories: ["Hyderabad North"],
                },
                {
                  id: "u-2",
                  employeeId: "emp-2",
                  firstName: "Ravi",
                  lastName: "Sharma",
                  territories: ["Secunderabad"],
                },
              ],
            },
          },
        });
      }
      if (url === "/api/manager/dashboard/team-today") {
        return Promise.reject({ response: { status: 403 } });
      }
      if (url === "/api/mr/dashboard?employeeId=emp-1") {
        return Promise.resolve({
          data: {
            data: buildDashboardPayload({
              employee: { id: "emp-1", name: "Abdul Mannan", isSelf: false },
            }),
          },
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(<MrDashboardPage />);

    // Falls back gracefully to reps roster even when team-today rejects (403)
    expect(await screen.findByText("Team Field Command")).toBeInTheDocument();
    expect((await screen.findAllByText("Abdul Mannan")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ravi Sharma")).length).toBeGreaterThan(0);

    // Search filters roster
    const searchInput = screen.getByPlaceholderText("Search MR or territory…");
    fireEvent.change(searchInput, { target: { value: "Ravi" } });
    expect(screen.queryAllByText("Abdul Mannan").length).toBe(0);
    expect(screen.getAllByText("Ravi Sharma").length).toBeGreaterThan(0);

    // Clear search and drill into Abdul Mannan
    fireEvent.change(searchInput, { target: { value: "" } });
    await waitFor(() => expect(screen.getAllByText("Abdul Mannan").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Abdul Mannan")[0]);

    expect(await screen.findByText("Inspecting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /← All MRs/i })).toBeInTheDocument();
  });
});
