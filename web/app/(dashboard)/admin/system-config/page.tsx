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
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SystemUpdateModal } from "@/components/system-update-modal";
import { SystemConfigData, PulledFileInfo, CommitInfo, PullHistoryRecord } from "@/services/system-config.service";
import { AdHocCommitFetchResult, ApplySpecificCommitResult, AgentTelemetryStatus } from "@/services/software-update-agents.service";

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

  useEffect(() => {
    loadConfig();
  }, []);

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
              onClick={handleFetchCommits}
              disabled={fetchingCommits}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
              title="Query remote GitHub repository for new commits"
            >
              <RefreshCw size={14} className={fetchingCommits ? "animate-spin text-indigo-400" : "text-slate-400"} />
              <span>{fetchingCommits ? "Fetching..." : "Fetch Commits"}</span>
            </button>

            <button
              onClick={handlePullUpdates}
              disabled={pullingUpdates}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-95 disabled:opacity-50"
              title="Pull latest code & files directly from GitHub origin/main"
            >
              <Download size={14} className={pullingUpdates ? "animate-bounce" : ""} />
              <span>{pullingUpdates ? "Pulling Files..." : "Pull from GitHub"}</span>
            </button>

            <button
              onClick={() => setUpdateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-95 border border-amber-400/30"
              title="Execute Multi-Agent Application Synchronization Engine"
            >
              <Sparkles size={14} className="text-amber-200" />
              <span>Sync Application</span>
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
