"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface DoctorDps {
  id: string;
  fullName: string;
  primarySpecialty: string;
  dpsScore: number;
  dpsTier: string | null;
  requiredMonthlyVisits: number;
  dpsCalculatedAt: string | null;
  territory: { id: string; name: string; priority: number };
  visitsThisMonth: number;
  visitGap: number;
}

const TIER_STYLES: Record<string, string> = {
  "A+": "bg-primary-600 text-white",
  A: "bg-primary-50 text-primary-700",
  B: "bg-amber-50 text-amber-600",
  C: "bg-gray-100 text-gray-600",
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorDps[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/api/manager/doctors/dps");
      setDoctors(res.data.data.doctors || []);
    } catch (err) {
      console.error("Failed to fetch doctor DPS scores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const recalculate = async () => {
    setRecalculating(true);
    try {
      await apiClient.post("/api/manager/doctors/dps");
      await fetchData();
    } catch (err) {
      alert("Failed to recalculate DPS scores.");
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Doctor Potential (DPS)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Potential scores drive required visit frequency per doctor.
          </p>
        </div>
        <button
          onClick={recalculate}
          disabled={recalculating}
          className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 shrink-0"
        >
          {recalculating ? "Recalculating..." : "Recalculate DPS"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No doctors on record.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Doctor</th>
                <th className="px-6 py-3">Territory</th>
                <th className="px-6 py-3">DPS</th>
                <th className="px-6 py-3">Tier</th>
                <th className="px-6 py-3">Visits (req / actual)</th>
                <th className="px-6 py-3">Gap</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{d.fullName}</p>
                    <p className="text-xs text-gray-400">{d.primarySpecialty}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{d.territory.name}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{d.dpsScore.toFixed(1)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_STYLES[d.dpsTier ?? ""] ?? "bg-gray-50 text-gray-500"}`}
                    >
                      {d.dpsTier ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {d.requiredMonthlyVisits} / {d.visitsThisMonth}
                  </td>
                  <td className="px-6 py-4">
                    {d.visitGap > 0 ? (
                      <span className="text-red-500 font-semibold">{d.visitGap} short</span>
                    ) : (
                      <span className="text-primary-600 font-semibold">On track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
