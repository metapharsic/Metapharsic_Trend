/**
 * MR notification rules engine.
 *
 * A pure function over a snapshot of the rep's day so the rules are unit-testable
 * and live in one place rather than being scattered through the dashboard query.
 * Each rule maps to a row in the decision table in docs/03_features/mr_dashboard.md.
 */

export type NotificationSeverity = "CRITICAL" | "ERROR" | "WARNING" | "INFO";

export interface Notification {
  code: string;
  severity: NotificationSeverity;
  message: string;
  /** What the rep should do next; omitted when no action is possible. */
  action?: string;
}

export const RULE_THRESHOLDS = {
  /** Attendance is expected before this hour (local time). */
  checkInByHour: 9.5,
  /** After this hour, outstanding planned visits are flagged. */
  endOfDayHour: 17,
  /** Next month's tour plan must be submitted on or after this day of the month. */
  tourPlanDueDayOfMonth: 25,
  /** Sample stock at or below this triggers a restock nudge. */
  lowSampleStock: 10,
  /** Coverage may lag the elapsed-month pace by this many points before flagging. */
  coverageTolerancePercent: 15,
  /** Unpaid invoices older than this many days are flagged as aged billing. */
  agedBillingDays: 30,
} as const;

export interface NotificationContext {
  now: Date;
  checkedIn: boolean;
  gpsStatus: "ACTIVE" | "STALE" | "MOCKED" | "NO_SIGNAL";
  pendingVisits: number;
  tourPlanStatus: "NONE" | "DRAFT" | "PENDING_ASM" | "APPROVED" | "REJECTED";
  nextMonthTourPlanSubmitted: boolean;
  rejectedExpenseCount: number;
  lowStockProducts: number;
  doctorCoveragePercent: number;
  /** Fraction of the month elapsed, 0-1. Used to pace coverage expectations. */
  monthElapsedFraction: number;
  /** Chemists in this rep's territory at or over their credit limit. */
  breachedCreditChemists: number;
  /** Chemists in this rep's territory approaching their credit limit. */
  warningCreditChemists: number;
  /** Unpaid invoices older than the aged-billing threshold. */
  agedInvoices: number;
}

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

export function buildNotifications(ctx: NotificationContext): Notification[] {
  const notifications: Notification[] = [];
  const hour = ctx.now.getHours() + ctx.now.getMinutes() / 60;

  // Compliance first — a spoofed fix is an account-locking event.
  if (ctx.gpsStatus === "MOCKED") {
    notifications.push({
      code: "GPS_MOCKED",
      severity: "CRITICAL",
      message: "Mock GPS detected on your device. Your account may be locked pending review.",
      action: "Disable any location-spoofing app and contact your manager.",
    });
  }

  if (ctx.tourPlanStatus === "REJECTED") {
    notifications.push({
      code: "TOUR_PLAN_REJECTED",
      severity: "ERROR",
      message: "Your tour plan was rejected.",
      action: "Revise the plan and resubmit for approval.",
    });
  }

  if (ctx.rejectedExpenseCount > 0) {
    notifications.push({
      code: "EXPENSE_REJECTED",
      severity: "ERROR",
      message: `${ctx.rejectedExpenseCount} expense claim${ctx.rejectedExpenseCount === 1 ? "" : "s"} rejected.`,
      action: "Review the audit notes and resubmit with a valid receipt.",
    });
  }

  if (!ctx.checkedIn && hour >= RULE_THRESHOLDS.checkInByHour) {
    notifications.push({
      code: "NOT_CHECKED_IN",
      severity: "WARNING",
      message: "You have not checked in today.",
      action: "Check in to start logging field activity.",
    });
  }

  // Only nag about a missing signal once the day has actually started.
  if (ctx.checkedIn && ctx.gpsStatus === "NO_SIGNAL") {
    notifications.push({
      code: "GPS_NO_SIGNAL",
      severity: "WARNING",
      message: "No GPS fix recorded today. Visits cannot be geo-verified.",
      action: "Enable location services on your device.",
    });
  }

  if (ctx.checkedIn && ctx.gpsStatus === "STALE") {
    notifications.push({
      code: "GPS_STALE",
      severity: "INFO",
      message: "Your last GPS fix is over 30 minutes old.",
      action: "Open the mobile app to refresh your location.",
    });
  }

  if (ctx.pendingVisits > 0 && hour >= RULE_THRESHOLDS.endOfDayHour) {
    notifications.push({
      code: "PENDING_VISITS_LATE",
      severity: "WARNING",
      message: `${ctx.pendingVisits} planned visit${ctx.pendingVisits === 1 ? "" : "s"} still outstanding.`,
      action: "Complete them today or they count as missed calls.",
    });
  }

  if (
    !ctx.nextMonthTourPlanSubmitted &&
    ctx.now.getDate() >= RULE_THRESHOLDS.tourPlanDueDayOfMonth
  ) {
    notifications.push({
      code: "TOUR_PLAN_DUE",
      severity: "WARNING",
      message: "Next month's tour plan has not been submitted.",
      action: "Submit it before month end so visits can be approved.",
    });
  }

  // Coverage is paced against the month elapsed, so early-month reps are not
  // flagged for simply not having finished yet.
  const expectedCoverage = Math.round(ctx.monthElapsedFraction * 100);
  if (
    expectedCoverage > 0 &&
    ctx.doctorCoveragePercent < expectedCoverage - RULE_THRESHOLDS.coverageTolerancePercent
  ) {
    notifications.push({
      code: "COVERAGE_BEHIND_PACE",
      severity: "WARNING",
      message: `Doctor coverage is ${ctx.doctorCoveragePercent}%, behind the ~${expectedCoverage}% expected by now.`,
      action: "Prioritise unvisited high-potential doctors.",
    });
  }

  if (ctx.breachedCreditChemists > 0) {
    notifications.push({
      code: "CREDIT_BREACHED",
      severity: "ERROR",
      message: `${ctx.breachedCreditChemists} chemist${ctx.breachedCreditChemists === 1 ? " is" : "s are"} over their credit limit.`,
      action: "Collect payment before booking further orders for them.",
    });
  }

  if (ctx.warningCreditChemists > 0) {
    notifications.push({
      code: "CREDIT_WARNING",
      severity: "WARNING",
      message: `${ctx.warningCreditChemists} chemist${ctx.warningCreditChemists === 1 ? " is" : "s are"} approaching their credit limit.`,
      action: "Plan a collection visit soon.",
    });
  }

  if (ctx.agedInvoices > 0) {
    notifications.push({
      code: "AGED_BILLING",
      severity: "ERROR",
      message: `${ctx.agedInvoices} invoice${ctx.agedInvoices === 1 ? " is" : "s are"} unpaid for over ${RULE_THRESHOLDS.agedBillingDays} days.`,
      action: "Follow up for collection before the account ages further.",
    });
  }

  if (ctx.lowStockProducts > 0) {
    notifications.push({
      code: "LOW_SAMPLE_STOCK",
      severity: "INFO",
      message: `${ctx.lowStockProducts} sample product${ctx.lowStockProducts === 1 ? " is" : "s are"} running low.`,
      action: "Raise a replenishment request.",
    });
  }

  return notifications.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

/** Fraction of the current month elapsed, used to pace coverage expectations. */
export function monthElapsedFraction(now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(now.getDate() / daysInMonth, 1);
}
