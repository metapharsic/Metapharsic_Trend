import { haversineDistanceKm } from "../lib/gps";

describe("Geofence GPS Auditing Tests", () => {
  const doctorLat = 28.7041;
  const doctorLon = 77.1025;

  it("should PASS when the check-in is within 100 meters", () => {
    // Coordinate extremely close to Doctor's clinic (~15 meters)
    const checkInLat = 28.7042;
    const checkInLon = 77.1026;

    const distanceMeters = haversineDistanceKm(doctorLat, doctorLon, checkInLat, checkInLon) * 1000;
    expect(distanceMeters).toBeLessThan(100);
  });

  it("should FAIL when the check-in is outside 100 meters", () => {
    // Coordinate far away from Doctor's clinic (~15 kilometers)
    const checkInLat = 28.8041;
    const checkInLon = 77.2025;

    const distanceMeters = haversineDistanceKm(doctorLat, doctorLon, checkInLat, checkInLon) * 1000;
    expect(distanceMeters).toBeGreaterThan(100);
  });
});
