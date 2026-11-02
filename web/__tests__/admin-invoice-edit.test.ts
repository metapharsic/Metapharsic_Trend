import { Role } from "@prisma/client";
import { testDb, tokenFor, jsonRequest, readJson } from "./helpers/api";
import { GET as getInvoiceRoute, PUT as updateInvoiceRoute } from "../app/api/invoices/[id]/route";

describe("Admin Invoice Editing Privileges & Multi-Threaded Wire Test Suite", () => {
  let adminUserId: string;
  let mrUserId: string;
  let asmUserId: string;
  let testInvoiceId: string;
  let testOrderId: string;
  let testProductId: string;

  beforeAll(async () => {
    // Locate or create test users
    const adminUser = await testDb.user.findFirst({ where: { role: Role.ADMIN } });
    adminUserId = adminUser?.id || "admin-test-id";

    const mrUser = await testDb.user.findFirst({ where: { role: Role.MR } });
    mrUserId = mrUser?.id || "mr-test-id";

    const asmUser = await testDb.user.findFirst({ where: { role: Role.ASM } });
    asmUserId = asmUser?.id || "asm-test-id";

    // Locate an existing invoice for testing
    const invoice = await testDb.invoice.findFirst({
      where: { order: { items: { some: {} } } },
      include: { order: { include: { items: { include: { product: true } } } } },
    });

    if (invoice && invoice.order?.items[0]) {
      testInvoiceId = invoice.id;
      testOrderId = invoice.orderId;
      testProductId = invoice.order.items[0].productId;
    }
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("1. GET /api/invoices/[id] Detailed Retrieval", () => {
    it("fetches the invoice with order, chemist, and products", async () => {
      if (!testInvoiceId) return;

      const req = jsonRequest(`/api/invoices/${testInvoiceId}`, {
        method: "GET",
        token: tokenFor(adminUserId, Role.ADMIN),
      });

      const res = await getInvoiceRoute(req, { params: { id: testInvoiceId } });
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.data.invoice).toBeDefined();
      expect(body.data.invoice.id).toBe(testInvoiceId);
      expect(body.data.invoice.order).toBeDefined();
      expect(body.data.invoice.order.items.length).toBeGreaterThan(0);
    });
  });

  describe("2. RBAC Privilege Enforcement (Only Admin Has Edit Privileges)", () => {
    it("rejects MR attempting to edit invoice details with 403 Forbidden", async () => {
      if (!testInvoiceId) return;

      const req = jsonRequest(`/api/invoices/${testInvoiceId}`, {
        method: "PUT",
        token: tokenFor(mrUserId, Role.MR),
        body: {
          transport: "Unauthorized MR Courier",
          cases: 5,
        },
      });

      const res = await updateInvoiceRoute(req, { params: { id: testInvoiceId } });
      expect(res.status).toBe(403);
    });

    it("rejects ASM attempting to edit invoice details with 403 Forbidden", async () => {
      if (!testInvoiceId) return;

      const req = jsonRequest(`/api/invoices/${testInvoiceId}`, {
        method: "PUT",
        token: tokenFor(asmUserId, Role.ASM),
        body: {
          transport: "Unauthorized ASM Courier",
          cases: 10,
        },
      });

      const res = await updateInvoiceRoute(req, { params: { id: testInvoiceId } });
      expect(res.status).toBe(403);

      const body = await readJson(res);
      const errMsg = body.error?.message || body.error;
      expect(errMsg).toContain("Only administrators are privileged to edit invoices.");
    });

    it("allows Admin to edit invoice metadata and dispatch details", async () => {
      if (!testInvoiceId) return;

      const uniqueLr = `LR-${Date.now().toString().slice(-6)}`;
      const req = jsonRequest(`/api/invoices/${testInvoiceId}`, {
        method: "PUT",
        token: tokenFor(adminUserId, Role.ADMIN),
        body: {
          transport: "Official Admin Fast Courier",
          lrNo: uniqueLr,
          cases: 4,
          partyDlNo: "DL-ADMIN-TEST",
        },
      });

      const res = await updateInvoiceRoute(req, { params: { id: testInvoiceId } });
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.data.invoice.transport).toBe("Official Admin Fast Courier");
      expect(body.data.invoice.lrNo).toBe(uniqueLr);
      expect(body.data.invoice.cases).toBe(4);
      expect(body.data.invoice.partyDlNo).toBe("DL-ADMIN-TEST");
    });
  });

  describe("3. Admin Line Items Editing & Statutory GST Recalculation", () => {
    it("updates line items, recalculates tax, updates ledger, and maintains exact totals", async () => {
      if (!testInvoiceId || !testProductId) return;

      const testItems = [
        {
          productId: testProductId,
          quantity: 10,
          freeQty: 1,
          price: 100.0,
          discountPct: 10.0, // 10% discount -> taxable = 900
          gstPct: 12.0, // 12% GST -> 108 GST
          batchNo: "BATCH-ADM-01",
          packSize: "10x10",
        },
      ];

      const req = jsonRequest(`/api/invoices/${testInvoiceId}`, {
        method: "PUT",
        token: tokenFor(adminUserId, Role.ADMIN),
        body: {
          items: testItems,
          partyName: "Admin Verified Hospital Outlet",
        },
      });

      const res = await updateInvoiceRoute(req, { params: { id: testInvoiceId } });
      expect(res.status).toBe(200);

      const body = await readJson(res);
      const updatedInvoice = body.data.invoice;

      // Taxable: 10 * 100 * 0.9 = 900.00
      // GST: 900 * 0.12 = 108.00
      // Total: 1008.00
      expect(Number(updatedInvoice.amount)).toBe(1008);
      expect(Number(updatedInvoice.grandTotal)).toBe(1008);
      expect(Number(updatedInvoice.totalDiscount)).toBe(100);
      expect(Number(updatedInvoice.totalGst)).toBe(108);
      expect(updatedInvoice.totalQty).toBe(10);
      expect(updatedInvoice.partyName).toBe("Admin Verified Hospital Outlet");

      // Verify double-entry ledger updated
      const ledgerEntries = await testDb.ledgerTransaction.findMany({
        where: { sourceType: "INVOICE", sourceId: testInvoiceId },
      });
      expect(ledgerEntries.length).toBeGreaterThan(0);
      const arEntry = ledgerEntries.find((l) => l.accountCode === "1100");
      expect(Number(arEntry?.debit)).toBe(1008);
    });
  });
});
