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
import { GET as getCallReports } from "../app/api/mr/reports/calls/route";

describe("All MRs — Call Reports Multi-Agent Wiring", () => {
  let fx: TestFixture;
  let adminToken: string;
  let asmToken: string;
  let mrToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    asmToken = tokenFor(fx.asmUserId, Role.ASM);
    mrToken = tokenFor(fx.mrUserId, Role.MR);

    // Create doctor, chemist, and visits for testing
    const doctor = await testDb.doctor.create({
      data: {
        fullName: "Dr. Arvind Rao",
        primarySpecialty: "Diabetologist",
        clinicAddress: "Rao Clinic, Mumbai",
        latitude: 19.076,
        longitude: 72.8777,
        territoryId: fx.territoryId,
      },
    });

    const chemist = await testDb.chemist.create({
      data: {
        name: "Apollo Pharmacy Central",
        contactPerson: "Mahesh",
        address: "Central Market, Mumbai",
        latitude: 19.0762,
        longitude: 72.8779,
        territoryId: fx.territoryId,
      },
    });

    // Create a visit by MR
    await testDb.visit.create({
      data: {
        employeeId: fx.mrEmployeeId,
        doctorId: doctor.id,
        purpose: "Product Detailing & Sampling",
        durationMinutes: 18,
        cqsScore: 8.5,
        boxesPlaced: 2,
        latitude: 19.076,
        longitude: 72.8777,
      },
    });

    await testDb.visit.create({
      data: {
        employeeId: fx.mrEmployeeId,
        chemistId: chemist.id,
        purpose: "Stockist Order & POB",
        durationMinutes: 12,
        cqsScore: 8.0,
        boxesPlaced: 1,
        latitude: 19.0762,
        longitude: 72.8779,
      },
    });
  });

  it("returns fleet-wide Call Report with Multi-Agent Council evaluation for Admin/Manager", async () => {
    const req = jsonRequest("/api/mr/reports/calls?period=all", {
      token: adminToken,
    });
    const res = await getCallReports(req, noParams);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totals.totalCalls).toBeGreaterThanOrEqual(2);
    expect(body.data.totals.doctorCalls).toBeGreaterThanOrEqual(1);
    expect(body.data.totals.chemistCalls).toBeGreaterThanOrEqual(1);

    // Multi-Agent Council Evaluation
    expect(body.data.multiAgentEvaluation).toBeDefined();
    expect(body.data.multiAgentEvaluation.councilScore).toBeGreaterThan(0);
    expect(["A+", "A", "B", "C"]).toContain(body.data.multiAgentEvaluation.overallGrade);
    expect(body.data.multiAgentEvaluation.agentStatuses.length).toBe(4);

    // Fleet MR Breakdown
    expect(Array.isArray(body.data.mrBreakdown)).toBe(true);
    const mrEntry = body.data.mrBreakdown.find((m: any) => m.employeeId === fx.mrEmployeeId);
    expect(mrEntry).toBeDefined();
    expect(mrEntry.totalCalls).toBeGreaterThanOrEqual(2);
    expect(mrEntry.doctorCalls).toBeGreaterThanOrEqual(1);
    expect(mrEntry.chemistCalls).toBeGreaterThanOrEqual(1);
  });

  it("filters to an individual MR when employeeId is provided", async () => {
    const req = jsonRequest(`/api/mr/reports/calls?period=all&employeeId=${fx.mrEmployeeId}`, {
      token: asmToken,
    });
    const res = await getCallReports(req, noParams);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data.employee.id).toBe(fx.mrEmployeeId);
    expect(body.data.calls.every((c: any) => c.employeeId === fx.mrEmployeeId)).toBe(true);
  });

  it("allows MR to view their own call report", async () => {
    const req = jsonRequest("/api/mr/reports/calls?period=all", {
      token: mrToken,
    });
    const res = await getCallReports(req, noParams);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data.employee.id).toBe(fx.mrEmployeeId);
    expect(body.data.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks MR from viewing another employee's call report", async () => {
    const req = jsonRequest(`/api/mr/reports/calls?period=all&employeeId=${fx.asmEmployeeId}`, {
      token: mrToken,
    });
    const res = await getCallReports(req, noParams);
    expect(res.status).toBe(403);
  });
});
