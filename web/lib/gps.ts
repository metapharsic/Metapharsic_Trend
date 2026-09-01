export function haversineDistanceKm(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface AnomalyCheckResult {
  isAnomalous: boolean;
  reason: string | null;
  distanceKm: number;
  timeDiffMinutes: number;
  calculatedSpeed: number;
}

/**
 * GPS tracking and geofencing are disabled.
 * Always returns non-anomalous status.
 */
export function checkVisitAnomaly(
  _prevLat?: number,
  _prevLon?: number,
  _prevTime?: Date,
  _currLat?: number,
  _currLon?: number,
  _currTime?: Date
): AnomalyCheckResult {
  return {
    isAnomalous: false,
    reason: null,
    distanceKm: 0,
    timeDiffMinutes: 0,
    calculatedSpeed: 0,
  };
}
