import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson, noParams, TestFixture } from "./helpers/api";
import {
  formatIndividualMrWhatsAppReport,
  formatAdminExecutiveWhatsAppDigest,
  formatMultiAgentCouncilWhatsAppReport,
  formatMultiAgentCouncilExecutiveDigest,
  compileIndividualMrEodData,
  compileAdminExecutiveDigestData,
  IndividualMrEodData,
  AdminExecutiveDigestData,
} from "../lib/whatsapp-reports";
import { GET as getEodPreview, POST as dispatchEod } from "../app/api/admin/reports/whatsapp-eod/route";

describe("Enhanced WhatsApp EOD Reports Engine", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("formats a highly descriptive individual MR EOD WhatsApp report with all sections", () => {
    const mockData: IndividualMrEodData = {
      mrId: "test-mr-1",
      mrName: "Rajesh Kumar",
      mrPhone: "+919876543210",
      mrEmail: "rajesh@trendmr.com",
      territoryName: "Hyderabad Central",
      date: new Date("2026-08-25T10:00:00Z"),
      attendance: {
        checkedIn: true,
        firstCheckIn: new Date("2026-08-25T09:15:00Z"),
        lastCheckOut: new Date("2026-08-25T18:30:00Z"),
        totalMinutes: 555,
        stillCheckedIn: false,
        sessionsCount: 1,
      },
      visits: {
        totalCalls: 12,
        doctorCalls: 8,
        chemistCalls: 4,
        doctorList: [
          { name: "Dr. Sharma", specialty: "Cardiologist", cqsScore: 92 },
          { name: "Dr. Anjali", specialty: "Pediatrician", cqsScore: 88 },
        ],
        chemistList: [{ name: "Apollo Pharmacy Secunderabad" }],
        avgCqsScore: 90.0,
        boxesPlaced: 5,
      },
      sampling: {
        totalUnits: 25,
        breakdown: [
          { productName: "Amoxicillin 500mg", quantity: 15 },
          { productName: "Azithromycin 250mg", quantity: 10 },
        ],
      },
      orders: {
        count: 3,
        totalValue: 34500,
        itemsCount: 8,
        topItems: [{ productName: "Amoxicillin 500mg", quantity: 50, amount: 20000 }],
      },
      collections: {
        totalAmount: 18000,
        count: 2,
        receipts: [{ chemistName: "Apollo Pharmacy", amount: 18000, refNo: "REC-901" }],
      },
      leadsCount: 2,
      compliance: {
        geofenceAccuracyPct: 98,
        anomalyCount: 0,
        mockGpsDetected: false,
      },
      targets: {
        monthlyTarget: 300000,
        mtdAchieved: 210000,
        mtdPacePercent: 70.0,
        daysRemainingInMonth: 6,
      },
    };

    const text = formatIndividualMrWhatsAppReport(mockData);

    expect(text).toContain("TREND MR — EOD PROGRESS REPORT");
    expect(text).toContain("Rajesh Kumar");
    expect(text).toContain("Hyderabad Central");
    expect(text).toContain("DUTY & ATTENDANCE");
    expect(text).toContain("FIELD COVERAGE & DCR");
    expect(text).toContain("Dr. Sharma (Cardiologist)");
    expect(text).toContain("PHYSICIAN SAMPLES DISBURSED");
    expect(text).toContain("Amoxicillin 500mg: *15 units*");
    expect(text).toContain("COMMERCIAL PERFORMANCE");
    expect(text).toContain("₹34,500");
    expect(text).toContain("₹18,000");
    expect(text).toContain("MONTHLY TARGET & RUN-RATE");
    expect(text).toContain("ROUTE & GEOFENCE COMPLIANCE");
    expect(text).toContain("98%");
  });

  it("formats a descriptive Admin Executive Fleet EOD Digest", () => {
    const mockFleetData: AdminExecutiveDigestData = {
      date: new Date("2026-08-25T10:00:00Z"),
      totalMrCount: 5,
      activeMrCount: 4,
      onLeaveCount: 0,
      absentCount: 1,
      totalFleetSales: 125000,
      totalFleetCollections: 65000,
      totalDoctorCalls: 38,
      totalChemistCalls: 18,
      totalSamplesGiven: 110,
      avgFleetCqs: 88.5,
      topPerformer: { name: "Rajesh Kumar", sales: 45000, calls: 14 },
      anomalies: {
        mockGpsCount: 0,
        unvisitedPlannedCount: 2,
        zeroCallReps: [],
      },
      repScorecards: [
        {
          name: "Rajesh Kumar",
          territory: "Hyderabad Central",
          status: "CHECKED_OUT",
          calls: 14,
          sales: 45000,
          collections: 25000,
          hours: "8h 15m",
        },
      ],
    };

    const text = formatAdminExecutiveWhatsAppDigest(mockFleetData);

    expect(text).toContain("EXECUTIVE FLEET EOD DIGEST");
    expect(text).toContain("4/5 Active");
    expect(text).toContain("COMMERCIAL SUMMARY (TODAY)");
    expect(text).toContain("₹1,25,000");
    expect(text).toContain("₹65,000");
    expect(text).toContain("Top Performer: *Rajesh Kumar*");
    expect(text).toContain("FIELD ACTIVITY FLEET TOTALS");
    expect(text).toContain("Total Doctor Calls: *38*");
    expect(text).toContain("INDIVIDUAL REP BREAKDOWN");
    expect(text).toContain("Rajesh Kumar");
  });

  it("compiles live individual and fleet metrics from the database", async () => {
    const individual = await compileIndividualMrEodData(fx.mrEmployeeId);
    expect(individual).not.toBeNull();
    expect(individual!.mrId).toBe(fx.mrEmployeeId);

    const fleet = await compileAdminExecutiveDigestData();
    expect(fleet.totalMrCount).toBeGreaterThanOrEqual(1);
  });

  it("supports Admin API preview via GET /api/admin/reports/whatsapp-eod", async () => {
    const res = await getEodPreview(
      jsonRequest("/api/admin/reports/whatsapp-eod", {
        token: tokenFor(fx.adminUserId, Role.ADMIN),
      }),
      noParams
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.mode).toBe("EXECUTIVE_DIGEST");
    expect(body.data.executiveWhatsappText).toContain("EXECUTIVE FLEET EOD DIGEST");
    expect(Array.isArray(body.data.mrList)).toBe(true);
  });

  it("supports Admin individual MR preview via GET /api/admin/reports/whatsapp-eod?employeeId=...", async () => {
    const res = await getEodPreview(
      jsonRequest(`/api/admin/reports/whatsapp-eod?employeeId=${fx.mrEmployeeId}`, {
        token: tokenFor(fx.adminUserId, Role.ADMIN),
      }),
      noParams
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.mode).toBe("INDIVIDUAL");
    expect(body.data.whatsappText).toContain("TREND MR — EOD PROGRESS REPORT");
  });

  it("formats a full 8-domain Multi-Agent Council WhatsApp report", () => {
    const mockReport: any = {
      mrId: "mr-123",
      fullName: "Abdul Mannan",
      phone: "+919876543210",
      territories: [{ name: "Secunderabad" }],
      environment: "LOCAL",
      generatedAt: "2026-08-25T10:00:00.000Z",
      councilEvaluation: {
        overallGrade: "A+",
        councilScore: 95,
        executiveSummary: "Multi-Agent Council completed evaluation for MR Abdul Mannan. Overall Grade: A+ (95/100) with 8/8 Domain Agents Online and Verified.",
        keyRiskFactors: [],
        actionItems: ["Maintain secondary sales momentum in Q3."],
        agentStatuses: [
          { agentName: "Role Auth Agent", status: "ONLINE_PASS", score: 100, findings: ["Verified MR Identity"], warnings: [] },
          { agentName: "Field DCR Agent", status: "ONLINE_PASS", score: 95, findings: ["Logged 12 doctor calls"], warnings: [] },
        ],
      },
      dcrSummary: {
        totalVisits: 12,
        doctorVisits: 8,
        chemistVisits: 4,
        avgDurationMinutes: 18,
        avgCqsScore: 9.2,
        totalBoxesPlaced: 15,
      },
      commercialSummary: {
        totalOrdersCount: 5,
        deliveredOrdersCount: 4,
        totalRevenuePtr: 78500,
        totalUnitsBooked: 240,
        collections: { totalCollected: 45000, recordsCount: 2 },
        skuBreakdown: [{ productName: "Paracetamol 650", units: 100, revenuePtr: 25000 }],
      },
      routingSummary: {
        geofenceCompliancePercent: 98,
        tourPlansCount: 2,
        approvedTourPlansCount: 2,
        gpsMockFlagsCount: 0,
      },
      expenseHrmsSummary: {
        totalExpensesApproved: 3200,
        expenseToSalesRoiPercent: 4.1,
        attendanceDaysLogged: 22,
      },
      financeSummary: {
        grossSalesRevenue: 78500,
        costOfGoodsSold: 52000,
        grossProfit: 26500,
        fieldExpenses: 3200,
        netTerritoryContribution: 23300,
        netMarginPercent: 29.7,
      },
    };

    const text = formatMultiAgentCouncilWhatsAppReport(mockReport);
    expect(text).toContain("MULTI-AGENT COUNCIL AUDIT REPORT");
    expect(text).toContain("Abdul Mannan");
    expect(text).toContain("Grade A+");
    expect(text).toContain("8-DOMAIN AGENT EVALUATION MATRIX");
    expect(text).toContain("DOCTOR VISITS & DETAILING");
    expect(text).toContain("SECONDARY SALES DONE");
    expect(text).toContain("₹78,500");
    expect(text).toContain("FINANCIAL P&L CONTRIBUTION");
    expect(text).toContain("Verified by 8 AI Domain Agents");
  });

  it("formats a fleet-wide Multi-Agent Council Executive WhatsApp Digest", () => {
    const mockReports: any[] = [
      {
        fullName: "Abdul Mannan",
        territories: [{ name: "Secunderabad" }],
        councilEvaluation: { overallGrade: "A+", councilScore: 95 },
        dcrSummary: { totalVisits: 12 },
        commercialSummary: { totalOrdersCount: 5, totalRevenuePtr: 78500 },
        financeSummary: { netTerritoryContribution: 23300 },
        routingSummary: { gpsMockFlagsCount: 0 },
      },
    ];

    const text = formatMultiAgentCouncilExecutiveDigest(mockReports);
    expect(text).toContain("EXECUTIVE MULTI-AGENT COUNCIL DIGEST");
    expect(text).toContain("1 MRs Evaluated");
    expect(text).toContain("👑 *Top Performer:* *Abdul Mannan*");
    expect(text).toContain("INDIVIDUAL MR COUNCIL SCORECARDS");
  });
});

