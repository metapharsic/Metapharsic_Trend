"use client";

import React, { useEffect, useState } from "react";
import {
  Wallet,
  AlertTriangle,
  ShieldAlert,
  IndianRupee,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

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

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  NO_LIMIT: { badge: "bg-slate-100 text-slate-500", label: "No Limit" },
  OK: { badge: "bg-emerald-100 text-emerald-700", label: "OK" },
  WARNING: { badge: "bg-amber-100 text-amber-700", label: "Warning" },
  BREACHED: { badge: "bg-red-100 text-red-700", label: "Breached" },
};

export default function CreditCollectionsPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  if (role === null) return null;
  if (role === "MR") return <MrCreditView />;
  return <ManagerCreditView />;
}

// ─── MR view ─────────────────────────────────────────────────────────────────

interface ChemistCredit {
  chemistId: string;
  name: string;
  creditLimit: number | null;
  outstanding: number;
  status: string;
}

function MrCreditView() {
  const [data, setData] = useState<{
    chemists: ChemistCredit[];
    totalOutstanding: number;
    attentionNeeded: ChemistCredit[];
    todaysCollection: number;
    collectionsList?: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingCollection, setEditingCollection] = useState<any | null>(null);

  const load = () => {
    apiClient
      .get("/api/mr/credit-summary")
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Failed to load credit summary:", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this collection entry? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/api/mr/collections/${id}`);
      load();
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <p className="text-slate-400 text-sm">Unable to load credit summary.</p>
      </div>
    );
  }

  const filteredChemists = data.chemists.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Credit & Collections</h1>
          <p className="text-sm text-slate-500 mt-1">Track chemist outstanding and log payments collected</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Log Collection
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile icon={IndianRupee} label="Today's Collection" value={currency(data.todaysCollection)} tone="good" />
        <Tile icon={Wallet} label="Total Outstanding" value={currency(data.totalOutstanding)} tone={data.totalOutstanding > 0 ? "warn" : "good"} />
        <Tile
          icon={ShieldAlert}
          label="Chemists Needing Attention"
          value={String(data.attentionNeeded.length)}
          tone={data.attentionNeeded.length > 0 ? "warn" : "good"}
        />
      </div>

      {data.attentionNeeded.length > 0 && (
        <div className="space-y-2">
          {data.attentionNeeded.map((c) => (
            <div key={c.chemistId} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${c.status === "BREACHED" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
              <AlertTriangle size={15} className={c.status === "BREACHED" ? "text-red-600" : "text-amber-600"} />
              <p className="text-sm font-semibold text-slate-800">
                {c.name} — outstanding {currency(c.outstanding)} {c.creditLimit !== null && `of ${currency(c.creditLimit)} limit`}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search chemist..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "OK", "WARNING", "BREACHED", "NO_LIMIT"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === status
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status === "ALL" ? "All Statuses" : status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="px-6 py-3 font-semibold">Chemist</th>
              <th className="px-6 py-3 font-semibold">Credit Limit</th>
              <th className="px-6 py-3 font-semibold">Outstanding</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredChemists.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                  No chemists found.
                </td>
              </tr>
            )}
            {filteredChemists.map((c) => {
              const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.NO_LIMIT;
              return (
                <tr key={c.chemistId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 text-slate-600">{c.creditLimit !== null ? currency(c.creditLimit) : "—"}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{currency(c.outstanding)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${s.badge}`}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Recent Collections Logged</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 font-semibold">Date & Time</th>
                <th className="px-6 py-3 font-semibold">Chemist</th>
                <th className="px-6 py-3 font-semibold">Ref Number</th>
                <th className="px-6 py-3 font-semibold text-right">Amount Collected</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data.collectionsList || data.collectionsList.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No recent collections logged.
                  </td>
                </tr>
              )}
              {data.collectionsList?.map((col: any) => (
                <tr key={col.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(col.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{col.chemist?.name || "Unknown Chemist"}</td>
                  <td className="px-6 py-4 font-mono text-slate-600">{col.refNumber || "CASH/RECEIPT"}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{currency(col.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setEditingCollection(col)} className="text-slate-400 hover:text-emerald-600 p-1 -m-1" title="Edit collection">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteCollection(col.id)} className="text-slate-400 hover:text-red-500 p-1 -m-1" title="Delete collection">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingCollection && (
        <EditCollectionModal
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
          onSaved={() => {
            setEditingCollection(null);
            load();
          }}
        />
      )}

      {showForm && (
        <LogCollectionModal
          chemists={data.chemists}
          onClose={() => setShowForm(false)}
          onLogged={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function LogCollectionModal({
  chemists,
  onClose,
  onLogged,
}: {
  chemists: ChemistCredit[];
  onClose: () => void;
  onLogged: () => void;
}) {
  const [chemistId, setChemistId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [refNumber, setRefNumber] = useState("");
  const [chemistSearch, setChemistSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredOptions = chemists.filter((c) =>
    c.name.toLowerCase().includes(chemistSearch.toLowerCase())
  );

  const selectedChemist = chemists.find((c) => c.chemistId === chemistId);
  const showExceededWarning = selectedChemist && Number(amount) > selectedChemist.outstanding;

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!chemistId) return setError("Select a chemist.");
    if (!amt || amt <= 0) return setError("Enter a valid amount.");

    setSubmitting(true);
    try {
      const finalRef = refNumber
        ? `[${paymentMode}] Ref: ${refNumber}`
        : `[${paymentMode}]`;

      await apiClient.post("/api/mr/collections", {
        chemistId,
        amount: amt,
        refNumber: finalRef,
      });
      onLogged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to log collection.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Log Collection</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Search Chemist</label>
          <input
            type="text"
            placeholder="Type to filter chemists list..."
            value={chemistSearch}
            onChange={(e) => setChemistSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Chemist *</label>
          <select
            value={chemistId}
            onChange={(e) => setChemistId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          >
            <option value="">Choose Chemist...</option>
            {filteredOptions.map((c) => (
              <option key={c.chemistId} value={c.chemistId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedChemist && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700">Chemist Credit Snapshot:</p>
            <div className="grid grid-cols-2 gap-y-1 text-slate-600">
              <span>Outstanding:</span>
              <span className="font-bold text-slate-900">{currency(selectedChemist.outstanding)}</span>
              <span>Credit Limit:</span>
              <span>{selectedChemist.creditLimit !== null ? currency(selectedChemist.creditLimit) : "No Limit"}</span>
              <span>Exposure Status:</span>
              <span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  selectedChemist.status === "BREACHED" ? "bg-red-100 text-red-700" :
                  selectedChemist.status === "WARNING" ? "bg-amber-100 text-amber-700" :
                  "bg-emerald-100 text-emerald-700"
                }`}>
                  {selectedChemist.status}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Collected (₹) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter payment amount"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI / Online</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Ref / Instrument No</label>
            <input
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              placeholder="e.g. 543120"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
        </div>

        {showExceededWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-normal">
              <strong>Notice:</strong> The entered collection amount exceeds the current outstanding balance. The remainder will be recorded as an advance.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {submitting ? "Logging..." : "Log Collection"}
        </button>
      </div>
    </div>
  );
}

function EditCollectionModal({
  collection,
  onClose,
  onSaved,
}: {
  collection: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(collection.amount ?? ""));
  const [refNumber, setRefNumber] = useState(collection.refNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveEdit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setSaving(true);
    try {
      await apiClient.put(`/api/mr/collections/${collection.id}`, {
        amount: amt,
        refNumber: refNumber || undefined,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update collection.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-slate-900 text-sm">Edit Collection</p>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 p-1 -m-1">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-400">{collection.chemist?.name || "Unknown Chemist"}</p>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Collected (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ref / Instrument No</label>
          <input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
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
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin / ASM / Finance view ─────────────────────────────────────────────

interface CompanyChemistCredit extends ChemistCredit {
  territory: string;
  mr: string;
}

function ManagerCreditView() {
  const [data, setData] = useState<{
    chemists: CompanyChemistCredit[];
    totalOutstanding: number;
    breachedCount: number;
    warningCount: number;
    todaysCollection: number;
    collectionsList?: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewingCollection, setViewingCollection] = useState<any | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/manager/credit")
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Failed to load credit overview:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <p className="text-slate-400 text-sm">Unable to load credit overview.</p>
      </div>
    );
  }

  const filteredChemists = data.chemists.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.territory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
        <h1 className="text-2xl font-display font-bold text-slate-900">Credit & Collections</h1>
        <p className="text-sm text-slate-500 mt-1">Company-wide chemist credit exposure and collections</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={IndianRupee} label="Today's Collection" value={currency(data.todaysCollection)} tone="good" />
        <Tile icon={Wallet} label="Total Outstanding" value={currency(data.totalOutstanding)} tone={data.totalOutstanding > 0 ? "warn" : "good"} />
        <Tile icon={AlertTriangle} label="Approaching Limit" value={String(data.warningCount)} tone={data.warningCount > 0 ? "warn" : "good"} />
        <Tile icon={ShieldAlert} label="Over Limit" value={String(data.breachedCount)} tone={data.breachedCount > 0 ? "warn" : "good"} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search chemist, representative or territory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "OK", "WARNING", "BREACHED", "NO_LIMIT"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === status
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status === "ALL" ? "All Statuses" : status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="px-6 py-3 font-semibold">Chemist</th>
              <th className="px-6 py-3 font-semibold">MR / Territory</th>
              <th className="px-6 py-3 font-semibold">Credit Limit</th>
              <th className="px-6 py-3 font-semibold">Outstanding</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredChemists.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                  No chemists found.
                </td>
              </tr>
            )}
            {filteredChemists.map((c) => {
              const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.NO_LIMIT;
              return (
                <tr key={c.chemistId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <p>{c.mr}</p>
                    <p className="text-xs text-slate-400">{c.territory}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{c.creditLimit !== null ? currency(c.creditLimit) : "—"}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{currency(c.outstanding)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${s.badge}`}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Recent Collections Logged (Company-wide)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 font-semibold">Date & Time</th>
                <th className="px-6 py-3 font-semibold">Logged By (MR)</th>
                <th className="px-6 py-3 font-semibold">Chemist Name</th>
                <th className="px-6 py-3 font-semibold">Ref Number</th>
                <th className="px-6 py-3 font-semibold text-right">Amount Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data.collectionsList || data.collectionsList.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No collections logged recently.
                  </td>
                </tr>
              )}
              {data.collectionsList?.map((col: any) => (
                <tr
                  key={col.id}
                  onClick={() => setViewingCollection(col)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(col.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {col.employee ? `${col.employee.firstName} ${col.employee.lastName}` : "System / Unknown"}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{col.chemist?.name || "Unknown Chemist"}</td>
                  <td className="px-6 py-4 font-mono text-slate-650">{col.refNumber || "CASH"}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{currency(col.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingCollection && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewingCollection(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-slate-900 text-lg">{viewingCollection.chemist?.name || "Unknown Chemist"}</p>
              <button onClick={() => setViewingCollection(null)} className="text-slate-400 hover:text-red-500 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">View only — collections are owned by the logging MR.</p>
            <div className="border-t border-slate-100 pt-1">
              <CollectionFormRow
                label="Logged By"
                value={viewingCollection.employee ? `${viewingCollection.employee.firstName} ${viewingCollection.employee.lastName}` : "System / Unknown"}
              />
              <CollectionFormRow label="Amount Collected" value={currency(viewingCollection.amount)} />
              <CollectionFormRow label="Ref Number" value={viewingCollection.refNumber || "CASH"} />
              <CollectionFormRow
                label="Date & Time"
                value={new Date(viewingCollection.createdAt).toLocaleString("en-IN")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionFormRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function Tile({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: "good" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 mt-3">{value}</p>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
