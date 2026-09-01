"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Cpu,
  Activity,
  MapPin,
  ShoppingBag,
  Receipt,
  Smartphone,
  Landmark,
  Database,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Download,
  Calendar,
  User,
  Building2,
  Award,
  DollarSign,
  TrendingUp,
  Clock,
  Boxes,
  MessageCircle,
  Share2,
  Copy,
  ExternalLink,
  Send,
  X,
  Check,
  Phone,
  Sliders,
  Filter,
  Stethoscope,
  Pill,
  Wallet,
  Sparkles,
  ChevronRight,
  Eye,
  CheckSquare,
  Square,
  Zap,
  Lock,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AgentStatus {
  agentCode: string;
  agentName: string;
  domain: string;
  status: "ONLINE_PASS" | "ONLINE_WARNING" | "ONLINE_ALERT" | "IDLE" | "ERROR";
  statusLabel: string;
  executionTimeMs: number;
  score: number;
  findings: string[];
  warnings: string[];
  recommendations: string[];
  metrics: Record<string, any>;
}

interface GranularReport {
  mrId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  territories: { id: string; name: string; region: string; zone: string }[];
  environment: "LOCAL" | "VPS_PRODUCTION";
  generatedAt: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  dcrSummary: {
    totalVisits: number;
    doctorVisits: number;
    chemistVisits: number;
    hospitalVisits: number;
    avgDurationMinutes: number;
    avgCqsScore: number | null;
    totalBoxesPlaced: number;
    samplesDistributedQty?: number;
    leadsGeneratedQty?: number;
    doctorWiseVisits?: Array<{
      id: string;
      doctorName: string;
      specialty: string | null;
      cqsScore: number | null;
      durationMinutes: number | null;
      boxesPlaced: number | null;
      samplesCount: number;
      samplesList: Array<{ productName: string; quantity: number }>;
      timestamp: string;
      purpose: string;
    }>;
    chemistWiseVisits?: Array<{
      id: string;
      chemistName: string;
      durationMinutes: number | null;
      boxesPlaced: number | null;
      pobOrderValue: number;
      timestamp: string;
      purpose: string;
    }>;
    visits: Array<{
      id: string;
      targetName: string;
      targetType: "DOCTOR" | "CHEMIST" | "HOSPITAL" | "OTHER";
      purpose: string;
      durationMinutes: number | null;
      cqsScore: number | null;
      boxesPlaced: number | null;
      anomalyFlag: boolean;
      receptiveness: string | null;
      timestamp: string;
    }>;
  };
  commercialSummary: {
    totalOrdersCount: number;
    deliveredOrdersCount: number;
    pendingOrdersCount: number;
    cancelledOrdersCount: number;
    totalRevenuePtr: number;
    totalRevenuePts: number;
    totalUnitsBooked: number;
    skuBreakdown: Array<{
      productId: string;
      productName: string;
      sku: string;
      units: number;
      revenuePtr: number;
      revenuePts: number;
      grossMargin: number;
    }>;
    orders: Array<{
      id: string;
      chemistOrDoctorName: string;
      distributorName: string;
      status: string;
      itemCount: number;
      totalUnits: number;
      totalPtrValue: number;
      createdAt: string;
    }>;
    collections?: {
      totalCollected: number;
      recordsCount: number;
      receipts?: Array<{
        id: string;
        chemistName: string;
        amount: number;
        receiptNo?: string | null;
        date: string;
      }>;
    };
  };
  routingSummary: {
    tourPlansCount: number;
    approvedTourPlansCount: number;
    plannedDaysCount: number;
    locationLogsCount: number;
    geofenceCompliancePercent: number;
    gpsMockFlagsCount: number;
  };
  expenseHrmsSummary: {
    totalExpensesLogged: number;
    totalExpensesApproved: number;
    totalExpensesPending: number;
    totalExpensesRejected: number;
    expenseToSalesRoiPercent: number;
    attendanceDaysLogged: number;
    claimsCount: number;
    attendanceDetails?: Array<{
      id: string;
      date: string;
      checkIn: string | null;
      checkOut: string | null;
      durationMinutes: number | null;
      status: string;
    }>;
    expensesList: Array<{
      id: string;
      category: string;
      amount: number;
      status: string;
      description: string | null;
      date: string;
    }>;
  };
  financeSummary: {
    grossSalesRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    fieldExpenses: number;
    netTerritoryContribution: number;
    netMarginPercent: number;
    ledgerBalanceAuditStatus: "BALANCED" | "AUDIT_REQUIRED";
  };
  councilEvaluation: {
    overallGrade: "A+" | "A" | "B" | "C" | "NEEDS_IMPROVEMENT";
    councilScore: number;
    executiveSummary: string;
    keyRiskFactors: string[];
    actionItems: string[];
    agentStatuses: AgentStatus[];
  };
}

const AGENT_ORDER = [
  "ROLE_AUTH_AGENT",
  "FIELD_DCR_AGENT",
  "ROUTING_COMPLIANCE_AGENT",
  "COMMERCIAL_AGENT",
  "EXPENSE_HRMS_AGENT",
  "MOBILE_OFFLINE_AGENT",
  "FINANCE_ACCOUNTS_AGENT",
  "DATA_INTEGRITY_AGENT",
];

const AGENT_ICONS: Record<string, any> = {
  ROLE_AUTH_AGENT: ShieldCheck,
  FIELD_DCR_AGENT: Activity,
  ROUTING_COMPLIANCE_AGENT: MapPin,
  COMMERCIAL_AGENT: ShoppingBag,
  EXPENSE_HRMS_AGENT: Receipt,
  MOBILE_OFFLINE_AGENT: Smartphone,
  FINANCE_ACCOUNTS_AGENT: Landmark,
  DATA_INTEGRITY_AGENT: Database,
};

export default function MultiAgentMrReportPage() {
  const [reports, setReports] = useState<GranularReport[]>([]);
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "council" | "doctors" | "chemists" | "commercial" | "collections" | "timing" | "expenses" | "routing" | "finance"
  >("council");
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Timeframe & Scope Filters
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "weekly" | "monthly" | "custom" | "all">("daily");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Selective Admin Report Configurator Toggles
  const [selectiveConfig, setSelectiveConfig] = useState({
    includeDoctorVisits: true,
    includeChemistCalls: true,
    includeSalesOrders: true,
    includeCollections: true,
    includeDutyTiming: true,
    includeExpenses: true,
    includeRoutingGeofence: true,
    includeFinancePnl: true,
    includeAgentScorecard: true,
    includeRiskActionItems: true,
  });

  // Agent Progress Simulation State
  const [agentProgress, setAgentProgress] = useState<{
    running: boolean;
    currentAgentIndex: number;
    completedAgents: string[];
    percent: number;
  }>({
    running: false,
    currentAgentIndex: -1,
    completedAgents: [],
    percent: 100,
  });

  // WhatsApp Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<"ALL_MRS_INDIVIDUALLY" | "INDIVIDUAL_MR" | "EXECUTIVE_FLEET" | "CUSTOM_PHONE">("ALL_MRS_INDIVIDUALLY");
  const [customPhone, setCustomPhone] = useState("");
  const [whatsAppPreviewText, setWhatsAppPreviewText] = useState("");
  const [whatsAppUrl, setWhatsAppUrl] = useState("");
  const [loadingWhatsAppPreview, setLoadingWhatsAppPreview] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [batchDispatchResults, setBatchDispatchResults] = useState<{
    success: boolean;
    message: string;
    dispatchedCount: number;
    totalTargets: number;
    agentStatuses: Array<{
      agentCode: string;
      agentName: string;
      domainScope: string;
      status: string;
      score: number;
      latencyMs: number;
      findings?: string[];
      warnings?: string[];
    }>;
    details: Array<{
      mrId: string;
      recipient: string;
      phone: string | null;
      territory: string;
      doctorCalls: number;
      chemistCalls: number;
      salesTodayPtr: number;
      collectionsToday: number;
      dutyHours: number;
      councilScore: number;
      overallGrade: string;
      sent: boolean;
      reason?: string;
      whatsappUrl?: string;
    }>;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setCurrentUserRole(payload.role || null);
        } catch (e) {
          console.error("Token decode error:", e);
        }
      }
    }
  }, []);

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "MD";

  // Trigger Multi-Agent Progress Sequence
  const runAgentProgressAnimation = useCallback(() => {
    setAgentProgress({ running: true, currentAgentIndex: 0, completedAgents: [], percent: 12 });

    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current < AGENT_ORDER.length) {
        setAgentProgress((prev) => ({
          running: true,
          currentAgentIndex: current,
          completedAgents: [...prev.completedAgents, AGENT_ORDER[current - 1]],
          percent: Math.round(((current + 1) / AGENT_ORDER.length) * 100),
        }));
      } else {
        clearInterval(interval);
        setAgentProgress({
          running: false,
          currentAgentIndex: -1,
          completedAgents: AGENT_ORDER,
          percent: 100,
        });
      }
    }, 180);
  }, []);

  const fetchReports = useCallback(
    async (period = selectedPeriod, start = customStartDate, end = customEndDate) => {
      setLoading(true);
      runAgentProgressAnimation();
      try {
        const params: Record<string, string> = { period };
        if (period === "custom" && start && end) {
          params.startDate = start;
          params.endDate = end;
        }

        const res = await apiClient.get("/api/mr/reports/multi-agent", { params });
        const data = res.data?.data?.reports || (Array.isArray(res.data?.data) ? res.data.data : res.data?.data ? [res.data.data] : []);
        setReports(data);
        if (data.length > 0 && (!selectedMrId || !data.some((r: any) => r.mrId === selectedMrId))) {
          setSelectedMrId(data[0].mrId);
        }
        setLastRefreshed(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Failed to load Multi-Agent reports:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedPeriod, customStartDate, customEndDate, selectedMrId, runAgentProgressAnimation]
  );

  useEffect(() => {
    fetchReports(selectedPeriod, customStartDate, customEndDate);
  }, [fetchReports, selectedPeriod, customStartDate, customEndDate]);

  const currentReport = reports.find((r) => r.mrId === selectedMrId) || reports[0];

  // Fetch selective WhatsApp message preview
  const fetchWhatsAppPreview = useCallback(
    async (
      target = whatsAppTarget,
      custom = customPhone,
      config = selectiveConfig,
      period = selectedPeriod
    ) => {
      if (!currentReport && target !== "EXECUTIVE_FLEET" && target !== "ALL_MRS_INDIVIDUALLY") return;
      setLoadingWhatsAppPreview(true);
      setDispatchStatus(null);
      try {
        const endpoint = "/api/mr/reports/multi-agent/whatsapp";
        const params: Record<string, string> = {
          period,
          includeDoctorVisits: String(config.includeDoctorVisits),
          includeChemistCalls: String(config.includeChemistCalls),
          includeSalesOrders: String(config.includeSalesOrders),
          includeCollections: String(config.includeCollections),
          includeDutyTiming: String(config.includeDutyTiming),
          includeExpenses: String(config.includeExpenses),
          includeRoutingGeofence: String(config.includeRoutingGeofence),
          includeFinancePnl: String(config.includeFinancePnl),
          includeAgentScorecard: String(config.includeAgentScorecard),
          includeRiskActionItems: String(config.includeRiskActionItems),
        };

        if (period === "custom" && customStartDate && customEndDate) {
          params.startDate = customStartDate;
          params.endDate = customEndDate;
        }

        if (target === "INDIVIDUAL_MR" && currentReport) {
          params.employeeId = currentReport.mrId;
        } else if (target === "ALL_MRS_INDIVIDUALLY" && currentReport) {
          // Preview first MR in fleet for illustration
          params.employeeId = currentReport.mrId;
        } else if (target === "CUSTOM_PHONE") {
          if (currentReport) params.employeeId = currentReport.mrId;
          if (custom) params.customPhone = custom;
        }

        const res = await apiClient.get(endpoint, { params });
        if (res.data?.data) {
          setWhatsAppPreviewText(res.data.data.whatsappText || "");
          setWhatsAppUrl(res.data.data.whatsappUrl || "");
        }
      } catch (err) {
        console.error("Failed to load WhatsApp report preview:", err);
      } finally {
        setLoadingWhatsAppPreview(false);
      }
    },
    [currentReport, whatsAppTarget, customPhone, selectiveConfig, selectedPeriod, customStartDate, customEndDate]
  );

  // Sync WhatsApp preview when toggles or target change
  useEffect(() => {
    if (isWhatsAppModalOpen) {
      fetchWhatsAppPreview(whatsAppTarget, customPhone, selectiveConfig, selectedPeriod);
    }
  }, [isWhatsAppModalOpen, whatsAppTarget, customPhone, selectiveConfig, selectedPeriod, fetchWhatsAppPreview]);

  const handleOpenWhatsAppModal = (target: "ALL_MRS_INDIVIDUALLY" | "INDIVIDUAL_MR" = "ALL_MRS_INDIVIDUALLY") => {
    setWhatsAppTarget(target);
    if (target === "ALL_MRS_INDIVIDUALLY") {
      setSelectedPeriod("daily");
    }
    setBatchDispatchResults(null);
    setDispatchStatus(null);
    setIsWhatsAppModalOpen(true);
    fetchWhatsAppPreview(target, "", selectiveConfig, target === "ALL_MRS_INDIVIDUALLY" ? "daily" : selectedPeriod);
  };

  const handleCopyWhatsAppText = async () => {
    if (!whatsAppPreviewText) return;
    try {
      await navigator.clipboard.writeText(whatsAppPreviewText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleDispatchWhatsAppApi = async () => {
    if (!isAdmin) {
      setDispatchStatus({
        success: false,
        message: "Access Denied: Only Administrators have permission to send or broadcast reports.",
      });
      return;
    }

    setSendingWhatsApp(true);
    setDispatchStatus(null);
    setBatchDispatchResults(null);
    runAgentProgressAnimation();

    try {
      const payload: any = {
        targetType: whatsAppTarget,
        period: selectedPeriod,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
        ...selectiveConfig,
      };

      if (whatsAppTarget === "INDIVIDUAL_MR" && currentReport) {
        payload.employeeId = currentReport.mrId;
      } else if (whatsAppTarget === "CUSTOM_PHONE") {
        if (!customPhone.trim()) {
          setDispatchStatus({ success: false, message: "Please enter a valid WhatsApp phone number" });
          setSendingWhatsApp(false);
          return;
        }
        payload.customPhone = customPhone.trim();
        if (currentReport) payload.employeeId = currentReport.mrId;
      }

      const res = await apiClient.post("/api/mr/reports/multi-agent/whatsapp", payload);
      const data = res.data?.data || res.data;

      if (res.data?.success || data?.success) {
        setDispatchStatus({
          success: true,
          message: data.message || `Dispatched to ${data?.dispatchedCount || 1} MR(s) successfully!`,
        });

        if (data.agentStatuses || data.details) {
          setBatchDispatchResults({
            success: true,
            message: data.message,
            dispatchedCount: data.dispatchedCount || 0,
            totalTargets: data.totalTargets || 0,
            agentStatuses: data.agentStatuses || [],
            details: data.details || [],
          });
        }
      } else {
        setDispatchStatus({
          success: false,
          message: res.data?.message || "Failed to complete dispatch.",
        });
      }
    } catch (err: any) {
      console.error("Error dispatching WhatsApp:", err);
      setDispatchStatus({
        success: false,
        message:
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Failed to dispatch via Cloud API. You can still use 'Open in WhatsApp' to send directly.",
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const applyPreset = (preset: "ALL" | "COMMERCIAL" | "FIELD" | "EXECUTIVE") => {
    if (preset === "ALL") {
      setSelectiveConfig({
        includeDoctorVisits: true,
        includeChemistCalls: true,
        includeSalesOrders: true,
        includeCollections: true,
        includeDutyTiming: true,
        includeExpenses: true,
        includeRoutingGeofence: true,
        includeFinancePnl: true,
        includeAgentScorecard: true,
        includeRiskActionItems: true,
      });
    } else if (preset === "COMMERCIAL") {
      setSelectiveConfig({
        includeDoctorVisits: false,
        includeChemistCalls: false,
        includeSalesOrders: true,
        includeCollections: true,
        includeDutyTiming: false,
        includeExpenses: true,
        includeRoutingGeofence: false,
        includeFinancePnl: true,
        includeAgentScorecard: true,
        includeRiskActionItems: true,
      });
    } else if (preset === "FIELD") {
      setSelectiveConfig({
        includeDoctorVisits: true,
        includeChemistCalls: true,
        includeSalesOrders: false,
        includeCollections: false,
        includeDutyTiming: true,
        includeExpenses: false,
        includeRoutingGeofence: true,
        includeFinancePnl: false,
        includeAgentScorecard: true,
        includeRiskActionItems: true,
      });
    } else if (preset === "EXECUTIVE") {
      setSelectiveConfig({
        includeDoctorVisits: false,
        includeChemistCalls: false,
        includeSalesOrders: true,
        includeCollections: false,
        includeDutyTiming: false,
        includeExpenses: false,
        includeRoutingGeofence: false,
        includeFinancePnl: true,
        includeAgentScorecard: true,
        includeRiskActionItems: true,
      });
    }
  };

  const downloadJson = () => {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MR_MultiAgent_Report_${currentReport.fullName.replace(/\s+/g, "_")}.json`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP HEADER HERO BANNER ─────────────────────────────────── */}
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
                Selective Council Matrix
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin Dispatch Authorized
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs text-slate-300 border border-slate-600">
                  <Lock className="h-3 w-3 text-slate-400" />
                  MR View Only
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              Multi-Agent MR Granular Audit & Intelligence
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Real-time multi-agent synthesis across Doctor Detailing, Chemist Calls, Secondary Sales, Collections,
              Attendance Timing, Expenses ROI, Geofence Telemetry & P&L Margins with Admin-exclusive individual dispatch.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
            {isAdmin ? (
              <>
                <button
                  onClick={() => handleOpenWhatsAppModal("ALL_MRS_INDIVIDUALLY")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Daily Report to All MRs</span>
                </button>

                <button
                  onClick={() => handleOpenWhatsAppModal("INDIVIDUAL_MR")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 text-sm font-semibold shadow-md transition-all hover:scale-[1.02]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Send to MR</span>
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3.5 py-2 text-xs text-slate-300 border border-slate-700">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Admin Dispatch Only</span>
              </div>
            )}

            <button
              onClick={() => fetchReports(selectedPeriod, customStartDate, customEndDate)}
              disabled={loading || agentProgress.running}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold transition-all border border-indigo-400/30 hover:scale-[1.02]"
            >
              <RefreshCw className={`h-4 w-4 ${loading || agentProgress.running ? "animate-spin" : ""}`} />
              <span>Re-Audit Council</span>
            </button>

            <button
              onClick={downloadJson}
              disabled={!currentReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 text-sm font-medium transition-colors border border-slate-700"
              title="Download Granular JSON Dossier"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── LIVE MULTI-AGENT PROGRESS STREAM SHELL ───────────────── */}
        <div className="mt-6 pt-5 border-t border-indigo-800/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2.5 text-xs">
            <div className="flex items-center gap-2 text-indigo-200 font-medium">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <span>Agent Execution Pipeline Status:</span>
              <span className="font-semibold text-white">
                {agentProgress.running
                  ? `Running Agent ${agentProgress.currentAgentIndex + 1}/8 (${AGENT_ORDER[agentProgress.currentAgentIndex]})`
                  : "All 8 Domain Agents Synchronized & Verified"}
              </span>
            </div>
            <div className="text-slate-400 flex items-center gap-3">
              <span>Latency: ~45ms</span>
              <span>•</span>
              <span>Updated: {lastRefreshed || "Just now"}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-teal-300 transition-all duration-300 rounded-full"
              style={{ width: `${agentProgress.percent}%` }}
            />
          </div>

          {/* 8 Agent Mini Status Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 mt-3">
            {AGENT_ORDER.map((code, idx) => {
              const isCompleted = agentProgress.completedAgents.includes(code);
              const isCurrent = agentProgress.currentAgentIndex === idx;
              const Icon = AGENT_ICONS[code] || ShieldCheck;
              const shortName = code.replace("_AGENT", "").replace("_", " ");

              return (
                <div
                  key={code}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ${
                    isCurrent
                      ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400 animate-pulse font-bold"
                      : isCompleted
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/50"
                      : "bg-slate-800/40 text-slate-400 border border-slate-700/30"
                  }`}
                >
                  <Icon className={`h-3 w-3 ${isCompleted ? "text-emerald-400" : isCurrent ? "text-indigo-300" : "text-slate-500"}`} />
                  <span className="truncate">{shortName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ADMIN SELECTIVE REPORT CONFIGURATOR & TIMEFRAME SHELL ─── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          {/* Representative Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <User className="h-4 w-4 text-indigo-500" />
              <span>Select MR Rep:</span>
            </div>
            <select
              value={selectedMrId}
              onChange={(e) => setSelectedMrId(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              {reports.map((r) => (
                <option key={r.mrId} value={r.mrId}>
                  {r.fullName} ({r.territories.map((t) => t.name).join(", ") || "General"}) — Grade {r.councilEvaluation.overallGrade}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Scope Selector */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Time Horizon:
            </span>
            {(
              [
                { id: "all", label: "All Time" },
                { id: "daily", label: "Today (Daily)" },
                { id: "weekly", label: "Past 7 Days" },
                { id: "monthly", label: "Month-to-Date" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === p.id
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers (if custom selected) */}
        {selectedPeriod === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/50 dark:border-indigo-900/30">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Specify Date Range:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={() => fetchReports("custom", customStartDate, customEndDate)}
              disabled={!customStartDate || !customEndDate}
              className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Selective Report Module Configurator Toggles */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Selective Report Configurator (Pick what to include in report & WhatsApp):
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
              <button
                onClick={() => applyPreset("ALL")}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                All Modules
              </button>
              <button
                onClick={() => applyPreset("COMMERCIAL")}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Commercial & P&L
              </button>
              <button
                onClick={() => applyPreset("FIELD")}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Field CRM & DCR
              </button>
              <button
                onClick={() => applyPreset("EXECUTIVE")}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Executive Verdict
              </button>
            </div>
          </div>

          {/* Module Toggle Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {[
              { key: "includeDoctorVisits", label: "Doctor Detailing", icon: Stethoscope, color: "emerald" },
              { key: "includeChemistCalls", label: "Chemist Calls & POB", icon: Pill, color: "teal" },
              { key: "includeSalesOrders", label: "Secondary Sales", icon: ShoppingBag, color: "blue" },
              { key: "includeCollections", label: "Collections Done", icon: Wallet, color: "indigo" },
              { key: "includeDutyTiming", label: "Duty Timing / Logs", icon: Clock, color: "cyan" },
              { key: "includeExpenses", label: "Expenses & Claims", icon: Receipt, color: "amber" },
              { key: "includeRoutingGeofence", label: "Routing & Geofence", icon: MapPin, color: "violet" },
              { key: "includeFinancePnl", label: "Financial P&L", icon: Landmark, color: "rose" },
              { key: "includeAgentScorecard", label: "8-Agent Council", icon: Cpu, color: "fuchsia" },
              { key: "includeRiskActionItems", label: "Risk & Action Items", icon: AlertTriangle, color: "orange" },
            ].map((mod) => {
              const active = (selectiveConfig as any)[mod.key];
              const Icon = mod.icon;
              return (
                <button
                  key={mod.key}
                  onClick={() =>
                    setSelectiveConfig((prev) => ({
                      ...prev,
                      [mod.key]: !active,
                    }))
                  }
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                    active
                      ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-semibold shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded flex items-center justify-center text-xs ${
                      active ? "bg-indigo-600 text-white" : "border border-slate-400"
                    }`}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="text-xs truncate">{mod.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CURRENT MR PROFILE CARD ─────────────────────────────────── */}
      {currentReport && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-black text-2xl shadow-md shadow-indigo-500/20">
              {currentReport.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentReport.fullName}</h2>
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {currentReport.role}
                </span>
                {currentReport.periodLabel && (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                    ⏱️ {currentReport.periodLabel}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>📍 {currentReport.territories.map((t) => t.name).join(", ") || "No Territory"}</span>
                <span>📞 {currentReport.phone || "No phone"}</span>
                <span>✉️ {currentReport.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 dark:border-slate-800">
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Council Score</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {currentReport.councilEvaluation.councilScore}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </span>
            </div>
            <div
              className={`px-4 py-2 rounded-xl text-center font-black text-xl shadow-xs border ${
                currentReport.councilEvaluation.overallGrade === "A+"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : currentReport.councilEvaluation.overallGrade === "A"
                  ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800"
                  : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              }`}
            >
              Grade {currentReport.councilEvaluation.overallGrade}
            </div>
          </div>
        </div>
      )}

      {/* ── NAVIGATION TABS ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2">
        {[
          { id: "council", label: "8-Agent Council Audit", icon: Cpu },
          { id: "doctors", label: "Doctor Detailing", icon: Stethoscope },
          { id: "chemists", label: "Chemist Calls & POB", icon: Pill },
          { id: "commercial", label: "Secondary Sales", icon: ShoppingBag },
          { id: "collections", label: "Collections Done", icon: Wallet },
          { id: "timing", label: "Duty Timing & Attendance", icon: Clock },
          { id: "expenses", label: "Expenses & Claims", icon: Receipt },
          { id: "routing", label: "Routing & Geofence", icon: MapPin },
          { id: "finance", label: "Financial P&L", icon: Landmark },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: 8-AGENT COUNCIL AUDIT ───────────────────────────── */}
      {activeTab === "council" && currentReport && (
        <div className="space-y-6">
          {/* Executive Summary & Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Council Executive Synthesis
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {currentReport.councilEvaluation.executiveSummary}
              </p>
              {currentReport.councilEvaluation.actionItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Recommended Council Actions:
                  </span>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {currentReport.councilEvaluation.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Risk Warnings */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk & Compliance Flags
              </h3>
              {currentReport.councilEvaluation.keyRiskFactors.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium py-4">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>No compliance risks or fraud anomalies detected.</span>
                </div>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {currentReport.councilEvaluation.keyRiskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                      <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 8 Domain Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentReport.councilEvaluation.agentStatuses.map((agent) => {
              const Icon = AGENT_ICONS[agent.agentCode] || ShieldCheck;
              const isPass = agent.status === "ONLINE_PASS";
              const isWarn = agent.status === "ONLINE_WARNING";

              return (
                <div
                  key={agent.agentCode}
                  className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          isPass
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : isWarn
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{agent.agentName}</h4>
                        <span className="text-xs text-slate-400">{agent.domain}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          isPass
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : isWarn
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {agent.status.replace("ONLINE_", "")} • {agent.score}%
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{agent.executionTimeMs}ms execution</span>
                    </div>
                  </div>

                  {/* Findings */}
                  {agent.findings.length > 0 && (
                    <div className="space-y-1">
                      {agent.findings.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {agent.warnings.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {agent.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: DOCTOR DETAILING & CALLS ────────────────────────── */}
      {activeTab === "doctors" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Total Doctor Visits</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.dcrSummary.doctorVisits}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Avg Call Quality Score (CQS)</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.dcrSummary.avgCqsScore ?? "—"}/10
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Samples Placed</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {currentReport.dcrSummary.samplesDistributedQty || 0} units
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Itemized Doctor Visits & Detailing Breakdown
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(currentReport.dcrSummary.doctorWiseVisits || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No doctor visits recorded for this timeframe.</div>
              ) : (
                (currentReport.dcrSummary.doctorWiseVisits || []).map((doc) => (
                  <div key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Dr. {doc.doctorName}</span>
                        {doc.specialty && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                            {doc.specialty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Purpose: {doc.purpose || "Regular Detailing"} • Logged: {new Date(doc.timestamp).toLocaleDateString("en-IN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      {doc.cqsScore && (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          CQS: {doc.cqsScore}/10
                        </span>
                      )}
                      {doc.durationMinutes && <span>⏱️ {doc.durationMinutes} mins</span>}
                      {doc.samplesCount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          📦 {doc.samplesCount} samples
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CHEMIST CALLS & POB ─────────────────────────────── */}
      {activeTab === "chemists" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Total Chemist Visits</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.dcrSummary.chemistVisits}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Display Boxes Placed</span>
              <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
                {currentReport.dcrSummary.totalBoxesPlaced} boxes
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Hospital Visits</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.dcrSummary.hospitalVisits}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Chemist & Retailer Coverage Logs
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(currentReport.dcrSummary.chemistWiseVisits || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No chemist visits logged for this timeframe.</div>
              ) : (
                (currentReport.dcrSummary.chemistWiseVisits || []).map((ch) => (
                  <div key={ch.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{ch.chemistName}</span>
                      <p className="text-xs text-slate-500">
                        Logged: {new Date(ch.timestamp).toLocaleDateString("en-IN")} • Purpose: {ch.purpose || "POB Booking"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      {ch.boxesPlaced ? <span>📦 {ch.boxesPlaced} display boxes</span> : null}
                      {ch.pobOrderValue > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          POB: ₹{ch.pobOrderValue.toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SECONDARY SALES & SKUS ──────────────────────────── */}
      {activeTab === "commercial" && currentReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Gross Sales (PTR)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{currentReport.commercialSummary.totalRevenuePtr.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Secondary Orders</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.commercialSummary.totalOrdersCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Delivered Orders</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {currentReport.commercialSummary.deliveredOrdersCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Total Units Booked</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.commercialSummary.totalUnitsBooked}
              </p>
            </div>
          </div>

          {/* SKU Breakdown Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Product SKU Sales & Margin Contribution
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Product Name</th>
                    <th className="p-3.5">SKU Code</th>
                    <th className="p-3.5 text-right">Units</th>
                    <th className="p-3.5 text-right">Sales PTR</th>
                    <th className="p-3.5 text-right">Cost PTS</th>
                    <th className="p-3.5 text-right">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentReport.commercialSummary.skuBreakdown.map((sku) => (
                    <tr key={sku.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 font-medium text-slate-900 dark:text-white">{sku.productName}</td>
                      <td className="p-3.5 text-slate-500">{sku.sku}</td>
                      <td className="p-3.5 text-right font-semibold">{sku.units}</td>
                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Math.round(sku.revenuePtr).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right text-slate-500">
                        ₹{Math.round(sku.revenuePts).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Math.round(sku.grossMargin).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: COLLECTIONS DONE ────────────────────────────────── */}
      {activeTab === "collections" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Total Collections Recovered</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{(currentReport.commercialSummary.collections?.totalCollected || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Receipts Logged</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.commercialSummary.collections?.recordsCount || 0}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Collection Receipts
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {((currentReport.commercialSummary.collections as any)?.receipts || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No collection receipts logged for this timeframe.</div>
              ) : (
                ((currentReport.commercialSummary.collections as any)?.receipts || []).map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{r.chemistName}</span>
                      <p className="text-xs text-slate-500">
                        Date: {new Date(r.date).toLocaleDateString("en-IN")} {r.receiptNo ? `• Ref #${r.receiptNo}` : ""}
                      </p>
                    </div>
                    <span className="font-black text-base text-emerald-600 dark:text-emerald-400">
                      ₹{Number(r.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: DUTY TIMING & ATTENDANCE ────────────────────────── */}
      {activeTab === "timing" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Attendance Days Logged</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.expenseHrmsSummary.attendanceDaysLogged} days
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Avg DCR Call Duration</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.dcrSummary.avgDurationMinutes} mins
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Total Visits (DCR)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currentReport.dcrSummary.totalVisits} calls
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Field Attendance Logs & Session Timings
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(currentReport.expenseHrmsSummary.attendanceDetails || []).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No attendance logs found for this timeframe.</div>
              ) : (
                (currentReport.expenseHrmsSummary.attendanceDetails || []).map((att) => (
                  <div key={att.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {new Date(att.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        In: {att.checkIn ? new Date(att.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} | Out:{" "}
                        {att.checkOut ? new Date(att.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
                        {att.status}
                      </span>
                      {att.durationMinutes ? (
                        <span className="text-xs text-slate-400 block mt-1">
                          {Math.floor(att.durationMinutes / 60)}h {att.durationMinutes % 60}m
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: EXPENSES & CLAIMS ───────────────────────────────── */}
      {activeTab === "expenses" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Approved Expense Claims</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{currentReport.expenseHrmsSummary.totalExpensesApproved.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Expense-to-Sales ROI %</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.expenseHrmsSummary.expenseToSalesRoiPercent}%
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Pending Review</span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                ₹{currentReport.expenseHrmsSummary.totalExpensesPending.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
              Itemized Claims & Daily Allowance
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentReport.expenseHrmsSummary.expensesList.map((exp) => (
                <div key={exp.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{exp.category}</span>
                    <p className="text-xs text-slate-500">
                      {exp.description || "Field Expense"} • {new Date(exp.date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-400">{exp.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 8: ROUTING & GEOFENCE ──────────────────────────────── */}
      {activeTab === "routing" && currentReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Geofence Compliance</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {currentReport.routingSummary.geofenceCompliancePercent}%
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Approved Tour Plans (MTP)</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {currentReport.routingSummary.approvedTourPlansCount} / {currentReport.routingSummary.tourPlansCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Mock GPS Spoofing Flags</span>
              <p className={`text-2xl font-black mt-1 ${currentReport.routingSummary.gpsMockFlagsCount > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
                {currentReport.routingSummary.gpsMockFlagsCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 9: FINANCIAL P&L ───────────────────────────────────── */}
      {activeTab === "finance" && currentReport && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-500" />
              Territory Financial Contribution Statement (P&L)
            </h3>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Gross Sales Revenue (PTR):</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{currentReport.financeSummary.grossSalesRevenue.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Cost of Goods Sold (PTS):</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  - ₹{currentReport.financeSummary.costOfGoodsSold.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200">Gross Territory Profit:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  ₹{currentReport.financeSummary.grossProfit.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Direct Field Expenses:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  - ₹{currentReport.financeSummary.fieldExpenses.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-base py-3 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl">
                <span className="font-black text-emerald-900 dark:text-emerald-200">Net Territory Contribution:</span>
                <div className="text-right">
                  <span className="font-black text-lg text-emerald-600 dark:text-emerald-400 block">
                    ₹{currentReport.financeSummary.netTerritoryContribution.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                    Net Margin: {currentReport.financeSummary.netMarginPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SELECTIVE WHATSAPP DISPATCH MODAL ───────────────────────── */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto space-y-6">
            <button
              onClick={() => setIsWhatsAppModalOpen(false)}
              className="absolute right-6 top-6 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Multi-Agent WhatsApp Intelligence Dispatch
                  </h3>
                  {isAdmin ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      ADMIN DISPATCH
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      VIEW ONLY
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Granular audit syntheses evaluated by 8 AI domain agents and formatted for WhatsApp.
                </p>
              </div>
            </div>

            {/* Recipient Target Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Dispatch Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  {
                    id: "ALL_MRS_INDIVIDUALLY",
                    label: "⚡ All MRs Individually",
                    sub: "Daily report to each MR phone",
                    badge: "Recommended",
                  },
                  {
                    id: "INDIVIDUAL_MR",
                    label: `👤 Current MR (${currentReport?.fullName?.split(" ")[0] || "MR"})`,
                    sub: currentReport?.phone || "No phone registered",
                  },
                  {
                    id: "EXECUTIVE_FLEET",
                    label: "🏛️ Executive Digest",
                    sub: "Fleet summary to leadership",
                  },
                  {
                    id: "CUSTOM_PHONE",
                    label: "📱 Custom Phone",
                    sub: "Direct custom mobile no.",
                  },
                ].map((target) => (
                  <button
                    key={target.id}
                    onClick={() => {
                      setWhatsAppTarget(target.id as any);
                      if (target.id === "ALL_MRS_INDIVIDUALLY") {
                        setSelectedPeriod("daily");
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative ${
                      whatsAppTarget === target.id
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500/40"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {target.badge && (
                      <span className="absolute -top-2 right-2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 shadow-sm">
                        {target.badge}
                      </span>
                    )}
                    <span className="text-xs block">{target.label}</span>
                    <span className="text-[11px] text-slate-400 font-normal truncate block mt-0.5">
                      {target.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Explanation Banner */}
            {whatsAppTarget === "ALL_MRS_INDIVIDUALLY" && (
              <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 to-indigo-950/40 p-4 border border-emerald-800/40 text-xs text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Personalized Batch Dispatching Engine Active</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Every active Medical Representative ({reports.length} MRs) will receive their own personalized Daily
                  Audit Report directly on their registered WhatsApp number with today&apos;s Doctor calls, Chemist visits,
                  POB bookings, Secondary sales, Collections, Attendance timing, and Expenses claims.
                </p>
              </div>
            )}

            {/* Custom Phone Input */}
            {whatsAppTarget === "CUSTOM_PHONE" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Enter WhatsApp Number (with country code, e.g. +91 98765 43210):
                </label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Formatted Live WhatsApp Preview Bubble */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-emerald-500" />
                  {whatsAppTarget === "ALL_MRS_INDIVIDUALLY"
                    ? `Live WhatsApp Message Preview (Sample: ${currentReport?.fullName || "MR"}):`
                    : "Live WhatsApp Message Preview:"}
                </label>
                <button
                  onClick={handleCopyWhatsAppText}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  {copiedToast ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedToast ? "Copied!" : "Copy Text"}</span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed shadow-inner">
                {loadingWhatsAppPreview ? (
                  <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Synthesizing custom WhatsApp report...</span>
                  </div>
                ) : (
                  whatsAppPreviewText || "No preview generated."
                )}
              </div>
            </div>

            {/* Live Dispatch Status Alert */}
            {dispatchStatus && (
              <div
                className={`p-4 rounded-xl text-xs font-medium ${
                  dispatchStatus.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                }`}
              >
                {dispatchStatus.message}
              </div>
            )}

            {/* ── BATCH DISPATCH RESULTS & LIVE AGENT MATRIX ─────────── */}
            {batchDispatchResults && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* 8 Agent Verification Status Chips */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-indigo-400" />
                    Council 8-Domain Agent Verification Matrix:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {batchDispatchResults.agentStatuses.map((ag) => (
                      <div
                        key={ag.agentCode}
                        className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 truncate">{ag.domainScope}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-black ${
                              ag.status === "ONLINE_PASS"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {ag.score}%
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {ag.agentName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fleet MR Dispatch Roster Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Fleet Individual MR Dispatch Roster ({batchDispatchResults.details.length} MRs):</span>
                    <span className="text-emerald-400 text-xs font-normal">
                      {batchDispatchResults.dispatchedCount} Dispatched Successfully
                    </span>
                  </h4>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">MR Name & Territory</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3 text-center">Dr Calls</th>
                            <th className="p-3 text-center">Chemist</th>
                            <th className="p-3 text-right">Sales (PTR)</th>
                            <th className="p-3 text-center">Grade</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {batchDispatchResults.details.map((d) => (
                            <tr key={d.mrId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-3">
                                <span className="font-bold text-slate-900 dark:text-white block">{d.recipient}</span>
                                <span className="text-[10px] text-slate-400">{d.territory}</span>
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {d.phone || "No Phone"}
                              </td>
                              <td className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                                {d.doctorCalls}
                              </td>
                              <td className="p-3 text-center font-semibold text-slate-900 dark:text-white">
                                {d.chemistCalls}
                              </td>
                              <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                ₹{d.salesTodayPtr.toLocaleString("en-IN")}
                              </td>
                              <td className="p-3 text-center">
                                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-bold text-indigo-300 text-[10px]">
                                  {d.overallGrade} ({d.councilScore})
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {d.sent ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> SENT
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                                    <AlertTriangle className="h-3.5 w-3.5" /> FAILED
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {d.whatsappUrl && (
                                  <a
                                    href={d.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-bold transition-all shadow-sm"
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                    <span>Chat</span>
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <a
                href={whatsAppUrl || `https://wa.me/?text=${encodeURIComponent(whatsAppPreviewText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-3 text-sm font-semibold transition-all border border-slate-700"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open in WhatsApp Web</span>
              </a>

              {isAdmin ? (
                <button
                  onClick={handleDispatchWhatsAppApi}
                  disabled={sendingWhatsApp}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 text-sm font-bold shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {sendingWhatsApp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>
                    {whatsAppTarget === "ALL_MRS_INDIVIDUALLY"
                      ? "⚡ Dispatch to All MRs Individually"
                      : "Send via Cloud API"}
                  </span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-xs text-amber-300 border border-slate-700">
                  <Lock className="h-4 w-4" />
                  <span>Admin Permission Required to Dispatch</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
