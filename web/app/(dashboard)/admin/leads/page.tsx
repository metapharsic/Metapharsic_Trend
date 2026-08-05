"use client";

import React, { useEffect, useState } from "react";
import { Target, Trash2, Stethoscope, Store } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type LeadStatus = "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST";

interface Lead {
  id: string;
  status: LeadStatus;
  details: string | null;
  followUpAction: string | null;
  followUpDate: string | null;
  createdAt: string;
  mrName: string;
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
  LOST: "bg-gray-200 text-gray-600",
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        setRole(JSON.parse(atob(token.split(".")[1])).role);
      } catch (e) {
        console.error("Failed to decode token");
      }
    }
  }, []);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/api/manager/leads", { params: { limit: 100, ...(statusFilter ? { status: statusFilter } : {}) } })
      .then((res) => setLeads(res.data.data.leads))
      .catch((err) => console.error("Failed to load leads:", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const updateStatus = async (id: string, status: LeadStatus) => {
    try {
      await apiClient.put(`/api/manager/leads/${id}`, { status });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (err) {
      console.error("Failed to update lead:", err);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/api/manager/leads/${id}`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
          <Target size={22} /> Leads Pipeline
        </h1>
        <p className="text-sm text-gray-500 mt-1">Every lead captured by every MR, across all territories.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!statusFilter ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200"}`}
        >
          All
        </button>
        {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusFilter === s ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No leads found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {leads.map((l) => {
            const isDoctor = !!l.visit.doctor;
            const target = l.visit.doctor?.fullName ?? l.visit.chemist?.name ?? "Unknown";
            return (
              <div key={l.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDoctor ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {isDoctor ? <Stethoscope size={18} /> : <Store size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{target}</p>
                      <p className="text-xs text-gray-400">MR: {l.mrName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={l.status}
                        onChange={(e) => updateStatus(l.id, e.target.value as LeadStatus)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-md border-0 ${STATUS_STYLES[l.status]}`}
                      >
                        {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      {role !== "ASM" && (
                        <button onClick={() => deleteLead(l.id)} className="text-gray-400 hover:text-red-500 p-1 -m-1" title="Delete lead">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">from call: {l.visit.purpose} · {new Date(l.visit.createdAt).toLocaleDateString("en-IN")}</p>
                  {l.details && <p className="text-xs text-gray-600 mt-1">{l.details}</p>}
                  {l.followUpAction && <p className="text-xs text-gray-600 mt-1 italic">Next: {l.followUpAction}</p>}
                  {l.followUpDate && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 mt-2">
                      Follow-up: {new Date(l.followUpDate).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
