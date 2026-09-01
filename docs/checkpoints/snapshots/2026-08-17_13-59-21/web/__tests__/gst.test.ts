import {
  computeLineTotals,
  computeInvoiceTotals,
  determineTaxSplit,
  computeLineTotalsWithSplit,
  taxClassSummary,
  taxClassSummaryWithSplit,
  computeFreeStripsValue,
  round2,
} from "../lib/gst";

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(10.005)).toBeCloseTo(10.01, 2);
    expect(round2(10.004)).toBe(10);
    expect(round2(10)).toBe(10);
  });
});

describe("computeLineTotals", () => {
  it("computes a plain line with no discount at 5% GST", () => {
    const t = computeLineTotals({ quantity: 10, price: 68.5, discountPct: 0, gstPct: 5 });
    expect(t.grossValue).toBe(685);
    expect(t.discountAmount).toBe(0);
    expect(t.taxableValue).toBe(685);
    expect(t.gstAmount).toBe(34.25);
    expect(t.amount).toBe(719.25);
  });

  it("computes a plain line with no discount at 12% GST", () => {
    const t = computeLineTotals({ quantity: 10, price: 105.1, discountPct: 0, gstPct: 12 });
    expect(t.grossValue).toBe(1051);
    expect(t.gstAmount).toBe(126.12);
    expect(t.amount).toBe(1177.12);
  });

  it("applies a line discount before computing GST", () => {
    // 20 units @ 100, 10% discount -> taxable 1800, GST 18% -> 324
    const t = computeLineTotals({ quantity: 20, price: 100, discountPct: 10, gstPct: 18 });
    expect(t.grossValue).toBe(2000);
    expect(t.discountAmount).toBe(200);
    expect(t.taxableValue).toBe(1800);
    expect(t.gstAmount).toBe(324);
    expect(t.amount).toBe(2124);
  });

  it("handles zero quantity as a zero-value line, not an error", () => {
    const t = computeLineTotals({ quantity: 0, price: 100, discountPct: 0, gstPct: 5 });
    expect(t.grossValue).toBe(0);
    expect(t.amount).toBe(0);
  });

  it("handles zero GST rate", () => {
    const t = computeLineTotals({ quantity: 5, price: 50, discountPct: 0, gstPct: 0 });
    expect(t.gstAmount).toBe(0);
    expect(t.amount).toBe(250);
  });
});

describe("determineTaxSplit", () => {
  it("splits CGST+SGST when buyer and seller share a state code", () => {
    expect(determineTaxSplit("36ACHFM0773D1ZC", "36ABCDE1234F1Z5")).toBe("CGST_SGST");
  });

  it("uses IGST across different states", () => {
    expect(determineTaxSplit("36ACHFM0773D1ZC", "07AAACD1234E1Z5")).toBe("IGST");
  });

  it("defaults to IGST when either GSTIN is missing", () => {
    expect(determineTaxSplit(null, "07AAACD1234E1Z5")).toBe("IGST");
    expect(determineTaxSplit("36ACHFM0773D1ZC", null)).toBe("IGST");
    expect(determineTaxSplit(undefined, undefined)).toBe("IGST");
  });

  it("defaults to IGST when a GSTIN is too short to read a state code", () => {
    expect(determineTaxSplit("3", "36ABCDE1234F1Z5")).toBe("IGST");
  });
});

describe("computeLineTotalsWithSplit", () => {
  it("splits GST evenly into CGST+SGST", () => {
    const t = computeLineTotalsWithSplit({ quantity: 10, price: 100, discountPct: 0, gstPct: 12 }, "CGST_SGST");
    expect(t.gstAmount).toBe(120);
    expect(t.cgstAmount).toBe(60);
    expect(t.sgstAmount).toBe(60);
    expect(t.igstAmount).toBe(0);
  });

  it("puts the full amount under IGST for inter-state", () => {
    const t = computeLineTotalsWithSplit({ quantity: 10, price: 100, discountPct: 0, gstPct: 12 }, "IGST");
    expect(t.igstAmount).toBe(120);
    expect(t.cgstAmount).toBe(0);
    expect(t.sgstAmount).toBe(0);
  });

  it("does not lose a paisa on an odd GST amount when splitting", () => {
    // gstAmount = 105 * 0.05 = 5.25 -> cgst 2.63 (rounded), sgst = remainder 2.62
    const t = computeLineTotalsWithSplit({ quantity: 1, price: 105, discountPct: 0, gstPct: 5 }, "CGST_SGST");
    expect(round2(t.cgstAmount + t.sgstAmount)).toBe(t.gstAmount);
  });
});

describe("computeInvoiceTotals", () => {
  it("sums multiple lines and rounds the grand total to the nearest rupee", () => {
    const totals = computeInvoiceTotals([
      { quantity: 10, price: 68.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 110.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 105.1, discountPct: 0, gstPct: 5 },
    ]);
    expect(totals.totalItems).toBe(3);
    expect(totals.totalQty).toBe(30);
    expect(totals.totalDiscount).toBe(0);
    expect(totals.totalGst).toBe(142.05);
    expect(totals.subtotal).toBe(2983.05);
    expect(totals.grandTotal).toBe(2983);
    expect(round2(totals.grandTotal - totals.subtotal)).toBe(totals.roundOff);
  });

  it("matches the real invoice WHO-202607260001 at 5% GST", () => {
    // Regression pin for the exact invoice the user validated by hand.
    const totals = computeInvoiceTotals([
      { quantity: 10, price: 68.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 110.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 105.1, discountPct: 0, gstPct: 5 },
    ]);
    expect(totals.grandTotal).toBe(2983);
  });

  it("matches the same invoice recomputed at 12% GST", () => {
    const totals = computeInvoiceTotals([
      { quantity: 10, price: 68.5, discountPct: 0, gstPct: 12 },
      { quantity: 10, price: 110.5, discountPct: 0, gstPct: 12 },
      { quantity: 10, price: 105.1, discountPct: 0, gstPct: 12 },
    ]);
    expect(totals.grandTotal).toBe(3182);
  });

  it("returns zeroed totals for an empty line list rather than throwing", () => {
    const totals = computeInvoiceTotals([]);
    expect(totals.totalItems).toBe(0);
    expect(totals.totalQty).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });
});

describe("taxClassSummary / taxClassSummaryWithSplit", () => {
  it("groups lines by GST rate", () => {
    const summary = taxClassSummary([
      { quantity: 10, price: 100, discountPct: 0, gstPct: 5 },
      { quantity: 5, price: 200, discountPct: 0, gstPct: 5 },
      { quantity: 2, price: 50, discountPct: 0, gstPct: 12 },
    ]);
    expect(summary).toHaveLength(2);
    const fivePct = summary.find((s) => s.gstPct === 5)!;
    expect(fivePct.taxableValue).toBe(2000);
    expect(fivePct.gstAmount).toBe(100);
    const twelvePct = summary.find((s) => s.gstPct === 12)!;
    expect(twelvePct.taxableValue).toBe(100);
    expect(twelvePct.gstAmount).toBe(12);
  });

  it("the class summary total always reconciles with computeInvoiceTotals", () => {
    const lines = [
      { quantity: 10, price: 68.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 110.5, discountPct: 0, gstPct: 5 },
      { quantity: 10, price: 105.1, discountPct: 0, gstPct: 5 },
    ];
    const invoiceTotals = computeInvoiceTotals(lines);
    const summary = taxClassSummary(lines);
    const summedGst = round2(summary.reduce((s, c) => s + c.gstAmount, 0));
    expect(summedGst).toBe(invoiceTotals.totalGst);
  });

  it("splits the class summary the same way as individual lines", () => {
    const summary = taxClassSummaryWithSplit(
      [{ quantity: 10, price: 100, discountPct: 0, gstPct: 12 }],
      "CGST_SGST"
    );
    expect(summary[0].cgstAmount).toBe(60);
    expect(summary[0].sgstAmount).toBe(60);
  });
});

describe("computeFreeStripsValue", () => {
  it("values free stock at the actual sale rate, not MRP", () => {
    const value = computeFreeStripsValue([
      { freeQty: 2, rate: 68.5 },
      { freeQty: 0, rate: 110.5 },
    ]);
    expect(value).toBe(137);
  });

  it("is zero when nothing was given free", () => {
    expect(computeFreeStripsValue([{ freeQty: 0, rate: 100 }])).toBe(0);
  });
});
