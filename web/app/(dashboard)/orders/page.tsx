"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  PackageCheck,
  Truck,
  CheckCircle,
  Plus,
  X,
  Trash2,
  Printer,
  Receipt,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  product: { id: string; name: string; sku: string };
}

interface Order {
  id: string;
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  chemist: { id: string; name: string } | null;
  distributor: { id: string; name: string } | null;
  items: OrderItem[];
  invoice: { invoiceNo: string; amount: string; paid: boolean } | null;
  chemistOutstanding: number | null;
}

interface Entity {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
  ptr: string | null;
  mrp: string | null;
}

interface InvoiceRow {
  id: string;
  orderId: string;
  invoiceNo: string;
  amount: string;
  paid: boolean;
  createdAt: string;
  order: {
    id: string;
    status: string;
    chemist: { id: string; name: string } | null;
    distributor: { id: string; name: string } | null;
    items: OrderItem[];
  } | null;
  revenue: number;
  cost: number;
  profitAmount: number;
  profitPct: number | null;
}

interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InvoiceTotals {
  profitAmount: number;
  revenue: number;
}

interface InvoicesResponse {
  invoices: InvoiceRow[];
  pagination: InvoicePagination;
  totals: InvoiceTotals;
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function profitColor(value: number): string {
  if (value < 0) return "text-red-600";
  if (value > 0) return "text-emerald-600";
  return "text-slate-500";
}

function orderValue(order: Order): number {
  return order.items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
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
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

const EDITABLE_STATUSES = ["PENDING", "CONFIRMED"];

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<any | null>(null);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  const [activeTab, setActiveTab] = useState<"orders" | "invoices" | "history">("orders");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicePagination, setInvoicePagination] = useState<InvoicePagination | null>(null);
  const [invoiceTotals, setInvoiceTotals] = useState<InvoiceTotals | null>(null);
  const [invoiceQ, setInvoiceQ] = useState("");
  const [invoiceCustomer, setInvoiceCustomer] = useState("");
  const [invoicePaid, setInvoicePaid] = useState<"" | "true" | "false">("");
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({ PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 });

  const load = (page = ordersPage) => {
    setLoading(true);
    apiClient
      .get("/api/orders/secondary", { params: { page, limit: 20 } })
      .then((res) => {
        setOrders(res.data.data.orders);
        setOrdersTotal(res.data.data.pagination.total);
        setOrdersTotalPages(res.data.data.pagination.totalPages);
        setStatusCounts(res.data.data.statusCounts);
      })
      .catch((err) => console.error("Failed to load orders:", err))
      .finally(() => setLoading(false));
  };

  const loadInvoices = () => {
    setInvoicesLoading(true);
    const params: Record<string, string> = {};
    if (invoiceQ.trim()) params.q = invoiceQ.trim();
    if (invoiceCustomer.trim()) params.customer = invoiceCustomer.trim();
    if (invoicePaid) params.paid = invoicePaid;
    apiClient
      .get("/api/invoices", { params })
      .then((res) => {
        const payload = res.data.data as Partial<InvoicesResponse> | undefined;
        setInvoices(payload?.invoices ?? []);
        setInvoicePagination(payload?.pagination ?? null);
        setInvoiceTotals(payload?.totals ?? null);
      })
      .catch((err) => console.error("Failed to load invoices:", err))
      .finally(() => setInvoicesLoading(false));
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    apiClient
      .get("/api/orders/history")
      .then((res) => setHistory(res.data.data.transactions ?? []))
      .catch((err) => console.error("Failed to load history:", err))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  useEffect(() => {
    load(ordersPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersPage]);

  useEffect(() => {
    if (activeTab !== "invoices") return;
    const t = setTimeout(() => loadInvoices(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, invoiceQ, invoiceCustomer, invoicePaid]);

  // MR is the first point of contact for a chemist — only they book orders.
  // ASM/ADMIN/MD oversee and advance fulfilment status but don't originate sales.
  const canBook = role === "MR";
  const isAdmin = role === "ADMIN" || role === "MD";
  const canAdvance = role === "ASM" || isAdmin;
  const canManageInvoices = role === "ASM" || isAdmin || role === "MR";
  // Admins/MDs have full privileges to edit/delete any order; MR/ASM can edit open ones.
  const canEditOrders = role === "MR" || role === "ASM" || isAdmin;

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      await apiClient.put(`/api/orders/${order.id}`, { status: next });
      load();
    } catch (err) {
      console.error("Failed to advance order:", err);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteOrder) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/orders/${deleteOrder.id}`);
      setDeleteOrder(null);
      load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete order.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  const togglePaid = async (inv: any) => {
    setInvoiceBusyId(inv.id);
    try {
      await apiClient.put(`/api/invoices/${inv.id}`, { paid: !inv.paid });
      loadInvoices();
    } catch (err) {
      console.error("Failed to update invoice:", err);
    } finally {
      setInvoiceBusyId(null);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    setDeletingInvoice(true);
    setDeleteInvoiceError(null);
    try {
      await apiClient.delete(`/api/invoices/${deleteInvoice.id}`);
      setDeleteInvoice(null);
      loadInvoices();
      load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete invoice.";
      setDeleteInvoiceError(message);
    } finally {
      setDeletingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const counts = statusCounts;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">{canBook ? "My Sales" : "Orders Central"}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {canBook ? "Book orders, generate invoices, track chemist balances" : "Track and manage secondary sales pipeline"}
          </p>
        </div>
        {canBook && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> New Sale
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={ShoppingCart} label="Pending" value={String(counts.PENDING)} tone="warn" />
        <KpiTile icon={PackageCheck} label="Confirmed" value={String(counts.CONFIRMED)} tone="blue" />
        <KpiTile icon={Truck} label="Shipped" value={String(counts.SHIPPED)} tone="purple" />
        <KpiTile icon={CheckCircle} label="Delivered" value={String(counts.DELIVERED)} tone="good" />
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 pb-px text-sm">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "orders"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
          }`}
        >
          <ShoppingCart size={15} />
          Sales Orders ({ordersTotal})
        </button>
        <button
          onClick={() => {
            setActiveTab("invoices");
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "invoices"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
          }`}
        >
          <Receipt size={15} />
          Generated Invoices ({invoicePagination?.total ?? invoices.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("history");
            loadHistory();
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "history"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
          }`}
        >
          <History size={15} />
          Complete History ({history.length})
        </button>
      </div>

      {activeTab === "orders" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 font-semibold">Order ID</th>
                <th className="px-6 py-3 font-semibold">Distributor & Chemist</th>
                <th className="px-6 py-3 font-semibold">Invoice</th>
                <th className="px-6 py-3 font-semibold">Value</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Chemist Balance</th>
                {(canAdvance || canEditOrders) && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={canAdvance || canEditOrders ? 7 : 6} className="px-6 py-10 text-center text-slate-400">
                    No orders found.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{order.distributor?.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">To: {order.chemist?.name ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    {order.invoice ? (
                      <Link href={`/invoices/${order.id}`} className="group inline-block">
                        <p className="font-mono text-xs font-semibold text-slate-700 group-hover:text-emerald-600 flex items-center gap-1">
                          {order.invoice.invoiceNo} <Printer size={11} className="opacity-0 group-hover:opacity-100" />
                        </p>
                        <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.invoice.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {order.invoice.paid ? "Paid" : "Unpaid"}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{currency(orderValue(order))}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {order.chemistOutstanding !== null ? currency(order.chemistOutstanding) : "—"}
                  </td>
                  {(canAdvance || canEditOrders) && (
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canAdvance && NEXT_STATUS[order.status] && (
                        <button
                          disabled={busyId === order.id}
                          onClick={() => advance(order)}
                          className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-emerald-100 disabled:opacity-50"
                        >
                          Mark {NEXT_STATUS[order.status]}
                        </button>
                      )}
                      {canEditOrders && (isAdmin || EDITABLE_STATUSES.includes(order.status)) && (
                        <>
                          <button
                            onClick={() => setEditOrderId(order.id)}
                            className="text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setDeleteOrder(order); setDeleteError(null); }}
                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "orders" && ordersTotalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            disabled={ordersPage <= 1}
            onClick={() => setOrdersPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-semibold text-slate-500 px-2 py-1.5">
            Page {ordersPage} of {ordersTotalPages} · {ordersTotal} total
          </span>
          <button
            disabled={ordersPage >= ordersTotalPages}
            onClick={() => setOrdersPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="space-y-4">

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <input
                type="text"
                name="q"
                data-testid="invoice-search-q"
                value={invoiceQ}
                onChange={(e) => setInvoiceQ(e.target.value)}
                placeholder="Search invoice no. or customer…"
                className="flex-1 min-w-[220px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <input
                type="text"
                name="customer"
                data-testid="invoice-search-customer"
                value={invoiceCustomer}
                onChange={(e) => setInvoiceCustomer(e.target.value)}
                placeholder="Customer name (e.g. Chemist)"
                className="min-w-[180px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <select
                name="paid"
                data-testid="invoice-search-paid"
                value={invoicePaid}
                onChange={(e) => setInvoicePaid(e.target.value as "" | "true" | "false")}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">All Invoices</option>
                <option value="true">Paid Only</option>
                <option value="false">Unpaid Only</option>
              </select>
              {(invoiceQ || invoiceCustomer || invoicePaid) && (
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceQ("");
                    setInvoiceCustomer("");
                    setInvoicePaid("");
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
            {role === "ADMIN" && invoiceTotals && (
              <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <p
                  data-testid="invoice-total-profit"
                  className="font-semibold text-slate-600"
                >
                  Total profit (all matching invoices, not just this page):{" "}
                  <span className={`font-bold ${profitColor(invoiceTotals.profitAmount)}`}>
                    {currency(invoiceTotals.profitAmount)}
                  </span>
                </p>
                <div className="flex items-center gap-4 text-slate-500">
                  <span>Revenue: <strong className="text-slate-700">{currency(invoiceTotals.revenue)}</strong></span>
                  {invoiceTotals.revenue > 0 && (
                    <span>
                      Avg Margin:{" "}
                      <strong className={profitColor(invoiceTotals.profitAmount)}>
                        {((invoiceTotals.profitAmount / invoiceTotals.revenue) * 100).toFixed(1)}%
                      </strong>
                    </span>
                  )}
                  <span className="text-emerald-700 font-medium">✓ Certified Read-Only (0 DB writes)</span>
                </div>
              </div>
            )}
            {invoicesLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No invoices found.</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3 font-semibold">Invoice No</th>
                    <th className="px-6 py-3 font-semibold">Chemist (Customer)</th>
                    <th className="px-6 py-3 font-semibold">Distributor</th>
                    <th className="px-6 py-3 font-semibold text-right">Amount</th>
                    {role === "ADMIN" && <th className="px-6 py-3 font-semibold text-right">Profit Earned (₹)</th>}
                    {role === "ADMIN" && <th className="px-6 py-3 font-semibold text-right">Profit %</th>}
                    <th className="px-5 py-3 font-semibold text-center">Status</th>
                    <th className="px-6 py-3 font-semibold">Generated Date</th>
                    {canManageInvoices && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/invoices/${inv.orderId}`}
                        className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1.5"
                      >
                        {inv.invoiceNo}
                        <Printer size={11} />
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {inv.order?.chemist?.name || "Unknown Chemist"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {inv.order?.distributor?.name || "Unknown Distributor"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {currency(inv.amount)}
                    </td>
                    {role === "ADMIN" && (
                      <td className={`px-6 py-4 text-right font-bold ${profitColor(inv.profitAmount)}`}>
                        {currency(inv.profitAmount)}
                      </td>
                    )}
                    {role === "ADMIN" && (
                      <td className={`px-6 py-4 text-right font-bold ${inv.profitPct == null ? "text-slate-400" : profitColor(inv.profitPct)}`}>
                        {inv.profitPct == null ? "—" : `${inv.profitPct.toFixed(1)}%`}
                      </td>
                    )}
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {inv.paid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    {canManageInvoices && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          disabled={invoiceBusyId === inv.id}
                          onClick={() => togglePaid(inv)}
                          className="text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-teal-100 disabled:opacity-50 mr-1"
                        >
                          Mark {inv.paid ? "Unpaid" : "Paid"}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteInvoice(inv);
                            setDeleteInvoiceError(null);
                          }}
                          className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-red-100"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          {historyLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              <History size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No transaction history found.</p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold">Transaction Date</th>
                  <th className="px-6 py-3 font-semibold">Reference ID / No</th>
                  <th className="px-6 py-3 font-semibold">Customer (Chemist)</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Activity Details</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-slate-800">
                      {tx.type === "INVOICE" ? (
                        <Link
                          href={`/invoices/${tx.orderId}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                        >
                          {tx.referenceNo}
                          <Printer size={11} />
                        </Link>
                      ) : (
                        tx.referenceNo
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{tx.partyName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        tx.type === "ORDER" ? "bg-blue-100 text-blue-700" :
                        tx.type === "INVOICE" ? "bg-indigo-100 text-indigo-700" :
                                                "bg-emerald-100 text-emerald-700"
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-650">{tx.description}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {tx.amount > 0 ? currency(tx.amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <NewOrderModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {editOrderId && (
        <EditOrderModal
          orderId={editOrderId}
          onClose={() => setEditOrderId(null)}
          onSaved={() => {
            setEditOrderId(null);
            load();
          }}
        />
      )}

      {deleteOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Delete order {deleteOrder.id.slice(0, 8).toUpperCase()}?
              </h2>
              <button onClick={() => setDeleteOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              This removes the order and its invoice permanently. Only open orders (Pending/Confirmed) can be deleted.
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteOrder(null)}
                className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteOrder}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Delete invoice {deleteInvoice.invoiceNo}?
              </h2>
              <button onClick={() => setDeleteInvoice(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              This permanently removes invoice <span className="font-semibold text-slate-700">{deleteInvoice.invoiceNo}</span> and reverses its accounting ledger postings.
            </p>
            {deleteInvoiceError && <p className="text-sm text-red-600">{deleteInvoiceError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteInvoice(null)}
                className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteInvoice}
                disabled={deletingInvoice}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deletingInvoice ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LineItem {
  productId: string;
  quantity: number;
  batchNo: string;
  expDate: string;
  freeQty: number;
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [chemists, setChemists] = useState<Entity[]>([]);
  const [distributors, setDistributors] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [chemistId, setChemistId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/manager/entities", { params: { type: "CHEMIST", limit: 200 } })
      .then((res) => setChemists(res.data.data.entities))
      .catch((err) => console.error("Failed to load chemists:", err));
    apiClient
      .get("/api/mr/territories")
      .then(async (res) => {
        const territories: { id: string }[] = res.data.data.territories ?? [];
        if (territories.length === 0) {
          setDistributors([]);
          return;
        }
        const results = await Promise.all(
          territories.map((t) =>
            apiClient.get("/api/manager/entities", {
              params: { type: "DISTRIBUTOR", territoryId: t.id, limit: 200 },
            })
          )
        );
        const merged = new Map<string, Entity>();
        for (const res of results) {
          for (const d of res.data.data.entities as Entity[]) merged.set(d.id, d);
        }
        setDistributors(Array.from(merged.values()));
      })
      .catch((err) => console.error("Failed to load distributors:", err));
    apiClient
      .get("/api/products", { params: { limit: 100 } })
      .then((res) => setProducts(res.data.data.products))
      .catch((err) => console.error("Failed to load products:", err));
  }, []);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = items.reduce((sum, it) => {
    const p = products.find((prod) => prod.id === it.productId);
    return sum + (p ? Number(p.ptr ?? p.price) * it.quantity : 0);
  }, 0);

  const handleSubmit = async () => {
    setError(null);
    if (!chemistId) return setError("Select a chemist.");
    if (!distributorId) return setError("Select a distributor.");
    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) return setError("Add at least one product line.");

    setSubmitting(true);
    try {
      await apiClient.post("/api/orders/secondary", {
        chemistId,
        distributorId,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          batchNo: it.batchNo || undefined,
          expDate: it.expDate || undefined,
          freeQty: it.freeQty || undefined,
        })),
      });
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to create order.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Book Secondary Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Chemist *</label>
            <select
              value={chemistId}
              onChange={(e) => setChemistId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            >
              <option value="">Select chemist</option>
              {chemists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Distributor *</label>
            <select
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            >
              <option value="">Select distributor</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Products <span className="font-normal normal-case text-slate-400">— pricing is set by Admin, not editable here</span>
          </label>
          <div className="space-y-2">
            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              const unitPrice = product ? Number(product.ptr ?? product.price) : 0;
              return (
                <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, { productId: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — SKU {p.sku}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-2.5 text-base sm:text-sm text-right"
                    />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)} className="text-slate-400 hover:text-red-500 p-2">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {product && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pl-1">
                        {product.mrp && <span>MRP: {currency(product.mrp)}</span>}
                        <span>Order price (PTR): {currency(unitPrice)}</span>
                        <span className="font-semibold text-slate-700">Subtotal: {currency(unitPrice * item.quantity)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          value={item.batchNo}
                          onChange={(e) => updateItem(index, { batchNo: e.target.value })}
                          placeholder="Batch no."
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                        />
                        <input
                          type="date"
                          value={item.expDate}
                          onChange={(e) => updateItem(index, { expDate: e.target.value })}
                          placeholder="Expiry"
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.freeQty || ""}
                          onChange={(e) => updateItem(index, { freeQty: Number(e.target.value) })}
                          placeholder="Free qty"
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={addItem} className="mt-2 text-sm font-semibold text-emerald-600 hover:underline flex items-center gap-1">
            <Plus size={14} /> Add product
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-600">Estimated total</span>
          <span className="text-lg font-bold text-slate-900">{currency(total)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Booking..." : "Book Order"}
        </button>
      </div>
    </div>
  );
}

function EditOrderModal({
  orderId,
  onClose,
  onSaved,
}: {
  orderId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>("PENDING");
  const [chemistName, setChemistName] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/api/orders/${orderId}`),
      apiClient.get("/api/products", { params: { limit: 100 } }),
    ])
      .then(([orderRes, productsRes]) => {
        const order = orderRes.data.data.order;
        setChemistName(order.chemist?.name ?? "—");
        setDistributorName(order.distributor?.name ?? "—");
        setOrderStatus(order.status ?? "PENDING");
        setItems(
          order.items.map((it: any) => ({
            productId: it.product.id,
            quantity: it.quantity,
            batchNo: it.batchNo ?? "",
            expDate: it.expDate ? it.expDate.slice(0, 10) : "",
            freeQty: it.freeQty ?? 0,
          }))
        );
        setProducts(productsRes.data.data.products);
      })
      .catch((err) => {
        console.error("Failed to load order:", err);
        setError("Failed to load order.");
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = items.reduce((sum, it) => {
    const p = products.find((prod) => prod.id === it.productId);
    return sum + (p ? Number(p.ptr ?? p.price) * it.quantity : 0);
  }, 0);

  const handleSubmit = async () => {
    setError(null);
    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) return setError("Add at least one product line.");

    setSubmitting(true);
    try {
      await apiClient.put(`/api/orders/${orderId}`, {
        status: orderStatus,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          batchNo: it.batchNo || undefined,
          expDate: it.expDate || undefined,
          freeQty: it.freeQty || undefined,
        })),
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update order.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Edit Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chemist</p>
                <p className="font-semibold text-slate-800">{chemistName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distributor</p>
                <p className="font-semibold text-slate-800">{distributorName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Status</p>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-800 mt-0.5"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Products <span className="font-normal normal-case text-slate-400">— pricing is set by Admin, not editable here</span>
              </label>
              <div className="space-y-2">
                {items.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId);
                  const unitPrice = product ? Number(product.ptr ?? product.price) : 0;
                  return (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, { productId: e.target.value })}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — SKU {p.sku}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-2.5 text-base sm:text-sm text-right"
                        />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(index)} className="text-slate-400 hover:text-red-500 p-2">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {product && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pl-1">
                            {product.mrp && <span>MRP: {currency(product.mrp)}</span>}
                            <span>Order price (PTR): {currency(unitPrice)}</span>
                            <span className="font-semibold text-slate-700">Subtotal: {currency(unitPrice * item.quantity)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              value={item.batchNo}
                              onChange={(e) => updateItem(index, { batchNo: e.target.value })}
                              placeholder="Batch no."
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                            />
                            <input
                              type="date"
                              value={item.expDate}
                              onChange={(e) => updateItem(index, { expDate: e.target.value })}
                              placeholder="Expiry"
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                            />
                            <input
                              type="number"
                              min={0}
                              value={item.freeQty || ""}
                              onChange={(e) => updateItem(index, { freeQty: Number(e.target.value) })}
                              placeholder="Free qty"
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={addItem} className="mt-2 text-sm font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                <Plus size={14} /> Add product
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-slate-600">Estimated total</span>
              <span className="text-lg font-bold text-slate-900">{currency(total)}</span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: typeof ShoppingCart; label: string; value: string; tone: string }) {
  const toneClass = tone === "warn" ? "bg-amber-100 text-amber-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : tone === "blue" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600";
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
