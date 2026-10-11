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
import { ModulesService, INITIAL_MODULES_DATA } from "../services/modules.service";
import { GET as getModules, POST as createModule } from "../app/api/system/modules/route";
import { GET as getArtifacts, POST as createArtifact } from "../app/api/system/artifacts/route";
import { GET as getSidebar } from "../app/api/system/sidebar/route";

describe("Database Provisioning & Live Retrieval for Modules & Artifacts", () => {
  let fx: TestFixture;
  let adminToken: string;
  let mrToken: string;
  let distToken: string;
  let financeToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    mrToken = tokenFor(fx.mrUserId, Role.MR);

    const distUser = await testDb.user.upsert({
      where: { email: "dist.test@mrtracker.com" },
      update: {},
      create: { email: "dist.test@mrtracker.com", passwordHash: "dummy", role: Role.DISTRIBUTOR },
    });
    distToken = tokenFor(distUser.id, Role.DISTRIBUTOR);

    const financeUser = await testDb.user.upsert({
      where: { email: "fin.test@mrtracker.com" },
      update: {},
      create: { email: "fin.test@mrtracker.com", passwordHash: "dummy", role: Role.FINANCE },
    });
    financeToken = tokenFor(financeUser.id, Role.FINANCE);

    // Provision both modules and artifacts in testDb
    await ModulesService.provisionDefaultModules(testDb);
    await ModulesService.provisionDefaultArtifacts(testDb);
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("1. Database Provisioning Verification", () => {
    it("provisions all default navigation modules into the PostgreSQL app_modules table", async () => {
      const count = await testDb.appModule.count();
      expect(count).toBeGreaterThanOrEqual(INITIAL_MODULES_DATA.length);

      const dcrModule = await testDb.appModule.findUnique({ where: { code: "NAV_MR_CALLS" } });
      expect(dcrModule).not.toBeNull();
      expect(dcrModule?.href).toBe("/mr/calls");
      expect(dcrModule?.category).toBe("Field Force & CRM");
      expect(dcrModule?.roles).toContain(Role.MR);
    });

    it("provisions all default system artifacts into the PostgreSQL system_artifacts table", async () => {
      const count = await testDb.systemArtifact.count();
      expect(count).toBeGreaterThanOrEqual(4);

      const councilArt = await testDb.systemArtifact.findUnique({
        where: { code: "ART_MR_MULTIAGENT_REPORT" },
      });
      expect(councilArt).not.toBeNull();
      expect(councilArt?.artifactType).toBe("INTELLIGENCE_COUNCIL");
      expect(councilArt?.fileFormat).toBe("MARKDOWN");
      expect(councilArt?.content).toBeDefined();
    });

    it("verifies modules and artifacts have distinct moduleType tags", async () => {
      const artifactModules = await testDb.appModule.findMany({ where: { isArtifact: true } });
      expect(artifactModules.length).toBeGreaterThan(0);
      for (const m of artifactModules) {
        expect(m.moduleType).toBe("ARTIFACT");
      }
    });
  });

  describe("2. Multi-Role RBAC & Scoping Logic via Database", () => {
    it("scopes modules for MR role and applies labelByRole overrides from database", async () => {
      const mrModules = await ModulesService.getModulesForRole(Role.MR, testDb);
      expect(mrModules.length).toBeGreaterThan(0);

      // Verify MR has calls, attendance, tour plans, secondary orders
      const orderModule = mrModules.find((m) => m.code === "NAV_SECONDARY_ORDERS");
      expect(orderModule).toBeDefined();
      expect(orderModule?.label).toBe("My Orders"); // labelByRole override for MR

      const claimsModule = mrModules.find((m) => m.code === "NAV_MR_CLAIMS");
      expect(claimsModule?.label).toBe("Expiry & Damage Claims");

      // Verify MR cannot access admin settings
      const adminOnly = mrModules.find((m) => m.code === "NAV_ADMIN_CONTROL");
      expect(adminOnly).toBeUndefined();
    });

    it("scopes modules for DISTRIBUTOR role with distributor portal and overridden order label", async () => {
      const distModules = await ModulesService.getModulesForRole(Role.DISTRIBUTOR, testDb);
      expect(distModules.length).toBeGreaterThan(0);

      const portal = distModules.find((m) => m.code === "NAV_DISTRIBUTOR_PORTAL");
      expect(portal).toBeDefined();

      const orders = distModules.find((m) => m.code === "NAV_SECONDARY_ORDERS");
      expect(orders).toBeDefined();
      expect(orders?.label).toBe("Orders & Invoices"); // labelByRole override for DISTRIBUTOR
    });

    it("scopes modules for FINANCE role with ledger, chart of accounts, and statements", async () => {
      const finModules = await ModulesService.getModulesForRole(Role.FINANCE, testDb);
      const gl = finModules.find((m) => m.code === "NAV_FINANCE_GL");
      const coa = finModules.find((m) => m.code === "NAV_CHART_OF_ACCOUNTS");
      const statements = finModules.find((m) => m.code === "NAV_FINANCIAL_STATEMENTS");

      expect(gl).toBeDefined();
      expect(coa).toBeDefined();
      expect(statements).toBeDefined();
      expect(statements?.isArtifact).toBe(true);
    });

    it("groups sidebar categories hierarchically and preserves categoryOrder", async () => {
      const sidebar = await ModulesService.getSidebarForRole(Role.ADMIN, testDb);
      expect(sidebar.length).toBe(6);

      // Verify category ordering
      for (let i = 0; i < sidebar.length - 1; i++) {
        expect(sidebar[i].categoryOrder).toBeLessThanOrEqual(sidebar[i + 1].categoryOrder);
      }

      // Verify each group has items
      for (const group of sidebar) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });

  describe("3. Live API Routes Retrieval (Fetching from DB Only)", () => {
    it("GET /api/system/modules returns modules and sidebar for authenticated user", async () => {
      const req = jsonRequest("/api/system/modules", { token: mrToken });
      const res = await getModules(req, noParams);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      expect(body.data.role).toBe(Role.MR);
      expect(Array.isArray(body.data.modules)).toBe(true);
      expect(Array.isArray(body.data.sidebar)).toBe(true);
      expect(body.data.total).toBeGreaterThan(0);
    });

    it("GET /api/system/modules?role=FINANCE allows ADMIN to inspect finance modules", async () => {
      const req = jsonRequest("/api/system/modules?role=FINANCE", { token: adminToken });
      const res = await getModules(req, noParams);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      expect(body.data.role).toBe(Role.FINANCE);
      expect(body.data.modules.some((m: any) => m.code === "NAV_FINANCE_GL")).toBe(true);
    });

    it("POST /api/system/modules provisions a custom dynamic module into the database", async () => {
      const newModulePayload = {
        code: "NAV_TEST_CUSTOM_ANALYTICS",
        label: "Real-Time AI Prescription Analytics",
        href: "/analytics/prescriptions",
        icon: "Activity",
        category: "Analytics & Marketing",
        categoryOrder: 5,
        sortOrder: 15,
        roles: [Role.ADMIN, Role.MD],
        isArtifact: true,
        moduleType: "ARTIFACT",
        description: "Prescription velocity and brand switch forecasting",
      };

      const req = jsonRequest("/api/system/modules", {
        method: "POST",
        token: adminToken,
        body: newModulePayload,
      });

      const res = await createModule(req, noParams);
      expect(res.status).toBe(201);

      const body = await readJson(res);
      expect(body.data.module.code).toBe(newModulePayload.code);

      // Verify it is directly queryable from testDb
      const inDb = await testDb.appModule.findUnique({
        where: { code: newModulePayload.code },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.label).toBe(newModulePayload.label);
      expect(inDb?.isArtifact).toBe(true);

      // Clean up
      await testDb.appModule.delete({ where: { code: newModulePayload.code } });
    });

    it("GET /api/system/artifacts fetches all stored system artifacts from database", async () => {
      const req = jsonRequest("/api/system/artifacts", { token: adminToken });
      const res = await getArtifacts(req, noParams);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.artifacts)).toBe(true);
      expect(body.data.total).toBeGreaterThanOrEqual(4);
    });

    it("GET /api/system/artifacts?type=INTELLIGENCE_COUNCIL filters artifacts by type", async () => {
      const req = jsonRequest("/api/system/artifacts?type=INTELLIGENCE_COUNCIL", { token: adminToken });
      const res = await getArtifacts(req, noParams);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      for (const art of body.data.artifacts) {
        expect(art.artifactType).toBe("INTELLIGENCE_COUNCIL");
      }
    });

    it("POST /api/system/artifacts saves a new artifact into PostgreSQL", async () => {
      const artifactPayload = {
        code: "ART_TEST_WEEKLY_SYNTHESIS",
        title: "Weekly National Commercial Synthesis",
        artifactType: "REPORT",
        category: "Commercial & Channels",
        fileFormat: "JSON",
        filePath: "/reports-output/weekly-synthesis.json",
        content: JSON.stringify({ nationalPtr: 450000, targetAchievementPct: 98.4 }),
        metadata: { week: 41, year: 2026 },
      };

      const req = jsonRequest("/api/system/artifacts", {
        method: "POST",
        token: adminToken,
        body: artifactPayload,
      });

      const res = await createArtifact(req, noParams);
      expect(res.status).toBe(201);

      const body = await readJson(res);
      expect(body.data.artifact.code).toBe(artifactPayload.code);

      // Verify in testDb
      const inDb = await testDb.systemArtifact.findUnique({
        where: { code: artifactPayload.code },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.title).toBe(artifactPayload.title);

      // Cleanup
      await testDb.systemArtifact.delete({ where: { code: artifactPayload.code } });
    });

    it("GET /api/system/sidebar returns hierarchical category groups and artifacts summary", async () => {
      const req = jsonRequest("/api/system/sidebar", { token: adminToken });
      const res = await getSidebar(req, noParams);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.categories)).toBe(true);
      expect(body.data.totalModules).toBeGreaterThan(0);
      expect(body.data.totalArtifacts).toBeGreaterThanOrEqual(4);
    });
  });

  describe("4. Dynamic Zero-Hardcode Mutation & Immediate Reflection", () => {
    it("updates a module label in the database and immediately reflects without hardcoded dependencies", async () => {
      const targetCode = "NAV_MR_ATTENDANCE";
      const original = await testDb.appModule.findUnique({ where: { code: targetCode } });
      expect(original).not.toBeNull();

      // Update in DB
      await testDb.appModule.update({
        where: { code: targetCode },
        data: { label: "Field Geo-Biometric Attendance" },
      });

      // Query via service
      const updatedMods = await ModulesService.getModulesForRole(Role.MR, testDb);
      const updatedItem = updatedMods.find((m) => m.code === targetCode);
      expect(updatedItem?.label).toBe("Field Geo-Biometric Attendance");

      // Revert in DB
      await testDb.appModule.update({
        where: { code: targetCode },
        data: { label: original!.label },
      });

      const revertedMods = await ModulesService.getModulesForRole(Role.MR, testDb);
      const revertedItem = revertedMods.find((m) => m.code === targetCode);
      expect(revertedItem?.label).toBe(original!.label);
    });
  });
});
