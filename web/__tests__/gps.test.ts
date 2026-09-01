import { haversineDistanceKm, checkVisitAnomaly } from "../lib/gps";

describe("GPS & Distance Auditing (GPS Removed)", () => {
  it("should safely handle zero or missing coordinates", () => {
    expect(haversineDistanceKm(0, 0, 0, 0)).toBe(0);
    expect(haversineDistanceKm(undefined, undefined, 28.7, 77.1)).toBe(0);
  });

  it("should calculate valid distance when coordinates are supplied", () => {
    const d = haversineDistanceKm(28.7041, 77.1025, 28.7042, 77.1026);
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it("should always return non-anomalous result from checkVisitAnomaly", () => {
    const result = checkVisitAnomaly(28.7, 77.1, new Date(), 30.5, 79.2, new Date());
    expect(result.isAnomalous).toBe(false);
    expect(result.reason).toBeNull();
  });
});
