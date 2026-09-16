import { Role } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { formatMultiAgentCouncilWhatsAppReport } from "../lib/whatsapp-reports";
import { GET as getPublishedSchemes, POST as publishScheme, PATCH as toggleScheme } from "../app/api/simulator/scheme/publish/route";
import { GET as getMarketingDashboard } from "../app/api/marketing/dashboard/route";
import { GET as getWhatsAppPreview } from "../app/api/mr/reports/multi-agent/whatsapp/route";

describe("Multi-Agent Cross-Module Wiring & Daily Work Dispatch", () => {
  let fx: TestFixture;
  let adminToken: string;
  let mrToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    mrToken = tokenFor(fx.mrUserId, Role.MR);
  });

  describe("1. Multi-Agent Council WhatsApp Daily Message Customization", () => {
    const mockReport = {
      fullName: "Rajesh Kumar",
      territories: [{ name: "Central Mumbai" }],
      environment: "LOCAL",
      generatedAt: new Date().toISOString(),
      councilEvaluation: {
        overallGrade: "A",
        councilScore: 92,
        executiveSummary: "Outstanding doctor coverage and commercial sales conversion.",
        agentStatuses: [
          { agentCode: "FIELD_DCR_AGENT", agentName: "FIELD_DCR_AGENT", status: "ONLINE_PASS", score: 95, findings: ["All 6 doctor calls verified."] },
        ],
      },
      dcrSummary: {
        totalVisits: 8,
        doctorVisits: 6,
        chemistVisits: 2,
        hospitalVisits: 0,
        avgCqsScore: 8.5,
        doctorWiseVisits: [
          { doctorName: "Dr. A. K. Sharma", specialty: "Cardiologist", cqsScore: 9, durationMinutes: 7, samplesCount: 2, samplesList: [{ productName: "Cefixime 200mg", quantity: 2 }] },
        ],
      },
      commercialSummary: {
        totalRevenuePtr: 25000,
        totalOrdersCount: 3,
        totalUnitsBooked: 120,
      },
      dutyTimingSummary: {
        firstCheckInTime: "09:15 AM",
        lastCheckOutTime: "06:30 PM",
        totalDutyHours: "9h 15m",
      },
    };

    it("includes custom manager directive when provided in options", () => {
      const customMessage = "Great job on Dr. Sharma call. Please follow up on Apex Chemist collections tomorrow!";
      const reportText = formatMultiAgentCouncilWhatsAppReport(mockReport, {
        customMessage,
        includeDoctorVisits: true,
        includeChemistCalls: true,
      });

      expect(reportText).toContain("MANAGER'S DIRECTIVE & DAILY NOTE:");
      expect(reportText).toContain(customMessage);
      expect(reportText).toContain("Dr. A. K. Sharma");
    });

    it("allows selective toggles to exclude specific sections", () => {
      const reportWithoutScorecard = formatMultiAgentCouncilWhatsAppReport(mockReport, {
        includeAgentScorecard: false,
        includeDoctorVisits: true,
      });

      expect(reportWithoutScorecard).not.toContain("8-DOMAIN AGENT EVALUATION MATRIX");
      expect(reportWithoutScorecard).toContain("DOCTOR VISITS & DETAILING");
    });

    it("GET /api/mr/reports/multi-agent/whatsapp returns formatted text with customMessage query", async () => {
      const req = jsonRequest("/api/mr/reports/multi-agent/whatsapp?period=daily&customMessage=Great+work+team", {
        token: adminToken,
      });
      const res = await getWhatsAppPreview(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.whatsappText).toBeDefined();
    });
  });

  describe("2. Scheme Simulator Live Database Provisioning", () => {
    let testProductId: string;

    beforeAll(async () => {
      const prod = await testDb.product.findFirst();
      testProductId = prod!.id;
    });

    it("POST /api/simulator/scheme/publish saves scheme directly into PostgreSQL DiscountScheme table", async () => {
      const schemePayload = {
        name: "Festive Booster 15% Off Test Scheme",
        productId: testProductId,
        minQuantity: 20,
        discountPct: 15,
        validFrom: "2026-09-01",
        validTo: "2026-12-31",
        isActive: true,
      };

      const req = jsonRequest("/api/simulator/scheme/publish", {
        method: "POST",
        token: adminToken,
        body: schemePayload,
      });
      const res = await publishScheme(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.scheme.name).toBe(schemePayload.name);
      expect(data.data.scheme.discountPct).toBe(15);

      // Verify in DB
      const dbScheme = await testDb.discountScheme.findUnique({ where: { name: schemePayload.name } });
      expect(dbScheme).not.toBeNull();
      expect(dbScheme?.minQuantity).toBe(20);
    });

    it("GET /api/simulator/scheme/publish lists published schemes with product details", async () => {
      const req = jsonRequest("/api/simulator/scheme/publish", { token: adminToken });
      const res = await getPublishedSchemes(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(Array.isArray(data.data.schemes)).toBe(true);
      expect(data.data.schemes.length).toBeGreaterThan(0);
    });

    it("PATCH /api/simulator/scheme/publish toggles scheme active state", async () => {
      const existing = await testDb.discountScheme.findFirst();
      const req = jsonRequest("/api/simulator/scheme/publish", {
        method: "PATCH",
        token: adminToken,
        body: { schemeId: existing!.id, isActive: false },
      });
      const res = await toggleScheme(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.scheme.isActive).toBe(false);
    });
  });

  describe("3. Marketing & Campaign Intelligence Enhanced Sync", () => {
    it("GET /api/marketing/dashboard computes dynamic visual aid engagement and accessible to ASM role", async () => {
      const asmUser = await testDb.user.upsert({
        where: { email: "asm.wiring.test@mrtracker.com" },
        update: {},
        create: { email: "asm.wiring.test@mrtracker.com", passwordHash: "dummy", role: Role.ASM },
      });
      const asmToken = tokenFor(asmUser.id, Role.ASM);

      const req = jsonRequest("/api/marketing/dashboard", { token: asmToken });
      const res = await getMarketingDashboard(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.kpis).toBeDefined();
      expect(typeof data.data.kpis.avgEngagement).toBe("number");
      expect(Array.isArray(data.data.campaigns)).toBe(true);
    });
  });
});
