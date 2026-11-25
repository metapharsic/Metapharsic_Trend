"use client";

import React, { useState } from "react";
import { X, Wallet, CheckCircle2, Receipt } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface CollectPaymentModalProps {
  chemistId: string;
  chemistName: string;
  invoiceId?: string;
  invoiceNo?: string;
  suggestedAmount: number;
  onClose: () => void;
  onCollected: (message: string) => void;
}

function currency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

export function CollectPaymentModal({
  chemistId,
  chemistName,
  invoiceId,
  invoiceNo,
  suggestedAmount,
  onClose,
  onCollected,
}: CollectPaymentModalProps) {
  const safeDefault = suggestedAmount > 0 ? String(Math.round(suggestedAmount * 100) / 100) : "";
  const [amount, setAmount] = useState(safeDefault);
  const [refNumber, setRefNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Enter a valid collection amount greater than ₹0.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/api/mr/collections", {
        chemistId,
        amount: numAmount,
        refNumber: refNumber.trim() || undefined,
        invoiceId: invoiceId || undefined,
      });
      onCollected(
        `Collected ${currency(numAmount)} from ${chemistName}${
          invoiceNo ? ` (${invoiceNo})` : ""
        }. Ledger & FIFO paid status synced.`
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to record collection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <Wallet size={18} className="text-teal-700" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">Record Payment Collection</h2>
              <p className="text-xs text-slate-500">Auto-posts Cash/Bank &amp; A/R ledger + reconciles FIFO paid status</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">Chemist Account</span>
              <span className="font-bold text-slate-900">{chemistName}</span>
            </div>
            {invoiceNo && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Invoice Ref</span>
                <span className="font-mono font-bold text-indigo-700 inline-flex items-center gap-1">
                  <Receipt size={11} /> {invoiceNo}
                </span>
              </div>
            )}
            {suggestedAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Target Balance</span>
                <span className="font-bold text-amber-700">{currency(suggestedAmount)}</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Amount Received (₹) *
              </label>
              {suggestedAmount > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.round((suggestedAmount / 2) * 100) / 100))}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.round(suggestedAmount * 100) / 100))}
                    className="px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-[10px] font-bold text-teal-700"
                  >
                    Full
                  </button>
                </div>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Payment Reference / UTR / Cheque No
            </label>
            <input
              type="text"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              placeholder="e.g. UPI-431982 / CHQ-00142 / Cash"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              {submitting ? "Posting…" : "Confirm Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
