"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Clock,
  IndianRupee,
  Receipt,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Dashboard {
  distributor: {
    id: string;
    name: string;
    territory: { id: string; name: string; zone: string; region: string } | null;
  };
  totalOrders: number;
  pendingOrders: number;
  monthlyOrderValue: number;
  invoices: {
    total: number;
    outstanding: number;
    creditLimit: number | null;
    utilizationPercent: number | null;
  };
  pendingClaims: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  product: { id: string; name: string; sku: string };
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  chemist: { id: string; name: string } | null;
  items: OrderItem[];
  invoice: { invoiceNo: string; amount: string; paid: boolean } | null;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  amount: string;
  paid: boolean;
  createdAt: string;
  order: { id: string; status: string; chemist: { id: string; name: string } | null };
}

interface Claim {
  id: string;
  quantity: number;
  reason: string;
  status: string;
  createdAt: string;
  chemist: { id: string; name: string };
  product: { id: string; name: string; sku: string };
  creditNote: { number: string; amount: string } | null;
}

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  SHIPPED: "bg-purple-50 text-purple-600",
  DELIVERED: "bg-primary-50 text-primary-700",
  CANCELLED: "bg-red-50 text-red-600",
};

const CLAIM_STATUS_STYLES: Record<string, string> = {
  PENDING_MR: "bg-amber-50 text-amber-600",
  PENDING_ASM: "bg-amber-50 text-amber-600",
  APPROVED: "bg-blue-50 text-blue-600",
  COMPLETED: "bg-primary-50 text-primary-700",
  REJECTED: "bg-red-50 text-red-600",
};

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function DistributorPortalPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setError(null);
      const [d, o, i, c] = await Promise.all([
        apiClient.get("/api/distributor/dashboard"),
        apiClient.get("/api/distributor/orders"),
        apiClient.get("/api/distributor/invoices"),
        apiClient.get("/api/distributor/claims"),
      ]);
      setDashboard(d.data.data);
      setOrders(o.data.data.orders || []);
      setInvoices(i.data.data.invoices || []);
      setClaims(c.data.data.claims || []);
    } catch (err: any) {
      console.error("Failed to load distributor portal:", err);
      setError(err?.response?.data?.error?.message ?? "Failed to load distributor portal data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const advanceStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    setError(null);
    try {
      await apiClient.put("/api/distributor/orders", { orderId, status: nextStatus });
      await fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
        <p className="text-gray-400 text-sm">Unable to load the distributor portal.</p>
      </div>
    );
  }

  const utilization = dashboard.invoices.utilizationPercent;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Distributor Portal</h1>
        {dashboard.distributor.territory ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="font-semibold text-primary-700">
              {dashboard.distributor.territory.name}
            </span>
            <span className="text-gray-300">·</span>
            <span>{dashboard.distributor.territory.zone} Zone</span>
            <span className="text-gray-300">·</span>
            <span>{dashboard.distributor.territory.region} Region</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-1">{dashboard.distributor.name}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile icon={Package} label="Total Orders" value={dashboard.totalOrders} />
        <Tile
          icon={Clock}
          label="Pending Orders"
          value={dashboard.pendingOrders}
          tone={dashboard.pendingOrders > 0 ? "warn" : "good"}
        />
        <Tile
          icon={IndianRupee}
          label="Order Value"
          value={currency(dashboard.monthlyOrderValue)}
          sub="This month"
        />
        <Tile
          icon={Receipt}
          label="Outstanding"
          value={currency(dashboard.invoices.outstanding)}
          sub={
            utilization !== null
              ? `${utilization}% of ${currency(dashboard.invoices.creditLimit!)} limit`
              : "No credit limit set"
          }
          tone={utilization !== null && utilization >= 90 ? "warn" : "neutral"}
        />
        <Tile
          icon={ShieldAlert}
          label="Pending Claims"
          value={dashboard.pendingClaims}
          tone={dashboard.pendingClaims > 0 ? "warn" : "good"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Orders</h2>
        {orders.length === 0 ? (
          <EmptyCard message="No orders yet." />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Chemist</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Value</th>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const total = order.items.reduce(
                    (sum, i) => sum + Number(i.price) * i.quantity,
                    0
                  );
                  const next = NEXT_STATUS[order.status];
                  return (
                    <tr key={order.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {order.chemist?.name ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {order.items.map((i) => `${i.product.name} x${i.quantity}`).join(", ")}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{currency(total)}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {order.invoice ? (
                          <Link
                            href={`/invoices/${order.id}`}
                            className={`hover:underline ${order.invoice.paid ? "text-primary-600" : "text-amber-600"}`}
                          >
                            {order.invoice.invoiceNo} · {order.invoice.paid ? "Paid" : "Unpaid"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${ORDER_STATUS_STYLES[order.status] ?? "bg-gray-50 text-gray-600"}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {next && (
                          <button
                            onClick={() => advanceStatus(order.id, next)}
                            disabled={updatingId !== null}
                            className="bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                          >
                            {updatingId === order.id ? "Updating..." : `Mark ${next}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Invoices</h2>
        {invoices.length === 0 ? (
          <EmptyCard message="No invoices raised yet." />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Invoice No</th>
                  <th className="px-6 py-3">Chemist</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Order Status</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      <Link href={`/invoices/${inv.order.id}`} className="hover:text-primary-600 hover:underline">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{inv.order.chemist?.name ?? "—"}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{currency(inv.amount)}</td>
                    <td className="px-6 py-4 text-gray-600">{inv.order.status}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${inv.paid ? "bg-primary-50 text-primary-700" : "bg-amber-50 text-amber-600"}`}
                      >
                        {inv.paid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Claims &amp; Returns
        </h2>
        {claims.length === 0 ? (
          <EmptyCard message="No claims on record." />
        ) : (
          <div className="space-y-2">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex justify-between items-center gap-4"
              >
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {claim.product.name} x{claim.quantity} · {claim.chemist.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {claim.reason}
                    {claim.creditNote && ` · Credit note ${claim.creditNote.number} (${currency(claim.creditNote.amount)})`}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${CLAIM_STATUS_STYLES[claim.status] ?? "bg-gray-50 text-gray-600"}`}
                >
                  {claim.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50 text-amber-600"
      : tone === "good"
        ? "bg-primary-50 text-primary-600"
        : "bg-gray-50 text-gray-500";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-display font-bold text-gray-900 mt-3">{value}</p>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
