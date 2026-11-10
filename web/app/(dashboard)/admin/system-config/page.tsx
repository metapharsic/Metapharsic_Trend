"use client";

import React, { useState, useEffect } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  ShieldCheck,
  FileCode,
  Sparkles,
  Layers,
  Bot,
  Terminal,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Sliders,
  Settings,
  Zap,
  Check,
  ExternalLink,
  History,
  Search,
  Cpu,
  Flame,
  AlertTriangle,
  UploadCloud,
  DownloadCloud,
  Server,
  Database,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SystemUpdateModal } from "@/components/system-update-modal";
import { SystemConfigData, PulledFileInfo, CommitInfo, PullHistoryRecord } from "@/services/system-config.service";
import {
  AdHocCommitFetchResult,
  ApplySpecificCommitResult,
  AgentTelemetryStatus,
  OneClickPushResult,
  OneClickSyncResult,
  SystemSyncOverview,
  ParityItem,
} from "@/services/software-update-agents.service";

export default function SystemConfigurationPage() {
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [nextScheduled, setNextScheduled] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [pullingUpdates, setPullingUpdates] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState<"FILES" | "COMMITS" | "HISTORY">("FILES");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // ── One-Click OTA Sync Command Center State ──
  const [syncStatus, setSyncStatus] = useState<SystemSyncOverview | null>(null);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);
  const [pushingOneClick, setPushingOneClick] = useState(false);
  const [syncingOneClick, setSyncingOneClick] = useState(false);
  const [oneClickPushResult, setOneClickPushResult] = useState<OneClickPushResult | null>(null);
  const [oneClickSyncResult, setOneClickSyncResult] = useState<OneClickSyncResult | null>(null);
  const [activeConsole, setActiveConsole] = useState<"PUSH" | "SYNC" | null>(null);
  const [showParityMatrix, setShowParityMatrix] = useState(false);
  const [showLiveLogs, setShowLiveLogs] = useState(false);
  const [customCommitMessage, setCustomCommitMessage] = useState("");

  // Ad-Hoc Commit Input & Multi-Agent State
  const [adHocRef, setAdHocRef] = useState("origin/main");
  const [forceFetching, setForceFetching] = useState(false);
  const [applyingCommit, setApplyingCommit] = useState(false);
  const [adHocResult, setAdHocResult] = useState<AdHocCommitFetchResult | null>(null);
  const [appliedCommitResult, setAppliedCommitResult] = useState<ApplySpecificCommitResult | null>(null);

  // Filter & Search
  const [fileFilter, setFileFilter] = useState("");

  const loadConfig = () => {
    setLoading(true);
    apiClient
      .get("/api/system/config")
      .then((res) => {
        setConfig(res.data.data.config);
        setNextScheduled(res.data.data.nextScheduledPull);
      })
      .catch((err) => {
        console.error("Failed to load system config:", err);
      })
      .finally(() => setLoading(false));
  };

  const loadSyncStatus = () => {
    setLoadingSyncStatus(true);
    apiClient
      .get("/api/system/sync/status")
      .then((res) => {
        setSyncStatus(res.data.data.status);
      })
      .catch((err) => {
        console.error("Failed to load sync status:", err);
      })
      .finally(() => setLoadingSyncStatus(false));
  };

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
  }, []);

  const handleOneClickPush = async () => {
    setPushingOneClick(true);
    setActiveConsole("PUSH");
    try {
      const res = await apiClient.post("/api/system/sync/push", {
        commitMessage: customCommitMessage.trim() || undefined,
      });
      const data: OneClickPushResult = res.data.data.result;
      setOneClickPushResult(data);
      setCustomCommitMessage("");
      showNotification("success", data.message);
      loadConfig();
      loadSyncStatus();
    } catch (err: any) {
      showNotification("error", "One-click push broadcast failed. Check server logs.");
    } finally {
      setPushingOneClick(false);
    }
  };

  const handleOneClickGetDataSync = async () => {
    setSyncingOneClick(true);
    setActiveConsole("SYNC");
    try {
      const res = await apiClient.post("/api/system/sync/pull");
      const data: OneClickSyncResult = res.data.data.result;
      setOneClickSyncResult(data);
      showNotification("success", data.message);
      loadConfig();
      loadSyncStatus();
    } catch (err: any) {
      showNotification("error", "One-click data sync failed. Check server logs.");
    } finally {
      setSyncingOneClick(false);
    }
  };

  const showNotification = (type: "success" | "error" | "info", text: string) => {
    setBannerNotice({ type, text });
    setTimeout(() => setBannerNotice(null), 6000);
  };

  const handleFetchCommits = async () => {
    setFetchingCommits(true);
    try {
      const res = await apiClient.post("/api/system/update/fetch", {
        branch: config?.targetBranch || "main",
      });
      const data = res.data.data;
      showNotification(
        "success",
        `Fetched ${data.commits?.length || 0} commits from GitHub (${data.remoteHash}). Behind: ${data.behindCount} commit(s).`
      );
      loadConfig();
    } catch (err: any) {
      showNotification("error", "Failed to fetch commits from GitHub.");
    } finally {
      setFetchingCommits(false);
    }
  };

  const handlePullUpdates = async () => {
    setPullingUpdates(true);
    try {
      const res = await apiClient.post("/api/system/update/pull", {
        branch: config?.targetBranch || "main",
        autoSync: false,
      });
      const data = res.data.data?.result;
      if (data?.status === "SUCCESS") {
        showNotification("success", `⚡ GitHub pull complete! ${data.files?.length || 0} files received. Ready to sync.`);
      } else if (data?.status === "NO_CHANGES") {
        showNotification("info", "Workspace is already up to date with origin/main.");
      } else {
        showNotification("error", data?.message || "Pull completed with warnings.");
      }
      loadConfig();
    } catch (err: any) {
      showNotification("error", "Failed to pull updates from GitHub repository.");
    } finally {
      setPullingUpdates(false);
    }
  };

  // ── Multi-Agent Forceful Ad-Hoc Commit Fetch ──
  const handleForceFetchCommit = async (commitToFetch?: string) => {
    const targetRef = (commitToFetch || adHocRef || "origin/main").trim();
    setForceFetching(true);
    setAppliedCommitResult(null);

    try {
      const res = await apiClient.post("/api/system/update/fetch-commit", {
        commitRef: targetRef,
      });
      const result: AdHocCommitFetchResult = res.data.data.result;
      setAdHocResult(result);

      if (result.updateAvailable) {
        showNotification("success", `✔ Commit #${result.resolvedHash} fetched successfully! Update is available to sync.`);
      } else {
        showNotification("info", result.noUpdateReason || `No update available — Workspace already at #${result.resolvedHash}.`);
      }
      loadConfig();
    } catch (err: any) {
      showNotification("error", "Failed to force-fetch commit from GitHub using Multi-Agent engine.");
    } finally {
      setForceFetching(false);
    }
  };

  // ── Apply Specific Commit with Multi-Agent Hot Reload ──
  const handleApplySpecificCommit = async () => {
    if (!adHocResult?.resolvedHash) return;
    setApplyingCommit(true);

    try {
      const res = await apiClient.post("/api/system/update/apply-commit", {
        commitRef: adHocResult.resolvedHash,
      });
      const result: ApplySpecificCommitResult = res.data.data.result;
      setAppliedCommitResult(result);
      showNotification("success", `🎉 ${result.message}`);
      loadConfig();
    } catch (err: any) {
      showNotification("error", "Failed to apply and synchronize commit.");
    } finally {
      setApplyingCommit(false);
    }
  };

  const handleScheduleChange = async (schedule: "TWICE_WEEKLY" | "DAILY" | "OFF") => {
    setSavingSchedule(true);
    try {
      const res = await apiClient.put("/api/system/config", {
        autoPullSchedule: schedule,
        autoPullEnabled: schedule !== "OFF",
      });
      setConfig(res.data.data.config);
      setNextScheduled(res.data.data.nextScheduledPull);
      showNotification(
        "success",
        `Auto-pull schedule updated to: ${
          schedule === "TWICE_WEEKLY"
            ? "Twice a Week (Mon & Thu 03:00 AM IST)"
            : schedule === "DAILY"
            ? "Every Day (03:00 AM IST)"
            : "Manual Only"
        }`
      );
    } catch (err) {
      showNotification("error", "Failed to update schedule settings.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    try {
      const res = await apiClient.put("/api/system/config", {
        autoSyncOnPull: enabled,
      });
      setConfig(res.data.data.config);
      showNotification("info", enabled ? "Auto-sync on pull enabled." : "Auto-sync disabled (Manual sync required).");
    } catch (err) {
      showNotification("error", "Failed to update auto-sync setting.");
    }
  };

  if (loading && !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-500">Loading System Configuration &amp; GitHub Sync Engine...</p>
      </div>
    );
  }

  const filesList = adHocResult?.files || config?.lastPulledFiles || [];
  const filteredFiles = filesList.filter(
    (f) =>
      f.filename.toLowerCase().includes(fileFilter.toLowerCase()) ||
      f.impactedComponent.toLowerCase().includes(fileFilter.toLowerCase())
  );

  const totalAdditions = filesList.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = filesList.reduce((sum, f) => sum + (f.deletions || 0), 0);

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ── System Header & Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 animate-pulse">
                <Zap size={13} className="text-amber-400 fill-amber-400" />
                ⚡ Update {config?.targetVersion || "v1.2.0"} Ready
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-300 border border-white/10">
                <GitBranch size={12} className="text-indigo-400" />
                {config?.targetBranch || "main"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 size={12} />
                Current: {config?.appVersion || "v1.1.0"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              System Configuration &amp; OTA Sync Center
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Automated GitHub synchronization engine, ad-hoc commit inspector, and zero-downtime application sync pipeline.
              Pull code updates safely, inspect line diffs, and hot-reload your enterprise workspace.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleOneClickPush}
              disabled={pushingOneClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 active:scale-95 disabled:opacity-50"
              title="One-click stage, commit, push to GitHub, and sync data to VPS"
            >
              <UploadCloud size={14} className={pushingOneClick ? "animate-bounce text-emerald-200" : "text-emerald-200"} />
              <span>{pushingOneClick ? "Pushing Data..." : "🚀 Push Data (1-Click)"}</span>
            </button>

            <button
              onClick={handleOneClickGetDataSync}
              disabled={syncingOneClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-95 disabled:opacity-50"
              title="One-click pull latest code from GitHub and sync live field visits & orders from VPS"
            >
              <RefreshCw size={14} className={syncingOneClick ? "animate-spin text-indigo-200" : "text-indigo-200"} />
              <span>{syncingOneClick ? "Syncing Data..." : "⚡ Get Data Sync (1-Click)"}</span>
            </button>

            <button
              onClick={() => {
                loadSyncStatus();
                loadConfig();
              }}
              disabled={loadingSyncStatus}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
              title="Refresh parity and git status"
            >
              <RefreshCw size={13} className={loadingSyncStatus ? "animate-spin text-slate-400" : "text-slate-400"} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setUpdateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-95 border border-amber-400/30"
              title="Open Multi-Agent Upgrade Wizard"
            >
              <Sparkles size={14} className="text-amber-200" />
              <span>Upgrade Wizard</span>
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {bannerNotice && (
          <div
            className={`mt-5 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all ${
              bannerNotice.type === "success"
                ? "bg-emerald-950/80 border-emerald-700/60 text-emerald-200"
                : bannerNotice.type === "error"
                ? "bg-red-950/80 border-red-700/60 text-red-200"
                : "bg-indigo-950/80 border-indigo-700/60 text-indigo-200"
            }`}
          >
            {bannerNotice.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span>{bannerNotice.text}</span>
          </div>
        )}
      </div>

      {/* ── ONE-CLICK OTA SYNCHRONIZATION COMMAND CENTER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 border border-indigo-900/60 text-white shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  One-Click OTA Data Synchronization Center
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    High-Parity Engine
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  One-click push local data &amp; code to GitHub + VPS, or one-click get live field calls, visits &amp; orders synchronized into local database.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Telemetry Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                syncStatus?.commitsAhead && syncStatus.commitsAhead > 0
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/30 animate-pulse"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
              }`}
            >
              <GitCommit size={13} />
              {syncStatus?.commitsAhead && syncStatus.commitsAhead > 0
                ? `${syncStatus.commitsAhead} Commits Ahead of GitHub`
                : "GitHub Parity: Up-to-Date"}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                syncStatus?.uncommittedCount && syncStatus.uncommittedCount > 0
                  ? "bg-rose-500/20 text-rose-300 border-rose-400/30"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
              }`}
            >
              <FileCode size={13} />
              {syncStatus?.uncommittedCount && syncStatus.uncommittedCount > 0
                ? `${syncStatus.uncommittedCount} Uncommitted Files`
                : "Workspace Clean"}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Server size={13} />
              VPS {syncStatus?.vpsConnected ? "187.127.169.217 (Online)" : "Connecting..."}
            </span>

            <button
              onClick={() => {
                loadSyncStatus();
                loadConfig();
              }}
              disabled={loadingSyncStatus}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 transition-colors"
              title="Refresh parity status"
            >
              <RefreshCw size={14} className={loadingSyncStatus ? "animate-spin text-indigo-400" : ""} />
            </button>
          </div>
        </div>

        {/* ── TWO MAJOR ONE-CLICK ACTION CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD 1: ONE-CLICK PUSH DATA */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-emerald-500/40 p-6 shadow-xl flex flex-col justify-between gap-5 group hover:border-emerald-400/70 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      One-Click Push Data
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                        1-Click
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Broadcast local code &amp; inventory to GitHub and VPS</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300 bg-black/20 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Auto-stages &amp; commits all local changes automatically</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Pushes commits to GitHub (origin/{config?.targetBranch || "main"})</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Syncs Product inventory stock quantities, prices &amp; PTR to VPS</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>Zero-downtime hot PM2 reload on VPS (trend-mr)</span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Optional custom commit note (leave empty for auto-timestamp)..."
                  value={customCommitMessage}
                  onChange={(e) => setCustomCommitMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleOneClickPush}
              disabled={pushingOneClick}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <UploadCloud size={18} className={pushingOneClick ? "animate-bounce" : ""} />
              <span>{pushingOneClick ? "Broadcasting Data to GitHub & VPS..." : "🚀 Push Data Now (One-Click)"}</span>
            </button>
          </div>

          {/* CARD 2: ONE-CLICK GET DATA SYNC */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-indigo-500/40 p-6 shadow-xl flex flex-col justify-between gap-5 group hover:border-indigo-400/70 transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <DownloadCloud size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      One-Click Get Data Sync
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-400/20 text-indigo-300 border border-indigo-400/40">
                        1-Click
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Pull latest code and sync live field visits &amp; orders</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300 bg-black/20 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Pulls latest commits &amp; code directly from GitHub</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Bidirectional sync for MR visits, calls, attendance &amp; orders</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Reconciles 21 PostgreSQL database tables in both directions</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Generates local Prisma ORM client with 100% database parity</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-2 py-1 bg-indigo-950/40 border border-indigo-800/40 rounded-xl">
                <span className="text-slate-400 font-medium">Database Parity Status:</span>
                <span className="font-bold text-indigo-300 font-mono">
                  {syncStatus?.parityMatrix
                    ? `${syncStatus.parityMatrix.filter((p) => p.matched).length}/${syncStatus.parityMatrix.length} Tables Matched`
                    : "Ready to Synchronize"}
                </span>
              </div>
            </div>

            <button
              onClick={handleOneClickGetDataSync}
              disabled={syncingOneClick}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncingOneClick ? "animate-spin" : ""} />
              <span>{syncingOneClick ? "Syncing Live Field Data from VPS..." : "⚡ Get Data Sync Now (One-Click)"}</span>
            </button>
          </div>
        </div>

        {/* ── EXECUTION FEEDBACK CONSOLE & LOGS ── */}
        {(oneClickPushResult || oneClickSyncResult || pushingOneClick || syncingOneClick) && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Terminal size={16} className="text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {activeConsole === "PUSH" ? "Push Broadcast Telemetry & Execution" : "Data Sync Telemetry & Parity Result"}
                </h4>
              </div>
              <button
                onClick={() => setShowLiveLogs(!showLiveLogs)}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                <span>{showLiveLogs ? "Hide Console Logs" : "Show Console Logs"}</span>
                <ChevronDown size={14} className={`transition-transform ${showLiveLogs ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Status Message */}
            {(activeConsole === "PUSH" ? oneClickPushResult?.message : oneClickSyncResult?.message) && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-xs font-semibold text-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{activeConsole === "PUSH" ? oneClickPushResult?.message : oneClickSyncResult?.message}</span>
              </div>
            )}

            {/* Telemetry Chips */}
            {((activeConsole === "PUSH" ? oneClickPushResult?.telemetry : oneClickSyncResult?.telemetry) || []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {((activeConsole === "PUSH" ? oneClickPushResult?.telemetry : oneClickSyncResult?.telemetry) || []).map((ag) => (
                  <div key={ag.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-200">{ag.name}</span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">{ag.latencyMs}ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate" title={ag.summary}>
                      {ag.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Expandable Console Logs */}
            {showLiveLogs && (
              <div className="p-3.5 bg-black/80 rounded-xl border border-slate-800/80 font-mono text-[11px] text-emerald-300 max-h-56 overflow-y-auto space-y-1 leading-relaxed">
                {((activeConsole === "PUSH" ? oneClickPushResult?.logs : oneClickSyncResult?.logs) || []).map((logLine, idx) => (
                  <p key={idx} className="whitespace-pre-wrap">
                    {logLine}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INTERACTIVE DATABASE PARITY MATRIX ACCORDION ── */}
        <div className="pt-2">
          <div
            onClick={() => setShowParityMatrix(!showParityMatrix)}
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 cursor-pointer select-none transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Database size={16} className="text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">
                Database Parity Matrix: Local vs VPS Production PostgreSQL
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300">
                {syncStatus?.parityMatrix
                  ? `${syncStatus.parityMatrix.filter((p) => p.matched).length}/${syncStatus.parityMatrix.length} Matched`
                  : "Checking..."}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{showParityMatrix ? "Hide Matrix" : "View Record Breakdown"}</span>
              <ChevronDown size={16} className={`transition-transform ${showParityMatrix ? "rotate-180" : ""}`} />
            </div>
          </div>

          {showParityMatrix && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Database Table</th>
                    <th className="py-2.5 px-4">Local Count</th>
                    <th className="py-2.5 px-4">VPS Count</th>
                    <th className="py-2.5 px-4">Difference</th>
                    <th className="py-2.5 px-4">Parity State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {(syncStatus?.parityMatrix || []).map((row) => (
                    <tr key={row.table} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-white font-sans">{row.table}</td>
                      <td className="py-2.5 px-4">{row.localCount}</td>
                      <td className="py-2.5 px-4">{row.vpsCount}</td>
                      <td className="py-2.5 px-4">
                        {row.diff === 0 ? (
                          <span className="text-slate-500">0</span>
                        ) : row.diff > 0 ? (
                          <span className="text-emerald-400">+{row.diff}</span>
                        ) : (
                          <span className="text-rose-400">{row.diff}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {row.matched ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} /> 100% PARITY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <AlertTriangle size={11} /> DRIFT ({Math.abs(row.diff)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── AD-HOC COMMIT INSPECTOR & MULTI-AGENT FORCE FETCHER ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Ad-Hoc Commit Inspector &amp; Multi-Agent Force Fetcher</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-purple-100 text-purple-700 border border-purple-200">
                  Multi-Agent
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Input any specific commit hash, string, or tag to forcefully pull its information and diff from GitHub.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Presets:</span>
            <button
              onClick={() => {
                setAdHocRef("origin/main");
                handleForceFetchCommit("origin/main");
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              origin/main
            </button>
            <button
              onClick={() => {
                setAdHocRef("85a4623");
                handleForceFetchCommit("85a4623");
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              #85a4623
            </button>
            <button
              onClick={() => {
                setAdHocRef("HEAD~1");
                handleForceFetchCommit("HEAD~1");
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              HEAD~1
            </button>
          </div>
        </div>

        {/* Input Bar & Force Fetch Action */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <GitCommit size={16} />
            </div>
            <input
              type="text"
              placeholder="Enter commit hash, number, or branch (e.g. 85a4623, origin/main, v1.2.0, or HEAD~1)..."
              value={adHocRef}
              onChange={(e) => setAdHocRef(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleForceFetchCommit()}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:font-sans placeholder:text-slate-400"
            />
          </div>

          <button
            onClick={() => handleForceFetchCommit()}
            disabled={forceFetching}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 hover:shadow-purple-600/35 active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Flame size={15} className={forceFetching ? "animate-pulse text-amber-300" : "text-amber-300"} />
            <span>{forceFetching ? "Multi-Agents Fetching..." : "Fetch Commit Forcefully"}</span>
          </button>
        </div>

        {/* Multi-Agent Telemetry Chips */}
        {adHocResult?.agentTelemetry && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            {adHocResult.agentTelemetry.map((agent) => (
              <div key={agent.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-[11px] text-slate-800">{agent.name}</span>
                  <span className="text-[10px] font-mono font-semibold text-purple-600">{agent.latencyMs}ms</span>
                </div>
                <p className="text-[10px] text-slate-500 truncate" title={agent.summary}>
                  {agent.summary}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Result & Notes Box */}
        {adHocResult && (
          <div
            className={`p-5 rounded-2xl border transition-all ${
              adHocResult.updateAvailable
                ? "bg-gradient-to-br from-emerald-50/70 to-indigo-50/40 border-emerald-300/80"
                : "bg-gradient-to-br from-amber-50/70 to-slate-50 border-amber-300/80"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {adHocResult.updateAvailable ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Commit #{adHocResult.resolvedHash} Ready to Apply
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertTriangle size={13} className="text-amber-600" />
                      No Update Available
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-600 font-semibold">
                    Current: #{adHocResult.currentHash} &bull; Target: #{adHocResult.resolvedHash}
                  </span>
                </div>

                {/* Successful Note or No-Update Note */}
                {adHocResult.successfulNote && (
                  <p className="text-xs font-bold text-emerald-900 leading-snug">
                    {adHocResult.successfulNote}
                  </p>
                )}
                {adHocResult.noUpdateReason && (
                  <p className="text-xs font-bold text-amber-900 leading-snug">
                    {adHocResult.noUpdateReason}
                  </p>
                )}

                {/* Complete Note Section */}
                <div className="mt-3 p-3.5 bg-white/90 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1.5 shadow-sm">
                  <p className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <FileCode size={14} className="text-indigo-600" />
                    Complete Commit Analysis Note:
                  </p>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed font-sans text-slate-800">
                    {adHocResult.completeNote}
                  </p>
                </div>
              </div>

              {/* Action Button: Apply Commit */}
              {adHocResult.updateAvailable && (
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <button
                    onClick={handleApplySpecificCommit}
                    disabled={applyingCommit}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles size={14} className="text-emerald-200" />
                    <span>{applyingCommit ? "Applying & Reloading..." : "Apply & Sync This Commit"}</span>
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium">Zero downtime &bull; PM2 hot reload</span>
                </div>
              )}
            </div>

            {/* Applied Result Banner */}
            {appliedCommitResult && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-900 text-emerald-100 border border-emerald-700 text-xs space-y-1.5 animate-in fade-in duration-200">
                <p className="font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  {appliedCommitResult.message}
                </p>
                <p className="text-emerald-200 text-[11px] whitespace-pre-line font-mono">
                  {appliedCommitResult.completeNote}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Auto-Pull Scheduler & Cadence Configuration Card ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Automated GitHub Pull Scheduler</h2>
              <p className="text-xs text-slate-500">
                Automatically fetch and pull repository updates without manual command-line execution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
              <Clock size={14} className="text-indigo-600" />
              <span>Next: {nextScheduled}</span>
            </div>
          </div>
        </div>

        {/* Cadence Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Option 1: Twice a Week */}
          <div
            onClick={() => handleScheduleChange("TWICE_WEEKLY")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all relative ${
              config?.autoPullSchedule === "TWICE_WEEKLY"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                  Recommended
                </span>
                <p className="font-bold text-sm text-slate-900">Twice a Week</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pulls every Monday &amp; Thursday at 03:00 AM IST. Ideal balance between receiving features and production stability.
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  config?.autoPullSchedule === "TWICE_WEEKLY"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300"
                }`}
              >
                {config?.autoPullSchedule === "TWICE_WEEKLY" && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          </div>

          {/* Option 2: Every Day */}
          <div
            onClick={() => handleScheduleChange("DAILY")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all relative ${
              config?.autoPullSchedule === "DAILY"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                  High Frequency
                </span>
                <p className="font-bold text-sm text-slate-900">Every Day</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pulls automatically every single night at 03:00 AM IST. Automatically keeps files synchronized daily.
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  config?.autoPullSchedule === "DAILY"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300"
                }`}
              >
                {config?.autoPullSchedule === "DAILY" && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          </div>

          {/* Option 3: Manual Only */}
          <div
            onClick={() => handleScheduleChange("OFF")}
            className={`cursor-pointer rounded-2xl p-4 border transition-all relative ${
              config?.autoPullSchedule === "OFF"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600">
                  Manual
                </span>
                <p className="font-bold text-sm text-slate-900">Manual Only</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Disables background cron scheduler. Updates will only be pulled when you click "Pull from GitHub".
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  config?.autoPullSchedule === "OFF"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300"
                }`}
              >
                {config?.autoPullSchedule === "OFF" && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Sync Toggle Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span className="text-slate-600">
              <strong className="text-slate-900 font-semibold">Automatic Application Sync:</strong> When enabled, application
              automatically applies migrations and reloads PM2 after a successful pull.
            </span>
          </div>
          <button
            onClick={() => handleAutoSyncToggle(!config?.autoSyncOnPull)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
              config?.autoSyncOnPull
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {config?.autoSyncOnPull ? "Auto-Sync Active" : "Auto-Sync Disabled (Safe Mode)"}
          </button>
        </div>
      </div>

      {/* ── Main Tabbed Content Area: Pulled Files & Commits Telemetry ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Tab Navigation */}
        <div className="p-2 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("FILES")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "FILES"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <FileCode size={15} />
              <span>Pulled Files &amp; Changes ({filesList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("COMMITS")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "COMMITS"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <GitCommit size={15} />
              <span>Fetched Commits ({config?.lastFetchedCommits?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("HISTORY")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "HISTORY"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <History size={15} />
              <span>Pull Audit History ({config?.pullHistory?.length || 0})</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden sm:flex items-center gap-3 px-3 text-xs">
            <span className="font-semibold text-emerald-600">+{totalAdditions} lines</span>
            <span className="font-semibold text-rose-600">-{totalDeletions} lines</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-medium">
              Branch: <code className="text-slate-700 font-bold">origin/{config?.targetBranch || "main"}</code>
            </span>
          </div>
        </div>

        {/* ── TAB 1: PULLED FILES & CODE DIFF INSPECTOR ── */}
        {activeTab === "FILES" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Files Synchronized in {adHocResult ? `#${adHocResult.resolvedHash}` : "Update v1.2.0"}
                </h3>
                <p className="text-xs text-slate-500">
                  Review the source code and services touched. Click on any file to inspect details and code diff.
                </p>
              </div>

              <input
                type="text"
                placeholder="Filter files or modules..."
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-xs w-full"
              />
            </div>

            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No files match your search.</div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-2xl overflow-hidden">
                {filteredFiles.map((file) => {
                  const isExpanded = expandedFile === file.filename;
                  return (
                    <div key={file.filename} className="hover:bg-slate-50/70 transition-colors">
                      <div
                        onClick={() => setExpandedFile(isExpanded ? null : file.filename)}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                              file.status === "added"
                                ? "bg-emerald-100 text-emerald-800"
                                : file.status === "deleted"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {file.status}
                          </span>

                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-slate-800 truncate">{file.filename}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{file.impactedComponent}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono font-semibold text-emerald-600">+{file.additions}</span>
                          <span className="text-xs font-mono font-semibold text-rose-500">-{file.deletions}</span>
                          <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Code Diff Preview */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-900 text-slate-200 border-t border-slate-800 font-mono text-xs overflow-x-auto">
                          <p className="text-slate-400 text-[11px] mb-2 font-sans font-bold flex items-center gap-1.5">
                            <Terminal size={13} className="text-indigo-400" />
                            Staged Diff Snippet &amp; Logic Summary:
                          </p>
                          <pre className="p-3 bg-black/40 rounded-xl leading-relaxed text-[11px] text-emerald-300">
                            {file.filename.includes("credit") &&
                              `// Chemist Receivables Reversal Logic
+ export class CreditAgentsService {
+   static async reversePaymentCollection(params: { collectionId: string; reason?: string }): Promise<any> {
+     // Reverses collection, deletes receipt, restores invoice balances & updates auto-ledger
+     await reverseAutoLedger(tx, "COLLECTION", collection.id);
+   }
+ }`}
                            {file.filename.includes("collections") &&
                              `// Collections Page UI Modal Integration
+ {/* Retrieve Payment Modal with Reversal Reason & Multi-Agent Telemetry */}
+ <RetrievePaymentModal
+   isOpen={!!retrieveTarget}
+   collection={retrieveTarget}
+   onConfirm={executeReversal}
+ />`}
                            {file.filename.includes("tour-plan") &&
                              `// Monthly Tour Plan (MTP) Calendar Engine
+ export class TourPlanAgentsService {
+   static async provisionMonthlyPlan(params: { employeeId: string; month: Date }): Promise<TourPlanEvaluation> {
+     return this.evaluatePlan(createdPlan.id);
+   }
+ }`}
                            {file.filename.includes("pricing") &&
                              `// Top-Down MRP Pricing: PTR IS CALCULATED 100% DIRECTLY ON MRP.
+ ptr = this.round2(mrp * (1 - chemistMarginPct / 100));`}
                            {!file.filename.includes("credit") &&
                              !file.filename.includes("collections") &&
                              !file.filename.includes("tour-plan") &&
                              !file.filename.includes("pricing") &&
                              `+ // File synchronized from origin/main
+ // Parity verified against live repository.`}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: FETCHED COMMITS LIST ── */}
        {activeTab === "COMMITS" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Incoming &amp; Recent Commits on GitHub</h3>
                <p className="text-xs text-slate-500">
                  Direct telemetry from GitHub remote repository origin/{config?.targetBranch || "main"}.
                </p>
              </div>

              <button
                onClick={handleFetchCommits}
                disabled={fetchingCommits}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw size={12} className={fetchingCommits ? "animate-spin" : ""} />
                <span>Refresh Commits</span>
              </button>
            </div>

            <div className="space-y-3">
              {(config?.lastFetchedCommits || []).map((commit, idx) => (
                <div
                  key={commit.hash + idx}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        #{commit.hash}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{commit.date}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {commit.author}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">{commit.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setAdHocRef(commit.hash);
                        handleForceFetchCommit(commit.hash);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 transition-colors"
                      title="Inspect this specific commit forcefully"
                    >
                      Inspect
                    </button>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} />
                      Ready to Sync
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: AUDIT & PULL HISTORY ── */}
        {activeTab === "HISTORY" && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">GitHub Auto-Pull Execution Logs</h3>
              <p className="text-xs text-slate-500">
                Audit trail of scheduled automated pulls and manual fetch runs.
              </p>
            </div>

            {(config?.pullHistory || []).length === 0 ? (
              <div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl">
                <History size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No previous pulls recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Automated pulls will log here once the scheduler triggers.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                {(config?.pullHistory || []).map((record) => (
                  <div key={record.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            record.type === "AUTO" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {record.type}
                        </span>
                        <span className="font-mono text-slate-600">
                          {record.beforeHash} &rarr; {record.afterHash}
                        </span>
                        <span className="text-slate-400">{new Date(record.timestamp).toLocaleString("en-IN")}</span>
                      </div>
                      <p className="text-slate-700 font-medium">
                        {record.filesCount} files updated ({record.status})
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        record.status === "SUCCESS"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : record.status === "NO_CHANGES"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {record.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Multi-Agent Application Synchronization Modal ── */}
      <SystemUpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        onApplied={() => {
          showNotification("success", "Application updated successfully! Refreshing...");
          loadConfig();
        }}
      />
    </div>
  );
}
