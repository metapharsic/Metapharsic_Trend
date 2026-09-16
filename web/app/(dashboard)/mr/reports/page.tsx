"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  Stethoscope,
  Store,
  Clock,
  Boxes,
  Gauge,
  CalendarDays,
  User,
  Users,
  Search,
  RefreshCw,
  Send,
  MessageCircle,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Filter,
  ChevronRight,
  MapPin,
  Pill,
  Landmark,
  Cpu,
  Building2,
  TrendingUp,
  Package,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { exportCurrentPageToExcel } from "@/lib/excel-export";

type Period = "daily" | "weekly" | "monthly" | "custom" | "all";

interface AgentStatusItem {
  agentCode: string;
  agentName: string;
  domain: string;
  status: "ONLINE_PASS" | "ONLINE_WARNING" | "ONLINE_ALERT";
  score: number;
  summary: string;
}

interface MrBreakdownItem {
  employeeId: string;
  employeeName: string;
  phone: string | null;
  territory: string;
  totalCalls: number;
  doctorCalls: number;
  chemistCalls: number;
  hospitalCalls: number;
  totalBoxesPlaced: number;
  totalSamples: number;
  avgDurationMinutes: number;
  avgCqsScore: number | null;
  anomalyCount: number;
  pobValue: number;
  councilScore: number;
  grade: string;
}

interface CallItem {
  id: string;
  name: string;
  targetType: "DOCTOR" | "CHEMIST" | "HOSPITAL" | "OTHER";
  specialty: string | null;
  purpose: string;
  createdAt: string;
  durationMinutes: number | null;
  boxesPlaced: number | null;
  cqsScore: number | null;
  anomalyFlag: boolean;
  anomalyDetails: string | null;
  receptiveness: string | null;
  samplesCount: number;
  samplesSummary: string | null;
  employeeId: string;
  employeeName: string;
  employeePhone: string | null;
  territory: string;
}

interface CallReport {
  period: Period;
  range: { start: string; end: string };
  employee: { id: string | null; name: string };
  totals: {
    totalCalls: number;
    doctorCalls: number;
    chemistCalls: number;
    hospitalCalls: number;
    totalBoxesPlaced: number;
    totalSamplesDistributed: number;
    avgDurationMinutes: number;
    avgCqsScore: number | null;
    anomalyCount: number;
    totalPobValue: number;
  };
  multiAgentEvaluation?: {
    councilScore: number;
    overallGrade: string;
    agentStatuses: AgentStatusItem[];
    findings: string[];
    recommendations: string[];
  };
  mrBreakdown?: MrBreakdownItem[];
  byDay: Record<string, number>;
  calls: CallItem[];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "Daily (Today)" },
  { key: "weekly", label: "Past 7 Days" },
  { key: "monthly", label: "Month-to-Date" },
  { key: "custom", label: "Custom Range" },
];

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function MrReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [report, setReport] = useState<CallReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<{ id: string; employeeId: string; firstName: string; lastName: string; phone?: string; territory?: string }[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<"ALL" | "DOCTOR" | "CHEMIST" | "HOSPITAL">("ALL");

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  const fetchReport = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { period };
    if (selectedRep) params.employeeId = selectedRep;
    if (period === "custom" && customStart && customEnd) {
      params.startDate = customStart;
      params.endDate = customEnd;
    }

    apiClient
      .get("/api/mr/reports/calls", { params })
      .then((res) => setReport(res.data.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [period, selectedRep, customStart, customEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Filtered calls
  const filteredCalls = useMemo(() => {
    if (!report?.calls) return [];
    return report.calls.filter((c) => {
      if (targetTypeFilter !== "ALL" && c.targetType !== targetTypeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesMR = c.employeeName.toLowerCase().includes(query);
        const matchesPurpose = c.purpose.toLowerCase().includes(query);
        const matchesTerritory = c.territory.toLowerCase().includes(query);
        const matchesSpecialty = c.specialty ? c.specialty.toLowerCase().includes(query) : false;
        return matchesName || matchesMR || matchesPurpose || matchesTerritory || matchesSpecialty;
      }
      return true;
    });
  }, [report?.calls, targetTypeFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP HERO BANNER & MULTI-AGENT COUNCIL TELEMETRY ────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl border border-indigo-800/40">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-1/3 -bottom-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold tracking-wider text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                8 DOMAIN AGENTS ONLINE
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-300 border border-indigo-500/30">
                <Sparkles className="h-3 w-3" />
                Multi-Agent Call Audit
              </span>
              {reps.length > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-white/20">
                  {reps.length} Field Representatives
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              {report ? (selectedRep ? `${report.employee.name}'s Call Reports` : reps.length > 0 ? "All MRs — Call Reports" : "My Call Reports") : "All MRs — Call Reports"}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Comprehensive doctor detailing audits, chemist POB calls, duration metrics, samples placed, and multi-agent compliance evaluation.
            </p>
          </div>

          {/* Quick Action Navigation Bar */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
            <Link
              href="/mr/reports/council"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-emerald-900/30 transition hover:scale-[1.02] active:scale-[0.98]"
              title="Open full Multi-Agent Council Granular Audit & WhatsApp dispatch"
            >
              <Send className="h-4 w-4" />
              <span>Council WhatsApp Dispatch</span>
            </Link>

            <Link
              href="/reports/mr-daily-calls"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2.5 text-xs font-semibold transition border border-indigo-400/30 hover:scale-[1.02]"
              title="Open Executive MR Daily Calls Analytics"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Executive BI</span>
            </Link>

            <button
              onClick={() => exportCurrentPageToExcel("All_MRs_Call_Reports")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 text-xs font-medium border border-slate-700 transition"
              title="Export report to Excel / CSV"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Multi-Agent Council Aggregate Score Ribbon */}
        {report?.multiAgentEvaluation && (
          <div className="mt-6 pt-5 border-t border-indigo-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-1.5 rounded-xl font-black text-sm border shadow-sm ${
                  report.multiAgentEvaluation.overallGrade === "A+"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : report.multiAgentEvaluation.overallGrade === "A"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                }`}
              >
                Grade {report.multiAgentEvaluation.overallGrade} ({report.multiAgentEvaluation.councilScore}/100)
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Multi-Agent Verdict: </span>
                <span>{report.multiAgentEvaluation.findings[0] || "All logged customer visits audited."}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-indigo-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Verified with FIELD_DCR_AGENT &amp; ROUTING_COMPLIANCE_AGENT</span>
            </div>
          </div>
        )}
      </div>

      {/* ── FILTER & SCOPE CONTROLLER ──────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* MR Rep Selector (for Managers) */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <User className="h-4 w-4 text-indigo-500" />
              <span>Representative Scope:</span>
            </div>
            {reps.length > 0 ? (
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">⚡ All MRs Fleet Combined ({reps.length} Reps)</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    👤 {r.firstName} {r.lastName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                My Call Reports Only
              </span>
            )}
          </div>

          {/* Timeframe Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Period:</span>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  period === p.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/50 dark:border-indigo-900/30">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Date Range:
            </span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={fetchReport}
              disabled={!customStart || !customEnd}
              className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Search & Target Type Filter Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by doctor, chemist, MR, or purpose..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All Calls" },
              { id: "DOCTOR", label: "Doctors", icon: Stethoscope },
              { id: "CHEMIST", label: "Chemists", icon: Store },
              { id: "HOSPITAL", label: "Hospitals", icon: Building2 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTargetTypeFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  targetTypeFilter === t.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {t.icon && <t.icon className="h-3.5 w-3.5" />}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !report && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Synthesizing Multi-Agent Call Reports...</span>
        </div>
      )}

      {report && (
        <>
          {/* Active Period Label */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
              <span>
                Audited Window: {dateStr(report.range.start)} to {dateStr(report.range.end)}
              </span>
            </div>
            <span>
              Showing {filteredCalls.length} of {report.calls.length} total logged calls
            </span>
          </div>

          {/* ── 6 KPI STAT TILES ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <StatTile
              icon={BarChart3}
              label="Total Calls"
              value={report.totals.totalCalls}
              sub={`${Math.round((report.totals.doctorCalls / (report.totals.totalCalls || 1)) * 100)}% Doctors`}
              tone="indigo"
            />
            <StatTile
              icon={Stethoscope}
              label="Doctor Detailing"
              value={report.totals.doctorCalls}
              sub="HCP Interactions"
              tone="emerald"
            />
            <StatTile
              icon={Store}
              label="Chemist Calls"
              value={report.totals.chemistCalls}
              sub="POB Bookings"
              tone="blue"
            />
            <StatTile
              icon={Boxes}
              label="Boxes Placed"
              value={report.totals.totalBoxesPlaced}
              sub={`${report.totals.totalSamplesDistributed} samples`}
              tone="amber"
            />
            <StatTile
              icon={Clock}
              label="Avg Duration"
              value={`${report.totals.avgDurationMinutes}m`}
              sub="Per Call"
              tone="purple"
            />
            <StatTile
              icon={Gauge}
              label="Avg CQS Score"
              value={report.totals.avgCqsScore ? `${report.totals.avgCqsScore}/10` : "—"}
              sub={report.totals.avgCqsScore && report.totals.avgCqsScore >= 7 ? "High Quality" : "Standard"}
              tone="teal"
            />
          </div>

          {/* ── MULTI-AGENT 4-DOMAIN EVALUATION CARDS ─────────────────── */}
          {report.multiAgentEvaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {report.multiAgentEvaluation.agentStatuses.map((ag) => (
                <div
                  key={ag.agentCode}
                  className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {ag.domain}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        ag.status === "ONLINE_PASS"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : ag.status === "ONLINE_WARNING"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {ag.score}%
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{ag.agentName}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {ag.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FLEET MR BREAKDOWN ROSTER (WHEN VIEWING ALL MRS) ───────── */}
          {!selectedRep && report.mrBreakdown && report.mrBreakdown.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Fleet MR Call Performance Roster ({report.mrBreakdown.length} Representatives):
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Total Fleet Calls: {report.totals.totalCalls}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3">Representative &amp; Territory</th>
                      <th className="p-3 text-center">Total Calls</th>
                      <th className="p-3 text-center">Doctor Visits</th>
                      <th className="p-3 text-center">Chemist Calls</th>
                      <th className="p-3 text-center">Boxes Placed</th>
                      <th className="p-3 text-center">Avg Duration</th>
                      <th className="p-3 text-center">CQS Score</th>
                      <th className="p-3 text-right">POB Orders</th>
                      <th className="p-3 text-center">Grade</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.mrBreakdown.map((mr) => (
                      <tr key={mr.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{mr.employeeName}</span>
                          <span className="text-[10px] text-slate-400">{mr.territory} • {mr.phone || "No phone"}</span>
                        </td>
                        <td className="p-3 text-center font-black text-slate-900 dark:text-white">
                          {mr.totalCalls}
                        </td>
                        <td className="p-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {mr.doctorCalls}
                        </td>
                        <td className="p-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                          {mr.chemistCalls}
                        </td>
                        <td className="p-3 text-center text-slate-700 dark:text-slate-300">
                          {mr.totalBoxesPlaced}
                        </td>
                        <td className="p-3 text-center text-slate-500">
                          {mr.avgDurationMinutes ? `${mr.avgDurationMinutes}m` : "—"}
                        </td>
                        <td className="p-3 text-center">
                          {mr.avgCqsScore ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {mr.avgCqsScore}/10
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ₹{mr.pobValue.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mr.grade === "A"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : mr.grade === "B"
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            Grade {mr.grade}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRep(mr.employeeId)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-lg transition"
                              title="Filter call log to this representative"
                            >
                              View Calls
                            </button>
                            {mr.phone && (
                              <a
                                href={`https://wa.me/${mr.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                                title="Open WhatsApp chat with representative"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DETAILED CALLS ACTIVITY LOG TABLE ───────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span>Detailed Customer Calls Activity Log</span>
                  <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.2 text-[10px] text-slate-700 dark:text-slate-300">
                    {filteredCalls.length} calls
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Granular interaction timestamps, CQS scores, sample placement, and routing integrity.
                </p>
              </div>

              {selectedRep && (
                <button
                  type="button"
                  onClick={() => setSelectedRep("")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline self-start sm:self-auto"
                >
                  ← Back to All MRs
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Customer / Entity</th>
                    {!selectedRep && reps.length > 0 && (
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">MR Representative</th>
                    )}
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Call Purpose &amp; Feedback</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Timestamp</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Duration</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Boxes/Samples</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">CQS Score</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={!selectedRep && reps.length > 0 ? 9 : 8} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No customer calls matched the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              c.targetType === "DOCTOR"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : c.targetType === "CHEMIST"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                            }`}
                          >
                            {c.targetType === "DOCTOR" && <Stethoscope className="h-3 w-3" />}
                            {c.targetType === "CHEMIST" && <Store className="h-3 w-3" />}
                            {c.targetType === "HOSPITAL" && <Building2 className="h-3 w-3" />}
                            <span>{c.targetType}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{c.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.specialty ? `${c.specialty} • ` : ""}
                            {c.territory}
                          </span>
                        </td>
                        {!selectedRep && reps.length > 0 && (
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                              {c.employeeName}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 max-w-xs">
                          <span className="text-slate-700 dark:text-slate-200 block truncate">{c.purpose}</span>
                          {c.samplesSummary && (
                            <span className="text-[10px] text-indigo-500 font-semibold block truncate mt-0.5">
                              Samples: {c.samplesSummary}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {dateStr(c.createdAt)} · {timeStr(c.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300 font-semibold">
                          {c.durationMinutes ? `${c.durationMinutes}m` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {c.boxesPlaced ?? 0} boxes
                          </span>
                          {c.samplesCount > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                              +{c.samplesCount} samples
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.cqsScore !== null && c.cqsScore !== undefined ? (
                            <span
                              className={`font-black text-xs px-2 py-0.5 rounded ${
                                c.cqsScore >= 7
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {c.cqsScore}/10
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.anomalyFlag ? (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-[10px]" title={c.anomalyDetails || "Routing deviation"}>
                              <AlertTriangle className="h-3 w-3" /> Anomaly
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const TONE: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-500/10 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
  emerald: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  blue: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  amber: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  purple: { bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
  teal: { bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone: string;
}) {
  const t = TONE[tone] || TONE.indigo;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.bg} ${t.text}`}>
        <Icon size={16} />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
