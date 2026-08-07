"use client";

import React, { useEffect, useState, useCallback } from "react";
import { BarChart3, Stethoscope, Store, Clock, Boxes, Gauge, CalendarDays } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type Period = "daily" | "weekly" | "monthly";

interface CallReport {
  period: Period;
  range: { start: string; end: string };
  employee: { id: string | null; name: string };
  totals: {
    totalCalls: number;
    doctorCalls: number;
    chemistCalls: number;
    totalBoxesPlaced: number;
    avgDurationMinutes: number;
    avgCqsScore: number | null;
  };
  byDay: Record<string, number>;
  calls: { id: string; name: string; purpose: string; createdAt: string; durationMinutes: number | null; boxesPlaced: number | null; employeeName: string }[];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function MrReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [report, setReport] = useState<CallReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<{ id: string; employeeId: string; firstName: string; lastName: string }[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");

  useEffect(() => {
    apiClient.get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  const fetchReport = useCallback(() => {
    setLoading(true);
    apiClient.get("/api/mr/reports/calls", { params: { period, ...(selectedRep ? { employeeId: selectedRep } : {}) } })
      .then((res) => setReport(res.data.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [period, selectedRep]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <BarChart3 size={22} className="text-indigo-300" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              {report ? (selectedRep ? `${report.employee.name}'s Call Reports` : reps.length > 0 ? "All MRs — Call Reports" : "My Call Reports") : "My Call Reports"}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Daily, weekly, or monthly call activity — on request</p>
          </div>
          {reps.length > 0 && (
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All MRs</option>
              {reps.map((r) => (
                <option key={r.employeeId} value={r.employeeId}>{r.firstName} {r.lastName}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                period === p.key ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !report && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 text-sm">Loading report...</div>
      )}

      {report && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays size={13} />
            {dateStr(report.range.start)} – {dateStr(new Date(new Date(report.range.end).getTime() - 86400000).toISOString())}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatTile icon={BarChart3} label="Total Calls" value={report.totals.totalCalls} tone="emerald" />
            <StatTile icon={Stethoscope} label="Doctor Calls" value={report.totals.doctorCalls} tone="blue" />
            <StatTile icon={Store} label="Chemist Calls" value={report.totals.chemistCalls} tone="blue" />
            <StatTile icon={Boxes} label="Boxes Placed" value={report.totals.totalBoxesPlaced} tone="emerald" />
            <StatTile icon={Clock} label="Avg Duration" value={`${report.totals.avgDurationMinutes}m`} tone="ok" />
            <StatTile icon={Gauge} label="Avg CQS" value={report.totals.avgCqsScore ?? "—"} tone="ok" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-800">Calls in this period</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    {!selectedRep && reps.length > 0 && (
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">MR</th>
                    )}
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Name</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Purpose</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Date/Time</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Duration</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Boxes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.calls.length === 0 ? (
                    <tr><td colSpan={!selectedRep && reps.length > 0 ? 6 : 5} className="px-4 py-10 text-center text-slate-400 font-medium">No calls logged in this period.</td></tr>
                  ) : (
                    report.calls.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        {!selectedRep && reps.length > 0 && (
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">{c.employeeName}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.purpose}</td>
                        <td className="px-4 py-3 text-slate-500">{dateStr(c.createdAt)} · {timeStr(c.createdAt)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{c.durationMinutes ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{c.boxesPlaced ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  ok: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
};

function StatTile({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${TONE[tone]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold text-slate-900 mt-3">{value}</p>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
