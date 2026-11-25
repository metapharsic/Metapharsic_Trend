export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // ── EOD Midnight Multi-Agent Report (Mon–Sat 23:58 IST) ─────────────────
    // Replaces daily-summary (21:00 IST) + mr-night-brief (23:00 IST) auto-scheduling.
    // Those job FILES are kept intact — their manual API triggers still work.
    const { startMrEodMidnightJob } = await import("./jobs/mr-eod-midnight");
    startMrEodMidnightJob();

    // ── DPS Doctor Scoring (nightly 01:00 UTC = 06:30 IST) ──────────────────
    const { startDpsScoringJob } = await import("./jobs/dps-scoring");
    startDpsScoringJob();

    // ── GitHub Auto-Pull Sync ────────────────────────────────────────────────
    const { startGitHubSyncJob } = await import("./jobs/github-sync");
    startGitHubSyncJob();
  }
}
