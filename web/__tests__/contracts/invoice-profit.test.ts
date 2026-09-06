/**
 * Invoice profit + search contract.
 *
 * The profit column is a READ-ONLY derivation. The promise made when it was
 * added was that showing profit would never alter an invoice, an order, or
 * inventory -- these tests are that promise, enforced.
 *
 * Static reads only. Regenerate first: node qa/tools/extract-asbuilt.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const extract = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, "../qa/specs/as-built.json"), "utf8")
);
const ROUTE_FILE = path.resolve(ROOT, "app/api/invoices/route.ts");
const src = fs.readFileSync(ROUTE_FILE, "utf8");
const route = extract.routes.find((r: any) => r.url === "/api/invoices");

describe("/api/invoices contract", () => {
  it("is present in the extract", () => {
    if (!route) throw new Error("/api/invoices missing from qa/specs/as-built.json -- rerun extract-asbuilt.mjs");
    expect(route.url).toBe("/api/invoices");
  });

  it("exposes pagination.total", () => {
    if (!route.exposesPaginationTotal) {
      throw new Error(
        "/api/invoices does not return pagination.total. The Generated Invoices " +
          "header count depends on it; without it the tab under-reports silently."
      );
    }
    expect(route.exposesPaginationTotal).toBe(true);
  });

  it("has no hard take: cap left", () => {
    if (route.hardTake.length) {
      throw new Error(
        `/api/invoices still caps at take: ${route.hardTake.join(", ")}. ` +
          "A capped list with no way to page past it hides rows from the user."
      );
    }
    expect(route.hardTake).toEqual([]);
  });

  it("never writes to the database", () => {
    // The whole justification for computing profit at read time.
    const writes = [
      "db.invoice.update", "db.invoice.create", "db.invoice.delete",
      "db.invoice.upsert", "db.product.update", "db.order.update",
      "db.orderItem.update", "$executeRaw", "$queryRawUnsafe",
    ].filter((w) => src.includes(w));

    if (writes.length) {
      throw new Error(
        `/api/invoices performs database writes: ${writes.join(", ")}.\n\n` +
          "Profit is a derived, read-time figure. Displaying it must never mutate " +
          "an invoice, an order, or inventory."
      );
    }
    expect(writes).toEqual([]);
  });

  it("admits the same roles as its sibling order routes", () => {
    const roles = route.methods.GET.roles;
    const siblings = extract.routes.find((r: any) => r.url === "/api/orders/secondary")
      .methods.GET.roles;

    if (JSON.stringify(roles) !== JSON.stringify(siblings)) {
      throw new Error(
        `Role drift between tabs of the same screen:\n  /api/invoices        [${roles}]\n` +
          `  /api/orders/secondary [${siblings}]`
      );
    }
    expect(roles).toEqual(siblings);
  });

  it("computes profit from a cost basis with a free-quantity charge", () => {
    for (const marker of ["pts", "freeQty", "profitAmount", "profitPct"]) {
      if (!src.includes(marker)) {
        throw new Error(`/api/invoices no longer references "${marker}" -- profit math changed shape.`);
      }
    }
    expect(true).toBe(true);
  });
});
