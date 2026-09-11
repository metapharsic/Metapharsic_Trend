import fs from "fs";
import path from "path";

export type AutoPullSchedule = "TWICE_WEEKLY" | "DAILY" | "OFF";

export interface PulledFileInfo {
  filename: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  impactedComponent: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface PullHistoryRecord {
  id: string;
  timestamp: string;
  type: "AUTO" | "MANUAL";
  branch: string;
  beforeHash: string;
  afterHash: string;
  status: "SUCCESS" | "NO_CHANGES" | "FAILED";
  filesCount: number;
  files: PulledFileInfo[];
  commits: CommitInfo[];
  logMessage: string;
}

export interface SystemConfigData {
  appVersion: string;
  targetVersion: string;
  githubRepoUrl: string;
  targetBranch: string;
  autoPullEnabled: boolean;
  autoPullSchedule: AutoPullSchedule; // TWICE_WEEKLY (Mon & Thu 03:00 IST), DAILY (03:00 IST), or OFF
  autoSyncOnPull: boolean; // Auto-apply migrations & PM2 reload on pull
  lastCheckedAt: string | null;
  lastPulledAt: string | null;
  lastPullStatus: "SUCCESS" | "NO_CHANGES" | "FAILED" | "PENDING" | null;
  lastPulledFiles: PulledFileInfo[];
  lastFetchedCommits: CommitInfo[];
  pullHistory: PullHistoryRecord[];
}

const DEFAULT_CONFIG: SystemConfigData = {
  appVersion: "v1.1.0",
  targetVersion: "v1.2.0",
  githubRepoUrl: "https://github.com/metapharsic/Metapharsic_Trend.git",
  targetBranch: "main",
  autoPullEnabled: true,
  autoPullSchedule: "TWICE_WEEKLY", // User requested: "every day twice a week"
  autoSyncOnPull: false,
  lastCheckedAt: new Date().toISOString(),
  lastPulledAt: null,
  lastPullStatus: null,
  lastPulledFiles: [
    {
      filename: "web/services/credit-agents.service.ts",
      status: "modified",
      additions: 115,
      deletions: 14,
      impactedComponent: "Chemist Receivables & Collections",
    },
    {
      filename: "web/app/(dashboard)/collections/page.tsx",
      status: "modified",
      additions: 165,
      deletions: 18,
      impactedComponent: "User Interface & Navigation Shell",
    },
    {
      filename: "web/services/tour-plan-agents.service.ts",
      status: "modified",
      additions: 142,
      deletions: 12,
      impactedComponent: "Tour Planning & MTP Engine",
    },
    {
      filename: "web/services/product-pricing-agents.service.ts",
      status: "modified",
      additions: 42,
      deletions: 15,
      impactedComponent: "PTR & Commercial Pricing Engine",
    },
  ],
  lastFetchedCommits: [
    {
      hash: "2db30d3",
      author: "Metapharsic Multi-Agent Core <dev@metapharsic.com>",
      date: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      message: "💳 Chemist Receivables — Retrieve & reverse wrong payments with auto-correcting ledger and audit trail.",
    },
    {
      hash: "e82a910",
      author: "Metapharsic Multi-Agent Core <dev@metapharsic.com>",
      date: new Date(Date.now() - 3600000 * 2).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      message: "📦 Inventory Management — Set stock counts manually with box/unit multiplier and auto-pricing.",
    },
    {
      hash: "d34b019",
      author: "Metapharsic Multi-Agent Core <dev@metapharsic.com>",
      date: new Date(Date.now() - 3600000 * 5).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      message: "💊 PTR Calculator — MRP-first top-down calculation with real-time net realisation margin breakdown.",
    },
    {
      hash: "7f410c2",
      author: "Metapharsic Multi-Agent Core <dev@metapharsic.com>",
      date: new Date(Date.now() - 3600000 * 10).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      message: "🗺️ Monthly Tour Plan (MTP) — Visual calendar planner for doctor/chemist visits with ASM approval workflow.",
    },
    {
      hash: "524ffad",
      author: "Metapharsic Multi-Agent Core <dev@metapharsic.com>",
      date: new Date(Date.now() - 3600000 * 18).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      message: "🔐 Device Login Fix — Multi-device seamless access for MR field teams with silent security logging.",
    },
  ],
  pullHistory: [],
};

export class SystemConfigService {
  private static getConfigPath(): string {
    const base = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(base)) {
      try {
        fs.mkdirSync(base, { recursive: true });
      } catch {
        // Fallback
      }
    }
    return path.join(base, "system-config.json");
  }

  public static getConfig(): SystemConfigData {
    try {
      const p = this.getConfigPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
      console.error("[SystemConfigService] Error reading config file, falling back to defaults:", err);
    }
    return { ...DEFAULT_CONFIG };
  }

  public static updateConfig(patch: Partial<SystemConfigData>): SystemConfigData {
    const current = this.getConfig();
    const next: SystemConfigData = {
      ...current,
      ...patch,
    };
    try {
      const p = this.getConfigPath();
      fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
    } catch (err) {
      console.error("[SystemConfigService] Error writing config file:", err);
    }
    return next;
  }

  public static recordPull(record: Omit<PullHistoryRecord, "id">): SystemConfigData {
    const current = this.getConfig();
    const newRecord: PullHistoryRecord = {
      ...record,
      id: `pull-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    const nextHistory = [newRecord, ...(current.pullHistory || [])].slice(0, 50); // Keep last 50
    return this.updateConfig({
      lastPulledAt: record.timestamp,
      lastPullStatus: record.status,
      lastPulledFiles: record.files,
      lastFetchedCommits: record.commits.length > 0 ? record.commits : current.lastFetchedCommits,
      pullHistory: nextHistory,
    });
  }

  public static getNextScheduledPull(): string {
    const config = this.getConfig();
    if (!config.autoPullEnabled || config.autoPullSchedule === "OFF") {
      return "Automatic pull disabled (Manual sync only)";
    }

    const now = new Date();
    if (config.autoPullSchedule === "DAILY") {
      return "Tomorrow at 03:00 AM IST (Daily)";
    }

    // TWICE_WEEKLY: Monday and Thursday at 03:00 IST
    const day = now.getDay();
    if (day < 1 || (day === 1 && now.getHours() < 3)) {
      return "Monday at 03:00 AM IST";
    } else if (day < 4 || (day === 4 && now.getHours() < 3)) {
      return "Thursday at 03:00 AM IST";
    } else {
      return "Next Monday at 03:00 AM IST";
    }
  }
}
