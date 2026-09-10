export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDailySummaryJob } = await import("./jobs/daily-summary");
    startDailySummaryJob();

    const { startMrNightBriefJob } = await import("./jobs/mr-night-brief");
    startMrNightBriefJob();
  }
}
