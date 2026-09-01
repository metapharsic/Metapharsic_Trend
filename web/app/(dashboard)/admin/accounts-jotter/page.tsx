"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Download,
  IndianRupee,
  Layers,
  Send,
  Loader2,
  BookOpen,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { exportCurrentPageToExcel } from "@/lib/excel-export";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JotTransaction {
  id: string;
  date: string;
  time: string;
  narration: string;
  sourceType: string;
  entries: {
    id: string;
    accountName: string;
    accountCode: string;
    accountType: string;
    debit: number;
    credit: number;
  }[];
}

interface JotSummaryData {
  date: string;
  summary: {
    totalInflow: number;
    totalOutflow: number;
    netPosition: number;
    totalTransactions: number;
  };
  transactions: JotTransaction[];
  accounts: AccountOption[];
}

const PRESETS = [
  { id: "FIELD_EXPENSE", label: "Field Travel & DA", icon: "⛽", desc: "MR travel allowance, fuel, doctor meet" },
  { id: "OFFICE_EXPENSE", label: "Office & Admin", icon: "🏢", desc: "Tea, snacks, printing, courier, utilities" },
  { id: "COLLECTION_INFLOW", label: "Chemist Collection", icon: "💰", desc: "Cash/UPI collected from chemist/distributor" },
  { id: "VENDOR_PAYMENT", label: "Vendor Payment", icon: "📦", desc: "Stock purchase, raw materials, logistics" },
  { id: "SALARY_ADVANCE", label: "Salary Advance", icon: "💼", desc: "Advance payout to employee/staff" },
  { id: "CUSTOM_ENTRY", label: "Custom Journal", icon: "⚖️", desc: "Manual debit/credit custom accounts" },
] as const;

export default function AdminAccountsJotterPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<JotSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Quick Jot Form State
  const [presetType, setPresetType] = useState<typeof PRESETS[number]["id"]>("FIELD_EXPENSE");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK_TRANSFER" | "UPI">("CASH");
  const [narration, setNarration] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [customDebitId, setCustomDebitId] = useState("");
  const [customCreditId, setCustomCreditId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/finance/accounts-jotter", {
        params: { date: selectedDate },
      });
      setData(res.data.data);
    } catch (err: any) {
      setFeedback({ type: "error", text: "Failed to load accounts summary." });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", text: "Please enter a valid positive amount (₹)." });
      return;
    }
    if (!narration.trim()) {
      setFeedback({ type: "error", text: "Please enter a quick memo or narration for this jot." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await apiClient.post("/api/finance/accounts-jotter", {
        date: selectedDate,
        type: presetType,
        amount: numAmount,
        paymentMode,
        narration: narration.trim(),
        referenceNo: referenceNo.trim() || undefined,
        customDebitAccountId: presetType === "CUSTOM_ENTRY" ? customDebitId : undefined,
        customCreditAccountId: presetType === "CUSTOM_ENTRY" ? customCreditId : undefined,
      });

      setFeedback({ type: "success", text: `Jotted ₹${numAmount.toLocaleString("en-IN")} successfully!` });
      setAmount("");
      setNarration("");
      setReferenceNo("");
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.response?.data?.error?.message || "Failed to jot account entry",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    exportCurrentPageToExcel("Metapharsic Daily Accounts Ledger");
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-white/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <BookOpen size={24} className="text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Admin Accounts Jotter</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Instant Auto-Balance
                </span>
              </div>
              <p className="text-indigo-200/70 text-xs mt-0.5">
                Rapid double-entry bookkeeping, daily expenses, cash flow &amp; ledger memo entry for Metapharsic Lifesciences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white">
              <Calendar size={13} className="text-indigo-300" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white outline-none font-medium"
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold transition-colors shadow-sm"
              title="Export today's ledger to Excel"
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        </div>

        {/* Daily KPI Tiles */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <ArrowDownLeft size={13} />
                Today&apos;s Inflow
              </div>
              <p className="text-xl font-bold text-white mt-1">
                ₹{data.summary.totalInflow.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">Collections &amp; Sales</p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-red-300">
                <ArrowUpRight size={13} />
                Today&apos;s Outflow
              </div>
              <p className="text-xl font-bold text-white mt-1">
                ₹{data.summary.totalOutflow.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">Expenses &amp; Payouts</p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300">
                <Wallet size={13} />
                Net Movement
              </div>
              <p className={`text-xl font-bold mt-1 ${data.summary.netPosition >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                ₹{data.summary.netPosition.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">Net Cash/Bank Flow</p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-300">
                <Layers size={13} />
                Entries Jotted
              </div>
              <p className="text-xl font-bold text-white mt-1">
                {data.summary.totalTransactions}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">Balanced Ledger Records</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Feedback Message ── */}
      {feedback && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ── Rapid Jot Form ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-600" />
            <h2 className="text-sm font-bold text-gray-800">Quick Jot a Transaction</h2>
          </div>
          <span className="text-[11px] text-gray-400">Takes less than 10 seconds to post</span>
        </div>

        <form onSubmit={handleJotSubmit} className="space-y-4">
          {/* Preset Buttons */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Category Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPresetType(p.id)}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    presetType === p.id
                      ? "border-primary-600 bg-primary-50/70 text-primary-900 shadow-sm ring-1 ring-primary-600"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 text-gray-700"
                  }`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <span className="font-bold text-xs mt-1">{p.label}</span>
                  <span className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Amount */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                />
              </div>
            </div>

            {/* Payment Mode */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Paid / Received Via</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
              >
                <option value="CASH">Cash in Hand (A/C 1001)</option>
                <option value="BANK_TRANSFER">Bank Account / RTGS / NEFT (A/C 1002)</option>
                <option value="UPI">UPI / QR Payment (A/C 1002)</option>
              </select>
            </div>

            {/* Narration / Jot Memo */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Memo / Jot Description</label>
              <input
                type="text"
                placeholder="e.g. Petrol DA for Rajesh Kumar, Tea & biscuits for office..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
              />
            </div>

            {/* Submit Button */}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Jot Entry
              </button>
            </div>
          </div>

          {/* Reference No & Custom Accounts */}
          <div className="flex items-center gap-3 pt-1 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">Voucher/Ref (Optional):</span>
              <input
                type="text"
                placeholder="e.g. VCH-001"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none w-32"
              />
            </div>

            {presetType === "CUSTOM_ENTRY" && data?.accounts && (
              <div className="flex items-center gap-2 flex-wrap bg-amber-50 border border-amber-200 p-2 rounded-xl text-xs">
                <span className="font-bold text-amber-800">Debit A/C:</span>
                <select
                  value={customDebitId}
                  onChange={(e) => setCustomDebitId(e.target.value)}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                >
                  <option value="">Select Debit Account...</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>

                <span className="font-bold text-amber-800">Credit A/C:</span>
                <select
                  value={customCreditId}
                  onChange={(e) => setCustomCreditId(e.target.value)}
                  className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                >
                  <option value="">Select Credit Account...</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Today's Jotted Ledger Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-gray-500" />
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Today&apos;s Jotted Journal Entries ({data?.transactions.length || 0})
            </h3>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Download size={12} />
            Export to Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Time</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Narration / Memo</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Debit Account (Dr)</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Credit Account (Cr)</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Amount (₹)</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">Loading jotted entries...</td>
                </tr>
              ) : !data || data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No transactions jotted yet for {selectedDate}. Use the quick jot form above to record your first entry.
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx) => {
                  const debitEntry = tx.entries.find((e) => e.debit > 0);
                  const creditEntry = tx.entries.find((e) => e.credit > 0);
                  const txAmount = debitEntry?.debit || creditEntry?.credit || 0;

                  return (
                    <tr key={tx.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-500">
                        {tx.time}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                        {tx.narration}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-medium">
                        {debitEntry ? `${debitEntry.accountName} (${debitEntry.accountCode})` : "—"}
                      </td>
                      <td className="px-4 py-3 text-indigo-700 font-medium">
                        {creditEntry ? `${creditEntry.accountName} (${creditEntry.accountCode})` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        ₹{txAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={10} />
                          Balanced
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
