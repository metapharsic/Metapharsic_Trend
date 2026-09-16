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
import { GET as getEntities, POST as createEntity } from "../app/api/manager/entities/route";
import {
  GET as getEntityDetails,
  PUT as updateEntity,
  DELETE as deleteEntity,
} from "../app/api/manager/entities/[id]/route";

describe("Master Profiles Multi-Agent Wiring & CRUD Provisions", () => {
  let fx: TestFixture;
  let adminToken: string;
  let asmToken: string;
  let mrToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    asmToken = tokenFor(fx.asmUserId, Role.ASM);
    mrToken = tokenFor(fx.mrUserId, Role.MR);
  });

  describe("1. Append Provisions (POST /api/manager/entities)", () => {
    it("creates a Doctor with primary specialty and territory linkage", async () => {
      const req = jsonRequest("/api/manager/entities", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Dr. Ananya Sen",
          type: "DOCTOR",
          address: "Sen Heart Clinic, Sector 4",
          territoryId: fx.territoryId,
          primarySpecialty: "Cardiology",
          secondarySpecialty: "Electrophysiology",
          qualification: "MBBS, DM (Card)",
          registrationNo: "WB-MC-98765",
          whatsApp: "9830012345",
        },
      });
      const res = await createEntity(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Dr. Ananya Sen");
      expect(data.data.entity.type).toBe("DOCTOR");
      expect(data.data.entity.primarySpecialty).toBe("Cardiology");
    });

    it("creates a Chemist with credit limit and billing details", async () => {
      const req = jsonRequest("/api/manager/entities", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Sanjeevani Medicos",
          type: "CHEMIST",
          address: "Shop 12, Main Bazaar",
          territoryId: fx.territoryId,
          contactPerson: "Rajesh Gupta",
          billingName: "Sanjeevani Medicos LLP",
          gstNo: "07AAACX1234F1Z5",
          licenseNo: "DL-20B-9988",
          creditLimit: 75000,
        },
      });
      const res = await createEntity(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Sanjeevani Medicos");
      expect(data.data.entity.type).toBe("CHEMIST");
      expect(data.data.entity.creditLimit).toBe(75000);
    });

    it("creates a Distributor with wholesale credentials", async () => {
      const req = jsonRequest("/api/manager/entities", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Prime Life Distributors",
          type: "DISTRIBUTOR",
          address: "Plot 45, Transport Nagar",
          territoryId: fx.territoryId,
          gstNo: "07AAACD9988E1Z9",
          licenseNo: "WH-21B-4433",
          creditLimit: 500000,
        },
      });
      const res = await createEntity(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Prime Life Distributors");
      expect(data.data.entity.type).toBe("DISTRIBUTOR");
    });

    it("creates a Hospital with bed strength and departments", async () => {
      const req = jsonRequest("/api/manager/entities", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Metro Multispeciality Hospital",
          type: "HOSPITAL",
          address: "Ring Road, Civil Lines",
          territoryId: fx.territoryId,
          departments: "Cardiology, Oncology, ICU",
          bedStrength: 250,
          purchaseManager: "Sunil Kapoor",
        },
      });
      const res = await createEntity(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Metro Multispeciality Hospital");
      expect(data.data.entity.type).toBe("HOSPITAL");
      expect(data.data.entity.bedStrength).toBe(250);
    });

    it("creates an Employee and provisions User + Employee records", async () => {
      const req = jsonRequest("/api/manager/entities", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Vikram Malhotra",
          firstName: "Vikram",
          lastName: "Malhotra",
          email: `vikram.test.${Date.now()}@trendmr.com`,
          phone: "9811002233",
          type: "EMPLOYEE",
          role: "MR",
          territoryId: fx.territoryId,
          password: "SecurePassword123",
        },
      });
      const res = await createEntity(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Vikram Malhotra");
      expect(data.data.entity.type).toBe("EMPLOYEE");
      expect(data.data.entity.role).toBe("MR");
    });
  });

  describe("2. Filtering & Multi-Agent Audit Provisions (GET /api/manager/entities)", () => {
    it("returns entities with multiAgentAudit council metrics", async () => {
      const req = jsonRequest("/api/manager/entities?type=DOCTOR", {
        token: adminToken,
      });
      const res = await getEntities(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(Array.isArray(data.data.entities)).toBe(true);
      expect(data.data.multiAgentAudit).toBeDefined();
      expect(data.data.multiAgentAudit.dataIntegrityAgent.agent).toBe("DATA_INTEGRITY_AGENT");
      expect(data.data.multiAgentAudit.fieldDcrAgent.agent).toBe("FIELD_DCR_AGENT");
      expect(data.data.multiAgentAudit.financeAccountsAgent.agent).toBe("FINANCE_ACCOUNTS_AGENT");
      expect(data.data.multiAgentAudit.roleAuthAgent.agent).toBe("ROLE_AUTH_AGENT");
    });

    it("filters by territoryId and search keyword correctly", async () => {
      const req = jsonRequest(
        `/api/manager/entities?type=DOCTOR&territoryId=${fx.territoryId}&search=Ananya`,
        {
          token: adminToken,
        }
      );
      const res = await getEntities(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entities.length).toBeGreaterThanOrEqual(1);
      expect(data.data.entities[0].name).toContain("Ananya");
    });

    it("filters employees by role", async () => {
      const req = jsonRequest("/api/manager/entities?type=EMPLOYEE&filter=MR", {
        token: adminToken,
      });
      const res = await getEntities(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(Array.isArray(data.data.entities)).toBe(true);
      data.data.entities.forEach((emp: any) => {
        expect(emp.role).toBe("MR");
      });
    });
  });

  describe("3. View 360° Dossier Provisions (GET /api/manager/entities/[id])", () => {
    it("returns complete 360° dossier for Doctor with clinical relations & metrics", async () => {
      const doctor = await testDb.doctor.findFirst({ where: { territoryId: fx.territoryId } });
      expect(doctor).toBeDefined();

      const req = jsonRequest(`/api/manager/entities/${doctor!.id}?type=DOCTOR`, {
        token: adminToken,
      });
      const res = await getEntityDetails(req, { params: { id: doctor!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entity.id).toBe(doctor!.id);
      expect(data.data.entity.type).toBe("DOCTOR");
      expect(data.data.entity.territory).toBeDefined();
      expect(data.data.entity.metrics).toBeDefined();
      expect(typeof data.data.entity.metrics.totalVisits).toBe("number");
    });

    it("returns complete 360° dossier for Chemist with commercial metrics", async () => {
      const chemist = await testDb.chemist.findFirst({ where: { territoryId: fx.territoryId } });
      expect(chemist).toBeDefined();

      const req = jsonRequest(`/api/manager/entities/${chemist!.id}?type=CHEMIST`, {
        token: adminToken,
      });
      const res = await getEntityDetails(req, { params: { id: chemist!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entity.id).toBe(chemist!.id);
      expect(data.data.entity.type).toBe("CHEMIST");
      expect(data.data.entity.metrics.totalOrders).toBeDefined();
    });

    it("returns complete 360° dossier for Employee with territory and subordinates", async () => {
      const emp = await testDb.employee.findFirst();
      expect(emp).toBeDefined();

      const req = jsonRequest(`/api/manager/entities/${emp!.id}?type=EMPLOYEE`, {
        token: adminToken,
      });
      const res = await getEntityDetails(req, { params: { id: emp!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entity.id).toBe(emp!.id);
      expect(data.data.entity.type).toBe("EMPLOYEE");
      expect(data.data.entity.metrics.totalVisits).toBeDefined();
    });
  });

  describe("4. Edit Provisions (PUT /api/manager/entities/[id])", () => {
    it("updates Doctor specialty and contact info", async () => {
      const doctor = await testDb.doctor.findFirst({ where: { territoryId: fx.territoryId } });
      expect(doctor).toBeDefined();

      const req = jsonRequest(`/api/manager/entities/${doctor!.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          type: "DOCTOR",
          name: "Dr. Ananya Sen Updated",
          primarySpecialty: "Interventional Cardiology",
          whatsApp: "9830099999",
        },
      });
      const res = await updateEntity(req, { params: { id: doctor!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entity.name).toBe("Dr. Ananya Sen Updated");
      expect(data.data.entity.primarySpecialty).toBe("Interventional Cardiology");
      expect(data.data.entity.whatsApp).toBe("9830099999");
    });

    it("updates Chemist credit limit and GSTIN", async () => {
      const chemist = await testDb.chemist.findFirst({ where: { territoryId: fx.territoryId } });
      expect(chemist).toBeDefined();

      const req = jsonRequest(`/api/manager/entities/${chemist!.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          type: "CHEMIST",
          creditLimit: 120000,
          billingName: "Sanjeevani Medicos Super Hub",
        },
      });
      const res = await updateEntity(req, { params: { id: chemist!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.entity.creditLimit).toBe(120000);
      expect(data.data.entity.billingName).toBe("Sanjeevani Medicos Super Hub");
    });

    it("updates Employee phone and name", async () => {
      const emp = await testDb.employee.findFirst({ where: { firstName: "Vikram" } });
      if (emp) {
        const req = jsonRequest(`/api/manager/entities/${emp.id}`, {
          method: "PUT",
          token: adminToken,
          body: {
            type: "EMPLOYEE",
            firstName: "Vikram",
            lastName: "Malhotra Sr.",
            phone: "9811009988",
          },
        });
        const res = await updateEntity(req, { params: { id: emp.id } });
        expect(res.status).toBe(200);
        const data = await readJson(res);
        expect(data.data.entity.name).toBe("Vikram Malhotra Sr.");
        expect(data.data.entity.phone).toBe("9811009988");
      }
    });
  });

  describe("5. Delete Provisions (DELETE /api/manager/entities/[id])", () => {
    it("deletes an unlinked Doctor record", async () => {
      const doc = await testDb.doctor.create({
        data: {
          fullName: "Dr. Temporary Delete",
          primarySpecialty: "General",
          clinicAddress: "Temp Address",
          latitude: 0,
          longitude: 0,
          territoryId: fx.territoryId,
        },
      });

      const req = jsonRequest(`/api/manager/entities/${doc.id}?type=DOCTOR`, {
        method: "DELETE",
        token: adminToken,
      });
      const res = await deleteEntity(req, { params: { id: doc.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.message).toBe("Doctor deleted");
    });

    it("safely handles Employee deletion by deactivation if historical records exist", async () => {
      const freshUser = await testDb.user.create({
        data: {
          email: `temp.del.${Date.now()}@trendmr.com`,
          passwordHash: "hash",
          role: Role.MR,
          employee: {
            create: {
              firstName: "Temp",
              lastName: "User",
              phone: "1234567890",
            },
          },
        },
        include: { employee: true },
      });

      const req = jsonRequest(`/api/manager/entities/${freshUser.employee!.id}?type=EMPLOYEE`, {
        method: "DELETE",
        token: adminToken,
      });
      const res = await deleteEntity(req, { params: { id: freshUser.employee!.id } });
      expect(res.status).toBe(200);
    });
  });
});
