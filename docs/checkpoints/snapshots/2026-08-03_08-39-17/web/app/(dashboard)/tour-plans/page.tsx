"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface TourPlanDay {
  id: string;
  date: string;
  territory: { id: string; name: string };
  plannedDoctor: { id: string; fullName: string } | null;
}

interface TourPlan {
  id: string;
  month: string;
  status: string;
  employee: { id: string; firstName: string; lastName: string };
  days: TourPlanDay[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-50 text-gray-600",
  PENDING_ASM: "bg-amber-50 text-amber-600",
  APPROVED: "bg-primary-50 text-primary-700",
  REJECTED: "bg-red-50 text-red-600",
};

export default function TourPlansPage() {
  const [tourPlans, setTourPlans] = useState<TourPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/api/sfa/tour-plan");
      setTourPlans(res.data.data.tourPlans || []);
    } catch (err) {
      console.error("Failed to fetch tour plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const decide = async (tourPlanId: string, action: "approve" | "reject") => {
    setActingId(tourPlanId);
    try {
      await apiClient.post(`/api/sfa/tour-plan/${action}`, { tourPlanId });
      await fetchData();
    } catch (err) {
      alert(`Failed to ${action} tour plan.`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Tour Plans</h1>
        <p className="text-sm text-gray-500 mt-1">Review and approve MR monthly tour plan calendars.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : tourPlans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No tour plans submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tourPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {plan.employee.firstName} {plan.employee.lastName}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(plan.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} ·{" "}
                    {plan.days.length} planned day{plan.days.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[plan.status] ?? "bg-gray-50 text-gray-600"}`}
                >
                  {plan.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {plan.days.map((day) => (
                  <div key={day.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">
                      {new Date(day.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                    <p className="text-gray-500 mt-0.5">{day.territory.name}</p>
                    <p className="text-gray-500">{day.plannedDoctor?.fullName ?? "No doctor set"}</p>
                  </div>
                ))}
              </div>

              {plan.status === "PENDING_ASM" && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => decide(plan.id, "approve")}
                    disabled={actingId !== null}
                    className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(plan.id, "reject")}
                    disabled={actingId !== null}
                    className="bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
