"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Stethoscope,
  Calendar,
  Pill,
  Clock,
  UserRound,
} from "lucide-react";

interface VisitRow {
  id: string;
  mrName: string;
  purpose: string;
  feedback: string | null;
  createdAt: string;
  boxesPlaced: number | null;
  samples: { product: string; quantity: number }[];
}

interface DashboardData {
  doctor: { id: string; fullName: string; primarySpecialty: string };
  visits: VisitRow[];
  visitsLast30Days: number;
  totalSamplesReceived: number;
}

export default function DoctorPortal() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/doctor/dashboard")
      .then((res) => setData(res.data.data))
      .catch((err) => {
        console.error("Failed to load doctor dashboard:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load your portal. Check your connection and try again.";
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-rose-50 rounded-2xl p-12 text-center border border-rose-200">
          <p className="text-rose-700 text-sm font-semibold">{loadError ?? "No data."}</p>
        </div>
      </div>
    );
  }

  const totalSampleUnits = data.visits.reduce(
    (sum, v) => sum + v.samples.reduce((s, sm) => s + sm.quantity, 0),
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/50 backdrop-blur-xl p-8 rounded-3xl border border-white shadow-sm mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-bl-full -z-10 opacity-70"></div>
        <div className="z-10 flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl shadow-lg flex items-center justify-center text-white">
            <Stethoscope className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Welcome to the Doctor Portal
            </h1>
            <p className="text-teal-700 font-medium mt-1 text-lg">{data.doctor.fullName}</p>
            <p className="text-gray-500 text-sm mt-1">{data.doctor.primarySpecialty} — MR visit history and sample log, pulled straight from logged calls.</p>
          </div>
        </div>
      </div>

      {/* KPI Ribbon — all real, from Visit records */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">MR Visits (Last 30 Days)</p>
            <div className="p-2.5 bg-sky-100/50 rounded-xl text-sky-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{data.visitsLast30Days}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Logged in the last 30 days</p>
          </div>
        </div>

        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Total Samples Received</p>
            <div className="p-2.5 bg-teal-100/50 rounded-xl text-teal-600">
              <Pill className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{data.totalSamplesReceived}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Units, all-time, from logged calls</p>
          </div>
        </div>

        <div className="group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center justify-between z-10 relative">
            <p className="text-sm font-semibold text-gray-500">Total Calls Logged</p>
            <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600">
              <UserRound className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-6 z-10 relative">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{data.visits.length}</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Most recent shown below</p>
          </div>
        </div>
      </div>

      {/* Visit history — direct from Visit table */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">MR Visit History</h3>
        </div>

        {data.visits.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No MR calls logged for you yet.</p>
        ) : (
          <div className="space-y-4">
            {data.visits.map((v) => (
              <div key={v.id} className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors">
                <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 flex-shrink-0">
                  <UserRound className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900">{v.mrName}</h4>
                    <span className="text-xs font-bold text-sky-600 bg-sky-100 px-2.5 py-1 rounded-full">
                      {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{v.purpose}{v.feedback ? ` — ${v.feedback}` : ""}</p>
                  <div className="flex items-center gap-3 mt-3 text-sm text-gray-600 font-medium flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {new Date(v.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {v.boxesPlaced ? (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{v.boxesPlaced} boxes placed</span>
                      </>
                    ) : null}
                    {v.samples.length > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-gray-400" />
                          {v.samples.map((s) => `${s.product} ×${s.quantity}`).join(", ")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
