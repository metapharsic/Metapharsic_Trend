import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson, noParams, TestFixture } from "./helpers/api";
import { GET as getBookingContext } from "../app/api/orders/booking-context/route";
import { POST as bulkUpdateStatus } from "../app/api/orders/bulk-status/route";
import { GET as getOrders } from "../app/api/orders/secondary/route";
import { POST as createOrder } from "../app/api/orders/secondary/route";
import { GET as getHistory } from "../app/api/orders/history/route";
import { GET as getInvoices } from "../app/api/invoices/route";
import { InvoicingService } from "../services/invoicing.service";

describe("Orders & Invoicing Central API Enhancements", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("returns chemist credit headroom and active schemes in GET /api/orders/booking-context", async () => {
    await testDb.chemist.update({
      where: { id: fx.chemistId },
      data: { creditLimit: 25000 },
    });

    await testDb.discountScheme.create({
      data: {
        name: "Scheme Test 10+",
        productId: fx.productId,
        minQuantity: 10,
        discountPct: 8,
        isActive: true,
        validFrom: new Date("2025-01-01T00:00:00Z"),
        validTo: new Date("2030-12-31T00:00:00Z"),
      },
    });

    const req = jsonRequest(`/api/orders/booking-context?chemistId=${fx.chemistId}`, {
      token: tokenFor(fx.mrUserId, Role.MR),
    });
    const res = await getBookingContext(req, noParams);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.chemistCredit.creditLimit).toBe(25000);
    expect(body.data.chemistCredit.availableHeadroom).toBe(25000);
    expect(body.data.activeSchemes.length).toBeGreaterThanOrEqual(1);
    expect(body.data.activeSchemes[0].discountPct).toBe(8);
  });

  it("supports server-side search and bulk status transitions on orders", async () => {
    const createRes = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity: 2 }],
        },
      }),
      noParams
    );
    expect(createRes.status).toBe(201);
    const { order } = (await readJson(createRes)).data;

    // Server-side search finds matching chemist
    const chemist = await testDb.chemist.findUniqueOrThrow({ where: { id: fx.chemistId } });
    const searchHit = await readJson(
      await getOrders(
        jsonRequest(`/api/orders/secondary?search=${encodeURIComponent(chemist.name)}`, {
          token: tokenFor(fx.mrUserId, Role.MR),
        }),
        noParams
      )
    );
    expect(searchHit.data.orders.length).toBe(1);

    const searchMiss = await readJson(
      await getOrders(
        jsonRequest("/api/orders/secondary?search=NonExistentChemistXYZ", {
          token: tokenFor(fx.mrUserId, Role.MR),
        }),
        noParams
      )
    );
    expect(searchMiss.data.orders.length).toBe(0);

    // Bulk status advance PENDING -> CONFIRMED
    const bulkRes = await bulkUpdateStatus(
      jsonRequest("/api/orders/bulk-status", {
        method: "POST",
        token: tokenFor(fx.adminUserId, Role.ADMIN),
        body: { orderIds: [order.id], status: "CONFIRMED" },
      }),
      noParams
    );
    expect(bulkRes.status).toBe(200);
    const bulkBody = await readJson(bulkRes);
    expect(bulkBody.data.updatedCount).toBe(1);

    const updated = await testDb.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe("CONFIRMED");
  });

  it("paginates /api/orders/history and filters overdue invoices + aging buckets", async () => {
    const createRes = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity: 3 }],
        },
      }),
      noParams
    );
    const { invoice } = (await readJson(createRes)).data;

    // Age invoice 45 days back to verify overdue aging
    await testDb.invoice.update({
      where: { id: invoice.id },
      data: { createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
    });

    const dash = await InvoicingService.getInvoicingDashboard({ cadence: "ALL" });
    expect(dash.agingSummary.overdue30PlusCount).toBeGreaterThanOrEqual(1);
    expect(dash.agingSummary.overdue30PlusAmount).toBeGreaterThan(0);

    const overdueRes = await readJson(
      await getInvoices(
        jsonRequest("/api/invoices?overdueOnly=true", {
          token: tokenFor(fx.adminUserId, Role.ADMIN),
        }),
        noParams
      )
    );
    expect(overdueRes.data.invoices.length).toBeGreaterThanOrEqual(1);

    const histRes = await readJson(
      await getHistory(
        jsonRequest("/api/orders/history?page=1&limit=1&type=INVOICE", {
          token: tokenFor(fx.mrUserId, Role.MR),
        }),
        noParams
      )
    );
    expect(histRes.data.transactions.length).toBe(1);
    expect(histRes.data.pagination.total).toBeGreaterThanOrEqual(1);
    expect(histRes.data.totals.invoicesCount).toBeGreaterThanOrEqual(1);
  });
});
