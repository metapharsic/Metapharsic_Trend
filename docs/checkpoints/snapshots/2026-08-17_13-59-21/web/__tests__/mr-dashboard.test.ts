import {
  evaluateGpsStatus,
  travelDistanceKm,
  coveragePercent,
  TrackPoint,
  GPS_STALE_AFTER_MINUTES,
} from "../lib/field-tracking";
import {
  buildNotifications,
  monthElapsedFraction,
  NotificationContext,
  RULE_THRESHOLDS,
} from "../lib/notifications";

const at = (iso: string): Date => new Date(iso);

const point = (over: Partial<TrackPoint> = {}): TrackPoint => ({
  latitude: 28.7041,
  longitude: 77.1025,
  isMocked: false,
  recordedAt: at("2026-08-03T09:00:00.000Z"),
  ...over,
});

describe("GPS status decision table", () => {
  const now = at("2026-08-03T10:00:00.000Z");

  it("reports NO_SIGNAL when nothing was recorded today", () => {
    const result = evaluateGpsStatus([], now);
    expect(result.status).toBe("NO_SIGNAL");
    expect(result.critical).toBe(true);
    expect(result.lastFixAt).toBeNull();
  });

  it("reports ACTIVE for a recent fix", () => {
    const result = evaluateGpsStatus([point({ recordedAt: at("2026-08-03T09:50:00.000Z") })], now);
    expect(result.status).toBe("ACTIVE");
    expect(result.critical).toBe(false);
    expect(result.minutesSinceLastFix).toBe(10);
  });

  it("reports STALE past the staleness threshold", () => {
    const result = evaluateGpsStatus([point({ recordedAt: at("2026-08-03T09:00:00.000Z") })], now);
    expect(result.status).toBe("STALE");
    expect(result.minutesSinceLastFix).toBeGreaterThan(GPS_STALE_AFTER_MINUTES);
  });

  it("treats exactly the threshold as still ACTIVE", () => {
    const result = evaluateGpsStatus([point({ recordedAt: at("2026-08-03T09:30:00.000Z") })], now);
    expect(result.minutesSinceLastFix).toBe(GPS_STALE_AFTER_MINUTES);
    expect(result.status).toBe("ACTIVE");
  });

  it("MOCKED outranks STALE — spoofing must not be masked by an old reading", () => {
    const result = evaluateGpsStatus(
      [point({ isMocked: true, recordedAt: at("2026-08-03T06:00:00.000Z") })],
      now
    );
    expect(result.status).toBe("MOCKED");
    expect(result.critical).toBe(true);
  });

  it("flags MOCKED when any fix in the day was spoofed", () => {
    const result = evaluateGpsStatus(
      [
        point({ recordedAt: at("2026-08-03T09:00:00.000Z") }),
        point({ isMocked: true, recordedAt: at("2026-08-03T09:30:00.000Z") }),
        point({ recordedAt: at("2026-08-03T09:55:00.000Z") }),
      ],
      now
    );
    expect(result.status).toBe("MOCKED");
  });

  it("discards future-dated fixes rather than reading them as fresh", () => {
    // Regression: clamping a negative age to zero made a skewed or post-dated
    // clock report "0 min ago / ACTIVE" indefinitely.
    const result = evaluateGpsStatus(
      [point({ recordedAt: at("2026-08-03T15:30:00.000Z") })], // 5.5h ahead
      now
    );
    expect(result.status).toBe("NO_SIGNAL");
    expect(result.lastFixAt).toBeNull();
  });

  it("falls back to the newest trustworthy fix when a future one is present", () => {
    const result = evaluateGpsStatus(
      [
        point({ recordedAt: at("2026-08-03T09:50:00.000Z") }),
        point({ recordedAt: at("2026-08-03T15:30:00.000Z") }),
      ],
      now
    );
    expect(result.status).toBe("ACTIVE");
    expect(result.minutesSinceLastFix).toBe(10);
  });

  it("still reports MOCKED even when the spoofed fix is future-dated", () => {
    const result = evaluateGpsStatus(
      [point({ isMocked: true, recordedAt: at("2026-08-03T15:30:00.000Z") })],
      now
    );
    expect(result.status).toBe("MOCKED");
    expect(result.critical).toBe(true);
  });

  it("tolerates minor clock skew within the allowance", () => {
    const result = evaluateGpsStatus(
      [point({ recordedAt: at("2026-08-03T10:02:00.000Z") })], // 2 min ahead
      now
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("uses the latest fix even when points arrive out of order", () => {
    const result = evaluateGpsStatus(
      [
        point({ recordedAt: at("2026-08-03T09:55:00.000Z") }),
        point({ recordedAt: at("2026-08-03T07:00:00.000Z") }),
      ],
      now
    );
    expect(result.minutesSinceLastFix).toBe(5);
  });
});

describe("Travel distance", () => {
  it("is zero with fewer than two fixes", () => {
    expect(travelDistanceKm([])).toBe(0);
    expect(travelDistanceKm([point()])).toBe(0);
  });

  it("sums consecutive legs", () => {
    const km = travelDistanceKm([
      point({ latitude: 28.7041, longitude: 77.1025, recordedAt: at("2026-08-03T09:00:00.000Z") }),
      point({ latitude: 28.7141, longitude: 77.1025, recordedAt: at("2026-08-03T09:30:00.000Z") }),
    ]);
    expect(km).toBeGreaterThan(1);
    expect(km).toBeLessThan(1.5);
  });

  it("orders by time before measuring, not by array order", () => {
    const forward = travelDistanceKm([
      point({ latitude: 28.70, recordedAt: at("2026-08-03T09:00:00.000Z") }),
      point({ latitude: 28.71, recordedAt: at("2026-08-03T10:00:00.000Z") }),
      point({ latitude: 28.72, recordedAt: at("2026-08-03T11:00:00.000Z") }),
    ]);
    const shuffled = travelDistanceKm([
      point({ latitude: 28.72, recordedAt: at("2026-08-03T11:00:00.000Z") }),
      point({ latitude: 28.70, recordedAt: at("2026-08-03T09:00:00.000Z") }),
      point({ latitude: 28.71, recordedAt: at("2026-08-03T10:00:00.000Z") }),
    ]);
    expect(shuffled).toBeCloseTo(forward, 5);
  });

  it("excludes mocked fixes so spoofing cannot inflate a mileage claim", () => {
    const honest = travelDistanceKm([
      point({ latitude: 28.70, recordedAt: at("2026-08-03T09:00:00.000Z") }),
      point({ latitude: 28.71, recordedAt: at("2026-08-03T10:00:00.000Z") }),
    ]);
    const withSpoof = travelDistanceKm([
      point({ latitude: 28.70, recordedAt: at("2026-08-03T09:00:00.000Z") }),
      point({ latitude: 19.07, longitude: 72.87, isMocked: true, recordedAt: at("2026-08-03T09:30:00.000Z") }),
      point({ latitude: 28.71, recordedAt: at("2026-08-03T10:00:00.000Z") }),
    ]);
    expect(withSpoof).toBeCloseTo(honest, 5);
  });
});

describe("Coverage percentage", () => {
  it("guards a zero denominator", () => {
    expect(coveragePercent(0, 0)).toBe(0);
    expect(coveragePercent(5, 0)).toBe(0);
  });

  it("computes and rounds", () => {
    expect(coveragePercent(1, 3)).toBe(33);
    expect(coveragePercent(3, 3)).toBe(100);
  });
});

describe("Notification rules", () => {
  const base: NotificationContext = {
    now: at("2026-08-10T08:00:00.000Z"),
    checkedIn: true,
    gpsStatus: "ACTIVE",
    pendingVisits: 0,
    tourPlanStatus: "APPROVED",
    nextMonthTourPlanSubmitted: true,
    rejectedExpenseCount: 0,
    lowStockProducts: 0,
    doctorCoveragePercent: 100,
    monthElapsedFraction: 0.3,
  };

  const codes = (ctx: Partial<NotificationContext>) =>
    buildNotifications({ ...base, ...ctx }).map((n) => n.code);

  it("produces nothing when the day is on track", () => {
    expect(buildNotifications(base)).toEqual([]);
  });

  it("raises a CRITICAL alert for mock GPS", () => {
    const notifications = buildNotifications({ ...base, gpsStatus: "MOCKED" });
    expect(notifications[0].code).toBe("GPS_MOCKED");
    expect(notifications[0].severity).toBe("CRITICAL");
  });

  it("sorts the most severe alert first", () => {
    const notifications = buildNotifications({
      ...base,
      gpsStatus: "MOCKED",
      lowStockProducts: 3,
      tourPlanStatus: "REJECTED",
    });
    expect(notifications.map((n) => n.severity)).toEqual(["CRITICAL", "ERROR", "INFO"]);
  });

  it("does not nag about check-in before the cutoff", () => {
    const beforeCutoff = new Date(2026, 7, 10, 8, 0);
    expect(codes({ checkedIn: false, now: beforeCutoff })).not.toContain("NOT_CHECKED_IN");
  });

  it("flags a missing check-in after the cutoff", () => {
    const afterCutoff = new Date(2026, 7, 10, 10, 0);
    expect(codes({ checkedIn: false, now: afterCutoff })).toContain("NOT_CHECKED_IN");
  });

  it("stays quiet about GPS until the rep has checked in", () => {
    const afterCutoff = new Date(2026, 7, 10, 10, 0);
    expect(codes({ checkedIn: false, gpsStatus: "NO_SIGNAL", now: afterCutoff })).not.toContain(
      "GPS_NO_SIGNAL"
    );
    expect(codes({ checkedIn: true, gpsStatus: "NO_SIGNAL", now: afterCutoff })).toContain(
      "GPS_NO_SIGNAL"
    );
  });

  it("only flags outstanding visits after end of day", () => {
    const midday = new Date(2026, 7, 10, 12, 0);
    const evening = new Date(2026, 7, 10, 18, 0);
    expect(codes({ pendingVisits: 3, now: midday })).not.toContain("PENDING_VISITS_LATE");
    expect(codes({ pendingVisits: 3, now: evening })).toContain("PENDING_VISITS_LATE");
  });

  it("chases next month's tour plan only from the due day", () => {
    const early = new Date(2026, 7, 10, 9, 0);
    const late = new Date(2026, 7, RULE_THRESHOLDS.tourPlanDueDayOfMonth, 9, 0);
    expect(codes({ nextMonthTourPlanSubmitted: false, now: early })).not.toContain("TOUR_PLAN_DUE");
    expect(codes({ nextMonthTourPlanSubmitted: false, now: late })).toContain("TOUR_PLAN_DUE");
  });

  it("paces coverage against the month elapsed, with tolerance", () => {
    // Half the month gone, 50% expected; 40% is inside the 15-point tolerance.
    expect(codes({ monthElapsedFraction: 0.5, doctorCoveragePercent: 40 })).not.toContain(
      "COVERAGE_BEHIND_PACE"
    );
    expect(codes({ monthElapsedFraction: 0.5, doctorCoveragePercent: 20 })).toContain(
      "COVERAGE_BEHIND_PACE"
    );
  });

  it("does not flag coverage at the very start of the month", () => {
    expect(codes({ monthElapsedFraction: 0, doctorCoveragePercent: 0 })).not.toContain(
      "COVERAGE_BEHIND_PACE"
    );
  });

  it("reports rejected expenses as an ERROR with a plural-correct message", () => {
    const one = buildNotifications({ ...base, rejectedExpenseCount: 1 }).find(
      (n) => n.code === "EXPENSE_REJECTED"
    );
    const many = buildNotifications({ ...base, rejectedExpenseCount: 3 }).find(
      (n) => n.code === "EXPENSE_REJECTED"
    );
    expect(one?.message).toContain("1 expense claim rejected");
    expect(many?.message).toContain("3 expense claims rejected");
  });

  it("every notification carries a next action", () => {
    const notifications = buildNotifications({
      ...base,
      checkedIn: false,
      gpsStatus: "MOCKED",
      pendingVisits: 2,
      tourPlanStatus: "REJECTED",
      rejectedExpenseCount: 1,
      lowStockProducts: 2,
      now: new Date(2026, 7, 26, 18, 0),
    });
    expect(notifications.length).toBeGreaterThan(4);
    for (const n of notifications) expect(n.action).toBeTruthy();
  });
});

describe("Month elapsed fraction", () => {
  it("is small on the first day and 1 on the last", () => {
    expect(monthElapsedFraction(new Date(2026, 7, 1))).toBeCloseTo(1 / 31, 5);
    expect(monthElapsedFraction(new Date(2026, 7, 31))).toBe(1);
  });

  it("accounts for shorter months", () => {
    expect(monthElapsedFraction(new Date(2026, 1, 28))).toBe(1); // February
  });
});
