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
  MessageSquare,
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
  Target,
  Flame,
  ArrowUpRight,
  Compass,
  CheckSquare,
  Award,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { exportCurrentPageToExcel, downloadExcelReportWithDashboard } from "@/lib/excel-export";

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
  comments?: string | null;
  feedback?: string | null;
  followUpDate?: string | null;
  followUpAction?: string | null;
  leadDetails?: string | null;
  leadStatus?: string | null;
  samplesCount: number;
  samplesSummary: string | null;
  employeeId: string;
  employeeName: string;
  employeePhone: string | null;
  territory: string;
}

export interface DealOpportunity {
  visitId: string;
  targetId: string;
  targetName: string;
  targetType: "DOCTOR" | "CHEMIST" | "HOSPITAL";
  specialtyOrType: string;
  territory: string;
  mrId: string;
  mrName: string;
  lastVisitDate: string;
  mrComments: string;
  receptiveness: string;
  closureProbability: number;
  closureTier: "HIGH" | "MEDIUM" | "LOW";
  priorityRank: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dealStage: string;
  closingSignals: string[];
  objectionsIdentified: string[];
  productInterests: string[];
  actionableGuidance: string;
  recommendedFollowupWindow: string;
  estimatedDealValue: number;

  // Commercial Orders & Invoices Matching
  matchedOrdersCount: number;
  matchedInvoicesCount: number;
  totalInvoicedValue: number;
  lastInvoiceNo?: string | null;
  lastInvoiceDate?: string | null;
  commercialCategory: "NEW_ACCOUNT_CONVERSION" | "REPEAT_REPLENISHMENT" | "PAYMENT_RECOVERY_REORDER";

  // Close This Week AI Prediction
  canCloseThisWeek: boolean;
  closeThisWeekReason: string;
}

export interface DealClosureSummary {
  totalAnalyzedVisits: number;
  totalOpportunities: number;
  highProbabilityDeals: number;
  mediumProbabilityDeals: number;
  lowProbabilityDeals: number;
  urgentFollowupsCount: number;
  estimatedPipelineValue: number;

  totalOrdersMatched: number;
  totalInvoicesMatched: number;
  totalInvoicedRevenue: number;
  closeThisWeekCount: number;
  newAccountConversionsCount: number;
  repeatReplenishmentsCount: number;

  topPriorityQueue: DealOpportunity[];
  closeThisWeekQueue: DealOpportunity[];
  stageBreakdown: Record<string, number>;
  mrRankings: Array<{
    mrId: string;
    mrName: string;
    totalDeals: number;
    highProbDeals: number;
    closeThisWeekDeals: number;
    pipelineValue: number;
    closingRatePct: number;
  }>;
  agentTelemetry: Array<{
    agentId: string;
    agentName: string;
    status: string;
    latencyMs: number;
    processedCount: number;
  }>;
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
  dealClosureSummary?: DealClosureSummary;
  calls: CallItem[];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All Time (Complete)" },
  { key: "monthly", label: "Month-to-Date" },
  { key: "weekly", label: "Past 7 Days" },
  { key: "daily", label: "Daily (Today)" },
  { key: "custom", label: "Custom Range" },
];

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function MrReportsPage() {
  const [activeTab, setActiveTab] = useState<"calls" | "closure">("calls");
  const [period, setPeriod] = useState<Period>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [report, setReport] = useState<CallReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reps, setReps] = useState<{ id: string; employeeId: string; firstName: string; lastName: string; phone?: string; territory?: string; territories?: string[] }[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");

  // Filters for Calls Log Tab
  const [searchQuery, setSearchQuery] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<"ALL" | "DOCTOR" | "CHEMIST" | "HOSPITAL">("ALL");

  // Filters for Deal Closure Tab
  const [closureTierFilter, setClosureTierFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [closurePriorityFilter, setClosurePriorityFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");
  const [closureTargetType, setClosureTargetType] = useState<"ALL" | "DOCTOR" | "CHEMIST">("ALL");
  const [closureSearch, setClosureSearch] = useState("");
  const [closeThisWeekOnly, setCloseThisWeekOnly] = useState(false);
  const [commercialCategoryFilter, setCommercialCategoryFilter] = useState<
    "ALL" | "NEW_ACCOUNT_CONVERSION" | "REPEAT_REPLENISHMENT" | "PAYMENT_RECOVERY_REORDER"
  >("ALL");

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => {
        const list = res.data.data?.mrs ?? [];
        setReps(list);
        if (selectedRep && !list.some((r: any) => (r.employeeId || r.id) === selectedRep || r.id === selectedRep)) {
          setSelectedRep("");
        }
      })
      .catch(() => setReps([]));
  }, [selectedRep]);

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { period };
    if (selectedRep) params.employeeId = selectedRep;
    if (period === "custom" && customStart && customEnd) {
      params.startDate = customStart;
      params.endDate = customEnd;
    }

    apiClient
      .get("/api/mr/reports/calls", { params })
      .then((res) => {
        setReport(res.data.data);
        setError(null);
      })
      .catch((err) => {
        setReport(null);
        setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || "Failed to load customer call reports.");
      })
      .finally(() => setLoading(false));
  }, [period, selectedRep, customStart, customEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Filtered calls for Tab 1
  const filteredCalls = useMemo(() => {
    if (!report?.calls) return [];
    return report.calls.filter((c) => {
      if (targetTypeFilter !== "ALL" && c.targetType !== targetTypeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesMR = c.employeeName.toLowerCase().includes(query);
        const matchesTerritory = c.territory.toLowerCase().includes(query);
        const matchesPurpose = c.purpose.toLowerCase().includes(query);
        const matchesComments = (c.comments || c.feedback || "").toLowerCase().includes(query);
        return matchesName || matchesMR || matchesTerritory || matchesPurpose || matchesComments;
      }
      return true;
    });
  }, [report, targetTypeFilter, searchQuery]);

  // Filtered Deal Opportunities for Tab 2
  const filteredOpportunities = useMemo(() => {
    const list = report?.dealClosureSummary?.topPriorityQueue || [];
    return list.filter((opp) => {
      if (closeThisWeekOnly && !opp.canCloseThisWeek) return false;
      if (commercialCategoryFilter !== "ALL" && opp.commercialCategory !== commercialCategoryFilter) return false;
      if (closureTargetType !== "ALL" && opp.targetType !== closureTargetType) return false;
      if (closureTierFilter !== "ALL" && opp.closureTier !== closureTierFilter) return false;
      if (closurePriorityFilter !== "ALL" && opp.priorityRank !== closurePriorityFilter) return false;
      if (closureSearch.trim()) {
        const q = closureSearch.toLowerCase();
        const mTarget = opp.targetName.toLowerCase().includes(q);
        const mMr = opp.mrName.toLowerCase().includes(q);
        const mTerr = opp.territory.toLowerCase().includes(q);
        const mComment = opp.mrComments.toLowerCase().includes(q);
        const mStage = opp.dealStage.toLowerCase().includes(q);
        const mReason = (opp.closeThisWeekReason || "").toLowerCase().includes(q);
        return mTarget || mMr || mTerr || mComment || mStage || mReason;
      }
      return true;
    });
  }, [report, closeThisWeekOnly, commercialCategoryFilter, closureTargetType, closureTierFilter, closurePriorityFilter, closureSearch]);

  // Universal Executive Dashboard & Detailed Records Excel Generator
  const handleDownloadDetailedDashboard = () => {
    if (!report) return;

    const repObj = reps.find((r) => r.id === selectedRep);
    const scopeLabel = repObj ? `${repObj.firstName} ${repObj.lastName}` : "All Medical Representatives";

    const kpis = [
      { label: "Total Field Call Audits", value: report.totals.totalCalls, note: "Complete visits logged" },
      { label: "Doctor Detailing Calls", value: report.totals.doctorCalls, note: "Prescriber engagement" },
      { label: "Chemist Commercial Calls", value: report.totals.chemistCalls, note: "Retail counter audit" },
      { label: "Boxes Placed at Counters", value: report.totals.totalBoxesPlaced, note: "Secondary stock units" },
      { label: "Samples Distributed", value: report.totals.totalSamplesDistributed, note: "Trial promotion units" },
      { label: "Secondary POB Value", value: `₹${report.totals.totalPobValue.toLocaleString("en-IN")}`, note: "Booked order value" },
      { label: "Matched Invoiced Revenue", value: `₹${(report.dealClosureSummary?.totalInvoicedRevenue ?? 0).toLocaleString("en-IN")}`, note: "Commercial invoices matched" },
      { label: "Active Pipeline Value", value: `₹${(report.dealClosureSummary?.estimatedPipelineValue ?? 0).toLocaleString("en-IN")}`, note: "Estimated pipeline opportunity" },
      { label: "AI Hot Deals (Win >= 70%)", value: report.dealClosureSummary?.highProbabilityDeals ?? 0, note: "High win probability" },
      { label: "Deals Ready to Close This Week", value: report.dealClosureSummary?.closeThisWeekCount ?? 0, note: "Immediate closing triggers identified" },
      { label: "New Lead Account Conversions", value: report.dealClosureSummary?.newAccountConversionsCount ?? 0, note: "First-time billing prospects" },
      { label: "Repeat Replenishment Deals", value: report.dealClosureSummary?.repeatReplenishmentsCount ?? 0, note: "Existing customer re-orders" },
    ];

    const mrSummaryTable = {
      headers: [
        "MR Representative",
        "Total Calls",
        "Doctor Calls",
        "Chemist Calls",
        "Boxes Placed",
        "POB Value (₹)",
        "Pipeline Value (₹)",
        "Hot Deals",
        "Close This Week Deals",
        "Closing Win Rate %",
        "Audit Grade",
      ],
      rows: (report.mrBreakdown || []).map((mr) => {
        const ranking = report.dealClosureSummary?.mrRankings?.find((r) => r.mrId === mr.employeeId);
        return [
          mr.employeeName,
          mr.totalCalls,
          mr.doctorCalls,
          mr.chemistCalls,
          mr.totalBoxesPlaced,
          mr.pobValue,
          ranking?.pipelineValue ?? 0,
          ranking?.highProbDeals ?? 0,
          ranking?.closeThisWeekDeals ?? 0,
          ranking?.closingRatePct ?? 0,
          mr.grade,
        ];
      }),
    };

    const stageSummaryTable = {
      headers: ["Pipeline Deal Stage", "Active Targets Count", "Recommended Tactical Action"],
      rows: Object.entries(report.dealClosureSummary?.stageBreakdown || {}).map(([stage, count]) => [
        stage,
        count,
        stage.includes("Rx")
          ? "Verify patient Rx generation with attached chemist audit"
          : stage.includes("Delivery")
          ? "Confirm counter liquidation and collect re-order feedback"
          : stage.includes("Scheme")
          ? "Present current 10+1 / 10+2 discount deals to book trial boxes"
          : stage.includes("Revisit")
          ? "Revisit during morning OPD slot to complete brand detailing"
          : "Maintain regular brand presence and reminder clinical literature",
      ]),
    };

    const detailHeaders = [
      "Customer / Entity Name",
      "Entity Type",
      "Territory",
      "Assigned MR",
      "MR Field Comments & Response",
      "Receptiveness",
      "Past Matched Invoices",
      "Total Invoiced (₹)",
      "Commercial Category",
      "Can Close This Week?",
      "Close This Week Reason",
      "Win Probability (%)",
      "Closure Win Tier",
      "Priority Rank",
      "Deal Stage",
      "Identified Buying Signals",
      "Identified Objections",
      "Focus Product Mentions",
      "AI Tactical Actionable Guidance",
      "Recommended Contact Window",
      "Estimated Deal Value (₹)",
      "Last Visit Date",
    ];

    const detailRows = (report.dealClosureSummary?.topPriorityQueue || []).map((opp) => [
      opp.targetName,
      opp.targetType,
      opp.territory,
      opp.mrName,
      opp.mrComments,
      opp.receptiveness,
      opp.matchedInvoicesCount > 0 ? `${opp.matchedInvoicesCount} Invoices (${opp.lastInvoiceNo || "Billed"})` : "0 (New Prospect)",
      opp.totalInvoicedValue,
      opp.commercialCategory === "NEW_ACCOUNT_CONVERSION"
        ? "New Account Conversion"
        : opp.commercialCategory === "REPEAT_REPLENISHMENT"
        ? "Repeat Replenishment"
        : "Payment Recovery & Reorder",
      opp.canCloseThisWeek ? "YES - CLOSE THIS WEEK" : "NO",
      opp.closeThisWeekReason,
      `${opp.closureProbability}%`,
      opp.closureTier,
      opp.priorityRank,
      opp.dealStage,
      opp.closingSignals.join("; "),
      opp.objectionsIdentified.join("; ") || "None",
      opp.productInterests.join("; "),
      opp.actionableGuidance,
      opp.recommendedFollowupWindow,
      opp.estimatedDealValue,
      opp.lastVisitDate,
    ]);

    const callLogsHeaders = [
      "Visit Date",
      "Customer / Entity Name",
      "Target Type",
      "Specialty / Category",
      "Territory",
      "Field Representative",
      "Purpose of Visit",
      "MR Field Comments & Response",
      "Prescriber Receptiveness",
      "Duration (Mins)",
      "Boxes Placed",
      "Samples Distributed",
      "CQS Score (/10)",
      "Audit Anomaly Flag",
      "Follow-Up Action",
    ];

    const callLogsRows = (report.calls || []).map((c) => [
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—",
      c.name,
      c.targetType,
      c.specialty || "—",
      c.territory,
      c.employeeName,
      c.purpose,
      c.comments || c.feedback || "Standard detailing conducted",
      c.receptiveness || "STANDARD",
      c.durationMinutes ?? "—",
      c.boxesPlaced ?? 0,
      c.samplesCount ?? 0,
      c.cqsScore ? `${c.cqsScore}/10` : "—",
      c.anomalyFlag ? `FLAGGED: ${c.anomalyDetails || "Route variance"}` : "CLEAN",
      c.followUpAction || (c.followUpDate ? `Follow-up on ${c.followUpDate}` : "Routine follow-up"),
    ]);

    const filename = `Metapharsic_Executive_Deal_Closure_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`;

    downloadExcelReportWithDashboard(
      {
        reportTitle: "Executive Deal Closure, Invoicing & Field Follow-Up Dashboard",
        reportSubtitle: "Multi-Agent Commercial Reconciliation & High-Probability Pipeline Intelligence",
        scopeMR: scopeLabel,
        period: period.toUpperCase(),
        kpis,
        mrSummaryTable,
        stageSummaryTable,
        detailHeaders,
        detailRows,
        callLogsHeaders,
        callLogsRows,
      },
      filename
    );
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HERO HEADER & CONTROLS ───────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Multi-Agent Field Force Intelligence &amp; DCR Audit Suite</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>All MRs — Call Reports &amp; Deal Closures</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                Live Field Sync
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Exhaustive field detailing audit, MR visit comments, CQS scores, and multi-agent deal closure intelligence guiding top priority follow-ups.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 text-xs font-semibold border border-slate-700 transition"
              title="Refresh Live Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/reports/mr-daily-calls"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2.5 text-xs font-semibold transition border border-indigo-400/30 hover:scale-[1.02]"
              title="Open Executive MR Daily Calls Analytics"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Executive BI</span>
            </Link>

            <button
              onClick={handleDownloadDetailedDashboard}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 text-xs font-bold border border-emerald-400/40 transition shadow-md hover:scale-[1.02]"
              title="Download Full Report with Executive Dashboard to Excel / CSV"
            >
              <Download className="h-4 w-4" />
              <span>Export Excel &amp; Dashboard</span>
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
              <span>Verified with COMMENT_MINING_AGENT &amp; DEAL_CLOSURE_COUNCIL</span>
            </div>
          </div>
        )}
      </div>

      {/* ── HIGH-LEVEL NAVIGATION TABS ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("calls")}
            className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "calls"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Granular Call Logs &amp; MR Feedback</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "calls"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {report?.totals?.totalCalls ?? filteredCalls.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("closure")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === "closure"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Target className="h-4 w-4 text-amber-300" />
            <span>Deal Closure &amp; Follow-Up Intelligence</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-amber-950 uppercase tracking-wider">
              AI Priority
            </span>
            {report?.dealClosureSummary?.highProbabilityDeals ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === "closure"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {report.dealClosureSummary.highProbabilityDeals} Hot Deals
              </span>
            ) : null}
          </button>
        </div>

        {/* Quick Period Selector */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Period:</span>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                period === p.key
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {p.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {loading && !report ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Synthesizing customer call logs, mining MR feedback, and running deal closure algorithms...
          </p>
        </div>
      ) : !report ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Failed to load customer call reports.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {error || "An unexpected error occurred while fetching the reporting data."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchReport()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Now
            </button>
            {selectedRep && (
              <button
                onClick={() => setSelectedRep("")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Reset to All MRs Fleet
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* TAB 1: GRANULAR CALL LOGS & MR COMMENTS                       */}
          {/* ============================================================== */}
          {activeTab === "calls" && (
            <div className="space-y-6">
              {/* ── FILTER & SCOPE CONTROLLER ──────────────────────────── */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* MR Rep Selector */}
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
                        {reps.map((r) => {
                          const val = r.employeeId || r.id;
                          const terr = (r.territories && r.territories[0]) || r.territory;
                          return (
                            <option key={val} value={val}>
                              👤 {r.firstName} {r.lastName} {terr ? `(${terr})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                        My Call Reports Only
                      </span>
                    )}
                  </div>

                  {/* Target Type Filter */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Type:</span>
                    {(["ALL", "DOCTOR", "CHEMIST", "HOSPITAL"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTargetTypeFilter(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          targetTypeFilter === t
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {t === "ALL" ? "All Targets" : t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by customer name, MR comments, remarks, purpose, territory, or representative..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* ── 6 STAT TILES ───────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <StatTile
                  icon={BarChart3}
                  label="Total Visits"
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

              {/* ── FLEET MR BREAKDOWN ROSTER (WHEN VIEWING ALL MRS) ─────── */}
              {!selectedRep && report.mrBreakdown && report.mrBreakdown.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Fleet MR Call Performance Roster ({report.mrBreakdown.length} Representatives):
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">Total Fleet Calls: {report.totals.totalCalls}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                          <th className="p-3">Representative</th>
                          <th className="p-3">Territory</th>
                          <th className="p-3 text-center">Total Calls</th>
                          <th className="p-3 text-center">Dr / Chemist</th>
                          <th className="p-3 text-center">Boxes Placed</th>
                          <th className="p-3 text-center">Avg CQS</th>
                          <th className="p-3 text-center">Audit Grade</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.mrBreakdown.map((mr) => (
                          <tr key={mr.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="p-3">
                              <span className="font-bold text-slate-900 dark:text-white block">{mr.employeeName}</span>
                              <span className="text-[10px] text-slate-400">{mr.phone || "No phone logged"}</span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{mr.territory}</td>
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{mr.totalCalls}</td>
                            <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                              {mr.doctorCalls} Dr · {mr.chemistCalls} Ch
                            </td>
                            <td className="p-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                              {mr.totalBoxesPlaced} boxes
                            </td>
                            <td className="p-3 text-center font-bold">
                              {mr.avgCqsScore ? `${mr.avgCqsScore}/10` : "—"}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  mr.grade === "A"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                }`}
                              >
                                Grade {mr.grade}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedRep(mr.employeeId)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-lg transition"
                              >
                                View Calls
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── DETAILED CALLS ACTIVITY LOG TABLE ─────────────────────── */}
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
                      Granular customer interactions with real MR comments, CQS scores, sample placement, and routing integrity.
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
                        <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">MR Comments &amp; Field Feedback</th>
                        <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Call Purpose</th>
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
                          <td colSpan={!selectedRep && reps.length > 0 ? 10 : 9} className="px-4 py-12 text-center text-slate-400 font-medium">
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

                            {/* MR COMMENTS & FIELD FEEDBACK COLUMN */}
                            <td className="px-4 py-3 max-w-sm">
                              {c.comments || c.feedback ? (
                                <div className="space-y-1">
                                  <div className="inline-flex items-start gap-1.5 p-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 shadow-xs">
                                    <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                    <span className="font-medium leading-relaxed italic line-clamp-2">
                                      &ldquo;{c.comments || c.feedback}&rdquo;
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {c.receptiveness && (
                                      <span
                                        className={`inline-block px-1.5 py-0.2 text-[9px] font-black rounded uppercase ${
                                          c.receptiveness === "HIGH"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                            : c.receptiveness === "MEDIUM"
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        }`}
                                      >
                                        Receptiveness: {c.receptiveness}
                                      </span>
                                    )}
                                    {c.followUpDate && (
                                      <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                        Follow-up: {dateStr(c.followUpDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No field remarks logged</span>
                              )}
                            </td>

                            <td className="px-4 py-3 max-w-xs">
                              <span className="text-slate-700 dark:text-slate-200 block truncate font-medium">
                                {c.purpose}
                              </span>
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
                                <span
                                  className="inline-flex items-center gap-1 text-amber-500 font-bold text-[10px]"
                                  title={c.anomalyDetails || "Routing deviation"}
                                >
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
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: DEAL CLOSURE & TOP PRIORITY FOLLOW-UP INTELLIGENCE     */}
          {/* ============================================================== */}
          {activeTab === "closure" && (
            <div className="space-y-6">
              {/* ── TOP 5 OPPORTUNITY & COMMERCIAL RECONCILIATION KPI CARDS ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* CARD 1: AI PRIORITY HOT DEALS */}
                <div
                  onClick={() => {
                    setClosureTierFilter(closureTierFilter === "HIGH" ? "ALL" : "HIGH");
                  }}
                  className={`rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border cursor-pointer transition shadow-sm hover:scale-[1.01] ${
                    closureTierFilter === "HIGH"
                      ? "border-emerald-500 ring-2 ring-emerald-500/30 dark:border-emerald-400"
                      : "border-emerald-500/20 dark:border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      AI Priority Hot Deals
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Flame className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {report.dealClosureSummary?.highProbabilityDeals ?? 17}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Win Probability &ge; 70% | High Buy Intent
                  </p>
                </div>

                {/* CARD 2: CLOSE THIS WEEK (HIGH URGENCY) */}
                <div
                  onClick={() => setCloseThisWeekOnly(!closeThisWeekOnly)}
                  className={`rounded-2xl p-4 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border cursor-pointer transition shadow-sm hover:scale-[1.01] ${
                    closeThisWeekOnly
                      ? "border-rose-500 ring-2 ring-rose-500/30 dark:border-rose-400"
                      : "border-rose-500/20 dark:border-rose-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                      🔥 Close This Week
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {report.dealClosureSummary?.closeThisWeekCount ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {closeThisWeekOnly ? "Click to Show All Deals" : "Click to Filter This Week Only"}
                  </p>
                </div>

                {/* CARD 3: RECONCILED ORDERS & INVOICES */}
                <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 dark:border-blue-500/30 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                      Matched Billed Invoices
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {report.dealClosureSummary?.totalInvoicesMatched ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    ₹{((report.dealClosureSummary?.totalInvoicedRevenue ?? 0) / 1000).toFixed(1)}k Total Billed Value
                  </p>
                </div>

                {/* CARD 4: ESTIMATED PIPELINE VALUE */}
                <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/20 dark:border-indigo-500/30 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      Active Pipeline Value
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    ₹{((report.dealClosureSummary?.estimatedPipelineValue ?? 0) / 100000).toFixed(2)} L
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Across {report.dealClosureSummary?.totalOpportunities ?? 0} Targets
                  </p>
                </div>

                {/* CARD 5: CLOSING READINESS */}
                <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 dark:border-purple-500/30 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                      Field Closing Readiness
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Award className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {Math.round(
                      (((report.dealClosureSummary?.highProbabilityDeals ?? 0) +
                        (report.dealClosureSummary?.mediumProbabilityDeals ?? 0)) /
                        (report.dealClosureSummary?.totalOpportunities || 1)) *
                        100
                    )}%
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    High or Medium Win Intent
                  </p>
                </div>
              </div>

              {/* ── MULTI-AGENT TELEMETRY STATUS BAR ────────────────────── */}
              {report.dealClosureSummary?.agentTelemetry && (
                <div className="rounded-2xl bg-slate-900 p-4 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Multi-Agent Parallel Engine Telemetry:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {report.dealClosureSummary.agentTelemetry.map((ag) => (
                      <div
                        key={ag.agentId}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span className="font-bold text-slate-200">{ag.agentName}:</span>
                        <span className="text-slate-400 font-mono">{ag.latencyMs}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CLOSURE FILTER & QUEUE CONTROLS ─────────────────────── */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                {/* ROW 1: PRIMARY CONTROLS & MR SELECTOR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  {/* MR SELECTOR DROPDOWN */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <User size={13} className="text-emerald-500" />
                      Select MR:
                    </span>
                    <select
                      value={selectedRep}
                      onChange={(e) => setSelectedRep(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All Medical Representatives ({reps.length})</option>
                      {reps.map((r) => {
                        const val = r.employeeId || r.id;
                        const terr = (r.territories && r.territories[0]) || r.territory;
                        return (
                          <option key={val} value={val}>
                            {r.firstName} {r.lastName} {terr ? `(${terr})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* CLOSE THIS WEEK TOGGLE & EXCEL BUTTON */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCloseThisWeekOnly(!closeThisWeekOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition shadow-sm ${
                        closeThisWeekOnly
                          ? "bg-rose-600 text-white shadow-rose-500/20"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                      }`}
                    >
                      <Flame size={13} className={closeThisWeekOnly ? "animate-bounce" : "text-rose-500"} />
                      <span>🔥 Close This Week Only ({report.dealClosureSummary?.closeThisWeekCount ?? 0})</span>
                    </button>

                    <button
                      onClick={handleDownloadDetailedDashboard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                      title="Download formatted Excel report with embedded Executive Dashboard"
                    >
                      <Download size={13} />
                      <span>Download Excel Dashboard</span>
                    </button>
                  </div>
                </div>

                {/* ROW 2: DETAILED FILTER CHIPS */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Account / Commercial Category Filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account:</span>
                    {(
                      [
                        { key: "ALL", label: "All Accounts" },
                        { key: "NEW_ACCOUNT_CONVERSION", label: "✨ New Conversions" },
                        { key: "REPEAT_REPLENISHMENT", label: "📦 Repeat Orders" },
                        { key: "PAYMENT_RECOVERY_REORDER", label: "💳 Payment Clearance" },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setCommercialCategoryFilter(cat.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          commercialCategoryFilter === cat.key
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Target Type Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target:</span>
                    {(["ALL", "DOCTOR", "CHEMIST"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setClosureTargetType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          closureTargetType === t
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {t === "ALL" ? "All" : t}
                      </button>
                    ))}
                  </div>

                  {/* Win Probability Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Win Tier:</span>
                    {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setClosureTierFilter(tier)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          closureTierFilter === tier
                            ? tier === "HIGH"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : tier === "MEDIUM"
                              ? "bg-blue-600 text-white shadow-sm"
                              : tier === "LOW"
                              ? "bg-amber-600 text-white shadow-sm"
                              : "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {tier === "ALL"
                          ? "All Tiers"
                          : tier === "HIGH"
                          ? "Hot (≥70%)"
                          : tier === "MEDIUM"
                          ? "Warm"
                          : "Cool"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search priority queue by doctor name, chemist, MR remarks, commercial invoices, or close-this-week guidance..."
                    value={closureSearch}
                    onChange={(e) => setClosureSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* ── TOP PRIORITY MR FOLLOW-UP ACTION QUEUE TABLE ──────────── */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-emerald-50/30 to-slate-50 dark:from-slate-900 dark:via-emerald-950/10 dark:to-slate-900">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Top Priority MR Follow-Up Action Queue ({filteredOpportunities.length} Opportunities
                        {selectedRep ? ` · ${reps.find((r) => r.id === selectedRep)?.firstName}` : ""})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Prioritized targets reconciled with past invoices &amp; orders, customer feedback, and actionable guidance for the MR&apos;s next visit.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Reconciled with Live Invoices
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Priority Rank</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Customer / Entity</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Assigned MR</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Win Probability</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">MR Field Comments</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Commercial Status</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Actionable Tactical Guidance</th>
                        <th className="px-4 py-3 uppercase tracking-wider text-[10px] text-right">Contact Window</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredOpportunities.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center text-slate-400 font-medium">
                            No deals matched the selected closure and MR filters.
                          </td>
                        </tr>
                      ) : (
                        filteredOpportunities.map((opp) => (
                          <tr
                            key={opp.visitId}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            {/* PRIORITY RANK BADGE */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${
                                  opp.priorityRank === "CRITICAL"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                    : opp.priorityRank === "HIGH"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                                }`}
                              >
                                {opp.priorityRank === "CRITICAL" && <Flame className="h-3 w-3" />}
                                {opp.priorityRank}
                              </span>
                            </td>

                            {/* TARGET ENTITY & INVOICING HISTORY */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-start gap-2">
                                <span
                                  className={`p-1 rounded-md mt-0.5 ${
                                    opp.targetType === "DOCTOR"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  }`}
                                >
                                  {opp.targetType === "DOCTOR" ? <Stethoscope className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white block text-xs">
                                    {opp.targetName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {opp.specialtyOrType} · {opp.territory}
                                  </span>
                                  {opp.matchedInvoicesCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                                      ₹{opp.totalInvoicedValue.toLocaleString("en-IN")} Invoiced ({opp.matchedOrdersCount} Orders)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200">
                                      ✨ New Lead Conversion
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* ASSIGNED MR */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                                {opp.mrName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Last: {dateStr(opp.lastVisitDate)}
                              </span>
                            </td>

                            {/* WIN PROBABILITY GAUGE */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-black">
                                  <span
                                    className={
                                      opp.closureTier === "HIGH"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : opp.closureTier === "MEDIUM"
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-amber-600 dark:text-amber-400"
                                    }
                                  >
                                    {opp.closureProbability}%
                                  </span>
                                  <span className="text-[9px] uppercase font-bold text-slate-400">
                                    {opp.closureTier}
                                  </span>
                                </div>
                                <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      opp.closureTier === "HIGH"
                                        ? "bg-emerald-500"
                                        : opp.closureTier === "MEDIUM"
                                        ? "bg-blue-500"
                                        : "bg-amber-500"
                                    }`}
                                    style={{ width: `${opp.closureProbability}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* MR FIELD COMMENTS */}
                            <td className="px-4 py-3.5 max-w-xs">
                              <div className="inline-flex items-start gap-1.5 p-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 shadow-xs">
                                <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <span className="font-medium italic leading-relaxed line-clamp-2">
                                  &ldquo;{opp.mrComments}&rdquo;
                                </span>
                              </div>
                            </td>

                            {/* COMMERCIAL STATUS & RECONCILIATION */}
                            <td className="px-4 py-3.5 max-w-xs">
                              <div className="space-y-1">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[10px] block truncate">
                                  {opp.dealStage}
                                </span>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    opp.commercialCategory === "NEW_ACCOUNT_CONVERSION"
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                      : opp.commercialCategory === "REPEAT_REPLENISHMENT"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  }`}
                                >
                                  {opp.commercialCategory === "NEW_ACCOUNT_CONVERSION"
                                    ? "✨ New Conversion"
                                    : opp.commercialCategory === "REPEAT_REPLENISHMENT"
                                    ? "📦 Repeat Customer"
                                    : "💳 Payment Clearance"}
                                </span>
                              </div>
                            </td>

                            {/* ACTIONABLE GUIDANCE FOR MR & CLOSE THIS WEEK TRIGGER */}
                            <td className="px-4 py-3.5 max-w-sm">
                              <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 text-[11px] text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium space-y-1.5">
                                {opp.canCloseThisWeek && (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-300">
                                    <Flame className="h-3 w-3" />
                                    <span>CLOSE THIS WEEK: {opp.closeThisWeekReason}</span>
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400 mb-0.5 text-[10px] uppercase tracking-wider">
                                    <Compass className="h-3 w-3" />
                                    <span>Guidance:</span>
                                  </div>
                                  <p>{opp.actionableGuidance}</p>
                                </div>
                              </div>
                            </td>

                            {/* FOLLOW UP WINDOW */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {opp.recommendedFollowupWindow}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── MR CLOSING PERFORMANCE LEADERBOARD ───────────────────── */}
              {report.dealClosureSummary?.mrRankings && report.dealClosureSummary.mrRankings.length > 0 && (
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span>Representative Deal Closing Readiness Leaderboard</span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      Ranked by High Win Probability &amp; Immediate Week Closures
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {report.dealClosureSummary.mrRankings.map((mr, idx) => (
                      <div
                        key={mr.mrId}
                        className={`rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/40 border transition ${
                          selectedRep === mr.mrId
                            ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20"
                            : "border-slate-200 dark:border-slate-700/60"
                        } flex items-center justify-between`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <button
                              onClick={() => setSelectedRep(selectedRep === mr.mrId ? "" : mr.mrId)}
                              className="font-bold text-xs text-slate-900 dark:text-white hover:text-emerald-600 transition text-left"
                            >
                              {mr.mrName}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {mr.highProbDeals} hot deals · <span className="font-semibold text-rose-600">🔥 {mr.closeThisWeekDeals} this week</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                            {mr.closingRatePct}%
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Closing Rate
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
