"use client";

import React, { useEffect, useState } from "react";
import {
  Megaphone,
  Gift,
  MonitorPlay,
  Percent,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "DISCOUNT" | "GIFT" | "E_DETAILING";
  targetAudience: string;
  engagementRate: number;
  status: "ACTIVE" | "SCHEDULED";
}

interface MarketingData {
  kpis: {
    activeCampaigns: number;
    visualAidsDeployed: number;
    avgEngagement: number;
    giftBudgetUtilized: number; // percentage
  };
  campaigns: Campaign[];
}

export default function MarketingDashboard() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setData({
        kpis: {
          activeCampaigns: 12,
          visualAidsDeployed: 45,
          avgEngagement: 68,
          giftBudgetUtilized: 72,
        },
        campaigns: [
          {
            id: "CMP-001",
            name: "CardioQ3 Push",
            type: "E_DETAILING",
            targetAudience: "Cardiologists (KOL)",
            engagementRate: 85,
            status: "ACTIVE",
          },
          {
            id: "CMP-002",
            name: "Festive Bonus Scheme",
            type: "DISCOUNT",
            targetAudience: "Tier 1 Distributors",
            engagementRate: 92,
            status: "ACTIVE",
          },
          {
            id: "CMP-003",
            name: "Annual Medical Conf Kits",
            type: "GIFT",
            targetAudience: "All Physicians",
            engagementRate: 45,
            status: "SCHEDULED",
          },
        ],
      });
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Marketing & Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">Manage e-detailing, gifts, and discount schemes</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
            New Campaign
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Megaphone} label="Active Campaigns" value={data.kpis.activeCampaigns} />
        <KpiTile icon={MonitorPlay} label="Visual Aids Deployed" value={data.kpis.visualAidsDeployed} />
        <KpiTile icon={TrendingUp} label="Avg Engagement" value={`${data.kpis.avgEngagement}%`} tone="good" />
        <KpiTile icon={Gift} label="Gift Budget Utilized" value={`${data.kpis.giftBudgetUtilized}%`} tone={data.kpis.giftBudgetUtilized > 80 ? "warn" : "neutral"} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            Campaign Performance
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="px-6 py-4 font-semibold">Campaign Name</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Target Audience</th>
              <th className="px-6 py-4 font-semibold">Engagement</th>
              <th className="px-6 py-4 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.campaigns.map((camp) => (
              <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-900">{camp.name}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {camp.type === 'DISCOUNT' && <Percent size={12} />}
                    {camp.type === 'GIFT' && <Gift size={12} />}
                    {camp.type === 'E_DETAILING' && <MonitorPlay size={12} />}
                    {camp.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 font-medium">{camp.targetAudience}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${camp.engagementRate}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{camp.engagementRate}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase
                    ${camp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {camp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
