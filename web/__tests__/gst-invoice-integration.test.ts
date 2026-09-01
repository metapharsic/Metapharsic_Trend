import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson, noParams, TestFixture } from "./helpers/api";
import { POST as createOrder } from "../app/api/orders/secondary/route";
import { PUT as updateOrder, DELETE as deleteOrder, GET as getOrder } from "../app/api/orders/[id]/route";
import { DELETE as deleteInvoice } from "../app/api/invoices/[id]/route";
import { PUT as updateProduct } from "../app/api/products/[id]/route";

/**
 * Integration coverage for the GST pipeline: booking an order through the
 * real API route must produce an invoice whose stored totals match the
 * per-line math, using the product's actual gstPct — this is what broke
 * silently before (product master had gstPct=null, invoices showed 0%).
 */
describe("Order booking -> invoice GST integration", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    // Fixture product ships with gstPct unset — set it explicitly per test.
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function bookOrder(gstPct: number, quantity = 10) {
    await testDb.product.update({ where: { id: fx.productId }, data: { gstPct } });
    const res = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity }],
        },
      }),
      noParams
    );
    expect(res.status).toBe(201);
    return readJson(res);
  }

  it("stamps the invoice with the product's GST rate, not a stale/zero default", async () => {
    const body = await bookOrder(5);
    expect(body.data.order.items[0].gstPct).toBe("5");

    const invoice = await testDb.invoice.findUnique({ where: { orderId: body.data.order.id } });
    // ptr=120, qty=10 -> taxable 1200, 5% GST = 60, grand total 1260
    expect(Number(invoice!.totalGst)).toBe(60);
    expect(Number(invoice!.grandTotal)).toBe(1260);
  });

  it("recomputes correctly at a different GST rate (12%) — the exact bug class this suite guards against", async () => {
    const body = await bookOrder(12);
    const invoice = await testDb.invoice.findUnique({ where: { orderId: body.data.order.id } });
    // taxable 1200, 12% GST = 144, grand total 1344
    expect(Number(invoice!.totalGst)).toBe(144);
    expect(Number(invoice!.grandTotal)).toBe(1344);
  });

  it("resyncs invoice totals when an order's items are edited (the exact drift this app used to have)", async () => {
    const body = await bookOrder(5, 10);
    const orderId = body.data.order.id;

    const editRes = await updateOrder(
      jsonRequest(`/api/orders/${orderId}`, {
        method: "PUT",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { items: [{ productId: fx.productId, quantity: 20 }] },
      }),
      { params: { id: orderId } }
    );
    expect(editRes.status).toBe(200);

    const invoice = await testDb.invoice.findUnique({ where: { orderId } });
    // qty doubled to 20 @ ptr 120 = 2400 taxable, 5% GST = 120, grand total 2520
    expect(Number(invoice!.totalGst)).toBe(120);
    expect(Number(invoice!.grandTotal)).toBe(2520);
  });

  it("blocks editing once an order is DELIVERED — GST-final documents don't get silently rewritten", async () => {
    const body = await bookOrder(5);
    const orderId = body.data.order.id;
    await testDb.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });

    const editRes = await updateOrder(
      jsonRequest(`/api/orders/${orderId}`, {
        method: "PUT",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { items: [{ productId: fx.productId, quantity: 999 }] },
      }),
      { params: { id: orderId } }
    );
    expect(editRes.status).toBe(400);

    const deleteRes = await deleteOrder(
      jsonRequest(`/api/orders/${orderId}`, { method: "DELETE", token: tokenFor(fx.mrUserId, Role.MR) }),
      { params: { id: orderId } }
    );
    expect(deleteRes.status).toBe(400);
  });

  it("auto-fills batch/mfg/exp from the product's current batch when the MR doesn't type one", async () => {
    await testDb.product.update({
      where: { id: fx.productId },
      data: { currentBatchNo: "T-TEST-01", currentMfgDate: new Date("2026-01-01"), currentExpDate: new Date("2028-01-01") },
    });

    const body = await bookOrder(5);
    expect(body.data.order.items[0].batchNo).toBe("T-TEST-01");
    expect(body.data.order.items[0].expDate).toBeTruthy();
  });

  it("lets an explicit per-line batch override the product default", async () => {
    await testDb.product.update({
      where: { id: fx.productId },
      data: { currentBatchNo: "T-DEFAULT", currentExpDate: new Date("2028-01-01") },
    });

    const res = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity: 5, batchNo: "T-OVERRIDE" }],
        },
      }),
      noParams
    );
    const body = await readJson(res);
    expect(body.data.order.items[0].batchNo).toBe("T-OVERRIDE");
  });

  it("deletes an invoice and clears its automatic ledger entries cleanly", async () => {
    const body = await bookOrder(5, 10);
    const invoice = await testDb.invoice.findUnique({ where: { orderId: body.data.order.id } });
    expect(invoice).toBeTruthy();

    // Verify auto-posted ledger entries exist
    const initialLedger = await testDb.ledgerTransaction.findMany({
      where: { sourceType: "INVOICE", sourceId: invoice!.id },
    });
    expect(initialLedger.length).toBeGreaterThan(0);

    // Delete invoice via DELETE /api/invoices/[id]
    const deleteRes = await deleteInvoice(
      jsonRequest(`/api/invoices/${invoice!.id}`, {
        method: "DELETE",
        token: tokenFor(fx.mrUserId, Role.ADMIN),
      }),
      { params: { id: invoice!.id } }
    );
    expect(deleteRes.status).toBe(200);

    // Verify invoice is gone from database
    const deletedInvoice = await testDb.invoice.findUnique({ where: { id: invoice!.id } });
    expect(deletedInvoice).toBeNull();

    // Verify ledger transactions were reversed / purged
    const remainingLedger = await testDb.ledgerTransaction.findMany({
      where: { sourceType: "INVOICE", sourceId: invoice!.id },
    });
    expect(remainingLedger.length).toBe(0);
  });

  it("grants Admin/MD full privileges to edit, modify line items, append items, change status, and delete even on DELIVERED orders", async () => {
    const body = await bookOrder(5, 5);
    const orderId = body.data.order.id;
    await testDb.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });

    // Admin edits DELIVERED order: modifies quantity and changes status back to CONFIRMED
    const adminEditRes = await updateOrder(
      jsonRequest(`/api/orders/${orderId}`, {
        method: "PUT",
        token: tokenFor(fx.adminUserId, Role.ADMIN),
        body: {
          status: "CONFIRMED",
          items: [{ productId: fx.productId, quantity: 15 }],
        },
      }),
      { params: { id: orderId } }
    );
    expect(adminEditRes.status).toBe(200);

    const updatedOrder = await testDb.order.findUnique({ where: { id: orderId }, include: { items: true } });
    expect(updatedOrder!.status).toBe("CONFIRMED");
    expect(updatedOrder!.items[0].quantity).toBe(15);

    // Admin deletes the order
    const adminDeleteRes = await deleteOrder(
      jsonRequest(`/api/orders/${orderId}`, {
        method: "DELETE",
        token: tokenFor(fx.adminUserId, Role.ADMIN),
      }),
      { params: { id: orderId } }
    );
    expect(adminDeleteRes.status).toBe(200);

    const deletedOrder = await testDb.order.findUnique({ where: { id: orderId } });
    expect(deletedOrder).toBeNull();
  });
});


