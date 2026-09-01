import { checkVisitAnomaly, haversineDistanceKm } from "../lib/gps";
import { validateReceiptDate, isOcrConfigured } from "../lib/ocr";
import { optimizeRoute, RouteStop } from "../lib/route-optimizer";

/**
 * Phase 3 QA gates — GPS spoof/anomaly detection, receipt date policy,
 * and route optimization.
 */
describe("Visit travel-speed anomaly detection (GPS Checks Disabled)", () => {
  const delhi = { lat: 28.7041, lon: 77.1025 };
  const mumbai = { lat: 19.076, lon: 72.8777 };

  it("never flags visits as anomalous when GPS is disabled", () => {
    const result = checkVisitAnomaly(
      delhi.lat,
      delhi.lon,
      new Date("2026-08-02T09:00:00.000Z"),
      mumbai.lat,
      mumbai.lon,
      new Date("2026-08-02T09:30:00.000Z")
    );

    expect(result.isAnomalous).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("accepts local travel without anomaly flags", () => {
    const result = checkVisitAnomaly(
      28.7041,
      77.1025,
      new Date("2026-08-02T09:00:00.000Z"),
      28.71,
      77.11,
      new Date("2026-08-02T09:45:00.000Z")
    );

    expect(result.isAnomalous).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe("Geofence distance", () => {
  it("is symmetric", () => {
    const a = haversineDistanceKm(28.7041, 77.1025, 28.71, 77.11);
    const b = haversineDistanceKm(28.71, 77.11, 28.7041, 77.1025);
    expect(a).toBeCloseTo(b, 10);
  });

  it("is zero for identical coordinates", () => {
    expect(haversineDistanceKm(28.7041, 77.1025, 28.7041, 77.1025)).toBe(0);
  });
});

describe("Receipt date policy", () => {
  const submittedAt = new Date("2026-08-02T00:00:00.000Z");

  it("rejects a future-dated receipt", () => {
    const result = validateReceiptDate(new Date("2026-08-05T00:00:00.000Z"), submittedAt);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/future/i);
  });

  it("rejects a receipt older than the claim window", () => {
    const result = validateReceiptDate(new Date("2026-06-01T00:00:00.000Z"), submittedAt);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/older/i);
  });

  it("accepts a recent receipt", () => {
    const result = validateReceiptDate(new Date("2026-07-28T00:00:00.000Z"), submittedAt);
    expect(result.valid).toBe(true);
  });

  it("reports OCR as unconfigured in this environment rather than guessing", () => {
    expect(isOcrConfigured()).toBe(false);
  });
});

describe("Route optimization", () => {
  const stops: RouteStop[] = [
    { id: "far", name: "Far clinic", type: "DOCTOR", latitude: 28.80, longitude: 77.20 },
    { id: "near", name: "Near clinic", type: "DOCTOR", latitude: 28.7045, longitude: 77.1028 },
    { id: "mid", name: "Mid clinic", type: "DOCTOR", latitude: 28.75, longitude: 77.15 },
  ];
  const start = { latitude: 28.7041, longitude: 77.1025 };

  it("visits the nearest stop first and the farthest last", () => {
    const route = optimizeRoute(stops, start);
    expect(route.stops.map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("returns every stop exactly once with sequential numbering", () => {
    const route = optimizeRoute(stops, start);
    expect(route.stops).toHaveLength(stops.length);
    expect(route.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
    expect(new Set(route.stops.map((s) => s.id)).size).toBe(stops.length);
  });

  it("totals the individual legs", () => {
    const route = optimizeRoute(stops, start);
    const legSum = route.stops.reduce((sum, s) => sum + s.legDistanceKm, 0);
    expect(route.totalDistanceKm).toBeCloseTo(legSum, 1);
  });

  it("handles an empty day without throwing", () => {
    const route = optimizeRoute([], start);
    expect(route.stops).toEqual([]);
    expect(route.totalDistanceKm).toBe(0);
  });
});
