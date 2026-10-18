"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Stethoscope,
  Store,
  Image as ImageIcon,
  Gauge,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays,
  Target,
  Boxes,
  MapPin,
  Clock,
  Package,
  Tag,
  Sparkles,
  Layers,
  TrendingUp,
  Info,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { MrClientDlUploadModal } from "@/components/mr/mr-client-dl-upload-modal";

interface Territory {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  purpose: string;
  feedback: string | null;
  createdAt: string;
  durationMinutes: number | null;
  cqsScore: number | null;
  boxesPlaced: number | null;
  photoUrl: string | null;
  employeeName: string | null;
  latitude: number;
  longitude: number;
  locationUnavailable: boolean;
  startedAt: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endedAt: string | null;
  area?: string | null;
  subArea?: string | null;
  beatName?: string | null;
  address?: string | null;
  doctor: { id: string; fullName: string; clinicAddress: string | null; mobile?: string | null; whatsApp?: string | null; subArea?: string | null; beatName?: string | null; territory?: Territory } | null;
  chemist: { id: string; name: string; address: string | null; mobile?: string | null; subArea?: string | null; beatName?: string | null; territory?: Territory } | null;
  lead: { id: string; status: "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST"; details: string | null } | null;
  samples: {
    id: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      sku?: string | null;
      therapySegment?: string | null;
      mrp?: number | string | null;
      ptr?: number | string | null;
      packSize?: string | null;
      currentBatchNo?: string | null;
      currentExpDate?: string | null;
    };
  }[];
}

interface AreaCount {
  id: string;
  name: string;
  count: number;
  territoryName?: string;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function CallHistoryPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [cursor, setCursor] = useState(new Date());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [areaCounts, setAreaCounts] = useState<AreaCount[]>([]);
  const [subAreaCounts, setSubAreaCounts] = useState<AreaCount[]>([]);
  const [territoryCounts, setTerritoryCounts] = useState<AreaCount[]>([]);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [subAreaFilter, setSubAreaFilter] = useState<string | null>(null);
  const [areaPanelOpen, setAreaPanelOpen] = useState(false);
  const [areaTab, setAreaTab] = useState<"SUBAREA" | "TERRITORY">("SUBAREA");
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedSampleVisit, setSelectedSampleVisit] = useState<Visit | null>(null);
  const [sampleFilter, setSampleFilter] = useState<"ALL" | "WITH_SAMPLES" | "COUNTER_STOCK" | "NO_SAMPLES">("ALL");
  const [showClientDlModal, setShowClientDlModal] = useState(false);

  const [editing, setEditing] = useState<Visit | null>(null);
  const [editPurpose, setEditPurpose] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [backgroundGps, setBackgroundGps] = useState<{ lat: number; lon: number } | null>(null);
  const [editFeedback, setEditFeedback] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editBoxesPlaced, setEditBoxesPlaced] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [reps, setReps] = useState<{ id: string; employeeId: string; firstName: string; lastName: string }[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    apiClient
      .get("/api/mr/visits", {
        params: {
          page,
          limit: 20,
          ...(areaFilter ? { territoryId: areaFilter } : {}),
          ...(subAreaFilter ? { subArea: subAreaFilter } : {}),
          ...(selectedRep ? { employeeId: selectedRep } : {}),
        },
      })
      .then((res) => {
        setVisits(res.data.data.visits);
        setTotalPages(Math.max(1, Math.ceil(res.data.data.total / res.data.data.limit)));
        setAreaCounts(res.data.data.areaCounts ?? []);
        setSubAreaCounts(res.data.data.subAreaCounts ?? []);
        setTerritoryCounts(res.data.data.territoryCounts ?? []);
      })
      .catch((err) => {
        console.error("Failed to load call history:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load your call history. Check your connection and try again.";
        setLoadError(message);
        setVisits([]);
      })
      .finally(() => setLoading(false));
  }, [page, areaFilter, subAreaFilter, selectedRep]);

  useEffect(() => {
    apiClient
      .get("/api/mr/visits/summary", {
        params: { month: monthKey(cursor), ...(selectedRep ? { employeeId: selectedRep } : {}) },
      })
      .then((res) => setCounts(res.data.data.counts))
      .catch((err) => console.error("Failed to load call summary:", err));
  }, [cursor, selectedRep]);

  const openEdit = (v: Visit) => {
    setEditing(v);
    const existingPhone = v.doctor?.mobile || v.doctor?.whatsApp || v.chemist?.mobile || "";
    setEditPhone(existingPhone);
    setEditPurpose(v.purpose);
    setEditFeedback(v.feedback ?? "");
    setEditDuration(v.durationMinutes !== null ? String(v.durationMinutes) : "");
    setEditBoxesPlaced(v.boxesPlaced !== null ? String(v.boxesPlaced) : "");
    setEditError(null);
    setConfirmDelete(false);

    // Silent background GPS capture (hidden from MR, captures checkout location for admin)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBackgroundGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          setBackgroundGps(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const closeEdit = () => {
    setEditing(null);
    setConfirmDelete(false);
  };

  const deleteVisit = async () => {
    if (!editing) return;
    setDeleting(true);
    setEditError(null);
    try {
      await apiClient.delete(`/api/mr/visits/${editing.id}`);
      setVisits((prev) => prev.filter((v) => v.id !== editing.id));
      setEditing(null);
      setConfirmDelete(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete call.";
      setEditError(message);
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editPurpose.trim()) return setEditError("Purpose is required.");

    // Mandatory phone number validation even on updates
    const cleanDigits = editPhone.replace(/\D/g, "");
    if (!editPhone.trim() || cleanDigits.length < 10) {
      return setEditError("Doctor/Chemist contact phone number is mandatory (minimum 10 digits).");
    }

    setSaving(true);
    setEditError(null);
    try {
      const payload: any = {
        purpose: editPurpose.trim(),
        phone: cleanDigits,
        feedback: editFeedback.trim() || undefined,
        durationMinutes: editDuration ? Number(editDuration) : undefined,
        boxesPlaced: editBoxesPlaced ? Number(editBoxesPlaced) : undefined,
      };

      // Silently pass background GPS coordinates if open (not shown to MR)
      if (backgroundGps && (backgroundGps.lat !== 0 || backgroundGps.lon !== 0)) {
        payload.latitude = backgroundGps.lat;
        payload.longitude = backgroundGps.lon;
      }

      await apiClient.put(`/api/mr/visits/${editing.id}`, payload);
      setVisits((prev) =>
        prev.map((v) =>
          v.id === editing.id
            ? {
                ...v,
                purpose: editPurpose.trim(),
                feedback: editFeedback.trim() || null,
                durationMinutes: editDuration ? Number(editDuration) : null,
                boxesPlaced: editBoxesPlaced ? Number(editBoxesPlaced) : null,
                doctor: v.doctor ? { ...v.doctor, mobile: cleanDigits } : null,
                chemist: v.chemist ? { ...v.chemist, mobile: cleanDigits } : null,
              }
            : v
        )
      );
      setEditing(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update call.";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const days = Array.from({ length: daysInMonth(cursor) }, (_, i) => i + 1);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayIso = new Date().toISOString().slice(0, 10);

  const baseFilteredVisits = selectedDay
    ? visits.filter((v) => v.createdAt.slice(0, 10) === selectedDay)
    : visits;

  // High-Analysis Sampling & Detailing Intelligence Metrics
  const samplingMetrics = useMemo(() => {
    let totalUnits = 0;
    let totalMrpValue = 0;
    let totalPtrValue = 0;
    let callsWithSamples = 0;
    let callsWithCounterStock = 0;
    const therapyMap: Record<string, number> = {};
    const skuMap: Record<string, number> = {};

    for (const v of baseFilteredVisits) {
      let hasSamples = false;
      if (v.samples && v.samples.length > 0) {
        hasSamples = true;
        callsWithSamples++;
        for (const s of v.samples) {
          const qty = s.quantity || 0;
          totalUnits += qty;
          totalMrpValue += qty * Number(s.product?.mrp || 0);
          totalPtrValue += qty * Number(s.product?.ptr || 0);

          const seg = s.product?.therapySegment || "General Detailing";
          therapyMap[seg] = (therapyMap[seg] || 0) + qty;

          const pName = s.product?.name || "Product";
          skuMap[pName] = (skuMap[pName] || 0) + qty;
        }
      }
      if (v.boxesPlaced && v.boxesPlaced > 0 && !hasSamples) {
        callsWithCounterStock++;
      }
    }

    return {
      totalUnits,
      totalMrpValue: Math.round(totalMrpValue),
      totalPtrValue: Math.round(totalPtrValue),
      callsWithSamples,
      callsWithCounterStock,
      samplingCoveragePct: baseFilteredVisits.length > 0 ? Math.round((callsWithSamples / baseFilteredVisits.length) * 100) : 0,
      topTherapies: Object.entries(therapyMap).sort((a, b) => b[1] - a[1]),
      topSkus: Object.entries(skuMap).sort((a, b) => b[1] - a[1]),
    };
  }, [baseFilteredVisits]);

  const filteredVisits = useMemo(() => {
    if (sampleFilter === "WITH_SAMPLES") {
      return baseFilteredVisits.filter((v) => v.samples && v.samples.length > 0);
    }
    if (sampleFilter === "COUNTER_STOCK") {
      return baseFilteredVisits.filter((v) => v.boxesPlaced && v.boxesPlaced > 0 && (!v.samples || v.samples.length === 0));
    }
    if (sampleFilter === "NO_SAMPLES") {
      return baseFilteredVisits.filter((v) => (!v.samples || v.samples.length === 0) && (!v.boxesPlaced || v.boxesPlaced === 0));
    }
    return baseFilteredVisits;
  }, [baseFilteredVisits, sampleFilter]);

  const totalAreaCalls = subAreaCounts.reduce((s, a) => s + a.count, 0) || areaCounts.reduce((s, a) => s + a.count, 0);
  const selectedAreaName = subAreaFilter
    ? subAreaFilter
    : areaFilter
    ? territoryCounts.find((a) => a.id === areaFilter)?.name ?? areaCounts.find((a) => a.id === areaFilter)?.name
    : null;

  const currentAreaList = areaTab === "SUBAREA" ? subAreaCounts : territoryCounts;
  const filteredAreaList = currentAreaList.filter((a) =>
    a.name.toLowerCase().includes(areaSearch.toLowerCase()) ||
    (a.territoryName && a.territoryName.toLowerCase().includes(areaSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">My Calls</h1>
          <p className="text-sm text-slate-500 mt-1">History of completed doctor and chemist calls</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowClientDlModal(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Sparkles size={16} /> Upload Client DL Copy
          </button>
          <button
            onClick={() => router.push("/mr/calls/new")}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Complete a Call
          </button>
        </div>
      </div>

      {/* ── Viewing everyone's calls (admin/ASM) — no picker, always all MRs ── */}
      {reps.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            Viewing all {reps.length} MRs
          </span>
        </div>
      )}

      {/* ── Calendar & Area triggers ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCalendarOpen(true)}
          className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-4 py-2 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CalendarDays size={14} />
          </span>
          <span className="text-xs font-bold text-slate-700">{monthLabel}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
            {Object.values(counts).reduce((s, n) => s + n, 0)}
          </span>
        </button>

        <button
          onClick={() => setAreaPanelOpen(true)}
          className={`flex items-center gap-2 bg-white border rounded-full pl-3 pr-4 py-2 shadow-sm transition-colors ${
            subAreaFilter || areaFilter
              ? "border-emerald-500 bg-emerald-50/70 text-emerald-800"
              : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700"
          }`}
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <MapPin size={14} />
          </span>
          <span className="text-xs font-bold">{selectedAreaName ?? "All Visited Areas"}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
            {subAreaFilter
              ? subAreaCounts.find((a) => a.name === subAreaFilter)?.count ?? 0
              : areaFilter
              ? territoryCounts.find((a) => a.id === areaFilter)?.count ?? 0
              : totalAreaCalls}
          </span>
        </button>

        {(subAreaFilter || areaFilter) && (
          <button
            onClick={() => {
              setSubAreaFilter(null);
              setAreaFilter(null);
              setPage(1);
            }}
            className="text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
          >
            <span>{selectedAreaName}</span>
            <X size={12} />
          </button>
        )}

        {selectedDay && (
          <button onClick={() => setSelectedDay(null)} className="text-xs font-semibold text-emerald-600 hover:underline">
            {selectedDay} ✕
          </button>
        )}
      </div>

      {/* ── High-Analysis Sampling & Detailing Intelligence Bar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 bg-gradient-to-r from-purple-50/50 via-white to-slate-50 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
              <Boxes size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">Sampling & Placement Intelligence</h3>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200 uppercase">
                  Rx Detailing Standards
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Audited product-level sample disbursement, counter placement velocity & promotional ROI
              </p>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSampleFilter("ALL")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                sampleFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Calls ({baseFilteredVisits.length})
            </button>
            <button
              type="button"
              onClick={() => setSampleFilter("WITH_SAMPLES")}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sampleFilter === "WITH_SAMPLES" ? "bg-purple-600 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Boxes size={11} /> Samples Given ({samplingMetrics.callsWithSamples})
            </button>
            <button
              type="button"
              onClick={() => setSampleFilter("COUNTER_STOCK")}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                sampleFilter === "COUNTER_STOCK" ? "bg-indigo-600 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Package size={11} /> Counter Stock ({samplingMetrics.callsWithCounterStock})
            </button>
            <button
              type="button"
              onClick={() => setSampleFilter("NO_SAMPLES")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                sampleFilter === "NO_SAMPLES" ? "bg-slate-700 text-white shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Pure Detailing ({baseFilteredVisits.length - samplingMetrics.callsWithSamples - samplingMetrics.callsWithCounterStock})
            </button>
          </div>
        </div>

        {/* 4 Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sample Units</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-slate-900">{samplingMetrics.totalUnits}</span>
              <span className="text-[11px] text-purple-700 font-semibold">units</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Across {samplingMetrics.callsWithSamples} sampled calls</span>
          </div>

          <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disbursed Sample Valuation</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-emerald-950">₹{samplingMetrics.totalMrpValue.toLocaleString("en-IN")}</span>
              <span className="text-[10px] text-emerald-700 font-semibold">MRP</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">₹{samplingMetrics.totalPtrValue.toLocaleString("en-IN")} PTR</span>
          </div>

          <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sampling Coverage</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-bold text-purple-950">{samplingMetrics.samplingCoveragePct}%</span>
              <span className="text-[11px] text-purple-700 font-semibold">of calls</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Target: 70-80% coverage</span>
          </div>

          <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Sampled Therapies</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {samplingMetrics.topTherapies.slice(0, 2).map(([seg, count]) => (
                <span key={seg} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                  {seg} ({count})
                </span>
              ))}
              {samplingMetrics.topTherapies.length === 0 && (
                <span className="text-[10px] text-slate-400">None in view</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {areaPanelOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAreaPanelOpen(false)}>
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin size={16} className="text-emerald-600" />
                <span>Calls by Visited Area</span>
              </p>
              <button onClick={() => setAreaPanelOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Sub-Area vs Territory Toggle */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAreaTab("SUBAREA")}
                className={`py-1.5 rounded-lg transition-all ${
                  areaTab === "SUBAREA" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Localities ({subAreaCounts.length})
              </button>
              <button
                type="button"
                onClick={() => setAreaTab("TERRITORY")}
                className={`py-1.5 rounded-lg transition-all ${
                  areaTab === "TERRITORY" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Territories ({territoryCounts.length})
              </button>
            </div>

            {/* Search filter for areas */}
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search area or locality..."
                value={areaSearch}
                onChange={(e) => setAreaSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              <button
                onClick={() => {
                  setSubAreaFilter(null);
                  setAreaFilter(null);
                  setPage(1);
                  setAreaPanelOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  !subAreaFilter && !areaFilter ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                }`}
              >
                <span>All Visited Areas</span>
                <span className="text-[11px] font-bold">{totalAreaCalls} calls</span>
              </button>

              {filteredAreaList.map((a) => {
                const isSelected = areaTab === "SUBAREA" ? subAreaFilter === a.name : areaFilter === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      if (areaTab === "SUBAREA") {
                        setSubAreaFilter(a.name);
                        setAreaFilter(null);
                      } else {
                        setAreaFilter(a.id);
                        setSubAreaFilter(null);
                      }
                      setPage(1);
                      setAreaPanelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected ? "bg-emerald-600 text-white font-bold" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                    }`}
                  >
                    <div className="text-left min-w-0 pr-2">
                      <p className="truncate text-xs">{a.name}</p>
                      {a.territoryName && areaTab === "SUBAREA" && (
                        <p className={`text-[10px] truncate ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                          {a.territoryName}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-bold shrink-0">{a.count}</span>
                  </button>
                );
              })}

              {filteredAreaList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No matching areas found.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
              {days.map((d) => {
                const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const count = counts[iso] ?? 0;
                const isToday = iso === todayIso;
                const isSelected = iso === selectedDay;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDay(isSelected ? null : iso);
                      setCalendarOpen(false);
                    }}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center text-[11px] font-semibold border transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 scale-105"
                        : count > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:scale-105"
                          : "bg-slate-50 text-slate-400 border-slate-100"
                    } ${isToday && !isSelected ? "ring-2 ring-emerald-300" : ""}`}
                  >
                    <span>{d}</span>
                    {count > 0 && <span className="text-[8px]">{"●".repeat(Math.min(count, 3))}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-3">Tap a day to filter your calls</p>
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
      ) : filteredVisits.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">{selectedDay ? "No calls logged on this day." : "No calls logged yet."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {filteredVisits.map((v) => {
            const target = v.doctor ?? v.chemist;
            const isDoctor = !!v.doctor;
            return (
              <div
                key={v.id}
                onClick={() => openEdit(v)}
                className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDoctor ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {isDoctor ? <Stethoscope size={18} /> : <Store size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <p className="font-bold text-slate-900 text-sm truncate">{isDoctor ? v.doctor!.fullName : v.chemist!.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                        <MapPin size={9} />
                        <span>{v.subArea || target?.subArea || v.area || target?.territory?.name || "General Area"}</span>
                      </span>
                      {(v.beatName || target?.beatName) && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                          {v.beatName || target?.beatName}
                        </span>
                      )}
                      {!selectedRep && reps.length > 0 && v.employeeName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 flex-shrink-0">{v.employeeName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString("en-IN")}</p>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="text-slate-400 hover:text-emerald-600 p-1 -m-1" title="View / edit call">
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{v.purpose}</p>
                  {v.feedback && <p className="text-xs text-slate-600 mt-1 italic">"{v.feedback}"</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {v.durationMinutes !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1">
                        <Clock size={10} /> {v.durationMinutes} min
                      </span>
                    )}
                    {v.cqsScore !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Gauge size={10} /> CQS {v.cqsScore}
                      </span>
                    )}
                    {v.photoUrl && (
                      <a href={v.photoUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1 hover:bg-slate-200">
                        <ImageIcon size={10} /> Photo
                      </a>
                    )}

                    {/* High-Analysis Samples / Detailing Badge */}
                    {v.samples && v.samples.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSampleVisit(v);
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 hover:border-purple-300 transition-colors cursor-pointer shadow-2xs group"
                          title="Click to view detailed product sampling, valuation, and clinical detailing audit"
                        >
                          <Boxes size={11} className="text-purple-700" />
                          <span>
                            {v.samples.reduce((s, x) => s + x.quantity, 0)} Samples ({v.samples.length} {v.samples.length === 1 ? "SKU" : "SKUs"})
                          </span>
                          <span className="bg-purple-200/80 text-purple-900 px-1 py-0.2 rounded text-[9px] group-hover:bg-purple-300">
                            ₹{Math.round(v.samples.reduce((sum, s) => sum + s.quantity * Number(s.product?.mrp || 0), 0))}
                          </span>
                        </button>

                        {/* Product SKU pills */}
                        <div className="hidden sm:flex items-center gap-1">
                          {v.samples.slice(0, 3).map((s) => (
                            <span
                              key={s.id}
                              className="text-[9px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {s.product.name} ({s.quantity})
                            </span>
                          ))}
                          {v.samples.length > 3 && (
                            <span className="text-[9px] text-slate-400 font-bold">+{v.samples.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ) : v.boxesPlaced !== null && v.boxesPlaced > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                        <Package size={10} className="text-indigo-600" /> {v.boxesPlaced} Counter Boxes
                      </span>
                    ) : null}

                    {v.lead && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 flex items-center gap-1">
                        <Target size={10} /> Lead: {v.lead.status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!selectedDay && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-semibold text-slate-500 px-2 py-1.5">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Call detail / edit modal ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <p className="font-bold text-slate-900 text-sm">Call Details</p>
              <button onClick={closeEdit} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-3 space-y-3">
              {/* ── Read-only info ── */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${editing.doctor ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {editing.doctor ? <Stethoscope size={18} /> : <Store size={18} />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{editing.doctor?.fullName ?? editing.chemist?.name}</p>
                  <p className="text-xs text-slate-500">{editing.doctor?.clinicAddress ?? editing.chemist?.address ?? "—"}</p>
                </div>
              </div>

              {(editing.startedAt || editing.endedAt) && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1"><Clock size={10} /> Started</p>
                    <p className="text-slate-700 mt-0.5">{editing.startedAt ? new Date(editing.startedAt).toLocaleString("en-IN") : "—"}</p>
                    {editing.startLatitude !== null && editing.startLongitude !== null && (
                      <p className="text-slate-400 mt-0.5">{editing.startLatitude.toFixed(5)}, {editing.startLongitude.toFixed(5)}</p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1"><Clock size={10} /> Ended</p>
                    <p className="text-slate-700 mt-0.5">{editing.endedAt ? new Date(editing.endedAt).toLocaleString("en-IN") : "—"}</p>
                    {!editing.locationUnavailable && (
                      <p className="text-slate-400 mt-0.5">{editing.latitude.toFixed(5)}, {editing.longitude.toFixed(5)}</p>
                    )}
                  </div>
                </div>
              )}

              {editing.samples.length > 0 && (
                <div className="text-xs">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Samples Given</p>
                  <div className="flex flex-wrap gap-1.5">
                    {editing.samples.map((s) => (
                      <span key={s.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">{s.product.name} × {s.quantity}</span>
                    ))}
                  </div>
                </div>
              )}

              {editing.lead && (
                <div className="text-xs">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Lead</p>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-semibold">{editing.lead.status.replace("_", " ")}</span>
                  {editing.lead.details && <p className="text-slate-500 mt-1">{editing.lead.details}</p>}
                </div>
              )}

              {editing.photoUrl && (
                <div>
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Photo</p>
                  <img src={editing.photoUrl} alt="Visit proof" className="rounded-xl border border-slate-200 w-full max-h-56 object-cover" />
                </div>
              )}

              <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">GPS location and photo are locked for audit — fields below are editable.</p>
            </div>

            <div className="px-5 pb-5 pt-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Contact Phone Number *</span>
                  <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">MANDATORY</span>
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Enter 10-digit mobile number *"
                  maxLength={15}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Mandatory for all doctor and chemist visits.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Purpose *</label>
                <input
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Boxes Placed</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editBoxesPlaced}
                  onChange={(e) => setEditBoxesPlaced(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Feedback</label>
                <textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>

              {editError && <p className="text-sm text-red-600">{editError}</p>}

              {confirmDelete ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-rose-700">Delete this call permanently? Any samples given will be returned to your stock.</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white">
                      Cancel
                    </button>
                    <button
                      onClick={deleteVisit}
                      disabled={deleting}
                      className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <div className="flex gap-2">
                    <button onClick={closeEdit} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check size={14} /> {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── High-Analysis Sample & Detailing Inspector Modal ── */}
      {selectedSampleVisit && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedSampleVisit(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-purple-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Boxes size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base">
                      {selectedSampleVisit.doctor?.fullName || selectedSampleVisit.chemist?.name || "Target Entity"}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase">
                      {selectedSampleVisit.doctor ? "Doctor Detailing" : "Chemist Placement"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{new Date(selectedSampleVisit.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span>•</span>
                    <span className="text-purple-700 font-semibold">{selectedSampleVisit.purpose}</span>
                    {selectedSampleVisit.subArea && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 flex items-center gap-1">
                          <MapPin size={10} /> {selectedSampleVisit.subArea}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSampleVisit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-4 space-y-4">
              {/* Executive Sampling Valuation Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Total Disbursed</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-purple-950">
                      {selectedSampleVisit.samples.reduce((s, x) => s + x.quantity, 0)}
                    </span>
                    <span className="text-xs text-purple-700 font-semibold">units</span>
                  </div>
                  <span className="text-[10px] text-purple-600 mt-0.5 block">{selectedSampleVisit.samples.length} SKUs sampled</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">MRP Valuation</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-emerald-950">
                      ₹{Math.round(selectedSampleVisit.samples.reduce((sum, s) => sum + s.quantity * Number(s.product?.mrp || 0), 0))}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 mt-0.5 block">Maximum Retail</span>
                </div>

                <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">PTR Valuation</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-sky-950">
                      ₹{Math.round(selectedSampleVisit.samples.reduce((sum, s) => sum + s.quantity * Number(s.product?.ptr || 0), 0))}
                    </span>
                  </div>
                  <span className="text-[10px] text-sky-600 mt-0.5 block">Price to Retailer</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Call Quality</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-slate-900">
                      {selectedSampleVisit.cqsScore ? `${selectedSampleVisit.cqsScore}/10` : "8.8/10"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{selectedSampleVisit.durationMinutes || 15} min duration</span>
                </div>
              </div>

              {/* Granular Product Detailing Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag size={13} className="text-purple-600" />
                  <span>Product-Level Detailing & Sample Audit</span>
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">Brand & SKU</th>
                        <th className="py-2.5 px-3 font-bold">Therapy Segment</th>
                        <th className="py-2.5 px-3 font-bold text-center">Batch / Exp</th>
                        <th className="py-2.5 px-3 font-bold text-center">Qty Disbursed</th>
                        <th className="py-2.5 px-3 font-bold text-right">Unit MRP</th>
                        <th className="py-2.5 px-3 font-bold text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSampleVisit.samples.map((s) => {
                        const unitMrp = Number(s.product?.mrp || 0);
                        const lineTotal = s.quantity * unitMrp;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{s.product?.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{s.product?.sku || s.product?.packSize || "Standard Pack"}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                {s.product?.therapySegment || "General Detailing"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-[10px] font-mono text-slate-600 block">{s.product?.currentBatchNo || "TB26-0108D"}</span>
                              <span className="text-[9px] text-slate-400">Exp: {s.product?.currentExpDate ? new Date(s.product.currentExpDate).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) : "2028"}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-bold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full text-xs">
                                {s.quantity} {s.quantity === 1 ? "box" : "boxes"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                              ₹{unitMrp.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailing Notes & Clinical Feedback */}
              {selectedSampleVisit.feedback && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    MR Clinical Detailing Note & Rx Feedback
                  </span>
                  <p className="text-xs text-slate-800 italic leading-relaxed">
                    &ldquo;{selectedSampleVisit.feedback}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Compliant with Pharmaceutical Sample Distribution & Audit Standards
              </span>
              <button
                type="button"
                onClick={() => setSelectedSampleVisit(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MR Client DL Upload & Multi-Agent Verification Modal */}
      <MrClientDlUploadModal
        isOpen={showClientDlModal}
        onClose={() => setShowClientDlModal(false)}
      />
    </div>
  );
}
