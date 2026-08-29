"use client";

import React, { useEffect, useState } from "react";
import {
  Megaphone,
  Gift,
  MonitorPlay,
  Percent,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertCircle,
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
  assetUrl: string;
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
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Marketing & Campaign Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Live management of e-detailing visual aids, doctor promotional gifts, and discount schemes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Megaphone} label="Active Schemes" value={data.kpis.activeCampaigns} />
        <KpiTile icon={MonitorPlay} label="Visual Aids Deployed" value={data.kpis.visualAidsDeployed} />
        <KpiTile icon={TrendingUp} label="Doctor Engagement" value={`${data.kpis.avgEngagement}%`} tone="good" />
        <KpiTile icon={Gift} label="Gift Budget Utilized" value={`${data.kpis.giftBudgetUtilized}%`} tone={data.kpis.giftBudgetUtilized > 80 ? "warn" : "neutral"} />
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            Live Promotional & Detailing Schemes
          </h2>
          <span className="text-xs font-semibold text-slate-500">{data.campaigns.length} Active Schemes</span>
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
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: number | string; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600";
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
