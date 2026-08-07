/**
 * Prisma `@db.Date` columns store a UTC calendar date with no time component.
 * Comparing them against locally-computed "midnight" Date objects breaks on
 * any server timezone ahead/behind UTC (local midnight != UTC midnight).
 * Always normalize to UTC midnight before writing to or querying a Date column.
 */
export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfUtcMonth(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * IST = UTC+5:30. All client-generated timestamps (check-ins, orders, collections)
 * are recorded in real UTC but the *user-visible* day/month boundaries are IST.
 * These helpers translate IST calendar boundaries to the UTC instants Prisma needs.
 *
 * Example: IST Aug 6 00:00  →  UTC Aug 5 18:30
 *          IST Aug 1 00:00  →  UTC Jul 31 18:30
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1_000; // 5 h 30 m in milliseconds

/** Start of the current IST calendar day, expressed as a UTC Date. */
export function startOfIstDay(date: Date = new Date()): Date {
  const inIst = new Date(date.getTime() + IST_OFFSET_MS);
  const istMidnight = new Date(
    Date.UTC(inIst.getUTCFullYear(), inIst.getUTCMonth(), inIst.getUTCDate()),
  );
  return new Date(istMidnight.getTime() - IST_OFFSET_MS);
}

/** Start of the current IST calendar month, expressed as a UTC Date. */
export function startOfIstMonth(date: Date = new Date()): Date {
  const inIst = new Date(date.getTime() + IST_OFFSET_MS);
  const istMonthStart = new Date(
    Date.UTC(inIst.getUTCFullYear(), inIst.getUTCMonth(), 1),
  );
  return new Date(istMonthStart.getTime() - IST_OFFSET_MS);
}
