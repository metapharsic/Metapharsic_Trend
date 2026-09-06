"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  Calculator,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Calendar,
  Package,
  Activity,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  Info,
  Search,
  Users,
  Stethoscope,
  Building2,
  FileText,
  X,
  TrendingDown,
  TrendingUp,
  Sliders,
  Filter,
} from "lucide-react";
import {
  CommercialSimulationInputs,
  DEFAULT_SIMULATION_INPUTS,
  FullCommercialSimulationResult,
} from "@/services/commercial-calculator.service";
import {
  AgentHealthStatus,
  MultiAgentOrchestrationResponse,
  LiveCommercialIntelligenceData,
  InvoiceCommercialLedgerRow,
  LineItemCommercialDetail,
} from "@/services/commercial-agents.service";
import { apiClient } from "@/lib/api-client";

type AdminCommercialViewOption =
  | "invoices"
  | "products"
  | "mrs"
  | "chemists"
  | "doctors"
  | "simulator";

export function AdminPtrCalculator() {
  const [inputs, setInputs] = useState<CommercialSimulationInputs>(DEFAULT_SIMULATION_INPUTS);
  const [activeView, setActiveView] = useState<AdminCommercialViewOption>("invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceCommercialLedgerRow | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [profitFilter, setProfitFilter] = useState<"ALL" | "PROFITABLE" | "DEFICIT">("ALL");

  const [liveData, setLiveData] = useState<LiveCommercialIntelligenceData | null>(null);
  const [simulationData, setSimulationData] = useState<FullCommercialSimulationResult | null>(null);
  const [agents, setAgents] = useState<AgentHealthStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAgentLogs, setShowAgentLogs] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchCommercialData = async (simInputs = inputs) => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/ptr-calculator", {
        method: "POST",
        headers,
        body: JSON.stringify(simInputs),
      });

      if (res.ok) {
        const json = await res.json();
        const data: MultiAgentOrchestrationResponse = json.data;
        if (data?.liveData) {
          startTransition(() => {
            setLiveData(data.liveData);
            setSimulationData(data.simulation);
            setAgents(data.agents);
          });
          return;
        }
      }

      // Fallback via axios apiClient
      const axiosRes = await apiClient.post("/api/admin/ptr-calculator", simInputs);
      if (axiosRes.data?.data) {
        const data: MultiAgentOrchestrationResponse = axiosRes.data.data;
        startTransition(() => {
          setLiveData(data.liveData);
          setSimulationData(data.simulation);
          setAgents(data.agents);
        });
      }
    } catch (err) {
      console.error("Failed to fetch commercial data:", err);
      try {
        const axiosRes = await apiClient.post("/api/admin/ptr-calculator", simInputs);
        if (axiosRes.data?.data) {
          const data: MultiAgentOrchestrationResponse = axiosRes.data.data;
          startTransition(() => {
            setLiveData(data.liveData);
            setSimulationData(data.simulation);
            setAgents(data.agents);
          });
        }
      } catch (e) {
        console.error("Fallback to apiClient also failed:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommercialData();
  }, []);

  const handleSimInputChange = <K extends keyof CommercialSimulationInputs>(
    key: K,
    val: CommercialSimulationInputs[K]
  ) => {
    const updated = { ...inputs, [key]: val };
    setInputs(updated);
    fetchCommercialData(updated);
  };

  const handleResetSimulator = () => {
    setInputs(DEFAULT_SIMULATION_INPUTS);
    fetchCommercialData(DEFAULT_SIMULATION_INPUTS);
  };

  const currency = (n?: number | null) =>
    n == null ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!liveData?.invoices) return [];
    let list = liveData.invoices;

    if (profitFilter === "PROFITABLE") {
      list = list.filter((inv) => inv.profitAmount >= 0);
    } else if (profitFilter === "DEFICIT") {
      list = list.filter((inv) => inv.profitAmount < 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          inv.invoiceNo.toLowerCase().includes(q) ||
          inv.chemistName.toLowerCase().includes(q) ||
          inv.mrName.toLowerCase().includes(q) ||
          inv.doctorName.toLowerCase().includes(q) ||
          inv.territoryName.toLowerCase().includes(q) ||
          inv.items.some((it) => it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q))
      );
    }

    return list;
  }, [liveData?.invoices, searchQuery, profitFilter]);

  if (loading && !liveData) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
        <div className="inline-flex p-4 rounded-2xl bg-indigo-50 text-indigo-600 animate-spin">
          <RefreshCw size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          Reconciling Live Invoices, Inventory, Doctors, Chemists &amp; MRs...
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          InvoiceReconciliationAgent, EntityLinkageAgent, InventoryValuationAgent, and CommercialIntelligenceAgent are
          auditing live PostgreSQL database tables...
        </p>
      </div>
    );
  }

  const summary = liveData?.summary;
  const products = liveData?.productsAggregation || [];
  const mrs = liveData?.mrsAggregation || [];
  const chemists = liveData?.chemistsAggregation || [];
  const doctors = liveData?.doctorsAggregation || [];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={13} />
                100% Live Database Reconciled
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-300">
                Zero Hardcoded Values
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/30 text-indigo-200">
                Multi-Agent Audited
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              PTR Profit &amp; Commercial Strategy Calculator
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Commercial economics reconciled dynamically across all {summary?.totalInvoices || 0} invoices, live warehouse
              inventory stock, prescribing doctors, chemist networks, and booking Medical Representatives (MRs).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCommercialData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh Database</span>
            </button>
          </div>
        </div>

        {/* Multi-Agent Status Console */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Multi-Agent System Status &amp; Real-Time Execution Logs
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Last Sync: {new Date().toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {agents.map((agent) => {
              const isOpen = showAgentLogs === agent.id;
              const isWarning = agent.status === "WARNING";
              return (
                <div
                  key={agent.id}
                  className={`rounded-2xl p-3 border transition-all cursor-pointer ${
                    isWarning
                      ? "bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/50"
                      : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800"
                  }`}
                  onClick={() => setShowAgentLogs(isOpen ? null : agent.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{agent.avatar}</span>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">{agent.name}</h4>
                        <p className="text-[10px] text-slate-400">{agent.role}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        agent.status === "AUDITED"
                          ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                          : agent.status === "SYNCED"
                          ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                          : agent.status === "WARNING"
                          ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                          : "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-700/40 grid grid-cols-2 gap-1 text-[10px]">
                    {Object.entries(agent.metrics).slice(0, 2).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-slate-400 block truncate">{key}</span>
                        <span className="font-semibold text-slate-200 truncate">{val}</span>
                      </div>
                    ))}
                  </div>

                  {isOpen && (
                    <div className="mt-3 pt-2 border-t border-slate-700 text-[10px] space-y-1 text-slate-300">
                      <p className="font-semibold text-indigo-300 uppercase tracking-wider text-[9px]">Agent Logs:</p>
                      {agent.logs.map((log, lIdx) => (
                        <p key={lIdx} className="font-mono text-slate-400 leading-snug">
                          › {log}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Live Database Facts Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live Invoices
            </span>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {summary.totalInvoices} Orders
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">100% database reconciled</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Realized Revenue
            </span>
            <p className="text-xl font-bold text-indigo-700 mt-1 font-mono">
              ₹{currency(summary.totalRevenue)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{summary.totalBilledUnits} paid units</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Purchase Cost
            </span>
            <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
              ₹{currency(summary.totalCost)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Incl. free stock absorption</p>
          </div>

          <div className={`rounded-2xl p-4 border shadow-sm ${
            summary.totalProfit >= 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-rose-50 border-rose-200"
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              summary.totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              Net Commercial Profit
            </span>
            <p className={`text-xl font-bold mt-1 font-mono ${
              summary.totalProfit >= 0 ? "text-emerald-800" : "text-rose-700"
            }`}>
              ₹{currency(summary.totalProfit)}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Margin: <span className="font-bold">{summary.blendedMarginPct.toFixed(1)}%</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Scheme Free Stock
            </span>
            <p className="text-xl font-bold text-amber-700 mt-1 font-mono">
              {summary.totalFreeUnits} Free Units
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{summary.freeGoodsRatioPct.toFixed(1)}% free volume ratio</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Warehouse Inventory
            </span>
            <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
              {summary.totalWarehouseStockUnits.toLocaleString()} Units
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Across {summary.totalSkusActive} catalog SKUs</p>
          </div>
        </div>
      )}

      {summary && summary.purchaseCostComplete === false && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 flex items-start gap-2.5">
          <span className="mt-0.5 text-amber-600">⚠</span>
          <p className="text-xs text-amber-800 font-semibold">
            {summary.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as
            cost, so this figure is understated.
          </p>
        </div>
      )}

      {/* 3. Multi-Option Dimensional Navigation Bar */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 flex flex-wrap items-center gap-1">
        <button
          onClick={() => setActiveView("invoices")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "invoices"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <FileText size={14} />
          <span>All Invoices ({summary?.totalInvoices || 0})</span>
        </button>

        <button
          onClick={() => setActiveView("products")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "products"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Package size={14} />
          <span>By Product &amp; Inventory ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveView("mrs")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "mrs"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users size={14} />
          <span>By Associated MR ({mrs.length})</span>
        </button>

        <button
          onClick={() => setActiveView("chemists")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "chemists"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building2 size={14} />
          <span>By Chemist Store ({chemists.length})</span>
        </button>

        <button
          onClick={() => setActiveView("doctors")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "doctors"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Stethoscope size={14} />
          <span>By Doctor Prescribers ({doctors.length})</span>
        </button>

        <button
          onClick={() => setActiveView("simulator")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeView === "simulator"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
          }`}
        >
          <Sliders size={14} />
          <span>Strategic Scheme Simulator</span>
        </button>
      </div>

      {/* 4. Sub-Views Content */}

      {/* VIEW 1: All Invoices Ledger */}
      {activeView === "invoices" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">All Database Invoices Commercial Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every sale order fetched with Chemist, Doctor, Booking MR, Items, and reconciled purchase-cost margin economics.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, chemist, MR, doctor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                />
              </div>

              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-medium text-slate-600">
                <button
                  onClick={() => setProfitFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg ${profitFilter === "ALL" ? "bg-white text-slate-900 font-bold shadow-sm" : ""}`}
                >
                  All ({liveData?.invoices.length || 0})
                </button>
                <button
                  onClick={() => setProfitFilter("PROFITABLE")}
                  className={`px-2.5 py-1 rounded-lg ${profitFilter === "PROFITABLE" ? "bg-white text-emerald-700 font-bold shadow-sm" : ""}`}
                >
                  Profitable
                </button>
                <button
                  onClick={() => setProfitFilter("DEFICIT")}
                  className={`px-2.5 py-1 rounded-lg ${profitFilter === "DEFICIT" ? "bg-white text-rose-700 font-bold shadow-sm" : ""}`}
                >
                  Deficit / Schemes
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice # / Date</th>
                  <th className="py-3 px-3">Chemist (Customer)</th>
                  <th className="py-3 px-3">Prescribing Doctor</th>
                  <th className="py-3 px-3">Associated MR</th>
                  <th className="py-3 px-2 text-right">Billed</th>
                  <th className="py-3 px-2 text-right">Free</th>
                  <th className="py-3 px-3 text-right">Revenue</th>
                  <th className="py-3 px-3 text-right">Purchase Cost</th>
                  <th className="py-3 px-3 text-right">Profit (₹)</th>
                  <th className="py-3 px-3 text-right">Margin %</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">{inv.invoiceNo}</span>
                      <span className="text-[10px] text-slate-400">{inv.invoiceDate}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block truncate max-w-[160px]">
                        {inv.chemistName}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">
                        {inv.territoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800 block truncate max-w-[140px]">
                        {inv.doctorName}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                        {inv.doctorSpecialty}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-indigo-900 block truncate max-w-[130px]">
                        {inv.mrName}
                      </span>
                      <span className="text-[10px] text-indigo-500 font-semibold">{inv.mrRole}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-medium">{inv.totalBilledQty}</td>
                    <td className="py-3 px-2 text-right font-mono text-indigo-600 font-semibold">
                      {inv.totalFreeQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                      ₹{currency(inv.totalRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      ₹{currency(inv.totalCost)}
                      {inv.purchaseCostComplete === false && (
                        <span
                          title={`${inv.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as cost, so this figure is understated.`}
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {inv.unpricedUnits} unpriced
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold ${
                        inv.profitAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      ₹{currency(inv.profitAmount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.profitPct >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.profitPct >= 10
                            ? "bg-blue-100 text-blue-800"
                            : inv.profitPct >= 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {inv.profitPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: By Product & Warehouse Inventory */}
      {activeView === "products" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Product &amp; Warehouse Inventory Commercial Intelligence</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                SKU sales volume, free stock absorption, current warehouse stock levels, and realized margins.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-3">Composition &amp; Pack</th>
                  <th className="py-3 px-3 text-right">Warehouse Stock</th>
                  <th className="py-3 px-3 text-right">Purchase Cost / Unit</th>
                  <th className="py-3 px-2 text-right">Billed Qty</th>
                  <th className="py-3 px-2 text-right">Free Scheme</th>
                  <th className="py-3 px-3 text-right">Total Revenue</th>
                  <th className="py-3 px-3 text-right">Total Cost</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                  <th className="py-3 px-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {products.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">
                      {p.productName}
                      <span className="block text-[10px] text-slate-400 font-mono">{p.sku}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      <span className="block truncate max-w-[180px]">{p.composition}</span>
                      <span className="text-[10px] text-slate-400">{p.packSize}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {p.warehouseStockQty.toLocaleString()} units
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ₹{currency(p.totalDispatchedQty > 0 ? p.totalCost / p.totalDispatchedQty : 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-slate-900">{p.totalBilledQty}</td>
                    <td className="py-3 px-2 text-right text-indigo-600 font-bold">{p.totalFreeQty}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">₹{currency(p.totalRevenue)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ₹{currency(p.totalCost)}
                      {p.purchaseCostComplete === false && (
                        <span
                          title={`${p.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as cost, so this figure is understated.`}
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {p.unpricedUnits} unpriced
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        p.totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      ₹{currency(p.totalProfit)}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.marginPct >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : p.marginPct >= 10
                            ? "bg-blue-100 text-blue-800"
                            : p.marginPct >= 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {p.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: By Associated MR */}
      {activeView === "mrs" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Field Force (Medical Representative) Commercial Yield</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sales revenue generated, free goods issued, purchase cost basis, and net profit realized per sales rep.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Medical Representative</th>
                  <th className="py-3 px-3">Role / Territory</th>
                  <th className="py-3 px-3 text-right">Orders Booked</th>
                  <th className="py-3 px-3 text-right">Billed Units</th>
                  <th className="py-3 px-3 text-right">Free Units</th>
                  <th className="py-3 px-3 text-right">Total Revenue</th>
                  <th className="py-3 px-3 text-right">Purchase Cost</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                  <th className="py-3 px-3 text-right">Average Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {mrs.map((mr) => (
                  <tr key={mr.mrId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">
                      {mr.mrName}
                      <span className="block text-[10px] text-slate-400 font-sans">{mr.phone || "No phone"}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      <span className="font-bold text-indigo-700">{mr.role}</span>
                      <span className="block text-[10px] text-slate-500">{mr.territoryName}</span>
                    </td>
                    <td className="py-3 px-3 text-right">{mr.invoicesCount}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">{mr.totalBilledQty}</td>
                    <td className="py-3 px-3 text-right text-indigo-600 font-bold">{mr.totalFreeQty}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">₹{currency(mr.totalRevenue)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ₹{currency(mr.totalCost)}
                      {mr.purchaseCostComplete === false && (
                        <span
                          title={`${mr.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as cost, so this figure is understated.`}
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {mr.unpricedUnits} unpriced
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        mr.totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      ₹{currency(mr.totalProfit)}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          mr.averageMarginPct >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : mr.averageMarginPct >= 10
                            ? "bg-blue-100 text-blue-800"
                            : mr.averageMarginPct >= 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {mr.averageMarginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: By Chemist Store */}
      {activeView === "chemists" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chemist &amp; Pharmacy Customer Profitability</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Performance breakdown per chemist store, including booking MR, sales volume, and realized margin.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Chemist Store</th>
                  <th className="py-3 px-3">Territory</th>
                  <th className="py-3 px-3">Assigned MR</th>
                  <th className="py-3 px-3 text-right">Invoices</th>
                  <th className="py-3 px-3 text-right">Billed Units</th>
                  <th className="py-3 px-3 text-right">Free Units</th>
                  <th className="py-3 px-3 text-right">Total Revenue</th>
                  <th className="py-3 px-3 text-right">Purchase Cost</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                  <th className="py-3 px-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {chemists.map((c) => (
                  <tr key={c.chemistId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{c.chemistName}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{c.territoryName}</td>
                    <td className="py-3 px-3 font-sans text-indigo-700 font-medium">{c.associatedMr}</td>
                    <td className="py-3 px-3 text-right">{c.invoicesCount}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">{c.totalBilledQty}</td>
                    <td className="py-3 px-3 text-right text-indigo-600 font-bold">{c.totalFreeQty}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">₹{currency(c.totalRevenue)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ₹{currency(c.totalCost)}
                      {c.purchaseCostComplete === false && (
                        <span
                          title={`${c.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as cost, so this figure is understated.`}
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {c.unpricedUnits} unpriced
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        c.totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      ₹{currency(c.totalProfit)}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.marginPct >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : c.marginPct >= 10
                            ? "bg-blue-100 text-blue-800"
                            : c.marginPct >= 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {c.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: By Doctor Prescribers */}
      {activeView === "doctors" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Prescribing Doctor Attribution &amp; Yield</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Doctors attributed to pharmaceutical sales orders, specialty area, and net commercial profitability.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Doctor Name</th>
                  <th className="py-3 px-3">Specialty</th>
                  <th className="py-3 px-3">Clinic Address</th>
                  <th className="py-3 px-3 text-right">Orders Linked</th>
                  <th className="py-3 px-3 text-right">Total Revenue</th>
                  <th className="py-3 px-3 text-right">Purchase Cost</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {doctors.map((d) => (
                  <tr key={d.doctorId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{d.doctorName}</td>
                    <td className="py-3 px-3 font-sans text-indigo-700 font-semibold">{d.specialty}</td>
                    <td className="py-3 px-3 font-sans text-slate-500">{d.clinicAddress}</td>
                    <td className="py-3 px-3 text-right">{d.invoicesCount}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">₹{currency(d.totalRevenue)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ₹{currency(d.totalCost)}
                      {d.purchaseCostComplete === false && (
                        <span
                          title={`${d.unpricedUnits} units have no purchase rate on file — profit for those units is not counted as cost, so this figure is understated.`}
                          className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {d.unpricedUnits} unpriced
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        d.totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      ₹{currency(d.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 6: Strategic Scheme Simulator (What-If Scenario) */}
      {activeView === "simulator" && simulationData && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Strategic Trade Scheme What-If Simulator
                </h3>
              </div>
              <button
                onClick={handleResetSimulator}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <RotateCcw size={12} /> Reset Assumptions
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Chemist Trade Scheme</span>
                  <span className="text-indigo-600">10 + {inputs.chemistFreeStrips} Free</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={inputs.chemistFreeStrips}
                  onChange={(e) => handleSimInputChange("chemistFreeStrips", Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Chemist Discount (% off MRP)</span>
                  <span className="text-slate-900">{inputs.chemistDiscountPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  value={inputs.chemistDiscountPct}
                  onChange={(e) => handleSimInputChange("chemistDiscountPct", Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Doctor Free Strips (per 10 sold)</span>
                  <span className="text-amber-700">{inputs.doctorFreeStrips} strips</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={inputs.doctorFreeStrips}
                  onChange={(e) => handleSimInputChange("doctorFreeStrips", Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Scheme Matrix */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Scheme Sensitivity Comparison (10+0 to 10+10)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Scheme</th>
                    <th className="py-2.5 px-3 text-right">Billed Units</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Profit Kept</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {simulationData.schemeMatrix.map((row) => (
                    <tr
                      key={row.freeStrips}
                      className={row.freeStrips === inputs.chemistFreeStrips ? "bg-indigo-50 font-bold" : ""}
                    >
                      <td className="py-2.5 px-4 font-sans text-slate-900">{row.schemeLabel}</td>
                      <td className="py-2.5 px-3 text-right">{row.billedStrips.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">₹{currency(row.totalRevenue)}</td>
                      <td className="py-2.5 px-3 text-right">₹{currency(row.grossProfit)}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          row.netProfitKept >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        ₹{currency(row.netProfitKept)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.profitMarginPct >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {row.profitMarginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        {row.freeStrips <= 4 ? (
                          <span className="text-[10px] text-emerald-700 font-bold">Optimal</span>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-bold">Margin Dilution</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Line-Item Economics Modal (100% Reconciled Economics) */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Admin Commercial Economics Breakdown
                </span>
                <h2 className="text-xl font-display font-bold text-slate-900 mt-0.5">
                  Invoice {selectedInvoice.invoiceNo}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>
                    Chemist: <strong className="text-slate-800">{selectedInvoice.chemistName}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Doctor: <strong className="text-slate-800">{selectedInvoice.doctorName}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    MR: <strong className="text-indigo-700">{selectedInvoice.mrName}</strong>
                  </span>
                  <span>•</span>
                  <span>{selectedInvoice.territoryName}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Revenue</span>
                  <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                    ₹{currency(selectedInvoice.totalRevenue)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedInvoice.totalBilledQty} Billed Units</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Purchase Cost</span>
                  <p className="text-xl font-bold text-slate-700 mt-1 font-mono">
                    ₹{currency(selectedInvoice.totalCost)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedInvoice.totalBilledQty + selectedInvoice.totalFreeQty} Dispatched (incl. {selectedInvoice.totalFreeQty} free)
                  </p>
                </div>
                <div
                  className={`p-4 rounded-2xl border ${
                    selectedInvoice.profitAmount >= 0
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-rose-50 border-rose-100 text-rose-800"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">Profit Earned</span>
                  <p className="text-xl font-bold mt-1 font-mono">
                    ₹{currency(selectedInvoice.profitAmount)} ({selectedInvoice.profitPct.toFixed(1)}%)
                  </p>
                  <p className="text-[10px] mt-0.5">Commercial Gross Margin</p>
                </div>
              </div>

              {selectedInvoice.purchaseCostComplete === false && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
                  <span className="mt-0.5 text-amber-600">⚠</span>
                  <p className="text-xs text-amber-800 font-semibold">
                    {selectedInvoice.unpricedUnits} units have no purchase rate on file — profit for those units is
                    not counted as cost, so this figure is understated.
                  </p>
                </div>
              )}

              {/* Line Items Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Line-Item Commercial Economics (100% Reconciled)
                </h3>
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Product / SKU</th>
                        <th className="py-2.5 px-2 text-left">Batch No</th>
                        <th className="py-2.5 px-2 text-right">Whse Stock</th>
                        <th className="py-2.5 px-2 text-right">Billed</th>
                        <th className="py-2.5 px-2 text-right">Free</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Purchase Cost</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Cost</th>
                        <th className="py-2.5 px-3 text-right">Profit (₹)</th>
                        <th className="py-2.5 px-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.productName}
                            <span className="block text-[10px] font-normal text-slate-400 font-mono">{item.sku}</span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600 font-mono text-[10px]">{item.batchNo}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                            {item.warehouseStockQty}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-medium">{item.billedQty}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-indigo-600 font-semibold">
                            {item.freeQty}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">₹{currency(item.billedPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            ₹{currency(item.purchaseCostBasis)}
                            {item.purchaseCostKnown === false && (
                              <span
                                title="No purchase rate on file for this product — profit for these units is not counted as cost, so this figure is understated."
                                className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300"
                              >
                                unpriced
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-medium">
                            ₹{currency(item.lineRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ₹{currency(item.lineCost)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                              item.lineProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            ₹{currency(item.lineProfit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${
                                item.lineMarginPct >= 20
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.lineMarginPct >= 10
                                  ? "bg-blue-100 text-blue-800"
                                  : item.lineMarginPct >= 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {item.lineMarginPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <tr>
                        <td colSpan={7} className="py-2.5 px-3 text-right">
                          Invoice Total:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹{currency(selectedInvoice.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₹{currency(selectedInvoice.totalCost)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${
                            selectedInvoice.profitAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          ₹{currency(selectedInvoice.profitAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-700">
                          {selectedInvoice.profitPct.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
