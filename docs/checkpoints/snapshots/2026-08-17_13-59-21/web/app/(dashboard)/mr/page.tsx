"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  IndianRupee,
  Wallet,
  Package,
  Stethoscope,
  Store,
  Route,
  Satellite,
  Receipt,
  Bell,
  AlertTriangle,
  Info,
  XCircle,
  ShieldAlert,
  MapPin,
  UserCheck,
  LogIn,
  LogOut,
  TrendingUp,
  Activity,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { VisitDetailModal } from "@/components/mr/visit-detail-modal";
import { RaiseClaimModal } from "@/components/mr/claim-modal";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Notification {
  code: string;
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO";
  message: string;
  action?: string;
}

interface MrDashboard {
  todaysVisits: { planned: number; list: { doctorId: string; name: string; tier: string | null }[] };
  pendingVisits: { count: number };
  completedVisits: { total: number; planned: number; unplanned: number; list: { id: string; name: string; createdAt: string }[] };
  salesToday: { amount: number };
  collection: { amount: number; today: number; week: number; month: number; outstanding: number };
  samplesDistributed: { units: number };
  doctorCoverage: { visited: number; total: number; percent: number };
  chemistCoverage: { visited: number; total: number; percent: number };
  travelDistance: { km: number; fixes: number };
  gpsStatus: {
    status: "ACTIVE" | "STALE" | "MOCKED" | "NO_SIGNAL";
    lastFixAt: string | null;
    minutesSinceLastFix: number | null;
    critical: boolean;
  };
  expenses: { today: number; pending: number; rejected: number };
  notifications: Notification[];
  attendance: { checkedIn: boolean; checkInTime: string | null; checkedOut: boolean };
  employee: { id: string; name: string; isSelf: boolean };
  invoices: {
    id: string;
    invoiceNo: string;
    amount: number;
    paid: boolean;
    createdAt: string;
    orderId: string;
    chemistName: string;
    distributorName: string;
  }[];
}

interface MrOption { id: string; employeeId?: string; firstName: string; lastName: string; }

interface TeamRow {
  employeeId: string;
  name: string;
  territory: string;
  checkedIn: boolean;
  checkInTime: string | null;
  checkedOut: boolean;
  callsToday: number;
  salesToday: number;
  collectionToday: number;
  gpsStatus: "ACTIVE" | "STALE" | "MOCKED" | "NO_SIGNAL";
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const GPS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:    { label: "Active",     dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  STALE:     { label: "Stale",      dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700" },
  MOCKED:    { label: "Mocked GPS", dot: "bg-red-500",     badge: "bg-red-100 text-red-700" },
  NO_SIGNAL: { label: "No signal",  dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600" },
};

const SEVERITY_STYLES: Record<Notification["severity"], { icon: LucideIcon; cls: string; iconCls: string }> = {
  CRITICAL: { icon: ShieldAlert, cls: "bg-red-50 border-red-200",    iconCls: "text-red-600" },
  ERROR:    { icon: XCircle,     cls: "bg-red-50 border-red-100",    iconCls: "text-red-500" },
  WARNING:  { icon: AlertTriangle, cls: "bg-amber-50 border-amber-200", iconCls: "text-amber-600" },
  INFO:     { icon: Info,        cls: "bg-blue-50 border-blue-100",  iconCls: "text-blue-500" },
};

function currency(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

function timeStr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MrDashboardPage() {
  const router = useRouter();
  const [data, setData]               = useState<MrDashboard | null>(null);
  const [loading, setLoading]         = useState(true);
  const [reps, setReps]               = useState<MrOption[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");
  const [checkingIn, setCheckingIn]   = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [geoError, setGeoError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [openVisitId, setOpenVisitId]  = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [team, setTeam]               = useState<TeamRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const isManager = reps.length > 0;
  const showTeamView = isManager && !selectedRep;

  const fetchData = useCallback(() => {
    setLoading(true);
    apiClient.get(selectedRep ? `/api/mr/dashboard?employeeId=${selectedRep}` : "/api/mr/dashboard")
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => { setLoading(false); setLastRefresh(new Date()); });
  }, [selectedRep]);

  const fetchTeam = useCallback(() => {
    setTeamLoading(true);
    apiClient.get("/api/manager/dashboard/team-today")
      .then((res) => setTeam(res.data.data?.team ?? []))
      .catch(() => setTeam([]))
      .finally(() => { setTeamLoading(false); setLastRefresh(new Date()); });
  }, []);

  useEffect(() => {
    apiClient.get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    if (showTeamView) fetchTeam();
    else fetchData();
  }, [showTeamView, fetchData, fetchTeam]);

  const handleCheckIn = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError("Geolocation is not supported by your browser."); return; }
    setCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiClient.post("/api/mr/attendance/check-in", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          fetchData();
        } catch (e: any) {
          setGeoError(e?.response?.data?.error?.message ?? "Check-in failed. Try again.");
        } finally { setCheckingIn(false); }
      },
      (err) => { setGeoError(`GPS error: ${err.message}`); setCheckingIn(false); }
    );
  };

  const handleCheckOut = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError("Geolocation is not supported by your browser."); return; }
    setCheckingOut(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiClient.post("/api/mr/attendance/check-out", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          fetchData();
        } catch (e: any) {
          setGeoError(e?.response?.data?.error?.message ?? "Check-out failed.");
        } finally { setCheckingOut(false); }
      },
      (err) => { setGeoError(`GPS error: ${err.message}`); setCheckingOut(false); }
    );
  };

  // ─── Team view (admin/ASM default — everyone's activity, no picker) ────────────
  if (showTeamView) {
    return (
      <TeamActivityView
        team={team}
        loading={teamLoading}
        lastRefresh={lastRefresh}
        onRefresh={fetchTeam}
        onSelectRep={(employeeId) => setSelectedRep(employeeId)}
      />
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <Activity size={28} className="text-emerald-600 animate-pulse" />
        </div>
        <p className="text-slate-500 text-sm font-medium">Loading your field dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <Satellite size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Unable to load your dashboard. Please log in as MR.</p>
      </div>
    );
  }

  const gps = GPS_STYLES[data.gpsStatus.status] ?? GPS_STYLES.NO_SIGNAL;
  const criticalNotifs = data.notifications.filter((n) => n.severity === "CRITICAL" || n.severity === "ERROR");
  const warnNotifs = data.notifications.filter((n) => n.severity === "WARNING" || n.severity === "INFO");
  const completionPct = data.todaysVisits.planned > 0
    ? Math.round((data.completedVisits.planned / data.todaysVisits.planned) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <UserCheck size={26} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Medical Representative Dashboard</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Daily overview · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                {!data.employee.isSelf && ` · viewing ${data.employee.name}`}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {/* Attendance Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  data.attendance.checkedOut ? "bg-slate-500/30 text-slate-300" :
                  data.attendance.checkedIn  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                                               "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    data.attendance.checkedOut ? "bg-slate-400" :
                    data.attendance.checkedIn  ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
                  }`} />
                  {data.attendance.checkedOut ? "Checked out" :
                   data.attendance.checkedIn  ? `Checked in at ${timeStr(data.attendance.checkInTime)}` :
                                                "Not checked in"}
                </span>
                {/* GPS Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/10 bg-white/10 text-white`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${gps.dot}`} />
                  GPS: {gps.label}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            {/* Back to team (managers viewing one rep's dashboard) */}
            {isManager && selectedRep && (
              <button
                onClick={() => setSelectedRep("")}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white transition-colors"
              >
                ← Back to Team
              </button>
            )}
            <div className="flex gap-2">
              {/* Refresh */}
              <button onClick={fetchData} disabled={loading}
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors" title="Refresh">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              {/* Raise Claim Button */}
              {data.employee.isSelf && (
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-colors"
                >
                  <Package size={14} /> Raise Claim
                </button>
              )}
              {/* Check In / Check Out */}
              {data.employee.isSelf && !data.attendance.checkedIn && (
                <button onClick={handleCheckIn} disabled={checkingIn}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/30">
                  <LogIn size={14} /> {checkingIn ? "Locating..." : "Check In"}
                </button>
              )}
              {data.employee.isSelf && data.attendance.checkedIn && !data.attendance.checkedOut && (
                <button onClick={handleCheckOut} disabled={checkingOut}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                  <LogOut size={14} /> {checkingOut ? "..." : "Check Out"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">Refreshed at {timeStr(lastRefresh.toISOString())}</p>
          </div>
        </div>

        {/* ─── Day Progress Bar ──────────────────────────────────────────────── */}
        {data.todaysVisits.planned > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
              <span>Day Progress</span>
              <span className="text-white font-bold">{completionPct}% complete · {data.completedVisits.planned}/{data.todaysVisits.planned} planned calls</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Geo Error ────────────────────────────────────────────────────────── */}
      {geoError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3 text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Check-in failed</p>
            <p className="text-xs mt-0.5 opacity-80">{geoError}</p>
          </div>
          <button onClick={() => setGeoError(null)} className="ml-auto text-red-400 hover:text-red-600"><XCircle size={16} /></button>
        </div>
      )}

      {/* ─── Check-In Banner (when not checked in) ─────────────────────────── */}
      {!data.attendance.checkedIn && data.employee.isSelf && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">You have not checked in today.</p>
              <p className="text-xs text-amber-700 mt-0.5">Check in to start logging field activity. Your GPS location will be recorded.</p>
            </div>
          </div>
          <button onClick={handleCheckIn} disabled={checkingIn}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-amber-200">
            <LogIn size={16} /> {checkingIn ? "Getting Location..." : "Check in to start logging field activity"}
          </button>
        </div>
      )}

      {/* ─── Notifications ────────────────────────────────────────────────────── */}
      {data.notifications.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Bell size={13} />
            Notifications ({data.notifications.length})
          </h2>
          <div className="space-y-2">
            {[...criticalNotifs, ...warnNotifs].map((n) => {
              const s = SEVERITY_STYLES[n.severity];
              return (
                <div key={n.code} className={`rounded-xl border px-4 py-3 flex gap-3 items-start ${s.cls}`}>
                  <s.icon size={15} className={`mt-0.5 flex-shrink-0 ${s.iconCls}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{n.message}</p>
                    {n.action && <p className="text-xs mt-0.5 text-slate-500">{n.action}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Today's Calls ────────────────────────────────────────────────────── */}
      <Section label="Today's Calls">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiTile
            icon={CalendarCheck} tone="blue"
            label="Today's Visits" value={data.todaysVisits.planned}
            sub="Planned on approved TP"
          />
          <KpiTile
            icon={Clock} tone={data.pendingVisits.count > 0 ? "warn" : "ok"}
            label="Pending Visits" value={data.pendingVisits.count}
            sub="Not yet logged"
          />
          <KpiTile
            icon={CheckCircle2} tone="ok"
            label="Completed Visits" value={data.completedVisits.total}
            sub={`${data.completedVisits.planned} planned · ${data.completedVisits.unplanned} unplanned`}
          />
        </div>
      </Section>

      {/* ─── Commercial ───────────────────────────────────────────────────────── */}
      <Section label="Commercial">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiTile icon={IndianRupee} tone="emerald" label="Sales Today" value={currency(data.salesToday.amount)} sub="Orders booked" />
          <KpiTile icon={Package} tone="blue" label="Samples Distributed" value={data.samplesDistributed.units} sub="Units today" />
          <KpiTile
            icon={data.collection.outstanding > 0 ? AlertTriangle : Wallet}
            tone={data.collection.outstanding > 0 ? "warn" : "emerald"}
            label="Outstanding"
            value={currency(data.collection.outstanding)}
            sub="Territory receivable"
          />
        </div>
      </Section>

      {/* ─── Collection ───────────────────────────────────────────────────────── */}
      <Section label="Collection">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiTile icon={Wallet} tone="emerald" label="Collected Today" value={currency(data.collection.today)} sub="Banked today" />
          <KpiTile icon={Wallet} tone="blue" label="Collected This Week" value={currency(data.collection.week)} sub="Mon – today" />
          <KpiTile icon={Wallet} tone="blue" label="Collected This Month" value={currency(data.collection.month)} sub="Month to date" />
        </div>
      </Section>

      {/* ─── Coverage & Field ─────────────────────────────────────────────────── */}
      <Section label="Coverage & Field">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CoverageTile icon={Stethoscope} label="Doctor Coverage" visited={data.doctorCoverage.visited} total={data.doctorCoverage.total} percent={data.doctorCoverage.percent} sub="this month" color="emerald" />
          <CoverageTile icon={Store} label="Chemist Coverage" visited={data.chemistCoverage.visited} total={data.chemistCoverage.total} percent={data.chemistCoverage.percent} sub="this month" color="blue" />
          <KpiTile icon={Route} tone="blue" label="Travel Distance" value={`${data.travelDistance.km} km`} sub={`${data.travelDistance.fixes} GPS fixes today`} />
        </div>
      </Section>

      {/* ─── Status ───────────────────────────────────────────────────────────── */}
      <Section label="Status">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* GPS Status */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Satellite size={20} className="text-slate-600" />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${gps.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${gps.dot}`} />
                {gps.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-4">
              {data.gpsStatus.minutesSinceLastFix !== null ? `${data.gpsStatus.minutesSinceLastFix}m` : "—"}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">GPS Status</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.gpsStatus.minutesSinceLastFix === null ? "No fix recorded today" : `Last fix ${data.gpsStatus.minutesSinceLastFix} min ago`}
            </p>
          </div>

          <KpiTile
            icon={Receipt}
            tone={data.expenses.rejected > 0 ? "warn" : "ok"}
            label="Expenses"
            value={currency(data.expenses.today)}
            sub={`${data.expenses.pending} pending · ${data.expenses.rejected} rejected`}
          />
          <KpiTile
            icon={Bell}
            tone={data.notifications.length > 0 ? "warn" : "ok"}
            label="Notifications"
            value={data.notifications.length}
            sub={data.notifications.some((n) => n.severity === "CRITICAL") ? "Includes a critical alert" : "Active alerts"}
          />
        </div>
      </Section>

      {/* ─── Outstanding Calls List ───────────────────────────────────────────── */}
      {data.todaysVisits.list.length > 0 && (
        <Section label="Outstanding Calls Today">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.todaysVisits.list.map((d, i) => (
                <button
                  key={d.doctorId}
                  onClick={() => router.push(`/mr/calls/new?doctorId=${d.doctorId}&name=${encodeURIComponent(d.name)}`)}
                  disabled={!data.employee.isSelf}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-700">{i + 1}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{d.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Planned visit not yet logged</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.tier && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        Tier {d.tier}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-600" />
              <p className="text-xs font-semibold text-amber-700">{data.todaysVisits.list.length} planned call(s) not yet completed. Log visits before EOD.</p>
            </div>
          </div>
        </Section>
      )}

      {/* ─── All calls done banner ────────────────────────────────────────────── */}
      {data.attendance.checkedIn && data.todaysVisits.planned > 0 && data.pendingVisits.count === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-emerald-900 text-sm">All planned calls completed! 🎉</p>
            <p className="text-xs text-emerald-700 mt-0.5">Great work today. You can check out or log additional unplanned visits.</p>
          </div>
          <TrendingUp size={20} className="ml-auto text-emerald-500 flex-shrink-0" />
        </div>
      )}

      {/* ─── Completed Calls Today ────────────────────────────────────────────── */}
      {data.completedVisits.list.length > 0 && (
        <Section label="Completed Calls Today">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.completedVisits.list.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setOpenVisitId(v.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={16} className="text-blue-700" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{v.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{timeStr(v.createdAt)}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {openVisitId && (
        <VisitDetailModal visitId={openVisitId} onClose={() => setOpenVisitId(null)} />
      )}

      {showClaimModal && (
        <RaiseClaimModal onClose={() => setShowClaimModal(false)} onClaimCreated={fetchData} />
      )}

      {/* ─── Invoices Generated ────────────────────────────────────────────────── */}
      <Section label="Invoices Generated">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {data.invoices && data.invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Invoice No</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Customer (Chemist)</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Distributor</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Status</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/invoices/${inv.orderId}`}
                          className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1.5"
                        >
                          {inv.invoiceNo}
                          <Receipt size={11} className="text-indigo-400" />
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">{inv.chemistName}</td>
                      <td className="px-5 py-3 text-slate-500">{inv.distributorName}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800">{currency(inv.amount)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {inv.paid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Receipt size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs">No invoices generated by this Medical Representative yet.</p>
            </div>
          )}
        </div>
      </Section>

    </div>
  );
}

// ─── Section Wrapper ───────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</h2>
      {children}
    </div>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
const TONE_STYLES: Record<string, { icon: string; ring: string }> = {
  ok:      { icon: "bg-slate-100 text-slate-600",   ring: "" },
  warn:    { icon: "bg-amber-100 text-amber-600",   ring: "border-amber-200" },
  emerald: { icon: "bg-emerald-100 text-emerald-600", ring: "" },
  blue:    { icon: "bg-blue-100 text-blue-600",     ring: "" },
};

function KpiTile({ icon: Icon, label, value, sub, tone = "ok" }: {
  icon: LucideIcon; label: string; value: React.ReactNode; sub?: string; tone?: keyof typeof TONE_STYLES;
}) {
  const t = TONE_STYLES[tone] ?? TONE_STYLES.ok;
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow ${t.ring}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.icon}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Coverage Tile ────────────────────────────────────────────────────────────
function CoverageTile({ icon: Icon, label, visited, total, percent, sub, color }: {
  icon: LucideIcon; label: string; visited: number; total: number; percent: number; sub?: string; color: "emerald" | "blue";
}) {
  const barColor = color === "emerald" ? "bg-emerald-500" : "bg-blue-500";
  const iconColor = color === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-4">
        {visited}<span className="text-base text-slate-400 font-normal">/{total}</span>
      </p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-1">{percent}% {sub}</p>
    </div>
  );
}

// ─── Team Activity View (admin/ASM default landing) ────────────────────────────
const TEAM_GPS_STYLES: Record<string, { label: string; dot: string }> = {
  ACTIVE:    { label: "Active",     dot: "bg-emerald-400" },
  STALE:     { label: "Stale",      dot: "bg-amber-400" },
  MOCKED:    { label: "Mocked",     dot: "bg-red-500" },
  NO_SIGNAL: { label: "No signal",  dot: "bg-slate-400" },
};

function TeamActivityView({
  team, loading, lastRefresh, onRefresh, onSelectRep,
}: {
  team: TeamRow[]; loading: boolean; lastRefresh: Date; onRefresh: () => void; onSelectRep: (employeeId: string) => void;
}) {
  const checkedInCount = team.filter((t) => t.checkedIn).length;
  const totalCalls = team.reduce((sum, t) => sum + t.callsToday, 0);
  const totalSales = team.reduce((sum, t) => sum + t.salesToday, 0);
  const totalCollection = team.reduce((sum, t) => sum + t.collectionToday, 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <UserCheck size={26} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Team Activity Today</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {team.length} MR{team.length === 1 ? "" : "s"} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiTile icon={UserCheck} tone={checkedInCount > 0 ? "ok" : "warn"} label="Checked In" value={`${checkedInCount}/${team.length}`} sub="Today" />
        <KpiTile icon={CalendarCheck} tone="blue" label="Calls Logged" value={totalCalls} sub="Today, whole team" />
        <KpiTile icon={IndianRupee} tone="emerald" label="Sales" value={currency(totalSales)} sub="Today, whole team" />
        <KpiTile icon={Wallet} tone="emerald" label="Collection" value={currency(totalCollection)} sub="Today, whole team" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-800">Every MR — click a row for full detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">MR</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Territory</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">Attendance</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Calls</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Sales</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Collection</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-[10px]">GPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto" /></td></tr>
              ) : team.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 font-medium">No MRs on the team yet.</td></tr>
              ) : (
                team.map((t) => {
                  const gps = TEAM_GPS_STYLES[t.gpsStatus] ?? TEAM_GPS_STYLES.NO_SIGNAL;
                  return (
                    <tr key={t.employeeId} onClick={() => onSelectRep(t.employeeId)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-900">{t.name}</td>
                      <td className="px-5 py-3 text-slate-500">{t.territory}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          t.checkedOut ? "bg-slate-100 text-slate-500" :
                          t.checkedIn  ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {t.checkedOut ? "Checked out" : t.checkedIn ? `In · ${timeStr(t.checkInTime)}` : "Not checked in"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-700">{t.callsToday}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-700">{currency(t.salesToday)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-700">{currency(t.collectionToday)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full ${gps.dot}`} /> {gps.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">Refreshed at {timeStr(lastRefresh.toISOString())}</p>
    </div>
  );
}
