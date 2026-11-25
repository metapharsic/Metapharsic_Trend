"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  ArrowUpRight,
  Zap,
  Users,
  BarChart2,
  FileText,
  Search,
  Sparkles,
  Compass,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { VisitDetailModal } from "@/components/mr/visit-detail-modal";
import { RaiseClaimModal } from "@/components/mr/claim-modal";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Notification {
  code: string;
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO" | "SUCCESS";
  message: string;
  action?: string;
}

interface PlannedStop {
  tourPlanDayId?: string;
  type?: "DOCTOR" | "CHEMIST";
  doctorId: string | null;
  chemistId?: string | null;
  name: string;
  tier: string | null;
}

interface CompletedVisitItem {
  id: string;
  name: string;
  area?: string | null;
  subArea?: string | null;
  beatName?: string | null;
  createdAt: string;
}

interface MrDashboard {
  todaysVisits: {
    planned: number;
    list: PlannedStop[];
  };
  pendingVisits: { count: number };
  completedVisits: {
    total: number;
    planned: number;
    unplanned: number;
    list: CompletedVisitItem[];
  };
  salesToday: { amount: number };
  collection: {
    amount: number;
    today: number;
    week: number;
    month: number;
    outstanding: number;
  };
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

interface MrOption {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  territories?: string[];
  isActive?: boolean;
}

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

// ─── Formatting & Time Helpers ─────────────────────────────────────────────────
function currency(v: number): string {
  const num = Number(v) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, "")}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function currencyFull(v: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);
}

function timeStr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function useLiveClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function getNotificationRoute(code: string): { href: string; label: string } | null {
  switch (code) {
    case "TOUR_PLAN_REJECTED":
    case "TOUR_PLAN_DUE":
      return { href: "/tour-plans", label: "Open Tour Plans" };
    case "EXPENSE_REJECTED":
      return { href: "/expenses", label: "Review Expenses" };
    case "CREDIT_BREACHED":
    case "CREDIT_WARNING":
    case "AGED_BILLING":
      return { href: "/collections", label: "Open Collections" };
    case "PENDING_VISITS_LATE":
    case "COVERAGE_BEHIND_PACE":
    case "LOW_SAMPLE_STOCK":
      return { href: "/mr/calls/new", label: "Log Field Call" };
    case "GPS_MOCKED":
    case "GPS_NO_SIGNAL":
    case "GPS_STALE":
      return { href: "/mr/attendance", label: "Check GPS & Attendance" };
    default:
      return null;
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MrDashboardPage() {
  const router = useRouter();
  const now = useLiveClock();

  const [data, setData] = useState<MrDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<MrOption[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [geoError, setGeoError] = useState<{ title: string; message: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamSummaryOnly, setTeamSummaryOnly] = useState(false);

  // Interactive dashboard states
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");

  const isManager = reps.length > 0;
  const showTeamView = isManager && !selectedRep;

  const fetchData = useCallback(() => {
    setLoading(true);
    apiClient
      .get(selectedRep ? `/api/mr/dashboard?employeeId=${selectedRep}` : "/api/mr/dashboard")
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => {
        setLoading(false);
        setLastRefresh(new Date());
      });
  }, [selectedRep]);

  const fetchTeam = useCallback(() => {
    setTeamLoading(true);
    setTeamSummaryOnly(false);
    apiClient
      .get("/api/manager/dashboard/team-today")
      .then((res) => {
        setTeam(res.data.data?.team ?? []);
      })
      .catch(() => {
        // Senior managers (MD, NSM, ZSM, RM) may not be authorized on /team-today;
        // fall back cleanly to directory selection via /api/manager/mrs.
        setTeam([]);
        setTeamSummaryOnly(true);
      })
      .finally(() => {
        setTeamLoading(false);
        setLastRefresh(new Date());
      });
  }, []);

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    if (showTeamView) fetchTeam();
    else fetchData();
  }, [showTeamView, fetchData, fetchTeam]);

  const getCoords = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve({ latitude: 0, longitude: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({ latitude: 0, longitude: 0 }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
      );
    });
  };

  const handleCheckIn = async () => {
    setGeoError(null);
    setCheckingIn(true);
    try {
      const { latitude, longitude } = await getCoords();
      await apiClient.post("/api/mr/attendance/check-in", { latitude, longitude });
      fetchData();
    } catch (e: any) {
      setGeoError({
        title: "Check-in failed",
        message: e?.response?.data?.error?.message ?? "Could not record attendance check-in. Please retry.",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setGeoError(null);
    setCheckingOut(true);
    try {
      const { latitude, longitude } = await getCoords();
      await apiClient.post("/api/mr/attendance/check-out", { latitude, longitude });
      fetchData();
    } catch (e: any) {
      setGeoError({
        title: "Check-out failed",
        message: e?.response?.data?.error?.message ?? "Could not record attendance check-out. Please retry.",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  // Filtered invoices & calls memos (safe when data is null)
  const filteredPending = useMemo(() => {
    const list = data?.todaysVisits.list ?? [];
    const q = callSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.tier ?? "").toLowerCase().includes(q) ||
        (d.type ?? "DOCTOR").toLowerCase().includes(q)
    );
  }, [data?.todaysVisits.list, callSearch]);

  const filteredCompleted = useMemo(() => {
    const list = data?.completedVisits.list ?? [];
    const q = callSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.beatName ?? "").toLowerCase().includes(q) ||
        (v.subArea ?? "").toLowerCase().includes(q) ||
        (v.area ?? "").toLowerCase().includes(q)
    );
  }, [data?.completedVisits.list, callSearch]);

  const filteredInvoices = useMemo(() => {
    const list = data?.invoices ?? [];
    if (invoiceFilter === "PAID") return list.filter((i) => i.paid);
    if (invoiceFilter === "UNPAID") return list.filter((i) => !i.paid);
    return list;
  }, [data?.invoices, invoiceFilter]);

  // ─── Team View (Managers default view) ──────────────────────────────────────
  if (showTeamView) {
    return (
      <TeamActivityView
        team={team}
        fallbackReps={reps}
        summaryOnly={teamSummaryOnly}
        loading={teamLoading}
        lastRefresh={lastRefresh}
        onRefresh={fetchTeam}
        onSelectRep={(employeeId) => setSelectedRep(employeeId)}
      />
    );
  }

  // ─── Skeleton Loading State ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-5 pb-10 animate-pulse">
        <div className="rounded-3xl bg-slate-900 h-52 p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-white/15 rounded-lg" />
              <div className="h-3 w-36 bg-white/10 rounded-lg" />
            </div>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 p-5 h-32">
              <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
              <div className="h-6 w-24 bg-slate-200 rounded-md mb-2" />
              <div className="h-3 w-20 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 h-80" />
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 h-80" />
        </div>
      </div>
    );
  }

  // ─── Error / Empty Fallback ─────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="min-h-[55vh] bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Satellite size={26} className="text-slate-400" />
        </div>
        <div>
          <h2 className="text-base font-display font-bold text-slate-900">Unable to load MR dashboard</h2>
          <p className="text-slate-500 text-xs mt-1 max-w-sm">
            Please verify you are signed in with a Medical Representative or Manager account and try again.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && selectedRep && (
            <button
              onClick={() => setSelectedRep("")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              ← Back to Team
            </button>
          )}
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Derived UI Metrics ─────────────────────────────────────────────────────
  const gpsInfo = {
    ACTIVE: {
      label: "GPS Active",
      short: "Live",
      dot: "bg-emerald-400",
      heroBadge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      cardBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    STALE: {
      label: "GPS Stale",
      short: "Stale",
      dot: "bg-amber-400",
      heroBadge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      cardBadge: "bg-amber-50 text-amber-700 border-amber-200",
    },
    MOCKED: {
      label: "Mock GPS Alert",
      short: "Mocked",
      dot: "bg-red-500",
      heroBadge: "bg-red-500/20 text-red-300 border-red-500/40",
      cardBadge: "bg-red-50 text-red-700 border-red-200",
    },
    NO_SIGNAL: {
      label: "No GPS Fix",
      short: "Offline",
      dot: "bg-slate-400",
      heroBadge: "bg-white/10 text-slate-300 border-white/15",
      cardBadge: "bg-slate-100 text-slate-600 border-slate-200",
    },
  }[data.gpsStatus.status] ?? {
    label: "Unknown",
    short: "Unknown",
    dot: "bg-slate-400",
    heroBadge: "bg-white/10 text-slate-300 border-white/15",
    cardBadge: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const completionPct =
    data.todaysVisits.planned > 0
      ? clampPct((data.completedVisits.planned / data.todaysVisits.planned) * 100)
      : 0;

  const firstName = data.employee.name.split(" ")[0] || data.employee.name;
  const dateLabel = now
    ? now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Loading date…";
  const clockLabel = now
    ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
    : "--:--:--";
  const greeting = now ? greetingForHour(now.getHours()) : "Field Command";

  // Month elapsed pace benchmark for Doctor Coverage
  const monthPacePct = now
    ? clampPct((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100)
    : 0;
  const paceDelta = data.doctorCoverage.percent - monthPacePct;

  // Sort notifications CRITICAL -> ERROR -> WARNING -> INFO -> SUCCESS
  const severityRank: Record<Notification["severity"], number> = {
    CRITICAL: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 3,
    SUCCESS: 4,
  };
  const allNotifs = [...data.notifications].sort(
    (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
  );
  const visibleNotifs = showAllNotifs ? allNotifs : allNotifs.slice(0, 3);

  // Invoice stats
  const paidInvoicesCount = data.invoices.filter((i) => i.paid).length;
  const unpaidInvoicesCount = data.invoices.length - paidInvoicesCount;
  const totalInvoicedAmount = data.invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  // Collection velocity scale
  const maxCollectionScale = Math.max(data.collection.month, data.collection.week, data.collection.today, 1);

  return (
    <div className="space-y-5 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO COMMAND BAR + QUICK LAUNCH DOCK
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border border-slate-800/90 shadow-2xl">
        {/* Atmospheric Lighting Mesh */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            {/* Identity & Live Duty Status */}
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                  <UserCheck size={26} className="text-white" />
                </div>
                {data.attendance.checkedIn && !data.attendance.checkedOut && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse"
                    title="On Duty"
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                    {data.employee.isSelf ? `${greeting}, Field Executive` : "Manager Rep Audit"}
                  </span>
                  {!data.employee.isSelf && (
                    <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full">
                      Inspecting
                    </span>
                  )}
                </div>

                <h1 className="text-white text-xl sm:text-2xl font-display font-bold tracking-tight mt-0.5 truncate">
                  {data.employee.isSelf ? firstName : data.employee.name}
                </h1>
                <p className="text-slate-400 text-xs mt-0.5">{dateLabel}</p>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {/* Attendance Pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      data.attendance.checkedOut
                        ? "bg-white/10 text-slate-300 border-white/15"
                        : data.attendance.checkedIn
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        data.attendance.checkedOut
                          ? "bg-slate-400"
                          : data.attendance.checkedIn
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-amber-400 animate-pulse"
                      }`}
                    />
                    {data.attendance.checkedOut
                      ? "Shift Completed"
                      : data.attendance.checkedIn
                      ? `In since ${timeStr(data.attendance.checkInTime)}`
                      : "Awaiting Check-In"}
                  </span>

                  {/* GPS Telemetry Pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${gpsInfo.heroBadge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${gpsInfo.dot}`} />
                    {gpsInfo.label}
                    {data.gpsStatus.minutesSinceLastFix !== null && ` · ${data.gpsStatus.minutesSinceLastFix}m ago`}
                  </span>
                </div>
              </div>
            </div>

            {/* Clock & Action Controls */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
              <div className="lg:text-right">
                <p className="text-white text-xl sm:text-2xl font-mono font-bold tracking-wider tabular-nums">
                  {clockLabel}
                </p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {lastRefresh ? `Synced at ${timeStr(lastRefresh.toISOString())}` : "Syncing…"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isManager && selectedRep && (
                  <button
                    onClick={() => setSelectedRep("")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold text-white transition-colors"
                  >
                    ← All MRs
                  </button>
                )}

                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-colors disabled:opacity-50"
                  title="Refresh Dashboard"
                  aria-label="Refresh Dashboard"
                >
                  <RefreshCw size={15} className={`text-white ${loading ? "animate-spin" : ""}`} />
                </button>

                {data.employee.isSelf && (
                  <Link
                    href="/mr/calls/new"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-900 hover:bg-emerald-50 text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <Zap size={13} className="text-emerald-600" />
                    Log Call
                  </Link>
                )}

                {data.employee.isSelf && (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 text-xs font-bold rounded-xl transition-colors"
                  >
                    <Package size={13} />
                    Claim
                  </button>
                )}

                {data.employee.isSelf && !data.attendance.checkedIn && (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                  >
                    <LogIn size={14} />
                    {checkingIn ? "Locating…" : "Check In"}
                  </button>
                )}

                {data.employee.isSelf && data.attendance.checkedIn && !data.attendance.checkedOut && (
                  <button
                    onClick={handleCheckOut}
                    disabled={checkingOut}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <LogOut size={14} />
                    {checkingOut ? "Checking Out…" : "Check Out"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Shift Call Execution Progress */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Daily Field Execution</span>
                {data.completedVisits.unplanned > 0 && (
                  <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full">
                    +{data.completedVisits.unplanned} Extra Call{data.completedVisits.unplanned === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-white tabular-nums">
                {data.completedVisits.planned} of {data.todaysVisits.planned} planned
                <span className="text-emerald-400 ml-2">{completionPct}%</span>
              </span>
            </div>

            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400"
                style={{ width: `${completionPct}%` }}
              />
            </div>

            {/* Compact Quick Launch Bar inside Command Footer */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {[
                { href: "/mr/calls/new", icon: Zap, label: "Complete Call" },
                { href: "/tour-plans?tab=DAILY_SCHEDULE", icon: CalendarCheck, label: "N+1 Schedule" },
                { href: "/mr/calls", icon: ClipboardList, label: "Call History" },
                { href: "/mr/attendance", icon: Compass, label: "GPS & Duty" },
                { href: "/mr/reports/council", icon: BarChart2, label: "AI EOD Report" },
                { href: "/collections", icon: Wallet, label: "Collections" },
                { href: "/mr/claims", icon: FileText, label: "Claims" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white text-[11px] font-semibold transition-colors"
                >
                  <item.icon size={12} className="text-emerald-400" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Geo / Attendance Action Error ────────────────────────────────────── */}
      {geoError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3 text-red-800 shadow-sm">
          <AlertTriangle size={18} className="mt-0.5 text-red-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{geoError.title}</p>
            <p className="text-xs mt-0.5 text-red-700">{geoError.message}</p>
          </div>
          <button
            onClick={() => setGeoError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            <XCircle size={17} />
          </button>
        </div>
      )}

      {/* ─── Operational Status Banners ───────────────────────────────────────── */}
      <div className="space-y-3">
        {!data.attendance.checkedIn && data.employee.isSelf && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <MapPin size={19} className="text-amber-700" />
              </div>
              <div>
                <p className="font-bold text-amber-950 text-sm">You haven&apos;t checked in for today&apos;s shift</p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Start your attendance with live GPS telemetry before logging field visits.
                </p>
              </div>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              <LogIn size={15} />
              {checkingIn ? "Capturing GPS…" : "Check In Now"}
            </button>
          </div>
        )}

        {data.todaysVisits.planned === 0 && data.employee.isSelf && (
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/90 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0">
                <CalendarCheck size={19} className="text-sky-700" />
              </div>
              <div>
                <p className="font-bold text-sky-950 text-sm">No N+1 planned stops scheduled for today</p>
                <p className="text-xs text-sky-800/80 mt-0.5">
                  Club your target Doctors and Chemists in N+1 Tour Plans to structure today&apos;s route.
                </p>
              </div>
            </div>
            <Link
              href="/tour-plans?tab=DAILY_SCHEDULE"
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <CalendarCheck size={15} />
              Schedule Day (N+1)
            </Link>
          </div>
        )}

        {data.attendance.checkedIn && data.todaysVisits.planned > 0 && data.pendingVisits.count === 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Sparkles size={19} className="text-emerald-700" />
              </div>
              <div>
                <p className="font-bold text-emerald-950 text-sm">All planned stops completed today</p>
                <p className="text-xs text-emerald-800/80 mt-0.5">
                  Every doctor &amp; chemist on today&apos;s approved N+1 schedule has been covered.
                </p>
              </div>
            </div>
            {data.employee.isSelf && (
              <Link
                href="/mr/calls/new"
                className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                <Zap size={14} /> Log Extra Call
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ─── Notifications & Compliance Feed ──────────────────────────────────── */}
      {allNotifs.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-600" />
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Compliance &amp; Priority Alerts
              </h2>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                {allNotifs.length}
              </span>
            </div>
            {allNotifs.length > 3 && (
              <button
                onClick={() => setShowAllNotifs((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showAllNotifs ? (
                  <>
                    Show fewer <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    Show all {allNotifs.length} <ChevronDown size={13} />
                  </>
                )}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {visibleNotifs.map((n) => {
              const style = {
                CRITICAL: {
                  icon: ShieldAlert,
                  bg: "bg-red-50/70",
                  iconCls: "text-red-600 bg-red-100",
                  pill: "bg-red-100 text-red-700",
                },
                ERROR: {
                  icon: XCircle,
                  bg: "bg-rose-50/50",
                  iconCls: "text-rose-600 bg-rose-100",
                  pill: "bg-rose-100 text-rose-700",
                },
                WARNING: {
                  icon: AlertTriangle,
                  bg: "bg-amber-50/40",
                  iconCls: "text-amber-600 bg-amber-100",
                  pill: "bg-amber-100 text-amber-800",
                },
                INFO: {
                  icon: Info,
                  bg: "bg-sky-50/40",
                  iconCls: "text-sky-600 bg-sky-100",
                  pill: "bg-sky-100 text-sky-700",
                },
                SUCCESS: {
                  icon: CheckCircle2,
                  bg: "bg-emerald-50/40",
                  iconCls: "text-emerald-600 bg-emerald-100",
                  pill: "bg-emerald-100 text-emerald-700",
                },
              }[n.severity];

              const IconComp = style.icon;
              const routeCta = getNotificationRoute(n.code);

              return (
                <div key={n.code} className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${style.bg}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconCls}`}>
                      <IconComp size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.pill}`}>
                          {n.severity}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{n.message}</p>
                      </div>
                      {n.action && <p className="text-xs text-slate-600 mt-1">{n.action}</p>}
                    </div>
                  </div>

                  {n.code === "NOT_CHECKED_IN" && data.employee.isSelf ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={checkingIn}
                      className="self-start sm:self-center flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors"
                    >
                      <LogIn size={12} /> Check In
                    </button>
                  ) : routeCta ? (
                    <Link
                      href={routeCta.href}
                      className="self-start sm:self-center flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-colors"
                    >
                      {routeCta.label}
                      <ChevronRight size={12} />
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PRIMARY KPI SCORECARD ROW (4 Cards)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          icon={IndianRupee}
          label="Sales Booked Today"
          value={currency(data.salesToday.amount)}
          full={currencyFull(data.salesToday.amount)}
          accent="emerald"
          sub={data.salesToday.amount > 0 ? "Secondary POB orders" : "No orders booked yet"}
          badge={data.salesToday.amount > 0 ? "Active" : undefined}
        />
        <MetricCard
          icon={Wallet}
          label="Collected Today"
          value={currency(data.collection.today)}
          full={currencyFull(data.collection.today)}
          accent="teal"
          sub={`Week ${currency(data.collection.week)} · Month ${currency(data.collection.month)}`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Field Calls Done"
          value={String(data.completedVisits.total)}
          accent="blue"
          sub={`${data.completedVisits.planned} planned · ${data.completedVisits.unplanned} extra`}
          badge={
            data.pendingVisits.count > 0
              ? `${data.pendingVisits.count} pending`
              : data.todaysVisits.planned > 0
              ? "100% done"
              : undefined
          }
          badgeTone={data.pendingVisits.count > 0 ? "amber" : "emerald"}
        />
        <MetricCard
          icon={data.collection.outstanding > 0 ? AlertTriangle : CheckCircle2}
          label="Territory Receivable"
          value={currency(data.collection.outstanding)}
          full={currencyFull(data.collection.outstanding)}
          accent={data.collection.outstanding > 0 ? "amber" : "emerald"}
          sub={data.collection.outstanding > 0 ? "Chemist dues open" : "All chemist accounts clear"}
          href="/collections"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          12-COLUMN OPERATIONAL BENTO WORKSPACE
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ─── LEFT COLUMN (7 cols): Call Queue, Completed Calls & Invoices ───── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Today's Field Call Pipeline */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Clock size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold text-slate-900">Today&apos;s Field Call Pipeline</h2>
                  <p className="text-[11px] text-slate-500">
                    {data.todaysVisits.list.length} pending · {data.completedVisits.list.length} completed
                  </p>
                </div>
              </div>

              {(data.todaysVisits.list.length > 3 || data.completedVisits.list.length > 3) && (
                <div className="relative w-full sm:w-52">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={callSearch}
                    onChange={(e) => setCallSearch(e.target.value)}
                    placeholder="Filter doctor, chemist, beat…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Pending Scheduled Stops */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Scheduled Stop Queue ({filteredPending.length})
                </span>
                {data.employee.isSelf && (
                  <Link
                    href="/mr/calls/new"
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                  >
                    + Unplanned Visit <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>

              {filteredPending.length > 0 ? (
                <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {filteredPending.map((d, i) => {
                    const isChemist = d.type === "CHEMIST";
                    const targetUrl =
                      isChemist && d.chemistId
                        ? `/mr/calls/new?chemistId=${d.chemistId}&name=${encodeURIComponent(d.name)}${
                            d.tourPlanDayId ? `&tourPlanDayId=${d.tourPlanDayId}` : ""
                          }`
                        : `/mr/calls/new?doctorId=${d.doctorId ?? ""}&name=${encodeURIComponent(d.name)}${
                            d.tourPlanDayId ? `&tourPlanDayId=${d.tourPlanDayId}` : ""
                          }`;
                    return (
                      <button
                        key={d.tourPlanDayId || d.doctorId || d.chemistId || i}
                        onClick={() => router.push(targetUrl)}
                        disabled={!data.employee.isSelf}
                        className="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-slate-50/90 transition-colors text-left disabled:cursor-not-allowed disabled:opacity-75 group"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs border ${
                            isChemist
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {isChemist ? <Store size={15} /> : <Stethoscope size={15} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{d.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isChemist ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {isChemist ? "Chemist" : d.tier ? `Doctor · Tier ${d.tier}` : "Doctor"}
                            </span>
                            <span className="text-[11px] text-slate-400">Stop #{i + 1} · Pending</span>
                          </div>
                        </div>

                        {data.employee.isSelf && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white text-[11px] font-bold transition-colors flex-shrink-0">
                            <span>Complete</span>
                            <ChevronRight size={13} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                  <CheckCircle2 size={22} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    {callSearch
                      ? "No pending planned calls match your search"
                      : data.todaysVisits.planned > 0
                      ? "All scheduled calls have been completed today"
                      : "No pending scheduled stops for today"}
                  </p>
                </div>
              )}

              {/* Completed Calls Today */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Completed DCR Calls ({filteredCompleted.length})
                  </span>
                  <Link
                    href="/mr/calls"
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5"
                  >
                    Full Call Log <ChevronRight size={12} />
                  </Link>
                </div>

                {filteredCompleted.length > 0 ? (
                  <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden max-h-80 overflow-y-auto">
                    {filteredCompleted.map((v) => {
                      const locationTag = v.beatName || v.subArea || v.area;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setOpenVisitId(v.id)}
                          className="w-full px-4 py-3 flex items-center gap-3.5 hover:bg-slate-50 transition-colors text-left group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">{v.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-400 tabular-nums">{timeStr(v.createdAt)}</span>
                              {locationTag && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[180px]">
                                  {locationTag}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-emerald-600 inline-flex items-center gap-0.5 flex-shrink-0">
                            DCR <ChevronRight size={13} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center">
                    <p className="text-xs text-slate-400 font-medium">
                      {callSearch ? "No completed calls match your filter." : "No field visits logged today yet."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Recent Invoices & Billing */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Receipt size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold text-slate-900">Recent Invoices</h2>
                  <p className="text-[11px] text-slate-500">
                    {data.invoices.length} latest · Total {currency(totalInvoicedAmount)} ·{" "}
                    <span className="text-emerald-600 font-semibold">{paidInvoicesCount} paid</span>
                    {unpaidInvoicesCount > 0 && (
                      <>
                        {" · "}
                        <span className="text-amber-600 font-semibold">{unpaidInvoicesCount} unpaid</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {data.invoices.length > 0 && (
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 self-start sm:self-auto">
                  {(["ALL", "UNPAID", "PAID"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setInvoiceFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        invoiceFilter === tab
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredInvoices.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chemist</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                          Amount
                        </th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                          Status
                        </th>
                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/invoices/${inv.orderId}`}
                              className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                            >
                              {inv.invoiceNo}
                              <ArrowUpRight size={11} className="text-indigo-400" />
                            </Link>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-slate-800 max-w-[180px] truncate">{inv.chemistName}</p>
                            <p className="text-[10px] text-slate-400 max-w-[180px] truncate">{inv.distributorName}</p>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                            {currencyFull(inv.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {inv.paid ? "Paid" : "Unpaid"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-400 whitespace-nowrap">
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

                {/* Mobile Cards */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.orderId}`}
                      className="block p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-indigo-600 inline-flex items-center gap-1">
                          {inv.invoiceNo} <ArrowUpRight size={11} />
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {inv.paid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-800 truncate">{inv.chemistName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{inv.distributorName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-xs text-slate-900 tabular-nums">{currencyFull(inv.amount)}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <Receipt size={28} className="mx-auto text-slate-200 mb-2.5" />
                <p className="text-xs text-slate-400 font-medium">
                  {data.invoices.length > 0 ? `No ${invoiceFilter.toLowerCase()} invoices found.` : "No invoices generated yet."}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ─── RIGHT COLUMN (5 cols): Coverage, Collections Velocity & Telemetry ─ */}
        <div className="lg:col-span-5 space-y-5">
          {/* Territory Coverage & Pace Intelligence */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Stethoscope size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold text-slate-900">Territory Coverage</h2>
                  <p className="text-[11px] text-slate-500">Unique monthly visits across assigned beats</p>
                </div>
              </div>
              {now && monthPacePct > 0 && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    paceDelta >= -15
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {paceDelta >= -15 ? "On Pace" : `${Math.abs(paceDelta)}% Behind Pace`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CoverageCard
                icon={Stethoscope}
                label="Doctors"
                visited={data.doctorCoverage.visited}
                total={data.doctorCoverage.total}
                percent={data.doctorCoverage.percent}
                color="emerald"
              />
              <CoverageCard
                icon={Store}
                label="Chemists"
                visited={data.chemistCoverage.visited}
                total={data.chemistCoverage.total}
                percent={data.chemistCoverage.percent}
                color="blue"
              />
            </div>

            {/* Month Elapsed Pace Comparison */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">Doctor Coverage vs Month Elapsed</span>
                <span className="font-bold text-slate-800 tabular-nums">
                  {clampPct(data.doctorCoverage.percent)}% / ~{monthPacePct}% target
                </span>
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    paceDelta >= -15 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${clampPct(data.doctorCoverage.percent)}%` }}
                />
                {monthPacePct > 0 && monthPacePct < 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-800/70"
                    style={{ left: `${monthPacePct}%` }}
                    title={`Month elapsed target: ${monthPacePct}%`}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Collections Velocity Card */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <Wallet size={16} className="text-teal-600" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold text-slate-900">Collections Velocity</h2>
                  <p className="text-[11px] text-slate-500">Recoveries banked vs open credit</p>
                </div>
              </div>
              <Link href="/collections" className="text-xs font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-0.5">
                Ledger <ChevronRight size={13} />
              </Link>
            </div>

            <div className="space-y-3">
              {[
                { label: "Today", value: data.collection.today, barCls: "bg-emerald-500", textCls: "text-emerald-700" },
                { label: "This Week", value: data.collection.week, barCls: "bg-sky-500", textCls: "text-sky-700" },
                { label: "This Month", value: data.collection.month, barCls: "bg-indigo-500", textCls: "text-indigo-700" },
              ].map((row) => {
                const barWidth = clampPct((row.value / maxCollectionScale) * 100);
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">{row.label}</span>
                      <span className={`font-bold tabular-nums ${row.textCls}`}>{currencyFull(row.value)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${row.barCls}`} style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Open Territory Receivable</span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  data.collection.outstanding > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {currencyFull(data.collection.outstanding)}
              </span>
            </div>
          </section>

          {/* GPS Telemetry, Samples & Expenses Panel */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="px-5 py-3.5 bg-slate-50/60 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Field Telemetry &amp; Hygiene</h2>
              <Link href="/mr/reports/council" className="text-[11px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1">
                AI Council <ArrowUpRight size={11} />
              </Link>
            </div>

            {/* GPS & Distance */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Satellite size={17} className="text-slate-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900">GPS &amp; Travel</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${gpsInfo.cardBadge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${gpsInfo.dot}`} />
                      {gpsInfo.short}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {data.gpsStatus.minutesSinceLastFix !== null
                      ? `Last fix ${data.gpsStatus.minutesSinceLastFix}m ago · ${data.travelDistance.fixes} pings`
                      : "No GPS fix recorded today"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{data.travelDistance.km} km</p>
                <Link href="/mr/attendance" className="text-[10px] font-semibold text-indigo-600 hover:underline">
                  Track Log
                </Link>
              </div>
            </div>

            {/* Samples Distributed */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
                  <Package size={17} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Physician Samples</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Units handed over during calls today</p>
                </div>
              </div>
              <p className="text-base font-bold text-purple-700 tabular-nums">{data.samplesDistributed.units}</p>
            </div>

            {/* Expenses & Claims */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    data.expenses.rejected > 0 ? "bg-amber-100 text-amber-700" : "bg-sky-50 text-sky-600 border border-sky-100"
                  }`}
                >
                  <Receipt size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900">Expenses Today</p>
                    {data.expenses.rejected > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                        {data.expenses.rejected} Rejected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {data.expenses.pending > 0 ? `${data.expenses.pending} pending review` : "All claims settled"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{currencyFull(data.expenses.today)}</p>
                <Link href="/expenses" className="text-[10px] font-semibold text-indigo-600 hover:underline">
                  Manage
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────────────── */}
      {openVisitId && <VisitDetailModal visitId={openVisitId} onClose={() => setOpenVisitId(null)} />}
      {showClaimModal && <RaiseClaimModal onClose={() => setShowClaimModal(false)} onClaimCreated={fetchData} />}
    </div>
  );
}

// ─── Reusable UI Sub-components ────────────────────────────────────────────────

type AccentColor = "emerald" | "teal" | "blue" | "indigo" | "purple" | "amber" | "slate";

const ACCENT: Record<AccentColor, { icon: string; value: string; border: string }> = {
  emerald: { icon: "bg-emerald-50 text-emerald-600 border-emerald-100", value: "text-slate-900", border: "hover:border-emerald-200" },
  teal: { icon: "bg-teal-50 text-teal-600 border-teal-100", value: "text-slate-900", border: "hover:border-teal-200" },
  blue: { icon: "bg-sky-50 text-sky-600 border-sky-100", value: "text-slate-900", border: "hover:border-sky-200" },
  indigo: { icon: "bg-indigo-50 text-indigo-600 border-indigo-100", value: "text-slate-900", border: "hover:border-indigo-200" },
  purple: { icon: "bg-purple-50 text-purple-600 border-purple-100", value: "text-slate-900", border: "hover:border-purple-200" },
  amber: { icon: "bg-amber-50 text-amber-600 border-amber-100", value: "text-amber-900", border: "hover:border-amber-200" },
  slate: { icon: "bg-slate-100 text-slate-600 border-slate-200", value: "text-slate-900", border: "hover:border-slate-300" },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  full,
  sub,
  accent = "slate",
  badge,
  badgeTone = "emerald",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  full?: string;
  sub?: string;
  accent?: AccentColor;
  badge?: string;
  badgeTone?: "emerald" | "amber";
  href?: string;
}) {
  const a = ACCENT[accent];
  const [showFull, setShowFull] = useState(false);

  const badgeCls =
    badgeTone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  const content = (
    <div
      className={`h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all ${a.border}`}
      onMouseEnter={() => setShowFull(true)}
      onMouseLeave={() => setShowFull(false)}
      onClick={() => full && setShowFull((prev) => !prev)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${a.icon}`}>
          <Icon size={17} />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>
        )}
      </div>
      <p className={`text-xl sm:text-2xl font-display font-bold tabular-nums leading-none ${a.value}`}>
        {full && showFull ? full : value}
      </p>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-2">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

function CoverageCard({
  icon: Icon,
  label,
  visited,
  total,
  percent,
  color,
}: {
  icon: LucideIcon;
  label: string;
  visited: number;
  total: number;
  percent: number;
  color: "emerald" | "blue";
}) {
  const safePct = clampPct(percent);
  const c = {
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      pct: "text-emerald-700",
      track: "#d1fae5",
      stroke: "#10b981",
    },
    blue: {
      icon: "bg-sky-50 text-sky-600",
      pct: "text-sky-700",
      track: "#e0f2fe",
      stroke: "#0284c7",
    },
  }[color];

  const svgSize = 58;
  const r = 23;
  const circ = 2 * Math.PI * r;
  const dash = (safePct / 100) * circ;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle cx={svgSize / 2} cy={svgSize / 2} r={r} stroke={c.track} strokeWidth={5} fill="none" />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={r}
            stroke={c.stroke}
            strokeWidth={5}
            fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold tabular-nums ${c.pct}`}>{safePct}%</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={c.pct} />
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-lg font-display font-bold text-slate-900 mt-0.5 tabular-nums">
          {visited}
          <span className="text-xs text-slate-400 font-normal"> / {total}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Team Activity View (Managers Default Landing) ─────────────────────────────
function TeamActivityView({
  team,
  fallbackReps,
  summaryOnly,
  loading,
  lastRefresh,
  onRefresh,
  onSelectRep,
}: {
  team: TeamRow[];
  fallbackReps: MrOption[];
  summaryOnly: boolean;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onSelectRep: (employeeId: string) => void;
}) {
  const now = useLiveClock();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OUT" | "NOT_IN" | "GPS_ALERT">("ALL");

  // If senior manager role doesn't have /team-today live rows, render searchable fallback rep list
  const effectiveRows: TeamRow[] = useMemo(() => {
    if (!summaryOnly && team.length > 0) return team;
    if (team.length > 0) return team;
    return fallbackReps
      .filter((r) => r.employeeId)
      .map((r) => ({
        employeeId: r.employeeId!,
        name: `${r.firstName} ${r.lastName}`,
        territory: r.territories?.[0] ?? "Assigned Territory",
        checkedIn: false,
        checkInTime: null,
        checkedOut: false,
        callsToday: 0,
        salesToday: 0,
        collectionToday: 0,
        gpsStatus: "NO_SIGNAL" as const,
      }));
  }, [team, fallbackReps, summaryOnly]);

  const checkedInCount = effectiveRows.filter((t) => t.checkedIn && !t.checkedOut).length;
  const totalCalls = effectiveRows.reduce((s, t) => s + t.callsToday, 0);
  const totalSales = effectiveRows.reduce((s, t) => s + t.salesToday, 0);
  const totalCollection = effectiveRows.reduce((s, t) => s + t.collectionToday, 0);
  const gpsAlerts = effectiveRows.filter((t) => t.gpsStatus === "MOCKED" || t.gpsStatus === "STALE").length;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveRows.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.territory.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "ACTIVE") return t.checkedIn && !t.checkedOut;
      if (statusFilter === "OUT") return t.checkedOut;
      if (statusFilter === "NOT_IN") return !t.checkedIn && !t.checkedOut;
      if (statusFilter === "GPS_ALERT") return t.gpsStatus === "MOCKED" || t.gpsStatus === "STALE";
      return true;
    });
  }, [effectiveRows, search, statusFilter]);

  return (
    <div className="space-y-5 pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 shadow-2xl">
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <Users size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-white text-xl sm:text-2xl font-display font-bold tracking-tight">
                  Team Field Command
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  {effectiveRows.length} Medical Representative{effectiveRows.length === 1 ? "" : "s"} ·{" "}
                  {now ? now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Today"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <p className="text-slate-400 text-[11px]">
                {lastRefresh ? `Synced ${timeStr(lastRefresh.toISOString())}` : "Syncing…"}
              </p>
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-colors"
                title="Refresh Team Activity"
              >
                <RefreshCw size={14} className={`text-white ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {!summaryOnly && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
              {[
                { label: "Active In Field", value: `${checkedInCount}/${effectiveRows.length}`, color: "text-emerald-400" },
                { label: "Calls Today", value: String(totalCalls), color: "text-sky-400" },
                { label: "Sales Booked", value: currency(totalSales), color: "text-emerald-400" },
                { label: "Collections", value: currency(totalCollection), color: "text-teal-400" },
                { label: "GPS Alerts", value: String(gpsAlerts), color: gpsAlerts > 0 ? "text-amber-400" : "text-slate-400" },
              ].map((chip) => (
                <div key={chip.label} className="bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-2.5">
                  <p className={`text-lg font-display font-bold tabular-nums ${chip.color}`}>{chip.value}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{chip.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Directory Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-display font-bold text-slate-900">Field Force Roster</h2>
            <p className="text-[11px] text-slate-500">Click any representative to open their live MR dashboard</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search MR or territory…"
                className="w-full sm:w-52 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {!summaryOnly && (
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 flex-wrap">
                {[
                  { key: "ALL", label: "All" },
                  { key: "ACTIVE", label: "Active" },
                  { key: "OUT", label: "Out" },
                  { key: "NOT_IN", label: "Not In" },
                  { key: "GPS_ALERT", label: "GPS Alert" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key as typeof statusFilter)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      statusFilter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">MR</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Territory</th>
                {!summaryOnly && (
                  <>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Calls</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Sales</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Collections</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">GPS</th>
                  </>
                )}
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={summaryOnly ? 3 : 8} className="px-5 py-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent mx-auto" />
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={summaryOnly ? 3 : 8} className="px-5 py-12 text-center text-slate-400 text-sm font-medium">
                    No matching representatives found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((t) => {
                  const gpsDot =
                    {
                      ACTIVE: "bg-emerald-400",
                      STALE: "bg-amber-400",
                      MOCKED: "bg-red-500",
                      NO_SIGNAL: "bg-slate-400",
                    }[t.gpsStatus] ?? "bg-slate-400";
                  const gpsLabel =
                    { ACTIVE: "Active", STALE: "Stale", MOCKED: "Mocked", NO_SIGNAL: "No signal" }[t.gpsStatus] ?? "Unknown";

                  return (
                    <tr
                      key={t.employeeId}
                      onClick={() => onSelectRep(t.employeeId)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">{t.name}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{t.territory}</td>
                      {!summaryOnly && (
                        <>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                t.checkedOut
                                  ? "bg-slate-100 text-slate-600"
                                  : t.checkedIn
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  t.checkedOut
                                    ? "bg-slate-400"
                                    : t.checkedIn
                                    ? "bg-emerald-500 animate-pulse"
                                    : "bg-amber-500"
                                }`}
                              />
                              {t.checkedOut ? "Out" : t.checkedIn ? `In · ${timeStr(t.checkInTime)}` : "Not in"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">{t.callsToday}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-700 tabular-nums">
                            {currency(t.salesToday)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-teal-700 tabular-nums">
                            {currency(t.collectionToday)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                              <span className={`w-1.5 h-1.5 rounded-full ${gpsDot}`} />
                              {gpsLabel}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                          Open <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-10 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent mx-auto" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No matching representatives found.</div>
          ) : (
            filteredRows.map((t) => (
              <button
                key={t.employeeId}
                onClick={() => onSelectRep(t.employeeId)}
                className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{t.name}</p>
                  <p className="text-xs text-slate-500 truncate">{t.territory}</p>
                  {!summaryOnly && (
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold">
                      <span className="text-slate-700">{t.callsToday} calls</span>
                      <span className="text-emerald-700">{currency(t.salesToday)}</span>
                      <span className="text-teal-700">{currency(t.collectionToday)}</span>
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
