"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Stethoscope, Store, Image as ImageIcon, Gauge, Edit2, Trash2, ChevronLeft, ChevronRight, X, Check, CalendarDays, Target, Boxes, MapPin, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";

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
  latitude: number;
  longitude: number;
  locationUnavailable: boolean;
  startedAt: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endedAt: string | null;
  doctor: { id: string; fullName: string; clinicAddress: string | null; territory?: Territory } | null;
  chemist: { id: string; name: string; address: string | null; territory?: Territory } | null;
  lead: { id: string; status: "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST"; details: string | null } | null;
  samples: { id: string; quantity: number; product: { id: string; name: string } }[];
}

interface AreaCount {
  id: string;
  name: string;
  count: number;
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
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [areaPanelOpen, setAreaPanelOpen] = useState(false);

  const [editing, setEditing] = useState<Visit | null>(null);
  const [editPurpose, setEditPurpose] = useState("");
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
          ...(selectedRep ? { employeeId: selectedRep } : {}),
        },
      })
      .then((res) => {
        setVisits(res.data.data.visits);
        setTotalPages(Math.max(1, Math.ceil(res.data.data.total / res.data.data.limit)));
        setAreaCounts(res.data.data.areaCounts ?? []);
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
  }, [page, areaFilter, selectedRep]);

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
    setEditPurpose(v.purpose);
    setEditFeedback(v.feedback ?? "");
    setEditDuration(v.durationMinutes !== null ? String(v.durationMinutes) : "");
    setEditBoxesPlaced(v.boxesPlaced !== null ? String(v.boxesPlaced) : "");
    setEditError(null);
    setConfirmDelete(false);
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
    setSaving(true);
    setEditError(null);
    try {
      await apiClient.put(`/api/mr/visits/${editing.id}`, {
        purpose: editPurpose.trim(),
        feedback: editFeedback.trim() || undefined,
        durationMinutes: editDuration ? Number(editDuration) : undefined,
        boxesPlaced: editBoxesPlaced ? Number(editBoxesPlaced) : undefined,
      });
      setVisits((prev) =>
        prev.map((v) =>
          v.id === editing.id
            ? {
                ...v,
                purpose: editPurpose.trim(),
                feedback: editFeedback.trim() || null,
                durationMinutes: editDuration ? Number(editDuration) : null,
                boxesPlaced: editBoxesPlaced ? Number(editBoxesPlaced) : null,
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

  const filteredVisits = selectedDay
    ? visits.filter((v) => v.createdAt.slice(0, 10) === selectedDay)
    : visits;

  const totalAreaCalls = areaCounts.reduce((s, a) => s + a.count, 0);
  const selectedAreaName = areaFilter ? areaCounts.find((a) => a.id === areaFilter)?.name : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">My Calls</h1>
          <p className="text-sm text-slate-500 mt-1">History of completed doctor and chemist calls</p>
        </div>
        <button
          onClick={() => router.push("/mr/calls/new")}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Complete a Call
        </button>
      </div>

      {/* ── Rep picker (managers only) ── */}
      {reps.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Viewing</span>
          <select
            value={selectedRep}
            onChange={(e) => { setSelectedRep(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">My own calls</option>
            {reps.map((r) => (
              <option key={r.employeeId} value={r.employeeId}>{r.firstName} {r.lastName}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Calendar trigger: small pill, opens cute popup ── */}
      <div className="flex items-center gap-2">
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
          className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-4 py-2 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <MapPin size={14} />
          </span>
          <span className="text-xs font-bold text-slate-700">{selectedAreaName ?? "All Areas"}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
            {areaFilter ? areaCounts.find((a) => a.id === areaFilter)?.count ?? 0 : totalAreaCalls}
          </span>
        </button>

        {selectedDay && (
          <button onClick={() => setSelectedDay(null)} className="text-xs font-semibold text-emerald-600 hover:underline">
            {selectedDay} ✕
          </button>
        )}
      </div>

      {areaPanelOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAreaPanelOpen(false)}>
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-slate-800 mb-3">📍 Calls by Area</p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              <button
                onClick={() => {
                  setAreaFilter(null);
                  setPage(1);
                  setAreaPanelOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  !areaFilter ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                }`}
              >
                <span>All Areas</span>
                <span className="text-xs font-bold">{totalAreaCalls}</span>
              </button>
              {areaCounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setAreaFilter(a.id);
                    setPage(1);
                    setAreaPanelOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    areaFilter === a.id ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                  }`}
                >
                  <span>{a.name}</span>
                  <span className="text-xs font-bold">{a.count}</span>
                </button>
              ))}
              {areaCounts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No area data yet.</p>}
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
                    <p className="font-bold text-slate-900 text-sm">{isDoctor ? v.doctor!.fullName : v.chemist!.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString("en-IN")}</p>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="text-slate-400 hover:text-emerald-600 p-1 -m-1" title="View / edit call">
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{v.purpose}</p>
                  {v.feedback && <p className="text-xs text-slate-600 mt-1 italic">"{v.feedback}"</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {v.durationMinutes !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{v.durationMinutes} min</span>
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
                    {v.boxesPlaced !== null && v.boxesPlaced > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Boxes size={10} /> {v.boxesPlaced} boxes
                      </span>
                    )}
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
    </div>
  );
}
