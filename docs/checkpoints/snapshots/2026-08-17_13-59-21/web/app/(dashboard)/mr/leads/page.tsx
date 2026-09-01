"use client";

import React, { useEffect, useState } from "react";
import { Stethoscope, Store, Trash2, Edit2, X, Check, Target } from "lucide-react";
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
    doctor: { id: string; fullName: string } | null;
    chemist: { id: string; name: string } | null;
  };
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-slate-200 text-slate-600",
};

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);

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
        },
      })
      .then((res) => setLeads(res.data.data.leads))
      .catch((err) => console.error("Failed to load leads:", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter, selectedRep]);

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
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Target size={22} /> My Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1">Leads captured from your calls — track and follow up.</p>
        </div>
        {reps.length > 0 && (
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            Viewing all {reps.length} MRs
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!statusFilter ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}
        >
          All
        </button>
        {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusFilter === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">No leads captured yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {leads.map((l) => {
            const isDoctor = !!l.visit.doctor;
            const target = l.visit.doctor?.fullName ?? l.visit.chemist?.name ?? "Unknown";
            return (
              <div key={l.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDoctor ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {isDoctor ? <Stethoscope size={18} /> : <Store size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{target}</p>
                      {!selectedRep && reps.length > 0 && l.employeeName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 flex-shrink-0">{l.employeeName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLES[l.status]}`}>{l.status.replace("_", " ")}</span>
                      <button onClick={() => openEdit(l)} className="text-slate-400 hover:text-emerald-600 p-1 -m-1" title="Edit lead">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteLead(l.id)} className="text-slate-400 hover:text-red-500 p-1 -m-1" title="Delete lead">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">from call: {l.visit.purpose} · {new Date(l.visit.createdAt).toLocaleDateString("en-IN")}</p>
                  {l.details && <p className="text-xs text-slate-600 mt-1">{l.details}</p>}
                  {l.followUpAction && <p className="text-xs text-slate-600 mt-1 italic">Next: {l.followUpAction}</p>}
                  {l.followUpDate && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 mt-2">
                      Follow-up: {new Date(l.followUpDate).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900 text-sm">Edit Lead</p>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    editStatus === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Details</label>
              <textarea
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Follow-up Action</label>
              <input
                value={editFollowUpAction}
                onChange={(e) => setEditFollowUpAction(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Next Follow-up Date</label>
              <input
                type="date"
                value={editFollowUpDate}
                onChange={(e) => setEditFollowUpDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
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
        </div>
      )}
    </div>
  );
}
