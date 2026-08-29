"use client";

import React, { useEffect, useState } from "react";
import { RegionalLeaderboard } from "@/components/zsm/regional-leaderboard";
import { Target, Users, DollarSign, AlertTriangle, TrendingUp, Activity, CheckCircle, FileText, Briefcase, MapPin, RefreshCw, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { RegionalPerformanceDTO } from "@/types/performance.types";

interface ZsmData {
  regionalData: RegionalPerformanceDTO[];
  zoneKpis: {
    totalTarget: number;
    totalAchieved: number;
    achievementPercentage: number;
    ytdGrowth: number;
    activeEmployees: number;
    avgCallsPerMr: number;
  };
  fieldActivity: {
    tourPlanCompliance: number;
    doctorCalls: number;
    chemistCalls: number;
    missedVisits: number;
  };
  widgets: {
    coverage: {
      totalDoctors: number;
      totalChemists: number;
      totalCustomers: number;
    };
    pendingApprovals: {
      expenses: number;
      tourPlans: number;
      leaves: number;
      total: number;
    };
    financials: {
      collectionsThisMonth: number;
    };
    zoneAlerts: {
      criticalAnomalies: number;
    };
  };
}

export default function ZSMDashboard() {
  const [data, setData] = useState<ZsmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get("/api/manager/dashboard/zsm")
      .then((res) => {
        setData(res.data.data);
      })
      .catch((err) => {
        console.error("Failed to load ZSM dashboard:", err);
        setError("Failed to load live regional metrics. Please check network connection.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-rose-900">Zonal Dashboard Unavailable</h2>
          <p className="text-sm text-rose-700">{error ?? "Could not load data."}</p>
          <button
            onClick={fetchData}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  const { regionalData, zoneKpis, fieldActivity, widgets } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm mb-8">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-blue-800 to-blue-500 bg-clip-text text-transparent">
            Zonal Performance Command
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Real-time performance across all regions from live database.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={fetchData}
            className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-white text-blue-700 rounded-full text-xs font-bold border border-blue-100/50 shadow-sm flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live Sync Active
          </div>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Zone Sales */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Total Zone Sales</p>
            <div className="p-2.5 bg-emerald-100/50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              ₹{(zoneKpis.totalAchieved / 100000).toFixed(0)}
              <span className="text-xl text-gray-400 font-bold ml-1">L</span>
            </h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">
                {zoneKpis.achievementPercentage}%
              </span> 
              of ₹{(zoneKpis.totalTarget / 100000).toFixed(0)}L Target
            </p>
          </div>
        </div>

        {/* YTD Growth */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">YTD Growth</p>
            <div className="p-2.5 bg-purple-100/50 rounded-xl text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              +{zoneKpis.ytdGrowth}
              <span className="text-xl text-gray-400 font-bold ml-1">%</span>
            </h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center text-purple-600">
              Versus previous year
            </p>
          </div>
        </div>

        {/* Active Employees */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Active Employees</p>
            <div className="p-2.5 bg-blue-100/50 rounded-xl text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{zoneKpis.activeEmployees}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Across assigned territories</p>
          </div>
        </div>

        {/* Field Activity Avg */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Avg Calls / MR</p>
            <div className="p-2.5 bg-amber-100/50 rounded-xl text-amber-600">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{zoneKpis.avgCallsPerMr}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Daily average this month</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Leaderboard & Field Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="xl:col-span-2 group">
          <RegionalLeaderboard data={regionalData} />
        </div>
        
        {/* Field Activity List */}
        <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 h-96 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Field Activity</h3>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-sm text-gray-900">Tour Plan Compliance</span>
              </div>
              <span className="font-bold text-sm text-gray-900">{fieldActivity.tourPlanCompliance}%</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm text-gray-900">Doctor Calls</span>
              </div>
              <span className="font-bold text-sm text-gray-900">{fieldActivity.doctorCalls.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-sm text-gray-900">Chemist Calls</span>
              </div>
              <span className="font-bold text-sm text-gray-900">{fieldActivity.chemistCalls.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-sm text-gray-900">Missed Visits / Anomalies</span>
              </div>
              <span className="font-bold text-sm text-gray-900">{fieldActivity.missedVisits}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Customer Coverage */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-indigo-500 group-hover:scale-110 transition-transform border border-gray-100">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Customer Coverage</h3>
          <p className="text-xs text-gray-500 mt-1">
            {widgets.coverage.totalDoctors} Doctors | {widgets.coverage.totalChemists} Chemists
          </p>
        </div>

        {/* Approvals */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-emerald-500 group-hover:scale-110 transition-transform border border-gray-100">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Pending Approvals</h3>
          <p className="text-xs text-gray-500 mt-1">
            {widgets.pendingApprovals.total} requests waiting review
          </p>
        </div>

        {/* Financials */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-cyan-500 group-hover:scale-110 transition-transform border border-gray-100">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Financial Summary</h3>
          <p className="text-xs text-gray-500 mt-1">
            ₹{(widgets.financials.collectionsThisMonth / 100000).toFixed(1)}L Collections This Month
          </p>
        </div>

        {/* Zone Alerts */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-orange-500 group-hover:scale-110 transition-transform border border-gray-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Zone Alerts</h3>
          <p className="text-xs text-red-500 font-semibold mt-1">
            {widgets.zoneAlerts.criticalAnomalies} Critical Flags
          </p>
        </div>
      </div>
    </div>
  );
}
