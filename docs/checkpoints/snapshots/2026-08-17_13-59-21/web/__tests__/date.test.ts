import { startOfUtcDay, startOfUtcMonth, addUtcDays } from "../lib/date";

/**
 * Regression tests for a real bug: `@db.Date` columns store a UTC calendar date,
 * but the code originally compared them against server-local midnight. On any
 * server ahead of UTC (this project runs IST, +5:30) local midnight resolves to
 * the PREVIOUS UTC day, which silently broke every "today" query — attendance
 * check-ins, tour-plan day matching, and the DCR block.
 */
describe("UTC date normalization", () => {
  it("resolves to UTC midnight, not local midnight", () => {
    const result = startOfUtcDay(new Date("2026-08-02T18:30:00.000Z"));
    expect(result.toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });

  it("keeps the same calendar day for a timestamp late in the IST day", () => {
    // 23:05 IST on 2 Aug is 17:35 UTC on 2 Aug — must stay 2 Aug, not slip to 1 Aug.
    const istLateEvening = new Date("2026-08-02T17:35:00.000Z");
    expect(startOfUtcDay(istLateEvening).toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });

  it("does not drift across a month boundary", () => {
    expect(startOfUtcMonth(new Date("2026-08-31T23:59:59.000Z")).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z"
    );
  });

  it("builds an exclusive upper bound one day ahead", () => {
    const start = startOfUtcDay(new Date("2026-08-02T10:00:00.000Z"));
    expect(addUtcDays(start, 1).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });

  it("rolls over month ends correctly", () => {
    const start = startOfUtcDay(new Date("2026-08-31T10:00:00.000Z"));
    expect(addUtcDays(start, 1).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("a same-day range contains that day's UTC-midnight record", () => {
    // This is exactly the tour-plan-day lookup the DCR block performs.
    const storedTourPlanDay = new Date("2026-08-02T00:00:00.000Z");
    const start = startOfUtcDay(new Date("2026-08-02T17:35:00.000Z"));
    const end = addUtcDays(start, 1);

    expect(storedTourPlanDay >= start).toBe(true);
    expect(storedTourPlanDay < end).toBe(true);
  });
});
