import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson, noParams, TestFixture } from "./helpers/api";
import { GET as getVisitsSummaryRoute } from "../app/api/manager/visits/summary/route";
import { GET as getMrsRoute } from "../app/api/manager/mrs/route";
import { executeFieldActivityWorkerTask } from "../scripts/multithreaded_wire_field_activity_monitor";

describe("Field Activity Monitor Multi-Threaded Logic & Admin Visibility Integration", () => {
  let fx: TestFixture;
  let adminToken: string;
  let adminUserId: string;
  let mrUserId: string;
  let mrEmployeeId: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminUserId = fx.adminUserId;
    adminToken = tokenFor(adminUserId, Role.ADMIN);
    mrUserId = fx.mrUserId;
    mrEmployeeId = fx.mrEmployeeId;

    // Seed historical October visits for continuity verification
    await testDb.visit.create({
      data: {
        employeeId: fx.mrEmployeeId,
        doctorId: fx.doctorId,
        purpose: "Historical detailing on cardiometabolic portfolio",
        feedback: "Doctor showed keen interest",
        latitude: 17.385,
        longitude: 78.486,
        boxesPlaced: 2,
        cqsScore: 90,
        createdAt: new Date("2026-10-15T10:00:00.000Z"),
        updatedAt: new Date("2026-10-15T10:00:00.000Z"),
      },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("1. Multi-Threaded Wiring Engine Worker Tasks", () => {
    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public";

    it("Thread 1: wires November 2026 field cadence and ensures activity is not nill", async () => {
      const res = await executeFieldActivityWorkerTask(1, "NOVEMBER_FIELD_ACTIVITY_CADENCE_WIRING", dbUrl);
      expect(res.status).toBe("SUCCESS");
      expect(res.data.totalNovemberVisits).toBeGreaterThanOrEqual(6);
      expect(res.data.datesCovered).toContain("2026-11-02");
    });

    it("Thread 2: wires all system users and establishes complete visibility for Admin", async () => {
      const res = await executeFieldActivityWorkerTask(2, "ALL_USERS_AND_ADMIN_VISIBILITY_WIRING", dbUrl);
      expect(res.status).toBe("SUCCESS");
      expect(res.data.totalUsers).toBeGreaterThanOrEqual(3);
      expect(res.data.allRolesVisibleToAdmin).toBe(true);
      expect(res.data.roleBreakdown).toHaveProperty("MR");
      expect(res.data.roleBreakdown).toHaveProperty("ADMIN");
    });

    it("Thread 3: verifies zero-drift day counts and feed parity across months", async () => {
      const res = await executeFieldActivityWorkerTask(3, "INLINE_CALENDAR_AND_VISITS_FEED_PARITY", dbUrl);
      expect(res.status).toBe("SUCCESS");
      expect(res.data.novemberTotalVisits).toBeGreaterThanOrEqual(6);
      expect(res.data.activeNovemberDays).toBeGreaterThanOrEqual(2);
      expect(res.data.octoberTotalVisits).toBeGreaterThanOrEqual(0);
      expect(res.data.parityVerified).toBe(true);
    });

    it("Thread 4: ensures tour plans and attendance compliance are provisioned", async () => {
      const res = await executeFieldActivityWorkerTask(4, "TOUR_PLANS_AND_ATTENDANCE_CADENCE_WIRING", dbUrl);
      expect(res.status).toBe("SUCCESS");
      expect(res.data.complianceRate).toBe("100%");
      expect(res.data.fieldEmployeesCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. Field Activity Summary API (/api/manager/visits/summary)", () => {
    it("returns active November 2026 field calls with day counts and summary metrics", async () => {
      const req = jsonRequest("http://localhost/api/manager/visits/summary?month=2026-11", {
        token: adminToken,
      });

      const res = await getVisitsSummaryRoute(req, noParams);
      expect(res.status).toBe(200);

      const json = await readJson(res);
      expect(json.success).toBe(true);
      const data = json.data;

      // Ensure November data is NOT nill
      expect(data.total).toBeGreaterThanOrEqual(6);
      expect(Object.keys(data.counts).length).toBeGreaterThanOrEqual(2);
      expect(data.counts["2026-11-01"]).toBeGreaterThan(0);
      expect(data.counts["2026-11-02"]).toBeGreaterThan(0);

      // Verify structure of summary metrics
      expect(data.summaryMetrics).toBeDefined();
      expect(data.summaryMetrics.totalCalls).toBe(data.total);
      expect(data.summaryMetrics.totalBoxesPlaced).toBeGreaterThanOrEqual(0);
      expect(data.summaryMetrics.avgCqsScore).toBeGreaterThanOrEqual(80);

      // Verify gap analytics
      expect(data.summaryMetrics.gapAnalytics).toBeDefined();
      expect(data.summaryMetrics.gapAnalytics.activeDaysCount).toBeGreaterThanOrEqual(2);
      expect(data.summaryMetrics.gapAnalytics.numDaysInMonth).toBe(30);

      // Verify byMr breakdown includes users
      expect(Object.keys(data.byMr).length).toBeGreaterThan(0);
    });

    it("allows admin to see all user data when mrId=ALL or omitted", async () => {
      const reqAll = jsonRequest("http://localhost/api/manager/visits/summary?month=2026-11&mrId=ALL", {
        token: adminToken,
      });

      const resAll = await getVisitsSummaryRoute(reqAll, noParams);
      expect(resAll.status).toBe(200);
      const jsonAll = await readJson(resAll);
      expect(jsonAll.success).toBe(true);

      const reqOmitted = jsonRequest("http://localhost/api/manager/visits/summary?month=2026-11", {
        token: adminToken,
      });
      const resOmitted = await getVisitsSummaryRoute(reqOmitted, noParams);
      const jsonOmitted = await readJson(resOmitted);

      expect(jsonAll.data.total).toBe(jsonOmitted.data.total);
      expect(Object.keys(jsonAll.data.byMr).length).toBeGreaterThanOrEqual(2);
    });

    it("filters visits specifically when a single MR / user is selected", async () => {
      const req = jsonRequest(`http://localhost/api/manager/visits/summary?month=2026-11&mrId=${mrUserId}`, {
        token: adminToken,
      });

      const res = await getVisitsSummaryRoute(req, noParams);
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.success).toBe(true);

      const visits = Object.values(json.data.byDay).flat() as any[];
      expect(visits.length).toBeGreaterThan(0);
      for (const v of visits) {
        expect([mrUserId, mrEmployeeId]).toContain(v.mrUserId || v.mrEmployeeId);
      }
    });
  });

  describe("3. User Directory API (/api/manager/mrs)", () => {
    it("returns all users across all roles to Admin when all=true", async () => {
      const req = jsonRequest("http://localhost/api/manager/mrs?all=true", {
        token: adminToken,
      });

      const res = await getMrsRoute(req, noParams);
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.success).toBe(true);

      const users = json.data.mrs;
      expect(users.length).toBeGreaterThanOrEqual(3);

      // Verify multiple roles exist so admin sees everyone
      const roles = new Set(users.map((u: any) => u.role));
      expect(roles.has("MR")).toBe(true);
      expect(roles.has("ASM") || roles.has("ADMIN")).toBe(true);

      for (const u of users) {
        expect(u.id).toBeDefined();
        expect(u.employeeId).toBeDefined();
        expect(u.firstName).toBeDefined();
        expect(u.role).toBeDefined();
      }
    });

    it("defaults to returning only MRs when all is omitted for backward compatibility", async () => {
      const req = jsonRequest("http://localhost/api/manager/mrs", {
        token: adminToken,
      });

      const res = await getMrsRoute(req, noParams);
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.success).toBe(true);

      const users = json.data.mrs;
      for (const u of users) {
        expect(u.role).toBe("MR");
      }
    });
  });

  describe("4. Historical Month Continuity & Integrity", () => {
    it("maintains historical October 2026 visits with full detail", async () => {
      const req = jsonRequest("http://localhost/api/manager/visits/summary?month=2026-10", {
        token: adminToken,
      });

      const res = await getVisitsSummaryRoute(req, noParams);
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.success).toBe(true);
      expect(json.data.total).toBeGreaterThanOrEqual(1);
      expect(json.data.availableMonths.length).toBeGreaterThanOrEqual(1);
    });
  });
});
