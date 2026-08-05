/**
 * Call Quality Score (CQS) — docs/09_business_rules/kpi_formulas.md §1.
 *
 *   CQS = w_dur*DurationScore + w_det*DetailingScore + w_roi*SampleRoiScore
 *
 * Weights are not specified in the formula doc; equal thirds are used so no single
 * component dominates, and they are exported so they can be tuned in one place.
 */

export const CQS_WEIGHTS = {
  duration: 1 / 3,
  detailing: 1 / 3,
  sampleRoi: 1 / 3,
} as const;

/**
 * DurationScore: 100 inside the 3-10 minute ideal band, decaying linearly to 0
 * at the 2-minute floor and 30-minute ceiling described in the spec.
 */
export function durationScore(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 2) return 0;
  if (minutes >= 30) return 0;
  if (minutes >= 3 && minutes <= 10) return 100;
  if (minutes < 3) return ((minutes - 2) / 1) * 100; // 2 -> 0, 3 -> 100
  return ((30 - minutes) / 20) * 100; // 10 -> 100, 30 -> 0
}

/** DetailingScore: share of promoted products matching the doctor's specialty. */
export function detailingScore(matchingProducts: number, totalProducts: number): number {
  if (totalProducts <= 0) return 0;
  return clamp100((matchingProducts / totalProducts) * 100);
}

/**
 * SampleRoiScore: how well sample volume matches the doctor's potential tier.
 * Both under- and over-sampling are penalised — over-sampling a low-tier doctor
 * is a compliance and cost problem, not a win.
 */
export const TIER_SAMPLE_TARGETS: Record<string, number> = {
  "A+": 12,
  A: 8,
  B: 4,
  C: 2,
};

export function sampleRoiScore(samplesGiven: number, tier: string | null): number {
  const target = TIER_SAMPLE_TARGETS[tier ?? "C"] ?? 2;
  if (samplesGiven <= 0) return 0;
  const ratio = samplesGiven / target;
  if (ratio >= 0.8 && ratio <= 1.2) return 100;
  const deviation = ratio < 0.8 ? 0.8 - ratio : ratio - 1.2;
  return clamp100(Math.max(100 - deviation * 100, 0));
}

export interface CqsInput {
  durationMinutes: number;
  matchingProducts: number;
  totalProducts: number;
  samplesGiven: number;
  doctorTier: string | null;
}

export function calculateCqs(input: CqsInput): number {
  const score =
    durationScore(input.durationMinutes) * CQS_WEIGHTS.duration +
    detailingScore(input.matchingProducts, input.totalProducts) * CQS_WEIGHTS.detailing +
    sampleRoiScore(input.samplesGiven, input.doctorTier) * CQS_WEIGHTS.sampleRoi;

  return Math.round(score * 100) / 100;
}

function clamp100(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 100);
}
