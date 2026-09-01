"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calculator,
  Percent,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Package,
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

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export default function SimulatorDashboard() {
  const [discount, setDiscount] = useState<number>(10);
  const [volume, setVolume] = useState<number>(5000);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [projection, setProjection] = useState<Projection | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

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

  // Simulate whenever inputs change
  const simulate = useCallback(() => {
    if (!selectedProductId) return;
    setSimulating(true);
    setSimError(null);
    apiClient.post("/api/simulator/scheme", { productId: selectedProductId, quantity: volume, discountPercent: discount })
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
  }, [selectedProductId, volume, discount]);

  useEffect(() => {
    const timer = setTimeout(simulate, 400);
    return () => clearTimeout(timer);
  }, [simulate]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100 flex justify-between items-center bg-gradient-to-r from-fuchsia-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Scheme Simulator</h1>
          <p className="text-sm text-slate-500 mt-1">Live what-if analysis using real product pricing</p>
        </div>
        <div className="p-3 bg-fuchsia-100 rounded-xl text-fuchsia-600">
          <Calculator size={24} />
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 rounded-2xl p-4 text-center border border-rose-200">
          <p className="text-rose-700 text-sm font-semibold">{loadError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8">
          {/* Product Selector */}
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Package className="text-fuchsia-600" size={18} /> Product
            </h3>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
            {product && (
              <div className="mt-3 flex gap-4 text-xs text-slate-500 font-medium">
                <span>MRP: <strong className="text-slate-700">₹{product.mrp}</strong></span>
                <span>PTR: <strong className="text-slate-700">₹{product.ptr}</strong></span>
                <span>PTS: <strong className="text-slate-700">₹{product.pts}</strong></span>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Percent className="text-fuchsia-600" size={18} />
              Discount off PTR: {discount}%
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
              <span>0%</span>
              <span>40%</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <TrendingUp className="text-fuchsia-600" size={18} />
              Projected Volume: {volume.toLocaleString()} units
            </h3>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-600"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
              <span>1,000</span>
              <span>20,000</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className={`rounded-2xl shadow-sm border p-6 text-white flex flex-col justify-center space-y-6 transition-colors ${projection?.marginNegative ? 'bg-red-900 border-red-800' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Live Projection Results</h3>
            {simulating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          </div>

          {simError && (
            <div className="flex items-center gap-2 bg-red-800/50 rounded-xl p-3 border border-red-700">
              <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
              <p className="text-red-200 text-xs font-semibold">{simError}</p>
            </div>
          )}

          {projection?.marginNegative && (
            <div className="flex items-center gap-2 bg-red-800/50 rounded-xl p-3 border border-red-700">
              <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
              <p className="text-red-200 text-xs font-semibold">Margin Negative! Discounted PTR (₹{projection.discountedPtr.toFixed(2)}) is below PTS. Scheme not viable.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Discounted PTR</p>
              <p className="text-2xl font-bold text-slate-300">
                {projection ? `₹${projection.discountedPtr.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Retailer Margin</p>
              <p className="text-2xl font-bold text-white">
                {projection ? `${projection.retailerMarginPercent.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="col-span-2 pt-4 border-t border-slate-800">
              <p className="text-slate-400 text-sm mb-1">Total Net Margin</p>
              <div className="flex items-end gap-3">
                <p className={`text-4xl font-bold ${projection && projection.schemeTotalMargin > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {projection ? formatCurrency(projection.schemeTotalMargin) : "—"}
                </p>
                {projection && (
                  <p className="text-lg font-semibold text-slate-500 mb-1">
                    (₹{projection.schemeUnitMargin.toFixed(2)}/unit)
                  </p>
                )}
              </div>
            </div>
          </div>

          <button className="w-full mt-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={!projection || projection.marginNegative}>
            Save Scheme Model <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
