"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Activity,
  Crosshair,
  TrendingUp,
  LineChart,
  UserCheck,
  AlertCircle,
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Boxes,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface DoctorPot {
  id: string;
  fullName: string;
  primarySpecialty: string;
  secondarySpecialty?: string | null;
  qualification?: string | null;
  clinicAddress: string;
  subArea?: string | null;
  beatName?: string | null;
  dpsScore: number;
  dpsTier: "A+" | "A" | "B" | "C" | string | null;
  requiredMonthlyVisits: number;
  visitsThisMonth: number;
  totalVisits: number;
  visitGap: number;
  adherencePercentage: number;
  lastVisitDate: string | null;
  lastCqsScore: number | null;
  totalSamplesGiven: number;
  intelligenceScore?: number;
  patientFootfallDaily?: number;
  avgPrescriptionsDaily?: number;
  influencerLevel?: number;
  territory: { id: string; name: string; priority: number } | null;
  crmProfile?: {
    prescriptionPotential: number;
    competitorIntensity: number;
    salesConversionRate: number;
    sampleRoi: number;
    lastVisitDate: string | null;
  } | null;
}

interface DpsSummary {
  totalDoctors: number;
  avgDpsScore: number;
  tierCounts: {
    A_PLUS: number;
    A: number;
    B: number;
    C: number;
  };
  highPotentialCount: number;
}

export default function DoctorPotentialDashboard() {
  const [data, setData] = useState<DoctorPot[]>([]);
  const [summary, setSummary] = useState<DpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedBeat, setSelectedBeat] = useState<string>("ALL");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("ALL");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorPot | null>(null);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedTier !== "ALL") params.tier = selectedTier;
    if (selectedBeat !== "ALL") params.beatName = selectedBeat;
    if (selectedSpecialty !== "ALL") params.specialty = selectedSpecialty;
    if (search.trim()) params.search = search.trim();

    apiClient
      .get("/api/manager/doctors/dps", { params })
      .then((res) => {
        setData(res.data.data.doctors || []);
        if (res.data.data.summary) {
          setSummary(res.data.data.summary);
        }
      })
      .catch((err) => console.error("Failed to load DPS:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [selectedTier, selectedBeat, selectedSpecialty]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await apiClient.post("/api/manager/doctors/dps");
      load();
    } catch (err) {
      console.error("Failed to run analysis:", err);
    } finally {
      setRunning(false);
    }
  };

  // Derive unique beats and specialties for filter dropdowns
  const uniqueBeats = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.beatName) set.add(d.beatName);
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueSpecialties = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.primarySpecialty) set.add(d.primarySpecialty);
    });
    return Array.from(set).sort();
  }, [data]);

  const avgDps = summary?.avgDpsScore
    ? summary.avgDpsScore.toFixed(1)
    : data.length > 0
    ? (data.reduce((sum, d) => sum + d.dpsScore, 0) / data.length).toFixed(1)
    : "0.0";

  const highPotential = summary?.highPotentialCount ?? data.filter((d) => d.dpsTier === "A+" || d.dpsTier === "A").length;

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Multi-Agent Prescriber Intelligence &amp; DPS Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Doctor Potential &amp; Intelligence</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                Audited CRM
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Algorithmic prescriber classification, daily patient footfall &amp; Rx frequency analysis, call quality CQS correlation, and beat territory visit adherence.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={runAnalysis}
              disabled={running}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <BrainCircuit size={15} className={running ? "animate-spin" : ""} />
              {running ? "Scoring Doctors..." : "Recalculate DPS Engine"}
            </button>
            <button
              onClick={() => load()}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <Activity size={15} className={loading ? "animate-spin text-indigo-400" : ""} />
            </button>
          </div>
        </div>

        {/* ── 4 KPI TILES ────────────────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-indigo-800/40 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Prescribers
            </span>
            <span className="text-2xl font-black text-white mt-1 block">
              {summary?.totalDoctors ?? data.length}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Cataloged in field beats</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              High-Potential (A+/A)
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">
              {highPotential}
            </span>
            <span className="text-[10px] text-emerald-400/80 mt-0.5 block">Priority conversion targets</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Average DPS Score
            </span>
            <span className="text-2xl font-black text-indigo-300 mt-1 block">
              {avgDps} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </span>
            <span className="text-[10px] text-indigo-300/80 mt-0.5 block">Multi-agent weighted index</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Core Tier B Accounts
            </span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">
              {summary?.tierCounts.B ?? data.filter((d) => d.dpsTier === "B").length}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">4 monthly visits required</span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Tier Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 w-full lg:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tier:</span>
            {[
              { id: "ALL", label: "All Tiers" },
              { id: "A", label: "Tier A (High Potential)" },
              { id: "B", label: "Tier B (Core)" },
              { id: "C", label: "Tier C (Secondary)" },
              { id: "GAPS", label: "⚠️ Overdue Visit Gaps" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTier(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedTier === t.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Beat and Specialty Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {uniqueBeats.length > 0 && (
              <select
                value={selectedBeat}
                onChange={(e) => setSelectedBeat(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[220px] truncate"
              >
                <option value="ALL">All Beat Territories</option>
                {uniqueBeats.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {uniqueSpecialties.length > 0 && (
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate"
              >
                <option value="ALL">All Specialties</option>
                {uniqueSpecialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Instant Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prescriber by doctor name, clinic address, specialty, locality, or beat..."
            className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── MAIN CONTENT GRID ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Intelligence Data Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <LineChart size={16} className="text-indigo-600" />
                <span>Doctor Potential Intelligence Table</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                  {data.length} Doctors
                </span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Doctor / Specialty</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Beat &amp; Locality</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">DPS Score</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Footfall / Rx</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Adherence</th>
                    <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                        <Activity className="h-6 w-6 animate-spin text-indigo-500 mx-auto mb-2" />
                        Evaluating doctor potential scores and field visit linkage...
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400 font-medium">
                        No doctors match the selected search and tier filters.
                      </td>
                    </tr>
                  ) : (
                    data.map((doc) => {
                      const tierColor =
                        doc.dpsTier === "A+"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : doc.dpsTier === "A"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : doc.dpsTier === "B"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-600 border-slate-300";

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-start gap-2">
                              <span className="p-1 rounded-md bg-indigo-50 text-indigo-600 mt-0.5">
                                <Stethoscope className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 block">{doc.fullName}</span>
                                <span className="text-[10px] text-slate-500 block">
                                  {doc.primarySpecialty}
                                  {doc.qualification ? ` · ${doc.qualification}` : ""}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 truncate max-w-[190px]">
                              {doc.beatName || "Beat Not Mapped"}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 flex items-center gap-1">
                              <MapPin size={10} className="text-emerald-500" />
                              {doc.subArea || doc.clinicAddress}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${tierColor}`}>
                                {doc.dpsTier || "B"}
                              </span>
                              <span className="font-black text-slate-800 text-xs">
                                {doc.dpsScore}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[11px] font-semibold text-slate-800 block">
                              {doc.patientFootfallDaily ?? 35} pts/day
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {doc.avgPrescriptionsDaily ?? 20} Rx daily
                            </span>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-600 font-bold">
                                <span>
                                  {doc.visitsThisMonth} / {doc.requiredMonthlyVisits}
                                </span>
                                <span>{doc.adherencePercentage}%</span>
                              </div>
                              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    doc.adherencePercentage >= 100
                                      ? "bg-emerald-500"
                                      : doc.adherencePercentage >= 50
                                      ? "bg-indigo-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(doc.adherencePercentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoctor(doc);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs inline-flex items-center gap-0.5 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                            >
                              Inspect <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: AI Recommended Detailing Strategy */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BrainCircuit size={16} className="text-indigo-600" />
              <span>AI Prescriber Detailing Queue</span>
            </h2>
            <p className="text-xs text-slate-500">
              Immediate recommendations generated by linking prescription volume and call gaps.
            </p>

            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {data.slice(0, 8).map((doc) => {
                const gap = doc.visitGap;
                const isOverdue = gap > 0;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{doc.fullName}</h4>
                        <span className="text-[10px] text-slate-500 block">
                          {doc.primarySpecialty} · {doc.subArea || "Local Clinic"}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                          doc.dpsTier === "A" || doc.dpsTier === "A+"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Tier {doc.dpsTier}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-650 mt-2 leading-snug">
                      {isOverdue
                        ? `Overdue by ${gap} call(s). Target: ${doc.requiredMonthlyVisits} monthly calls. Recommend scheduling detailing call.`
                        : `Monthly requirement of ${doc.requiredMonthlyVisits} calls fulfilled. Schedule follow-up for new secondary order.`}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">
                        Last visit:{" "}
                        {doc.lastVisitDate
                          ? new Date(doc.lastVisitDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : "None"}
                      </span>
                      <Link
                        href="/tour-plans/new"
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Add to Tour Plan →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE PRESCRIBER AUDIT MODAL ───────────────────────── */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setSelectedDoctor(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900">{selectedDoctor.fullName}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Tier {selectedDoctor.dpsTier || "B"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedDoctor.primarySpecialty} · {selectedDoctor.qualification || "Registered HCP"}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} className="text-emerald-500" />
                  {selectedDoctor.clinicAddress} ({selectedDoctor.beatName})
                </p>
              </div>

              <button
                onClick={() => setSelectedDoctor(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">DPS Score</span>
                <span className="text-xl font-black text-indigo-700">{selectedDoctor.dpsScore}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Patient Footfall</span>
                <span className="text-xl font-black text-slate-900">
                  {selectedDoctor.patientFootfallDaily ?? 35} <span className="text-xs font-normal">/day</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Rx Frequency</span>
                <span className="text-xl font-black text-slate-900">
                  {selectedDoctor.avgPrescriptionsDaily ?? 20} <span className="text-xs font-normal">/day</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Adherence</span>
                <span className="text-xl font-black text-emerald-600">{selectedDoctor.adherencePercentage}%</span>
              </div>
            </div>

            {/* Prescriber Intelligence Analysis */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Prescriber Intelligence &amp; Detailing Audit
              </h4>
              <div className="border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs text-slate-650 bg-slate-50/50">
                <div className="flex justify-between">
                  <span>Territory Priority Factor:</span>
                  <span className="font-bold text-slate-800">
                    {selectedDoctor.territory?.priority === 2 ? "High Priority (Factor 2)" : "Standard Priority (Factor 1)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Required Visits:</span>
                  <span className="font-bold text-slate-800">{selectedDoctor.requiredMonthlyVisits} calls/month</span>
                </div>
                <div className="flex justify-between">
                  <span>Visits Completed This Month:</span>
                  <span className="font-bold text-indigo-600">{selectedDoctor.visitsThisMonth} calls</span>
                </div>
                <div className="flex justify-between">
                  <span>All-Time Detailing Interactions:</span>
                  <span className="font-bold text-slate-800">{selectedDoctor.totalVisits} logged visits</span>
                </div>
                <div className="flex justify-between">
                  <span>Sample Boxes Placed:</span>
                  <span className="font-bold text-emerald-600">{selectedDoctor.totalSamplesGiven} boxes</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedDoctor(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                Close Inspector
              </button>
              <Link
                href="/tour-plans/new"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
              >
                Schedule Tour Plan Visit
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
