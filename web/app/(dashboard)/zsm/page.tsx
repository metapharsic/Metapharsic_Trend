import React from "react";
import { performanceService } from "@/services/performance.service";
import { RegionalLeaderboard } from "@/components/zsm/regional-leaderboard";
import { Target, Users, DollarSign, AlertTriangle, TrendingUp, Activity, CheckCircle, FileText, ChevronRight, Briefcase, MapPin } from "lucide-react";

export default async function ZSMDashboard() {
  // Fetch data on the server
  const regionalData = await performanceService.getRegionalPerformances("zsm-mock-id");

  // Calculate Zone Roll-ups
  const totalTarget = regionalData.reduce((acc, curr) => acc + curr.sales.target, 0);
  const totalAchieved = regionalData.reduce((acc, curr) => acc + curr.sales.achieved, 0);
  
  // Mock Team & Field Activity Roll-ups
  const activeEmployees = 142; // RMs + ASMs + MRs
  const avgCallsPerMr = 10.4;
  
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm mb-8">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-blue-800 to-blue-500 bg-clip-text text-transparent">
            East Zone Overview
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Real-time performance across all regions under your command.</p>
        </div>
        <div className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-blue-50 to-white text-blue-700 rounded-full text-xs font-bold border border-blue-100/50 shadow-sm flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live Sync Active
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
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">₹{(totalAchieved / 100000).toFixed(0)}<span className="text-xl text-gray-400 font-bold ml-1">L</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">
                {((totalAchieved / totalTarget) * 100).toFixed(1)}%
              </span> 
              of target
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
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">+18.4<span className="text-xl text-gray-400 font-bold ml-1">%</span></h3>
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
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{activeEmployees}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Across all regions</p>
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
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{avgCallsPerMr}</h3>
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
              <span className="font-bold text-sm text-gray-900">92%</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm text-gray-900">Doctor Calls</span>
              </div>
              <span className="font-bold text-sm text-gray-900">1,240</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-sm text-gray-900">Chemist Calls</span>
              </div>
              <span className="font-bold text-sm text-gray-900">890</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-sm text-gray-900">Missed Visits</span>
              </div>
              <span className="font-bold text-sm text-gray-900">42</span>
            </div>
            
            <button className="w-full mt-2 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors">
              View Detailed Activity Log
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Widgets Grid (Scaffolds) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Customer Coverage */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-indigo-400 group-hover:scale-110 transition-transform border border-gray-100">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Customer Coverage</h3>
          <p className="text-xs text-gray-500 mt-1">Doctor & Chemist networks</p>
        </div>

        {/* Approvals */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-emerald-400 group-hover:scale-110 transition-transform border border-gray-100">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Pending Approvals</h3>
          <p className="text-xs text-gray-500 mt-1">12 requests waiting</p>
        </div>

        {/* Financials */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-cyan-400 group-hover:scale-110 transition-transform border border-gray-100">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Financial Summary</h3>
          <p className="text-xs text-gray-500 mt-1">Collections & Outstanding</p>
        </div>

        {/* Zone Alerts */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-orange-400 group-hover:scale-110 transition-transform border border-gray-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Zone Alerts</h3>
          <p className="text-xs text-red-500 font-semibold mt-1">5 Critical Flags</p>
        </div>

      </div>
    </div>
  );
}
