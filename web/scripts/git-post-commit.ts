import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PLINK_PATH = 'C:\\Program Files\\PuTTY\\plink.exe';
const PSCP_PATH = 'C:\\Program Files\\PuTTY\\pscp.exe';
const SSH_KEY_PATH = 'C:\\Trend_MR\\vps_key.ppk';
const VPS_HOST = 'root@187.127.169.217';
const VPS_WEB_DIR = '/u01/apps/Metapharsic_MrTracker/web';

const SCRATCH_DIR = path.resolve(__dirname, "../../scratch");
const LOG_FILE = path.join(SCRATCH_DIR, "vps_commit_auto_sync.log");

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line, "utf-8");
  console.log(msg);
}

async function runPostCommitSync() {
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  log("\x1b[1;36m================================================================================\x1b[0m");
  log("\x1b[1;36m   GIT POST-COMMIT HOOK: MULTI-AGENT VPS AUTOMATIC SYNC ENGINE                   \x1b[0m");
  log("\x1b[1;36m================================================================================\x1b[0m");

  const commitHash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const commitMsg = execSync("git log -1 --pretty=%B", { encoding: "utf8" }).trim();

  log(`Commit Hash: ${commitHash} | Message: ${commitMsg}`);

  // ---- AGENT 0: GITHUB SYNC AGENT ----
  // Push this commit to GitHub automatically -- no dev has to run Push_To_GitHub.bat by hand.
  // Best-effort: if this fails (no network, auth issue) we still mirror to the VPS below,
  // but we say so loudly rather than pretending GitHub is in sync when it is not.
  let githubPushOk = false;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    log(`[GitHubSyncAgent] Pushing ${commitHash} to origin/${branch}...`);
    const pushRes = spawnSync(`git push origin ${branch}`, { shell: true, encoding: "utf8", timeout: 120000 });
    githubPushOk = pushRes.status === 0;
    if (githubPushOk) {
      log(`\x1b[32m[GitHubSyncAgent] OK -- ${commitHash} is live on GitHub (origin/${branch}).\x1b[0m`);
    } else {
      log(`\x1b[31m[GitHubSyncAgent] FAILED -- GitHub push did not succeed, commit is LOCAL ONLY: ${(pushRes.stderr || pushRes.stdout || "").slice(0, 500)}\x1b[0m`);
    }
  } catch (e: any) {
    log(`\x1b[31m[GitHubSyncAgent] FAILED -- ${e?.message || e}\x1b[0m`);
  }

  // Get list of changed files in latest commit
  const diffOutput = execSync("git diff-tree --no-commit-id --name-only -r HEAD", { encoding: "utf8" }).trim();
  const files = diffOutput.split("\n").filter((f) => f.trim().length > 0);

  log(`Identified ${files.length} changed file(s) in latest commit.`);

  let syncedCount = 0;
  let schemaChanged = false;

  for (const relPath of files) {
    // Only mirror files inside web directory or root config files
    const repoRoot = path.resolve(__dirname, "../..");
    const fullLocalPath = path.join(repoRoot, relPath);

    if (!fs.existsSync(fullLocalPath)) {
      log(`  \x1b[33m⚠ File deleted locally, skipping mirror: ${relPath}\x1b[0m`);
      continue;
    }

    if (relPath.includes("schema.prisma")) {
      schemaChanged = true;
    }

    // Determine target relative path inside VPS web directory
    let vpsRelPath = relPath;
    if (vpsRelPath.startsWith("web/")) {
      vpsRelPath = vpsRelPath.substring(4);
    }

    const remoteRelDir = path.dirname(vpsRelPath).replace(/\\/g, "/");
    const remoteFullDir = `${VPS_WEB_DIR}/${remoteRelDir}`;

    // Ensure remote directory exists
    const mkdirCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "mkdir -p '${remoteFullDir}'"`;
    spawnSync(mkdirCmd, { shell: true });

    // Copy committed file to VPS over PSCP
    const pscpCmd = `"${PSCP_PATH}" -batch -i "${SSH_KEY_PATH}" "${fullLocalPath}" "${VPS_HOST}:${VPS_WEB_DIR}/${vpsRelPath}"`;
    try {
      execSync(pscpCmd, { stdio: "ignore" });
      syncedCount++;
      log(`  \x1b[32m✔ Auto-Transferred: ${relPath} -> VPS:${VPS_WEB_DIR}/${vpsRelPath}\x1b[0m`);
    } catch (err: any) {
      log(`  \x1b[31m✖ Transfer error for ${relPath}: ${err.message}\x1b[0m`);
    }
  }

  if (schemaChanged) {
    log("\x1b[1;33mPrisma schema change detected. Running remote db push & generate on VPS...\x1b[0m");
    const prismaCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "cd ${VPS_WEB_DIR} && npx prisma db push --skip-generate && npx prisma generate"`;
    const prismaRes = spawnSync(prismaCmd, { shell: true, encoding: "utf8" });
    if (prismaRes.status === 0) {
      log("\x1b[32m✔ Remote Prisma DB schema aligned successfully.\x1b[0m");
    } else {
      log(`\x1b[31m✖ Remote Prisma alignment FAILED: ${(prismaRes.stderr || prismaRes.stdout || "").slice(0, 500)}\x1b[0m`);
    }
  }

  // Committed files only take effect once the VPS process is rebuilt & restarted --
  // otherwise the old code keeps serving requests even though new files landed on disk.
  if (syncedCount > 0) {
    log("\x1b[1;33mRebuilding & restarting the VPS app so the transferred code takes effect...\x1b[0m");
    const rebuildCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "cd ${VPS_WEB_DIR} && npm run build"`;
    const rebuildRes = spawnSync(rebuildCmd, { shell: true, encoding: "utf8", timeout: 600000 });
    if (rebuildRes.status === 0) {
      log("\x1b[32m✔ Remote build succeeded.\x1b[0m");
      const restartCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "cd ${VPS_WEB_DIR} && (pm2 reload trend-mr --update-env && echo RESTARTED_VIA_PM2) || (systemctl restart trend-mr && echo RESTARTED_VIA_SYSTEMD) || (pkill -f 'next-server|next start' ; sleep 1 ; nohup npm start > /var/log/trend-mr-app.log 2>&1 & echo RESTARTED_VIA_NOHUP)"`;
      const restartRes = spawnSync(restartCmd, { shell: true, encoding: "utf8" });
      if (restartRes.status === 0) {
        log(`\x1b[32m✔ VPS app restarted: ${(restartRes.stdout || "").trim()}\x1b[0m`);
      } else {
        log(`\x1b[31m✖ VPS app restart FAILED -- new code is on disk but the OLD process is still serving requests: ${(restartRes.stderr || "").slice(0, 500)}\x1b[0m`);
      }
    } else {
      log(`\x1b[31m✖ Remote build FAILED -- app was NOT restarted, old release is still live: ${(rebuildRes.stderr || rebuildRes.stdout || "").slice(0, 800)}\x1b[0m`);
    }
  }

  log(`\x1b[1;32m✔ GIT POST-COMMIT SYNC COMPLETE (${commitHash}): GitHub push ${githubPushOk ? "OK" : "FAILED"}, mirrored ${syncedCount}/${files.length} file(s) to VPS.\x1b[0m\n`);
  if (!githubPushOk) {
    log("\x1b[33m  Run Push_To_GitHub.bat by hand to retry sending this commit to GitHub.\x1b[0m\n");
  }

  // NOTE: the sync log is intentionally NOT auto-committed here. A `git commit` run from
  // inside a post-commit hook re-triggers this same hook for its own new commit -- an
  // infinite loop. The log rides along naturally on your NEXT real commit instead
  // (it's already an untracked/modified file at that point), or run `git add` + commit
  // on it yourself whenever you want the audit trail checkpointed.
}

runPostCommitSync().catch((e) => {
  console.error("Git post-commit sync failed:", e);
});
