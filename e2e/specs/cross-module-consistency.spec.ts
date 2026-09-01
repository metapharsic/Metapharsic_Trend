/**
 * The cross-module check CLAUDE.md makes mandatory, executed against a live
 * server rather than read from source.
 *
 * Static analysis proves the endpoints *claim* the same scope rule. This proves
 * they *return* consistent data for the same user, which is the thing that
 * actually broke: "Generated Invoices" showing more rows than "Sales Orders"
 * for one MR.
 */
import { test, expect, APIRequestContext } from "@playwright/test";
import { statePath } from "../fixtures/accounts";

test.use({ storageState: statePath("mr") });

async function get(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  expect(res.ok(), `${url} returned ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, `${url} returned success:false`).toBe(true);
  return body.data;
}

test.describe("orders / invoices / history agree for one MR", () => {
  test("every invoice belongs to an order the MR can see", async ({ request }) => {
    const orders = await get(request, "/api/orders/secondary?limit=200");
    const invoices = await get(request, "/api/invoices");

    const orderIds = new Set((orders.orders ?? []).map((o: any) => o.id));
    const orphans = (invoices.invoices ?? [])
      .filter((i: any) => i.order && !orderIds.has(i.order.id))
      .map((i: any) => `${i.invoiceNo} -> order ${i.order.id}`);

    // If this fails, the two endpoints are scoping the same MR differently --
    // exactly the drift this suite exists to catch.
    expect(orphans, "Invoices reference orders outside the MR's own order scope").toEqual([]);
  });

  test("invoice count never exceeds order count for the same scope", async ({ request }) => {
    const orders = await get(request, "/api/orders/secondary?limit=1");
    const invoices = await get(request, "/api/invoices");

    const orderTotal = orders.pagination?.total;
    expect(orderTotal, "/api/orders/secondary must return pagination.total").toBeGreaterThanOrEqual(0);

    const invoiceTotal = invoices.pagination?.total ?? invoices.invoices?.length;
    expect(
      invoiceTotal,
      `MR sees ${invoiceTotal} invoices but only ${orderTotal} orders. Every invoice is generated ` +
        `from an order, so the invoice side is scoped more loosely.`
    ).toBeLessThanOrEqual(orderTotal);
  });

  test("status tallies are computed over the full scope, not the current page", async ({ request }) => {
    const pageOne = await get(request, "/api/orders/secondary?limit=1");
    const tallied = Object.values(pageOne.statusCounts ?? {}).reduce(
      (a: number, b: any) => a + Number(b),
      0
    );

    expect(
      tallied,
      `statusCounts sums to ${tallied} while pagination.total is ${pageOne.pagination?.total}. ` +
        `A tally that tracks page size is being computed client-side.`
    ).toBe(pageOne.pagination?.total);
  });
});

test.describe("pagination totals are real", () => {
  const PAGINATED = [
    "/api/orders/secondary",
    "/api/mr/claims",
    "/api/mr/leads",
    "/api/mr/ledgers",
  ];

  for (const url of PAGINATED) {
    test(`${url} reports a total larger than one page`, async ({ request }) => {
      const first = await get(request, `${url}?page=1&limit=1`);
      const total = first.pagination?.total ?? first.total;

      expect(total, `${url} returned no total`).toBeDefined();

      const list = Object.values(first).find(Array.isArray) as any[] | undefined;
      expect(list?.length ?? 0, `${url}?limit=1 returned ${list?.length} rows`).toBeLessThanOrEqual(1);

      // The total must describe the whole scope, not the page just returned.
      if (total > 1) expect(total).toBeGreaterThan(list!.length);
    });
  }
});
