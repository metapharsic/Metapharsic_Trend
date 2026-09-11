import cron, { ScheduledTask } from "node-cron";
import { SystemConfigService } from "@/services/system-config.service";
import { SoftwareUpdateAgentsService } from "@/services/software-update-agents.service";

let currentScheduledTask: ScheduledTask | null = null;

export async function runScheduledGitHubPull() {
  const config = SystemConfigService.getConfig();
  if (!config.autoPullEnabled || config.autoPullSchedule === "OFF") {
    console.log("[GitHubSyncJob] Auto-pull skipped — disabled in System Configuration.");
    return;
  }

  console.log(`[GitHubSyncJob] Triggering scheduled GitHub pull for branch '${config.targetBranch}'...`);
  try {
    const result = await SoftwareUpdateAgentsService.pullUpdates({
      branch: config.targetBranch,
      isAuto: true,
      autoSync: config.autoSyncOnPull,
    });
    console.log(`[GitHubSyncJob] Completed with status: ${result.status}. ${result.message}`);
  } catch (err) {
    console.error("[GitHubSyncJob] Error during scheduled GitHub pull:", err);
  }
}

export function startGitHubSyncJob() {
  const config = SystemConfigService.getConfig();

  if (currentScheduledTask) {
    currentScheduledTask.stop();
    currentScheduledTask = null;
  }

  if (!config.autoPullEnabled || config.autoPullSchedule === "OFF") {
    console.log("[GitHubSyncJob] Auto-pull scheduler is currently OFF.");
    return;
  }

  // Cron schedule expression:
  // - TWICE_WEEKLY (Monday & Thursday 03:00 AM IST = 21:30 UTC Sun & Wed): '30 21 * * 0,3'
  // - DAILY (Every day 03:00 AM IST = 21:30 UTC): '30 21 * * *'
  const cronExpression =
    config.autoPullSchedule === "DAILY"
      ? "30 21 * * *"
      : "30 21 * * 0,3"; // Twice a week: Sunday & Wednesday 21:30 UTC = Mon & Thu 03:00 IST

  currentScheduledTask = cron.schedule(cronExpression, async () => {
    await runScheduledGitHubPull();
  });

  console.log(
    `[GitHubSyncJob] Scheduled auto-pull active (${config.autoPullSchedule}: '${cronExpression}') — Next: ${SystemConfigService.getNextScheduledPull()}`
  );
}

export function reloadGitHubSyncSchedule() {
  startGitHubSyncJob();
}
