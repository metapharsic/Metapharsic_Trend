import React from "react";
import { performanceService } from "@/services/performance.service";
import { ZonalLeaderboard } from "@/components/nsm/zonal-leaderboard";
import { Target, Activity, DollarSign, AlertCircle, TrendingUp, Package, Clock, ChevronRight } from "lucide-react";

export default async function NSMDashboard() {
  // Fetch data on the server
  const zonalData = await performanceService.getZonalPerformances("nsm-mock-id");

  // Calculate National Roll-ups
  const totalTarget = zonalData.reduce((acc, curr) => acc + curr.sales.target, 0);
  const totalAchieved = zonalData.reduce((acc, curr) => acc + curr.sales.achieved, 0);
  const avgCompliance = zonalData.reduce((acc, curr) => acc + curr.compliancePercentage, 0) / zonalData.length;
  const totalAnomalies = zonalData.reduce((acc, curr) => acc + curr.activeAnomalies, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm mb-8">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-primary-800 to-primary-500 bg-clip-text text-transparent">
            National Overview
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Real-time performance across all zones.</p>
        </div>
        <div className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-primary-50 to-white text-primary-700 rounded-full text-xs font-bold border border-primary-100/50 shadow-sm flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
          </span>
          Live Sync Active
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Target vs Achievement */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">National Revenue</p>
            <div className="p-2.5 bg-emerald-100/50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">₹{(totalAchieved / 10000000).toFixed(2)}<span className="text-xl text-gray-400 font-bold ml-1">Cr</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">
                {((totalAchieved / totalTarget) * 100).toFixed(1)}%
              </span> 
              of ₹{(totalTarget / 10000000).toFixed(2)}Cr Target
            </p>
          </div>
        </div>

        {/* Compliance */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">DCR Compliance</p>
            <div className="p-2.5 bg-blue-100/50 rounded-xl text-blue-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{avgCompliance.toFixed(1)}<span className="text-xl text-gray-400 font-bold ml-1">%</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">National average today</p>
          </div>
        </div>

        {/* Growth */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">YTD Growth</p>
            <div className="p-2.5 bg-purple-100/50 rounded-xl text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">+14.2<span className="text-xl text-gray-400 font-bold ml-1">%</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center text-purple-600">
              Versus previous year
            </p>
          </div>
        </div>

        {/* Anomalies */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Active Anomalies</p>
            <div className="p-2.5 bg-red-100/50 rounded-xl text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{totalAnomalies}</h3>
            <p className="text-sm text-red-600 font-bold mt-2 bg-red-50 inline-block px-2 py-0.5 rounded-md">Requires attention</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Leaderboard & Brand Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leaderboard takes 2/3 width */}
        <div className="xl:col-span-2 group">
          <div className="transition-all duration-300 group-hover:shadow-lg rounded-3xl">
            <ZonalLeaderboard data={zonalData} />
          </div>
        </div>
        
        {/* Brand Strategy takes 1/3 width */}
        <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 h-96 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-xl text-primary-600">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Top Brands</h3>
            </div>
            <button className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center group/btn">
              View All <ChevronRight className="w-4 h-4 ml-0.5 transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {/* Mock Items */}
            {[
              { name: "Cardiace Plus", rev: "₹2.4Cr", trend: "+12%", color: "bg-primary-500", progress: "85%" },
              { name: "Neurofen 500", rev: "₹1.8Cr", trend: "+8%", color: "bg-blue-400", progress: "70%" },
              { name: "GastroGuard", rev: "₹1.5Cr", trend: "-3%", color: "bg-purple-400", progress: "55%" },
              { name: "Vitamax C", rev: "₹95L", trend: "+5%", color: "bg-amber-400", progress: "40%" },
              { name: "OsteoFlex", rev: "₹82L", trend: "+15%", color: "bg-emerald-400", progress: "30%" },
            ].map((brand, i) => (
              <div key={i} className="group/item flex flex-col p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm text-gray-900 group-hover/item:text-primary-600 transition-colors">{brand.name}</p>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">Nat. Revenue</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-gray-900">{brand.rev}</p>
                    <p className={`text-[11px] font-bold ${brand.trend.startsWith('+') ? 'text-emerald-600' : 'text-red-600'} flex items-center justify-end gap-0.5`}>
                      {brand.trend.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : null}
                      {brand.trend}
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`${brand.color} h-1.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: brand.progress }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Institutional Tracker & Escalations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Institutional Tracker Scaffold */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-8 rounded-3xl shadow-sm border border-gray-100 h-64 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 group-hover:scale-110 transition-all duration-300 border border-gray-100">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-lg text-gray-900 font-bold">Institutional Tracker</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm font-medium">
            Hospital tenders and corporate sales metrics will be integrated here in Phase 4.
          </p>
        </div>

        {/* Escalations Scaffold */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 p-8 rounded-3xl shadow-sm border border-gray-100 h-64 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4 text-orange-400 group-hover:scale-110 transition-all duration-300 border border-gray-100">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg text-gray-900 font-bold">Pending Escalations</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm font-medium">
            High-value Zonal expense approvals and critical leave requests will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
