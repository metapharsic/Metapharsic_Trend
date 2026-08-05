"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Territory {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  name: string;
}

interface DayBlock {
  date: string;
  territoryId: string;
  doctorIds: string[];
}

function emptyBlock(): DayBlock {
  return { date: "", territoryId: "", doctorIds: [] };
}

export default function NewTourPlanPage() {
  return (
    <Suspense fallback={null}>
      <NewTourPlanForm />
    </Suspense>
  );
}

function NewTourPlanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(() => searchParams.get("month") ?? "");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctorsByTerritory, setDoctorsByTerritory] = useState<Record<string, Doctor[]>>({});
  const [days, setDays] = useState<DayBlock[]>([emptyBlock()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/mr/territories")
      .then((res) => setTerritories(res.data.data.territories))
      .catch((err) => console.error("Failed to load territories:", err));
  }, []);

  const loadDoctors = async (territoryId: string) => {
    if (!territoryId || doctorsByTerritory[territoryId]) return;
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "DOCTOR", territoryId, limit: 200 },
      });
      const doctors: Doctor[] = res.data.data.entities.map((e: { id: string; name: string }) => ({
        id: e.id,
        name: e.name,
      }));
      setDoctorsByTerritory((prev) => ({ ...prev, [territoryId]: doctors }));
    } catch (err) {
      console.error("Failed to load doctors:", err);
    }
  };

  const updateDay = (index: number, patch: Partial<DayBlock>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleTerritoryChange = (index: number, territoryId: string) => {
    updateDay(index, { territoryId, doctorIds: [] });
    loadDoctors(territoryId);
  };

  const toggleDoctor = (index: number, doctorId: string) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const has = d.doctorIds.includes(doctorId);
        return { ...d, doctorIds: has ? d.doctorIds.filter((id) => id !== doctorId) : [...d.doctorIds, doctorId] };
      })
    );
  };

  const addDay = () => setDays((prev) => [...prev, emptyBlock()]);
  const removeDay = (index: number) => setDays((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError(null);

    if (!month) return setError("Pick a month.");
    const validDays = days.filter((d) => d.date && d.territoryId);
    if (validDays.length === 0) return setError("Add at least one day with a date and territory.");

    const payload = {
      month: new Date(`${month}-01`),
      days: validDays.flatMap((d) =>
        d.doctorIds.length > 0
          ? d.doctorIds.map((doctorId) => ({
              date: new Date(d.date),
              territoryId: d.territoryId,
              plannedDoctorId: doctorId,
            }))
          : [{ date: new Date(d.date), territoryId: d.territoryId }]
      ),
    };

    setSubmitting(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/submit", payload);
      router.push("/tour-plans");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to submit tour plan.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 bg-gradient-to-r from-sky-50 to-white">
        <h1 className="text-2xl font-display font-bold text-slate-900">New Tour Plan</h1>
        <p className="text-sm text-slate-500 mt-1">Plan your daily calls for the month — add multiple doctors per day.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
        <div className="max-w-xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        <div className="space-y-4">
          {days.map((day, index) => (
            <div key={index} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Day {index + 1}</span>
                {days.length > 1 && (
                  <button onClick={() => removeDay(index)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) => updateDay(index, { date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Territory</label>
                  <select
                    value={day.territoryId}
                    onChange={(e) => handleTerritoryChange(index, e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                  >
                    <option value="">Select territory</option>
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {day.territoryId && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Planned doctors ({day.doctorIds.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2">
                    {(doctorsByTerritory[day.territoryId] ?? []).map((doc) => {
                      const selected = day.doctorIds.includes(doc.id);
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => toggleDoctor(index, doc.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors
                            ${selected ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"}`}
                        >
                          {doc.name}
                          {selected && <X size={12} />}
                        </button>
                      );
                    })}
                    {doctorsByTerritory[day.territoryId]?.length === 0 && (
                      <span className="text-xs text-slate-400">No doctors in this territory.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addDay}
          className="flex items-center gap-1.5 text-sky-600 hover:bg-sky-50 px-3 py-2 rounded-lg text-sm font-semibold border border-sky-200"
        >
          <Plus size={16} /> Add Day
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => router.push("/tour-plans")}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
