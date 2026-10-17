"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle2,
  Calendar,
  MapPin,
  Stethoscope,
  Lock,
  AlertTriangle,
  Copy,
  Sparkles,
  Filter,
  Check,
  CheckCheck,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";

interface Territory {
  id: string;
  name: string;
  region?: string;
  zone?: string;
}

interface Doctor {
  id: string;
  name: string;
  beatName?: string;
  subArea?: string;
  clinicAddress?: string;
  primarySpecialty?: string;
  dpsTier?: string;
}

interface DayBlock {
  date: string;
  territoryId: string;
  doctorIds: string[];
}

function emptyBlock(): DayBlock {
  return { date: "", territoryId: "", doctorIds: [] };
}

function getRoleFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

function formatDateBadge(dateStr: string): { label: string; isSunday: boolean } {
  if (!dateStr) return { label: "", isSunday: false };
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return { label: "", isSunday: false };
  const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = d.getDate();
  const monthName = d.toLocaleDateString("en-US", { month: "short" });
  const isSunday = d.getDay() === 0;
  return {
    label: `${dayOfWeek}, ${dayNum} ${monthName}`,
    isSunday,
  };
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
  const [role, setRole] = useState<string | null>(null);
  const [month, setMonth] = useState(() => searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctorsByTerritory, setDoctorsByTerritory] = useState<Record<string, Doctor[]>>({});
  const [loadingDoctorsFor, setLoadingDoctorsFor] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState<DayBlock[]>([emptyBlock()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-day search & filter states
  const [doctorSearch, setDoctorSearch] = useState<Record<number, string>>({});
  const [beatFilter, setBeatFilter] = useState<Record<number, string>>({});

  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

  const isAdmin = role === "ADMIN" || role === "MD";

  useEffect(() => {
    apiClient
      .get("/api/mr/territories")
      .then((res) => setTerritories(res.data.data.territories))
      .catch((err) => console.error("Failed to load territories:", err));
  }, []);

  const loadDoctors = async (territoryId: string) => {
    if (!territoryId || doctorsByTerritory[territoryId]) return;
    setLoadingDoctorsFor((prev) => ({ ...prev, [territoryId]: true }));
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "DOCTOR", territoryId, limit: 300 },
      });
      const doctors: Doctor[] = (res.data.data.entities || []).map((e: any) => ({
        id: e.id,
        name: e.fullName || e.name,
        beatName: e.beatName,
        subArea: e.subArea,
        clinicAddress: e.clinicAddress,
        primarySpecialty: e.primarySpecialty,
        dpsTier: e.dpsTier,
      }));
      setDoctorsByTerritory((prev) => ({ ...prev, [territoryId]: doctors }));
    } catch (err) {
      console.error("Failed to load doctors:", err);
    } finally {
      setLoadingDoctorsFor((prev) => ({ ...prev, [territoryId]: false }));
    }
  };

  const updateDay = (index: number, patch: Partial<DayBlock>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleTerritoryChange = (index: number, territoryId: string) => {
    updateDay(index, { territoryId, doctorIds: [] });
    // Reset filters for this day
    setDoctorSearch((prev) => ({ ...prev, [index]: "" }));
    setBeatFilter((prev) => ({ ...prev, [index]: "ALL" }));
    if (territoryId) {
      loadDoctors(territoryId);
    }
  };

  const toggleDoctor = (index: number, doctorId: string) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const has = d.doctorIds.includes(doctorId);
        return {
          ...d,
          doctorIds: has ? d.doctorIds.filter((id) => id !== doctorId) : [...d.doctorIds, doctorId],
        };
      })
    );
  };

  const clearDoctorsForDay = (index: number) => {
    updateDay(index, { doctorIds: [] });
  };

  const selectAllFilteredDoctors = (index: number, doctorIdsToAdd: string[]) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const merged = Array.from(new Set([...d.doctorIds, ...doctorIdsToAdd]));
        return { ...d, doctorIds: merged };
      })
    );
  };

  const copyCallsFromPreviousDay = (targetIndex: number) => {
    if (targetIndex <= 0) return;
    const prevDay = days[targetIndex - 1];
    if (!prevDay) return;
    updateDay(targetIndex, {
      territoryId: prevDay.territoryId,
      doctorIds: [...prevDay.doctorIds],
    });
    if (prevDay.territoryId) {
      loadDoctors(prevDay.territoryId);
    }
  };

  const addDay = () => {
    // Intelligently default date to day after last day's date
    const lastDay = days[days.length - 1];
    let nextDate = "";
    if (lastDay?.date) {
      const d = new Date(lastDay.date);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split("T")[0];
    }
    setDays((prev) => [...prev, { date: nextDate, territoryId: lastDay?.territoryId || "", doctorIds: [] }]);
    if (lastDay?.territoryId) {
      loadDoctors(lastDay.territoryId);
    }
  };

  const removeDay = (index: number) => {
    setDays((prev) => prev.filter((_, i) => i !== index));
  };

  // Plan-Level Metrics & Summary
  const validDays = useMemo(() => days.filter((d) => d.date && d.territoryId), [days]);
  const totalCallsPlanned = useMemo(() => days.reduce((acc, d) => acc + d.doctorIds.length, 0), [days]);
  const allSelectedDoctorIds = useMemo(() => days.flatMap((d) => d.doctorIds), [days]);
  const uniqueDoctorsCovered = useMemo(() => new Set(allSelectedDoctorIds).size, [allSelectedDoctorIds]);
  const avgCallsPerDay = useMemo(
    () => (validDays.length > 0 ? (totalCallsPlanned / validDays.length).toFixed(1) : "0.0"),
    [validDays, totalCallsPlanned]
  );

  const handleSubmit = async () => {
    setError(null);

    if (!month) return setError("Please select a target planning month.");
    if (validDays.length === 0) return setError("Please configure at least one day with a date and territory.");

    const daysWithZeroDoctors = validDays.filter((d) => d.doctorIds.length === 0);
    if (daysWithZeroDoctors.length > 0) {
      const confirmed = window.confirm(
        `Warning: ${daysWithZeroDoctors.length} day(s) have 0 planned doctors. Do you want to submit the plan anyway?`
      );
      if (!confirmed) return;
    }

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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-slate-900">New Tour Plan</h1>
            {isAdmin ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                Executive Mode (Direct Authorization)
              </span>
            ) : (
              <span className="bg-sky-100 text-sky-800 text-xs px-3 py-1 rounded-full font-bold border border-sky-200">
                Representative Planning Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Build your monthly doctor call roadmap. Select each territory and review doctor call counts before final submission.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <Calendar size={16} className="text-slate-500" />
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Month:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent font-bold text-slate-900 text-sm focus:outline-hidden"
          />
        </div>
      </div>

      {/* Critical Post-Approval Locking Alert Banner */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <Lock size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-900">
          <strong className="font-bold block text-sm mb-0.5">
            Strict Post-Approval Lock Policy
          </strong>
          Once this Tour Plan is submitted and approved by executive management,{" "}
          <strong>no modifications will be permitted</strong> on territory routes or planned doctors.
          Ensure that the selected doctors and call counts below represent your exact scheduled itinerary before submitting.
        </div>
      </div>

      {/* Live Plan-Level Summary Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Days Configured</span>
          <span className="text-xl font-bold text-slate-900">{validDays.length} Days</span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Across {month}</span>
        </div>

        <div className="bg-sky-50/70 rounded-xl p-3 border border-sky-100">
          <span className="text-[10px] uppercase font-bold text-sky-600 block">Total Doctor Calls</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-sky-950">{totalCallsPlanned}</span>
            <span className="text-xs text-sky-700 font-semibold">calls selected</span>
          </div>
          <span className="text-[11px] text-sky-600 block mt-0.5">Live selection tally</span>
        </div>

        <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">Unique Doctors</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-950">{uniqueDoctorsCovered}</span>
            <span className="text-xs text-emerald-700 font-semibold">physicians</span>
          </div>
          <span className="text-[11px] text-emerald-600 block mt-0.5">Coverage reach</span>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Call Pace</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">{avgCallsPerDay}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                Number(avgCallsPerDay) >= 8
                  ? "bg-emerald-100 text-emerald-800"
                  : Number(avgCallsPerDay) >= 5
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {Number(avgCallsPerDay) >= 8 ? "Optimal" : Number(avgCallsPerDay) >= 5 ? "Moderate" : "Below Target"}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Standard: 8-10 calls/day</span>
        </div>
      </div>

      {/* Daily Configuration Stack */}
      <div className="space-y-5">
        {days.map((day, index) => {
          const dateBadge = formatDateBadge(day.date);
          const territory = territories.find((t) => t.id === day.territoryId);
          const territoryDoctors = doctorsByTerritory[day.territoryId] || [];
          const isLoadingDoctors = loadingDoctorsFor[day.territoryId] || false;

          // Unique beats in this territory
          const beatsInTerritory: string[] = Array.from(
            new Set(
              territoryDoctors
                .map((d) => d.beatName?.split(":")[0]?.trim())
                .filter((b): b is string => Boolean(b))
            )
          );

          // Filtering doctors by search query and beat
          const activeSearch = (doctorSearch[index] || "").toLowerCase().trim();
          const activeBeat = beatFilter[index] || "ALL";

          const filteredDoctors = territoryDoctors.filter((doc) => {
            const matchesSearch =
              !activeSearch ||
              doc.name.toLowerCase().includes(activeSearch) ||
              (doc.beatName && doc.beatName.toLowerCase().includes(activeSearch)) ||
              (doc.clinicAddress && doc.clinicAddress.toLowerCase().includes(activeSearch)) ||
              (doc.primarySpecialty && doc.primarySpecialty.toLowerCase().includes(activeSearch));

            const matchesBeat =
              activeBeat === "ALL" ||
              (doc.beatName && doc.beatName.split(":")[0]?.trim() === activeBeat);

            return matchesSearch && matchesBeat;
          });

          const selectedDoctorsList = day.doctorIds
            .map((docId) => territoryDoctors.find((d) => d.id === docId))
            .filter(Boolean) as Doctor[];

          return (
            <div
              key={index}
              className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                day.doctorIds.length > 0 ? "border-slate-300 ring-1 ring-slate-100" : "border-slate-200"
              }`}
            >
              {/* Card Header Bar */}
              <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Day {index + 1} Schedule</h3>
                      {dateBadge.label && (
                        <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md">
                          {dateBadge.label}
                        </span>
                      )}
                      {dateBadge.isSunday && (
                        <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle size={11} /> Sunday Weekly Off
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side Header Metrics & Actions */}
                <div className="flex items-center gap-2.5">
                  {/* Selected Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl font-bold border transition-colors ${
                      day.doctorIds.length >= 8
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : day.doctorIds.length > 0
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <CheckCircle2 size={13} className={day.doctorIds.length > 0 ? "text-sky-600" : "text-slate-400"} />
                    {day.doctorIds.length} Doctor{day.doctorIds.length === 1 ? "" : "s"} Selected
                  </span>

                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => copyCallsFromPreviousDay(index)}
                      className="inline-flex items-center gap-1 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                      title="Copy territory and calls from previous day"
                    >
                      <Copy size={12} /> Copy Day {index}
                    </button>
                  )}

                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(index)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                      title="Remove day"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                {/* Inputs: Date & Territory */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Visit Date
                    </label>
                    <input
                      type="date"
                      value={day.date}
                      onChange={(e) => updateDay(index, { date: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Assigned Field Territory
                    </label>
                    <SearchableSelect
                      value={day.territoryId}
                      onChange={(e) => handleTerritoryChange(index, e.target.value)}
                      placeholder="Select Territory..."
                      searchPlaceholder="Search territory..."
                    >
                      <option value="">Select Territory...</option>
                      {territories.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.zone ? `(${t.zone})` : ""}
                        </option>
                      ))}
                    </SearchableSelect>
                  </div>
                </div>

                {/* Territory Doctor Selector Section */}
                {day.territoryId && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {/* TRAY 1: Currently Selected Doctors Itinerary */}
                    {day.doctorIds.length > 0 && (
                      <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                              <Stethoscope size={14} className="text-sky-600" />
                              Selected Call Itinerary ({day.doctorIds.length} doctors)
                            </span>
                            <span className="text-[11px] text-sky-700 font-medium">
                              {day.doctorIds.length >= 8
                                ? "✓ Target (8-10 calls) achieved"
                                : `Target: ${8 - day.doctorIds.length} more needed`}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => clearDoctorsForDay(index)}
                            className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                          >
                            Clear Day Selections ({day.doctorIds.length})
                          </button>
                        </div>

                        {/* Numbered Itinerary Chips */}
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                          {selectedDoctorsList.map((doc, docIdx) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center gap-1.5 bg-white border border-sky-300 text-sky-950 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-2xs group"
                            >
                              <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {docIdx + 1}
                              </span>
                              <span>{doc.name}</span>
                              {doc.beatName && (
                                <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-bold">
                                  {doc.beatName.split(":")[0]}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleDoctor(index, doc.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors ml-1 p-0.5 rounded"
                                title="Remove doctor call"
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filter & Search Bar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder={`Search ${territoryDoctors.length} doctors in ${territory?.name || "territory"}...`}
                            value={doctorSearch[index] || ""}
                            onChange={(e) => setDoctorSearch((prev) => ({ ...prev, [index]: e.target.value }))}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => selectAllFilteredDoctors(index, filteredDoctors.map((d) => d.id))}
                          className="shrink-0 text-xs font-bold text-sky-700 hover:text-sky-800 bg-white hover:bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <CheckCheck size={14} /> Select All Filtered ({filteredDoctors.length})
                        </button>
                      </div>

                      {/* Beat Filter Pills */}
                      {beatsInTerritory.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Beats:</span>
                          <button
                            type="button"
                            onClick={() => setBeatFilter((prev) => ({ ...prev, [index]: "ALL" }))}
                            className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                              activeBeat === "ALL"
                                ? "bg-slate-800 text-white"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            All ({territoryDoctors.length})
                          </button>
                          {beatsInTerritory.map((beat) => {
                            const count = territoryDoctors.filter((d) => d.beatName?.startsWith(beat)).length;
                            const isCurrent = activeBeat === beat;
                            return (
                              <button
                                key={beat}
                                type="button"
                                onClick={() => setBeatFilter((prev) => ({ ...prev, [index]: beat }))}
                                className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                                  isCurrent
                                    ? "bg-sky-700 text-white"
                                    : "bg-white text-sky-900 border border-sky-200 hover:bg-sky-50"
                                }`}
                              >
                                {beat} ({count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Available Doctors Selection Pills Grid */}
                    {isLoadingDoctors ? (
                      <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-sky-600" />
                        <span>Loading doctors for {territory?.name}...</span>
                      </div>
                    ) : filteredDoctors.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No doctors match the search filter in this territory.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        {filteredDoctors.map((doc) => {
                          const isSelected = day.doctorIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => toggleDoctor(index, doc.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                                isSelected
                                  ? "bg-sky-600 text-white border-sky-700 shadow-sm ring-1 ring-sky-400"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50"
                              }`}
                            >
                              <span className={isSelected ? "text-white" : "text-slate-400"}>
                                {isSelected ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} />}
                              </span>
                              <span>{doc.name}</span>
                              {doc.beatName && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                    isSelected ? "bg-sky-700 text-white" : "bg-sky-100 text-sky-800"
                                  }`}
                                >
                                  {doc.beatName.split(":")[0]}
                                </span>
                              )}
                              {doc.dpsTier && (
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                    isSelected ? "bg-sky-800 text-sky-100" : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {doc.dpsTier}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Day Button */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={addDay}
          className="flex items-center gap-2 text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2.5 rounded-xl text-sm font-bold border border-sky-200 transition-colors shadow-2xs"
        >
          <Plus size={16} /> Add Day {days.length + 1}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 font-bold shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Plan Summary: {totalCallsPlanned} Doctor Calls across {validDays.length} Days
            </span>
            <span className="text-[11px] text-slate-500">
              {uniqueDoctorsCovered} unique doctors covered. Average: {avgCallsPerDay} calls/day.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => router.push("/tour-plans")}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Saving Plan...
              </>
            ) : isAdmin ? (
              <>
                <Check size={14} /> Save & Deploy Tour Plan (Approved)
              </>
            ) : (
              <>
                <ArrowRight size={14} /> Submit for Approval
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
