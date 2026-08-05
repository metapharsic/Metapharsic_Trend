"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  BadgeCheck,
  Timer,
  FileCheck2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface Tender {
  id: string;
  hospital: { name: string };
  product: { name: string };
  tenderNo: string;
  contractRate: number;
  status: "DRAFT" | "SUBMITTED" | "WON" | "LOST";
  validTo: string;
}

export default function HospitalsDashboard() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    apiClient
      .get("/api/hospitals/tenders")
      .then((res) => setTenders(res.data.data.tenders ?? []))
      .catch((err: any) => {
        console.error("[HospitalsDashboard]", err);
        setError(
          err?.response?.data?.error?.message ?? "Failed to load tender data."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTenders = tenders.filter(
    (t) => t.status === "SUBMITTED" || t.status === "DRAFT"
  ).length;
  const tendersWon = tenders.filter((t) => t.status === "WON").length;
  const uniqueHospitals = new Set(tenders.map((t) => t.hospital.name)).size;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100 flex justify-between items-center bg-gradient-to-r from-teal-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Institutional Business</h1>
          <p className="text-sm text-slate-500 mt-1">Manage hospital tenders and formulary listings</p>
        </div>
        <button className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 shadow-sm transition-colors">
          Submit Tender
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Building2} label="Partner Hospitals" value={String(uniqueHospitals)} tone="neutral" />
        <KpiTile icon={FileText} label="Active Tenders" value={String(activeTenders)} tone="warn" />
        <KpiTile icon={BadgeCheck} label="Tenders Won" value={String(tendersWon)} tone="good" />
        <KpiTile icon={FileCheck2} label="Total Tenders" value={String(tenders.length)} tone="good" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800">Tender Pipeline</h2>
        </div>

        {tenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <FileText size={32} />
            <p className="text-sm">No tenders found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 font-semibold">Tender No. / Hospital</th>
                <th className="px-6 py-3 font-semibold">Product</th>
                <th className="px-6 py-3 font-semibold">Contract Rate</th>
                <th className="px-6 py-3 font-semibold">Validity</th>
                <th className="px-6 py-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenders.map((tender) => (
                <tr key={tender.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{tender.tenderNo}</p>
                    <p className="text-xs text-slate-500">{tender.hospital.name}</p>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{tender.product.name}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">₹{tender.contractRate.toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-600 flex items-center gap-1.5 mt-2">
                    <Timer size={14} className="text-slate-400" />
                    {new Date(tender.validTo).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
                        ${tender.status === "WON"
                          ? "bg-emerald-100 text-emerald-700"
                          : tender.status === "LOST"
                          ? "bg-red-100 text-red-700"
                          : tender.status === "SUBMITTED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {tender.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-100 text-amber-600"
      : tone === "good"
      ? "bg-teal-100 text-teal-600"
      : "bg-slate-100 text-slate-600";
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
