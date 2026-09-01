"use client";

import React, { useEffect, useState } from "react";
import { IndianRupee, Plus, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  ASSET: "bg-emerald-100 text-emerald-700",
  LIABILITY: "bg-red-100 text-red-700",
  INCOME: "bg-indigo-100 text-indigo-700",
  EXPENSE: "bg-amber-100 text-amber-700",
  EQUITY: "bg-slate-100 text-slate-700",
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/finance/accounts");
      setAccounts(res.data.data.accounts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/finance/accounts", form);
      setForm({ code: "", name: "", type: "ASSET" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-indigo-600" /> Chart of Accounts
          </h1>
          <p className="text-sm text-slate-500">Ledger account list — foundation for journal entries and reports.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "New Account"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button
            disabled={saving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create"}
          </button>
          {error && <p className="text-red-600 text-sm w-full">{error}</p>}
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No accounts yet.</td></tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-slate-700">{a.code}</td>
                  <td className="px-4 py-3 text-slate-800">{a.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[a.type] ?? "bg-slate-100 text-slate-700"}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.isSystem ? "System" : "Manual"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
