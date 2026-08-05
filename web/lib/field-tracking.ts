import { haversineDistanceKm } from "./gps";

/**
 * Field-force tracking rules for the MR daily dashboard.
 * See docs/03_features/mr_dashboard.md for the decision tables these implement.
 */

export const GPS_STALE_AFTER_MINUTES = 30;

/**
 * Fixes dated further ahead than this are discarded as untrustworthy.
 * A position you cannot date cannot prove presence, and clamping the age to zero
 * would make a skewed or deliberately post-dated clock read as permanently ACTIVE.
 */
export const GPS_FUTURE_TOLERANCE_MINUTES = 5;

/** A single recorded position. */
export interface TrackPoint {
  latitude: number;
  longitude: number;
  isMocked: boolean;
  recordedAt: Date;
}

export type GpsStatus = "ACTIVE" | "STALE" | "MOCKED" | "NO_SIGNAL";

export interface GpsStatusResult {
  status: GpsStatus;
  lastFixAt: Date | null;
  minutesSinceLastFix: number | null;
  /** True when the status warrants blocking or escalation rather than a nudge. */
  critical: boolean;
}

/**
 * GPS status decision table (first match wins):
 *   no points today                  -> NO_SIGNAL  (critical: field activity is unverifiable)
 *   any mocked fix today             -> MOCKED     (critical: spoofing, triggers account lock)
 *   last fix older than 30 minutes   -> STALE
 *   otherwise                        -> ACTIVE
 *
 * MOCKED outranks STALE deliberately: a spoofed fix is a compliance event and must
 * not be masked by the reading also being old.
 */
export function evaluateGpsStatus(points: TrackPoint[], now: Date = new Date()): GpsStatusResult {
  // A spoofed fix is a compliance event regardless of its timestamp, so mock
  // detection runs across every reported point before any are discarded.
  const anyMocked = points.some((p) => p.isMocked);

  const futureCutoff = now.getTime() + GPS_FUTURE_TOLERANCE_MINUTES * 60000;
  const usable = points.filter((p) => p.recordedAt.getTime() <= futureCutoff);

  if (usable.length === 0) {
    return {
      status: anyMocked ? "MOCKED" : "NO_SIGNAL",
      lastFixAt: null,
      minutesSinceLastFix: null,
      critical: true,
    };
  }

  const sorted = [...usable].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const last = sorted[sorted.length - 1];
  const minutesSinceLastFix = Math.max(
    Math.floor((now.getTime() - last.recordedAt.getTime()) / 60000),
    0
  );

  if (anyMocked) {
    return { status: "MOCKED", lastFixAt: last.recordedAt, minutesSinceLastFix, critical: true };
  }

  if (minutesSinceLastFix > GPS_STALE_AFTER_MINUTES) {
    return { status: "STALE", lastFixAt: last.recordedAt, minutesSinceLastFix, critical: false };
  }

  return { status: "ACTIVE", lastFixAt: last.recordedAt, minutesSinceLastFix, critical: false };
}

/**
 * Distance travelled as the sum of legs between consecutive fixes, in chronological
 * order. Mocked fixes are excluded: including a spoofed coordinate would inflate the
 * total and, since mileage drives expense reimbursement, inflate the claim with it.
 */
export function travelDistanceKm(points: TrackPoint[]): number {
  const genuine = points
    .filter((p) => !p.isMocked)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  if (genuine.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < genuine.length; i++) {
    total += haversineDistanceKm(
      genuine[i - 1].latitude,
      genuine[i - 1].longitude,
      genuine[i].latitude,
      genuine[i].longitude
    );
  }

  return Math.round(total * 100) / 100;
}

/** Coverage as a percentage, guarding the zero-denominator case. */
export function coveragePercent(visited: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((visited / total) * 100);
}
