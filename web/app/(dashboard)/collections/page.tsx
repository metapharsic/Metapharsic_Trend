"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Wallet,
  AlertTriangle,
  ShieldAlert,
  IndianRupee,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  Sparkles,
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  Building2,
  ChevronRight,
  Sliders,
  Filter,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Receipt,
  ArrowUpRight,
  FileText,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

function currency(value: number | string | null | undefined): string {
  if (value == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

interface OpenInvoiceItem {
  id: string;
  invoiceNo: string;
  date: string;
  grandTotal: number;
  unpaidBalance: number;
  paidAmount: number;
  ageDays: number;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  status: "UNPAID" | "PARTIAL";
}

interface ChemistCreditRow {
  chemistId: string;
  name: string;
  address?: string;
  territory?: string;
  mr?: string;
  creditLimit: number | null;
  limitUtilizationPct?: number;
  outstanding: number;
  status: "OK" | "WARNING" | "BREACHED" | "NO_LIMIT";
  aging0To30?: number;
  aging31To60?: number;
  aging61To90?: number;
  aging90Plus?: number;
  dsoDays?: number;
  riskTier?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore?: number;
  unpaidInvoicesCount?: number;
  openInvoices?: OpenInvoiceItem[];
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number | null;
  ordersOnHoldCount?: number;
}

interface CreditAgent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: string;
  lastExecutionMs: number;
  lastSyncAt: string;
  metrics: Record<string, string | number>;
  logs: string[];
}

interface RiskAlert {
  id: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  message: string;
  chemistName: string;
  amount: number;
  timestamp: string;
}

interface CollectionReceiptRow {
  id: string;
  createdAt: string;
  chemistName: string;
  mrName: string;
  paymentMode: string;
  refNumber?: string | null;
  amount: number;
}

export default function CreditCollectionsPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  return <EnterpriseCreditDashboard role={role} />;
}

function EnterpriseCreditDashboard({ role }: { role: string | null }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedChemistForLog, setSelectedChemistForLog] = useState<ChemistCreditRow | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<OpenInvoiceItem | null>(null);
  const [expandedChemistId, setExpandedChemistId] = useState<string | null>(null);
  const [selectedChemistForDetail, setSelectedChemistForDetail] = useState<ChemistCreditRow | null>(null);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);
  const [showAgentLogs, setShowAgentLogs] = useState<string | null>(null);

  const isMR = role === "MR";

  const loadData = () => {
    setLoading(true);
    const endpoint = isMR ? "/api/mr/credit-summary" : "/api/manager/credit";
    apiClient
      .get(endpoint)
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Failed to load credit data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [role]);

  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this payment collection entry? This action cannot be undone.")) return;
    try {
      await apiClient.delete(`/api/mr/collections/${id}`);
      loadData();
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  const chemists: ChemistCreditRow[] = data?.chemists || [];
  const summary = data || {};

  const filteredChemists = useMemo(() => {
    return chemists.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.mr && c.mr.toLowerCase().includes(q)) ||
        (c.territory && c.territory.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesRisk = riskFilter === "ALL" || c.riskTier === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [chemists, searchTerm, statusFilter, riskFilter]);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-32 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Executing Multi-Agent Credit &amp; Recovery Intelligence Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header & Multi-Agent Status ────────────────────────────────────────── */}
      <div className="bg-slate-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={13} />
                Multi-Agent Credit Intelligence
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-300">
                Live FIFO Matching
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/30 text-indigo-200">
                DSO &amp; Risk Scoring
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
              Credit Risk &amp; Collections Management
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Real-time receivables aging, credit limit exposure guards, DSO scoring, and payment reconciliation across all chemist outlets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedChemistForLog(null);
                setShowLogModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer"
            >
              <Plus size={15} />
              <span>Log Payment Collection</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Multi-Agent Console Bar */}
        {summary.agents && summary.agents.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Multi-Agent Credit Engine
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Pipeline Executed in {summary.agents.reduce((acc: number, a: any) => acc + (a.lastExecutionMs || 0), 0)}ms
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {summary.agents.map((agent: CreditAgent) => (
                <div
                  key={agent.id}
                  onClick={() => setShowAgentLogs(showAgentLogs === agent.id ? null : agent.id)}
                  className="bg-slate-900/90 rounded-2xl p-2.5 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{agent.avatar}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{agent.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{agent.role.split("&")[0]}</p>
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase shrink-0 ${
                      agent.status === "WARNING"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Agent Logs Drawer */}
            {showAgentLogs && (
              <div className="mt-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                {summary.agents
                  .find((a: any) => a.id === showAgentLogs)
                  ?.logs.map((log: string, idx: number) => (
                    <p key={idx} className="text-slate-300 font-mono text-[11px] flex items-center gap-2">
                      <span className="text-emerald-400">❯</span> {log}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Receivables Aging & Credit Overview KPI Grid ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          label="Total Outstanding"
          value={currency(summary.totalOutstanding)}
          subtext={`${chemists.length} Tracked Chemists`}
          tone={summary.totalOutstanding > 0 ? "warn" : "good"}
          icon={Wallet}
        />
        <KpiCard
          label="Current (0-30 Days)"
          value={currency(summary.aging0To30)}
          subtext="Healthy Receivables"
          tone="good"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Overdue (31-60 Days)"
          value={currency(summary.aging31To60)}
          subtext="Requires Follow-Up"
          tone="warn"
          icon={Clock}
        />
        <KpiCard
          label="Overdue (61-90 Days)"
          value={currency(summary.aging61To90)}
          subtext="High Priority Collection"
          tone="danger"
          icon={AlertCircle}
        />
        <KpiCard
          label="Critical (90+ Days)"
          value={currency(summary.aging90Plus)}
          subtext={`${summary.criticalAgingCount || 0} Accounts at Risk`}
          tone="critical"
          icon={ShieldAlert}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Collections</span>
            <p className="text-xl font-bold text-emerald-600 mt-0.5 font-mono">{currency(summary.todaysCollection)}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Breached Credit Limits</span>
            <p className="text-xl font-bold text-rose-600 mt-0.5 font-mono">{summary.breachedCount || 0} Chemist Stores</p>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet DSO Average</span>
            <p className="text-xl font-bold text-indigo-600 mt-0.5 font-mono">{summary.dsoAverage || 0} Days</p>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      {/* Risk Alerts Banner if Critical Items Exist */}
      {summary.riskAlerts && summary.riskAlerts.length > 0 && (
        <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert size={15} />
            <span>Automated Dunning Risk Alerts ({summary.riskAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {summary.riskAlerts.slice(0, 4).map((alert: RiskAlert) => (
              <div key={alert.id} className="bg-white rounded-xl p-3 border border-rose-100 shadow-2xs flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{alert.chemistName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{alert.message}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100 text-rose-700">
                  {alert.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Search & Filters Bar ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by chemist name, MR representative, or territory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-medium text-slate-600">
            {["ALL", "OK", "WARNING", "BREACHED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg transition ${
                  statusFilter === st ? "bg-white text-slate-900 font-bold shadow-2xs" : ""
                }`}
              >
                {st === "ALL" ? "All Exposure" : st}
              </button>
            ))}
          </div>

          {/* Risk Tier Filter */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-medium text-slate-600">
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((rk) => (
              <button
                key={rk}
                onClick={() => setRiskFilter(rk)}
                className={`px-2.5 py-1 rounded-lg transition ${
                  riskFilter === rk ? "bg-white text-slate-900 font-bold shadow-2xs" : ""
                }`}
              >
                {rk === "ALL" ? "All Tiers" : rk}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Chemist Receivables & Aging Table ───────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Chemist Receivables &amp; Aging Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-agent audited FIFO payment allocations, aging distribution, and risk scoring.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Showing {filteredChemists.length} of {chemists.length} Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Chemist Outlet</th>
                {!isMR && <th className="py-3.5 px-3">MR / Territory</th>}
                <th className="py-3.5 px-3 text-right">Credit Limit</th>
                <th className="py-3.5 px-3 text-right">Outstanding</th>
                <th className="py-3.5 px-3 text-right">0-30 Days</th>
                <th className="py-3.5 px-3 text-right">31-60 Days</th>
                <th className="py-3.5 px-3 text-right">61-90 Days</th>
                <th className="py-3.5 px-3 text-right">90+ Days</th>
                <th className="py-3.5 px-3 text-center">Risk Tier</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChemists.length === 0 && (
                <tr>
                  <td colSpan={isMR ? 10 : 11} className="py-12 text-center text-slate-400">
                    No chemist accounts match the selected filters.
                  </td>
                </tr>
              )}

              {filteredChemists.map((c) => {
                const limitUtil = c.limitUtilizationPct || 0;
                return (
                  <React.Fragment key={c.chemistId}>
                    <tr className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block text-sm">{c.name}</span>
                        {c.address && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                            {c.address}
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedChemistId(expandedChemistId === c.chemistId ? null : c.chemistId)}
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition cursor-pointer"
                        >
                          <FileText size={11} />
                          <span>{c.openInvoices?.length || 0} Open Invoices</span>
                          {expandedChemistId === c.chemistId ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </td>

                      {!isMR && (
                        <td className="py-3.5 px-3">
                          <span className="font-medium text-slate-800 block truncate max-w-[130px]">
                            {c.mr || "Unassigned"}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{c.territory}</span>
                        </td>
                      )}

                      <td className="py-3.5 px-3 text-right font-mono">
                        {c.creditLimit !== null ? (
                          <div>
                            <span className="font-medium text-slate-700">{currency(c.creditLimit)}</span>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 mt-1 ml-auto overflow-hidden">
                              <div
                                className={`h-full ${
                                  limitUtil > 100
                                    ? "bg-rose-600"
                                    : limitUtil >= 80
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, limitUtil)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">No Limit</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {currency(c.outstanding)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-emerald-700 font-medium">
                        {currency(c.aging0To30)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-amber-700 font-medium">
                        {currency(c.aging31To60)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-orange-700 font-bold">
                        {currency(c.aging61To90)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-rose-700 font-bold">
                        {currency(c.aging90Plus)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                            c.riskTier === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : c.riskTier === "HIGH"
                              ? "bg-orange-100 text-orange-800"
                              : c.riskTier === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {c.riskTier || "LOW"}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                            c.status === "BREACHED"
                              ? "bg-red-100 text-red-800"
                              : c.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : c.status === "OK"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedChemistForLog(c);
                              setSelectedInvoiceForPayment(null);
                              setShowLogModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[11px] transition border border-emerald-200 cursor-pointer"
                          >
                            Log Payment
                          </button>
                          <button
                            onClick={() => setSelectedChemistForDetail(c)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="View Ledger & Detail"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedChemistId === c.chemistId && (
                      <tr className="bg-slate-50/90 border-b border-indigo-100">
                        <td colSpan={isMR ? 10 : 11} className="py-4 px-6">
                          <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Receipt className="text-indigo-600" size={16} />
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                  Open / Unpaid Invoices for {c.name} ({c.openInvoices?.length || 0})
                                </h4>
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-700">
                                Total Outstanding: <span className="text-rose-600">{currency(c.outstanding)}</span>
                              </span>
                            </div>

                            {(!c.openInvoices || c.openInvoices.length === 0) ? (
                              <p className="text-xs text-slate-400 py-3 text-center">No open invoices on file for this account.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left font-mono">
                                  <thead className="bg-slate-100/80 text-slate-600 font-sans font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3">Invoice #</th>
                                      <th className="py-2 px-3">Date</th>
                                      <th className="py-2 px-3 text-center">Age / Bucket</th>
                                      <th className="py-2 px-3 text-right">Billed Amount</th>
                                      <th className="py-2 px-3 text-right">Paid Amount</th>
                                      <th className="py-2 px-3 text-right">Unpaid Balance</th>
                                      <th className="py-2 px-3 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {c.openInvoices.map((inv) => (
                                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                                        <td className="py-2.5 px-3 font-bold text-slate-900">{inv.invoiceNo}</td>
                                        <td className="py-2.5 px-3 text-slate-600 font-sans">
                                          {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            inv.agingBucket === "90+"
                                              ? "bg-rose-100 text-rose-800"
                                              : inv.agingBucket === "61-90"
                                              ? "bg-orange-100 text-orange-800"
                                              : inv.agingBucket === "31-60"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-emerald-100 text-emerald-800"
                                          }`}>
                                            {inv.ageDays}d overdue ({inv.agingBucket})
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-700">{currency(inv.grandTotal)}</td>
                                        <td className="py-2.5 px-3 text-right text-emerald-600">{currency(inv.paidAmount)}</td>
                                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">{currency(inv.unpaidBalance)}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            onClick={() => {
                                              setSelectedChemistForLog(c);
                                              setSelectedInvoiceForPayment(inv);
                                              setShowLogModal(true);
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                                          >
                                            <CreditCard size={11} />
                                            <span>Pay Invoice</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Recent Payment Collections Log ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Payment Collections Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live payment receipts logged by field force reps and central finance.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {summary.recentCollections?.length || 0} Receipts Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-3">Chemist Outlet</th>
                <th className="py-3 px-3">Logged By</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-3">Instrument / Ref #</th>
                <th className="py-3 px-3 text-right">Amount Collected</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(!summary.recentCollections || summary.recentCollections.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No recent payment collections logged.
                  </td>
                </tr>
              )}

              {summary.recentCollections?.map((col: CollectionReceiptRow) => (
                <tr key={col.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-sans text-slate-600">
                    {new Date(col.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 px-3 font-sans font-bold text-slate-900">{col.chemistName}</td>
                  <td className="py-3 px-3 font-sans text-slate-700">{col.mrName}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {col.paymentMode}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{col.refNumber || "CASH-RECEIPT"}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600 text-sm">
                    {currency(col.amount)}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setEditingCollection(col)}
                        className="p-1 text-slate-400 hover:text-emerald-600 transition"
                        title="Edit Receipt"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteCollection(col.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Receipt"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Log Payment Collection Modal ────────────────────────────────────────── */}
      {showLogModal && (
        <LogPaymentModal
          chemists={chemists}
          initialChemist={selectedChemistForLog}
          initialInvoice={selectedInvoiceForPayment}
          onClose={() => {
            setShowLogModal(false);
            setSelectedChemistForLog(null);
            setSelectedInvoiceForPayment(null);
          }}
          onSuccess={() => {
            setShowLogModal(false);
            setSelectedChemistForLog(null);
            setSelectedInvoiceForPayment(null);
            loadData();
          }}
        />
      )}

      {/* ─── Edit Payment Receipt Modal ─────────────────────────────────────────── */}
      {editingCollection && (
        <EditPaymentModal
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
          onSuccess={() => {
            setEditingCollection(null);
            loadData();
          }}
        />
      )}

      {/* ─── Chemist Detail & Ledger Drawer ──────────────────────────────────────── */}
      {selectedChemistForDetail && (
        <ChemistDetailModal
          chemist={selectedChemistForDetail}
          onClose={() => setSelectedChemistForDetail(null)}
          onUpdateLimit={loadData}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtext,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext: string;
  tone: "good" | "warn" | "danger" | "critical";
  icon: any;
}) {
  const styles = {
    good: "bg-emerald-50 border-emerald-100 text-emerald-700 icon-bg-emerald",
    warn: "bg-amber-50 border-amber-100 text-amber-800 icon-bg-amber",
    danger: "bg-orange-50 border-orange-100 text-orange-800 icon-bg-orange",
    critical: "bg-rose-50 border-rose-100 text-rose-800 icon-bg-rose",
  }[tone];

  return (
    <div className={`rounded-2xl p-4 border shadow-2xs space-y-2 bg-white`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-xl ${styles}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 font-mono tracking-tight">{value}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

function LogPaymentModal({
  chemists,
  initialChemist,
  initialInvoice,
  onClose,
  onSuccess,
}: {
  chemists: ChemistCreditRow[];
  initialChemist: ChemistCreditRow | null;
  initialInvoice?: OpenInvoiceItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [chemistId, setChemistId] = useState(initialChemist?.chemistId || "");
  const [amount, setAmount] = useState(initialInvoice ? String(initialInvoice.unpaidBalance) : "");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [refNumber, setRefNumber] = useState(initialInvoice ? `[INV-${initialInvoice.invoiceNo}]` : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChemist = chemists.find((c) => c.chemistId === chemistId);

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!chemistId) return setError("Select a chemist outlet.");
    if (!amt || amt <= 0) return setError("Enter a valid payment amount.");

    setSubmitting(true);
    try {
      const finalRef = refNumber ? `[${paymentMode}] Ref: ${refNumber}` : `[${paymentMode}]`;

      await apiClient.post("/api/mr/collections", {
        chemistId,
        amount: amt,
        refNumber: finalRef,
      });
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "Failed to log payment collection.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Payment Receipt Logger
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Log Chemist Payment Collection</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {initialInvoice && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 text-xs space-y-1">
            <div className="flex justify-between items-center font-bold text-indigo-950">
              <span>Target Payment: Invoice #{initialInvoice.invoiceNo}</span>
              <span className="bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-extrabold">
                {initialInvoice.ageDays}d Overdue
              </span>
            </div>
            <div className="flex justify-between text-slate-600 font-mono text-[11px] pt-1">
              <span>Total Billed: {currency(initialInvoice.grandTotal)}</span>
              <span className="font-bold text-rose-600">Remaining Balance: {currency(initialInvoice.unpaidBalance)}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Select Chemist Outlet *
            </label>
            <select
              value={chemistId}
              onChange={(e) => setChemistId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="" disabled>
                Select Chemist Store...
              </option>
              {chemists.map((c) => (
                <option key={c.chemistId} value={c.chemistId}>
                  {c.name} (Outstanding: {currency(c.outstanding)})
                </option>
              ))}
            </select>
          </div>

          {selectedChemist && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Current Outstanding:</span>
                <span className="font-bold text-slate-900 font-mono">{currency(selectedChemist.outstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Credit Limit:</span>
                <span className="font-medium text-slate-700">
                  {selectedChemist.creditLimit ? currency(selectedChemist.creditLimit) : "No Limit"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Risk Status:</span>
                <span className="font-bold uppercase text-emerald-600">{selectedChemist.status}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Amount Collected (₹) *
            </label>
            <input
              type="number"
              placeholder="e.g. 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI / QR Code</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Instrument / Ref #
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-991823"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Check size={14} />
            <span>{submitting ? "Logging Receipt..." : "Confirm & Save Receipt"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPaymentModal({
  collection,
  onClose,
  onSuccess,
}: {
  collection: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(collection.amount || ""));
  const [refNumber, setRefNumber] = useState(collection.refNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setSaving(true);
    try {
      await apiClient.put(`/api/mr/collections/${collection.id}`, {
        amount: amt,
        refNumber: refNumber || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to update collection receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Edit Collection Receipt</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Chemist: <strong className="text-slate-900">{collection.chemistName}</strong>
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Collected (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ref / Instrument #</label>
            <input
              type="text"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button onClick={onClose} className="px-3.5 py-1.5 text-xs text-slate-600 font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChemistDetailModal({
  chemist,
  onClose,
  onUpdateLimit,
}: {
  chemist: ChemistCreditRow;
  onClose: () => void;
  onUpdateLimit: () => void;
}) {
  const [newLimit, setNewLimit] = useState(String(chemist.creditLimit || ""));
  const [savingLimit, setSavingLimit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const updateCreditLimit = async () => {
    const lim = newLimit === "" ? null : Number(newLimit);
    setSavingLimit(true);
    setMsg(null);
    try {
      await apiClient.put(`/api/manager/entities/${chemist.chemistId}`, {
        creditLimit: lim,
      });
      setMsg("Credit limit updated successfully.");
      onUpdateLimit();
    } catch (err: any) {
      setMsg("Failed to update credit limit.");
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-100 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Chemist Exposure Snapshot
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{chemist.name}</h2>
            <p className="text-xs text-slate-500">{chemist.territory} • MR: {chemist.mr}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Outstanding</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{currency(chemist.outstanding)}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Credit Limit</span>
            <p className="text-lg font-bold text-slate-700 font-mono mt-0.5">
              {chemist.creditLimit ? currency(chemist.creditLimit) : "No Limit"}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Risk Tier</span>
            <p className="text-base font-bold text-indigo-700 mt-0.5">{chemist.riskTier || "LOW"}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">DSO Metric</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{chemist.dsoDays || 0} Days</p>
          </div>
        </div>

        {/* Aging Matrix */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            FIFO Receivables Aging Distribution
          </h4>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono font-bold">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-sans font-semibold block">0-30 Days</span>
              {currency(chemist.aging0To30)}
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
              <span className="text-[10px] text-amber-700 font-sans font-semibold block">31-60 Days</span>
              {currency(chemist.aging31To60)}
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
              <span className="text-[10px] text-orange-700 font-sans font-semibold block">61-90 Days</span>
              {currency(chemist.aging61To90)}
            </div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
              <span className="text-[10px] text-rose-700 font-sans font-semibold block">90+ Days</span>
              {currency(chemist.aging90Plus)}
            </div>
          </div>
        </div>

        {/* Open Invoices Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Open / Unpaid Invoices ({chemist.openInvoices?.length || 0})
            </h4>
            <span className="text-[10px] text-slate-500 font-mono uppercase font-bold">FIFO Payment Reconciliation</span>
          </div>

          {(!chemist.openInvoices || chemist.openInvoices.length === 0) ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">No open invoices on file for this account.</p>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-slate-100 text-slate-700 font-sans font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Invoice #</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-center">Age / Bucket</th>
                    <th className="py-2 px-3 text-right">Billed Amount</th>
                    <th className="py-2 px-3 text-right">Paid Amount</th>
                    <th className="py-2 px-3 text-right">Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chemist.openInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900">{inv.invoiceNo}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">
                        {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.agingBucket === "90+"
                            ? "bg-rose-100 text-rose-800"
                            : inv.agingBucket === "61-90"
                            ? "bg-orange-100 text-orange-800"
                            : inv.agingBucket === "31-60"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {inv.ageDays}d ({inv.agingBucket})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">{currency(inv.grandTotal)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{currency(inv.paidAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">{currency(inv.unpaidBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Adjust Credit Limit */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Manager Credit Exposure Guard Control
          </h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Set new credit limit (₹)"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono"
            />
            <button
              onClick={updateCreditLimit}
              disabled={savingLimit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
            >
              {savingLimit ? "Updating..." : "Update Limit"}
            </button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
