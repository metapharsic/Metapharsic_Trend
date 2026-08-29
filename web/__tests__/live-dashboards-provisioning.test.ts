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
import { GET as getNsmDashboard } from "../app/api/manager/dashboard/nsm/route";
import { GET as getZsmDashboard } from "../app/api/manager/dashboard/zsm/route";
import { GET as getMarketingDashboard } from "../app/api/marketing/dashboard/route";
import { GET as getLmsCourses, POST as createLmsCourse } from "../app/api/lms/courses/route";
import { GET as getCompanySettings, PUT as updateCompanySettings } from "../app/api/admin/company-settings/route";

describe("Live Dashboards Database Provisioning", () => {
  let fx: TestFixture;
  let nsmUserId: string;
  let zsmUserId: string;
  let mktgUserId: string;

  beforeAll(async () => {
    fx = await resetFixture();

    const [nsmUser, zsmUser, mktgUser] = await Promise.all([
      testDb.user.upsert({
        where: { email: "nsm.test@mrtracker.com" },
        update: {},
        create: { email: "nsm.test@mrtracker.com", passwordHash: "dummy", role: Role.NSM },
      }),
      testDb.user.upsert({
        where: { email: "zsm.test@mrtracker.com" },
        update: {},
        create: { email: "zsm.test@mrtracker.com", passwordHash: "dummy", role: Role.ZSM },
      }),
      testDb.user.upsert({
        where: { email: "marketing.test@mrtracker.com" },
        update: {},
        create: { email: "marketing.test@mrtracker.com", passwordHash: "dummy", role: Role.MARKETING },
      }),
    ]);

    nsmUserId = nsmUser.id;
    zsmUserId = zsmUser.id;
    mktgUserId = mktgUser.id;

    // Seed a sample discount scheme, visual aid, and LMS course in testDb
    await Promise.all([
      testDb.discountScheme.upsert({
        where: { name: "Cardio Festive Push 2026" },
        update: {},
        create: {
          name: "Cardio Festive Push 2026",
          productId: fx.productId,
          minQuantity: 10,
          discountPct: 5.0,
          isActive: true,
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2026-12-31"),
        },
      }),
      testDb.visualAid.create({
        data: {
          productId: fx.productId,
          title: "Cardio Detailing e-Brochure",
          fileUrl: "https://example.com/asset.pdf",
          fileType: "application/pdf",
        },
      }),
      testDb.lMSCourse.upsert({
        where: { title: "Anti-Infective Detailing Masterclass" },
        update: {},
        create: {
          title: "Anti-Infective Detailing Masterclass",
          description: "Comprehensive product mastery on Metacef portfolio.",
        },
      }),
    ]);
  });

  afterAll(async () => {
    try {
      await testDb.discountScheme.deleteMany({ where: { productId: fx.productId } });
      await testDb.visualAid.deleteMany({ where: { productId: fx.productId } });
      await testDb.lMSCourse.deleteMany({ where: { title: "Anti-Infective Detailing Masterclass" } });
    } catch {}
    await testDb.$disconnect();
  });

  it("GET /api/manager/dashboard/nsm returns live zonal metrics and top brands", async () => {
    const token = tokenFor(nsmUserId, Role.NSM);
    const req = jsonRequest("/api/manager/dashboard/nsm", { token });
    const res = await getNsmDashboard(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.zonalData).toBeDefined();
    expect(Array.isArray(body.data.zonalData)).toBe(true);
    expect(body.data.nationalKpis).toBeDefined();
    expect(body.data.nationalKpis.totalAchieved).toBeGreaterThanOrEqual(0);
    expect(body.data.topBrands).toBeDefined();
    expect(body.data.institutional).toBeDefined();
  });

  it("GET /api/manager/dashboard/zsm returns live regional performance and field stats", async () => {
    const token = tokenFor(zsmUserId, Role.ZSM);
    const req = jsonRequest("/api/manager/dashboard/zsm", { token });
    const res = await getZsmDashboard(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.regionalData).toBeDefined();
    expect(Array.isArray(body.data.regionalData)).toBe(true);
    expect(body.data.zoneKpis).toBeDefined();
    expect(body.data.fieldActivity).toBeDefined();
    expect(body.data.widgets.coverage).toBeDefined();
  });

  it("GET /api/marketing/dashboard returns live schemes, visual aids, and campaign KPIs", async () => {
    const token = tokenFor(mktgUserId, Role.MARKETING);
    const req = jsonRequest("/api/marketing/dashboard", { token });
    const res = await getMarketingDashboard(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.kpis).toBeDefined();
    expect(body.data.campaigns.length).toBeGreaterThan(0);
    expect(body.data.visualAids.length).toBeGreaterThan(0);
  });

  it("GET /api/lms/courses returns courses and computed employee training KPIs", async () => {
    const token = tokenFor(fx.mrUserId, Role.MR);
    const req = jsonRequest("/api/lms/courses", { token });
    const res = await getLmsCourses(req, noParams);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.courses.length).toBeGreaterThan(0);
    expect(body.data.kpis).toBeDefined();
    expect(body.data.kpis.totalCourses).toBeGreaterThan(0);
  });

  it("GET & PUT /api/admin/company-settings syncs company billing details in PostgreSQL", async () => {
    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    
    // GET current settings
    const getReq = jsonRequest("/api/admin/company-settings", { token });
    const getRes = await getCompanySettings(getReq, noParams);
    expect(getRes.status).toBe(200);
    const getBody = await readJson(getRes);
    expect(getBody.data.settings).toBeDefined();

    // PUT updated settings
    const putReq = jsonRequest("/api/admin/company-settings", {
      method: "PUT",
      token,
      body: {
        name: "Metapharsic Trend Pharmaceuticals Pvt Ltd",
        address: "7th Floor, Innovation Park, Sector V, Salt Lake, Kolkata 700091",
        phone: "+91 33 2357 8900",
        panNo: "AABCM1234F",
        gstin: "19AABCM1234F1Z5",
        dlNo1: "DL-WB-2026-101",
        dlNo2: "DL-WB-2026-102",
        bankName: "HDFC Bank",
        accountNo: "50200012345678",
        ifscCode: "HDFC0001234",
        bankBranch: "Salt Lake Sector V",
      },
    });

    const putRes = await updateCompanySettings(putReq, noParams);
    expect(putRes.status).toBe(200);

    const putBody = await readJson(putRes);
    expect(putBody.success).toBe(true);
    expect(putBody.data.settings.name).toBe("Metapharsic Trend Pharmaceuticals Pvt Ltd");
    expect(putBody.data.settings.gstin).toBe("19AABCM1234F1Z5");
  });
});
