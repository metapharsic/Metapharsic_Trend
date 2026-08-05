/**
 * Doctor Potential Score (DPS) — see docs/09_business_rules/kpi_formulas.md §6.
 *
 *   DPS = 0.30*PatientFootfall + 0.25*PrescriptionFrequency + 0.20*InfluencerLevel
 *       + 0.15*TerritoryPriority + 0.10*EngagementScore
 *
 * The raw inputs live on wildly different scales (footfall ~35/day, influencerLevel 1-5,
 * territoryPriority 1-2), so each is normalized to 0-100 before weighting. Without that
 * the weights are meaningless and the 0-100 tier bands in the spec can never be hit.
 */

export const DPS_WEIGHTS = {
  footfall: 0.3,
  prescription: 0.25,
  influencer: 0.2,
  territoryPriority: 0.15,
  engagement: 0.1,
} as const;

/** Normalization ceilings: the input value that maps to a full 100 on that factor. */
export const DPS_NORMALIZATION = {
  maxFootfallDaily: 100,
  maxPrescriptionsDaily: 50,
  maxInfluencerLevel: 5,
  maxTerritoryPriority: 2,
} as const;

export interface DpsInput {
  patientFootfallDaily: number;
  avgPrescriptionsDaily: number;
  influencerLevel: number;
  territoryPriority: number;
  /** Call Quality Score running average (0-100). Falls back to 0 when unavailable. */
  engagementScore: number;
}

export interface DpsResult {
  score: number;
  tier: "A+" | "A" | "B" | "C";
  requiredMonthlyVisits: number;
  breakdown: Record<keyof typeof DPS_WEIGHTS, number>;
}

function clamp100(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 100);
}

/** Maps DPS to the visit-frequency tiers in kpi_formulas.md §7. */
export function dpsTier(score: number): { tier: DpsResult["tier"]; requiredMonthlyVisits: number } {
  if (score >= 85) return { tier: "A+", requiredMonthlyVisits: 12 };
  if (score >= 65) return { tier: "A", requiredMonthlyVisits: 8 };
  if (score >= 35) return { tier: "B", requiredMonthlyVisits: 4 };
  return { tier: "C", requiredMonthlyVisits: 2 };
}

export function calculateDps(input: DpsInput): DpsResult {
  const breakdown = {
    footfall: clamp100((input.patientFootfallDaily / DPS_NORMALIZATION.maxFootfallDaily) * 100),
    prescription: clamp100((input.avgPrescriptionsDaily / DPS_NORMALIZATION.maxPrescriptionsDaily) * 100),
    influencer: clamp100((input.influencerLevel / DPS_NORMALIZATION.maxInfluencerLevel) * 100),
    territoryPriority: clamp100((input.territoryPriority / DPS_NORMALIZATION.maxTerritoryPriority) * 100),
    engagement: clamp100(input.engagementScore),
  };

  const score =
    breakdown.footfall * DPS_WEIGHTS.footfall +
    breakdown.prescription * DPS_WEIGHTS.prescription +
    breakdown.influencer * DPS_WEIGHTS.influencer +
    breakdown.territoryPriority * DPS_WEIGHTS.territoryPriority +
    breakdown.engagement * DPS_WEIGHTS.engagement;

  const rounded = Math.round(score * 100) / 100;
  const { tier, requiredMonthlyVisits } = dpsTier(rounded);

  return { score: rounded, tier, requiredMonthlyVisits, breakdown };
}
