"use client";

import React, { useEffect, useState } from "react";
import { IndianRupee, X, Stethoscope, Store } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Ledger {
  id: string;
  mrName: string;
  salesRevenue: string | null;
  creditGiven: string | null;
  amountCollected: string | null;
  outstandingCredit: string | null;
  promotionType: string | null;
  promotionValue: string | null;
  netRealizedProfit: string | null;
  potentialProfit: string | null;
  createdAt: string;
  doctor: { id: string; fullName: string; clinicAddress: string } | null;
  chemist: { id: string; name: string; address: string } | null;
}

function money(v: string | null) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return `₹${n.toLocaleString("en-IN")}`;
}

function FormRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}

export default function AdminFinancialsPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Ledger | null>(null);
  // Server-computed over the FULL where clause (db.entityLedger.aggregate),
  // not summed from the fetched page — a page cap must never silently
  // truncate what these tiles report.
  const [totals, setTotals] = useState({ salesRevenue: 0, creditGiven: 0, amountCollected: 0, outstandingCredit: 0, netRealizedProfit: 0 });

  useEffect(() => {
    apiClient
      .get("/api/manager/ledgers", { params: { limit: 200 } })
      .then((res) => {
        setLedgers(res.data.data.ledgers);
        setTotals(res.data.data.totals);
      })
      .catch((err) => console.error("Failed to load ledgers:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
          <IndianRupee size={22} /> Entity Financials
        </h1>
        <p className="text-sm text-gray-500 mt-1">Sales, credit, collections, and promotions per doctor / chemist. Click a row for full detail.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ["Sales Revenue", totals.salesRevenue],
          ["Credit Given", totals.creditGiven],
          ["Collected", totals.amountCollected],
          ["Outstanding", totals.outstandingCredit],
          ["Net Profit", totals.netRealizedProfit],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-lg font-display font-bold text-gray-900 mt-1">₹{(value as number).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : ledgers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No financial entries yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {ledgers.map((l) => {
            const isDoctor = !!l.doctor;
            const name = l.doctor?.fullName ?? l.chemist?.name ?? "Unknown";
            return (
              <button
                key={l.id}
                onClick={() => setViewing(l)}
                className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDoctor ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  {isDoctor ? <Stethoscope size={18} /> : <Store size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-400">MR: {l.mrName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{money(l.salesRevenue)}</p>
                  <p className="text-[10px] text-gray-400">revenue</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-gray-900 text-lg">
                {viewing.doctor?.fullName ?? viewing.chemist?.name}
              </p>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">{viewing.doctor?.clinicAddress ?? viewing.chemist?.address} · MR: {viewing.mrName}</p>
            <div className="border-t border-gray-100 pt-1">
              <FormRow label="Sales Revenue" value={money(viewing.salesRevenue)} />
              <FormRow label="Credit Given" value={money(viewing.creditGiven)} />
              <FormRow label="Amount Collected" value={money(viewing.amountCollected)} />
              <FormRow label="Outstanding Credit" value={money(viewing.outstandingCredit)} />
              <FormRow label="Promotion Type" value={viewing.promotionType ?? "—"} />
              <FormRow label="Promotion Value" value={money(viewing.promotionValue)} />
              <FormRow label="Net Realized Profit" value={money(viewing.netRealizedProfit)} />
              <FormRow label="Potential Profit" value={money(viewing.potentialProfit)} />
              <FormRow label="Recorded" value={new Date(viewing.createdAt).toLocaleDateString("en-IN")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
