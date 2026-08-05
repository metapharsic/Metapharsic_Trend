"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  CalendarX2,
  FileText,
  BadgeAlert,
  ChevronRight,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface LeaveRequest {
  id: string;
  employee: { firstName: string; lastName: string };
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export default function HrmsDashboard() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/api/hrms/leave")
      .then((res) => setLeaves(res.data.data.leaveRequests ?? []))
      .catch(() => {
        setLeaves([
          { id: "LR-401", employee: { firstName: "Rahul", lastName: "D." }, leaveType: "Sick Leave", startDate: "2026-08-05", endDate: "2026-08-06", status: "PENDING" },
          { id: "LR-402", employee: { firstName: "Sneha", lastName: "Patel" }, leaveType: "Annual Leave", startDate: "2026-08-10", endDate: "2026-08-14", status: "APPROVED" },
          { id: "LR-403", employee: { firstName: "Vikram", lastName: "Singh" }, leaveType: "Casual Leave", startDate: "2026-08-12", endDate: "2026-08-12", status: "PENDING" },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100 flex justify-between items-center bg-gradient-to-r from-rose-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Human Resources</h1>
          <p className="text-sm text-slate-500 mt-1">Manage leaves, payroll, and employee lifecycle</p>
        </div>
        <button className="bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-rose-700 shadow-sm transition-colors flex items-center gap-2">
          <UserPlus size={16} /> Onboard Employee
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Users} label="Total Headcount" value="482" tone="neutral" />
        <KpiTile icon={CalendarX2} label="Pending Leaves" value="12" tone="warn" />
        <KpiTile icon={FileText} label="Payroll Ready" value="95%" tone="good" />
        <KpiTile icon={BadgeAlert} label="Attendance Anomalies" value="8" tone="error" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Leave Requests</h2>
            <button className="text-xs font-semibold text-rose-600 flex items-center">View All <ChevronRight size={14}/></button>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {leaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-900">{leave.employee.firstName} {leave.employee.lastName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{leave.leaveType}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-slate-600 font-medium">Starts: {new Date(leave.startDate).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase
                      ${leave.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {leave.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Payroll Generation</h2>
          </div>
          <div className="p-6 text-center space-y-4 flex flex-col items-center justify-center h-48">
             <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
               <FileText size={32} />
             </div>
             <div>
               <p className="text-sm font-semibold text-slate-700">August 2026 Payroll</p>
               <p className="text-xs text-slate-500 mt-1">Pending approval from Finance Dept.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : tone === "error" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600";
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
