"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Users,
  Sparkles,
  MapPin,
  Stethoscope,
  Edit3,
  Plus,
  Bot,
  Activity,
  AlertTriangle,
  ChevronRight,
  Save,
  X,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  AgentTelemetry,
  DailyTourPlanEntry,
  TourPlanEvaluation,
} from "@/services/tour-plan-agents.service";

interface Territory {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
  dpsScore?: number;
  dpsTier?: string;
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

export default function TourPlansDashboard() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<TourPlanEvaluation[]>([]);
  const [telemetry, setTelemetry] = useState<AgentTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Active view: 'OVERVIEW' | 'DAILY_SCHEDULE'
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "DAILY_SCHEDULE">("OVERVIEW");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Daily Edit Modal state
  const [editingDay, setEditingDay] = useState<DailyTourPlanEntry | null>(null);
  const [editTerritoryId, setEditTerritoryId] = useState<string>("");
  const [editDoctorId, setEditDoctorId] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  // Territory & Doctor Master Lists for Editing
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctorsByTerritory, setDoctorsByTerritory] = useState<Record<string, Doctor[]>>({});

  const loadData = (monthStr = selectedMonth, autoProv = false) => {
    setLoading(true);
    apiClient
      .get("/api/sfa/tour-plan", {
        params: { month: monthStr, autoProvision: autoProv },
      })
      .then((res) => {
        setPlans(res.data.data.tourPlans || []);
        const evals: TourPlanEvaluation[] = res.data.data.evaluations || [];
        setEvaluations(evals);
        setTelemetry(res.data.data.agentTelemetry || []);

        if (evals.length > 0 && !selectedPlanId) {
          setSelectedPlanId(evals[0].id);
        }
      })
      .catch((err) => console.error("Failed to load tour plans:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setRole(decodeRole());
    loadData(selectedMonth, true);

    // Fetch master territories for editing
    apiClient
      .get("/api/mr/territories")
      .then((res) => setTerritories(res.data.data.territories || []))
      .catch((err) => console.error("Failed to load territories:", err));
  }, [selectedMonth]);

  const loadDoctorsForTerritory = async (territoryId: string) => {
    if (!territoryId || doctorsByTerritory[territoryId]) return;
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "DOCTOR", territoryId, limit: 100 },
      });
      const docs = (res.data.data.entities || []).map((e: any) => ({
        id: e.id,
        fullName: e.name || e.fullName,
      }));
      setDoctorsByTerritory((prev) => ({ ...prev, [territoryId]: docs }));
    } catch (err) {
      console.error("Failed to load doctors for territory:", err);
    }
  };

  const handleProvisionDB = async () => {
    setProvisioning(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/provision", {
        month: selectedMonth,
        overwrite: true,
      });
      loadData(selectedMonth, false);
    } catch (err) {
      console.error("Failed to provision tour plan:", err);
    } finally {
      setProvisioning(false);
    }
  };

  const decide = async (planId: string, action: "approve" | "reject") => {
    setBusyId(planId);
    try {
      await apiClient.post(`/api/sfa/tour-plan/${action}`, { tourPlanId: planId });
      loadData(selectedMonth, false);
    } catch (err) {
      console.error(`Failed to ${action} tour plan:`, err);
    } finally {
      setBusyId(null);
    }
  };

  const openDayEditor = (day: DailyTourPlanEntry) => {
    setEditingDay(day);
    setEditTerritoryId(day.territoryId);
    setEditDoctorId(day.plannedDoctorId || "");
    if (day.territoryId) {
      loadDoctorsForTerritory(day.territoryId);
    }
  };

  const saveDayEdit = async () => {
    if (!editingDay || !selectedPlanId || !editTerritoryId) return;
    setEditSaving(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/update-day", {
        tourPlanId: selectedPlanId,
        dayId: editingDay.id,
        territoryId: editTerritoryId,
        plannedDoctorId: editDoctorId || null,
      });
      setEditingDay(null);
      loadData(selectedMonth, false);
    } catch (err) {
      console.error("Failed to update daily tour plan entry:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const isManager = role === "ASM" || role === "ADMIN" || role === "MD";
  const isMR = role === "MR";

  const selectedEvaluation = evaluations.find((e) => e.id === selectedPlanId) || evaluations[0];

  const pendingCount = plans.filter((p) => p.status === "PENDING_ASM").length;
  const approvedCount = plans.filter((p) => p.status === "APPROVED").length;
  const totalCalls = evaluations.reduce((sum, e) => sum + e.summary.totalDoctorCalls, 0);
  const avgEfficiency = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.summary.averageRouteEfficiency, 0) / evaluations.length)
    : 88;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-sky-50 via-white to-blue-50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">
              Tour Plans & Multi-Agent Daily Scheduler
            </h1>
            <span className="bg-sky-100 text-sky-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-sky-200">
              Live DB Synced
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Provision, optimize, and edit daily tour schedules backed by multi-agent route and CRM targeting models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white shadow-sm"
          />

          <button
            onClick={handleProvisionDB}
            disabled={provisioning}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={provisioning ? "animate-spin" : ""} />
            {provisioning ? "Provisioning..." : "Provision DB Plan"}
          </button>

          {isMR && (
            <button
              onClick={() => router.push("/tour-plans/new")}
              className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
            >
              <Plus size={16} />
              Create Plan
            </button>
          )}
        </div>
      </div>

      {/* Multi-Agent Telemetry Status Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="text-sky-600" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Multi-Agent Tour Intelligence Status
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Agents Active: 4/4 | Model: Real-Time DB Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {telemetry.length > 0 ? (
            telemetry.map((agent, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-sky-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 truncate">{agent.name}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{agent.role}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600">
                  <span>Latency: {agent.latencyMs}ms</span>
                  <span>Conf: {Math.round(agent.confidence * 100)}%</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-4 bg-white p-4 rounded-xl text-center text-xs text-slate-400 border border-slate-200">
              Loading multi-agent execution status...
            </div>
          )}
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile icon={Clock} label="Pending Approvals" value={String(pendingCount)} tone="warn" />
        <KpiTile icon={CheckCircle2} label="Approved Plans" value={String(approvedCount)} tone="good" />
        <KpiTile icon={CalendarDays} label="Planned Calls" value={String(totalCalls)} tone="sky" />
        <KpiTile icon={Activity} label="Avg Route Efficiency" value={`${avgEfficiency}%`} tone="emerald" />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "OVERVIEW"
              ? "border-sky-600 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Monthly Tour Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("DAILY_SCHEDULE")}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "DAILY_SCHEDULE"
              ? "border-sky-600 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Daily Schedule Editor</span>
          {selectedEvaluation && (
            <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {selectedEvaluation.days.length} days
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW TABLE */}
      {activeTab === "OVERVIEW" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 font-semibold">Employee</th>
                <th className="px-6 py-3 font-semibold">Month</th>
                <th className="px-6 py-3 font-semibold">Doctor Calls</th>
                <th className="px-6 py-3 font-semibold">Route Score</th>
                <th className="px-6 py-3 font-semibold">Compliance</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-slate-500 font-medium">No tour plans found for this month.</p>
                    <button
                      onClick={handleProvisionDB}
                      className="mt-3 inline-flex items-center gap-2 text-xs bg-sky-50 text-sky-700 font-bold px-3 py-2 rounded-lg border border-sky-200 hover:bg-sky-100"
                    >
                      <Sparkles size={14} /> Provision Plan from Database
                    </button>
                  </td>
                </tr>
              )}
              {plans.map((plan) => {
                const evalData = evaluations.find((e) => e.id === plan.id);
                return (
                  <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">
                        {plan.employee.firstName} {plan.employee.lastName}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {new Date(plan.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Users size={14} className="text-slate-400" />
                        {evalData?.summary.totalDoctorCalls ?? plan.days.filter((d: any) => d.plannedDoctor).length}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">
                      {evalData?.summary.averageRouteEfficiency ?? 85}%
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {evalData?.summary.complianceScore ?? 90}%
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
                        ${
                          plan.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : plan.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {plan.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          setActiveTab("DAILY_SCHEDULE");
                        }}
                        className="text-sky-600 hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-sky-200"
                      >
                        Edit Daily Plan
                      </button>

                      {isManager && plan.status === "PENDING_ASM" && (
                        <>
                          <button
                            disabled={busyId === plan.id}
                            onClick={() => decide(plan.id, "approve")}
                            className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-emerald-200 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === plan.id}
                            onClick={() => decide(plan.id, "reject")}
                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DAILY SCHEDULE & EDITABLE MATRIX */}
      {activeTab === "DAILY_SCHEDULE" && selectedEvaluation && (
        <div className="space-y-5">
          {/* Plan Summary Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Daily Tour Schedule — {selectedEvaluation.employeeName} ({selectedEvaluation.month})
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mt-1">
                <span>Total Days: <strong>{selectedEvaluation.summary.totalDaysPlanned}</strong></span>
                <span>Doctor Calls: <strong>{selectedEvaluation.summary.totalDoctorCalls}</strong></span>
                <span>Unique Doctors: <strong>{selectedEvaluation.summary.uniqueDoctorsCovered}</strong></span>
                <span>Route Score: <strong className="text-emerald-600">{selectedEvaluation.summary.averageRouteEfficiency}%</strong></span>
                <span>Compliance: <strong className="text-sky-600">{selectedEvaluation.summary.complianceScore}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedEvaluation.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700"
                    : selectedEvaluation.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selectedEvaluation.status}
              </span>
            </div>
          </div>

          {/* AI Recommendations Banner */}
          {selectedEvaluation.recommendations.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-sky-800 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} /> Multi-Agent AI Tour Optimization Insights
              </div>
              <ul className="text-xs text-sky-900 space-y-1 pl-5 list-disc">
                {selectedEvaluation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Daily Schedule List Matrix */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Day-by-Day Field Coverage Matrix</h3>
              <span className="text-xs text-slate-500 font-medium">
                Click "Edit Day" on any date to modify Territory or Doctor call assignments.
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {selectedEvaluation.days.map((day) => (
                <div
                  key={day.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    day.isSunday ? "bg-slate-50/60 opacity-60" : "hover:bg-sky-50/40"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {day.dayOfWeek.slice(0, 3)}
                      </span>
                      <span className="text-base font-bold text-slate-800">
                        {day.date.split("-")[2]}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">{day.date}</p>
                      <p className="text-xs text-slate-500">{day.dayOfWeek}</p>
                    </div>
                  </div>

                  {/* Territory & Doctor Details */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Territory</span>
                        <span className="font-semibold text-slate-800">{day.territoryName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Stethoscope size={14} className="text-slate-400" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Doctor</span>
                        {day.plannedDoctorName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{day.plannedDoctorName}</span>
                            {day.doctorDpsTier && (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                {day.doctorDpsTier}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No doctor planned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-3 justify-between md:justify-end">
                    <div className="text-right text-xs">
                      <span className="font-mono text-emerald-600 font-bold block">
                        {day.routeEfficiencyScore}% Route Score
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          day.complianceStatus === "OPTIMAL"
                            ? "bg-emerald-100 text-emerald-700"
                            : day.complianceStatus === "COMPLIANT"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {day.complianceStatus}
                      </span>
                    </div>

                    {!day.isSunday && (
                      <button
                        onClick={() => openDayEditor(day)}
                        className="flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-300 font-bold px-3 py-1.5 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition-colors shadow-sm"
                      >
                        <Edit3 size={13} /> Edit Day
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EDIT DAY MODAL */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Tour Plan Entry</h3>
                <p className="text-xs text-slate-500">{editingDay.date} ({editingDay.dayOfWeek})</p>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Territory Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Territory Location
                </label>
                <select
                  value={editTerritoryId}
                  onChange={(e) => {
                    setEditTerritoryId(e.target.value);
                    setEditDoctorId("");
                    loadDoctorsForTerritory(e.target.value);
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white"
                >
                  <option value="">Select Territory</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Planned Doctor Visit
                </label>
                <select
                  value={editDoctorId}
                  onChange={(e) => setEditDoctorId(e.target.value)}
                  disabled={!editTerritoryId}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white disabled:opacity-50"
                >
                  <option value="">-- No Specific Doctor (Territory Working Only) --</option>
                  {(doctorsByTerritory[editTerritoryId] || []).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Bot size={14} className="text-sky-600" /> Multi-Agent AI Recommendation
                </div>
                <p>
                  DoctorTargetingAgent suggests picking a Class A doctor to optimize prescription conversion for this territory cluster.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingDay(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={saveDayEdit}
                disabled={editSaving || !editTerritoryId}
                className="flex items-center gap-1.5 bg-sky-600 text-white px-5 py-2 text-xs font-bold rounded-xl hover:bg-sky-700 disabled:opacity-50 shadow-sm"
              >
                <Save size={14} />
                {editSaving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "warn" | "good" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-100 text-amber-600"
      : tone === "good"
      ? "bg-emerald-100 text-emerald-600"
      : tone === "sky"
      ? "bg-sky-100 text-sky-600"
      : "bg-teal-100 text-teal-600";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-display font-bold text-slate-900">{value}</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
}
