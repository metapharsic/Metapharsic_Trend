import { SoftwareUpdateAgentsService } from "../services/software-update-agents.service";

describe("SoftwareUpdateAgentsService Multi-Agent Pipeline", () => {
  it("checks for GitHub update availability and returns 4 agent telemetry statuses", async () => {
    const status = await SoftwareUpdateAgentsService.checkForUpdates();

    expect(status).toHaveProperty("updateAvailable");
    expect(status.currentVersion).toBe("v1.1.0");
    expect(status.targetVersion).toBe("v1.2.0");
    expect(status.repoUrl).toContain("github.com/metapharsic/Metapharsic_Trend");

    // 4 Agents verified
    expect(status.agentTelemetry.length).toBe(4);
    expect(status.agentTelemetry[0].id).toBe("agent-github-sync");
    expect(status.agentTelemetry[1].id).toBe("agent-codediff-review");
    expect(status.agentTelemetry[2].id).toBe("agent-safety-guard");
    expect(status.agentTelemetry[3].id).toBe("agent-deployment-orchestrator");

    expect(status.agentTelemetry[0].status).toBe("SYNCED");
    expect(status.agentTelemetry[2].status).toBe("VERIFIED");
  });

  it("returns file diff breakdown and line-by-line review snippet", async () => {
    const review = await SoftwareUpdateAgentsService.getUpdateDiffReview();

    expect(review.commitLogs.length).toBeGreaterThan(0);
    expect(review.fileDiffs.length).toBeGreaterThan(0);
    expect(review.impactSummary.isDatabaseSafe).toBe(true);
    expect(review.impactSummary.isEnvSafe).toBe(true);

    const firstFile = review.fileDiffs[0];
    expect(firstFile.additions).toBeGreaterThan(0);
    expect(firstFile.filename).toBeTruthy();
    expect(firstFile.diffSnippet).toContain("+");
  });

  it("executes apply update gracefully", async () => {
    const result = await SoftwareUpdateAgentsService.applyUpdate();

    expect(result.success).toBe(true);
    expect(result.version).toBe("v1.2.0");
    expect(result.appliedCommitHash).toBeTruthy();
    expect(result.message).toBeTruthy();
  });
});
