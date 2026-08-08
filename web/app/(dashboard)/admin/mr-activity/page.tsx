"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Users2, CalendarDays, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface DayVisit {
  id: string;
  time: string;
  mrName: string;
  target: string;
  purpose: string;
  feedback: string | null;
  receptiveness: string | null;
  durationMinutes: number | null;
}

interface MR {
  id: string;
  firstName: string;
  lastName: string;
  territories: string[];
  isActive: boolean;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function MrActivityPage() {
  const [mrs, setMrs] = useState<MR[]>([]);
  const [selectedMr, setSelectedMr] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [byMr, setByMr] = useState<Record<string, { name: string; total: number }>>({});
  const [byDay, setByDay] = useState<Record<string, DayVisit[]>>({});
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => setMrs(res.data.data.mrs))
      .catch((err) => console.error("Failed to load MRs:", err));
  }, []);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/api/manager/visits/summary", { params: { month: monthKey(cursor), ...(selectedMr ? { mrId: selectedMr } : {}) } })
      .then((res) => {
        setCounts(res.data.data.counts);
        setByMr(res.data.data.byMr);
        setByDay(res.data.data.byDay || {});
      })
      .catch((err) => console.error("Failed to load activity summary:", err))
      .finally(() => setLoading(false));
  }, [cursor, selectedMr]);

  const days = Array.from({ length: daysInMonth(cursor) }, (_, i) => i + 1);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayIso = new Date().toISOString().slice(0, 10);
  const totalCalls = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const sortedByMr = Object.entries(byMr).sort((a, b) => b[1].total - a[1].total);

  const allVisitsThisMonth = Object.values(byDay)
    .flat()
    .sort((a, b) => b.time.localeCompare(a.time));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
          <Users2 size={22} /> MR Activity
        </h1>
        <p className="text-sm text-gray-500 mt-1">Daily call volume per MR — status at a glance.</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setSelectedMr(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!selectedMr ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200"}`}
          >
            All MRs
          </button>
          {mrs.map((mr) => (
            <button
              key={mr.id}
              onClick={() => setSelectedMr(mr.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selectedMr === mr.id ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              {mr.firstName} {mr.lastName}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCalendarOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-3 pr-4 py-2 shadow-sm hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
            <CalendarDays size={14} />
          </span>
          <span className="text-xs font-bold text-gray-700">{monthLabel}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-600 text-white">
            {totalCalls} call{totalCalls === 1 ? "" : "s"}
          </span>
        </button>

        {calendarOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCalendarOpen(false)}>
            <div
              className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl border border-primary-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  className="text-gray-400 hover:text-primary-600 p-1.5 -m-1.5 rounded-full hover:bg-primary-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-sm font-bold text-gray-800">🗓️ {monthLabel}</p>
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  className="text-gray-400 hover:text-primary-600 p-1.5 -m-1.5 rounded-full hover:bg-primary-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((d) => {
                    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const count = counts[iso] ?? 0;
                    const isToday = iso === todayIso;
                    return (
                      <button
                        key={d}
                        type="button"
                        title={`${iso}: ${count} call${count === 1 ? "" : "s"}`}
                        onClick={() => count > 0 && setSelectedDay(iso)}
                        className={`aspect-square rounded-full flex flex-col items-center justify-center text-[11px] font-semibold border transition-all ${
                          count > 0
                            ? "bg-primary-50 text-primary-700 border-primary-200 hover:scale-105 cursor-pointer"
                            : "bg-gray-50 text-gray-400 border-gray-100 cursor-default"
                        } ${isToday ? "ring-2 ring-primary-300" : ""}`}
                      >
                        <span>{d}</span>
                        {count > 0 && <span className="text-[8px]">{"●".repeat(Math.min(count, 3))}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-400 text-center mt-3">Hover a day for exact call count</p>
            </div>
          </div>
        )}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-primary-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">
                Calls on {new Date(selectedDay + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-700 p-1 -m-1 rounded-full hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            {(byDay[selectedDay] || []).length === 0 ? (
              <p className="text-sm text-gray-400">No calls recorded.</p>
            ) : (
              <ul className="space-y-3">
                {(byDay[selectedDay] || []).map((v) => (
                  <li key={v.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">{v.target}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(v.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {!selectedMr && <p className="text-xs text-primary-600 font-medium mb-1">{v.mrName}</p>}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{v.purpose}</p>
                    {v.feedback && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words">
                        <span className="font-semibold">Feedback: </span>
                        {v.feedback}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {v.receptiveness && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {v.receptiveness}
                        </span>
                      )}
                      {v.durationMinutes != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {v.durationMinutes} min
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!selectedMr && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 text-sm">Calls this month, by MR</h3>
          {sortedByMr.length === 0 ? (
            <p className="text-sm text-gray-400">No call activity this month.</p>
          ) : (
            <ul className="space-y-2">
              {sortedByMr.map(([id, data]) => (
                <li key={id} className="flex justify-between items-center text-sm">
                  <button onClick={() => setSelectedMr(id)} className="text-gray-700 hover:text-primary-600 hover:underline">
                    {data.name}
                  </button>
                  <span className="font-semibold text-primary-600">{data.total} calls</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedMr && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 text-sm">
            All calls this month — full detail ({allVisitsThisMonth.length})
          </h3>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : allVisitsThisMonth.length === 0 ? (
            <p className="text-sm text-gray-400">No call activity this month.</p>
          ) : (
            <ul className="space-y-3">
              {allVisitsThisMonth.map((v) => (
                <li key={v.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{v.target}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(v.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {" · "}
                      {new Date(v.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{v.purpose}</p>
                  {v.feedback && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words">
                      <span className="font-semibold">Feedback: </span>
                      {v.feedback}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {v.receptiveness && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {v.receptiveness}
                      </span>
                    )}
                    {v.durationMinutes != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {v.durationMinutes} min
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
