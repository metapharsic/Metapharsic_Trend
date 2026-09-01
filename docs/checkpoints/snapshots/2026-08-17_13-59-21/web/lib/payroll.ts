/**
 * Incentive engine — docs Phase 4 Week 15.
 *
 * Incentive is driven by target achievement: the ratio of collections actually
 * banked in the period to the employee's assigned sales target. Slabs are flat
 * percentages of basic salary, so a partially-achieved target still pays nothing
 * below the entry slab (deliberate: it mirrors standard pharma field incentive plans).
 */

export const INCENTIVE_SLABS = [
  { minAchievementPct: 120, incentivePctOfBasic: 25 },
  { minAchievementPct: 100, incentivePctOfBasic: 15 },
  { minAchievementPct: 85, incentivePctOfBasic: 8 },
  { minAchievementPct: 70, incentivePctOfBasic: 4 },
] as const;

export const STATUTORY_RATES = {
  pfPctOfBasic: 12,
  esicPctOfBasic: 0.75,
  taxPctOfGross: 10,
} as const;

export interface PayrollInput {
  basicSalary: number;
  targetValue: number;
  achievedValue: number;
}

export interface PayrollBreakdown {
  basicSalary: number;
  achievementPercent: number;
  incentivePercent: number;
  incentives: number;
  gross: number;
  pf: number;
  esic: number;
  tax: number;
  netPayable: number;
}

export function incentivePercentFor(achievementPercent: number): number {
  const slab = INCENTIVE_SLABS.find((s) => achievementPercent >= s.minAchievementPct);
  return slab?.incentivePctOfBasic ?? 0;
}

export function calculatePayroll(input: PayrollInput): PayrollBreakdown {
  const { basicSalary, targetValue, achievedValue } = input;

  const achievementPercent =
    targetValue > 0 ? Math.round((achievedValue / targetValue) * 10000) / 100 : 0;
  const incentivePercent = incentivePercentFor(achievementPercent);
  const incentives = round2((basicSalary * incentivePercent) / 100);

  const gross = round2(basicSalary + incentives);
  const pf = round2((basicSalary * STATUTORY_RATES.pfPctOfBasic) / 100);
  const esic = round2((basicSalary * STATUTORY_RATES.esicPctOfBasic) / 100);
  const tax = round2((gross * STATUTORY_RATES.taxPctOfGross) / 100);
  const netPayable = round2(gross - pf - esic - tax);

  return { basicSalary, achievementPercent, incentivePercent, incentives, gross, pf, esic, tax, netPayable };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
