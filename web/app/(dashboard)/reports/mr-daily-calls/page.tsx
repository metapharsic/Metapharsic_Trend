"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart3,
  Search,
  Download,
  Calendar,
  RefreshCw,
  Stethoscope,
  Store,
  Building2,
  Clock,
  Gauge,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Users2,
  PhoneCall,
  Boxes,
  User,
  ShieldCheck,
  Zap,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  PieChart,
  Activity,
  CheckSquare,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentTelemetry {
  id: string;
  name: string;
  role: string;
  domain: string;
  status: "ONLINE_PASS" | "ONLINE_WARNING" | "ONLINE_ALERT" | "IDLE" | "ERROR";
  statusLabel: string;
  latencyMs: number;
  confidence: number;
  score: number;
  metrics: Record<string, string | number | boolean | null>;
  findings: string[];
  warnings: string[];
  recommendations: string[];
}

export interface CouncilSynthesis {
  overallGrade: "A+" | "A" | "B" | "C" | "NEEDS_IMPROVEMENT";
  councilScore: number;
  executiveSummary: string;
  keyRiskFactors: string[];
  actionItems: string[];
  totalAgentsOnline: number;
  totalAgentsEvaluated: number;
  agentTelemetry: AgentTelemetry[];
}

export interface GranularCallRow {
  id: string;
  mrId: string;
  mrName: string;
  entityName: string;
  entityType: "DOCTOR" | "CHEMIST" | "HOSPITAL" | "OTHER";
  specialty?: string | null;
  purpose: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  durationSeconds: number | null;
  formattedDuration: string;
  boxesPlaced: number | null;
  cqsScore: number | null;
  cqsRating: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR" | "UNRATED";
  orderConverted: boolean;
  orderValuePtr: number;
  orderItemsCount: number;
}

export interface DayGroup {
  date: string;
  calls: GranularCallRow[];
  totalCalls: number;
  doctorCalls: number;
  chemistCalls: number;
  hospitalCalls: number;
  totalBoxes: number;
  totalOrderValue: number;
  avgDurationMinutes: number;
  avgCqsScore: number | null;
}

export interface MrGroup {
  mrId: string;
  mrName: string;
  totalCalls: number;
  doctorCalls: number;
  chemistCalls: number;
  hospitalCalls: number;
  totalBoxes: number;
  totalOrderValue: number;
  avgDurationMinutes: number;
  avgCqsScore: number | null;
  conversionRatePct: number;
  days: DayGroup[];
}

export interface MrDailyCallsReportData {
  meta: {
    startDate: string;
    endDate: string;
    totalVisits: number;
    totalMrs: number;
    totalBoxesPlaced: number;
    totalOrderValue: number;
    overallAvgDurationMinutes: number;
    overallAvgCqsScore: number | null;
    doctorVisits: number;
    chemistVisits: number;
    hospitalVisits: number;
    conversionRatePct: number;
  };
  mrs: MrGroup[];
  allMrs: { id: string; name: string }[];
  council: CouncilSynthesis;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return { date, time };
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function startOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function exportCSV(mrs: MrGroup[], startDate: string, endDate: string) {
  const rows: string[] = [
    "MR Name,Date,Time (HH:MM:SS),Entity Name,Entity Type,Specialty,Purpose,Duration,Duration Sec,Boxes Placed,CQS Score,CQS Rating,Order Converted,Order Value (PTR)",
  ];
  for (const mr of mrs) {
    for (const day of mr.days) {
      for (const c of day.calls) {
        const { date, time } = formatDateTime(c.startedAt);
        rows.push(
          [
            `"${mr.mrName}"`,
            date,
            time,
            `"${c.entityName}"`,
            c.entityType,
            `"${c.specialty ?? ""}"`,
            `"${c.purpose}"`,
            c.formattedDuration,
            c.durationSeconds ?? "",
            c.boxesPlaced ?? 0,
            c.cqsScore ?? "",
            c.cqsRating,
            c.orderConverted ? "YES" : "NO",
            c.orderValuePtr,
          ].join(",")
        );
      }
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mr-daily-calls-${startDate}-to-${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TYPE_CONFIG: Record<
  GranularCallRow["entityType"],
  { label: string; icon: React.ElementType; color: string }
> = {
  DOCTOR: { label: "Doctor", icon: Stethoscope, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  CHEMIST: { label: "Chemist", icon: Store, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  HOSPITAL: { label: "Hospital", icon: Building2, color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  OTHER: { label: "Other", icon: PhoneCall, color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
};

// ─── Agent Telemetry Status Panel Component ─────────────────────────────────────

function MultiAgentTelemetryPanel({
  telemetry,
  visible,
}: {
  telemetry: AgentTelemetry[];
  visible: boolean;
}) {
  if (!visible || !telemetry || telemetry.length === 0) return null;

  const statusBadge = (s: AgentTelemetry["status"]) => {
    if (s === "ONLINE_PASS") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (s === "ONLINE_WARNING") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    return "bg-red-500/20 text-red-300 border-red-500/30";
  };

  const statusIcon = (s: AgentTelemetry["status"]) => {
    if (s === "ONLINE_PASS") return <CheckCircle2 size={13} className="text-emerald-400" />;
    if (s === "ONLINE_WARNING") return <AlertCircle size={13} className="text-amber-400" />;
    return <AlertCircle size={13} className="text-red-400" />;
  };

  return (
    <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-md shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Multi-Agent Council Telemetry &amp; Real-Time Diagnostics
          </span>
        </div>
        <span className="text-[11px] text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono border border-indigo-500/30">
          6 Domain Agents Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {telemetry.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl border border-white/10 bg-white/5 p-3.5 hover:border-indigo-400/40 transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap size={12} className="text-amber-400" />
                  {agent.name}
                </p>
                <p className="text-[10px] text-indigo-200/70">{agent.domain}</p>
              </div>
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadge(
                  agent.status
                )}`}
              >
                {statusIcon(agent.status)}
                {agent.statusLabel}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 border-t border-white/5 pt-2">
              <span>Latency: <strong className="text-indigo-300">{agent.latencyMs}ms</strong></span>
              <span>Confidence: <strong className="text-emerald-300">{Math.round(agent.confidence * 100)}%</strong></span>
              <span>Score: <strong className="text-white">{agent.score}/100</strong></span>
            </div>

            {agent.findings.length > 0 && (
              <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 bg-black/20 p-2 rounded-lg border border-white/5">
                {agent.findings[0]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Council Executive Synthesis Banner ────────────────────────────────────────

function CouncilSynthesisBanner({ council }: { council: CouncilSynthesis }) {
  if (!council) return null;

  const gradeColors: Record<CouncilSynthesis["overallGrade"], string> = {
    "A+": "from-emerald-600 to-teal-700 text-white border-emerald-400/50 shadow-emerald-500/20",
    A: "from-blue-600 to-indigo-700 text-white border-blue-400/50 shadow-blue-500/20",
    B: "from-amber-600 to-orange-700 text-white border-amber-400/50 shadow-amber-500/20",
    C: "from-orange-600 to-red-700 text-white border-orange-400/50 shadow-orange-500/20",
    NEEDS_IMPROVEMENT: "from-red-700 to-rose-900 text-white border-red-400/50 shadow-red-500/20",
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-white shadow-xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradeColors[council.overallGrade]} border-2 flex flex-col items-center justify-center font-bold shadow-lg shrink-0`}
          >
            <span className="text-2xl leading-none">{council.overallGrade}</span>
            <span className="text-[9px] uppercase tracking-wider opacity-90 mt-0.5">Grade</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Council Executive Synthesis</h2>
              <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold px-2.5 py-0.5 rounded-full">
                Score: {council.councilScore}/100
              </span>
            </div>
            <p className="text-sm text-indigo-200/80 mt-1 max-w-3xl leading-relaxed">
              {council.executiveSummary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-indigo-300/70 font-medium">Council Evaluated</p>
            <p className="text-lg font-bold text-white">
              {council.totalAgentsOnline} / {council.totalAgentsEvaluated} Agents
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4">
        {/* Risk Factors */}
        <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-2">
          <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
            <AlertCircle size={14} /> Key Risk Factors &amp; Audits
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {council.keyRiskFactors.slice(0, 3).map((rf, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400 shrink-0">•</span>
                <span>{rf}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Strategic Action Items */}
        <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-2">
          <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
            <CheckSquare size={14} /> Strategic Recommendations
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {council.actionItems.slice(0, 3).map((ai, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-400 shrink-0">✓</span>
                <span>{ai}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MrDailyCallsReportPage() {
  const [data, setData] = useState<MrDailyCallsReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(daysAgoStr(6));
  const [endDate, setEndDate] = useState(todayStr());
  const [selectedMr, setSelectedMr] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "coverage" | "quality" | "commercial" | "council">("logs");
  const [expandedMrs, setExpandedMrs] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { startDate, endDate };
    if (selectedMr) params.mrId = selectedMr;
    if (search.length >= 2) params.search = search;

    apiClient
      .get("/api/reports/mr-daily-calls", { params })
      .then((res) => {
        const report: MrDailyCallsReportData = res.data.data;
        setData(report);
        // Auto-expand first MR and its first day
        if (report?.mrs?.length > 0) {
          const firstMrId = report.mrs[0].mrId;
          setExpandedMrs({ [firstMrId]: true });
          if (report.mrs[0].days?.length > 0) {
            setExpandedDays({ [`${firstMrId}-${report.mrs[0].days[0].date}`]: true });
          }
        }
      })
      .catch(() => {
        setError("Failed to load MR daily calls report. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedMr, search]);

  useEffect(() => {
    fetchReport();
  }, []);

  const setPreset = (type: "today" | "7d" | "30d" | "month") => {
    if (type === "today") {
      setStartDate(todayStr());
      setEndDate(todayStr());
    } else if (type === "7d") {
      setStartDate(daysAgoStr(6));
      setEndDate(todayStr());
    } else if (type === "30d") {
      setStartDate(daysAgoStr(29));
      setEndDate(todayStr());
    } else if (type === "month") {
      setStartDate(startOfMonthStr());
      setEndDate(todayStr());
    }
  };

  const toggleMr = (mrId: string) => setExpandedMrs((p) => ({ ...p, [mrId]: !p[mrId] }));
  const toggleDay = (key: string) => setExpandedDays((p) => ({ ...p, [key]: !p[key] }));

  const filteredMrs = data?.mrs ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-white/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <BarChart3 size={28} className="text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">MR Daily Calls Analytics</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  v1.2.0 Multi-Agent Engine
                </span>
              </div>
              <p className="text-indigo-300/70 text-sm mt-0.5">
                Comprehensive per-MR call telemetry, ISO timestamps with seconds, duration &amp; CQS scoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAgentPanel((p) => !p)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold hover:bg-white/20 transition-all shadow-sm"
            >
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              Agent Telemetry ({data?.council?.agentTelemetry?.length ?? 6})
            </button>
            {data && (
              <button
                onClick={() => exportCSV(filteredMrs, startDate, endDate)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-all shadow-sm"
              >
                <Download size={14} />
                Export Detailed CSV
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Presets */}
            <div className="flex items-center bg-white/10 border border-white/15 rounded-xl p-1 gap-1">
              <button
                onClick={() => setPreset("today")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setPreset("7d")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setPreset("30d")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setPreset("month")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
              >
                This Month
              </button>
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-indigo-300 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-white outline-none w-28 font-mono"
              />
              <span className="text-white/40 text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-white outline-none w-28 font-mono"
              />
            </div>

            {/* MR Selector dropdown */}
            {data && data.allMrs.length > 0 && (
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
                <User size={14} className="text-indigo-300 shrink-0" />
                <select
                  value={selectedMr}
                  onChange={(e) => setSelectedMr(e.target.value)}
                  className="bg-transparent text-xs text-white outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">All Representative MRs</option>
                  {data.allMrs.map((mr) => (
                    <option key={mr.id} value={mr.id} className="bg-slate-900 text-white">
                      {mr.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Instant 2-letter search input */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 focus-within:border-indigo-400 transition-colors">
              <Search size={14} className="text-indigo-300 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search MR name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-white placeholder:text-white/30 outline-none w-36"
              />
              {search.length === 1 && (
                <span className="text-[10px] text-amber-400 font-semibold">1 more...</span>
              )}
            </div>
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold transition-all shadow-md"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Run Analysis
          </button>
        </div>
      </div>

      {/* ── Multi-Agent Telemetry Live Status Panel ── */}
      <MultiAgentTelemetryPanel
        telemetry={data?.council?.agentTelemetry ?? []}
        visible={showAgentPanel}
      />

      {/* ── Council Executive Synthesis Banner ── */}
      {data?.council && <CouncilSynthesisBanner council={data.council} />}

      {/* ── Summary KPI Cards ── */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard icon={PhoneCall} label="Total Calls" value={data.meta.totalVisits} color="indigo" />
          <KpiCard icon={Stethoscope} label="Doctor Calls" value={data.meta.doctorVisits} color="blue" />
          <KpiCard icon={Store} label="Chemist Calls" value={data.meta.chemistVisits} color="emerald" />
          <KpiCard icon={Building2} label="Hospital Calls" value={data.meta.hospitalVisits} color="violet" />
          <KpiCard
            icon={Clock}
            label="Avg Duration"
            value={`${data.meta.overallAvgDurationMinutes}m`}
            color="amber"
          />
          <KpiCard
            icon={Gauge}
            label="Avg CQS"
            value={data.meta.overallAvgCqsScore != null ? `${data.meta.overallAvgCqsScore}/5` : "—"}
            color="teal"
          />
          <KpiCard icon={Boxes} label="Boxes Placed" value={data.meta.totalBoxesPlaced} color="orange" />
          <KpiCard
            icon={TrendingUp}
            label="Secondary Sales"
            value={`₹${Math.round(data.meta.totalOrderValue / 1000)}k`}
            color="emerald"
          />
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && !data && (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center gap-3 shadow-sm">
          <Loader2 size={32} className="text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            Multi-Agent Council analyzing MR daily call records...
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
          <AlertCircle size={22} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Multi-Tab Navigation Bar ── */}
      {data && (
        <div className="flex items-center border-b border-slate-200 space-x-6">
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "logs"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Layers size={14} /> Daily Call Logs ({data.meta.totalVisits})
          </button>
          <button
            onClick={() => setActiveTab("coverage")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "coverage"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <PieChart size={14} /> Field Reach &amp; Coverage
          </button>
          <button
            onClick={() => setActiveTab("quality")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "quality"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Gauge size={14} /> Detailing &amp; CQS Quality
          </button>
          <button
            onClick={() => setActiveTab("commercial")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "commercial"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <TrendingUp size={14} /> Orders &amp; Samples
          </button>
          <button
            onClick={() => setActiveTab("council")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "council"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <ShieldCheck size={14} /> Multi-Agent Council Audit
          </button>
        </div>
      )}

      {/* ── TAB 1: Granular Daily Call Logs ── */}
      {data && activeTab === "logs" && (
        <div className="space-y-4">
          {filteredMrs.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <PhoneCall size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No calls found for this date range.</p>
              <p className="text-xs text-slate-400 mt-1">Try expanding your date filter or selecting all MRs.</p>
            </div>
          )}

          {filteredMrs.map((mr) => {
            const isExpanded = expandedMrs[mr.mrId] ?? false;
            return (
              <div
                key={mr.mrId}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* MR Header Card */}
                <button
                  onClick={() => toggleMr(mr.mrId)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 shadow-sm">
                      {mr.mrName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base flex items-center gap-2">
                        {mr.mrName}
                        {mr.totalOrderValue > 0 && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                            Secondary Orders: ₹{mr.totalOrderValue.toLocaleString("en-IN")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {mr.totalCalls} calls ({mr.doctorCalls} Doctors, {mr.chemistCalls} Chemists, {mr.hospitalCalls} Hospitals) across {mr.days.length} day{mr.days.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                      {mr.totalCalls} calls
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Day Group Accordions */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {mr.days.map((day) => {
                      const dayKey = `${mr.mrId}-${day.date}`;
                      const isDayExpanded = expandedDays[dayKey] ?? false;

                      return (
                        <div key={day.date}>
                          {/* Day Subheader */}
                          <button
                            onClick={() => toggleDay(dayKey)}
                            className="w-full flex items-center justify-between px-6 py-3 bg-slate-50/70 hover:bg-slate-100/60 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-indigo-600" />
                              <span className="text-xs font-bold text-slate-700">
                                {formatDate(day.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 font-medium">
                                {day.totalCalls} call{day.totalCalls !== 1 ? "s" : ""} · {day.totalBoxes} boxes
                              </span>
                              {isDayExpanded ? (
                                <ChevronDown size={14} className="text-slate-400" />
                              ) : (
                                <ChevronRight size={14} className="text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Granular Calls Table */}
                          {isDayExpanded && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-100/80 text-slate-500 border-y border-slate-200">
                                    <th className="px-5 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                                      Entity / Name
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                                      Type
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                                      Purpose
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                                      Time (HH:MM:SS)
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">
                                      Duration
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">
                                      Boxes Placed
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">
                                      CQS Score
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">
                                      Order Conversion
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {day.calls.map((c) => {
                                    const { time } = formatDateTime(c.startedAt);
                                    const TypeCfg = TYPE_CONFIG[c.entityType];

                                    return (
                                      <tr
                                        key={c.id}
                                        className="hover:bg-indigo-50/40 transition-colors"
                                      >
                                        <td className="px-5 py-3 font-bold text-slate-900">
                                          <div>
                                            <span>{c.entityName}</span>
                                            {c.specialty && (
                                              <span className="block text-[10px] text-slate-400 font-normal">
                                                {c.specialty}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${TypeCfg.color}`}
                                          >
                                            <TypeCfg.icon size={10} />
                                            {TypeCfg.label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                                          {c.purpose}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-100">
                                            {time}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                                          {c.formattedDuration}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                          {c.boxesPlaced ?? 0}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          {c.cqsScore != null ? (
                                            <span
                                              className={`inline-block font-bold text-[11px] px-2 py-0.5 rounded-md ${
                                                c.cqsScore >= 4.0
                                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                  : c.cqsScore >= 3.0
                                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                                  : c.cqsScore >= 2.0
                                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                  : "bg-red-100 text-red-800 border border-red-200"
                                              }`}
                                            >
                                              {c.cqsScore} / 5.0
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          {c.orderConverted ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                              <TrendingUp size={11} /> ₹{c.orderValuePtr.toLocaleString("en-IN")}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 text-[11px]">No Order</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-50 border-t border-slate-200">
                                    <td colSpan={3} className="px-5 py-2.5 text-xs font-bold text-slate-700">
                                      Day Total Summary
                                    </td>
                                    <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-bold text-slate-700">
                                      {day.totalCalls} calls · {day.totalBoxes} boxes placed · ₹{day.totalOrderValue.toLocaleString("en-IN")} order value
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 2: Coverage & Reach ── */}
      {data && activeTab === "coverage" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Territory Reach &amp; Coverage Analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of visits across Doctors, Chemists, and Hospitals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Stethoscope className="text-blue-600 mb-2" size={24} />
              <p className="text-2xl font-bold text-blue-900">{data.meta.doctorVisits}</p>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mt-1">Doctor Visits</p>
              <p className="text-[11px] text-blue-600/80 mt-1">
                {data.meta.totalVisits > 0 ? Math.round((data.meta.doctorVisits / data.meta.totalVisits) * 100) : 0}% of total field activity
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <Store className="text-emerald-600 mb-2" size={24} />
              <p className="text-2xl font-bold text-emerald-900">{data.meta.chemistVisits}</p>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mt-1">Chemist Visits</p>
              <p className="text-[11px] text-emerald-600/80 mt-1">
                {data.meta.totalVisits > 0 ? Math.round((data.meta.chemistVisits / data.meta.totalVisits) * 100) : 0}% of total field activity
              </p>
            </div>

            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <Building2 className="text-violet-600 mb-2" size={24} />
              <p className="text-2xl font-bold text-violet-900">{data.meta.hospitalVisits}</p>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mt-1">Hospital Visits</p>
              <p className="text-[11px] text-violet-600/80 mt-1">
                {data.meta.totalVisits > 0 ? Math.round((data.meta.hospitalVisits / data.meta.totalVisits) * 100) : 0}% of total field activity
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Quality & Detailing ── */}
      {data && activeTab === "quality" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Call Quality &amp; Detailing Analysis (CQS)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Average detailing quality score and distribution metrics
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
              <p className="text-sm font-bold text-slate-800">Average Call Quality Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-indigo-700">
                  {data.meta.overallAvgCqsScore ?? "N/A"}
                </span>
                <span className="text-sm text-slate-400 font-semibold">/ 5.0</span>
              </div>
              <p className="text-xs text-slate-500">
                Benchmark target: &ge; 3.5 / 5.0 for high doctor engagement
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
              <p className="text-sm font-bold text-slate-800">Average Detailing Duration</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-indigo-700">
                  {data.meta.overallAvgDurationMinutes}
                </span>
                <span className="text-sm text-slate-400 font-semibold">minutes</span>
              </div>
              <p className="text-xs text-slate-500">
                Optimal doctor detailing window: 5 to 8 minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Commercial & Orders ── */}
      {data && activeTab === "commercial" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Order Conversion &amp; Sample Placement</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Commercial output generated directly from field calls
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Secondary Revenue</p>
              <p className="text-3xl font-extrabold text-emerald-900">₹{data.meta.totalOrderValue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-emerald-700">Total PTR value booked from calls</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Chemist Conversion</p>
              <p className="text-3xl font-extrabold text-blue-900">{data.meta.conversionRatePct}%</p>
              <p className="text-xs text-blue-700">Chemist visits converted to orders</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-2">
              <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">Samples Placed</p>
              <p className="text-3xl font-extrabold text-orange-900">{data.meta.totalBoxesPlaced}</p>
              <p className="text-xs text-orange-700">Sample boxes handed during visits</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: Council Audit ── */}
      {data && activeTab === "council" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Multi-Agent Council Comprehensive Audit</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              In-depth diagnostic results from all 6 specialized domain agents
            </p>
          </div>

          <div className="space-y-4">
            {data.council.agentTelemetry.map((agent) => (
              <div key={agent.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="text-amber-500" size={16} />
                    <span className="font-bold text-slate-900 text-sm">{agent.name}</span>
                    <span className="text-xs text-slate-400 font-mono">({agent.domain})</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Score: {agent.score}/100
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-700 mb-1">Agent Findings:</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                      {agent.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-700 mb-1">Recommendations:</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                      {agent.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPI_COLORS: Record<
  string,
  { bg: string; icon: string; value: string }
> = {
  indigo: { bg: "bg-indigo-50/80 border-indigo-100", icon: "text-indigo-500", value: "text-indigo-900" },
  emerald: { bg: "bg-emerald-50/80 border-emerald-100", icon: "text-emerald-500", value: "text-emerald-900" },
  blue: { bg: "bg-blue-50/80 border-blue-100", icon: "text-blue-500", value: "text-blue-900" },
  violet: { bg: "bg-violet-50/80 border-violet-100", icon: "text-violet-500", value: "text-violet-900" },
  amber: { bg: "bg-amber-50/80 border-amber-100", icon: "text-amber-500", value: "text-amber-900" },
  teal: { bg: "bg-teal-50/80 border-teal-100", icon: "text-teal-500", value: "text-teal-900" },
  orange: { bg: "bg-orange-50/80 border-orange-100", icon: "text-orange-500", value: "text-orange-900" },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  const c = KPI_COLORS[color] ?? KPI_COLORS.indigo;
  return (
    <div className={`rounded-xl border p-3.5 shadow-sm ${c.bg}`}>
      <Icon size={16} className={c.icon} />
      <p className={`text-xl font-extrabold mt-1.5 ${c.value}`}>{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}
