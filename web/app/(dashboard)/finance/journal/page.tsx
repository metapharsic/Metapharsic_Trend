"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Plus, X, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Line {
  accountId: string;
  debit: string;
  credit: string;
}

interface Transaction {
  id: string;
  date: string;
  narration: string;
  sourceType: string;
  entries: { debit: string; credit: string; account: { code: string; name: string } }[];
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

export default function JournalEntriesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [narration, setNarration] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [accRes, txRes] = await Promise.all([
        apiClient.get("/api/finance/accounts"),
        apiClient.get("/api/finance/journal-entries"),
      ]);
      setAccounts(accRes.data.data.accounts);
      setTransactions(txRes.data.data.transactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) {
      setError("Debit and credit totals must match before posting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/finance/journal-entries", {
        date,
        narration,
        entries: lines
          .filter((l) => l.accountId)
          .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      setNarration("");
      setLines([
        { accountId: "", debit: "", credit: "" },
        { accountId: "", debit: "", credit: "" },
      ]);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to post journal entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" /> Journal Entries
          </h1>
          <p className="text-sm text-slate-500">Manual double-entry postings. Debit must equal credit.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "New Entry"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Narration</label>
              <input value={narration} onChange={(e) => setNarration(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" required />
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={l.accountId}
                  onChange={(e) => updateLine(i, { accountId: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1"
                  required
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Debit"
                  value={l.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Credit"
                  value={l.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28"
                />
                {lines.length > 2 && (
                  <button type="button" onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={addLine} className="text-indigo-600 text-sm font-semibold hover:underline">+ Add line</button>
            <div className={`text-sm font-semibold ${balanced ? "text-emerald-600" : "text-red-600"}`}>
              Dr {currency(totalDebit)} — Cr {currency(totalCredit)} {balanced ? "✓ balanced" : "✗ unbalanced"}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            disabled={saving || !balanced}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Posting…" : "Post Entry"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Narration</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Lines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No journal entries yet.</td></tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-slate-700">{new Date(t.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-800">{t.narration}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{t.sourceType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.entries.map((e, i) => (
                      <div key={i}>
                        {e.account.code} {Number(e.debit) > 0 ? `Dr ${currency(e.debit)}` : `Cr ${currency(e.credit)}`}
                      </div>
                    ))}
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
