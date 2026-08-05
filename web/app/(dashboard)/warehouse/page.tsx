"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Box,
  MapPin,
  Clock,
  Search,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface PendingDispatch {
  id: string;
  orderId: string;
  distributor: string;
  location: string;
  itemsCount: number;
  status: "PACKING" | "READY";
  createdAt: string;
}

interface StockAlert {
  id: string;
  productName: string;
  sku: string;
  currentStock: number;
  minThreshold: number;
}

interface WarehouseData {
  kpis: {
    pendingDispatches: number;
    shippedToday: number;
    lowStockAlerts: number;
    samplesDistributed: number;
  };
  dispatches: PendingDispatch[];
  alerts: StockAlert[];
}

export default function WarehouseDashboard() {
  const [data, setData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    apiClient
      .get("/api/warehouse/dashboard")
      .then((res) => setData(res.data.data))
      .catch((err) => {
        console.error("Failed to load warehouse dashboard:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load warehouse data. Check your connection and try again.";
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const advance = async (dispatch: PendingDispatch) => {
    const nextStatus = dispatch.status === "PACKING" ? "CONFIRMED" : "SHIPPED";
    setBusyId(dispatch.id);
    try {
      await apiClient.put(`/api/orders/${dispatch.id}`, { status: nextStatus });
      load();
    } catch (err) {
      console.error("Failed to advance dispatch:", err);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="bg-rose-50 rounded-2xl p-12 text-center border border-rose-200">
        <p className="text-rose-700 text-sm font-semibold">{loadError ?? "No data."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-100 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Warehouse Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage inventory, dispatches, and fulfillment</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Inventory Report
          </button>
          <button className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-900 shadow-sm transition-colors">
            Scan Barcode
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Package} label="Pending Dispatches" value={data.kpis.pendingDispatches} tone="warn" />
        <KpiTile icon={Truck} label="Shipped Today" value={data.kpis.shippedToday} tone="good" />
        <KpiTile icon={AlertTriangle} label="Low Stock Alerts" value={data.kpis.lowStockAlerts} tone={data.kpis.lowStockAlerts > 0 ? "warn" : "neutral"} />
        <KpiTile icon={Box} label="Samples Distributed" value={data.kpis.samplesDistributed} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dispatch Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Fulfillment Queue</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent w-48"
                />
              </div>
              <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
                <Filter size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold">Order / Dispatch</th>
                  <th className="px-6 py-3 font-semibold">Destination</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.dispatches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No orders pending dispatch.
                    </td>
                  </tr>
                )}
                {data.dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{dispatch.orderId}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{dispatch.itemsCount} units</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{dispatch.distributor}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {dispatch.location}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${dispatch.status === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {dispatch.status === 'READY' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {dispatch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => advance(dispatch)}
                        disabled={busyId === dispatch.id}
                        className="text-xs font-semibold text-white bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                      >
                        {busyId === dispatch.id ? "..." : dispatch.status === 'READY' ? 'Mark Shipped' : 'Pack'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Inventory Alerts */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Low Inventory Alerts
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            {data.alerts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">All stock above threshold.</p>
            )}
            {data.alerts.map((alert) => {
              const percent = Math.round((alert.currentStock / alert.minThreshold) * 100);
              return (
                <div key={alert.id} className="p-4 rounded-xl border border-red-100 bg-red-50/30 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                  <div className="pl-2">
                    <h3 className="text-sm font-bold text-slate-900">{alert.productName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{alert.sku}</p>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-red-600">{alert.currentStock.toLocaleString()} in stock</span>
                        <span className="text-slate-500">Min: {alert.minThreshold.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-red-100 rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="w-full py-2.5 mt-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Raise Purchase Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = "neutral" }: { icon: LucideIcon; label: string; value: number | string; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-700" : tone === "good" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 mt-4">{value.toLocaleString()}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
