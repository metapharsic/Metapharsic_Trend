"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { MrLeaderboard } from "@/components/asm/mr-leaderboard";
import {
  Users, DollarSign, AlertTriangle, CheckCircle,
  MapPin, Clock, CalendarX, FileCheck,
} from "lucide-react";

interface MrRow {
  employeeId: string;
  employeeName: string;
  territoryName: string;
  sales: { target: number; achieved: number; percentage: number };
  callsPlanned: number;
  callsCompleted: number;
  isCheckedIn: boolean;
  collected: number;
}

export default function ASMDashboard() {
  const [mrData, setMrData] = useState<MrRow[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/asm/dashboard")
      .then((res) => {
        setMrData(res.data.data.mrs ?? []);
        setTotalCollected(res.data.data.totalCollected ?? 0);
      })
      .catch((err) => console.error("Failed to load ASM dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalTarget = mrData.reduce((acc, curr) => acc + curr.sales.target, 0);
  const totalAchieved = mrData.reduce((acc, curr) => acc + curr.sales.achieved, 0);
  const activeFieldForce = mrData.filter((mr) => mr.isCheckedIn).length;
  const missedVisits = mrData.reduce((acc, curr) => acc + Math.max(0, curr.callsPlanned - curr.callsCompleted), 0);
  const outstandingTotal = totalAchieved - totalCollected;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm mb-8">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-800 to-indigo-500 bg-clip-text text-transparent">
            Area Overview
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Daily tactical summary of your Medical Representatives.</p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Sales */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Today's Sales</p>
            <div className="p-2.5 bg-emerald-100/50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">₹{(totalAchieved / 1000).toFixed(0)}<span className="text-xl text-gray-400 font-bold ml-1">k</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">
                {totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0"}%
              </span>
              of daily target
            </p>
          </div>
        </div>

        {/* Collection */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Collection</p>
            <div className="p-2.5 bg-purple-100/50 rounded-xl text-purple-600">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">₹{(totalCollected / 1000).toFixed(0)}<span className="text-xl text-gray-400 font-bold ml-1">k</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium flex items-center text-purple-600">
              ₹{Math.max(0, outstandingTotal / 1000).toFixed(0)}k Outstanding
            </p>
          </div>
        </div>

        {/* MR Check-in Status */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Active Field Force</p>
            <div className="p-2.5 bg-blue-100/50 rounded-xl text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{activeFieldForce}<span className="text-xl text-gray-400 font-bold ml-1">/ {mrData.length}</span></h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Checked in today</p>
          </div>
        </div>

        {/* Missed Visits */}
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Missed Visits</p>
            <div className="p-2.5 bg-red-100/50 rounded-xl text-red-600">
              <CalendarX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{missedVisits}</h3>
            <p className="text-sm text-red-600 font-bold mt-2 bg-red-50 inline-block px-2 py-0.5 rounded-md">Requires attention</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Leaderboard & MR Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="xl:col-span-2 group">
          <MrLeaderboard data={mrData} />
        </div>

        {/* Live MR Status List */}
        <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 h-96 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Live Team Status</h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {mrData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-8">No MRs assigned to you yet.</p>
            ) : (
              mrData.map((mr) => (
                <div key={mr.employeeId} className="group/item flex flex-col p-3.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${mr.isCheckedIn ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 group-hover/item:text-indigo-600 transition-colors">{mr.employeeName}</p>
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">{mr.territoryName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-900">{mr.callsCompleted} / {mr.callsPlanned}</p>
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">Calls Done</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`${mr.isCheckedIn ? 'bg-indigo-500' : 'bg-gray-400'} h-1.5 rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${mr.callsPlanned > 0 ? Math.min(100, (mr.callsCompleted / mr.callsPlanned) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Advanced Widgets Grid (Scaffolds) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-emerald-400 group-hover:scale-110 transition-transform border border-gray-100">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Live GPS Map</h3>
          <p className="text-xs text-gray-500 mt-1">Real-time MR location tracking</p>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-blue-400 group-hover:scale-110 transition-transform border border-gray-100">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Activity Log</h3>
          <p className="text-xs text-gray-500 mt-1">Detailed breakdown of idle time</p>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-indigo-400 group-hover:scale-110 transition-transform border border-gray-100">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Pending Approvals</h3>
          <p className="text-xs text-gray-500 mt-1">Expenses, DCRs, & Leaves</p>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 rounded-3xl shadow-sm border border-gray-100 h-48 flex flex-col justify-center items-center text-center group cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <div className="w-12 h-12 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-3 text-orange-400 group-hover:scale-110 transition-transform border border-gray-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-md text-gray-900 font-bold">Actionable Alerts</h3>
          <p className="text-xs text-red-500 font-semibold mt-1">{missedVisits > 0 ? `${missedVisits} missed visit(s)` : "None"}</p>
        </div>

      </div>
    </div>
  );
}
