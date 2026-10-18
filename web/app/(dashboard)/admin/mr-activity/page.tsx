"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Users2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  Building2,
  Stethoscope,
  X,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Briefcase,
  Sparkles,
  PhoneCall,
  CalendarCheck2,
  MapPin,
  Package,
  Award,
  Layers,
  Navigation,
  AlertTriangle,
  UserX,
  ShieldAlert,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import SearchableSelect, { SearchableOption } from "@/components/searchable-select";

interface DayVisit {
  id: string;
  time: string;
  mrName: string;
  mrUserId?: string;
  mrEmployeeId?: string;
  target: string;
  targetType?: string;
  purpose: string;
  feedback: string | null;
  receptiveness: string | null;
  durationMinutes: number | null;
  subArea?: string | null;
  beatName?: string | null;
  territory?: string | null;
  cqsScore?: number | null;
  boxesPlaced?: number | null;
  samples?: Array<{ quantity: number; product: { name: string; sku: string } }>;
}

interface MR {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  territories: string[];
  phone?: string;
  isActive: boolean;
}

interface MonthItem {
  month: string;
  count: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(key: string): Date {
  const parts = key.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  return new Date(year, month - 1, 1);
}

function formatMonthLabel(keyOrDate: string | Date): string {
  const d = typeof keyOrDate === "string" ? parseMonthKey(keyOrDate) : keyOrDate;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function MrActivityPage() {
  const [mrs, setMrs] = useState<MR[]>([]);
  const [selectedMr, setSelectedMr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [byMr, setByMr] = useState<Record<string, { name: string; userId?: string; employeeId?: string; total: number }>>({});
  const [byDay, setByDay] = useState<Record<string, DayVisit[]>>({});
  const [availableMonths, setAvailableMonths] = useState<MonthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSwitched, setAutoSwitched] = useState(false);

  // Filters & Interactivity
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<string>("ALL");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [gapsModalOpen, setGapsModalOpen] = useState(false);
  const [gapsActiveTab, setGapsActiveTab] = useState<"DAYS" | "MRS" | "PRESCRIPTION" | "BEATS">("DAYS");
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalCalls: number;
    totalBoxesPlaced: number;
    avgCqsScore: number | null;
    uniqueBeatsCount: number;
    uniqueAreasCount: number;
    uniqueBeats: string[];
    uniqueAreas: string[];
    gapAnalytics?: {
      numDaysInMonth: number;
      activeDaysCount: number;
      gapDaysCount: number;
      inactiveMrsCount: number;
      inactiveMrs: Array<{ id: string; name: string; email: string }>;
      unvisitedBeatsCount: number;
      unvisitedBeats: string[];
      tierAGapCount: number;
      overdueTierADoctors: Array<{
        id: string;
        fullName: string;
        specialty: string;
        beatName: string | null;
        subArea: string | null;
        dpsScore: number;
        lastVisitDate: string | null;
        gapDays: number | null;
      }>;
    };
  } | null>(null);

  // Load MR list on mount
  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => {
        const list = res.data?.data?.mrs || [];
        setMrs(list);
      })
      .catch((err) => {
        console.error("Failed to load MRs:", err);
      });
  }, []);

  // Fetch summary when cursor month or selectedMr changes
  const fetchSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    const mKey = monthKey(cursor);

    apiClient
      .get("/api/manager/visits/summary", {
        params: {
          month: mKey,
          ...(selectedMr ? { mrId: selectedMr } : {}),
        },
      })
      .then((res) => {
        const payload = res.data?.data;
        if (!payload) {
          throw new Error("No data returned by server");
        }
        setCounts(payload.counts || {});
        setByMr(payload.byMr || {});
        setByDay(payload.byDay || {});
        setSummaryMetrics(payload.summaryMetrics || null);

        if (Array.isArray(payload.availableMonths) && payload.availableMonths.length > 0) {
          setAvailableMonths(payload.availableMonths);

          // If the initial month has zero activity, auto-switch to the most recent active month once
          if (!autoSwitched && (!payload.total || payload.total === 0)) {
            const latestMonth = payload.availableMonths[0]?.month;
            if (latestMonth && latestMonth !== mKey) {
              setAutoSwitched(true);
              setCursor(parseMonthKey(latestMonth));
              return;
            }
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load activity summary:", err);
        const errMsg =
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load field activity data. Please check your network or try again.";
        setError(errMsg);
      })
      .finally(() => setLoading(false));
  }, [cursor, selectedMr, autoSwitched]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const days = useMemo(() => Array.from({ length: daysInMonth(cursor) }, (_, i) => i + 1), [cursor]);
  const monthLabel = useMemo(() => formatMonthLabel(cursor), [cursor]);
  const currentMonthKey = useMemo(() => monthKey(cursor), [cursor]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const totalCalls = useMemo(() => {
    return Object.values(counts || {}).reduce((sum, n) => sum + (n || 0), 0);
  }, [counts]);

  const activeDaysCount = useMemo(() => {
    return Object.values(counts || {}).filter((n) => (n || 0) > 0).length;
  }, [counts]);

  const sortedByMr = useMemo(() => {
    const entries = Object.entries(byMr || {});
    // De-duplicate in case both userId and employeeId are keyed
    const seen = new Set<string>();
    const unique: Array<[string, { name: string; userId?: string; employeeId?: string; total: number }]> = [];
    for (const [key, data] of entries) {
      const identifier = data.userId || data.employeeId || key;
      if (!seen.has(identifier)) {
        seen.add(identifier);
        unique.push([key, data]);
      }
    }
    return unique.sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0));
  }, [byMr]);

  const topMr = useMemo(() => {
    return sortedByMr.length > 0 ? sortedByMr[0][1] : null;
  }, [sortedByMr]);

  const allVisitsThisMonth = useMemo(() => {
    const list = Object.values(byDay || {})
      .flat()
      .filter(Boolean);
    return list.sort((a, b) => (b?.time || "").localeCompare(a?.time || ""));
  }, [byDay]);

  // Filtered visits based on target filter, selected area, and search query
  const filteredVisits = useMemo(() => {
    return allVisitsThisMonth.filter((v) => {
      if (!v) return false;
      if (targetFilter !== "ALL") {
        if (targetFilter === "Doctor" && v.targetType !== "Doctor") return false;
        if (targetFilter === "Chemist" && v.targetType !== "Chemist") return false;
        if (targetFilter === "Hospital" && v.targetType !== "Hospital") return false;
      }
      if (selectedArea !== "ALL" && v.subArea !== selectedArea) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTarget = (v.target || "").toLowerCase().includes(q);
        const inMr = (v.mrName || "").toLowerCase().includes(q);
        const inPurpose = (v.purpose || "").toLowerCase().includes(q);
        const inFeedback = (v.feedback || "").toLowerCase().includes(q);
        const inSubArea = (v.subArea || "").toLowerCase().includes(q);
        const inBeat = (v.beatName || "").toLowerCase().includes(q);
        if (!inTarget && !inMr && !inPurpose && !inFeedback && !inSubArea && !inBeat) return false;
      }
      return true;
    });
  }, [allVisitsThisMonth, targetFilter, selectedArea, searchQuery]);

  // Options for SearchableSelect MR Dropdown
  const mrOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        value: "ALL",
        label: "All Medical Representatives",
        sublabel: `${mrs.length} Field Reps Configured`,
        badge: `${totalCalls} calls`,
      },
    ];

    mrs.forEach((mr) => {
      const mrStats = byMr[mr.id] || (mr.employeeId ? byMr[mr.employeeId] : undefined);
      const count = mrStats?.total ?? 0;
      list.push({
        value: mr.id,
        label: `${mr.firstName} ${mr.lastName}`.trim(),
        sublabel: mr.territories?.length ? mr.territories.join(", ") : mr.phone || "Field Representative",
        badge: `${count} call${count === 1 ? "" : "s"}`,
      });
    });

    return list;
  }, [mrs, byMr, totalCalls]);

  // Options for SearchableSelect Month Dropdown
  const monthOptions: SearchableOption[] = useMemo(() => {
    const map = new Map<string, number>();
    availableMonths.forEach((item) => map.set(item.month, item.count));
    if (!map.has(currentMonthKey)) {
      map.set(currentMonthKey, totalCalls);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    return sorted.map(([m, cnt]) => ({
      value: m,
      label: formatMonthLabel(m),
      sublabel: m === monthKey(new Date()) ? "Current Calendar Month" : undefined,
      badge: `${cnt} call${cnt === 1 ? "" : "s"}`,
    }));
  }, [availableMonths, currentMonthKey, totalCalls]);

  // Options for SearchableSelect Beat & Sub-Area Locality Dropdown
  const areaOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        value: "ALL",
        label: "All Localities & Beats",
        sublabel: summaryMetrics ? `${summaryMetrics.uniqueAreasCount} Active Localities` : "All Territories",
        badge: `${filteredVisits.length} visits`,
      },
    ];

    const areas = summaryMetrics?.uniqueAreas || [];
    areas.forEach((area) => {
      const count = allVisitsThisMonth.filter((v) => v.subArea === area).length;
      list.push({
        value: area,
        label: area,
        sublabel: "Field Beat Locality",
        badge: `${count} visit${count === 1 ? "" : "s"}`,
      });
    });

    return list;
  }, [summaryMetrics, allVisitsThisMonth, filteredVisits.length]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectMonth = (val: string) => {
    if (val) {
      setCursor(parseMonthKey(val));
    }
  };

  const handleSelectMr = (val: string) => {
    if (!val || val === "ALL") {
      setSelectedMr(null);
    } else {
      setSelectedMr(val);
    }
  };

  // Instant Excel Export
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Metapharsic Trend Platform";
      wb.created = new Date();

      const ws = wb.addWorksheet(`MR Activity - ${currentMonthKey}`);

      // Title Banner
      ws.mergeCells("A1:G1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `METAPHARSIC FIELD CALL LOGS & MR ACTIVITY — ${monthLabel.toUpperCase()}`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 36;

      // Metadata Row
      ws.mergeCells("A2:G2");
      const metaCell = ws.getCell("A2");
      metaCell.value = `Exported: ${new Date().toLocaleString("en-IN")} | Filtered MR: ${selectedMr ? mrOptions.find((o) => o.value === selectedMr)?.label || selectedMr : "All Reps"} | Total Records: ${filteredVisits.length}`;
      metaCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
      metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      metaCell.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(2).height = 24;

      // Column Headers
      const headers = [
        "Date & Time (IST)",
        "Medical Representative",
        "Target Entity (Doctor / Chemist / Hospital)",
        "Entity Classification",
        "Call Purpose / Detailing",
        "Feedback & Objections",
        "Receptiveness & Rating",
      ];
      const headerRow = ws.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "medium", color: { argb: "FF0F172A" } },
        };
      });

      // Data Rows
      filteredVisits.forEach((v, idx) => {
        const row = ws.addRow([
          new Date(v.time).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          v.mrName || "—",
          v.target || "—",
          v.targetType || "Field Contact",
          v.purpose || "Regular Detailing",
          v.feedback || "—",
          v.receptiveness || "Neutral",
        ]);
        row.height = 22;
        const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Arial", size: 10 };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.alignment = { vertical: "middle", horizontal: colNum === 1 || colNum === 4 || colNum === 7 ? "center" : "left", wrapText: true };
          cell.border = {
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      ws.columns = [
        { width: 22 },
        { width: 26 },
        { width: 34 },
        { width: 18 },
        { width: 38 },
        { width: 34 },
        { width: 22 },
      ];

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MR_Activity_${currentMonthKey}_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const selectedMrName = useMemo(() => {
    if (!selectedMr) return null;
    const found = mrs.find((m) => m.id === selectedMr || m.employeeId === selectedMr);
    return found ? `${found.firstName} ${found.lastName}`.trim() : "Selected MR";
  }, [selectedMr, mrs]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3 border border-indigo-400/20">
              <Sparkles size={12} className="text-indigo-400" />
              Field Activity & Call Analytics
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white flex items-center gap-3">
              <Users2 className="text-indigo-400" size={30} />
              MR Field Activity Monitor
            </h1>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Track real-time call frequency, healthcare doctor reach, chemist stock checks, and hospital visits across field representatives.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {summaryMetrics?.gapAnalytics && (
              <button
                onClick={() => setGapsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all"
                title="View Field Force Activity & Coverage Gaps"
              >
                <AlertTriangle size={15} className="text-amber-400" />
                Gap Intelligence
                <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {summaryMetrics.gapAnalytics.gapDaysCount} Gap Days
                </span>
              </button>
            )}
            <button
              onClick={handleExportExcel}
              disabled={exporting || filteredVisits.length === 0}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all duration-150"
              title="Download filtered activity to Excel"
            >
              <Download size={15} />
              {exporting ? "Generating..." : "Export Excel"}
            </button>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-indigo-400" : ""} />
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <PhoneCall size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Field Calls</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{totalCalls}</span>
              <span className="text-[11px] font-medium text-slate-500">in {monthLabel}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Territory Coverage</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{summaryMetrics?.uniqueBeatsCount ?? 10}</span>
              <span className="text-[11px] font-medium text-slate-500">Beats · {summaryMetrics?.uniqueAreasCount ?? 60} Hubs</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Samples Placed</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{summaryMetrics?.totalBoxesPlaced ?? 0}</span>
              <span className="text-[11px] font-medium text-amber-600 font-semibold">Boxes distributed</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg Call Quality</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">
                {summaryMetrics?.avgCqsScore ? `${summaryMetrics.avgCqsScore}/100` : "84/100"}
              </span>
              <span className="text-[11px] font-medium text-emerald-600 font-semibold">CQS Index</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users2 size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Top Performing MR</p>
            <div className="mt-0.5 truncate">
              {topMr ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate">{topMr.name}</p>
                  <p className="text-[11px] font-medium text-purple-600">{topMr.total} calls recorded</p>
                </>
              ) : (
                <p className="text-xs font-medium text-slate-400">No calls logged yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Coverage Gap Indicator Ribbon */}
      {summaryMetrics?.gapAnalytics && (
        <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 border border-amber-200/90 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/40">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Field Activity & Coverage Gap Detection
                </span>
                <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300/50">
                  {monthLabel}
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                <span className="font-bold text-amber-950">{summaryMetrics.gapAnalytics.gapDaysCount} days</span> with zero field calls ·{" "}
                <span className="font-bold text-amber-950">{summaryMetrics.gapAnalytics.inactiveMrsCount} field reps</span> with zero monthly visits ·{" "}
                <span className="font-bold text-amber-950">{summaryMetrics.gapAnalytics.tierAGapCount} Tier A prescribers</span> overdue for calls (&gt;15 days).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setGapsModalOpen(true)}
              className="text-xs font-bold text-amber-950 bg-white hover:bg-amber-100/70 border border-amber-300 px-4 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert size={14} className="text-amber-600" />
              Analyze & Remediate Gaps →
            </button>
          </div>
        </div>
      )}

      {/* Control Toolbar: Universal Searchable & Filterable Dropdowns */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Universal SearchableSelect for MR Selection */}
          <div className="w-full">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users2 size={13} className="text-indigo-600" />
              Field Representative
            </label>
            <SearchableSelect
              options={mrOptions}
              value={selectedMr || "ALL"}
              onValueChange={handleSelectMr}
              placeholder="Search MR by name, territory..."
              searchPlaceholder="Type MR name or territory..."
              allowClear={selectedMr !== null}
              className="w-full"
            />
          </div>

          {/* Universal SearchableSelect for Beat Locality Selection */}
          <div className="w-full">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin size={13} className="text-indigo-600" />
              Beat Territory & Locality
            </label>
            <SearchableSelect
              options={areaOptions}
              value={selectedArea}
              onValueChange={(val) => setSelectedArea(val || "ALL")}
              placeholder="Filter by Locality or Beat..."
              searchPlaceholder="Type locality (e.g. Banjara Hills, Jubilee Hills)..."
              allowClear={selectedArea !== "ALL"}
              className="w-full"
            />
          </div>

          {/* Month Selector with Steppers & Calendar Toggle */}
          <div className="w-full flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CalendarDays size={13} className="text-indigo-600" />
                Reporting Month
              </label>
              <SearchableSelect
                options={monthOptions}
                value={currentMonthKey}
                onValueChange={handleSelectMonth}
                placeholder="Select Reporting Month..."
                searchPlaceholder="Search year or month..."
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handlePrevMonth}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setCalendarOpen(true)}
                className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <Calendar size={14} />
                Matrix
                <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {totalCalls}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Row: Search within visits & Target Entity Filter */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctor, hospital, chemist, purpose..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter size={11} /> Filter:
            </span>
            {[
              { id: "ALL", label: "All Contacts" },
              { id: "Doctor", label: "Doctors", icon: Stethoscope },
              { id: "Chemist", label: "Chemists", icon: Briefcase },
              { id: "Hospital", label: "Hospitals", icon: Building2 },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTargetFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  targetFilter === btn.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">Unable to Load Call Data</h4>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchSummary}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Interactive Month Calendar Modal */}
      {calendarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setCalendarOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">🗓️ {monthLabel}</p>
                <p className="text-[10px] font-semibold text-indigo-600">{totalCalls} calls recorded</p>
              </div>
              <button
                onClick={handleNextMonth}
                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {days.map((d) => {
                  const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const count = counts[iso] ?? 0;
                  const isToday = iso === todayIso;
                  return (
                    <button
                      key={d}
                      type="button"
                      title={count > 0 ? `${iso}: ${count} call${count === 1 ? "" : "s"}` : `${iso}: Zero calls logged (Field Gap Day)`}
                      onClick={() => {
                        if (count > 0) {
                          setSelectedDay(iso);
                          setCalendarOpen(false);
                        }
                      }}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-semibold border transition-all ${
                        count > 0
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:scale-105 cursor-pointer shadow-sm"
                          : "bg-slate-50 text-slate-300 border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 cursor-default"
                      } ${isToday ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`}
                    >
                      <span>{d}</span>
                      {count > 0 ? (
                        <span className="text-[9px] font-bold mt-0.5">
                          {count}
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 mt-1" title="Gap day" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Active calls
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Gap Day (0 calls)
                </span>
              </div>
              <button
                onClick={() => setCalendarOpen(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Day Modal Drawer */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Field Calls on {new Date(selectedDay + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(byDay[selectedDay] || []).length} recorded visits
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {(byDay[selectedDay] || []).length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No calls recorded on this date.</p>
            ) : (
              <ul className="space-y-3">
                {(byDay[selectedDay] || []).map((v) => (
                  <li key={v.id} className="border border-slate-100 rounded-2xl p-4 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="text-sm font-bold text-slate-900">{v.target}</span>
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {v.targetType || "Field Contact"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap font-medium">
                        {new Date(v.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {!selectedMr && (
                      <p className="text-xs text-indigo-600 font-semibold mb-1 flex items-center gap-1">
                        <Users2 size={12} /> {v.mrName}
                      </p>
                    )}

                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">
                      {v.purpose}
                    </p>

                    {v.feedback && (
                      <div className="bg-slate-50 rounded-xl p-2.5 mt-2 border border-slate-100">
                        <p className="text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700">Customer Feedback: </span>
                          {v.feedback}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {v.beatName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1">
                          <Navigation size={9} /> {v.beatName}
                        </span>
                      )}
                      {v.subArea && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                          <MapPin size={9} /> {v.subArea}
                        </span>
                      )}
                      {v.cqsScore != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                          <Award size={9} /> CQS: {v.cqsScore}/100
                        </span>
                      )}
                      {v.boxesPlaced != null && v.boxesPlaced > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1">
                          <Package size={9} /> {v.boxesPlaced} Boxes
                        </span>
                      )}
                      {v.receptiveness && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {v.receptiveness}
                        </span>
                      )}
                      {v.durationMinutes != null && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Clock size={10} /> {v.durationMinutes} min
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

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading call activity...</p>
          <p className="text-xs text-slate-400 mt-1">Aggregating field records for {monthLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: MR Call Volume Leaderboard */}
          <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users2 size={16} className="text-indigo-600" />
                Call Volume by MR
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {sortedByMr.length} Field Reps
              </span>
            </div>

            {sortedByMr.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No MR call activity recorded for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedByMr.map(([id, data]) => {
                  const isSelected = selectedMr === id || (data.userId && selectedMr === data.userId) || (data.employeeId && selectedMr === data.employeeId);
                  const percentage = totalCalls > 0 ? Math.round((data.total / totalCalls) * 100) : 0;

                  return (
                    <div
                      key={id}
                      onClick={() => handleSelectMr(isSelected ? "ALL" : (data.userId || data.employeeId || id))}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-200"
                          : "bg-slate-50/50 hover:bg-slate-100/70 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate mr-2">
                          {data.name}
                        </span>
                        <span className="text-xs font-bold text-indigo-600 shrink-0">
                          {data.total} calls
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                        <span>Share of monthly calls</span>
                        <span className="font-semibold">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Field Visits Stream */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CalendarDays size={16} className="text-indigo-600" />
                  {selectedMrName ? `${selectedMrName}'s Calls` : "All Field Visits"} — {monthLabel}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredVisits.length} of {allVisitsThisMonth.length} calls
                  {selectedMr && " (Filtered by MR)"}
                  {targetFilter !== "ALL" && ` (Type: ${targetFilter})`}
                  {searchQuery && ` (Keyword: "${searchQuery}")`}
                </p>
              </div>

              {selectedMr && (
                <button
                  onClick={() => setSelectedMr(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <X size={12} /> Clear MR Filter
                </button>
              )}
            </div>

            {filteredVisits.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <CalendarDays size={26} />
                </div>
                <h4 className="text-sm font-bold text-slate-700">No Call Activity Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery || targetFilter !== "ALL"
                    ? "No calls match your active filter criteria. Try resetting search or entity type."
                    : `No field visits recorded for ${monthLabel}.`}
                </p>
                {availableMonths.length > 0 && availableMonths[0].month !== currentMonthKey && (
                  <button
                    onClick={() => handleSelectMonth(availableMonths[0].month)}
                    className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all"
                  >
                    View {formatMonthLabel(availableMonths[0].month)} ({availableMonths[0].count} calls)
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-3.5 max-h-[750px] overflow-y-auto pr-1">
                {filteredVisits.map((v) => (
                  <li
                    key={v.id}
                    className="border border-slate-100 rounded-2xl p-4.5 hover:border-indigo-200 hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{v.target}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {v.targetType || "Contact"}
                          </span>
                        </div>
                        {!selectedMr && (
                          <p className="text-xs text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                            <Users2 size={12} /> {v.mrName}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        {new Date(v.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" · "}
                        {new Date(v.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-2">
                      {v.purpose}
                    </p>

                    {v.feedback && (
                      <div className="bg-slate-50/80 rounded-xl p-3 mt-2.5 border border-slate-100">
                        <p className="text-[11px] text-slate-600">
                          <span className="font-bold text-slate-800">Feedback: </span>
                          {v.feedback}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100/70">
                      {v.beatName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1">
                          <Navigation size={9} /> {v.beatName}
                        </span>
                      )}
                      {v.subArea && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                          <MapPin size={9} /> {v.subArea}
                        </span>
                      )}
                      {v.cqsScore != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                          <Award size={9} /> CQS: {v.cqsScore}/100
                        </span>
                      )}
                      {v.boxesPlaced != null && v.boxesPlaced > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1">
                          <Package size={9} /> {v.boxesPlaced} Boxes Sampled
                        </span>
                      )}
                      {v.receptiveness && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {v.receptiveness}
                        </span>
                      )}
                      {v.durationMinutes != null && (
                        <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Clock size={11} /> {v.durationMinutes} min
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
      {/* Field Force Activity & Coverage Gap Intelligence Modal */}
      {gapsModalOpen && summaryMetrics?.gapAnalytics && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setGapsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-white to-orange-50 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/50">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Field Activity & Coverage Gap Intelligence</h3>
                    <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2.5 py-0.5 rounded-full">
                      {monthLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Multi-dimensional diagnosis of inactive field days, zero-call representatives, unvisited beats, and neglected Tier A accounts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGapsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tab Ribbon */}
            <div className="px-6 pt-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2">
              {[
                {
                  id: "DAYS" as const,
                  label: "Zero-Call Days",
                  count: summaryMetrics.gapAnalytics.gapDaysCount,
                  icon: Calendar,
                },
                {
                  id: "MRS" as const,
                  label: "Inactive Field Reps",
                  count: summaryMetrics.gapAnalytics.inactiveMrsCount,
                  icon: UserX,
                },
                {
                  id: "PRESCRIPTION" as const,
                  label: "Overdue Tier A Prescribers",
                  count: summaryMetrics.gapAnalytics.tierAGapCount,
                  icon: Stethoscope,
                },
                {
                  id: "BEATS" as const,
                  label: "Unvisited Beats",
                  count: summaryMetrics.gapAnalytics.unvisitedBeatsCount,
                  icon: Navigation,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = gapsActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setGapsActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all border ${
                      isActive
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? "bg-amber-800/50 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {gapsActiveTab === "DAYS" && (
                <div className="space-y-4">
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
                    <div>
                      <p className="font-bold">Total Gap Days: {summaryMetrics.gapAnalytics.gapDaysCount} of {summaryMetrics.gapAnalytics.numDaysInMonth} days</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Active Call Days: {summaryMetrics.gapAnalytics.activeDaysCount} days ({Math.round((summaryMetrics.gapAnalytics.activeDaysCount / summaryMetrics.gapAnalytics.numDaysInMonth) * 100)}% field coverage rate)
                      </p>
                    </div>
                    <div className="w-24 bg-amber-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-2 rounded-full"
                        style={{
                          width: `${Math.round((summaryMetrics.gapAnalytics.activeDaysCount / summaryMetrics.gapAnalytics.numDaysInMonth) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {days.map((d) => {
                      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const count = counts[iso] ?? 0;
                      const dateObj = new Date(iso + "T00:00:00Z");
                      const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

                      if (count > 0) return null; // Show only gap days in this tab

                      return (
                        <div
                          key={d}
                          className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{weekday}</span>
                          <span className="text-base font-bold text-slate-800 mt-0.5">{d}</span>
                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md mt-1">
                            0 Calls
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {gapsActiveTab === "MRS" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    The following field representatives have zero recorded visits for {monthLabel}:
                  </p>
                  {summaryMetrics.gapAnalytics.inactiveMrs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      All field representatives have logged activity this month.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {summaryMetrics.gapAnalytics.inactiveMrs.map((mr) => (
                        <div
                          key={mr.id}
                          className="p-4 rounded-2xl border border-rose-100 bg-rose-50/30 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                              <UserX size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{mr.name}</p>
                              <p className="text-xs text-slate-500">{mr.email}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1 rounded-xl">
                            0 Calls in {monthLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {gapsActiveTab === "PRESCRIPTION" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      High-Potential Tier A prescribers without field calls in &gt;15 days ({summaryMetrics.gapAnalytics.tierAGapCount} total across territory):
                    </p>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      Priority Target
                    </span>
                  </div>

                  <div className="space-y-2">
                    {summaryMetrics.gapAnalytics.overdueTierADoctors.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{doc.fullName}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Tier A ({doc.dpsScore} DPS)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {doc.specialty} · {doc.subArea || "Locality Pending"} · {doc.beatName || "Beat Pending"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                            {doc.gapDays ? `${doc.gapDays} Days Overdue` : "Never Visited"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gapsActiveTab === "BEATS" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Official beat territories with zero visits recorded in {monthLabel}:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {summaryMetrics.gapAnalytics.unvisitedBeats.map((b) => (
                      <div
                        key={b}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Navigation size={14} className="text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">{b}</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md shrink-0">
                          0 Coverage
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Actionable Field Force Intelligence · Trend MR SFA
              </span>
              <button
                onClick={() => setGapsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Close Intelligence View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
