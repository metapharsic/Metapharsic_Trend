"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type ClaimStatus = "PENDING_MR" | "PENDING_ASM" | "APPROVED" | "COMPLETED" | "REJECTED";

interface Claim {
  id: string;
  status: ClaimStatus;
  quantity: number;
  reason: string;
  createdAt: string;
  employeeName?: string;
  chemist: { id: string; name: string };
  distributor: { id: string; name: string };
  product: { id: string; name: string; sku: string };
  creditNote: { number: string; amount: string } | null;
}

const STATUS_STYLES: Record<ClaimStatus, string> = {
  PENDING_MR: "bg-slate-200 text-slate-600",
  PENDING_ASM: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function ClaimsReviewPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/mr/claims");
      setClaims(res.data.data.claims);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActingId(id);
    try {
      await apiClient.put(`/api/manager/claims/${id}/review`, { status });
      await load();
    } finally {
      setActingId(null);
    }
  };

  const pending = claims.filter((c) => c.status === "PENDING_ASM");
  const others = claims.filter((c) => c.status !== "PENDING_ASM");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" /> Claims Review
        </h1>
        <p className="text-sm text-slate-500">All MRs&apos; damaged/expiry claims. Approve or reject items pending ASM review.</p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs font-bold uppercase">Pending ASM Review ({pending.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">MR</th>
                  <th className="text-left px-4 py-3">Chemist</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Nothing pending.</td></tr>
                ) : (
                  pending.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-slate-700">{c.employeeName}</td>
                      <td className="px-4 py-3 text-slate-800">{c.chemist.name}</td>
                      <td className="px-4 py-3 text-slate-700">{c.product.name}</td>
                      <td className="px-4 py-3 text-slate-700">{c.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{c.reason}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button
                          disabled={actingId === c.id}
                          onClick={() => review(c.id, "APPROVED")}
                          className="flex items-center gap-1 text-emerald-600 text-xs font-semibold hover:underline disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          disabled={actingId === c.id}
                          onClick={() => review(c.id, "REJECTED")}
                          className="flex items-center gap-1 text-red-600 text-xs font-semibold hover:underline disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase">All Claims</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">MR</th>
                  <th className="text-left px-4 py-3">Chemist</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {others.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No other claims.</td></tr>
                ) : (
                  others.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-slate-700">{c.employeeName}</td>
                      <td className="px-4 py-3 text-slate-800">{c.chemist.name}</td>
                      <td className="px-4 py-3 text-slate-700">{c.product.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
