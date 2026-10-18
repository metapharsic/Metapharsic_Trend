"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Stethoscope,
  Store,
  Trash2,
  Edit2,
  X,
  Check,
  Target,
  Sparkles,
  TrendingUp,
  Clock,
  CalendarCheck2,
  CheckCircle2,
  MapPin,
  Navigation,
  Award,
  Package,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  Building2,
  Users2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

type LeadStatus = "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST";

interface Lead {
  id: string;
  status: LeadStatus;
  details: string | null;
  followUpAction: string | null;
  followUpDate: string | null;
  createdAt: string;
  employeeName?: string;
  visit: {
    purpose: string;
    createdAt: string;
    subArea?: string | null;
    beatName?: string | null;
    territory?: string | null;
    cqsScore?: number | null;
    boxesPlaced?: number | null;
    feedback?: string | null;
    receptiveness?: string | null;
    doctor: {
      id: string;
      fullName: string;
      specialty?: string | null;
      subArea?: string | null;
      beatName?: string | null;
      territory?: string | null;
      clinicAddress?: string | null;
    } | null;
    chemist: {
      id: string;
      name: string;
      subArea?: string | null;
      beatName?: string | null;
      territory?: string | null;
      address?: string | null;
    } | null;
  };
}

interface LeadSummary {
  total: number;
  new: number;
  inProgress: number;
  converted: number;
  lost: number;
  conversionRate: number;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; bg: string; text: string; border: string }> = {
  NEW: { label: "New Prospect", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  IN_PROGRESS: { label: "In Follow-up", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  CONVERTED: { label: "Converted", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  LOST: { label: "Closed / Lost", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

const OFFICIAL_BEATS = [
  "HYD-BEAT-1",
  "HYD-BEAT-2",
  "HYD-BEAT-3",
  "HYD-BEAT-4",
  "HYD-BEAT-5",
  "HYD-BEAT-6",
  "HYD-BEAT-7",
  "HYD-BEAT-8",
  "HYD-BEAT-9",
  "HYD-BEAT-10",
];

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [editing, setEditing] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");
  const [editDetails, setEditDetails] = useState("");
  const [editFollowUpAction, setEditFollowUpAction] = useState("");
  const [editFollowUpDate, setEditFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [reps, setReps] = useState<{ id: string; employeeId: string; firstName: string; lastName: string }[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");

  useEffect(() => {
    apiClient
      .get("/api/manager/mrs")
      .then((res) => setReps(res.data.data?.mrs ?? []))
      .catch(() => setReps([]));
  }, []);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/api/mr/leads", {
        params: {
          limit: 100,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(selectedRep ? { employeeId: selectedRep } : {}),
          ...(selectedBeat !== "ALL" ? { beatName: selectedBeat } : {}),
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        },
      })
      .then((res) => {
        setLeads(res.data.data?.leads || []);
        if (res.data.data?.summary) {
          setSummary(res.data.data.summary);
        }
      })
      .catch((err) => console.error("Failed to load leads:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => clearTimeout(timer);
  }, [statusFilter, selectedRep, selectedBeat, searchQuery]);

  const openEdit = (l: Lead) => {
    setEditing(l);
    setEditStatus(l.status);
    setEditDetails(l.details ?? "");
    setEditFollowUpAction(l.followUpAction ?? "");
    setEditFollowUpDate(l.followUpDate ? l.followUpDate.slice(0, 10) : "");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await apiClient.put(`/api/mr/leads/${editing.id}`, {
        status: editStatus,
        details: editDetails || undefined,
        followUpAction: editFollowUpAction || undefined,
        followUpDate: editFollowUpDate || null,
      });
      setEditing(null);
      load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update lead.";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/api/mr/leads/${id}`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (summary) {
        setSummary({ ...summary, total: Math.max(0, summary.total - 1) });
      }
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-3 border border-teal-400/20">
              <Sparkles size={12} className="text-teal-400" />
              Prescriber & Pharmacy Opportunity Pipeline
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white flex items-center gap-3">
              <Target className="text-teal-400" size={30} />
              My Leads & Deal Conversions
            </h1>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Track clinical detailing commitments, pharmacy stocking agreements, follow-up actions, and conversion velocity across beat territories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
              title="Refresh Pipeline"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-teal-400" : ""} />
              Sync Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Analytics KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Target size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Pipeline</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-900">{summary?.total ?? leads.length}</span>
              <span className="text-[11px] font-medium text-slate-500">accounts</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">New Prospects</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-blue-700">{summary?.new ?? 0}</span>
              <span className="text-[11px] font-medium text-blue-600 font-semibold">Initial calls</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">In Follow-Up</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-amber-700">{summary?.inProgress ?? 0}</span>
              <span className="text-[11px] font-medium text-amber-600 font-semibold">Active trial</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Converted Won</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-emerald-700">{summary?.converted ?? 0}</span>
              <span className="text-[11px] font-medium text-emerald-600 font-semibold">Rx / Stocked</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Conversion Rate</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-indigo-700">{summary?.conversionRate ?? 0}%</span>
              <span className="text-[11px] font-medium text-indigo-600 font-semibold">Win velocity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Search, Status, Beat, Rep Filters */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search target doctor, chemist, locality, purpose..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50"
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

          {/* Beat Selector & Representative Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Navigation size={12} className="text-teal-600" /> Beat:
              </span>
              <select
                value={selectedBeat}
                onChange={(e) => setSelectedBeat(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
              >
                <option value="ALL">All 10 Official Beats</option>
                {OFFICIAL_BEATS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {reps.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Users2 size={12} className="text-teal-600" /> MR:
                </span>
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                >
                  <option value="">All Field Representatives</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.employeeId}>
                      {r.firstName} {r.lastName} ({r.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Status Quick Filter Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter size={11} /> Pipeline Stage:
          </span>
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              !statusFilter
                ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Accounts ({leads.length})
          </button>
          {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => {
            const count = leads.filter((l) => l.status === s).length;
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  statusFilter === s
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-90`
                }`}
              >
                <span>{cfg.label}</span>
                <span className="text-[10px] font-bold opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Leads Stream / Grid */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading opportunity pipeline...</p>
          <p className="text-xs text-slate-400 mt-1">Aggregating prescriber & pharmacy leads</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Target size={28} />
          </div>
          <h4 className="text-base font-bold text-slate-700">No Leads Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter || selectedBeat !== "ALL"
              ? "No leads match your current filter parameters. Try clearing search or beat filter."
              : "No opportunity leads have been captured from field calls yet."}
          </p>
          {(searchQuery || statusFilter || selectedBeat !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter(null);
                setSelectedBeat("ALL");
              }}
              className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {leads.map((l) => {
            const isDoctor = !!l.visit.doctor;
            const target = l.visit.doctor?.fullName ?? l.visit.chemist?.name ?? "Target Contact";
            const specialty = isDoctor ? l.visit.doctor?.specialty || "Medical Practitioner" : "Pharmacy / Chemist Retailer";
            const beat = l.visit.beatName || (isDoctor ? l.visit.doctor?.beatName : l.visit.chemist?.beatName);
            const locality = l.visit.subArea || (isDoctor ? l.visit.doctor?.subArea : l.visit.chemist?.subArea);
            const address = isDoctor ? l.visit.doctor?.clinicAddress : l.visit.chemist?.address;
            const cqs = l.visit.cqsScore;
            const boxes = l.visit.boxesPlaced;
            const statusCfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.NEW;

            return (
              <div
                key={l.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-teal-200 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start gap-4"
              >
                {/* Target Avatar / Icon */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDoctor ? "bg-teal-50 text-teal-600 border border-teal-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                  }`}
                >
                  {isDoctor ? <Stethoscope size={22} /> : <Store size={22} />}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{target}</h3>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {specialty}
                      </span>
                      {l.employeeName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                          <Users2 size={10} /> {l.employeeName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {statusCfg.label}
                      </span>
                      <button
                        onClick={() => openEdit(l)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit Lead Status & Follow-up"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteLead(l.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Lead"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Beat & Locality Footprint Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    {beat && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1">
                        <Navigation size={9} /> {beat}
                      </span>
                    )}
                    {locality && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                        <MapPin size={9} /> {locality}
                      </span>
                    )}
                    {cqs != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                        <Award size={9} /> CQS: {cqs}/100
                      </span>
                    )}
                    {boxes != null && boxes > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1">
                        <Package size={9} /> {boxes} Sample Boxes Placed
                      </span>
                    )}
                  </div>

                  {/* Call Purpose & Notes */}
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-700">Originating Call: </span>
                    {l.visit.purpose}
                  </p>

                  {/* Detailing Feedback */}
                  {l.visit.feedback && (
                    <div className="bg-slate-50 rounded-xl p-2.5 mt-2 border border-slate-100 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-700">Clinical Feedback: </span>
                      {l.visit.feedback}
                    </div>
                  )}

                  {/* Lead Commitment Details */}
                  {l.details && (
                    <p className="text-xs text-teal-800 font-medium mt-2 bg-teal-50/70 p-2.5 rounded-xl border border-teal-100">
                      <span className="font-bold text-teal-900">Commercial Commitment: </span>
                      {l.details}
                    </p>
                  )}

                  {/* Next Follow-up Action Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {l.followUpAction && (
                        <span className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-teal-600" /> Next Action: {l.followUpAction}
                        </span>
                      )}
                      {l.followUpDate && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center gap-1">
                          <CalendarCheck2 size={11} />
                          Follow-up: {new Date(l.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium">
                      Captured: {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Lead Modal */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target size={18} className="text-teal-600" />
                  Update Prescriber Opportunity
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editing.visit.doctor?.fullName || editing.visit.chemist?.name || "Target Account"}
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Pipeline Stage / Conversion Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const isSelected = editStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        isSelected
                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                          : `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Commitment & Potential Detailing Notes
              </label>
              <textarea
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                rows={3}
                placeholder="Prescription promise, SKU requirements, distributor margin terms..."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Next Follow-up Action
              </label>
              <input
                type="text"
                value={editFollowUpAction}
                onChange={(e) => setEditFollowUpAction(e.target.value)}
                placeholder="e.g. Deliver sample packs, verify chemist stock..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Follow-up Target Date
              </label>
              <input
                type="date"
                value={editFollowUpDate}
                onChange={(e) => setEditFollowUpDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {editError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {editError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Check size={14} /> {saving ? "Saving..." : "Save Opportunity"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
