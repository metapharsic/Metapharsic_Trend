import { Role, ClaimStatus } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { GET as getClaims, POST as createClaim } from "../app/api/mr/claims/route";
import {
  GET as getClaimDetails,
  PUT as updateClaim,
  DELETE as deleteClaim,
} from "../app/api/mr/claims/[id]/route";
import { PUT as submitClaimToAsm } from "../app/api/mr/claims/[id]/submit/route";

describe("My Claims Multi-Agent Wiring & CRUD Provisions", () => {
  let fx: TestFixture;
  let adminToken: string;
  let asmToken: string;
  let mrToken: string;
  let testDistributorId: string;
  let testProductId: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    asmToken = tokenFor(fx.asmUserId, Role.ASM);
    mrToken = tokenFor(fx.mrUserId, Role.MR);

    // Create a distributor and product for claim testing
    const distributor = await testDb.distributor.create({
      data: {
        name: "Metro Pharma Distribution Hub",
        address: "Industrial Area, Phase 2",
        territoryId: fx.territoryId,
        gstNo: "07AAACM1234F1Z1",
      },
    });
    testDistributorId = distributor.id;

    const product = await testDb.product.create({
      data: {
        name: "CardioSafe 50mg",
        sku: `CS-50-${Date.now()}`,
        price: 150.0,
        ptr: 120.0,
        mrp: 180.0,
        packSize: "10x10 Tablets",
        composition: "Atenolol 50mg",
      },
    });
    testProductId = product.id;
  });

  describe("1. Append Provisions (POST /api/mr/claims)", () => {
    it("creates a draft claim (PENDING_MR) with live valuation", async () => {
      const req = jsonRequest("/api/mr/claims", {
        method: "POST",
        token: mrToken,
        body: {
          chemistId: fx.chemistId,
          distributorId: testDistributorId,
          productId: testProductId,
          quantity: 10,
          reason: "Expired stock return from shelf",
        },
      });
      const res = await createClaim(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.claim.status).toBe(ClaimStatus.PENDING_MR);
      expect(data.data.claim.quantity).toBe(10);
      expect(data.data.claim.estimatedAmount).toBe(1200); // 10 * ptr (120)
    });

    it("creates a claim directly submitted to ASM (PENDING_ASM)", async () => {
      const req = jsonRequest("/api/mr/claims", {
        method: "POST",
        token: mrToken,
        body: {
          chemistId: fx.chemistId,
          distributorId: testDistributorId,
          productId: testProductId,
          quantity: 5,
          reason: "Broken seal and leakage in transit",
          status: ClaimStatus.PENDING_ASM,
        },
      });
      const res = await createClaim(req, noParams);
      expect(res.status).toBe(201);
      const data = await readJson(res);
      expect(data.data.claim.status).toBe(ClaimStatus.PENDING_ASM);
      expect(data.data.claim.quantity).toBe(5);
    });
  });

  describe("2. Filtering & Multi-Agent Audit Provisions (GET /api/mr/claims)", () => {
    it("returns claims list with multi-agent council metrics and status counts", async () => {
      const req = jsonRequest("/api/mr/claims", { token: mrToken });
      const res = await getClaims(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);

      expect(Array.isArray(data.data.claims)).toBe(true);
      expect(data.data.claims.length).toBeGreaterThanOrEqual(2);

      // Multi-Agent Council Verification
      expect(data.data.multiAgentAudit).toBeDefined();
      expect(data.data.multiAgentAudit.dataIntegrityAgent.agent).toBe("DATA_INTEGRITY_AGENT");
      expect(data.data.multiAgentAudit.commercialAgent.agent).toBe("COMMERCIAL_AGENT");
      expect(data.data.multiAgentAudit.fieldDcrAgent.agent).toBe("FIELD_DCR_AGENT");
      expect(data.data.multiAgentAudit.roleAuthAgent.agent).toBe("ROLE_AUTH_AGENT");

      // Status Counts Breakdown
      expect(data.data.counts).toBeDefined();
      expect(data.data.counts.PENDING_MR).toBeGreaterThanOrEqual(1);
    });

    it("filters claims by status", async () => {
      const req = jsonRequest("/api/mr/claims?status=PENDING_ASM", { token: mrToken });
      const res = await getClaims(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.claims.every((c: any) => c.status === "PENDING_ASM")).toBe(true);
    });

    it("filters claims by search query keyword", async () => {
      const req = jsonRequest("/api/mr/claims?search=CardioSafe", { token: mrToken });
      const res = await getClaims(req, noParams);
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.claims.length).toBeGreaterThanOrEqual(1);
      expect(data.data.claims[0].product.name).toContain("CardioSafe");
    });
  });

  describe("3. View 360° Claim Dossier Provisions (GET /api/mr/claims/[id])", () => {
    it("fetches comprehensive claim details including commercial valuation and party relations", async () => {
      const existingClaim = await testDb.claim.findFirst({
        where: { chemistId: fx.chemistId },
      });
      expect(existingClaim).toBeDefined();

      const req = jsonRequest(`/api/mr/claims/${existingClaim!.id}`, { token: mrToken });
      const res = await getClaimDetails(req, { params: { id: existingClaim!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);

      expect(data.data.claim.id).toBe(existingClaim!.id);
      expect(data.data.claim.chemist).toBeDefined();
      expect(data.data.claim.distributor).toBeDefined();
      expect(data.data.claim.product).toBeDefined();
      expect(data.data.claim.unitPrice).toBe(120);
      expect(data.data.claim.estimatedAmount).toBe(existingClaim!.quantity * 120);
    });
  });

  describe("4. Edit Provisions (PUT /api/mr/claims/[id])", () => {
    it("allows MR to update quantity and reason on a draft claim", async () => {
      const draftClaim = await testDb.claim.findFirst({
        where: { status: ClaimStatus.PENDING_MR },
      });
      expect(draftClaim).toBeDefined();

      const req = jsonRequest(`/api/mr/claims/${draftClaim!.id}`, {
        method: "PUT",
        token: mrToken,
        body: {
          quantity: 20,
          reason: "Updated: 20 units damaged in transit with broken vials",
        },
      });
      const res = await updateClaim(req, { params: { id: draftClaim!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.claim.quantity).toBe(20);
      expect(data.data.claim.reason).toContain("Updated: 20 units");
    });

    it("advances draft claim to PENDING_ASM via submit route", async () => {
      const draftClaim = await testDb.claim.findFirst({
        where: { status: ClaimStatus.PENDING_MR },
      });
      expect(draftClaim).toBeDefined();

      const req = jsonRequest(`/api/mr/claims/${draftClaim!.id}/submit`, {
        method: "PUT",
        token: mrToken,
      });
      const res = await submitClaimToAsm(req, { params: { id: draftClaim!.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.claim.status).toBe(ClaimStatus.PENDING_ASM);
    });
  });

  describe("5. Delete Provisions (DELETE /api/mr/claims/[id])", () => {
    it("deletes a draft claim successfully", async () => {
      const tempClaim = await testDb.claim.create({
        data: {
          chemistId: fx.chemistId,
          distributorId: testDistributorId,
          productId: testProductId,
          employeeId: fx.mrEmployeeId,
          quantity: 2,
          reason: "Test claim for deletion",
          status: ClaimStatus.PENDING_MR,
        },
      });

      const req = jsonRequest(`/api/mr/claims/${tempClaim.id}`, {
        method: "DELETE",
        token: mrToken,
      });
      const res = await deleteClaim(req, { params: { id: tempClaim.id } });
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.message).toBe("Claim deleted successfully");

      const check = await testDb.claim.findUnique({ where: { id: tempClaim.id } });
      expect(check).toBeNull();
    });
  });
});
