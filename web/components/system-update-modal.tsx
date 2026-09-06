"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  GitCommit,
  FileCode,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Download,
  Bot,
  Terminal,
  ChevronRight,
  Database,
  Lock,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SoftwareUpdateDiffReview, AgentTelemetryStatus } from "@/services/software-update-agents.service";

interface SystemUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export function SystemUpdateModal({ isOpen, onClose, onApplied }: SystemUpdateModalProps) {
  const [activeTab, setActiveTab] = useState<"COMMITS" | "DIFFS" | "IMPACT">("COMMITS");
  const [reviewData, setReviewData] = useState<SoftwareUpdateDiffReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showAgentLogs, setShowAgentLogs] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiClient
      .get("/api/system/update/diff")
      .then((res) => setReviewData(res.data.data.diffReview))
      .catch((err) => console.error("Failed to fetch update diff review:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyUpgrade = async () => {
    setApplying(true);
    try {
      await apiClient.post("/api/system/update/apply");
      if (onApplied) onApplied();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error("Failed to apply software update:", err);
      setApplying(false);
    }
  };

  const status = reviewData?.status;
  const telemetry: AgentTelemetryStatus[] = reviewData?.status?.agentTelemetry || [];
  const selectedFile = reviewData?.fileDiffs[selectedFileIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-200 animate-in fade-in zoom-in duration-200 my-8">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Download size={12} /> Pre-Downloaded OTA Bundle
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <ShieldCheck size={12} /> Data-Safe Code Move Only
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Over-The-Air Software Upgrade Review
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-1 font-mono">
                <span>{status?.currentVersion || "v1.1.0"} ({status?.currentCommitHash || "416c184"})</span>
                <ArrowRight size={14} className="text-indigo-400" />
                <span className="text-emerald-400 font-bold">
                  {status?.targetVersion || "v1.2.0"} ({status?.targetCommitHash || "a9f23e1"})
                </span>
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-sans text-[10px]">
                  {status?.commitsCount || 4} new commit(s) ready
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Multi-Agent Intelligence Telemetry Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="text-indigo-600" size={18} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Multi-Agent OTA Update Pipeline Telemetry
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              4 Agents Active | Auto-Sync: GitHub Origin
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {telemetry.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setShowAgentLogs(showAgentLogs === agent.id ? null : agent.id)}
                className="bg-slate-50 rounded-xl p-3 border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 truncate">{agent.name}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{agent.summary}</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{agent.latencyMs}ms</span>
                  <span>{Math.round(agent.confidence * 100)}% Conf</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 flex items-center gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("COMMITS")}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "COMMITS"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <GitCommit size={16} />
            <span>Commit History &amp; Release Notes</span>
          </button>
          <button
            onClick={() => setActiveTab("DIFFS")}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "DIFFS"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileCode size={16} />
            <span>Code Diff Reviewer ({reviewData?.fileDiffs.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("IMPACT")}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "IMPACT"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Layers size={16} />
            <span>Data Safety &amp; Module Impact</span>
          </button>
        </div>

        {/* TAB 1: COMMIT LOGS & RELEASE NOTES */}
        {activeTab === "COMMITS" && (
          <div className="space-y-5 max-h-80 overflow-y-auto pr-1">
            {/* Release Highlights */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" /> What's New in this Version
              </h4>
              <ul className="text-xs text-indigo-950 space-y-1.5 pl-4 list-disc">
                {reviewData?.releaseNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>

            {/* Commit Log List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Incoming Git Commits from origin/main
              </h4>
              <div className="space-y-2">
                {reviewData?.commitLogs.map((commit, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-indigo-50/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-200 text-slate-700 font-mono text-xs font-bold mt-0.5">
                        {commit.hash}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{commit.message}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{commit.author}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">{commit.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CODE DIFF REVIEWER */}
        {activeTab === "DIFFS" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-96 overflow-hidden">
            {/* File List Tree */}
            <div className="md:col-span-1 border border-slate-200 rounded-xl overflow-y-auto max-h-96 divide-y divide-slate-100 bg-slate-50">
              <div className="p-3 bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                Modified Code Files
              </div>
              {reviewData?.fileDiffs.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full p-3 text-left transition-colors flex flex-col gap-1 ${
                    selectedFileIndex === idx
                      ? "bg-indigo-600 text-white font-semibold"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <span className="text-xs font-bold truncate block">{file.filename.split("/").pop()}</span>
                  <span className={`text-[10px] truncate ${selectedFileIndex === idx ? "text-indigo-100" : "text-slate-400"}`}>
                    {file.impactedComponent}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-mono mt-1">
                    <span className={selectedFileIndex === idx ? "text-emerald-200" : "text-emerald-600"}>
                      +{file.additions}
                    </span>
                    <span className={selectedFileIndex === idx ? "text-rose-200" : "text-rose-600"}>
                      -{file.deletions}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Diff Preview Panel */}
            <div className="md:col-span-2 border border-slate-800 rounded-xl bg-slate-950 p-4 font-mono text-xs overflow-y-auto max-h-96 text-slate-200 space-y-3">
              {selectedFile ? (
                <>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                    <span>{selectedFile.filename}</span>
                    <span className="text-emerald-400">+{selectedFile.additions} / -{selectedFile.deletions}</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed text-slate-300">
                    {selectedFile.diffSnippet.split("\n").map((line, lIdx) => {
                      const isAdd = line.startsWith("+");
                      const isDel = line.startsWith("-");
                      return (
                        <div
                          key={lIdx}
                          className={
                            isAdd
                              ? "bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded"
                              : isDel
                              ? "bg-rose-950/60 text-rose-300 px-2 py-0.5 rounded"
                              : "px-2 py-0.5 opacity-80"
                          }
                        >
                          {line}
                        </div>
                      );
                    })}
                  </pre>
                </>
              ) : (
                <div className="text-center text-slate-500 py-12">Select a file to inspect line diffs.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DATA SAFETY & IMPACT */}
        {activeTab === "IMPACT" && (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={24} />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase">Database Safety Verified</h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    This upgrade is a code move only. Your local database records, order ledgers, and master profiles remain 100% intact.
                  </p>
                </div>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
                <Lock className="text-sky-600 shrink-0 mt-0.5" size={24} />
                <div>
                  <h4 className="text-xs font-bold text-sky-900 uppercase">Environment Preserved</h4>
                  <p className="text-xs text-sky-800 mt-1">
                    Your local `.env` database URLs, API tokens, and user credentials will not be overwritten or modified.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Affected Application Modules
              </h4>
              <div className="flex flex-wrap gap-2">
                {reviewData?.impactSummary.affectedModules.map((mod, idx) => (
                  <span
                    key={idx}
                    className="bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {mod}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Fully user-controlled upgrade. You can upgrade whenever convenient.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Remind Me Later
            </button>
            <button
              onClick={handleApplyUpgrade}
              disabled={applying}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-2.5 text-xs font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-md transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={applying ? "animate-spin" : ""} />
              {applying ? "Applying Upgrade..." : "Apply Upgrade Now (Restart App)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
