"use client";

import React, { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle2, ShieldCheck, Package } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ClaimModalProps {
  onClose: () => void;
  onClaimCreated: () => void;
}

interface ChemistOption {
  id: string;
  name: string;
  territoryId: string;
}

interface DistributorOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

export function RaiseClaimModal({ onClose, onClaimCreated }: ClaimModalProps) {
  const [chemists, setChemists] = useState<ChemistOption[]>([]);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  
  const [chemistId, setChemistId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("Near Expiry Return (Audited by MR)");
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [chemRes, distRes, prodRes] = await Promise.all([
          apiClient.get<any>("/api/mr/entities?type=chemist").catch(() => null),
          apiClient.get<any>("/api/mr/entities?type=distributor").catch(() => null),
          apiClient.get<any>("/api/products").catch(() => null),
        ]);

        if (chemRes?.data?.chemists) setChemists(chemRes.data.chemists);
        if (distRes?.data?.distributors) setDistributors(distRes.data.distributors);
        if (prodRes?.data?.products) setProducts(prodRes.data.products);
      } catch (err) {
        console.warn("Failed to fetch claim form options", err);
      } finally {
        setFetching(false);
      }
    }
    loadOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chemistId || !distributorId || !productId || !quantity || !reason) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.post("/api/mr/claims", {
        chemistId,
        distributorId,
        productId,
        quantity: parseInt(quantity, 10),
        reason,
      });
      setSuccess(true);
      setTimeout(() => {
        onClaimCreated();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Failed to raise claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Raise Stock Expiry/Damage Claim</h3>
              <p className="text-xs text-slate-500">Audited by MR on behalf of Retail Chemist</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Claim Logged Successfully!</h4>
            <p className="text-xs text-slate-600">The claim is recorded as PENDING_MR and forwarded for ASM approval.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Chemist / Pharmacy *</label>
              <select
                value={chemistId}
                onChange={(e) => setChemistId(e.target.value)}
                required
                disabled={fetching}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Chemist...</option>
                {chemists.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Stockist / Distributor *</label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                required
                disabled={fetching}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Distributor...</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="font-bold text-slate-700">Product SKU *</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  disabled={fetching}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Units (Qty) *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Return Reason / MR Audit Notes *</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. Broken in transit / Expired stock return"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Claim"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
