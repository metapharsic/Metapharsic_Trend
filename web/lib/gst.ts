/**
 * GST invoice line/total math — pure functions so the numbers on a printed
 * invoice are computed the same way regardless of caller, and are unit-testable.
 */

export interface GstLine {
  quantity: number;
  price: number;
  discountPct: number;
  gstPct: number;
}

export interface GstLineTotals {
  grossValue: number;
  discountAmount: number;
  taxableValue: number;
  gstAmount: number;
  amount: number;
}

export function computeLineTotals(line: GstLine): GstLineTotals {
  const grossValue = round2(line.quantity * line.price);
  const discountAmount = round2(grossValue * (line.discountPct / 100));
  const taxableValue = round2(grossValue - discountAmount);
  const gstAmount = round2(taxableValue * (line.gstPct / 100));
  const amount = round2(taxableValue + gstAmount);
  return { grossValue, discountAmount, taxableValue, gstAmount, amount };
}

export type TaxSplit = "CGST_SGST" | "IGST";

/**
 * Determines whether a transaction should be taxed as CGST+SGST (same-state,
 * intra-state supply) or IGST (different-state, inter-state supply), per
 * Indian GST rules — based on the first 2 digits (state code) of each party's
 * GSTIN.
 *
 * If either GSTIN is missing or too short to read a state code, we default
 * to "IGST". This matches the pre-existing behavior of the invoice UI (which
 * labelled everything IGST unconditionally) and is the safer assumption:
 * incorrectly splitting into CGST/SGST when the supply is actually
 * inter-state would misstate the tax head on a legal document, whereas
 * defaulting to IGST when data is missing is a conservative, correctable
 * presentation choice that doesn't change the total tax collected.
 */
export function determineTaxSplit(
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined
): TaxSplit {
  const sellerState = sellerGstin?.trim().slice(0, 2);
  const buyerState = buyerGstin?.trim().slice(0, 2);
  if (!sellerState || !buyerState || sellerState.length < 2 || buyerState.length < 2) {
    return "IGST";
  }
  return sellerState === buyerState ? "CGST_SGST" : "IGST";
}

export interface GstLineTotalsWithSplit extends GstLineTotals {
  taxSplit: TaxSplit;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

/**
 * Sibling of computeLineTotals that additionally splits gstAmount into
 * CGST+SGST (half rate each) or IGST (full rate) based on taxSplit. Total
 * gstAmount is unchanged — this is a presentation/labeling split, not a
 * rate change.
 */
export function computeLineTotalsWithSplit(line: GstLine, taxSplit: TaxSplit): GstLineTotalsWithSplit {
  const base = computeLineTotals(line);
  if (taxSplit === "CGST_SGST") {
    const cgstAmount = round2(base.gstAmount / 2);
    const sgstAmount = round2(base.gstAmount - cgstAmount);
    return { ...base, taxSplit, cgstAmount, sgstAmount, igstAmount: 0 };
  }
  return { ...base, taxSplit, cgstAmount: 0, sgstAmount: 0, igstAmount: base.gstAmount };
}

export interface GstInvoiceTotals {
  totalItems: number;
  totalQty: number;
  totalDiscount: number;
  totalGst: number;
  subtotal: number;
  roundOff: number;
  grandTotal: number;
}

export function computeInvoiceTotals(lines: (GstLine & { quantity: number })[]): GstInvoiceTotals {
  const totals = lines.map(computeLineTotals);
  const totalDiscount = round2(totals.reduce((s, t) => s + t.discountAmount, 0));
  const totalGst = round2(totals.reduce((s, t) => s + t.gstAmount, 0));
  const subtotal = round2(totals.reduce((s, t) => s + t.amount, 0));
  const grandTotalUnrounded = subtotal;
  const grandTotal = Math.round(grandTotalUnrounded);
  const roundOff = round2(grandTotal - grandTotalUnrounded);

  return {
    totalItems: lines.length,
    totalQty: lines.reduce((s, l) => s + l.quantity, 0),
    totalDiscount,
    totalGst,
    subtotal,
    roundOff,
    grandTotal,
  };
}

/** Groups line totals by GST rate for the class-wise tax summary block. */
export function taxClassSummary(lines: GstLine[]): { gstPct: number; taxableValue: number; gstAmount: number }[] {
  const byRate = new Map<number, { taxableValue: number; gstAmount: number }>();
  for (const line of lines) {
    const t = computeLineTotals(line);
    const existing = byRate.get(line.gstPct) ?? { taxableValue: 0, gstAmount: 0 };
    byRate.set(line.gstPct, {
      taxableValue: round2(existing.taxableValue + t.taxableValue),
      gstAmount: round2(existing.gstAmount + t.gstAmount),
    });
  }
  return [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gstPct, v]) => ({ gstPct, ...v }));
}

/**
 * Same grouping as taxClassSummary, but additionally splits each rate's
 * gstAmount into CGST+SGST or IGST per taxSplit, for the invoice's
 * class-wise tax summary table.
 */
export function taxClassSummaryWithSplit(
  lines: GstLine[],
  taxSplit: TaxSplit
): { gstPct: number; taxableValue: number; gstAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number }[] {
  return taxClassSummary(lines).map((c) => {
    if (taxSplit === "CGST_SGST") {
      const cgstAmount = round2(c.gstAmount / 2);
      const sgstAmount = round2(c.gstAmount - cgstAmount);
      return { ...c, cgstAmount, sgstAmount, igstAmount: 0 };
    }
    return { ...c, cgstAmount: 0, sgstAmount: 0, igstAmount: c.gstAmount };
  });
}

export interface FreeStripLine {
  freeQty: number;
  rate: number;
}

/** Informational total of the value of free stock given (freeQty * rate), summed across all lines. */
export function computeFreeStripsValue(lines: FreeStripLine[]): number {
  return round2(lines.reduce((sum, l) => sum + l.freeQty * l.rate, 0));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
