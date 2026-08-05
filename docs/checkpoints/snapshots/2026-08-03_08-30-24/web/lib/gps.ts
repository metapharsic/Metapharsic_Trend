const EARTH_RADIUS_KM = 6371;
const ANOMALY_MAX_SPEED_KMH = Number(process.env.ANOMALY_MAX_SPEED_KMH ?? 60);

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function checkVisitAnomaly(
  prevLat: number,
  prevLon: number,
  prevTime: Date,
  currLat: number,
  currLon: number,
  currTime: Date
): AnomalyCheckResult {
  const distanceKm = haversineDistanceKm(prevLat, prevLon, currLat, currLon);
  const timeDiffMinutes = Math.max((currTime.getTime() - prevTime.getTime()) / 60000, 0);
  const timeDiffHours = timeDiffMinutes / 60;
  const calculatedSpeed = timeDiffHours > 0 ? distanceKm / timeDiffHours : Infinity;

  const isAnomalous = calculatedSpeed > ANOMALY_MAX_SPEED_KMH;

  return {
    isAnomalous,
    reason: isAnomalous ? "IMPLAUSIBLE_TRAVEL_SPEED" : null,
    distanceKm,
    timeDiffMinutes,
    calculatedSpeed,
  };
}
