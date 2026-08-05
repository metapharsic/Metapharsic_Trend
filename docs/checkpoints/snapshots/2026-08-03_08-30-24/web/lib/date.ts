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
