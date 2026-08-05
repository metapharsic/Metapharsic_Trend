"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Product {
  id: string;
  name: string;
  sku: string;
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

function currency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SimulatorPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiClient
      .get("/api/products?limit=200")
      .then((res) => {
        const list = res.data.data.products || [];
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id);
      })
      .catch((err) => console.error("Failed to fetch products:", err));
  }, []);

  const simulate = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await apiClient.post("/api/simulator/scheme", {
        productId,
        quantity,
        discountPercent,
      });
      setProjection(res.data.data.projection);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Simulation failed");
      setProjection(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Scheme Margin Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Project margin impact of a stockist discount before publishing it.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Discount %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <button
          onClick={simulate}
          disabled={running || !productId}
          className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {running ? "Simulating..." : "Run Simulation"}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {projection && (
        <div className="space-y-4">
          {projection.marginNegative && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
              <p className="text-sm font-semibold text-red-700">
                This discount pushes the stockist margin negative — selling below PTS.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Discounted PTR" value={currency(projection.discountedPtr)} />
            <MetricCard
              label="Unit Margin"
              value={currency(projection.schemeUnitMargin)}
              sub={`was ${currency(projection.baseUnitMargin)}`}
            />
            <MetricCard
              label="Total Margin"
              value={currency(projection.schemeTotalMargin)}
              sub={`was ${currency(projection.baseTotalMargin)}`}
            />
            <MetricCard
              label="Margin Impact"
              value={currency(projection.totalMarginDelta)}
              sub={projection.totalMarginDelta < 0 ? "Margin given away" : "Margin gained"}
              negative={projection.totalMarginDelta < 0}
            />
            <MetricCard label="Scheme Margin %" value={`${projection.schemeMarginPercent}%`} sub={`was ${projection.baseMarginPercent}%`} />
            <MetricCard label="Retailer Margin %" value={`${projection.retailerMarginPercent}%`} sub="off MRP" />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-xl font-display font-bold mt-2 ${negative ? "text-red-600" : "text-gray-900"}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
