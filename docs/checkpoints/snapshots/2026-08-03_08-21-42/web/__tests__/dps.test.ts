import { calculateDps, dpsTier } from "../lib/dps";

/** Phase 3 Week 9 QA gate — DPS scoring and visit-frequency tier mapping. */
describe("Doctor Potential Score (DPS)", () => {
  it("matches the hand-computed score for the seeded doctor", () => {
    // footfall 35/100*100*0.30 = 10.5, scripts 15/50*100*0.25 = 7.5,
    // influencer 1/5*100*0.20 = 4, priority 1/2*100*0.15 = 7.5, engagement 0 => 29.5
    const result = calculateDps({
      patientFootfallDaily: 35,
      avgPrescriptionsDaily: 15,
      influencerLevel: 1,
      territoryPriority: 1,
      engagementScore: 0,
    });

    expect(result.score).toBe(29.5);
    expect(result.tier).toBe("C");
    expect(result.requiredMonthlyVisits).toBe(2);
  });

  it("awards a perfect score when every factor is at its ceiling", () => {
    const result = calculateDps({
      patientFootfallDaily: 100,
      avgPrescriptionsDaily: 50,
      influencerLevel: 5,
      territoryPriority: 2,
      engagementScore: 100,
    });

    expect(result.score).toBe(100);
    expect(result.tier).toBe("A+");
    expect(result.requiredMonthlyVisits).toBe(12);
  });

  it("clamps inputs above their normalization ceiling instead of exceeding 100", () => {
    const result = calculateDps({
      patientFootfallDaily: 10_000,
      avgPrescriptionsDaily: 10_000,
      influencerLevel: 99,
      territoryPriority: 99,
      engagementScore: 999,
    });

    expect(result.score).toBe(100);
  });

  it("floors negative or missing inputs at zero", () => {
    const result = calculateDps({
      patientFootfallDaily: -50,
      avgPrescriptionsDaily: 0,
      influencerLevel: 0,
      territoryPriority: 0,
      engagementScore: -1,
    });

    expect(result.score).toBe(0);
    expect(result.tier).toBe("C");
  });

  it("weights sum to 1, so a uniform 100 across factors yields exactly 100", () => {
    const result = calculateDps({
      patientFootfallDaily: 100,
      avgPrescriptionsDaily: 50,
      influencerLevel: 5,
      territoryPriority: 2,
      engagementScore: 100,
    });
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(500); // five factors each normalized to 100
    expect(result.score).toBe(100);
  });

  describe("tier boundaries from kpi_formulas.md §7", () => {
    it.each([
      [100, "A+", 12],
      [85, "A+", 12],
      [84.99, "A", 8],
      [65, "A", 8],
      [64.99, "B", 4],
      [35, "B", 4],
      [34.99, "C", 2],
      [0, "C", 2],
    ])("score %p maps to tier %p with %p visits/month", (score, tier, visits) => {
      const result = dpsTier(score as number);
      expect(result.tier).toBe(tier);
      expect(result.requiredMonthlyVisits).toBe(visits);
    });
  });
});
