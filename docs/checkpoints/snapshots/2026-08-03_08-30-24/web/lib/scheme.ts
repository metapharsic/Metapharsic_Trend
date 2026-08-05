/**
 * Scheme margin projection — docs Phase 4 Week 16.
 * Pure pricing math, kept out of the route handler so it is unit-testable.
 */

export interface SchemePricing {
  mrp: number;
  ptr: number;
  pts: number;
}

export interface SchemeProjection {
  discountedPtr: number;
  baseUnitMargin: number;
  schemeUnitMargin: number;
  unitMarginDelta: number;
  baseTotalMargin: number;
  schemeTotalMargin: number;
  totalMarginDelta: number;
  baseMarginPercent: number;
  schemeMarginPercent: number;
  retailerMarginPercent: number;
  marginNegative: boolean;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function projectSchemeMargin(
  pricing: SchemePricing,
  quantity: number,
  discountPercent: number
): SchemeProjection {
  const { mrp, ptr, pts } = pricing;

  const discountedPtr = round2(ptr * (1 - discountPercent / 100));
  const baseUnitMargin = round2(ptr - pts);
  const schemeUnitMargin = round2(discountedPtr - pts);
  const baseTotalMargin = round2(baseUnitMargin * quantity);
  const schemeTotalMargin = round2(schemeUnitMargin * quantity);

  return {
    discountedPtr,
    baseUnitMargin,
    schemeUnitMargin,
    unitMarginDelta: round2(schemeUnitMargin - baseUnitMargin),
    baseTotalMargin,
    schemeTotalMargin,
    totalMarginDelta: round2(schemeTotalMargin - baseTotalMargin),
    baseMarginPercent: ptr > 0 ? round2((baseUnitMargin / ptr) * 100) : 0,
    schemeMarginPercent: discountedPtr > 0 ? round2((schemeUnitMargin / discountedPtr) * 100) : 0,
    retailerMarginPercent: mrp > 0 ? round2(((mrp - discountedPtr) / mrp) * 100) : 0,
    marginNegative: schemeUnitMargin < 0,
  };
}

/**
 * Best-qualifying discount for a line item — used at order-creation time.
 * Schemes must be active, in their validity window, and met by the order quantity;
 * the largest qualifying discount wins.
 */
export interface ApplicableScheme {
  id: string;
  name: string;
  minQuantity: number;
  discountPct: number;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
}

export function bestSchemeFor(
  schemes: ApplicableScheme[],
  quantity: number,
  on: Date = new Date()
): ApplicableScheme | null {
  const qualifying = schemes.filter(
    (s) => s.isActive && quantity >= s.minQuantity && s.validFrom <= on && s.validTo >= on
  );
  if (qualifying.length === 0) return null;
  return qualifying.reduce((best, s) => (s.discountPct > best.discountPct ? s : best));
}
