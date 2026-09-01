"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  RefreshCw,
  Copy,
  Check,
  X,
  Bug,
  Activity,
  Layers,
  Terminal,
  Download,
  Trash2,
} from "lucide-react";
import { systemHealth, SystemErrorRecord } from "@/lib/system-health";
import { apiClient } from "@/lib/api-client";

interface DiagnosticsResponse {
  status: string;
  checkedAt: string;
  database: {
    status: string;
    latencyMs: number;
    error?: string;
  };
  counts?: Record<string, number>;
  company?: Record<string, any>;
  server?: Record<string, any>;
}

export function SystemDiagnosticsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"errors" | "health" | "tools">("errors");
  const [errors, setErrors] = useState<SystemErrorRecord[]>([]);
  const [healthData, setHealthData] = useState<DiagnosticsResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = systemHealth.subscribe((list) => {
      setErrors(list);
      // Auto-expand first error if present
      if (list.length > 0 && !expandedId) {
        setExpandedId(list[0].id);
      }
    });
    return unsub;
  }, []);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await apiClient.get("/api/admin/diagnostics");
      setHealthData(res.data.data);
    } catch (e: any) {
      setHealthData({
        status: "ERROR",
        checkedAt: new Date().toISOString(),
        database: {
          status: "DISCONNECTED",
          latencyMs: 0,
          error: e?.message || "Failed to reach diagnostics API",
        },
      });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyReport = (err: SystemErrorRecord) => {
    const reportText = JSON.stringify(err, null, 2);
    navigator.clipboard.writeText(reportText);
    setCopiedId(err.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllErrors = () => {
    const allText = JSON.stringify({ errors, health: healthData }, null, 2);
    navigator.clipboard.writeText(allText);
    setCopiedId("ALL");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadReportJson = () => {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), errors, health: healthData }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_diagnostic_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerTestError = () => {
    systemHealth.recordError({
      url: "/api/test-diagnostic",
      method: "POST",
      status: 500,
      statusText: "Internal Server Error (Simulated)",
      errorMessage: "Simulated Test Error: Verified real-time forensic capture and telemetry stream.",
      errorDetails: {
        code: "DIAGNOSTIC_VERIFICATION_TEST",
        subsystem: "ErrorSentinel",
        activeModel: "Multi-Agent System Health",
      },
      requestPayload: { testRun: true, timestamp: Date.now() },
      suggestedRemedy: "This is a simulated verification test. The system error interceptor is functioning correctly.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">System Health &amp; Diagnostics Inspector</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${errors.length > 0 ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}>
                  {errors.length > 0 ? `${errors.length} Issue${errors.length > 1 ? "s" : ""} Logged` : "System Healthy"}
                </span>
              </div>
              <p className="text-xs text-slate-400">Complete forensic information for any failure across the application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-gray-200 bg-gray-50/70">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("errors")}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === "errors"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Bug size={14} />
              Error Forensics ({errors.length})
            </button>
            <button
              onClick={() => setActiveTab("health")}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === "health"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Activity size={14} />
              Server &amp; Database Health
            </button>
            <button
              onClick={() => setActiveTab("tools")}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === "tools"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Terminal size={14} />
              Diagnostic Tools
            </button>
          </div>

          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <button
                onClick={copyAllErrors}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-primary-700 bg-white border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                {copiedId === "ALL" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                Copy Full Log
              </button>
            )}
            <button
              onClick={fetchHealth}
              disabled={loadingHealth}
              className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-primary-700 bg-white border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              <RefreshCw size={12} className={loadingHealth ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: Error Forensics */}
          {activeTab === "errors" && (
            <div className="space-y-3">
              {errors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">Zero Active Errors Detected</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                    All recent API requests, route transitions, and client scripts executed cleanly with no exceptions.
                  </p>
                  <button
                    onClick={triggerTestError}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-200/80 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition-colors"
                  >
                    <Bug size={13} />
                    Simulate Diagnostic Test Error
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Showing recent forensic records (ordered newest first):</span>
                    <button
                      onClick={() => systemHealth.clearErrors()}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
                    >
                      <Trash2 size={12} />
                      Clear Error History
                    </button>
                  </div>

                  {errors.map((err) => {
                    const isExpanded = expandedId === err.id;
                    return (
                      <div
                        key={err.id}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          err.severity === "CRITICAL"
                            ? "border-red-300 bg-red-50/40"
                            : "border-amber-300 bg-amber-50/40"
                        }`}
                      >
                        {/* Summary Bar */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : err.id)}
                          className="px-4 py-3 cursor-pointer flex items-center justify-between gap-3 hover:bg-black/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                err.status && err.status >= 500
                                  ? "bg-red-600 text-white"
                                  : err.status
                                  ? "bg-amber-600 text-white"
                                  : "bg-gray-600 text-white"
                              }`}
                            >
                              {err.status ? `${err.method || "HTTP"} ${err.status}` : "EXCEPTION"}
                            </span>
                            <span className="font-mono text-xs font-bold text-gray-900 truncate">
                              {err.url || "Client Application"}
                            </span>
                            <span className="text-xs text-gray-600 truncate max-w-md">
                              {err.errorMessage}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] font-mono text-gray-400">{err.timeDisplay}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyReport(err);
                              }}
                              className="text-gray-400 hover:text-primary-600 p-1"
                              title="Copy JSON error report"
                            >
                              {copiedId === err.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Forensic Details */}
                        {isExpanded && (
                          <div className="px-4 py-3 border-t border-gray-200/80 bg-white space-y-3 text-xs">
                            {/* Suggested Remedy Banner */}
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900">
                              <AlertTriangle size={15} className="text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Recommended Resolution: </span>
                                <span>{err.suggestedRemedy}</span>
                              </div>
                            </div>

                            {/* Forensic Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {err.requestPayload && (
                                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                                  <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                                    Request Payload Sent
                                  </span>
                                  <pre className="font-mono text-[11px] text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-32">
                                    {typeof err.requestPayload === "object"
                                      ? JSON.stringify(err.requestPayload, null, 2)
                                      : String(err.requestPayload)}
                                  </pre>
                                </div>
                              )}

                              {err.errorDetails && (
                                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                                  <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                                    Server Error Details / Stack
                                  </span>
                                  <pre className="font-mono text-[11px] text-red-700 overflow-x-auto whitespace-pre-wrap max-h-32">
                                    {typeof err.errorDetails === "object"
                                      ? JSON.stringify(err.errorDetails, null, 2)
                                      : String(err.errorDetails)}
                                  </pre>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                              <span>Incident ID: {err.id}</span>
                              <span>Timestamp: {err.timestamp}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* TAB 2: Server & Database Health */}
          {activeTab === "health" && (
            <div className="space-y-4">
              {loadingHealth && !healthData ? (
                <div className="text-center py-12 text-xs text-gray-400">Pinging server and database...</div>
              ) : healthData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Database Tile */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Database size={16} />
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <CheckCircle2 size={12} />
                          {healthData.database.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">Database Latency</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">{healthData.database.latencyMs} ms</p>
                      <p className="text-[11px] text-gray-400 mt-1">PostgreSQL 16 via Prisma ORM</p>
                    </div>

                    {/* Server Tile */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Server size={16} />
                        </div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          {healthData.server?.nodeVersion || "Node.js"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">Server Uptime</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">
                        {Math.floor((healthData.server?.uptimeSeconds || 0) / 60)} min
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Memory RSS: {healthData.server?.rssMemoryMb || 0} MB
                      </p>
                    </div>

                    {/* Company Branding Tile */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                          <Layers size={16} />
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          Branded
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">Active Tenant Name</p>
                      <p className="text-base font-bold text-gray-900 truncate mt-1">
                        {healthData.company?.name || "Metapharsic Lifesciences"}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Logo: {healthData.company?.logoPath ? "Configured" : "Missing"}
                      </p>
                    </div>
                  </div>

                  {/* Core Table Record Counts */}
                  {healthData.counts && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                        Database Health &amp; Record Volume
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(healthData.counts).map(([key, count]) => (
                          <div key={key} className="bg-white rounded-lg p-2.5 border border-gray-100">
                            <p className="text-xs text-gray-500 capitalize">
                              {key.replace(/([A-Z])/g, " $1")}
                            </p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">
                              {Number(count).toLocaleString("en-IN")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* TAB 3: Diagnostic Tools */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-white">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                  1-Click Emergency &amp; Maintenance Actions
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Run targeted maintenance commands to verify data integrity and connectivity.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={triggerTestError}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                  >
                    <Bug size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-800">Simulate Error Intercept</p>
                      <p className="text-[11px] text-gray-500">Injects a test incident to confirm real-time capture</p>
                    </div>
                  </button>

                  <button
                    onClick={downloadReportJson}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                  >
                    <Download size={16} className="text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-800">Download Diagnostic JSON</p>
                      <p className="text-[11px] text-gray-500">Exports full telemetry bundle for technical support</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Metapharsic Multi-Agent Diagnostics Sentinel v2.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
