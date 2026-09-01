"use client";

import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Activity,
  Crosshair,
  TrendingUp,
  LineChart,
  UserCheck,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface DoctorPot {
  id: string;
  fullName: string;
  primarySpecialty: string;
  dpsScore: number;
  dpsTier: string | null;
  requiredMonthlyVisits: number;
  visitsThisMonth: number;
  visitGap: number;
  territory: { name: string; priority: number } | null;
}

export default function DoctorPotentialDashboard() {
  const [data, setData] = useState<DoctorPot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () => {
    apiClient
      .get("/api/manager/doctors/dps")
      .then((res) => setData(res.data.data.doctors))
      .catch((err) => console.error("Failed to load DPS:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await apiClient.post("/api/manager/doctors/dps");
      load();
    } catch (err) {
      console.error("Failed to run analysis:", err);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const avgDps = data.length > 0
    ? (data.reduce((sum, d) => sum + d.dpsScore, 0) / data.length / 10).toFixed(1)
    : "0.0";
  const highPotential = data.filter((d) => d.dpsTier === "A+" || d.dpsTier === "A").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Doctor Potential & Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">AI-driven CRM analytics and actionable insights</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <BrainCircuit size={16} className={running ? "animate-spin" : ""} />
          {running ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile icon={Activity} label="Avg DPS Score" value={`${avgDps} / 10`} tone="good" />
        <KpiTile icon={Crosshair} label="High Potential Targets" value={String(highPotential)} tone="warn" />
        <KpiTile icon={TrendingUp} label="Overall Sample ROI" value="285%" tone="good" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Intelligence Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <LineChart size={18} className="text-indigo-600" />
              Intelligence Grid
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold">Doctor</th>
                  <th className="px-6 py-3 font-semibold">DPS Score</th>
                  <th className="px-6 py-3 font-semibold">Intel Score</th>
                  <th className="px-6 py-3 font-semibold">Competition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-405">
                      No doctor analysis data found. Click "Run Analysis" to generate.
                    </td>
                  </tr>
                )}
                {data.map((doc) => {
                  const score10 = (doc.dpsScore / 10).toFixed(1);
                  const competitorIntensity = doc.territory?.priority === 2 ? "HIGH" : "MEDIUM";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{doc.fullName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{doc.primarySpecialty}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${doc.dpsScore > 90 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {score10}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.round(doc.dpsScore)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{Math.round(doc.dpsScore)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase
                          ${competitorIntensity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {competitorIntensity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: AI Insights */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit size={18} className="text-indigo-600" />
            AI Recommended Actions
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 space-y-3">
            {data.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No insights available.</p>
            )}
            {data.map((doc) => {
              const insight = doc.visitGap > 0
                ? `${doc.fullName} requires ${doc.requiredMonthlyVisits} monthly visits but has only ${doc.visitsThisMonth} recorded. Visit gap is ${doc.visitGap}. Recommend scheduling an immediate call.`
                : `${doc.fullName} has met their monthly visit requirement of ${doc.requiredMonthlyVisits} calls.`;
              return (
                <div key={doc.id} className="p-3 rounded-xl border border-indigo-50 bg-gradient-to-br from-indigo-50/50 to-white hover:border-indigo-200 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-indigo-100 text-indigo-600 mt-1">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{doc.fullName}</h3>
                      <p className="text-xs text-slate-650 mt-1 leading-relaxed">
                        {insight}
                      </p>
                      <button className="text-xs font-semibold text-indigo-600 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Take Action <UserCheck size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-700" : tone === "good" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
