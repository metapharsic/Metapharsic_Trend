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
import { GET as handleReports } from "../app/api/reports/route";

describe("Enhanced Enterprise BI Reporting Engine", () => {
  let fx: TestFixture;
  let adminToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);

    // Seed additional sample inventory and doctor DPS for test coverage
    await Promise.all([
      testDb.sampleInventory.upsert({
        where: { employeeId_productId: { employeeId: fx.mrEmployeeId, productId: fx.productId } },
        update: { quantity: 25, allocatedQty: 50 },
        create: { employeeId: fx.mrEmployeeId, productId: fx.productId, quantity: 25, allocatedQty: 50 },
      }),
      testDb.doctor.update({
        where: { id: fx.doctorId },
        data: { dpsScore: 88.5, dpsTier: "A", requiredMonthlyVisits: 4 },
      }),
    ]);
  });

  it("GET /api/reports returns full catalog of enterprise pharmaceutical reports", async () => {
    const req = jsonRequest("/api/reports", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.reports.length).toBeGreaterThanOrEqual(14);

    const reportIds = body.data.reports.map((r: any) => r.id);
    expect(reportIds).toContain("product-wise-sales");
    expect(reportIds).toContain("doctor-dps-tiering");
    expect(reportIds).toContain("chemist-aging-analysis");
    expect(reportIds).toContain("sample-gift-audit");
    expect(reportIds).toContain("tourplan-adherence");
    expect(reportIds).toContain("gst-tax-summary");
  });

  it("GET /api/reports?report=product-wise-sales calculates profitability with timeframe", async () => {
    const req = jsonRequest("/api/reports?report=product-wise-sales&timeframe=this_month", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("product-wise-sales");
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.timeframe).toBe("this_month");
  });

  it("GET /api/reports?report=doctor-dps-tiering returns DPS tiering and visit adherence", async () => {
    const req = jsonRequest("/api/reports?report=doctor-dps-tiering", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("doctor-dps-tiering");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("doctor");
      expect(row).toHaveProperty("tier");
      expect(row).toHaveProperty("dpsScore");
    }
  });

  it("GET /api/reports?report=chemist-aging-analysis returns chemist credit and outstanding", async () => {
    const req = jsonRequest("/api/reports?report=chemist-aging-analysis", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("chemist-aging-analysis");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("chemist");
      expect(row).toHaveProperty("creditLimit");
      expect(row).toHaveProperty("outstanding");
      expect(row).toHaveProperty("riskCategory");
    }
  });

  it("GET /api/reports?report=sample-gift-audit returns allocated vs balance sample inventory", async () => {
    const req = jsonRequest("/api/reports?report=sample-gift-audit", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("sample-gift-audit");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("product");
      expect(row).toHaveProperty("balanceStock");
      expect(row).toHaveProperty("stockValue");
    }
  });

  it("GET /api/reports?report=gst-tax-summary returns GST taxable and tax breakdowns", async () => {
    const req = jsonRequest("/api/reports?report=gst-tax-summary", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("gst-tax-summary");
    expect(Array.isArray(body.data.rows)).toBe(true);
  });

  it("GET /api/reports?report=molecule-sales-summary returns each molecule with revenue, stock, and margins", async () => {
    const req = jsonRequest("/api/reports?report=molecule-sales-summary", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("molecule-sales-summary");
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.rows.length).toBeGreaterThan(0);

    const firstRow = body.data.rows[0];
    expect(firstRow).toHaveProperty("molecule");
    expect(firstRow).toHaveProperty("brandNames");
    expect(firstRow).toHaveProperty("therapySegment");
    expect(firstRow).toHaveProperty("totalStock");
    expect(firstRow).toHaveProperty("stockValue");
    expect(firstRow).toHaveProperty("revenue");
    expect(firstRow).toHaveProperty("marginPercent");
  });

  it("GET /api/reports?report=chemist-360-report returns each chemist with location, address, and credit metrics", async () => {
    const req = jsonRequest("/api/reports?report=chemist-360-report", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("chemist-360-report");
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.rows.length).toBeGreaterThan(0);

    const firstRow = body.data.rows[0];
    expect(firstRow).toHaveProperty("chemist");
    expect(firstRow).toHaveProperty("territory");
    expect(firstRow).toHaveProperty("location");
    expect(firstRow).toHaveProperty("creditLimit");
    expect(firstRow).toHaveProperty("outstanding");
    expect(firstRow).toHaveProperty("riskCategory");
    expect(firstRow).toHaveProperty("totalVisits");
  });

  it("GET /api/reports?report=mr-field-gps-productivity returns each MR report WITH precise GPS location", async () => {
    const req = jsonRequest("/api/reports?report=mr-field-gps-productivity", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("mr-field-gps-productivity");
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.rows.length).toBeGreaterThan(0);

    for (const row of body.data.rows) {
      expect(row).toHaveProperty("mrName");
      expect(row).toHaveProperty("territory");
      // Critical user requirement: each MR report MUST have location!
      expect(row).toHaveProperty("lastLocation");
      expect(typeof row.lastLocation).toBe("string");
      expect(row.lastLocation.length).toBeGreaterThan(0);
      expect(row.lastLocation).not.toBe("Unspecified");
      expect(row).toHaveProperty("lastLocationTime");
      expect(row).toHaveProperty("locationSource");
      expect(row).toHaveProperty("gpsStatus");
      expect(row).toHaveProperty("totalCalls");
      expect(row).toHaveProperty("salesValue");
      expect(row).toHaveProperty("netContribution");
    }
  });

  it("GET /api/reports?report=doctor-prescription-roi returns clinical yield and clinic location", async () => {
    const req = jsonRequest("/api/reports?report=doctor-prescription-roi", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("doctor-prescription-roi");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("doctor");
      expect(row).toHaveProperty("clinicLocation");
      expect(row).toHaveProperty("tier");
      expect(row).toHaveProperty("adherencePct");
    }
  });

  it("GET /api/reports?report=inventory-batch-expiry returns batch aging and days to expiry", async () => {
    const req = jsonRequest("/api/reports?report=inventory-batch-expiry", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("inventory-batch-expiry");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("productName");
      expect(row).toHaveProperty("molecule");
      expect(row).toHaveProperty("batchNo");
      expect(row).toHaveProperty("daysToExpiry");
      expect(row).toHaveProperty("expiryRisk");
    }
  });

  it("GET /api/reports?report=field-gps-trail-audit returns GPS breadcrumbs and geofence verification", async () => {
    const req = jsonRequest("/api/reports?report=field-gps-trail-audit", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("field-gps-trail-audit");
    expect(Array.isArray(body.data.rows)).toBe(true);
  });

  it("GET /api/reports?report=primary-vs-secondary returns territory targets vs secondary demand", async () => {
    const req = jsonRequest("/api/reports?report=primary-vs-secondary", { token: adminToken });
    const res = await handleReports(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("primary-vs-secondary");
    expect(Array.isArray(body.data.rows)).toBe(true);
    if (body.data.rows.length > 0) {
      const row = body.data.rows[0];
      expect(row).toHaveProperty("territory");
      expect(row).toHaveProperty("secondarySales");
      expect(row).toHaveProperty("collections");
      expect(row).toHaveProperty("primaryAttainment");
    }
  });
});
