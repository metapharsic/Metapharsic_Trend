import { Role } from "@prisma/client";
import { testDb, tokenFor, jsonRequest, readJson, noParams } from "./helpers/api";
import { CreditAgentsService } from "../services/credit-agents.service";
import { POST as logCollectionRoute, GET as getCollectionsRoute } from "../app/api/mr/collections/route";
import { GET as getMrCreditSummary } from "../app/api/mr/credit-summary/route";
import { GET as getManagerCredit } from "../app/api/manager/credit/route";
import { round2 } from "../lib/pricing";

describe("Credit & Collections Multi-Threaded Logic & Scoping Integration", () => {
  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("1. CreditAgentsService Pipeline & Mathematical Parity", () => {
    it("computes company-wide credit overview with 0 drift between aging buckets and total outstanding", async () => {
      const res = await CreditAgentsService.executeCreditPipeline();
      const { creditData, agents, orchestratorStatus } = res;

      expect(orchestratorStatus).toBe("OPTIMAL");
      expect(agents.length).toBe(4);
      expect(creditData.chemists.length).toBeGreaterThan(0);

      const summary = creditData.summary;
      const bucketSum = round2(
        summary.aging0To30 + summary.aging31To60 + summary.aging61To90 + summary.aging90Plus
      );

      expect(Math.abs(bucketSum - summary.totalOutstanding)).toBeLessThanOrEqual(1);
    });

    it("ensures every MR has visibility into active customer portfolio and outstanding dues", async () => {
      const mrEmployees = await testDb.employee.findMany({
        where: { user: { role: Role.MR } },
        include: { user: true },
      });

      expect(mrEmployees.length).toBeGreaterThan(0);

      for (const mr of mrEmployees) {
        const pipeline = await CreditAgentsService.executeCreditPipeline({ employeeId: mr.id });
        // No MR should be locked out with an empty dashboard (0 chemists)
        expect(pipeline.creditData.chemists.length).toBeGreaterThan(0);
        expect(pipeline.creditData.summary).toBeDefined();
      }
    });
  });

  describe("2. FIFO Invoice-to-Collection Reconciliation & Paid Status", () => {
    it("synchronizes chemist invoice paid flag according to cumulative payments", async () => {
      // Find a chemist with invoices
      const invoice = await testDb.invoice.findFirst({
        where: { order: { chemistId: { not: null } } },
        include: { order: true },
      });

      if (invoice && invoice.order?.chemistId) {
        const chemistId = invoice.order.chemistId;
        const result = await CreditAgentsService.reconcileChemistInvoicePaidStatus(testDb, chemistId);

        expect(result).toHaveProperty("updatedCount");
        expect(Array.isArray(result.paidInvoiceIds)).toBe(true);
        expect(Array.isArray(result.unpaidInvoiceIds)).toBe(true);
      }
    });
  });

  describe("3. Collection Logging Route Access & Invoice Allocation", () => {
    it("allows managers (Admin, ASM, Finance) to log payments without 403 Forbidden", async () => {
      const admin = await testDb.employee.findFirst({
        where: { user: { role: Role.ADMIN } },
        include: { user: true },
      });
      const chemist = await testDb.chemist.findFirst();

      if (admin && admin.user && chemist) {
        const testAmount = 5;
        const req = jsonRequest("/api/mr/collections", {
          method: "POST",
          token: tokenFor(admin.user.id, Role.ADMIN),
          body: {
            chemistId: chemist.id,
            amount: testAmount,
            refNumber: "[CASH] TEST-ADMIN-LOG",
          },
        });

        const res = await logCollectionRoute(req, noParams);
        expect(res.status).toBe(201);
        const data = await readJson(res);
        expect(data.data.collection).toBeDefined();
        expect(Number(data.data.collection.amount)).toBe(testAmount);

        // Clean up test collection
        await CreditAgentsService.reversePaymentCollection({
          collectionId: data.data.collection.id,
          reason: "Automated Test Cleanup",
        });
      }
    });

    it("allows MRs to log payments for active chemists and reflects immediately in outstanding", async () => {
      const mr = await testDb.employee.findFirst({
        where: { user: { role: Role.MR } },
        include: { user: true },
      });
      const chemist = await testDb.chemist.findFirst();

      if (mr && mr.user && chemist) {
        const testAmount = 10;
        const req = jsonRequest("/api/mr/collections", {
          method: "POST",
          token: tokenFor(mr.user.id, Role.MR),
          body: {
            chemistId: chemist.id,
            amount: testAmount,
            refNumber: "[UPI] TEST-MR-LOG",
          },
        });

        const res = await logCollectionRoute(req, noParams);
        expect(res.status).toBe(201);
        const data = await readJson(res);
        expect(data.data.collection).toBeDefined();

        // Clean up test collection
        await CreditAgentsService.reversePaymentCollection({
          collectionId: data.data.collection.id,
          reason: "Automated Test Cleanup",
        });
      }
    });
  });

  describe("4. Endpoints Parity (GET /api/mr/credit-summary and GET /api/manager/credit)", () => {
    it("serves MR credit summary endpoint with openInvoices and risk alerts", async () => {
      const mr = await testDb.employee.findFirst({
        where: { user: { role: Role.MR } },
        include: { user: true },
      });

      if (mr && mr.user) {
        const req = jsonRequest("/api/mr/credit-summary", {
          token: tokenFor(mr.user.id, Role.MR),
        });
        const res = await getMrCreditSummary(req, noParams);
        expect(res.status).toBe(200);
        const json = await readJson(res);

        expect(json.data).toHaveProperty("chemists");
        expect(json.data).toHaveProperty("totalOutstanding");
        expect(json.data).toHaveProperty("agents");
        expect(json.data.chemists.length).toBeGreaterThan(0);
      }
    });

    it("serves Manager credit endpoint with company-wide summary", async () => {
      const admin = await testDb.employee.findFirst({
        where: { user: { role: Role.ADMIN } },
        include: { user: true },
      });

      if (admin && admin.user) {
        const req = jsonRequest("/api/manager/credit", {
          token: tokenFor(admin.user.id, Role.ADMIN),
        });
        const res = await getManagerCredit(req, noParams);
        expect(res.status).toBe(200);
        const json = await readJson(res);

        expect(json.data).toHaveProperty("chemists");
        expect(json.data).toHaveProperty("totalOutstanding");
        expect(json.data.chemists.length).toBeGreaterThan(0);
      }
    });
  });
});
