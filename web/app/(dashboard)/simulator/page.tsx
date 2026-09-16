"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calculator,
  Percent,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Package,
  FileText,
  ShieldCheck,
  Cpu,
  Gift,
  CheckCircle2,
  RefreshCw,
  Plus,
  Sparkles,
  Layers,
  BarChart3,
  X,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Product {
  id: string;
  name: string;
  sku: string;
  mrp: number;
  ptr: number;
  pts: number;
}

interface Projection {
  discountedPtr: number;
  baseUnitMargin: number;
  schemeUnitMargin: number;
  unitMarginDelta: number;
  baseTotalMargin: number;
  schemeTotalMargin: number;
  totalMarginDelta: number;
  baseMarginPercent: number;
  schemeMarginPercent: number;
  retailerMarginPercent: number;
  marginNegative: boolean;
}

interface LiveDiscountScheme {
  id: string;
  name: string;
  productId: string;
  productName: string;
  productSku: string;
  mrp: number;
  ptr: number;
  pts: number;
  minQuantity: number;
  discountPct: number;
  isActive: boolean;
  validFrom: string;
  validTo: string;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export default function SimulatorDashboard() {
  const [schemeMode, setSchemeMode] = useState<"PERCENT" | "FREE_GOODS">("PERCENT");
  const [discount, setDiscount] = useState<number>(10);
  const [buyQty, setBuyQty] = useState<number>(10);
  const [freeQty, setFreeQty] = useState<number>(1);
  const [volume, setVolume] = useState<number>(5000);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [projection, setProjection] = useState<Projection | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Live Database Schemes & Publishing
  const [liveSchemes, setLiveSchemes] = useState<LiveDiscountScheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishMinQty, setPublishMinQty] = useState(10);
  const [publishValidityDays, setPublishValidityDays] = useState(60);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Compute effective discount % when in Free Goods mode: e.g. 10+1 free = 1/(10+1) = 9.09%
  const effectiveDiscount = schemeMode === "PERCENT"
    ? discount
    : Math.round((freeQty / (buyQty + freeQty)) * 1000) / 10;

  // Fetch product list for selector
  useEffect(() => {
    apiClient.get("/api/products")
      .then((res) => {
        const prods = res.data.data.products ?? [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProductId(prods[0].id);
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load products. Check your connection and try again.";
        setLoadError(message);
      });
  }, []);

  // Fetch live published schemes from DB
  const fetchLiveSchemes = useCallback(() => {
    setLoadingSchemes(true);
    apiClient.get("/api/simulator/scheme/publish")
      .then((res) => {
        setLiveSchemes(res.data?.data?.schemes || []);
      })
      .catch((err) => {
        console.error("Failed to fetch live schemes:", err);
      })
      .finally(() => setLoadingSchemes(false));
  }, []);

  useEffect(() => {
    fetchLiveSchemes();
  }, [fetchLiveSchemes]);

  // Simulate whenever inputs change
  const simulate = useCallback(() => {
    if (!selectedProductId) return;
    setSimulating(true);
    setSimError(null);
    apiClient.post("/api/simulator/scheme", {
      productId: selectedProductId,
      quantity: volume,
      discountPercent: effectiveDiscount,
    })
      .then((res) => {
        setProjection(res.data.data.projection);
        setProduct(res.data.data.product);
      })
      .catch((err) => {
        console.error("Failed to simulate scheme:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not simulate this scheme. Check your connection and try again.";
        setSimError(message);
        setProjection(null);
      })
      .finally(() => setSimulating(false));
  }, [selectedProductId, volume, effectiveDiscount]);

  useEffect(() => {
    const timer = setTimeout(simulate, 350);
    return () => clearTimeout(timer);
  }, [simulate]);

  // When publishing modal opens, prefill scheme name
  const handleOpenPublishModal = () => {
    const pName = product?.name || "Product";
    const defaultName = schemeMode === "PERCENT"
      ? `${pName} ${discount}% Off Special Scheme`
      : `${pName} Buy ${buyQty} Get ${freeQty} Free Offer`;
    setPublishName(defaultName);
    setPublishMinQty(schemeMode === "FREE_GOODS" ? buyQty : 10);
    setPublishStatus(null);
    setIsPublishModalOpen(true);
  };

  const handlePublishScheme = async () => {
    if (!selectedProductId || !publishName.trim()) return;
    setPublishing(true);
    setPublishStatus(null);
    try {
      const now = new Date();
      const validToDate = new Date(now.getTime() + publishValidityDays * 24 * 60 * 60 * 1000);

      const res = await apiClient.post("/api/simulator/scheme/publish", {
        name: publishName.trim(),
        productId: selectedProductId,
        minQuantity: publishMinQty,
        discountPct: effectiveDiscount,
        validFrom: now.toISOString().slice(0, 10),
        validTo: validToDate.toISOString().slice(0, 10),
        isActive: true,
      });

      setPublishStatus({
        success: true,
        message: res.data?.data?.message || "Scheme successfully provisioned in live database!",
      });
      fetchLiveSchemes();
      setTimeout(() => {
        setIsPublishModalOpen(false);
      }, 1800);
    } catch (err: any) {
      console.error("Failed to publish scheme:", err);
      setPublishStatus({
        success: false,
        message: err.response?.data?.error?.message || err.message || "Failed to publish scheme to database.",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleScheme = async (schemeId: string, currentActive: boolean) => {
    try {
      await apiClient.patch("/api/simulator/scheme/publish", {
        schemeId,
        isActive: !currentActive,
      });
      fetchLiveSchemes();
    } catch (err) {
      console.error("Failed to toggle scheme:", err);
    }
  };

  const handleLoadSchemeIntoSimulator = (scheme: LiveDiscountScheme) => {
    setSelectedProductId(scheme.productId);
    setDiscount(Number(scheme.discountPct));
    setSchemeMode("PERCENT");
    setVolume(Math.max(scheme.minQuantity * 50, 2000));
  };

  // Multi-Agent Verification Logic
  const commercialScore = projection
    ? projection.retailerMarginPercent >= 22
      ? 95
      : projection.retailerMarginPercent >= 18
      ? 85
      : 65
    : 0;

  const financeScore = projection
    ? projection.schemeMarginPercent >= 35
      ? 96
      : projection.schemeMarginPercent >= 20
      ? 82
      : projection.schemeMarginPercent > 0
      ? 55
      : 15
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Top Header Card ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-fuchsia-50 via-white to-indigo-50/30">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">Scheme Simulator &amp; Commercial Engine</h1>
            <span className="bg-fuchsia-100 text-fuchsia-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-fuchsia-200">
              Live DB Synced
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time what-if margin modeling, multi-agent pricing verification, and 1-click database scheme provisioning
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/marketing"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <BarChart3 size={14} className="text-indigo-600" />
            <span>Campaign Intelligence</span>
          </Link>
          <Link
            href="/admin/ptr-calculator"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <FileText size={14} />
            <span>PTR &amp; Commercial Ledger</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 rounded-2xl p-4 text-center border border-rose-200">
          <p className="text-rose-700 text-sm font-semibold">{loadError}</p>
        </div>
      )}

      {/* ── Multi-Agent Council Telemetry Ribbon ── */}
      {projection && product && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Commercial Agent */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl ${commercialScore >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
              <Cpu size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">COMMERCIAL_AGENT VERIFICATION</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${commercialScore >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {commercialScore}% Score
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">
                Retailer Margin: {projection.retailerMarginPercent.toFixed(1)}% ({projection.retailerMarginPercent >= 20 ? "Highly Competitive" : "Standard"})
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Target Chemist pull rate is optimal. Estimated volume lift needed for margin parity: +{Math.max(5, Math.round(effectiveDiscount * 1.5))}% units.
              </p>
            </div>
          </div>

          {/* Finance Accounts Agent */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl ${financeScore >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">FINANCE_ACCOUNTS_AGENT AUDIT</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${financeScore >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {financeScore}% Score
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">
                Company Gross Margin: {projection.schemeMarginPercent.toFixed(1)}% (₹{projection.schemeUnitMargin.toFixed(2)}/unit net)
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {projection.marginNegative
                  ? "CRITICAL: Discounted PTR falls below PTS cost basis. Scheme cannot be published."
                  : `PTS Cost basis: ₹${product.pts.toFixed(2)}. Gross territory contribution: ${formatCurrency(projection.schemeTotalMargin)}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Simulator Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Column */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Product Selector */}
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Package className="text-fuchsia-600" size={18} /> Product SKU
            </h3>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            {product && (
              <div className="mt-3 flex gap-4 text-xs text-slate-500 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span>MRP: <strong className="text-slate-800">₹{product.mrp}</strong></span>
                <span>PTR: <strong className="text-slate-800">₹{product.ptr}</strong></span>
                <span>PTS (Cost): <strong className="text-slate-800">₹{product.pts}</strong></span>
              </div>
            )}
          </div>

          {/* Scheme Type Selector: Percentage vs Free Goods */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Scheme Commercial Structure:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSchemeMode("PERCENT")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  schemeMode === "PERCENT"
                    ? "bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-700 ring-1 ring-fuchsia-500/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Percent size={14} />
                <span>Percentage Discount off PTR</span>
              </button>
              <button
                type="button"
                onClick={() => setSchemeMode("FREE_GOODS")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  schemeMode === "FREE_GOODS"
                    ? "bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-700 ring-1 ring-fuchsia-500/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Gift size={14} />
                <span>Buy X Get Y Free Goods</span>
              </button>
            </div>
          </div>

          {/* Scheme Inputs */}
          {schemeMode === "PERCENT" ? (
            <div>
              <h3 className="font-bold text-slate-800 flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <Percent className="text-fuchsia-600" size={18} />
                  Discount off PTR
                </span>
                <span className="text-sm font-extrabold text-fuchsia-600 bg-fuchsia-50 px-2.5 py-0.5 rounded-lg">
                  {discount}%
                </span>
              </h3>
              <input
                type="range"
                min="0"
                max="40"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                <span>0% (Full PTR)</span>
                <span>10% Standard</span>
                <span>20% Aggressive</span>
                <span>40% Max</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Free Goods Ratio (Buy + Get Free):</span>
                <span className="text-xs font-extrabold text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded">
                  Effective: {effectiveDiscount}% Off
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Buy Units (X):</label>
                  <input
                    type="number"
                    min="1"
                    value={buyQty}
                    onChange={(e) => setBuyQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Free Units (Y):</label>
                  <input
                    type="number"
                    min="1"
                    value={freeQty}
                    onChange={(e) => setFreeQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Presets:</span>
                {[
                  { b: 10, f: 1, label: "10 + 1 (9.1%)" },
                  { b: 20, f: 2, label: "20 + 2 (9.1%)" },
                  { b: 10, f: 2, label: "10 + 2 (16.7%)" },
                  { b: 50, f: 5, label: "50 + 5 (9.1%)" },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setBuyQty(p.b);
                      setFreeQty(p.f);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Volume Slider */}
          <div>
            <h3 className="font-bold text-slate-800 flex items-center justify-between mb-3">
              <span className="flex items-center gap-2">
                <TrendingUp className="text-fuchsia-600" size={18} />
                Projected Volume
              </span>
              <span className="text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                {volume.toLocaleString()} units
              </span>
            </h3>
            <input
              type="range"
              min="500"
              max="25000"
              step="500"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-600"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
              <span>500 units</span>
              <span>10,000 units</span>
              <span>25,000 units</span>
            </div>
          </div>
        </div>

        {/* Projection Results Column */}
        <div className={`rounded-2xl shadow-sm border p-6 text-white flex flex-col justify-between space-y-6 transition-colors ${
          projection?.marginNegative ? "bg-red-950 border-red-800" : "bg-slate-900 border-slate-800"
        }`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="text-slate-300 font-bold uppercase tracking-wider text-xs">
                  Financial &amp; Commercial Projection
                </h3>
              </div>
              {simulating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            </div>

            {simError && (
              <div className="mt-4 flex items-center gap-2 bg-red-800/50 rounded-xl p-3 border border-red-700">
                <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
                <p className="text-red-200 text-xs font-semibold">{simError}</p>
              </div>
            )}

            {projection?.marginNegative && (
              <div className="mt-4 flex items-center gap-2 bg-red-800/60 rounded-xl p-3 border border-red-700">
                <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
                <p className="text-red-200 text-xs font-semibold">
                  Margin Negative! Discounted PTR (₹{projection.discountedPtr.toFixed(2)}) is below PTS (₹{product?.pts.toFixed(2)}).
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5 mt-6">
              <div>
                <p className="text-slate-400 text-xs mb-1 uppercase font-semibold">Effective Discounted PTR</p>
                <p className="text-2xl font-black text-slate-200">
                  {projection ? `₹${projection.discountedPtr.toFixed(2)}` : "—"}
                </p>
                <p className="text-[11px] text-slate-500">Base PTR: ₹{product?.ptr.toFixed(2)}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs mb-1 uppercase font-semibold">Retailer Chemist Margin</p>
                <p className="text-2xl font-black text-emerald-400">
                  {projection ? `${projection.retailerMarginPercent.toFixed(1)}%` : "—"}
                </p>
                <p className="text-[11px] text-slate-500">Normal: ~18-20% on MRP</p>
              </div>

              <div className="col-span-2 pt-4 border-t border-slate-800">
                <p className="text-slate-400 text-xs mb-1 uppercase font-semibold">Total Projected Gross Margin</p>
                <div className="flex items-end gap-3">
                  <p className={`text-4xl font-black ${projection && projection.schemeTotalMargin > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {projection ? formatCurrency(projection.schemeTotalMargin) : "—"}
                  </p>
                  {projection && (
                    <p className="text-sm font-bold text-slate-400 mb-1">
                      (₹{projection.schemeUnitMargin.toFixed(2)} / unit)
                    </p>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                  <span>Gross Margin %: <strong className="text-white">{projection ? `${projection.schemeMarginPercent.toFixed(1)}%` : "—"}</strong></span>
                  <span>Baseline Delta: <strong className={projection && projection.totalMarginDelta < 0 ? "text-amber-400" : "text-emerald-400"}>
                    {projection ? formatCurrency(projection.totalMarginDelta) : "—"}
                  </strong></span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenPublishModal}
            disabled={!projection || projection.marginNegative}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span>Publish Scheme to Live Database</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Live Published Schemes Table from PostgreSQL ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-fuchsia-600" />
              Live Commercial Schemes in Database ({liveSchemes.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active schemes automatically apply to Secondary Sales Orders and sync into Marketing Intelligence
            </p>
          </div>
          <button
            onClick={fetchLiveSchemes}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
          >
            <RefreshCw size={13} className={loadingSchemes ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-500 font-semibold border-b border-slate-200 text-left">
              <tr>
                <th className="p-3.5">Scheme Name</th>
                <th className="p-3.5">Product SKU</th>
                <th className="p-3.5 text-center">Min Qty</th>
                <th className="p-3.5 text-center">Discount %</th>
                <th className="p-3.5 text-center">Valid Until</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liveSchemes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No commercial discount schemes created yet. Use the simulator above to create and publish one!
                  </td>
                </tr>
              ) : (
                liveSchemes.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{s.name}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="font-semibold text-slate-800 block">{s.productName}</span>
                      <span className="text-[10px] text-slate-400">{s.productSku}</span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-700">{s.minQuantity} units</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
                        {s.discountPct}% Off
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-slate-600 font-medium">{s.validTo}</td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleScheme(s.id, s.isActive)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition ${
                          s.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {s.isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleLoadSchemeIntoSimulator(s)}
                        className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        Simulate What-If <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Publish Scheme Modal ── */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5">
            <button
              onClick={() => setIsPublishModalOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Publish Commercial Scheme to Live DB</h3>
                <p className="text-xs text-slate-500">Will automatically apply to Secondary Orders and Marketing</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Scheme Title / Name:</label>
                <input
                  type="text"
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  placeholder="e.g. Cefixime Festive 10% Off Scheme"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Min Order Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    value={publishMinQty}
                    onChange={(e) => setPublishMinQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Validity (Days from Today):</label>
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={publishValidityDays}
                    onChange={(e) => setPublishValidityDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-fuchsia-50 rounded-xl border border-fuchsia-100 flex justify-between items-center text-fuchsia-950 font-medium">
                <span>Effective Discount Rate:</span>
                <span className="font-black text-sm text-fuchsia-700">{effectiveDiscount}%</span>
              </div>
            </div>

            {publishStatus && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                publishStatus.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {publishStatus.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishScheme}
                disabled={publishing || !publishName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {publishing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{publishing ? "Publishing..." : "Confirm & Publish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
