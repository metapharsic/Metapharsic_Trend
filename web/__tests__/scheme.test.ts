import { projectSchemeMargin, bestSchemeFor, ApplicableScheme } from "../lib/scheme";

/** Phase 4 Week 16 QA gate — scheme margin projection and discount selection. */
describe("Scheme margin projection", () => {
  const seededProduct = { mrp: 150, ptr: 120, pts: 110 };

  it("flags the verified negative-margin case (10% off PTR falls below PTS)", () => {
    const p = projectSchemeMargin(seededProduct, 100, 10);

    expect(p.discountedPtr).toBe(108); // below PTS of 110
    expect(p.schemeUnitMargin).toBe(-2);
    expect(p.marginNegative).toBe(true);
    expect(p.totalMarginDelta).toBe(-1200);
  });

  it("stays positive for a discount that keeps PTR above PTS", () => {
    const p = projectSchemeMargin(seededProduct, 100, 5);

    expect(p.discountedPtr).toBe(114);
    expect(p.schemeUnitMargin).toBe(4);
    expect(p.marginNegative).toBe(false);
  });

  it("leaves margin untouched at zero discount", () => {
    const p = projectSchemeMargin(seededProduct, 50, 0);

    expect(p.discountedPtr).toBe(120);
    expect(p.schemeUnitMargin).toBe(p.baseUnitMargin);
    expect(p.totalMarginDelta).toBe(0);
  });

  it("widens retailer margin as the stockist discount deepens", () => {
    const shallow = projectSchemeMargin(seededProduct, 10, 5);
    const deep = projectSchemeMargin(seededProduct, 10, 20);
    expect(deep.retailerMarginPercent).toBeGreaterThan(shallow.retailerMarginPercent);
  });

  it("scales total margin linearly with quantity", () => {
    const single = projectSchemeMargin(seededProduct, 1, 5);
    const hundred = projectSchemeMargin(seededProduct, 100, 5);
    expect(hundred.schemeTotalMargin).toBe(single.schemeTotalMargin * 100);
  });
});

describe("Discount scheme selection", () => {
  const on = new Date("2026-08-15T00:00:00.000Z");

  const scheme = (over: Partial<ApplicableScheme>): ApplicableScheme => ({
    id: "s1",
    name: "Test scheme",
    minQuantity: 10,
    discountPct: 5,
    isActive: true,
    validFrom: new Date("2026-08-01T00:00:00.000Z"),
    validTo: new Date("2026-08-31T00:00:00.000Z"),
    ...over,
  });

  it("returns null when the order quantity misses the threshold", () => {
    expect(bestSchemeFor([scheme({ minQuantity: 50 })], 10, on)).toBeNull();
  });

  it("ignores inactive schemes", () => {
    expect(bestSchemeFor([scheme({ isActive: false })], 100, on)).toBeNull();
  });

  it("ignores schemes outside their validity window", () => {
    const expired = scheme({ validTo: new Date("2026-08-10T00:00:00.000Z") });
    expect(bestSchemeFor([expired], 100, on)).toBeNull();

    const future = scheme({ validFrom: new Date("2026-08-20T00:00:00.000Z") });
    expect(bestSchemeFor([future], 100, on)).toBeNull();
  });

  it("picks the largest qualifying discount", () => {
    const best = bestSchemeFor(
      [
        scheme({ id: "small", discountPct: 5 }),
        scheme({ id: "big", discountPct: 12 }),
        scheme({ id: "biggest-but-unqualified", discountPct: 20, minQuantity: 1000 }),
      ],
      100,
      on
    );

    expect(best?.id).toBe("big");
  });

  it("includes schemes on their exact validity boundaries", () => {
    const boundary = scheme({
      validFrom: new Date("2026-08-15T00:00:00.000Z"),
      validTo: new Date("2026-08-15T00:00:00.000Z"),
    });
    expect(bestSchemeFor([boundary], 100, on)?.id).toBe("s1");
  });
});
