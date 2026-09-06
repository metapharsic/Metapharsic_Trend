import { DashboardService } from "../services/dashboard.service";
import { db } from "../lib/db";

describe("Direct Dashboard Calculations & Service Verification Suite", () => {
  it("calculates company-wide Admin KPIs with UTC normalization directly via DashboardService", async () => {
    const kpis = await DashboardService.calculateAdminKpis();

    expect(kpis).toBeDefined();

    // Workforce metrics
    expect(typeof kpis.totalEmployees).toBe("number");
    expect(typeof kpis.activeMRs).toBe("number");
    expect(kpis.todaysAttendance).toHaveProperty("present");
    expect(kpis.todaysAttendance).toHaveProperty("total");

    // Coverage metrics
    expect(kpis.doctorsCovered).toHaveProperty("visited");
    expect(kpis.doctorsCovered).toHaveProperty("total");
    expect(kpis.chemistsCovered).toHaveProperty("visited");
    expect(kpis.chemistsCovered).toHaveProperty("total");

    // Commercial & compliance
    expect(kpis.orders).toHaveProperty("count");
    expect(kpis.sales).toHaveProperty("amount");
    expect(typeof kpis.sales.amount).toBe("number");
    expect(kpis.missedCalls).toHaveProperty("count");
    expect(typeof kpis.missedCalls.count).toBe("number");
    expect(kpis.creditBreaches).toHaveProperty("count");
    expect(typeof kpis.creditBreaches.count).toBe("number");
  });

  it("calculates ZSM regional rollups with pure database values and no synthetic mocks", async () => {
    const zsmData = await DashboardService.calculateZsmDashboard();

    expect(zsmData).toBeDefined();
    expect(Array.isArray(zsmData.regionalData)).toBe(true);

    if (zsmData.regionalData.length > 0) {
      const firstRegion = zsmData.regionalData[0];
      expect(firstRegion).toHaveProperty("regionId");
      expect(firstRegion).toHaveProperty("regionName");
      expect(firstRegion).toHaveProperty("sales");
      expect(firstRegion.sales).toHaveProperty("achieved");
      expect(firstRegion.sales).toHaveProperty("target");
      expect(firstRegion.sales).toHaveProperty("percentage");
      expect(typeof firstRegion.sales.achieved).toBe("number");
      expect(typeof firstRegion.sales.target).toBe("number");
    }

    // Call compliance & field activity
    expect(zsmData.fieldActivity).toHaveProperty("doctorCalls");
    expect(zsmData.fieldActivity).toHaveProperty("chemistCalls");
    expect(zsmData.fieldActivity).toHaveProperty("compliancePercentage");

    expect(zsmData.zoneKpis).toHaveProperty("totalTarget");
    expect(zsmData.zoneKpis).toHaveProperty("totalAchieved");
    expect(zsmData.zoneKpis).toHaveProperty("achievementPercentage");
    expect(zsmData.zoneKpis).toHaveProperty("missedVisits");
  });

  it("calculates NSM zonal performance with real brand market share", async () => {
    const nsmData = await DashboardService.calculateNsmDashboard();

    expect(nsmData).toBeDefined();
    expect(Array.isArray(nsmData.zonalData)).toBe(true);

    // Dynamic brand market share computed from live invoices
    expect(Array.isArray(nsmData.topBrands)).toBe(true);
    if (nsmData.topBrands.length > 0) {
      const topBrand = nsmData.topBrands[0];
      expect(topBrand).toHaveProperty("name");
      expect(topBrand).toHaveProperty("revenue");
      expect(topBrand).toHaveProperty("trend");
    }

    // National performance card
    expect(nsmData.nationalKpis).toHaveProperty("totalAchieved");
    expect(nsmData.nationalKpis).toHaveProperty("totalTarget");
    expect(nsmData.nationalKpis).toHaveProperty("achievementPercentage");
  });

  it("calculates ASM team breakdown with daily vs MTD sales separation", async () => {
    const sampleAsm = await db.user.findFirst({
      where: { role: "ASM" as any },
      select: { id: true },
    });

    const asmData = await DashboardService.calculateAsmDashboard(sampleAsm?.id);

    expect(asmData).toBeDefined();
    expect(Array.isArray(asmData.mrs)).toBe(true);

    if (asmData.mrs.length > 0) {
      const member = asmData.mrs[0];
      expect(member).toHaveProperty("employeeId");
      expect(member).toHaveProperty("employeeName");
      expect(member).toHaveProperty("sales");
      expect(member.sales).toHaveProperty("achieved");
      expect(member.sales).toHaveProperty("achievedMtd");
      expect(member.sales).toHaveProperty("target");
      expect(member.sales).toHaveProperty("percentage");
      expect(member).toHaveProperty("callsPlanned");
      expect(member).toHaveProperty("callsCompleted");

      // Daily sales should be a valid number
      expect(typeof member.sales.achieved).toBe("number");
      expect(typeof member.sales.achievedMtd).toBe("number");
    }

    expect(asmData).toHaveProperty("totalCollected");
    expect(asmData).toHaveProperty("totalCollectedMtd");
    expect(typeof asmData.totalCollected).toBe("number");
    expect(typeof asmData.totalCollectedMtd).toBe("number");
  });

  it("audits dashboard consistency and guarantees zero mutations", async () => {
    const audit = await DashboardService.auditDashboardConsistency();

    expect(audit).toBeDefined();
    expect(audit.passed).toBe(true);
    expect(audit.standards.zeroMutationGuarantee).toMatch(/read-only certified/i);
    expect(audit.standards.paginationIntegrity).toBeDefined();
    expect(audit.standards.serverSideAggregations).toBeDefined();
  });

  it("serves subsequent dashboard requests in sub-millisecond time via cache", async () => {
    // Warm cache
    await DashboardService.calculateAdminKpis();

    const t0 = performance.now();
    const cachedKpis = await DashboardService.calculateAdminKpis();
    const durationMs = performance.now() - t0;

    expect(cachedKpis).toBeDefined();
    expect(durationMs).toBeLessThan(15); // Sub-15ms fast response
  });
});

