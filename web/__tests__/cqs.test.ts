import {
  calculateCqs,
  durationScore,
  detailingScore,
  sampleRoiScore,
  CQS_WEIGHTS,
} from "../lib/cqs";

/** kpi_formulas.md §1 — Call Quality Score components. */
describe("CQS DurationScore", () => {
  it("scores a full 100 inside the 3-10 minute ideal band", () => {
    expect(durationScore(3)).toBe(100);
    expect(durationScore(6)).toBe(100);
    expect(durationScore(10)).toBe(100);
  });

  it("scores zero at or below the 2-minute floor", () => {
    expect(durationScore(2)).toBe(0);
    expect(durationScore(1)).toBe(0);
    expect(durationScore(0)).toBe(0);
  });

  it("scores zero at or beyond the 30-minute ceiling", () => {
    expect(durationScore(30)).toBe(0);
    expect(durationScore(45)).toBe(0);
  });

  it("decays linearly between 10 and 30 minutes", () => {
    expect(durationScore(20)).toBe(50); // halfway through the 10-30 decay
  });

  it("ramps linearly between 2 and 3 minutes", () => {
    expect(durationScore(2.5)).toBe(50);
  });

  it("handles non-finite input without producing NaN", () => {
    expect(durationScore(NaN)).toBe(0);
    expect(durationScore(Infinity)).toBe(0);
  });
});

describe("CQS DetailingScore", () => {
  it("is 100 when every detailed product matches the specialty", () => {
    expect(detailingScore(4, 4)).toBe(100);
  });

  it("is proportional to the matching share", () => {
    expect(detailingScore(1, 4)).toBe(25);
  });

  it("is zero when nothing was detailed", () => {
    expect(detailingScore(0, 0)).toBe(0);
  });
});

describe("CQS SampleRoiScore", () => {
  it("rewards sampling in line with the doctor's tier", () => {
    expect(sampleRoiScore(12, "A+")).toBe(100);
    expect(sampleRoiScore(8, "A")).toBe(100);
    expect(sampleRoiScore(2, "C")).toBe(100);
  });

  it("penalises under-sampling a high-potential doctor", () => {
    expect(sampleRoiScore(2, "A+")).toBeLessThan(100);
  });

  it("also penalises over-sampling a low-potential doctor", () => {
    // Over-sampling is a cost and compliance problem, not a win.
    expect(sampleRoiScore(20, "C")).toBeLessThan(100);
  });

  it("scores zero when no samples were given", () => {
    expect(sampleRoiScore(0, "A")).toBe(0);
  });

  it("defaults an unknown tier to the lowest target", () => {
    expect(sampleRoiScore(2, null)).toBe(100);
    expect(sampleRoiScore(2, "UNKNOWN")).toBe(100);
  });
});

describe("CQS composite", () => {
  it("weights sum to 1", () => {
    const sum = Object.values(CQS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("scores a perfect call at 100", () => {
    const score = calculateCqs({
      durationMinutes: 6,
      matchingProducts: 3,
      totalProducts: 3,
      samplesGiven: 8,
      doctorTier: "A",
    });
    expect(score).toBe(100);
  });

  it("scores a worthless call at 0", () => {
    const score = calculateCqs({
      durationMinutes: 1,
      matchingProducts: 0,
      totalProducts: 0,
      samplesGiven: 0,
      doctorTier: "A",
    });
    expect(score).toBe(0);
  });

  it("always lands within 0-100", () => {
    const score = calculateCqs({
      durationMinutes: 9,
      matchingProducts: 1,
      totalProducts: 5,
      samplesGiven: 3,
      doctorTier: "B",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
