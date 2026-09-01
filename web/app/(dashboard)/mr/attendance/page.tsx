"use client";

import React, { useEffect, useState } from "react";
import { Clock, CalendarDays, ChevronLeft, ChevronRight, X, MapPin, Users, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Day {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LEAVE";
  checkIn: string;
  checkOut: string | null;
  minutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface RosterLeave {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  reason: string | null;
}

interface RosterRow {
  employeeId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  territory: string;
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  totalHoursMinutes: number;
  attendanceDays: { date: string; status: string; checkIn: string; checkOut: string | null; latitude: number | null; longitude: number | null }[];
  leaves: RosterLeave[];
  lastKnownLocation: { latitude: number; longitude: number; recordedAt: string; isLive: boolean; isMocked: boolean } | null;
}

function FormRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

const STATUS_LABEL: Record<Day["status"], string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "Leave",
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

export default function AttendancePage() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => setRole(decodeRole()), []);

  const isManager = role === "ADMIN" || role === "HR" || role === "ASM" || role === "MD";

  if (role === null) return null;
  return isManager ? <CompanyAttendanceRoster /> : <MyAttendance />;
}

// ─── Company-wide roster (ADMIN/HR/ASM/MD) ─────────────────────────────────
function CompanyAttendanceRoster() {
  const [cursor, setCursor] = useState(new Date());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<RosterRow | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    apiClient
      .get("/api/admin/attendance", { params: { month: monthKey(cursor) } })
      .then((res) => setRoster(res.data.data.roster ?? []))
      .catch((err) => {
        console.error("Failed to load attendance roster:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load the attendance roster. Check your connection and try again.";
        setLoadError(message);
        setRoster([]);
      })
      .finally(() => setLoading(false));
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const totalCheckedIn = roster.filter((r) => r.lastKnownLocation?.isLive).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Users size={22} /> Team Attendance &amp; GPS
          </h1>
          <p className="text-sm text-slate-500 mt-1">Login/logout, leave, and live location for every field employee.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-2 pr-4 py-1.5 shadow-sm">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-full hover:bg-emerald-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CalendarDays size={13} /> {monthLabel}
          </span>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-full hover:bg-emerald-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Team Size</p>
          <p className="text-xl font-display font-bold text-slate-900 mt-1">{roster.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Now (GPS, last 15m)</p>
          <p className="text-xl font-display font-bold text-emerald-600 mt-1">{totalCheckedIn}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Leave / Absent This Month</p>
          <p className="text-xl font-display font-bold text-amber-600 mt-1">
            {roster.reduce((s, r) => s + r.daysOnLeave, 0)} / {roster.reduce((s, r) => s + r.daysAbsent, 0)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 rounded-2xl p-12 text-center border border-rose-200 flex flex-col items-center gap-2">
          <ShieldAlert className="text-rose-600" size={20} />
          <p className="text-rose-700 text-sm font-semibold">{loadError}</p>
        </div>
      ) : roster.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">No field employees found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3 font-semibold">Employee</th>
                <th className="px-6 py-3 font-semibold">Territory</th>
                <th className="px-6 py-3 font-semibold text-center">Present</th>
                <th className="px-6 py-3 font-semibold text-center">Absent</th>
                <th className="px-6 py-3 font-semibold text-center">Leave</th>
                <th className="px-6 py-3 font-semibold text-right">Hours</th>
                <th className="px-6 py-3 font-semibold">GPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {roster.map((r) => (
                <tr key={r.employeeId} onClick={() => setViewing(r)} className="hover:bg-emerald-50/40 cursor-pointer transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.email} · {r.role}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{r.territory}</td>
                  <td className="px-6 py-4 text-center font-semibold text-emerald-700">{r.daysPresent}</td>
                  <td className="px-6 py-4 text-center font-semibold text-red-600">{r.daysAbsent}</td>
                  <td className="px-6 py-4 text-center font-semibold text-amber-600">{r.daysOnLeave}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-700">{fmtHours(r.totalHoursMinutes)}</td>
                  <td className="px-6 py-4">
                    {r.lastKnownLocation ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.lastKnownLocation.isLive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <MapPin size={10} /> {r.lastKnownLocation.isLive ? "Live" : "Last seen"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">No GPS data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-emerald-100 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-display font-bold text-slate-900 text-lg">{viewing.name}</p>
                <p className="text-xs text-slate-400">{viewing.email} · {viewing.territory}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>

            {viewing.lastKnownLocation && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <FormRow
                  label="Last GPS Ping"
                  value={
                    <a
                      href={`https://maps.google.com/?q=${viewing.lastKnownLocation.latitude},${viewing.lastKnownLocation.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                    >
                      <MapPin size={12} /> {viewing.lastKnownLocation.latitude.toFixed(5)}, {viewing.lastKnownLocation.longitude.toFixed(5)}
                    </a>
                  }
                />
                <FormRow label="Recorded" value={new Date(viewing.lastKnownLocation.recordedAt).toLocaleString("en-IN")} />
                {viewing.lastKnownLocation.isMocked && <FormRow label="Flagged" value={<span className="text-red-600">Mocked location suspected</span>} />}
              </div>
            )}

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attendance this month</p>
            {viewing.attendanceDays.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">No attendance records.</p>
            ) : (
              <div className="divide-y divide-slate-100 mb-4">
                {[...viewing.attendanceDays].reverse().map((d) => (
                  <div key={d.date} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600">{new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className={`text-xs font-bold ${d.status === "PRESENT" ? "text-emerald-600" : d.status === "LEAVE" ? "text-amber-600" : "text-red-600"}`}>
                      {STATUS_LABEL[d.status as Day["status"]] ?? d.status}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {new Date(d.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {d.checkOut ? ` – ${new Date(d.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : " – still in"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leave requests</p>
            {viewing.leaves.length === 0 ? (
              <p className="text-sm text-slate-400">No leave requests this period.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {viewing.leaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-600">{l.type} · {l.startDate} → {l.endDate}</span>
                    <span className={`text-xs font-bold ${l.status === "APPROVED" ? "text-emerald-600" : l.status === "REJECTED" ? "text-red-600" : "text-amber-600"}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personal view (MR) ─────────────────────────────────────────────────────
function MyAttendance() {
  const [cursor, setCursor] = useState(new Date());
  const [days, setDays] = useState<Day[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [daysPresent, setDaysPresent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewing, setViewing] = useState<Day | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    apiClient
      .get("/api/mr/attendance/history", { params: { month: monthKey(cursor) } })
      .then((res) => {
        setDays(res.data.data.days);
        setTotalMinutes(res.data.data.totalMinutes);
        setDaysPresent(res.data.data.daysPresent);
      })
      .catch((err) => {
        console.error("Failed to load attendance:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load your attendance. Check your connection and try again.";
        setLoadError(message);
        setDays([]);
      })
      .finally(() => setLoading(false));
  }, [cursor]);

  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const gridDays = Array.from({ length: daysInMonth(cursor) }, (_, i) => i + 1);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Clock size={22} /> My Attendance
        </h1>
        <p className="text-sm text-slate-500 mt-1">Hours logged in, day by day.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hours This Month</p>
          <p className="text-xl font-display font-bold text-slate-900 mt-1">{fmtHours(totalMinutes)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Days Present</p>
          <p className="text-xl font-display font-bold text-slate-900 mt-1">{daysPresent}</p>
        </div>
      </div>

      <button
        onClick={() => setCalendarOpen(true)}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-4 py-2 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <CalendarDays size={14} />
        </span>
        <span className="text-xs font-bold text-slate-700">{monthLabel}</span>
      </button>

      {calendarOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCalendarOpen(false)}>
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="text-slate-400 hover:text-emerald-600 p-1.5 -m-1.5 rounded-full hover:bg-emerald-50"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-bold text-slate-800">🗓️ {monthLabel}</p>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="text-slate-400 hover:text-emerald-600 p-1.5 -m-1.5 rounded-full hover:bg-emerald-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {gridDays.map((d) => {
                const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const rec = byDate[iso];
                const isToday = iso === todayIso;
                return (
                  <div
                    key={d}
                    title={rec ? `${rec.status}${rec.minutes ? ` · ${fmtHours(rec.minutes)}` : ""}` : "No record"}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center text-[11px] font-semibold border ${
                      rec?.status === "PRESENT"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : rec?.status === "LEAVE"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : rec?.status === "ABSENT"
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-slate-50 text-slate-400 border-slate-100"
                    } ${isToday ? "ring-2 ring-emerald-300" : ""}`}
                  >
                    <span>{d}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-3">Green = present · Amber = leave · Red = absent</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 rounded-2xl p-12 text-center border border-rose-200">
          <p className="text-rose-700 text-sm font-semibold">{loadError}</p>
        </div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">No attendance records this month.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {[...days].reverse().map((d) => (
            <button
              key={d.date}
              onClick={() => setViewing(d)}
              className="w-full text-left px-6 py-3 flex items-center justify-between hover:bg-emerald-50/50 transition-colors"
            >
              <div>
                <p className="font-bold text-slate-900 text-sm">{new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                <p className="text-xs text-slate-400">
                  {new Date(d.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {d.checkOut ? ` – ${new Date(d.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : " – still checked in"}
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-600">{d.minutes !== null ? fmtHours(d.minutes) : "—"}</span>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-emerald-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-slate-900 text-lg">
                {new Date(viewing.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">View only — attendance is recorded upon daily check-in.</p>
            <div className="border-t border-slate-100 pt-1">
              <FormRow label="Status" value={STATUS_LABEL[viewing.status]} />
              <FormRow label="Check-In Time" value={new Date(viewing.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} />
              <FormRow label="Check-Out Time" value={viewing.checkOut ? new Date(viewing.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Still checked in"} />
              <FormRow label="Hours Logged" value={viewing.minutes !== null ? fmtHours(viewing.minutes) : "—"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
