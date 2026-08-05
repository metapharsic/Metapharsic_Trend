"use client";

import React, { useEffect, useState } from "react";
import {
  Receipt,
  FileCheck2,
  Clock,
  AlertTriangle,
  Upload,
  Banknote,
  X,
  Edit2,
  Trash2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ExpenseClaim {
  id: string;
  category: string;
  amount: string;
  description: string | null;
  createdAt: string;
  status: "DRAFT" | "PENDING_ASM" | "PENDING_RM" | "PENDING_FINANCE" | "APPROVED" | "REJECTED";
  auditNotes: string | null;
  employee: { id: string; firstName: string; lastName: string };
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_ASM: "bg-amber-100 text-amber-700",
  PENDING_RM: "bg-orange-100 text-orange-700",
  PENDING_FINANCE: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function ExpensesDashboard() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClaim, setEditingClaim] = useState<ExpenseClaim | null>(null);
  const [viewingClaim, setViewingClaim] = useState<ExpenseClaim | null>(null);

  const load = () => {
    apiClient
      .get("/api/expenses/claims")
      .then((res) => setClaims(res.data.data.claims))
      .catch((err) => console.error("Failed to load expense claims:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setRole(decodeRole());
    load();
  }, []);

  const isManager = role === "ASM" || role === "ADMIN";
  const isMR = role === "MR";
  const EDITABLE_STATUSES = ["PENDING_ASM", "PENDING_RM", "PENDING_FINANCE"];

  const deleteClaim = async (id: string) => {
    if (!confirm("Delete this expense claim? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/api/expenses/claims/${id}`);
      load();
    } catch (err) {
      console.error("Failed to delete expense claim:", err);
    }
  };

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    try {
      await apiClient.put(`/api/expenses/claims/${id}/review`, { status });
      load();
    } catch (err) {
      console.error("Failed to review claim:", err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
      </div>
    );
  }

  const pending = claims.filter((c) => c.status === "PENDING_ASM" || c.status === "PENDING_RM" || c.status === "PENDING_FINANCE");
  const pendingAmount = pending.reduce((sum, c) => sum + Number(c.amount), 0);
  const now = new Date();
  const approvedMtd = claims
    .filter((c) => c.status === "APPROVED" && new Date(c.createdAt).getMonth() === now.getMonth() && new Date(c.createdAt).getFullYear() === now.getFullYear())
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100 flex justify-between items-center bg-gradient-to-r from-amber-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">{isManager ? "Expense Claims" : "My Expenses"}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isManager ? "Review and approve field expense claims" : "Submit claims and track reimbursement status"}
          </p>
        </div>
        {isMR && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Upload size={16} /> New Claim
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Clock} label="Pending Claims" value={String(pending.length)} tone="warn" />
        <KpiTile icon={Banknote} label="Pending Amount" value={currency(pendingAmount)} tone="warn" />
        <KpiTile icon={FileCheck2} label="Approved (MTD)" value={currency(approvedMtd)} tone="good" />
        <KpiTile icon={AlertTriangle} label="Rejected" value={String(claims.filter((c) => c.status === "REJECTED").length)} tone="error" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
              {isManager && <th className="px-6 py-3 font-semibold">Employee</th>}
              <th className="px-6 py-3 font-semibold">Claim / Date</th>
              <th className="px-6 py-3 font-semibold">Category</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              {(isManager || isMR) && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {claims.length === 0 && (
              <tr>
                <td colSpan={isManager ? 6 : 5} className="px-6 py-10 text-center text-slate-400">
                  No expense claims found.
                </td>
              </tr>
            )}
            {claims.map((claim) => (
              <tr
                key={claim.id}
                onClick={() => (isMR && EDITABLE_STATUSES.includes(claim.status) ? setEditingClaim(claim) : setViewingClaim(claim))}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {isManager && (
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {claim.employee.firstName} {claim.employee.lastName}
                  </td>
                )}
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-900">{claim.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-slate-500">{new Date(claim.createdAt).toLocaleDateString()}</p>
                </td>
                <td className="px-6 py-4 font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-slate-400" />
                    {claim.category}
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">{currency(claim.amount)}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${STATUS_COLORS[claim.status]}`}>
                    {claim.status.replace("_", " ")}
                  </span>
                </td>
                {isManager && (
                  <td className="px-6 py-4 text-right space-x-2">
                    {claim.status === "PENDING_ASM" && (
                      <>
                        <button
                          disabled={busyId === claim.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            review(claim.id, "APPROVED");
                          }}
                          className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-emerald-100 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === claim.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            review(claim.id, "REJECTED");
                          }}
                          className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-red-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                )}
                {isMR && (
                  <td className="px-6 py-4 text-right">
                    {EDITABLE_STATUSES.includes(claim.status) ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClaim(claim);
                          }}
                          className="text-slate-400 hover:text-amber-600 p-1 -m-1"
                          title="Edit claim"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClaim(claim.id);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 -m-1"
                          title="Delete claim"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-semibold">Locked</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewClaimModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {editingClaim && (
        <EditClaimModal
          claim={editingClaim}
          onClose={() => setEditingClaim(null)}
          onSaved={() => {
            setEditingClaim(null);
            load();
          }}
        />
      )}

      {viewingClaim && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewingClaim(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-slate-900 text-lg">{viewingClaim.category}</p>
              <button onClick={() => setViewingClaim(null)} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {viewingClaim.employee.firstName} {viewingClaim.employee.lastName} · {new Date(viewingClaim.createdAt).toLocaleDateString("en-IN")}
            </p>
            <div className="border-t border-gray-100 pt-1">
              <FormRow label="Amount" value={currency(viewingClaim.amount)} />
              <FormRow
                label="Status"
                value={
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${STATUS_COLORS[viewingClaim.status]}`}>
                    {viewingClaim.status.replace("_", " ")}
                  </span>
                }
              />
              <FormRow label="Description" value={viewingClaim.description || "—"} />
              {viewingClaim.auditNotes && <FormRow label="Audit Notes" value={viewingClaim.auditNotes} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}

function EditClaimModal({
  claim,
  onClose,
  onSaved,
}: {
  claim: ExpenseClaim;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(claim.amount ?? ""));
  const [category, setCategory] = useState(claim.category);
  const [description, setDescription] = useState(claim.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveEdit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (!category.trim()) return setError("Enter a category.");
    setSaving(true);
    try {
      await apiClient.put(`/api/expenses/claims/${claim.id}`, {
        amount: amt,
        category: category.trim(),
        description: description.trim() || undefined,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update claim.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-slate-900 text-sm">Edit Expense Claim</p>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 p-1 -m-1">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="Travel & Fuel">Travel & Fuel</option>
            <option value="Hotel & Accommodation">Hotel & Accommodation</option>
            <option value="Meals">Meals</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={saving}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewClaimModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (!category.trim()) return setError("Enter a category.");

    const formData = new FormData();
    formData.append("amount", amount);
    formData.append("category", category);
    if (description) formData.append("description", description);
    if (receipt) formData.append("receipt", receipt);

    setSubmitting(true);
    try {
      await apiClient.post("/api/expenses/claims/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSubmitted();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to submit claim.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">New Expense Claim</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          >
            <option value="">Select category</option>
            <option value="Travel & Fuel">Travel & Fuel</option>
            <option value="Hotel & Accommodation">Hotel & Accommodation</option>
            <option value="Meals">Meals</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Receipt (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : tone === "error" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600";
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
