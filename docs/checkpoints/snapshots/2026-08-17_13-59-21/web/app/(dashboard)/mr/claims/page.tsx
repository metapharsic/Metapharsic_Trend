"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Plus, X, Send } from "lucide-react";
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

interface Option {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<ClaimStatus, string> = {
  PENDING_MR: "bg-slate-200 text-slate-600",
  PENDING_ASM: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function currency(v: string | number) {
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [chemists, setChemists] = useState<Option[]>([]);
  const [distributors, setDistributors] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [form, setForm] = useState({ chemistId: "", distributorId: "", productId: "", quantity: "1", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
    apiClient.get("/api/manager/entities", { params: { type: "CHEMIST", limit: 200 } }).then((res) => setChemists(res.data.data.entities ?? res.data.data));
    apiClient.get("/api/manager/entities", { params: { type: "DISTRIBUTOR", limit: 200 } }).then((res) => setDistributors(res.data.data.entities ?? res.data.data));
    apiClient.get("/api/products", { params: { limit: 200 } }).then((res) => setProducts(res.data.data.products ?? res.data.data));
  }, []);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/mr/claims", { ...form, quantity: Number(form.quantity) });
      setForm({ chemistId: "", distributorId: "", productId: "", quantity: "1", reason: "" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to raise claim");
    } finally {
      setSaving(false);
    }
  };

  const submitToAsm = async (id: string) => {
    setSubmittingId(id);
    try {
      await apiClient.put(`/api/mr/claims/${id}/submit`);
      await load();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" /> My Claims
          </h1>
          <p className="text-sm text-slate-500">Damaged / expiry claims raised on behalf of your chemists.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Raise Claim"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitNew} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Chemist</label>
              <select required value={form.chemistId} onChange={(e) => setForm({ ...form, chemistId: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Select chemist…</option>
                {chemists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Distributor</label>
              <select required value={form.distributorId} onChange={(e) => setForm({ ...form, distributorId: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Select distributor…</option>
                {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Product</label>
              <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity</label>
              <input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Reason</label>
            <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" rows={2} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <p className="text-xs text-slate-400">Saved as draft (PENDING_MR) — submit it to ASM from the list below when ready.</p>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Chemist</th>
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-left px-4 py-3">Qty</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Credit Note</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No claims raised yet.</td></tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-slate-800">{c.chemist.name}</td>
                  <td className="px-4 py-3 text-slate-700">{c.product.name}</td>
                  <td className="px-4 py-3 text-slate-700">{c.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.creditNote ? `${c.creditNote.number} — ${currency(c.creditNote.amount)}` : "—"}</td>
                  <td className="px-4 py-3">
                    {c.status === "PENDING_MR" && (
                      <button
                        onClick={() => submitToAsm(c.id)}
                        disabled={submittingId === c.id}
                        className="flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:underline disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> Submit to ASM
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
