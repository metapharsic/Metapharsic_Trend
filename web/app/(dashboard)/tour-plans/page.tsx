"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface TourPlanDay {
  id: string;
  date: string;
  territory: { id: string; name: string };
  plannedDoctor: { id: string; fullName: string } | null;
}

interface TourPlan {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  month: string;
  status: "DRAFT" | "PENDING_ASM" | "APPROVED" | "REJECTED";
  days: TourPlanDay[];
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
  const [plans, setPlans] = useState<TourPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    apiClient
      .get("/api/sfa/tour-plan")
      .then((res) => setPlans(res.data.data.tourPlans))
      .catch((err) => console.error("Failed to load tour plans:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setRole(decodeRole());
    load();
  }, []);

  const isManager = role === "ASM" || role === "ADMIN" || role === "MD";
  const isMR = role === "MR";

  const decide = async (planId: string, action: "approve" | "reject") => {
    setBusyId(planId);
    try {
      await apiClient.post(`/api/sfa/tour-plan/${action}`, { tourPlanId: planId });
      load();
    } catch (err) {
      console.error(`Failed to ${action} tour plan:`, err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
      </div>
    );
  }

  const pendingCount = plans.filter((p) => p.status === "PENDING_ASM").length;
  const approvedCount = plans.filter((p) => p.status === "APPROVED").length;
  const totalCalls = plans.reduce((sum, p) => sum + p.days.filter((d) => d.plannedDoctor).length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 flex justify-between items-center bg-gradient-to-r from-sky-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Tour Plans</h1>
          <p className="text-sm text-slate-500 mt-1">Review and approve monthly field coverage plans</p>
        </div>
        {isMR && (
          <button
            onClick={() => router.push("/tour-plans/new")}
            className="bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
          >
            Create Tour Plan
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile icon={Clock} label="Pending Approvals" value={String(pendingCount)} tone="warn" />
        <KpiTile icon={CheckCircle2} label="Approved Plans" value={String(approvedCount)} tone="good" />
        <KpiTile icon={CalendarDays} label="Total Calls Planned" value={String(totalCalls)} tone="neutral" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="px-6 py-3 font-semibold">Employee</th>
              <th className="px-6 py-3 font-semibold">Month</th>
              <th className="px-6 py-3 font-semibold">Calls Planned</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              {(isManager || isMR) && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.length === 0 && (
              <tr>
                <td colSpan={isManager || isMR ? 5 : 4} className="px-6 py-10 text-center text-slate-400">
                  No tour plans found.
                </td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
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
                    {plan.days.filter((d) => d.plannedDoctor).length}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
                    ${plan.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : plan.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {plan.status.replace("_", " ")}
                  </span>
                </td>
                {isManager && (
                  <td className="px-6 py-4 text-right space-x-2">
                    {plan.status === "PENDING_ASM" && (
                      <>
                        <button
                          disabled={busyId === plan.id}
                          onClick={() => decide(plan.id, "approve")}
                          className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-emerald-100 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === plan.id}
                          onClick={() => decide(plan.id, "reject")}
                          className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-red-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                )}
                {isMR && (
                  <td className="px-6 py-4 text-right">
                    {plan.status === "REJECTED" && (
                      <button
                        onClick={() =>
                          router.push(
                            `/tour-plans/new?month=${new Date(plan.month).toISOString().slice(0, 7)}`
                          )
                        }
                        className="text-sky-600 hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-sky-100"
                      >
                        Resubmit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : "bg-sky-100 text-sky-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
