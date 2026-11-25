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
  Store,
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
import { SearchableSelect, type SearchableOption } from "@/components/searchable-select";

interface Territory {
  id: string;
  name: string;
  region?: string;
  zone?: string;
  _count?: {
    doctors?: number;
    chemists?: number;
  };
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

interface Chemist {
  id: string;
  name: string;
  beatName?: string;
  subArea?: string;
  address?: string;
  mobile?: string;
}

interface DayBlock {
  date: string;
  territoryId: string;
  doctorIds: string[];
  chemistIds: string[];
}

interface SubmittedScheduleSummary {
  tourPlanId: string;
  status: string;
  date: string;
  territoryName: string;
  doctors: Doctor[];
  chemists: Chemist[];
  totalDoctorCalls: number;
  totalChemistCalls: number;
  beats: string[];
}

function defaultInitialDay(monthStr: string, explicitDate?: string | null): DayBlock {
  if (explicitDate) return { date: explicitDate, territoryId: "", doctorIds: [], chemistIds: [] };
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (todayStr.startsWith(monthStr)) {
    return { date: todayStr, territoryId: "", doctorIds: [], chemistIds: [] };
  }
  return { date: `${monthStr}-01`, territoryId: "", doctorIds: [], chemistIds: [] };
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
  const initialDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const initialMonth = searchParams.get("month") ?? initialDate.slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loadingTerritories, setLoadingTerritories] = useState(true);
  const [doctorsByTerritory, setDoctorsByTerritory] = useState<Record<string, Doctor[]>>({});
  const [loadingDoctorsFor, setLoadingDoctorsFor] = useState<Record<string, boolean>>({});
  const [chemistsByTerritory, setChemistsByTerritory] = useState<Record<string, Chemist[]>>({});
  const [loadingChemistsFor, setLoadingChemistsFor] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState<DayBlock[]>([defaultInitialDay(initialMonth, initialDate)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<SubmittedScheduleSummary | null>(null);

  // Per-day search & filter states
  const [doctorSearch, setDoctorSearch] = useState<Record<number, string>>({});
  const [beatFilter, setBeatFilter] = useState<Record<number, string>>({});
  const [chemistSearch, setChemistSearch] = useState<Record<number, string>>({});
  const [chemistBeatFilter, setChemistBeatFilter] = useState<Record<number, string>>({});

  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

  const isAdmin = role === "ADMIN" || role === "MD";

  useEffect(() => {
    setLoadingTerritories(true);
    apiClient
      .get("/api/mr/territories")
      .then((res) => {
        const list = res.data?.data?.territories || res.data?.territories || [];
        setTerritories(list);
      })
      .catch((err) => console.error("Failed to load territories:", err))
      .finally(() => setLoadingTerritories(false));
  }, []);

  const territoryOptions: SearchableOption[] = useMemo(() => {
    return territories.map((t) => ({
      value: t.id,
      label: t.name,
      sublabel: [t.zone, t.region].filter(Boolean).join(" • "),
      badge:
        t._count?.doctors !== undefined || t._count?.chemists !== undefined
          ? `${t._count?.doctors ?? 0} Drs • ${t._count?.chemists ?? 0} Chems`
          : undefined,
    }));
  }, [territories]);

  const loadDoctors = async (territoryId: string) => {
    if (!territoryId || doctorsByTerritory[territoryId]) return;
    setLoadingDoctorsFor((prev) => ({ ...prev, [territoryId]: true }));
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "DOCTOR", territoryId, limit: 300 },
      });
      const rawEntities = res.data?.data?.entities || res.data?.entities || [];
      const doctors: Doctor[] = rawEntities.map((e: any) => ({
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

  const loadChemists = async (territoryId: string) => {
    if (!territoryId || chemistsByTerritory[territoryId]) return;
    setLoadingChemistsFor((prev) => ({ ...prev, [territoryId]: true }));
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "CHEMIST", territoryId, limit: 300 },
      });
      const rawEntities = res.data?.data?.entities || res.data?.entities || [];
      const chemists: Chemist[] = rawEntities.map((e: any) => ({
        id: e.id,
        name: e.name,
        beatName: e.beatName,
        subArea: e.subArea,
        address: e.address,
        mobile: e.mobile,
      }));
      setChemistsByTerritory((prev) => ({ ...prev, [territoryId]: chemists }));
    } catch (err) {
      console.error("Failed to load chemists:", err);
    } finally {
      setLoadingChemistsFor((prev) => ({ ...prev, [territoryId]: false }));
    }
  };

  const updateDay = (index: number, patch: Partial<DayBlock>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleTerritoryChange = (index: number, territoryId: string) => {
    updateDay(index, { territoryId, doctorIds: [], chemistIds: [] });
    // Reset filters for this day
    setDoctorSearch((prev) => ({ ...prev, [index]: "" }));
    setBeatFilter((prev) => ({ ...prev, [index]: "ALL" }));
    setChemistSearch((prev) => ({ ...prev, [index]: "" }));
    setChemistBeatFilter((prev) => ({ ...prev, [index]: "ALL" }));
    if (territoryId) {
      loadDoctors(territoryId);
      loadChemists(territoryId);
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

  const toggleChemist = (index: number, chemistId: string) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const has = d.chemistIds.includes(chemistId);
        return {
          ...d,
          chemistIds: has ? d.chemistIds.filter((id) => id !== chemistId) : [...d.chemistIds, chemistId],
        };
      })
    );
  };

  const clearChemistsForDay = (index: number) => {
    updateDay(index, { chemistIds: [] });
  };

  const selectAllFilteredChemists = (index: number, chemistIdsToAdd: string[]) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const merged = Array.from(new Set([...d.chemistIds, ...chemistIdsToAdd]));
        return { ...d, chemistIds: merged };
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
      chemistIds: [...prevDay.chemistIds],
    });
    if (prevDay.territoryId) {
      loadDoctors(prevDay.territoryId);
      loadChemists(prevDay.territoryId);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    // If only 1 day configured and no stops selected yet, keep Day 1 aligned with the new month
    setDays((prev) => {
      if (prev.length === 1 && prev[0].doctorIds.length === 0 && prev[0].chemistIds.length === 0) {
        return [{ ...prev[0], date: `${newMonth}-01` }];
      }
      return prev;
    });
  };

  const addDay = () => {
    // N+1 progression: advance +1 calendar day (skipping Sunday)
    const lastDay = days[days.length - 1];
    let nextDate = "";
    if (lastDay?.date) {
      const d = new Date(`${lastDay.date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() === 0) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
      nextDate = d.toISOString().split("T")[0];
    }
    setDays((prev) => [
      ...prev,
      { date: nextDate, territoryId: lastDay?.territoryId || "", doctorIds: [], chemistIds: [] },
    ]);
    if (lastDay?.territoryId) {
      loadDoctors(lastDay.territoryId);
      loadChemists(lastDay.territoryId);
    }
  };

  const removeDay = (index: number) => {
    setDays((prev) => prev.filter((_, i) => i !== index));
  };

  // Plan-Level Metrics & Summary
  const validDays = useMemo(() => days.filter((d) => d.date && d.territoryId), [days]);
  const totalDoctorCallsPlanned = useMemo(() => days.reduce((acc, d) => acc + d.doctorIds.length, 0), [days]);
  const totalChemistCallsPlanned = useMemo(() => days.reduce((acc, d) => acc + d.chemistIds.length, 0), [days]);
  const totalCallsPlanned = totalDoctorCallsPlanned + totalChemistCallsPlanned;
  const allSelectedDoctorIds = useMemo(() => days.flatMap((d) => d.doctorIds), [days]);
  const allSelectedChemistIds = useMemo(() => days.flatMap((d) => d.chemistIds), [days]);
  const uniqueDoctorsCovered = useMemo(() => new Set(allSelectedDoctorIds).size, [allSelectedDoctorIds]);
  const uniqueChemistsCovered = useMemo(() => new Set(allSelectedChemistIds).size, [allSelectedChemistIds]);
  const avgCallsPerDay = useMemo(
    () => (validDays.length > 0 ? (totalCallsPlanned / validDays.length).toFixed(1) : "0.0"),
    [validDays, totalCallsPlanned]
  );

  const handleSubmit = async () => {
    setError(null);

    if (!month) return setError("Please select a target planning month.");
    if (validDays.length === 0) return setError("Please configure at least one day with a date and territory.");

    const emptyDays = validDays.filter((d) => d.doctorIds.length === 0 && d.chemistIds.length === 0);
    if (emptyDays.length > 0) {
      const confirmed = window.confirm(
        `Warning: ${emptyDays.length} day(s) have 0 planned doctors or chemists. Do you want to submit anyway?`
      );
      if (!confirmed) return;
    }

    const payload = {
      month: new Date(`${month}-01`),
      days: validDays.flatMap((d) => {
        const docEntries = d.doctorIds.map((doctorId) => ({
          date: new Date(d.date),
          territoryId: d.territoryId,
          plannedDoctorId: doctorId,
        }));
        const chemEntries = d.chemistIds.map((chemistId) => ({
          date: new Date(d.date),
          territoryId: d.territoryId,
          plannedChemistId: chemistId,
        }));
        const combined = [...docEntries, ...chemEntries];
        return combined.length > 0 ? combined : [{ date: new Date(d.date), territoryId: d.territoryId }];
      }),
    };

    setSubmitting(true);
    try {
      const res = await apiClient.post("/api/sfa/tour-plan/submit", payload);
      const returnedPlanId = res.data?.data?.tourPlanId;
      const returnedStatus = res.data?.data?.status || (isAdmin ? "APPROVED" : "PENDING_ASM");

      const targetDay = validDays[0];
      const targetTerritory = territories.find((t) => t.id === targetDay?.territoryId);
      const targetDoctors = (doctorsByTerritory[targetDay?.territoryId] || []).filter((d) =>
        targetDay?.doctorIds.includes(d.id)
      );
      const targetChemists = (chemistsByTerritory[targetDay?.territoryId] || []).filter((c) =>
        targetDay?.chemistIds.includes(c.id)
      );

      setSubmittedSummary({
        tourPlanId: returnedPlanId,
        status: returnedStatus,
        date: targetDay?.date || initialDate,
        territoryName: targetTerritory?.name || "Field Territory",
        doctors: targetDoctors,
        chemists: targetChemists,
        totalDoctorCalls: totalDoctorCallsPlanned,
        totalChemistCalls: totalChemistCallsPlanned,
        beats: Array.from(
          new Set(
            [...targetDoctors.map((d) => d.beatName?.split(":")[0]?.trim()), ...targetChemists.map((c) => c.beatName?.split(":")[0]?.trim() || c.subArea)]
              .filter(Boolean) as string[]
          )
        ),
      });
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
            <h1 className="text-2xl font-display font-bold text-slate-900">Plan Field Tour (N+1 Schedule)</h1>
            {isAdmin ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                Executive Mode (Direct Authorization)
              </span>
            ) : (
              <span className="bg-sky-100 text-sky-800 text-xs px-3 py-1 rounded-full font-bold border border-sky-200">
                Progressive N+1 Call Schedule
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Build your N+1 progressive schedule day-by-day — select multiple Doctors and Retail Chemists per scheduled day.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <Calendar size={16} className="text-slate-500" />
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Month:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-transparent font-bold text-slate-900 text-sm focus:outline-hidden"
          />
        </div>
      </div>

      {/* Daily Planning Policy Notice */}
      <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <Sparkles size={18} className="text-sky-600 mt-0.5 shrink-0" />
        <div className="text-xs text-sky-900">
          <strong className="font-bold block text-sm mb-0.5">
            N+1 Progressive Field Planning (Doctors + Retail Chemists)
          </strong>
          Start from Day 1 and add Day N+1 whenever ready. Pick your territory, then select multiple Doctors and Chemists together for that day&apos;s beat coverage.
        </div>
      </div>

      {submittedSummary ? (
        <div className="space-y-6">
          {/* Success & Approval Banner */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-display font-bold text-emerald-950">
                    N+1 Field Schedule Successfully Saved
                  </h2>
                  <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-xs">
                    {submittedSummary.status === "APPROVED" ? "Approved" : "Submitted for Approval"}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  {submittedSummary.status === "APPROVED"
                    ? "Your scheduled Doctor + Chemist calls are live for execution and Excel printing."
                    : "Your Doctor + Chemist schedule has been submitted for ASM/Admin approval."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => router.push(`/tour-plans?tab=DAILY_SCHEDULE&date=${submittedSummary.date}`)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <span>Open Field Schedule</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Schedule Summary Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Target Field Schedule Summary
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {formatDateBadge(submittedSummary.date).label || submittedSummary.date} — {submittedSummary.territoryName}
                </h3>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Planned Stops</span>
                  <span className="text-base font-bold text-sky-900">
                    {submittedSummary.totalDoctorCalls} Doctor(s) + {submittedSummary.totalChemistCalls} Chemist(s)
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Beats Covered</span>
                  <span className="text-base font-bold text-slate-800">
                    {submittedSummary.beats.length > 0 ? submittedSummary.beats.join(", ") : "Main Beat"}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                    submittedSummary.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                  }`}>
                    {submittedSummary.status === "APPROVED" ? "Approved" : "Submitted"}
                  </span>
                </div>
              </div>
            </div>

            {/* List of Scheduled Doctors */}
            {submittedSummary.doctors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Planned Doctor Calls ({submittedSummary.doctors.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {submittedSummary.doctors.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm truncate">{doc.name}</span>
                          {doc.beatName && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 shrink-0">
                              {doc.beatName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                          {doc.primarySpecialty && (
                            <span className="text-slate-600 font-medium">{doc.primarySpecialty}</span>
                          )}
                          {doc.subArea && (
                            <span className="text-slate-500">• {doc.subArea}</span>
                          )}
                          {doc.dpsTier && (
                            <span className="text-amber-700 font-semibold">• Tier: {doc.dpsTier}</span>
                          )}
                        </div>
                        {doc.clinicAddress && (
                          <div className="text-[11px] text-slate-400 truncate mt-1">
                            {doc.clinicAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List of Scheduled Chemists */}
            {submittedSummary.chemists.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  Planned Retail Chemist Calls ({submittedSummary.chemists.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {submittedSummary.chemists.map((chem, idx) => (
                    <div
                      key={chem.id}
                      className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm truncate">{chem.name}</span>
                          {(chem.beatName || chem.subArea) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 shrink-0">
                              {chem.beatName || chem.subArea}
                            </span>
                          )}
                        </div>
                        {chem.address && (
                          <div className="text-[11px] text-slate-500 truncate mt-1">{chem.address}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedSummary(null);
                  setDays([defaultInitialDay(month, initialDate)]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Plan Another Day
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/tour-plans")}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  All Tour Plans
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/tour-plans?tab=DAILY_SCHEDULE&date=${submittedSummary.date}`)}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <span>Start Field Calls & Print Excel</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Live Plan-Level Summary Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">N+1 Days Configured</span>
          <span className="text-xl font-bold text-slate-900">{validDays.length} Day{validDays.length === 1 ? "" : "s"}</span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Next: Day {days.length + 1} (+1)</span>
        </div>

        <div className="bg-sky-50/70 rounded-xl p-3 border border-sky-100">
          <span className="text-[10px] uppercase font-bold text-sky-600 block">Doctor Calls Planned</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-sky-950">{totalDoctorCallsPlanned}</span>
            <span className="text-xs text-sky-700 font-semibold">({uniqueDoctorsCovered} unique)</span>
          </div>
          <span className="text-[11px] text-sky-600 block mt-0.5">Physicians selected</span>
        </div>

        <div className="bg-purple-50/70 rounded-xl p-3 border border-purple-100">
          <span className="text-[10px] uppercase font-bold text-purple-600 block">Chemist Calls Planned</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-purple-950">{totalChemistCallsPlanned}</span>
            <span className="text-xs text-purple-700 font-semibold">({uniqueChemistsCovered} unique)</span>
          </div>
          <span className="text-[11px] text-purple-600 block mt-0.5">Retail chemists selected</span>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Combined Call Pace</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">{avgCallsPerDay}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                Number(avgCallsPerDay) >= 8
                  ? "bg-emerald-100 text-emerald-800"
                  : Number(avgCallsPerDay) >= 5
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              Stops / Day
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">{totalCallsPlanned} Doctors + Chemists</span>
        </div>
      </div>

      {/* Daily Configuration Stack */}
      <div className="space-y-5">
        {days.map((day, index) => {
          const dateBadge = formatDateBadge(day.date);
          const territory = territories.find((t) => t.id === day.territoryId);
          const territoryDoctors = doctorsByTerritory[day.territoryId] || [];
          const isLoadingDoctors = loadingDoctorsFor[day.territoryId] || false;
          const territoryChemists = chemistsByTerritory[day.territoryId] || [];
          const isLoadingChemists = loadingChemistsFor[day.territoryId] || false;

          // Unique beats in this territory
          const beatsInTerritory: string[] = Array.from(
            new Set(
              territoryDoctors
                .map((d) => d.beatName?.split(":")[0]?.trim())
                .filter((b): b is string => Boolean(b))
            )
          );

          // Unique chemist beats/subAreas in this territory
          const chemistBeatsInTerritory: string[] = Array.from(
            new Set(
              territoryChemists
                .map((c) => (c.beatName?.split(":")[0] || c.subArea)?.trim())
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

          // Filtering chemists by search query and beat/area
          const activeChemSearch = (chemistSearch[index] || "").toLowerCase().trim();
          const activeChemBeat = chemistBeatFilter[index] || "ALL";

          const filteredChemists = territoryChemists.filter((chem) => {
            const matchesSearch =
              !activeChemSearch ||
              chem.name.toLowerCase().includes(activeChemSearch) ||
              (chem.beatName && chem.beatName.toLowerCase().includes(activeChemSearch)) ||
              (chem.subArea && chem.subArea.toLowerCase().includes(activeChemSearch)) ||
              (chem.address && chem.address.toLowerCase().includes(activeChemSearch));

            const beatVal = (chem.beatName?.split(":")[0] || chem.subArea)?.trim();
            const matchesBeat = activeChemBeat === "ALL" || beatVal === activeChemBeat;

            return matchesSearch && matchesBeat;
          });

          const selectedDoctorsList = day.doctorIds
            .map((docId) => territoryDoctors.find((d) => d.id === docId))
            .filter(Boolean) as Doctor[];

          const selectedChemistsList = day.chemistIds
            .map((chemId) => territoryChemists.find((c) => c.id === chemId))
            .filter(Boolean) as Chemist[];

          return (
            <div
              key={index}
              style={{ zIndex: Math.max(1, 40 - index) }}
              className={`relative overflow-visible bg-white border rounded-2xl shadow-sm transition-all ${
                day.doctorIds.length + day.chemistIds.length > 0
                  ? "border-slate-300 ring-1 ring-slate-100"
                  : "border-slate-200"
              }`}
            >
              {/* Card Header Bar */}
              <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl font-bold border transition-colors ${
                      day.doctorIds.length > 0
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Stethoscope size={13} className={day.doctorIds.length > 0 ? "text-sky-600" : "text-slate-400"} />
                    {day.doctorIds.length} Doctor{day.doctorIds.length === 1 ? "" : "s"}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl font-bold border transition-colors ${
                      day.chemistIds.length > 0
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Store size={13} className={day.chemistIds.length > 0 ? "text-purple-600" : "text-slate-400"} />
                    {day.chemistIds.length} Chemist{day.chemistIds.length === 1 ? "" : "s"}
                  </span>

                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => copyCallsFromPreviousDay(index)}
                      className="inline-flex items-center gap-1 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
                      title="Copy territory, doctors, and chemists from previous day"
                    >
                      <Copy size={12} /> Copy Day {index}
                    </button>
                  )}

                  {days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(index)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remove day"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-5 rounded-b-2xl">
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
                      onValueChange={(val) => handleTerritoryChange(index, val)}
                      options={territoryOptions}
                      placeholder={loadingTerritories ? "Loading territories..." : "Select Territory..."}
                      searchPlaceholder="Search territory..."
                      disabled={loadingTerritories}
                      allowClear
                    />
                  </div>
                </div>

                {/* Territory Multi-Doctor & Multi-Chemist Selector Sections */}
                {day.territoryId && (
                  <div className="space-y-6 pt-2 border-t border-slate-100">
                    {/* SECTION 1: MULTI-DOCTOR SELECTOR */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                          <Stethoscope size={14} className="text-sky-600" />
                          <span>1. Select Multiple Doctors ({day.doctorIds.length} Selected)</span>
                        </h4>
                      </div>

                      {day.doctorIds.length > 0 && (
                        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-sky-950">
                              Selected Doctors Itinerary ({day.doctorIds.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => clearDoctorsForDay(index)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                            >
                              Clear Doctors ({day.doctorIds.length})
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                            {selectedDoctorsList.map((doc, docIdx) => (
                              <span
                                key={doc.id}
                                className="inline-flex items-center gap-1.5 bg-white border border-sky-300 text-sky-950 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-2xs"
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

                      {isLoadingDoctors ? (
                        <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-sky-600" />
                          <span>Loading doctors for {territory?.name}...</span>
                        </div>
                      ) : filteredDoctors.length === 0 ? (
                        <div className="py-5 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No doctors match the search filter in this territory.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
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

                    {/* SECTION 2: MULTI-CHEMIST SELECTOR */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                          <Store size={14} className="text-purple-600" />
                          <span>2. Select Multiple Retail Chemists ({day.chemistIds.length} Selected)</span>
                        </h4>
                      </div>

                      {day.chemistIds.length > 0 && (
                        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-purple-950">
                              Selected Retail Chemists Itinerary ({day.chemistIds.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => clearChemistsForDay(index)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                            >
                              Clear Chemists ({day.chemistIds.length})
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                            {selectedChemistsList.map((chem, chemIdx) => (
                              <span
                                key={chem.id}
                                className="inline-flex items-center gap-1.5 bg-white border border-purple-300 text-purple-950 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-2xs"
                              >
                                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                                  {chemIdx + 1}
                                </span>
                                <span>{chem.name}</span>
                                {(chem.beatName || chem.subArea) && (
                                  <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">
                                    {chem.beatName?.split(":")[0] || chem.subArea}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleChemist(index, chem.id)}
                                  className="text-slate-400 hover:text-red-600 transition-colors ml-1 p-0.5 rounded"
                                  title="Remove chemist call"
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-purple-50/30 border border-purple-200/80 rounded-xl p-3 space-y-2.5">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder={`Search ${territoryChemists.length} chemists in ${territory?.name || "territory"}...`}
                              value={chemistSearch[index] || ""}
                              onChange={(e) => setChemistSearch((prev) => ({ ...prev, [index]: e.target.value }))}
                              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-purple-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => selectAllFilteredChemists(index, filteredChemists.map((c) => c.id))}
                            className="shrink-0 text-xs font-bold text-purple-700 hover:text-purple-800 bg-white hover:bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                          >
                            <CheckCheck size={14} /> Select All Filtered ({filteredChemists.length})
                          </button>
                        </div>

                        {chemistBeatsInTerritory.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Beats / Area:</span>
                            <button
                              type="button"
                              onClick={() => setChemistBeatFilter((prev) => ({ ...prev, [index]: "ALL" }))}
                              className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                                activeChemBeat === "ALL"
                                  ? "bg-slate-800 text-white"
                                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              All ({territoryChemists.length})
                            </button>
                            {chemistBeatsInTerritory.map((beat) => {
                              const count = territoryChemists.filter(
                                (c) => (c.beatName?.split(":")[0] || c.subArea)?.trim() === beat
                              ).length;
                              const isCurrent = activeChemBeat === beat;
                              return (
                                <button
                                  key={beat}
                                  type="button"
                                  onClick={() => setChemistBeatFilter((prev) => ({ ...prev, [index]: beat }))}
                                  className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                                    isCurrent
                                      ? "bg-purple-700 text-white"
                                      : "bg-white text-purple-900 border border-purple-200 hover:bg-purple-50"
                                  }`}
                                >
                                  {beat} ({count})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {isLoadingChemists ? (
                        <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-purple-600" />
                          <span>Loading chemists for {territory?.name}...</span>
                        </div>
                      ) : filteredChemists.length === 0 ? (
                        <div className="py-5 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No chemists match the search filter in this territory.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto border border-purple-200/80 rounded-xl p-3 bg-purple-50/20">
                          {filteredChemists.map((chem) => {
                            const isSelected = day.chemistIds.includes(chem.id);
                            return (
                              <button
                                key={chem.id}
                                type="button"
                                onClick={() => toggleChemist(index, chem.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                                  isSelected
                                    ? "bg-purple-600 text-white border-purple-700 shadow-sm ring-1 ring-purple-400"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                                }`}
                              >
                                <span className={isSelected ? "text-white" : "text-slate-400"}>
                                  {isSelected ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} />}
                                </span>
                                <span>{chem.name}</span>
                                {(chem.beatName || chem.subArea) && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                      isSelected ? "bg-purple-700 text-white" : "bg-purple-100 text-purple-800"
                                    }`}
                                  >
                                    {chem.beatName?.split(":")[0] || chem.subArea}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons: Add Day N+1 */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addDay}
          className="flex items-center gap-2 text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2.5 rounded-xl text-sm font-bold border border-sky-200 transition-colors shadow-2xs cursor-pointer"
        >
          <Plus size={16} /> Add Day {days.length + 1} (N+1)
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
              N+1 Plan Summary: {totalDoctorCallsPlanned} Doctor(s) + {totalChemistCallsPlanned} Chemist(s) across {validDays.length} Day(s)
            </span>
            <span className="text-[11px] text-slate-500">
              {uniqueDoctorsCovered} unique doctors &amp; {uniqueChemistsCovered} unique chemists covered. Average: {avgCallsPerDay} stops/day.
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
                <RefreshCw size={14} className="animate-spin" /> Saving Schedule...
              </>
            ) : isAdmin ? (
              <>
                <Check size={14} /> Save & Deploy N+1 Schedule
              </>
            ) : (
              <>
                <ArrowRight size={14} /> Submit N+1 Schedule
              </>
            )}
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
