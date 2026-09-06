/**
 * Single source of truth for what a product COSTS us, and for the profit
 * derived from it.
 *
 * Before this file existed, every module invented its own answer:
 *   /api/invoices        pts, else ptr * 0.88, else billedPrice * 0.88   <- invented fudge factor
 *   /api/reports         ptr / pts read straight off the product
 *   /api/simulator       pts, else price, and refused to run when pts <= 0
 *   multi-agent-council  ptr || item.price, pts || 0
 *
 * Four modules, four different cost bases, so the same order produced a
 * different profit on every screen it appeared. Nothing may compute a cost
 * basis on its own any more -- call costBasis() and nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A SELLING PRICE IS NEVER A COST. READ THIS BEFORE EDITING.
 *
 * The first version of this file fell back purchaseRate -> pts -> ptr ->
 * price and treated each one as a cost. Every fallback is wrong: PTS is our
 * sell-in price to the stockist, PTR is the stockist's sell price and the
 * MRP-derived `price` is higher still. Each already CONTAINS the company
 * margin, so using one raw as a cost books our own markup as an expense.
 *
 * The symptom the user actually saw on the invoice ledger: an order of 10
 * billed + 5 free showed revenue Rs 840.80 against a "cost" of Rs 1,135.05
 * -- a -35% margin on a profitable order. Cost per unit came out at Rs 75.67
 * (the PTS) while the billed price was Rs 84.08. Because free goods are
 * correctly charged at cost, and that "cost" carried the ~40% company
 * markup, every scheme-bearing order reported a loss that does not exist.
 * Two real invoices read -35% and -53%.
 *
 * So when purchaseRate is missing we DERIVE a cost by removing the margins
 * that were added to produce the selling price, using exactly the
 * conventions documented in product-pricing-agents.service.ts:
 *
 *   companyMarginPct  = MARKUP ON COST      pts  = cost * (1 + m/100)
 *                                           cost = pts  / (1 + m/100)   <- DIVIDE
 *   stockistMarginPct = MARGIN ON SELL PRICE ptr = pts / (1 - m/100)
 *                                           pts  = ptr  * (1 - m/100)
 *   chemistMarginPct  = MARGIN ON SELL PRICE mrp = ptr / (1 - m/100)
 *                                           ptr  = mrp  * (1 - m/100)
 *
 * ORDER OF PREFERENCE, and why:
 *   1. purchaseRate  what we actually paid the manufacturer. The real cost.
 *   2. pts           remove the company markup.
 *   3. ptr           step down to PTS, then remove the company markup.
 *   4. price         treat as MRP-like: chemist, then stockist, then company.
 *   5. none          nothing usable -> 0.
 *
 * There is still deliberately no invented multiplier: the percentages come
 * from the product's own `marginStructure` when it has one, and otherwise
 * from the service defaults. Only case 1 is `exact`; everything else is an
 * estimate and says so, and `derivedUsing` reports the percentages applied
 * so a UI can explain the number.
 * ─────────────────────────────────────────────────────────────────────
 */

import { ProductPricingAgentsService } from "@/services/product-pricing-agents.service";

/** Anything with a Prisma Decimal or number is accepted; nulls are skipped. */
type Money = { toString(): string } | number | null | undefined;

export type CostBasisSource = "purchaseRate" | "pts" | "ptr" | "price" | "none";

export interface PricedProduct {
  purchaseRate?: Money;
  pts?: Money;
  ptr?: Money;
  price?: Money;
  /** JSON blob written by the pricing agents; overrides the default margins. */
  marginStructure?: string | null;
}

export interface DerivedMargins {
  companyMarkupPct: number;
  stockistMarginPct: number;
  chemistMarginPct: number;
}

export interface CostBasis {
  /** Per-unit cost in rupees. 0 when nothing usable is set. */
  value: number;
  /** Which field it came from, so the UI can flag estimates. */
  source: CostBasisSource;
  /** true only when `source === "purchaseRate"` -- a real paid cost. */
  exact: boolean;
  /** Percentages actually used to strip margin, absent for exact/none. */
  derivedUsing?: DerivedMargins;
}

/** Decimal | number | string | null -> finite number, else null. */
function num(v: Money): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** A markup percentage that cannot produce a zero/negative divisor. */
function safeMarkupPct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // 1 + m/100 must stay comfortably positive.
  if (n <= -99) return null;
  if (n > 10000) return null;
  return n;
}

/** A "margin off selling price" percentage: must keep (1 - m/100) positive. */
function safeMarginPct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 99) return null;
  return n;
}

/**
 * The margin percentages to use for a product: its own marginStructure when
 * it parses and the values are sane, otherwise the service defaults.
 */
export function marginsFor(product: PricedProduct | null | undefined): DerivedMargins {
  const defaults: DerivedMargins = {
    companyMarkupPct: ProductPricingAgentsService.DEFAULT_COMPANY_MARGIN_PCT,
    stockistMarginPct: ProductPricingAgentsService.DEFAULT_STOCKIST_MARGIN_PCT,
    chemistMarginPct: ProductPricingAgentsService.DEFAULT_CHEMIST_MARGIN_PCT,
  };
  const parsed = ProductPricingAgentsService.parseMarginStructure(product?.marginStructure ?? null);
  if (!parsed) return defaults;
  return {
    companyMarkupPct: safeMarkupPct(parsed.companyMarginPct) ?? defaults.companyMarkupPct,
    stockistMarginPct: safeMarginPct(parsed.stockistMarginPct) ?? defaults.stockistMarginPct,
    chemistMarginPct: safeMarginPct(parsed.chemistMarginPct) ?? defaults.chemistMarginPct,
  };
}

/** cost = pts / (1 + companyMarkup/100). */
function costFromPts(pts: number, m: DerivedMargins): number {
  const divisor = 1 + m.companyMarkupPct / 100;
  if (!(divisor > 0)) return 0;
  return pts / divisor;
}

/** pts = ptr * (1 - stockistMargin/100). */
function ptsFromPtr(ptr: number, m: DerivedMargins): number {
  return ptr * (1 - m.stockistMarginPct / 100);
}

/** ptr = mrp * (1 - chemistMargin/100). */
function ptrFromPrice(price: number, m: DerivedMargins): number {
  return price * (1 - m.chemistMarginPct / 100);
}

function finite(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return round2(n);
}

/**
 * The per-unit cost of a product. Positive values only -- a zero or negative
 * purchaseRate means "not set", not "free", so we fall through to the next
 * source rather than reporting infinite margin. Every source other than
 * purchaseRate is a SELLING price and is stepped back down the margin ladder
 * before it is reported as a cost.
 */
export function costBasis(product: PricedProduct | null | undefined): CostBasis {
  if (!product) return { value: 0, source: "none", exact: false };

  const purchaseRate = num(product.purchaseRate);
  if (purchaseRate !== null && purchaseRate > 0) {
    return { value: round2(purchaseRate), source: "purchaseRate", exact: true };
  }

  const m = marginsFor(product);

  const pts = num(product.pts);
  if (pts !== null && pts > 0) {
    const value = finite(costFromPts(pts, m));
    if (value > 0) return { value, source: "pts", exact: false, derivedUsing: m };
  }

  const ptr = num(product.ptr);
  if (ptr !== null && ptr > 0) {
    const value = finite(costFromPts(ptsFromPtr(ptr, m), m));
    if (value > 0) return { value, source: "ptr", exact: false, derivedUsing: m };
  }

  const price = num(product.price);
  if (price !== null && price > 0) {
    const value = finite(costFromPts(ptsFromPtr(ptrFromPrice(price, m), m), m));
    if (value > 0) return { value, source: "price", exact: false, derivedUsing: m };
  }

  return { value: 0, source: "none", exact: false };
}

export interface ProfitLine {
  quantity: number;
  /** Billed unit price actually charged on the invoice/order line. */
  price: Money;
  /** Goods given away. Earn nothing, still cost us. */
  freeQty?: number;
  product: PricedProduct | null | undefined;
}

export interface ProfitResult {
  revenue: number;
  cost: number;
  profitAmount: number;
  /** null when revenue is 0 -- a percentage of nothing is not 0%, it is undefined. */
  profitPct: number | null;
  /** true when every line's cost came from a real purchaseRate. */
  exact: boolean;
  /** Sources used, so a caller can explain an estimate to the user. */
  sources: CostBasisSource[];
}

/**
 * Profit for a set of lines.
 *
 * Free quantity is charged at cost and earns no revenue -- giving stock away
 * is a real expense, and a profit figure that ignores it overstates every
 * scheme-heavy order in the book. The cost charged is a real cost, never a
 * selling price (see the header): charging free goods at PTS is what turned
 * profitable scheme orders into phantom losses.
 */
export function profitFor(lines: ProfitLine[]): ProfitResult {
  let revenue = 0;
  let cost = 0;
  let exact = true;
  const sources = new Set<CostBasisSource>();

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const free = Number(line.freeQty) || 0;
    const unitPrice = num(line.price) ?? 0;
    const basis = costBasis(line.product);

    revenue += unitPrice * qty;
    cost += basis.value * (qty + free);

    sources.add(basis.source);
    if (!basis.exact) exact = false;
  }

  const profitAmount = revenue - cost;
  return {
    revenue: round2(revenue),
    cost: round2(cost),
    profitAmount: round2(profitAmount),
    profitPct: revenue === 0 ? null : round2((profitAmount / revenue) * 100),
    exact,
    sources: [...sources],
  };
}

/** Prisma `select` for the product fields costBasis() needs. Use it everywhere. */
export const COST_BASIS_SELECT = {
  id: true,
  purchaseRate: true,
  pts: true,
  ptr: true,
  price: true,
  marginStructure: true,
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────
 * PURCHASE-RATE-ONLY PROFIT (admin "Commercial Ledger" screen).
 *
 * This is deliberately NOT costBasis()/profitFor(). It never derives a cost
 * from PTS, PTR or price -- it uses ONLY the real purchaseRate, i.e. what we
 * actually paid. A missing or non-positive purchaseRate means "we don't know
 * this line's cost": that line contributes 0 cost, its units are reported in
 * `unpricedUnits`, and `complete` is set false so the caller can flag the
 * figure as partial. Nothing is ever guessed or estimated here.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface PurchaseProfitLine {
  quantity: number;
  price: Money;
  freeQty?: number;
  product: { purchaseRate?: Money } | null | undefined;
}

export interface PurchaseProfitResult {
  revenue: number;
  purchaseCost: number;
  profitAmount: number;
  /** null when revenue is 0 -- a percentage of nothing is not 0%, it is undefined. */
  profitPct: number | null;
  /** true only if every line had a real, positive purchaseRate. */
  complete: boolean;
  /** billed+free units whose product had no usable purchaseRate. */
  unpricedUnits: number;
}

/**
 * Strict profit for a set of lines using ONLY purchaseRate as cost.
 *
 * Free quantity is charged at purchaseRate same as profitFor() does at its
 * cost basis -- a giveaway still cost real money. Every division is guarded
 * so this can never produce NaN or Infinity.
 */
export function purchaseProfitFor(lines: PurchaseProfitLine[]): PurchaseProfitResult {
  let revenue = 0;
  let purchaseCost = 0;
  let complete = true;
  let unpricedUnits = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const free = Number(line.freeQty) || 0;
    const unitPrice = num(line.price) ?? 0;
    const units = qty + free;

    revenue += unitPrice * qty;

    const rate = num(line.product?.purchaseRate);
    if (rate !== null && rate > 0) {
      purchaseCost += rate * units;
    } else {
      complete = false;
      unpricedUnits += units;
    }
  }

  const profitAmount = revenue - purchaseCost;
  return {
    revenue: round2(revenue),
    purchaseCost: round2(purchaseCost),
    profitAmount: round2(profitAmount),
    profitPct: revenue === 0 ? null : round2((profitAmount / revenue) * 100),
    complete,
    unpricedUnits,
  };
}
