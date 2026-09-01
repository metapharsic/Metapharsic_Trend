"use client";

import React, { useEffect, useState } from "react";
import { Scale, TrendingUp, Landmark } from "lucide-react";
import { apiClient } from "@/lib/api-client";

function currency(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

type Tab = "trial-balance" | "pnl" | "balance-sheet";

const TABS: { key: Tab; label: string; icon: typeof Scale }[] = [
  { key: "trial-balance", label: "Trial Balance", icon: Scale },
  { key: "pnl", label: "Profit & Loss", icon: TrendingUp },
  { key: "balance-sheet", label: "Balance Sheet", icon: Landmark },
];

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<Tab>("trial-balance");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Finance Reports</h1>
        <p className="text-sm text-slate-500">Server-computed from all ledger entries — every account, live.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "trial-balance" && <TrialBalanceTab />}
      {tab === "pnl" && <PnlTab />}
      {tab === "balance-sheet" && <BalanceSheetTab />}
    </div>
  );
}

// ─── Trial Balance ─────────────────────────────────────────────────────────

interface TbRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

function TrialBalanceTab() {
  const [rows, setRows] = useState<TbRow[]>([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, balanced: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/finance/reports/trial-balance")
      .then((res) => {
        setRows(res.data.data.rows);
        setTotals(res.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Account</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Debit</th>
              <th className="text-right px-4 py-3">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No ledger activity yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.accountId}>
                  <td className="px-4 py-3 font-mono text-slate-700">{r.code}</td>
                  <td className="px-4 py-3 text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.type}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.debit ? currency(r.debit) : "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.credit ? currency(r.credit) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold text-slate-800">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                <td className="px-4 py-3 text-right">{currency(totals.totalDebit)}</td>
                <td className="px-4 py-3 text-right">{currency(totals.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!loading && rows.length > 0 && (
        <p className={`mt-3 text-sm font-semibold ${totals.balanced ? "text-emerald-600" : "text-red-600"}`}>
          {totals.balanced ? "✓ Books are balanced" : "✗ Books are unbalanced — investigate"}
        </p>
      )}
    </div>
  );
}

// ─── P&L ────────────────────────────────────────────────────────────────────

interface PnlLine { code: string; name: string; amount: number }

function monthStartISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PnlTab() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<{ income: PnlLine[]; expense: PnlLine[]; totalIncome: number; totalExpense: number; netProfit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/api/finance/reports/pnl", { params: { from, to } })
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={load} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
          Run
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : !data ? null : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase">Income</td></tr>
              {data.income.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-3 text-slate-400">No income posted in range.</td></tr>
              ) : (
                data.income.map((l) => (
                  <tr key={l.code}><td className="px-4 py-2 text-slate-700">{l.code} — {l.name}</td><td className="px-4 py-2 text-right">{currency(l.amount)}</td></tr>
                ))
              )}
              <tr className="font-semibold"><td className="px-4 py-2">Total Income</td><td className="px-4 py-2 text-right">{currency(data.totalIncome)}</td></tr>

              <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase">Expense</td></tr>
              {data.expense.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-3 text-slate-400">No expense posted in range.</td></tr>
              ) : (
                data.expense.map((l) => (
                  <tr key={l.code}><td className="px-4 py-2 text-slate-700">{l.code} — {l.name}</td><td className="px-4 py-2 text-right">{currency(l.amount)}</td></tr>
                ))
              )}
              <tr className="font-semibold"><td className="px-4 py-2">Total Expense</td><td className="px-4 py-2 text-right">{currency(data.totalExpense)}</td></tr>
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="font-bold text-slate-800">
                <td className="px-4 py-3">Net Profit</td>
                <td className={`px-4 py-3 text-right ${data.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{currency(data.netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Balance Sheet ──────────────────────────────────────────────────────────

interface BsLine { code: string; name: string; balance: number }

function BalanceSheetTab() {
  const [asOf, setAsOf] = useState(todayISO());
  const [data, setData] = useState<{
    assets: BsLine[];
    liabilities: BsLine[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    retainedEarnings: number;
    balanced: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/api/finance/reports/balance-sheet", { params: { asOf } })
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">As of</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={load} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
          Run
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : !data ? null : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th colSpan={2} className="text-left px-4 py-3">Assets</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.assets.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-3 text-slate-400">None.</td></tr>
                ) : (
                  data.assets.map((l) => (
                    <tr key={l.code}><td className="px-4 py-2 text-slate-700">{l.code} — {l.name}</td><td className="px-4 py-2 text-right">{currency(l.balance)}</td></tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold"><tr><td className="px-4 py-3">Total Assets</td><td className="px-4 py-3 text-right">{currency(data.totalAssets)}</td></tr></tfoot>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th colSpan={2} className="text-left px-4 py-3">Liabilities & Equity</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.liabilities.map((l) => (
                  <tr key={l.code}><td className="px-4 py-2 text-slate-700">{l.code} — {l.name}</td><td className="px-4 py-2 text-right">{currency(l.balance)}</td></tr>
                ))}
                <tr><td className="px-4 py-2 text-slate-700">Retained Earnings (P&amp;L)</td><td className="px-4 py-2 text-right">{currency(data.retainedEarnings)}</td></tr>
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr><td className="px-4 py-3">Total Liabilities</td><td className="px-4 py-3 text-right">{currency(data.totalLiabilities)}</td></tr>
                <tr><td className="px-4 py-3">Total Equity</td><td className="px-4 py-3 text-right">{currency(data.totalEquity)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && data && (
        <p className={`mt-3 text-sm font-semibold ${data.balanced ? "text-emerald-600" : "text-red-600"}`}>
          {data.balanced ? "✓ Assets = Liabilities + Equity" : "✗ Sheet does not balance — investigate"}
        </p>
      )}
    </div>
  );
}
