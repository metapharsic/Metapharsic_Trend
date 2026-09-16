"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Gift,
  MonitorPlay,
  Percent,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Calculator,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  FileText,
  CheckCircle2,
  ExternalLink,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Campaign {
  id: string;
  name: string;
  type: "DISCOUNT" | "GIFT" | "E_DETAILING";
  targetAudience: string;
  engagementRate: number;
  status: "ACTIVE" | "SCHEDULED";
  discountPct?: number;
  minQty?: number;
  freeQty?: number;
}

interface VisualAidAsset {
  id: string;
  title: string;
  productName: string;
  active: boolean;
  fileUrl: string;
  fileType?: string;
}

interface MarketingData {
  kpis: {
    activeCampaigns: number;
    visualAidsDeployed: number;
    avgEngagement: number;
    giftBudgetUtilized: number;
  };
  campaigns: Campaign[];
  visualAids: VisualAidAsset[];
  giftsDistributed: number;
}

export default function MarketingDashboard() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"schemes" | "visualAids" | "gifts">("schemes");

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get("/api/marketing/dashboard")
      .then((res) => {
        setData(res.data.data);
      })
      .catch((err) => {
        console.error("Failed to load marketing dashboard:", err);
        setError("Failed to load marketing data from database.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-rose-900">Marketing Dashboard Unavailable</h2>
          <p className="text-sm text-rose-700">{error ?? "Could not load data."}</p>
          <button
            onClick={fetchDashboard}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Top Header Card ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">Marketing &amp; Campaign Intelligence</h1>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-200">
              Multi-Agent Synced
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Live management of commercial discount schemes, doctor e-detailing collateral, and promotional gift allocations
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/simulator"
            className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Calculator size={15} />
            <span>Simulate &amp; Launch Scheme</span>
            <ArrowRight size={14} />
          </Link>

          <button
            onClick={fetchDashboard}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Megaphone} label="Active Schemes" value={data.kpis.activeCampaigns} />
        <KpiTile icon={MonitorPlay} label="Visual Aids Deployed" value={data.kpis.visualAidsDeployed} />
        <KpiTile icon={TrendingUp} label="Doctor Engagement" value={`${data.kpis.avgEngagement}%`} tone="good" />
        <KpiTile icon={Gift} label="Gift Budget Utilized" value={`${data.kpis.giftBudgetUtilized}%`} tone={data.kpis.giftBudgetUtilized > 80 ? "warn" : "neutral"} />
      </div>

      {/* ── Multi-Agent Marketing & Field Review ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md border border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-300">
            <Sparkles size={20} className="text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Multi-Agent Marketing Synthesis</span>
            <p className="text-sm font-semibold text-white mt-0.5">
              {data.kpis.activeCampaigns} live schemes driving secondary sales orders with {data.kpis.avgEngagement}% detailing feedback rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mr/reports/council"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-indigo-200 transition border border-white/15 inline-flex items-center gap-1"
          >
            <span>Council Granular Audit</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("schemes")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "schemes"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Percent size={16} />
          <span>Active Commercial Schemes ({data.campaigns.filter((c) => c.type === "DISCOUNT").length})</span>
        </button>

        <button
          onClick={() => setActiveTab("visualAids")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "visualAids"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <MonitorPlay size={16} />
          <span>E-Detailing Visual Aids ({data.visualAids.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("gifts")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "gifts"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Gift size={16} />
          <span>Promotional Gifts ({data.giftsDistributed} Units)</span>
        </button>
      </div>

      {/* ── TAB 1: Live Promotional & Detailing Schemes ── */}
      {activeTab === "schemes" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" />
              Live Promotional &amp; Detailing Schemes
            </h2>
            <Link
              href="/simulator"
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <span>Launch New in Scheme Simulator</span>
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">Campaign / Scheme</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Target / Requirements</th>
                  <th className="px-6 py-4 font-semibold">Engagement</th>
                  <th className="px-6 py-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No active marketing campaigns found in database.
                    </td>
                  </tr>
                ) : (
                  data.campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{camp.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {camp.type === "DISCOUNT" && <Percent size={12} />}
                          {camp.type === "GIFT" && <Gift size={12} />}
                          {camp.type === "E_DETAILING" && <MonitorPlay size={12} />}
                          {camp.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{camp.targetAudience}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${camp.engagementRate}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{camp.engagementRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase
                          ${camp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {camp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: E-Detailing Visual Aids Gallery ── */}
      {activeTab === "visualAids" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.visualAids.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
              <MonitorPlay size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No visual aids uploaded yet.</p>
              <p className="text-xs text-slate-400 mt-1">Upload digital visual aids in Document Management (DMS).</p>
            </div>
          ) : (
            data.visualAids.map((va) => (
              <div key={va.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase">
                      {va.fileType || "PDF Asset"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 size={12} /> Active Detailing
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-2">{va.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">Product: <strong className="text-slate-700">{va.productName}</strong></p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Deployed to MR Tablet app</span>
                  {va.fileUrl && (
                    <a
                      href={va.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Preview</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 3: Doctor Promotional Gifts & Samples ── */}
      {activeTab === "gifts" && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Gift size={18} className="text-fuchsia-600" />
              Doctor Promotional Gifting &amp; Detailing Merchandise
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Total Units Disbursed: <strong className="text-slate-900">{data.giftsDistributed}</strong>
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Prescriber sample distributions and promotional gifts are tracked via field DCR calls. Every allocation is verified against monthly doctor tiering standards.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Gifts Disbursed This Month</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{data.giftsDistributed} units</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Doctor Coverage Reach</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{data.kpis.giftBudgetUtilized}%</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Detailing Feedback Conversion</span>
              <p className="text-2xl font-black text-indigo-600 mt-1">{data.kpis.avgEngagement}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-100 text-amber-600"
      : tone === "good"
      ? "bg-emerald-100 text-emerald-600"
      : "bg-indigo-100 text-indigo-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
