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
  Search,
  Store,
  Check,
  MapPin,
  Stethoscope,
  Calendar,
  CalendarDays,
  Users,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Building2,
  ArrowRight,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import { EditInvoiceModal } from "@/components/edit-invoice-modal";
import { PrescribedDoctorPicker, type PrescribedDoctorOption } from "@/components/prescribed-doctor-picker";

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
  chemist: {
    id: string;
    name: string;
    address?: string | null;
    subArea?: string | null;
    beatName?: string | null;
    territory?: { id: string; name: string } | null;
  } | null;
  doctor?: {
    id: string;
    fullName: string;
    primarySpecialty?: string | null;
  } | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  distributor: { id: string; name: string } | null;
  items: OrderItem[];
  invoice: { invoiceNo: string; amount: string; paid: boolean } | null;
  chemistOutstanding: number | null;
}

interface Entity {
  id: string;
  name: string;
  address?: string | null;
  territoryName?: string | null;
  mobile?: string | null;
  contactPerson?: string | null;
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
    chemist: {
      id: string;
      name: string;
      address?: string | null;
      subArea?: string | null;
      beatName?: string | null;
      territoryId?: string | null;
      territory?: { id: string; name: string } | null;
    } | null;
    distributor: { id: string; name: string } | null;
    doctor?: {
      id: string;
      fullName: string;
      primarySpecialty?: string | null;
      clinicAddress?: string | null;
      registrationNo?: string | null;
    } | null;
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
      role?: string | null;
      user?: { role: string } | null;
    } | null;
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
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
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

  // ── Invoicing Cadence & Dimension State ──
  const [cadence, setCadence] = useState<"ALL" | "DAILY" | "MONTHLY" | "QUARTERLY">("ALL");
  const [cadenceDate, setCadenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cadenceMonth, setCadenceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [cadenceQuarter, setCadenceQuarter] = useState("Q4");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [dimensionView, setDimensionView] = useState<"LIST" | "AREA" | "PERSON">("LIST");
  const [invoicingSummary, setInvoicingSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({ PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 });

  const load = (page = ordersPage) => {
    setLoading(true);
    apiClient
      .get("/api/orders/secondary", { params: { page, limit: 20 } })
      .then((res) => {
        const ordersData = res.data?.data?.orders ?? [];
        setOrders(ordersData);
        setOrdersTotal(res.data?.data?.pagination?.total ?? ordersData.length);
        setOrdersTotalPages(res.data?.data?.pagination?.totalPages ?? 1);
        setStatusCounts(res.data?.data?.statusCounts ?? { PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 });
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
    if (cadence !== "ALL") {
      params.cadence = cadence.toLowerCase();
      if (cadence === "DAILY" && cadenceDate) params.date = cadenceDate;
      if (cadence === "MONTHLY" && cadenceMonth) params.month = cadenceMonth;
      if (cadence === "QUARTERLY" && cadenceQuarter) params.quarter = cadenceQuarter;
    }
    if (selectedTerritoryId) params.territoryId = selectedTerritoryId;
    if (selectedEmployeeId) params.employeeId = selectedEmployeeId;

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

  const loadInvoicingSummary = () => {
    setSummaryLoading(true);
    const params: Record<string, string> = {};
    if (cadence !== "ALL") {
      params.cadence = cadence;
      if (cadence === "DAILY" && cadenceDate) params.date = cadenceDate;
      if (cadence === "MONTHLY" && cadenceMonth) params.month = cadenceMonth;
      if (cadence === "QUARTERLY" && cadenceQuarter) params.quarter = cadenceQuarter;
    }
    if (selectedTerritoryId) params.territoryId = selectedTerritoryId;
    if (selectedEmployeeId) params.employeeId = selectedEmployeeId;
    if (invoicePaid) params.paid = invoicePaid;

    apiClient
      .get("/api/invoices/summary", { params })
      .then((res) => {
        setInvoicingSummary(res.data?.data || null);
      })
      .catch((err) => console.error("Failed to load invoicing summary:", err))
      .finally(() => setSummaryLoading(false));
  };

  const triggerBatchInvoicing = async (customParams: { territoryId?: string; subArea?: string; employeeId?: string; orderIds?: string[] } = {}) => {
    setBatchGenerating(true);
    setBatchSuccessMsg(null);
    try {
      const hasExplicitOrderIds = Boolean(customParams.orderIds && customParams.orderIds.length > 0);
      const payload: Record<string, any> = {
        cadence: !hasExplicitOrderIds && cadence !== "ALL" ? cadence : undefined,
        date: !hasExplicitOrderIds && cadence === "DAILY" ? cadenceDate : undefined,
        month: !hasExplicitOrderIds && cadence === "MONTHLY" ? cadenceMonth : undefined,
        quarter: !hasExplicitOrderIds && cadence === "QUARTERLY" ? cadenceQuarter : undefined,
        territoryId: customParams.territoryId || (selectedTerritoryId || undefined),
        subArea: customParams.subArea || undefined,
        employeeId: customParams.employeeId || (selectedEmployeeId || undefined),
        orderIds: customParams.orderIds || undefined,
      };

      const res = await apiClient.post("/api/invoices/generate-batch", payload);
      const data = res.data?.data;
      if (data) {
        setBatchSuccessMsg(data.message);
        load(ordersPage);
        loadInvoices();
        loadInvoicingSummary();
        setTimeout(() => setBatchSuccessMsg(null), 8000);
      }
    } catch (err: any) {
      console.error("Batch invoicing failed:", err);
      alert(err.response?.data?.error?.message || err.message || "Batch invoicing failed");
    } finally {
      setBatchGenerating(false);
    }
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
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "invoices" || tabParam === "orders" || tabParam === "history") {
        setActiveTab(tabParam);
      }
    }
    loadInvoices();
    loadInvoicingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(ordersPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersPage]);

  useEffect(() => {
    if (activeTab !== "invoices") return;
    const t = setTimeout(() => {
      loadInvoices();
      loadInvoicingSummary();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, invoiceQ, invoiceCustomer, invoicePaid, cadence, cadenceDate, cadenceMonth, cadenceQuarter, selectedTerritoryId, selectedEmployeeId]);

  const isMrOnly = role === "MR";
  const isAdmin = role === "ADMIN" || role === "MD";
  const canBook = role === "MR" || role === "ASM" || isAdmin;
  const canAdvance = role === "ASM" || isAdmin;
  const canManageInvoices = role === "ASM" || isAdmin || role === "MR";
  // MR is strictly revoked from deleting statutory tax invoices; only Admin/MD/ASM can delete.
  const canDeleteInvoices = isAdmin || role === "ASM";
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">{isMrOnly ? "My Sales" : "Orders & Invoicing Central"}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isMrOnly
              ? "Book orders with prescribed doctor linkage, generate invoices, track chemist balances"
              : "Book & manage secondary orders, daily/monthly/quarterly & area/person batch invoicing"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-2 ${
              activeTab === "invoices"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
            }`}
          >
            <Receipt size={16} />
            <span>Invoicing Hub</span>
            {(invoicingSummary?.summary?.totalPendingOrdersCount ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950">
                {invoicingSummary.summary.totalPendingOrdersCount} Pending
              </span>
            )}
          </button>
          {canBook && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> New Sale
            </button>
          )}
        </div>
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
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${activeTab === "orders"
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
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${activeTab === "invoices"
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
          className={`flex items-center gap-1.5 px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${activeTab === "history"
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-500">To: {order.chemist?.name ?? "—"}</span>
                      {order.chemist?.subArea && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          <MapPin size={9} />
                          {order.chemist.subArea}
                        </span>
                      )}
                      {order.chemist?.beatName && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[9px] border border-blue-200">
                          Beat: {order.chemist.beatName}
                        </span>
                      )}
                      {order.doctor && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold text-[10px] border border-purple-200">
                          <Stethoscope size={9} />
                          Dr. {order.doctor.fullName}
                        </span>
                      )}
                      {order.employee && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">
                          MR: {order.employee.firstName} {order.employee.lastName}
                        </span>
                      )}
                    </div>
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
                    ) : canManageInvoices ? (
                      <button
                        type="button"
                        disabled={batchGenerating}
                        onClick={() => triggerBatchInvoicing({ orderIds: [order.id] })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                      >
                        <FileCheck size={12} />
                        Generate Invoice
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Pending</span>
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
          {/* ── 1. Batch Invoicing Feedback Banner ── */}
          {batchSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold">{batchSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setBatchSuccessMsg(null)}
                className="text-emerald-500 hover:text-emerald-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* ── 2. Cadence & Dimension Control Bar ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Cadence Selection Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Cadence:</span>
                <button
                  type="button"
                  onClick={() => setCadence("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${cadence === "ALL"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  <Receipt size={13} />
                  All Invoices
                </button>
                <button
                  type="button"
                  onClick={() => setCadence("DAILY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${cadence === "DAILY"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                    }`}
                >
                  <Calendar size={13} />
                  Daily Invoicing
                </button>
                <button
                  type="button"
                  onClick={() => setCadence("MONTHLY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${cadence === "MONTHLY"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60"
                    }`}
                >
                  <CalendarDays size={13} />
                  Monthly Invoicing
                </button>
                <button
                  type="button"
                  onClick={() => setCadence("QUARTERLY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${cadence === "QUARTERLY"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60"
                    }`}
                >
                  <Layers size={13} />
                  Quarterly Invoicing
                </button>
              </div>

              {/* Dimension Switcher (List vs Area-Wise vs Person-Wise) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setDimensionView("LIST")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${dimensionView === "LIST"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Invoices List
                </button>
                <button
                  type="button"
                  onClick={() => setDimensionView("AREA")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${dimensionView === "AREA"
                      ? "bg-white text-emerald-800 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <MapPin size={12} />
                  Area-Wise Invoicing
                </button>
                <button
                  type="button"
                  onClick={() => setDimensionView("PERSON")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${dimensionView === "PERSON"
                      ? "bg-white text-indigo-800 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Users size={12} />
                  Person-Wise Invoicing
                </button>
              </div>
            </div>

            {/* Context Cadence Filters (Pickers & Quick Selects) */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {cadence === "DAILY" && (
                  <div className="flex items-center gap-2 bg-emerald-50/60 border border-emerald-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-emerald-900">Select Date:</span>
                    <input
                      type="date"
                      value={cadenceDate}
                      onChange={(e) => setCadenceDate(e.target.value)}
                      className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCadenceDate(new Date().toISOString().slice(0, 10))}
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-[11px]"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setCadenceDate(d.toISOString().slice(0, 10));
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-[11px]"
                    >
                      Yesterday
                    </button>
                  </div>
                )}

                {cadence === "MONTHLY" && (
                  <div className="flex items-center gap-2 bg-indigo-50/60 border border-indigo-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-indigo-900">Select Month:</span>
                    <input
                      type="month"
                      value={cadenceMonth}
                      onChange={(e) => setCadenceMonth(e.target.value)}
                      className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCadenceMonth(new Date().toISOString().slice(0, 7))}
                      className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold text-[11px]"
                    >
                      Current Month
                    </button>
                  </div>
                )}

                {cadence === "QUARTERLY" && (
                  <div className="flex items-center gap-1.5 bg-purple-50/60 border border-purple-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-purple-900 mr-1">Fiscal Quarter:</span>
                    {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setCadenceQuarter(q)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${cadenceQuarter === q
                            ? "bg-purple-700 text-white shadow-xs"
                            : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-100"
                          }`}
                      >
                        {q} {q === "Q1" ? "(Jan-Mar)" : q === "Q2" ? "(Apr-Jun)" : q === "Q3" ? "(Jul-Sep)" : "(Oct-Dec)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Territory & Person Filter Quick Selects */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTerritoryId}
                  onChange={(e) => setSelectedTerritoryId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">All Territories / Areas</option>
                  {Array.from(
                    new Map(
                      (invoicingSummary?.areaBreakdowns || []).map((a: any) => [a.territoryId, a.territoryName])
                    ).entries()
                  ).map(([id, name]) => (
                    <option key={id as string} value={id as string}>
                      {name as string}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">All Sales Reps (MRs)</option>
                  {(invoicingSummary?.personBreakdowns || []).map((p: any) => (
                    <option key={p.employeeId} value={p.employeeId}>
                      {p.employeeName}
                    </option>
                  ))}
                </select>

                {(selectedTerritoryId || selectedEmployeeId || cadence !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerritoryId("");
                      setSelectedEmployeeId("");
                      setCadence("ALL");
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Reset Scopes
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. High-Impact Invoicing Analytics & Batch Action Banner ── */}
          {invoicingSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Total Invoiced ({invoicingSummary.summary?.cadence || "All"})</span>
                  <Receipt size={15} className="text-indigo-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {currency(invoicingSummary.summary?.totalInvoicedAmount ?? 0)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {invoicingSummary.summary?.totalInvoicesCount ?? 0} invoices issued
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Collections Breakdown</span>
                  <CheckCircle size={15} className="text-emerald-600" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase">Paid</p>
                    <p className="text-sm font-extrabold text-emerald-700">
                      {currency(invoicingSummary.summary?.totalPaidAmount ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-amber-700 uppercase">Unpaid</p>
                    <p className="text-sm font-extrabold text-amber-700">
                      {currency(invoicingSummary.summary?.totalUnpaidAmount ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Pending Invoicing Queue</span>
                  <PackageCheck size={15} className="text-purple-600" />
                </div>
                <p className="text-xl font-extrabold text-purple-950 tracking-tight">
                  {invoicingSummary.summary?.totalPendingOrdersCount ?? 0} Orders
                </p>
                <p className="text-[11px] text-purple-700 font-medium">
                  {currency(invoicingSummary.summary?.totalPendingOrdersAmount ?? 0)} unbilled orders
                </p>
              </div>

              <div className="bg-linear-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                    <Sparkles size={13} /> Batch Generator
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">1-Click GST</span>
                </div>
                {invoicingSummary.summary?.totalPendingOrdersCount > 0 ? (
                  <div>
                    <button
                      type="button"
                      disabled={batchGenerating}
                      onClick={() => triggerBatchInvoicing()}
                      className="w-full bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.98] font-bold text-xs py-2 px-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {batchGenerating ? (
                        <>
                          <RefreshCw size={13} className="animate-spin text-emerald-700" />
                          Generating {invoicingSummary.summary.totalPendingOrdersCount} Invoices...
                        </>
                      ) : (
                        <>
                          <FileCheck size={14} className="text-emerald-700" />
                          Generate {invoicingSummary.summary.totalPendingOrdersCount} Invoices Now
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-emerald-100/90 text-center mt-1">
                      Auto-posts to Accounts Receivable & Sales Ledger
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-xl p-2 text-center">
                    <p className="text-xs font-semibold text-emerald-100">All Orders Invoiced</p>
                    <p className="text-[10px] text-emerald-200/80">Zero pending unbilled orders in this scope</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 4A. AREA-WISE BREAKDOWN VIEW ── */}
          {dimensionView === "AREA" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600" />
                    Area-Wise Invoicing & Revenue Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Territory and beat sub-area breakdown of invoices, collections, and pending unbilled orders
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {(invoicingSummary?.areaBreakdowns || []).length} Areas
                </span>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : (invoicingSummary?.areaBreakdowns || []).length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No area data found for this selection.</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3 font-semibold">Territory & Sub-Area</th>
                      <th className="px-6 py-3 font-semibold text-right">Invoiced Revenue</th>
                      <th className="px-6 py-3 font-semibold text-center">Invoices</th>
                      <th className="px-6 py-3 font-semibold text-right">Paid</th>
                      <th className="px-6 py-3 font-semibold text-right">Unpaid</th>
                      <th className="px-6 py-3 font-semibold text-center">Pending Orders</th>
                      <th className="px-6 py-3 font-semibold text-right">Batch Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoicingSummary?.areaBreakdowns || []).map((area: any) => (
                      <tr key={`${area.territoryId}_${area.subArea || "all"}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{area.territoryName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {area.subArea ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                                <MapPin size={9} /> {area.subArea}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Entire Territory</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-900">
                          {currency(area.totalInvoiced)}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600">
                          {area.invoiceCount}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-700">
                          {currency(area.paidAmount)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-amber-700">
                          {currency(area.unpaidAmount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {area.pendingOrdersCount > 0 ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                              {area.pendingOrdersCount} orders ({currency(area.pendingOrdersAmount)})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">0 pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {area.pendingOrdersCount > 0 ? (
                            <button
                              type="button"
                              disabled={batchGenerating}
                              onClick={() => triggerBatchInvoicing({ territoryId: area.territoryId, subArea: area.subArea || undefined })}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              <FileCheck size={12} />
                              Generate ({area.pendingOrdersCount})
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTerritoryId(area.territoryId);
                                setDimensionView("LIST");
                              }}
                              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:underline"
                            >
                              View Invoices →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── 4B. PERSON-WISE BREAKDOWN VIEW ── */}
          {dimensionView === "PERSON" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Person-Wise (Medical Representative / Sales) Invoicing Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Individual sales representative volume, collections, and pending unbilled secondary orders
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {(invoicingSummary?.personBreakdowns || []).length} Sales Reps
                </span>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : (invoicingSummary?.personBreakdowns || []).length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No sales representatives found for this selection.</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3 font-semibold">Sales Representative (MR)</th>
                      <th className="px-6 py-3 font-semibold text-right">Invoiced Revenue</th>
                      <th className="px-6 py-3 font-semibold text-center">Invoices</th>
                      <th className="px-6 py-3 font-semibold text-right">Paid</th>
                      <th className="px-6 py-3 font-semibold text-right">Unpaid</th>
                      <th className="px-6 py-3 font-semibold text-center">Pending Orders</th>
                      <th className="px-6 py-3 font-semibold text-right">Batch Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoicingSummary?.personBreakdowns || []).map((person: any) => (
                      <tr key={person.employeeId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{person.employeeName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {person.role || "MR"}
                            </span>
                            {person.phone && (
                              <span className="text-[10px] text-slate-400">
                                • {person.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-900">
                          {currency(person.totalInvoiced)}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600">
                          {person.invoiceCount}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-700">
                          {currency(person.paidAmount)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-amber-700">
                          {currency(person.unpaidAmount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {person.pendingOrdersCount > 0 ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                              {person.pendingOrdersCount} orders ({currency(person.pendingOrdersAmount)})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">0 pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {person.pendingOrdersCount > 0 ? (
                            <button
                              type="button"
                              disabled={batchGenerating}
                              onClick={() => triggerBatchInvoicing({ employeeId: person.employeeId })}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              <FileCheck size={12} />
                              Generate ({person.pendingOrdersCount})
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(person.employeeId);
                                setDimensionView("LIST");
                              }}
                              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:underline"
                            >
                              View Invoices →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── 4C. INVOICES LIST VIEW ── */}
          {dimensionView === "LIST" && (
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
                <SearchableSelect
                  name="paid"
                  data-testid="invoice-search-paid"
                  value={invoicePaid}
                  onChange={(e) => setInvoicePaid(e.target.value as "" | "true" | "false")}
                  className="min-w-[150px]"
                  placeholder="All Invoices"
                >
                  <option value="">All Invoices</option>
                  <option value="true">Paid Only</option>
                  <option value="false">Unpaid Only</option>
                </SearchableSelect>
                {(invoiceQ || invoiceCustomer || invoicePaid || selectedTerritoryId || selectedEmployeeId || cadence !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceQ("");
                      setInvoiceCustomer("");
                      setInvoicePaid("");
                      setSelectedTerritoryId("");
                      setSelectedEmployeeId("");
                      setCadence("ALL");
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Clear All Filters
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
                  <p className="text-sm font-medium">No invoices found for the selected cadence or filters.</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-5 py-3 font-semibold">Invoice No</th>
                      <th className="px-5 py-3 font-semibold">Chemist (Customer)</th>
                      <th className="px-5 py-3 font-semibold">Prescribed Doctor</th>
                      <th className="px-5 py-3 font-semibold">Booked By (MR)</th>
                      <th className="px-5 py-3 font-semibold">Distributor</th>
                      <th className="px-5 py-3 font-semibold text-right">Amount</th>
                      {role === "ADMIN" && <th className="px-5 py-3 font-semibold text-right">Profit Earned (₹)</th>}
                      {role === "ADMIN" && <th className="px-5 py-3 font-semibold text-right">Profit %</th>}
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-5 py-3 font-semibold">Generated Date</th>
                      {canManageInvoices && <th className="px-5 py-3 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            href={`/invoices/${inv.orderId}`}
                            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1.5"
                          >
                            {inv.invoiceNo}
                            <Printer size={11} />
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">{inv.order?.chemist?.name || "Unknown Chemist"}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {inv.order?.chemist?.territory?.name && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-bold text-[10px] border border-sky-200">
                                <MapPin size={9} />
                                {inv.order.chemist.territory.name}
                              </span>
                            )}
                            {inv.order?.chemist?.subArea && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                {inv.order.chemist.subArea}
                              </span>
                            )}
                            {inv.order?.chemist?.beatName && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[9px] border border-blue-200">
                                Beat: {inv.order.chemist.beatName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {inv.order?.doctor ? (
                            <div>
                              <p className="font-bold text-purple-950 text-xs flex items-center gap-1">
                                <Stethoscope size={12} className="text-purple-600 shrink-0" />
                                Dr. {inv.order.doctor.fullName}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {inv.order.doctor.primarySpecialty || "Specialist"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Direct Counter Sale</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {inv.order?.employee ? (
                            <div>
                              <p className="font-medium text-slate-800 text-xs">
                                {inv.order.employee.firstName} {inv.order.employee.lastName}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {inv.order.employee.user?.role || inv.order.employee.role || "Sales Rep"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Central Booking</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-xs">
                          {inv.order?.distributor?.name || "Unknown Distributor"}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {currency(inv.amount)}
                        </td>
                        {role === "ADMIN" && (
                          <td className={`px-5 py-4 text-right font-bold ${profitColor(inv.profitAmount)}`}>
                            {currency(inv.profitAmount)}
                          </td>
                        )}
                        {role === "ADMIN" && (
                          <td className={`px-5 py-4 text-right font-bold ${inv.profitPct == null ? "text-slate-400" : profitColor(inv.profitPct)}`}>
                            {inv.profitPct == null ? "—" : `${inv.profitPct.toFixed(1)}%`}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                            {inv.paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 text-xs">
                          {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        {canManageInvoices && (
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {isAdmin && (
                              <button
                                onClick={() => setEditInvoiceId(inv.id)}
                                className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-indigo-100 mr-1"
                                title="Edit Invoice Details & Line Items (Admin Only)"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              disabled={invoiceBusyId === inv.id}
                              onClick={() => togglePaid(inv)}
                              className="text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-teal-100 disabled:opacity-50 mr-1"
                            >
                              Mark {inv.paid ? "Unpaid" : "Paid"}
                            </button>
                            {canDeleteInvoices && (
                              <button
                                onClick={() => {
                                  setDeleteInvoice(inv);
                                  setDeleteInvoiceError(null);
                                }}
                                className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-transparent hover:border-red-100"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
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
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${tx.type === "ORDER" ? "bg-blue-100 text-blue-700" :
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

      {editInvoiceId && (
        <EditInvoiceModal
          invoiceId={editInvoiceId}
          onClose={() => setEditInvoiceId(null)}
          onSaved={() => {
            setEditInvoiceId(null);
            loadInvoices();
            load(ordersPage);
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
  const [doctorId, setDoctorId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chemistSearch, setChemistSearch] = useState("");
  const [chemistDropdownOpen, setChemistDropdownOpen] = useState(false);

  const selectChemist = (c: Entity) => {
    setChemistId(c.id);
    setChemistDropdownOpen(false);
    setChemistSearch("");
    setDoctorId("");
  };

  useEffect(() => {
    // 1. Load chemists with multi-source fallback
    apiClient
      .get("/api/manager/entities", { params: { type: "CHEMIST", limit: 300 } })
      .then((res) => {
        const ents = res.data?.data?.entities || [];
        if (ents.length > 0) {
          setChemists(ents);
        } else {
          apiClient
            .get("/api/mr/entities", { params: { type: "CHEMIST", limit: 200 } })
            .then((r2) => setChemists(r2.data?.data?.entities || []));
        }
      })
      .catch(() => {
        apiClient
          .get("/api/mr/entities", { params: { type: "CHEMIST", limit: 200 } })
          .then((r2) => setChemists(r2.data?.data?.entities || []))
          .catch((err) => console.error("Failed to load chemists:", err));
      });

    // 2. Load distributors with fallback to all distributors if territory has no dedicated distributor
    apiClient
      .get("/api/mr/territories")
      .then(async (res) => {
        const territories: { id: string }[] = res.data?.data?.territories ?? [];
        const merged = new Map<string, Entity>();
        if (territories.length > 0) {
          const results = await Promise.all(
            territories.map((t) =>
              apiClient.get("/api/manager/entities", {
                params: { type: "DISTRIBUTOR", territoryId: t.id, limit: 200 },
              }).catch(() => null)
            )
          );
          for (const r of results) {
            if (r?.data?.data?.entities) {
              for (const d of r.data.data.entities as Entity[]) merged.set(d.id, d);
            }
          }
        }
        // Fallback: If MR's territory has no dedicated distributor, load all active distributors
        if (merged.size === 0) {
          const allRes = await apiClient
            .get("/api/manager/entities", { params: { type: "DISTRIBUTOR", limit: 200 } })
            .catch(() => null);
          if (allRes?.data?.data?.entities) {
            for (const d of allRes.data.data.entities as Entity[]) merged.set(d.id, d);
          }
        }
        setDistributors(Array.from(merged.values()));
      })
      .catch(async () => {
        const allRes = await apiClient
          .get("/api/manager/entities", { params: { type: "DISTRIBUTOR", limit: 200 } })
          .catch(() => null);
        if (allRes?.data?.data?.entities) {
          setDistributors(allRes.data.data.entities);
        }
      });

    apiClient
      .get("/api/products", { params: { limit: 100 } })
      .then((res) => setProducts(res.data?.data?.products || []))
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
        doctorId: doctorId || undefined,
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
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Chemist *</label>
              {chemistId && (
                <button
                  type="button"
                  onClick={() => {
                    setChemistId("");
                    setDoctorId("");
                    setChemistSearch("");
                    setChemistDropdownOpen(true);
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  Change Chemist
                </button>
              )}
            </div>

            {(() => {
              const selectedChemist = chemists.find((c) => c.id === chemistId);
              if (selectedChemist && !chemistDropdownOpen) {
                return (
                  <div
                    onClick={() => setChemistDropdownOpen(true)}
                    className="w-full border-2 border-emerald-500/50 bg-emerald-50/60 rounded-xl p-2.5 cursor-pointer hover:bg-emerald-50 transition flex items-center justify-between group shadow-sm"
                    title="Click to search or change chemist"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                        <Store size={16} />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-bold text-slate-900 text-sm truncate">{selectedChemist.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {selectedChemist.address || selectedChemist.territoryName || "Retail Partner"}
                          {selectedChemist.mobile ? ` • ${selectedChemist.mobile}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChemistId("");
                        setDoctorId("");
                        setChemistSearch("");
                        setChemistDropdownOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              }

              const filteredChemists = chemists.filter((c) => {
                if (!chemistSearch.trim()) return true;
                const q = chemistSearch.toLowerCase();
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.address && c.address.toLowerCase().includes(q)) ||
                  (c.territoryName && c.territoryName.toLowerCase().includes(q)) ||
                  (c.contactPerson && c.contactPerson.toLowerCase().includes(q))
                );
              });

              return (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search chemist name, address, area..."
                      value={chemistSearch}
                      onChange={(e) => {
                        setChemistSearch(e.target.value);
                        setChemistDropdownOpen(true);
                      }}
                      onFocus={() => setChemistDropdownOpen(true)}
                      className="w-full pl-9 pr-8 border border-slate-300 rounded-xl py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    {chemistSearch && (
                      <button
                        type="button"
                        onClick={() => setChemistSearch("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {chemistDropdownOpen && (
                    <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                      <div className="p-2 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center sticky top-0 border-b border-slate-200 z-10">
                        <span>{filteredChemists.length} Chemists Found</span>
                        <button
                          type="button"
                          onClick={() => setChemistDropdownOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          Close
                        </button>
                      </div>
                      {filteredChemists.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No chemists matching &quot;{chemistSearch}&quot;
                        </div>
                      ) : (
                        filteredChemists.map((c) => {
                          const isSelected = c.id === chemistId;
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                selectChemist(c);
                              }}
                              className={`p-2.5 cursor-pointer hover:bg-emerald-50/70 transition flex items-center justify-between text-left ${isSelected ? "bg-emerald-50 font-semibold" : ""
                                }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-sm text-slate-900 font-medium truncate">{c.name}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {c.address || c.territoryName || "Retail Chemist"}
                                  {c.mobile ? ` • ${c.mobile}` : ""}
                                </p>
                              </div>
                              {isSelected && <Check size={16} className="text-emerald-600 shrink-0" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Distributor *</label>
            <SearchableSelect
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              placeholder="Select distributor"
              searchPlaceholder="Search distributor name..."
              allowClear
            >
              <option value="">Select distributor</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SearchableSelect>
          </div>
        </div>

        {/* ── Prescribed Doctor Intelligent Linkage Section ── */}
        <PrescribedDoctorPicker
          chemistId={chemistId}
          doctorId={doctorId}
          onChange={setDoctorId}
        />

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
                    <SearchableSelect
                      value={item.productId}
                      onChange={(e) => updateItem(index, { productId: e.target.value })}
                      placeholder="Select product"
                      searchPlaceholder="Search product SKU or name..."
                      className="flex-1"
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — SKU {p.sku}
                        </option>
                      ))}
                    </SearchableSelect>
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
  const [chemistId, setChemistId] = useState<string>("");
  const [chemistName, setChemistName] = useState("");
  const [distributorName, setDistributorName] = useState("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [initialDoctor, setInitialDoctor] = useState<PrescribedDoctorOption | null>(null);
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
        setChemistId(order.chemist?.id ?? order.chemistId ?? "");
        setChemistName(order.chemist?.name ?? "—");
        setDistributorName(order.distributor?.name ?? "—");
        setOrderStatus(order.status ?? "PENDING");
        setDoctorId(order.doctor?.id ?? order.doctorId ?? "");
        setInitialDoctor(
          order.doctor
            ? {
                id: order.doctor.id,
                fullName: order.doctor.fullName,
                clinicAddress: order.doctor.clinicAddress,
                subArea: order.doctor.subArea,
              }
            : null
        );
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
        doctorId: doctorId || null,
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
                <SearchableSelect
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  placeholder="Order Status"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </SearchableSelect>
              </div>
            </div>

            <PrescribedDoctorPicker
              chemistId={chemistId}
              doctorId={doctorId}
              initialDoctor={initialDoctor}
              onChange={setDoctorId}
            />

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
                        <SearchableSelect
                          value={item.productId}
                          onChange={(e) => updateItem(index, { productId: e.target.value })}
                          placeholder="Select product"
                          searchPlaceholder="Search product SKU or name..."
                          className="flex-1"
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — SKU {p.sku}
                            </option>
                          ))}
                        </SearchableSelect>
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
