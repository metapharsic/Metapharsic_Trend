"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  ChevronDown,
  ChevronUp,
  FileCheck,
  AlertCircle,
  Clock,
  ArrowUpRight,
  SlidersHorizontal,
  BarChart3,
  FileSpreadsheet,
  Wallet,
  Eye,
  ShieldAlert,
  Share2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import { EditInvoiceModal } from "@/components/edit-invoice-modal";
import { PrescribedDoctorPicker, type PrescribedDoctorOption } from "@/components/prescribed-doctor-picker";
import { OrderInvoiceDrawer } from "@/components/orders/order-invoice-drawer";
import { CollectPaymentModal } from "@/components/orders/collect-payment-modal";
import { InvoicingCharts } from "@/components/orders/invoicing-charts";
import { downloadOrdersInvoicingExcel } from "@/lib/orders-excel-export";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: string;
  quantity: number;
  freeQty?: number;
  price: string;
  discountPct?: string | number | null;
  gstPct?: string | number | null;
  batchNo?: string | null;
  expDate?: string | null;
  packSize?: string | null;
  mrp?: string | number | null;
  hsnCode?: string | null;
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
  invoice: { id?: string; invoiceNo: string; amount: string; grandTotal?: string | null; paid: boolean } | null;
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
  gstPct?: string | number | null;
  packSize?: string | null;
  stockQty?: number | null;
  currentBatchNo?: string | null;
  currentExpDate?: string | null;
}

interface ActiveScheme {
  id: string;
  name: string;
  productId: string | null;
  minQuantity: number;
  discountPct: number;
}

interface ChemistCreditInfo {
  chemistId: string;
  chemistName: string;
  creditLimit: number | null;
  outstanding: number;
  availableHeadroom: number | null;
  status: "NO_LIMIT" | "OK" | "WARNING" | "BREACHED";
  unpaidInvoicesCount: number;
}

interface ProfitLineItem {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  freeQty: number;
  billedPrice: number;
  costBasis: number;
  costBasisSource: string;
  lineRevenue: number;
  lineCost: number;
  lineProfit: number;
  lineProfitPct: number | null;
}

interface InvoiceRow {
  id: string;
  orderId: string;
  invoiceNo: string;
  amount: string;
  grandTotal?: string | null;
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
  costBasisExact?: boolean;
  profitItems?: ProfitLineItem[];
}

interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InvoiceTotals {
  cost?: number;
  profitAmount: number;
  revenue: number;
  profitPct?: number | null;
  purchaseCost?: number;
  purchaseProfitAmount?: number;
  purchaseProfitPct?: number | null;
  purchaseCostComplete?: boolean;
  purchaseUnpricedUnits?: number;
}

interface InvoicesResponse {
  invoices: InvoiceRow[];
  pagination: InvoicePagination;
  totals: InvoiceTotals;
}

interface LineItem {
  productId: string;
  quantity: number;
  batchNo: string;
  expDate: string;
  freeQty: number;
  discountPct: number;
}

// ─── Formatting Helpers ────────────────────────────────────────────────────────
function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function currencyCompact(value: number | string): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, "")}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return currency(num);
}

function profitColor(value: number): string {
  if (value < 0) return "text-red-600";
  if (value > 0) return "text-emerald-600";
  return "text-slate-500";
}

function orderValue(order: Order): number {
  return order.items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
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
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-sky-100 text-sky-800 border-sky-200",
  SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

const EDITABLE_STATUSES = ["PENDING", "CONFIRMED"];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals & Slide-over Inspector
  const [inspectOrderId, setInspectOrderId] = useState<string | null>(null);
  const [inspectProfitItems, setInspectProfitItems] = useState<ProfitLineItem[] | undefined>(undefined);
  const [collectTarget, setCollectTarget] = useState<{
    chemistId: string;
    chemistName: string;
    invoiceId?: string;
    invoiceNo?: string;
    suggestedAmount: number;
  } | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<any | null>(null);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"orders" | "invoices" | "history">("orders");

  // Orders Filter, Selection & Expanded Row State
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderUnbilledOnly, setOrderUnbilledOnly] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, boolean>>({});
  const [bulkStatusBusy, setBulkStatusBusy] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({
    PENDING: 0,
    CONFIRMED: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  });

  // Invoices Tab State
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicePagination, setInvoicePagination] = useState<InvoicePagination | null>(null);
  const [invoiceTotals, setInvoiceTotals] = useState<InvoiceTotals | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceQ, setInvoiceQ] = useState("");
  const [invoiceCustomer, setInvoiceCustomer] = useState("");
  const [invoicePaid, setInvoicePaid] = useState<"" | "true" | "false">("");
  const [invoiceOverdueOnly, setInvoiceOverdueOnly] = useState(false);
  const [invoiceFrom, setInvoiceFrom] = useState("");
  const [invoiceTo, setInvoiceTo] = useState("");
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});
  const [selectedInvoiceOrderIds, setSelectedInvoiceOrderIds] = useState<Record<string, boolean>>({});
  const [showCharts, setShowCharts] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);

  // Invoicing Cadence, Dimensions & Batch Selection State
  const [cadence, setCadence] = useState<"ALL" | "DAILY" | "MONTHLY" | "QUARTERLY">("ALL");
  const [cadenceDate, setCadenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cadenceMonth, setCadenceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [cadenceQuarter, setCadenceQuarter] = useState("Q4");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [dimensionView, setDimensionView] = useState<"LIST" | "UNBILLED" | "AREA" | "PERSON" | "TIMELINE">("LIST");
  const [invoicingSummary, setInvoicingSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);
  const [selectedUnbilledIds, setSelectedUnbilledIds] = useState<Record<string, boolean>>({});
  const [unbilledSearch, setUnbilledSearch] = useState("");

  // History Tab State (server-paginated & filtered)
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [historyTotals, setHistoryTotals] = useState<{ ordersAmt: number; invoicedAmt: number; collectedAmt: number }>({
    ordersAmt: 0,
    invoicedAmt: 0,
    collectedAmt: 0,
  });
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"ALL" | "ORDER" | "INVOICE" | "COLLECTION">("ALL");
  const [historySearch, setHistorySearch] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 6000);
  };

  const load = useCallback(
    (page = ordersPage, status = orderStatusFilter, search = orderSearch, unbilled = orderUnbilledOnly) => {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (status && status !== "ALL") params.status = status;
      if (search.trim()) params.search = search.trim();
      if (unbilled) params.unbilledOnly = "true";
      if (selectedTerritoryId) params.territoryId = selectedTerritoryId;
      if (selectedEmployeeId) params.employeeId = selectedEmployeeId;

      apiClient
        .get("/api/orders/secondary", { params })
        .then((res) => {
          const ordersData = res.data?.data?.orders ?? [];
          setOrders(ordersData);
          setOrdersTotal(res.data?.data?.pagination?.total ?? ordersData.length);
          setOrdersTotalPages(res.data?.data?.pagination?.totalPages ?? 1);
          setStatusCounts(
            res.data?.data?.statusCounts ?? {
              PENDING: 0,
              CONFIRMED: 0,
              SHIPPED: 0,
              DELIVERED: 0,
              CANCELLED: 0,
            }
          );
        })
        .catch((err) => {
          console.error("Failed to load orders:", err);
          setActionError("Failed to load sales orders. Please retry.");
        })
        .finally(() => setLoading(false));
    },
    [ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly, selectedTerritoryId, selectedEmployeeId]
  );

  const loadInvoices = useCallback(
    (pageOverride?: number) => {
      setInvoicesLoading(true);
      const targetPage = pageOverride ?? invoicePage;
      const params: Record<string, string | number> = { page: targetPage, limit: 20 };
      if (invoiceQ.trim()) params.q = invoiceQ.trim();
      if (invoiceCustomer.trim()) params.customer = invoiceCustomer.trim();
      if (invoicePaid) params.paid = invoicePaid;
      if (invoiceOverdueOnly) params.overdueOnly = "true";
      if (invoiceFrom) params.from = invoiceFrom;
      if (invoiceTo) params.to = invoiceTo;
      if (!invoiceFrom && !invoiceTo && cadence !== "ALL") {
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
    },
    [
      invoicePage,
      invoiceQ,
      invoiceCustomer,
      invoicePaid,
      invoiceOverdueOnly,
      invoiceFrom,
      invoiceTo,
      cadence,
      cadenceDate,
      cadenceMonth,
      cadenceQuarter,
      selectedTerritoryId,
      selectedEmployeeId,
    ]
  );

  const loadInvoicingSummary = useCallback(() => {
    setSummaryLoading(true);
    const params: Record<string, string> = {};
    if (invoiceFrom) params.from = invoiceFrom;
    if (invoiceTo) params.to = invoiceTo;
    if (!invoiceFrom && !invoiceTo && cadence !== "ALL") {
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
  }, [
    cadence,
    cadenceDate,
    cadenceMonth,
    cadenceQuarter,
    invoiceFrom,
    invoiceTo,
    selectedTerritoryId,
    selectedEmployeeId,
    invoicePaid,
  ]);

  const loadHistory = useCallback(
    (pageOverride?: number) => {
      setHistoryLoading(true);
      const params: Record<string, string | number> = {
        page: pageOverride ?? historyPage,
        limit: 30,
      };
      if (historyTypeFilter !== "ALL") params.type = historyTypeFilter;
      if (historySearch.trim()) params.q = historySearch.trim();

      apiClient
        .get("/api/orders/history", { params })
        .then((res) => {
          setHistory(res.data.data.transactions ?? []);
          setHistoryPagination(res.data.data.pagination ?? null);
          if (res.data.data.totals) setHistoryTotals(res.data.data.totals);
        })
        .catch((err) => console.error("Failed to load history:", err))
        .finally(() => setHistoryLoading(false));
    },
    [historyPage, historyTypeFilter, historySearch]
  );

  const triggerBatchInvoicing = async (
    customParams: { territoryId?: string; subArea?: string; employeeId?: string; orderIds?: string[] } = {}
  ) => {
    setBatchGenerating(true);
    setBatchSuccessMsg(null);
    setActionError(null);
    try {
      const hasExplicitOrderIds = Boolean(customParams.orderIds && customParams.orderIds.length > 0);
      const payload: Record<string, any> = {
        cadence: !hasExplicitOrderIds && cadence !== "ALL" ? cadence : undefined,
        date: !hasExplicitOrderIds && cadence === "DAILY" ? cadenceDate : undefined,
        month: !hasExplicitOrderIds && cadence === "MONTHLY" ? cadenceMonth : undefined,
        quarter: !hasExplicitOrderIds && cadence === "QUARTERLY" ? cadenceQuarter : undefined,
        territoryId: customParams.territoryId || selectedTerritoryId || undefined,
        subArea: customParams.subArea || undefined,
        employeeId: customParams.employeeId || selectedEmployeeId || undefined,
        orderIds: customParams.orderIds || undefined,
      };

      const res = await apiClient.post("/api/invoices/generate-batch", payload);
      const data = res.data?.data;
      if (data) {
        setBatchSuccessMsg(data.message);
        setSelectedUnbilledIds({});
        load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
        loadInvoices(1);
        loadInvoicingSummary();
        setTimeout(() => setBatchSuccessMsg(null), 8000);
      }
    } catch (err: any) {
      console.error("Batch invoicing failed:", err);
      setActionError(err.response?.data?.error?.message || err.message || "Batch invoicing failed");
    } finally {
      setBatchGenerating(false);
    }
  };

  useEffect(() => {
    setRole(decodeRole());
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "invoices" || tabParam === "orders" || tabParam === "history") {
        setActiveTab(tabParam);
      }
    }
    loadInvoices(1);
    loadInvoicingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced server-side orders load when filter/search/page changes
  useEffect(() => {
    const t = setTimeout(() => {
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
    }, 250);
    return () => clearTimeout(t);
  }, [ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly, load]);

  useEffect(() => {
    if (activeTab !== "invoices") return;
    const t = setTimeout(() => {
      loadInvoices();
      loadInvoicingSummary();
    }, 350);
    return () => clearTimeout(t);
  }, [activeTab, loadInvoices, loadInvoicingSummary]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const t = setTimeout(() => {
      loadHistory();
    }, 300);
    return () => clearTimeout(t);
  }, [activeTab, loadHistory]);

  const isMrOnly = role === "MR";
  const isAdmin = role === "ADMIN" || role === "MD";
  const canBook = role === "MR" || role === "ASM" || isAdmin;
  const canAdvance = role === "ASM" || isAdmin || role === "WAREHOUSE";
  const canManageInvoices = role === "ASM" || isAdmin || role === "MR";
  const canDeleteInvoices = isAdmin || role === "ASM";
  const canEditOrders = role === "MR" || role === "ASM" || isAdmin;

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    setActionError(null);
    try {
      await apiClient.put(`/api/orders/${order.id}`, { status: next });
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
      showToast(`Order ${order.id.slice(0, 8).toUpperCase()} moved to ${next}.`);
    } catch (err: any) {
      console.error("Failed to advance order:", err);
      setActionError(err?.response?.data?.error?.message || `Failed to transition order to ${next}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkOrderTransition = async (targetStatus: "CONFIRMED" | "SHIPPED" | "DELIVERED") => {
    const ids = orders.filter((o) => selectedOrderIds[o.id]).map((o) => o.id);
    if (ids.length === 0) return;
    setBulkStatusBusy(true);
    setActionError(null);
    try {
      const res = await apiClient.post("/api/orders/bulk-status", {
        orderIds: ids,
        status: targetStatus,
      });
      setSelectedOrderIds({});
      showToast(res.data?.data?.message || `Bulk updated orders to ${targetStatus}.`);
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || "Bulk order update failed.");
    } finally {
      setBulkStatusBusy(false);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteOrder) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/orders/${deleteOrder.id}`);
      setDeleteOrder(null);
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
      loadInvoices();
      loadInvoicingSummary();
      showToast("Order deleted and inventory restored.");
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
    setActionError(null);
    try {
      await apiClient.put(`/api/invoices/${inv.id}`, { paid: !inv.paid });
      loadInvoices();
      loadInvoicingSummary();
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
      showToast(`Invoice ${inv.invoiceNo} marked ${!inv.paid ? "Paid" : "Unpaid"}.`);
    } catch (err: any) {
      console.error("Failed to update invoice:", err);
      setActionError(err?.response?.data?.error?.message || "Failed to update payment status.");
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
      load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
      loadInvoicingSummary();
      showToast("Invoice deleted and ledger postings reversed.");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete invoice.";
      setDeleteInvoiceError(message);
    } finally {
      setDeletingInvoice(false);
    }
  };

  const handleShareInvoiceWhatsApp = async (inv: InvoiceRow) => {
    const text = [
      `*GST TAX INVOICE — ${inv.invoiceNo}*`,
      `Customer: *${inv.order?.chemist?.name || "Valued Chemist"}*`,
      `Distributor: ${inv.order?.distributor?.name || "—"}`,
      inv.order?.doctor ? `Prescriber: Dr. ${inv.order.doctor.fullName}` : "",
      `Date: ${new Date(inv.createdAt).toLocaleDateString("en-IN")}`,
      `Amount: *₹${Number(inv.amount).toLocaleString("en-IN")}*`,
      `Status: *${inv.paid ? "PAID" : "UNPAID / DUE"}*`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${inv.invoiceNo} WhatsApp bill summary to clipboard.`);
    } catch {
      showToast(`Prepared summary for ${inv.invoiceNo}.`);
    }
  };

  const handleExportWorkbook = async () => {
    setExcelExporting(true);
    try {
      const scopeLabel = [
        selectedTerritoryId ? "Territory Filtered" : "All Areas",
        selectedEmployeeId ? "MR Filtered" : "All Reps",
        invoiceOverdueOnly ? "Overdue >30d" : invoicePaid === "true" ? "Paid" : invoicePaid === "false" ? "Unpaid" : "All Status",
      ].join(" · ");

      await downloadOrdersInvoicingExcel({
        cadence,
        scopeLabel,
        isAdmin: role === "ADMIN",
        summary: invoicingSummary?.summary ?? null,
        agingSummary: invoicingSummary?.agingSummary ?? null,
        invoiceTotals,
        orders,
        invoices,
        areaBreakdowns: invoicingSummary?.areaBreakdowns ?? [],
        personBreakdowns: invoicingSummary?.personBreakdowns ?? [],
        uninvoicedOrders: invoicingSummary?.uninvoicedOrders ?? [],
      });
      showToast("Downloaded multi-sheet GST Orders & Invoicing Excel workbook (.xlsx).");
    } catch (err: any) {
      setActionError(err?.message || "Failed to export Excel workbook.");
    } finally {
      setExcelExporting(false);
    }
  };

  const resetInvoiceFilters = () => {
    setInvoiceQ("");
    setInvoiceCustomer("");
    setInvoicePaid("");
    setInvoiceOverdueOnly(false);
    setInvoiceFrom("");
    setInvoiceTo("");
    setSelectedTerritoryId("");
    setSelectedEmployeeId("");
    setCadence("ALL");
    setInvoicePage(1);
  };

  const refreshAll = () => {
    load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
    loadInvoices();
    loadInvoicingSummary();
    if (activeTab === "history") loadHistory();
  };

  // Unbilled queue filtering
  const unbilledQueue = useMemo(() => {
    const raw: any[] = invoicingSummary?.uninvoicedOrders ?? [];
    const q = unbilledSearch.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.chemistName ?? "").toLowerCase().includes(q) ||
        (o.doctorName ?? "").toLowerCase().includes(q) ||
        (o.territoryName ?? "").toLowerCase().includes(q) ||
        (o.employeeName ?? "").toLowerCase().includes(q)
    );
  }, [invoicingSummary?.uninvoicedOrders, unbilledSearch]);

  const checkedUnbilledIds = useMemo(
    () => unbilledQueue.filter((o) => selectedUnbilledIds[o.id]).map((o) => o.id),
    [unbilledQueue, selectedUnbilledIds]
  );

  const checkedOrdersCount = useMemo(
    () => orders.filter((o) => selectedOrderIds[o.id]).length,
    [orders, selectedOrderIds]
  );

  const checkedBatchPrintOrderIds = useMemo(
    () => invoices.filter((inv) => selectedInvoiceOrderIds[inv.orderId]).map((inv) => inv.orderId),
    [invoices, selectedInvoiceOrderIds]
  );

  // Summary metrics
  const counts = statusCounts;
  const totalStatusOrders =
    counts.PENDING + counts.CONFIRMED + counts.SHIPPED + counts.DELIVERED + counts.CANCELLED;
  const summaryData = invoicingSummary?.summary;
  const agingData = invoicingSummary?.agingSummary;
  const totalInvoicedAmt = summaryData?.totalInvoicedAmount ?? 0;
  const totalPaidAmt = summaryData?.totalPaidAmount ?? 0;
  const totalUnpaidAmt = summaryData?.totalUnpaidAmount ?? 0;
  const collectionRatePct = totalInvoicedAmt > 0 ? clampPct((totalPaidAmt / totalInvoicedAmt) * 100) : 0;
  const pendingUnbilledCount = summaryData?.totalPendingOrdersCount ?? 0;
  const pendingUnbilledAmt = summaryData?.totalPendingOrdersAmount ?? 0;

  return (
    <div className="space-y-5 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════════
          EXECUTIVE DARK HERO COMMAND HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800/90 shadow-2xl">
        <div className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-2">
                <Sparkles size={11} />
                <span>{isMrOnly ? "Personal Secondary Sales" : "Commercial & GST Billing Engine"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                {isMrOnly ? "My Sales" : "Orders & Invoicing Central"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                {isMrOnly
                  ? "Book orders with live chemist credit headroom & schemes, issue GST invoices, and record instant collections."
                  : "Bulk fulfilment workflow, multi-cadence GST invoicing, overdue aging intelligence, and workbook exports."}
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={refreshAll}
                disabled={loading || invoicesLoading}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-white transition-colors disabled:opacity-50"
                title="Refresh Orders & Invoices"
                aria-label="Refresh Orders and Invoices"
              >
                <RefreshCw size={15} className={loading || invoicesLoading ? "animate-spin" : ""} />
              </button>

              <button
                type="button"
                onClick={handleExportWorkbook}
                disabled={excelExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-300 text-xs font-bold transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet size={15} />
                <span>{excelExporting ? "Exporting…" : "Export GST Excel"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("invoices");
                  if (pendingUnbilledCount > 0) setDimensionView("UNBILLED");
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                  activeTab === "invoices"
                    ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/25"
                    : "bg-white/10 text-white border-white/15 hover:bg-white/20"
                }`}
              >
                <Receipt size={15} />
                <span>Invoicing Hub</span>
                {pendingUnbilledCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                    {pendingUnbilledCount} Unbilled
                  </span>
                )}
              </button>

              {canBook && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5"
                >
                  <Plus size={15} /> New Sale
                </button>
              )}
            </div>
          </div>

          {/* Live Commercial Telemetry Strip */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Booked Pipeline</p>
              <p className="text-xl font-display font-bold text-white mt-0.5 tabular-nums">{totalStatusOrders} Orders</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {counts.PENDING} pending · {counts.DELIVERED} delivered
              </p>
            </div>

            <div className="bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoiced Volume</p>
              <p className="text-xl font-display font-bold text-emerald-400 mt-0.5 tabular-nums">
                {currencyCompact(totalInvoicedAmt)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {summaryData?.totalInvoicesCount ?? 0} tax invoices issued
              </p>
            </div>

            <div className="bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recovery Health</p>
                <span className="text-[10px] font-bold text-teal-300 tabular-nums">{collectionRatePct}%</span>
              </div>
              <p className="text-xl font-display font-bold text-teal-300 mt-0.5 tabular-nums">
                {currencyCompact(totalPaidAmt)}
              </p>
              <p className="text-[11px] text-amber-300/90 mt-0.5">
                Unpaid: {currencyCompact(totalUnpaidAmt)}
                {agingData && agingData.overdue30PlusCount > 0 ? ` (${agingData.overdue30PlusCount} >30d)` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab("invoices");
                setDimensionView("UNBILLED");
              }}
              className="text-left bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-2xl px-4 py-3 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Billing</p>
                <ArrowUpRight size={13} className="text-amber-300 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xl font-display font-bold text-amber-300 mt-0.5 tabular-nums">
                {pendingUnbilledCount} Orders
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Value: {currencyCompact(pendingUnbilledAmt)}</p>
            </button>
          </div>
        </div>
      </section>

      {/* Inline Toast & Error Banners */}
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-red-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={17} className="text-red-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          INTERACTIVE FULFILMENT FUNNEL CARDS (Click to Filter Orders!)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiTile
          icon={ShoppingCart}
          label="Pending"
          value={String(counts.PENDING)}
          sharePct={totalStatusOrders > 0 ? clampPct((counts.PENDING / totalStatusOrders) * 100) : 0}
          tone="warn"
          active={activeTab === "orders" && orderStatusFilter === "PENDING"}
          onClick={() => {
            setActiveTab("orders");
            setOrdersPage(1);
            setOrderStatusFilter((prev) => (prev === "PENDING" ? "ALL" : "PENDING"));
          }}
        />
        <KpiTile
          icon={PackageCheck}
          label="Confirmed"
          value={String(counts.CONFIRMED)}
          sharePct={totalStatusOrders > 0 ? clampPct((counts.CONFIRMED / totalStatusOrders) * 100) : 0}
          tone="blue"
          active={activeTab === "orders" && orderStatusFilter === "CONFIRMED"}
          onClick={() => {
            setActiveTab("orders");
            setOrdersPage(1);
            setOrderStatusFilter((prev) => (prev === "CONFIRMED" ? "ALL" : "CONFIRMED"));
          }}
        />
        <KpiTile
          icon={Truck}
          label="Shipped"
          value={String(counts.SHIPPED)}
          sharePct={totalStatusOrders > 0 ? clampPct((counts.SHIPPED / totalStatusOrders) * 100) : 0}
          tone="purple"
          active={activeTab === "orders" && orderStatusFilter === "SHIPPED"}
          onClick={() => {
            setActiveTab("orders");
            setOrdersPage(1);
            setOrderStatusFilter((prev) => (prev === "SHIPPED" ? "ALL" : "SHIPPED"));
          }}
        />
        <KpiTile
          icon={CheckCircle}
          label="Delivered"
          value={String(counts.DELIVERED)}
          sharePct={totalStatusOrders > 0 ? clampPct((counts.DELIVERED / totalStatusOrders) * 100) : 0}
          tone="good"
          active={activeTab === "orders" && orderStatusFilter === "DELIVERED"}
          onClick={() => {
            setActiveTab("orders");
            setOrdersPage(1);
            setOrderStatusFilter((prev) => (prev === "DELIVERED" ? "ALL" : "DELIVERED"));
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          NAVIGATION TABS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === "orders"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShoppingCart size={15} />
            <span>Sales Orders ({ordersTotal})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === "invoices"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Receipt size={15} />
            <span>Generated Invoices ({invoicePagination?.total ?? invoices.length})</span>
            {pendingUnbilledCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                +{pendingUnbilledCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadHistory();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <History size={15} />
            <span>Complete History ({history.length})</span>
          </button>
        </div>

        {counts.CANCELLED > 0 && activeTab === "orders" && (
          <button
            type="button"
            onClick={() => {
              setOrdersPage(1);
              setOrderStatusFilter((prev) => (prev === "CANCELLED" ? "ALL" : "CANCELLED"));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              orderStatusFilter === "CANCELLED"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            }`}
          >
            {counts.CANCELLED} Cancelled
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: SALES ORDERS WORKSPACE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="space-y-3.5">
          {/* Orders Filter & Server Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap" data-testid="order-status-filter">
                {(["ALL", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    name="orderStatus"
                    onClick={() => {
                      setOrdersPage(1);
                      setOrderStatusFilter(st);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      orderStatusFilter === st
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st === "ALL" ? "All Statuses" : st}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setOrdersPage(1);
                    setOrderUnbilledOnly((v) => !v);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    orderUnbilledOnly
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  Unbilled Only
                </button>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => {
                      setOrdersPage(1);
                      setOrderSearch(e.target.value);
                    }}
                    placeholder="Search order ID, chemist, doctor, MR, invoice…"
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                {orders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const anyOpen = Object.values(expandedOrderIds).some(Boolean);
                      if (anyOpen) setExpandedOrderIds({});
                      else {
                        const next: Record<string, boolean> = {};
                        for (const o of orders) next[o.id] = true;
                        setExpandedOrderIds(next);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                  >
                    {Object.values(expandedOrderIds).some(Boolean) ? "Collapse SKUs" : "Expand SKUs"}
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Action Ribbon when Orders Selected */}
            {canAdvance && checkedOrdersCount > 0 && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {checkedOrdersCount} order{checkedOrdersCount === 1 ? "" : "s"} selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {(["CONFIRMED", "SHIPPED", "DELIVERED"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={bulkStatusBusy}
                      onClick={() => handleBulkOrderTransition(st)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Mark {st}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds({})}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                <p className="text-xs font-medium text-slate-400">Loading secondary orders…</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <ShoppingCart size={32} className="mx-auto text-slate-300 mb-2.5" />
                <p className="text-sm font-semibold text-slate-600">
                  {orderSearch || orderStatusFilter !== "ALL" || orderUnbilledOnly
                    ? "No orders match your current search or filter."
                    : "No secondary orders booked yet."}
                </p>
                {canBook && !orderSearch && orderStatusFilter === "ALL" && !orderUnbilledOnly && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  >
                    <Plus size={14} /> Book First Order
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Orders Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        {canAdvance && (
                          <th className="px-4 py-3.5 w-10">
                            <input
                              type="checkbox"
                              checked={orders.length > 0 && checkedOrdersCount === orders.length}
                              onChange={(e) => {
                                const next: Record<string, boolean> = {};
                                if (e.target.checked) {
                                  for (const o of orders) next[o.id] = true;
                                }
                                setSelectedOrderIds(next);
                              }}
                              aria-label="Select all orders on page"
                              className="rounded border-slate-300 text-emerald-600"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3.5 font-bold">Order &amp; Items</th>
                        <th className="px-4 py-3.5 font-bold">Distributor &amp; Chemist</th>
                        <th className="px-4 py-3.5 font-bold">Invoice</th>
                        <th className="px-4 py-3.5 font-bold text-right">Value</th>
                        <th className="px-4 py-3.5 font-bold">Status</th>
                        <th className="px-4 py-3.5 font-bold text-right">Chemist Balance</th>
                        <th className="px-4 py-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => {
                        const isExpanded = Boolean(expandedOrderIds[order.id]);
                        const totalUnits = order.items.reduce((s, it) => s + it.quantity + (it.freeQty || 0), 0);
                        return (
                          <React.Fragment key={order.id}>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              {canAdvance && (
                                <td className="px-4 py-4 align-top">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedOrderIds[order.id])}
                                    onChange={(e) =>
                                      setSelectedOrderIds((prev) => ({ ...prev, [order.id]: e.target.checked }))
                                    }
                                    aria-label={`Select order ${order.id}`}
                                    className="mt-1 rounded border-slate-300 text-emerald-600"
                                  />
                                </td>
                              )}

                              <td className="px-4 py-4 align-top">
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedOrderIds((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                                    }
                                    className="mt-0.5 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                    title="Expand line items"
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                  <div>
                                    <p className="font-mono font-bold text-slate-900 text-xs">
                                      {order.id.slice(0, 8).toUpperCase()}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedOrderIds((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                                      }
                                      className="text-[10px] font-semibold text-indigo-600 hover:underline mt-0.5"
                                    >
                                      {order.items.length} SKU{order.items.length === 1 ? "" : "s"} · {totalUnits} units
                                    </button>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <p className="font-bold text-slate-900">{order.chemist?.name ?? "—"}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Via {order.distributor?.name ?? "—"}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {order.chemist?.territory?.name && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold text-[10px] border border-sky-200">
                                      {order.chemist.territory.name}
                                    </span>
                                  )}
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

                              <td className="px-4 py-4 align-top">
                                {order.invoice ? (
                                  <Link href={`/invoices/${order.id}`} className="group inline-block">
                                    <p className="font-mono text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                                      {order.invoice.invoiceNo}
                                      <Printer size={11} />
                                    </p>
                                    <span
                                      className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        order.invoice.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {order.invoice.paid ? "Paid" : "Unpaid"}
                                    </span>
                                  </Link>
                                ) : canManageInvoices ? (
                                  <button
                                    type="button"
                                    disabled={batchGenerating}
                                    onClick={() => triggerBatchInvoicing({ orderIds: [order.id] })}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                                  >
                                    <FileCheck size={12} />
                                    Generate Invoice
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">Pending</span>
                                )}
                              </td>

                              <td className="px-4 py-4 align-top text-right font-bold text-slate-900 tabular-nums">
                                {currency(orderValue(order))}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                    STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </td>

                              <td className="px-4 py-4 align-top text-right font-semibold tabular-nums">
                                {order.chemistOutstanding !== null ? (
                                  <span
                                    className={
                                      order.chemistOutstanding > 0 ? "text-amber-700" : "text-emerald-700 font-bold"
                                    }
                                  >
                                    {currency(order.chemistOutstanding)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectProfitItems(undefined);
                                      setInspectOrderId(order.id);
                                    }}
                                    className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                                    title="Inspect Order & Dispatch Drawer"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  {canAdvance && NEXT_STATUS[order.status] && (
                                    <button
                                      disabled={busyId === order.id}
                                      onClick={() => advance(order)}
                                      className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors font-bold text-xs border border-emerald-200 disabled:opacity-50"
                                    >
                                      {busyId === order.id ? "…" : `Mark ${NEXT_STATUS[order.status]}`}
                                    </button>
                                  )}
                                  {canEditOrders && (isAdmin || EDITABLE_STATUSES.includes(order.status)) && (
                                    <>
                                      <button
                                        onClick={() => setEditOrderId(order.id)}
                                        className="text-slate-600 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setDeleteOrder(order);
                                          setDeleteError(null);
                                        }}
                                        className="text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Inline SKU Breakdown Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={canAdvance ? 8 : 7} className="px-8 py-3">
                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-slate-100/80 text-slate-500 uppercase tracking-wider text-[10px]">
                                          <th className="px-3.5 py-2 text-left">Product / SKU</th>
                                          <th className="px-3.5 py-2 text-left">Batch &amp; Exp</th>
                                          <th className="px-3.5 py-2 text-right">Billed Qty</th>
                                          <th className="px-3.5 py-2 text-right">Free Qty</th>
                                          <th className="px-3.5 py-2 text-right">Disc %</th>
                                          <th className="px-3.5 py-2 text-right">GST %</th>
                                          <th className="px-3.5 py-2 text-right">Unit PTR</th>
                                          <th className="px-3.5 py-2 text-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {order.items.map((it) => (
                                          <tr key={it.id}>
                                            <td className="px-3.5 py-2">
                                              <span className="font-bold text-slate-800">{it.product.name}</span>
                                              <span className="ml-2 text-[10px] font-mono text-slate-400">
                                                {it.product.sku}
                                              </span>
                                            </td>
                                            <td className="px-3.5 py-2 text-slate-500">
                                              {it.batchNo || "Auto-batch"}
                                              {it.expDate && ` · ${String(it.expDate).slice(0, 7)}`}
                                            </td>
                                            <td className="px-3.5 py-2 text-right font-bold tabular-nums">{it.quantity}</td>
                                            <td className="px-3.5 py-2 text-right text-emerald-700 font-semibold tabular-nums">
                                              {it.freeQty ? `+${it.freeQty}` : "0"}
                                            </td>
                                            <td className="px-3.5 py-2 text-right tabular-nums">
                                              {Number(it.discountPct || 0)}%
                                            </td>
                                            <td className="px-3.5 py-2 text-right tabular-nums">
                                              {Number(it.gstPct || 0)}%
                                            </td>
                                            <td className="px-3.5 py-2 text-right tabular-nums">
                                              {currency(it.price)}
                                            </td>
                                            <td className="px-3.5 py-2 text-right font-bold text-slate-900 tabular-nums">
                                              {currency(Number(it.price) * it.quantity)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Orders Card Stack */}
                <div className="md:hidden divide-y divide-slate-100">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {order.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-slate-900 mt-1">{order.chemist?.name ?? "—"}</p>
                          <p className="text-xs text-slate-500">
                            Via {order.distributor?.name ?? "—"} · {new Date(order.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-slate-900 tabular-nums">
                            {currency(orderValue(order))}
                          </p>
                          {order.chemistOutstanding !== null && (
                            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              Due: {currency(order.chemistOutstanding)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {order.invoice ? (
                          <Link
                            href={`/invoices/${order.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"
                          >
                            <Printer size={12} /> {order.invoice.invoiceNo} ({order.invoice.paid ? "Paid" : "Unpaid"})
                          </Link>
                        ) : canManageInvoices ? (
                          <button
                            type="button"
                            onClick={() => triggerBatchInvoicing({ orderIds: [order.id] })}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg"
                          >
                            <FileCheck size={12} /> Generate Invoice
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Invoice pending</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectProfitItems(undefined);
                              setInspectOrderId(order.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                          >
                            Inspect
                          </button>
                          {canAdvance && NEXT_STATUS[order.status] && (
                            <button
                              disabled={busyId === order.id}
                              onClick={() => advance(order)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200"
                            >
                              Mark {NEXT_STATUS[order.status]}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {ordersTotalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-1">
              <button
                disabled={ordersPage <= 1}
                onClick={() => setOrdersPage((p) => p - 1)}
                className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-500 px-3 py-1.5">
                Page {ordersPage} of {ordersTotalPages} · {ordersTotal} total
              </span>
              <button
                disabled={ordersPage >= ordersTotalPages}
                onClick={() => setOrdersPage((p) => p + 1)}
                className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: INVOICING HUB & COMMERCIAL ANALYTICS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {batchSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-3.5 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{batchSuccessMsg}</span>
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

          {/* Cadence & Dimension Control Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              {/* Cadence Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Cadence:</span>
                {(
                  [
                    { key: "ALL", label: "All Invoices", icon: Receipt, activeCls: "bg-slate-900 text-white" },
                    { key: "DAILY", label: "Daily", icon: Calendar, activeCls: "bg-emerald-600 text-white" },
                    { key: "MONTHLY", label: "Monthly", icon: CalendarDays, activeCls: "bg-indigo-600 text-white" },
                    { key: "QUARTERLY", label: "Quarterly", icon: Layers, activeCls: "bg-purple-600 text-white" },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setCadence(c.key);
                      setInvoiceFrom("");
                      setInvoiceTo("");
                      setInvoicePage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      cadence === c.key ? `${c.activeCls} shadow-sm` : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <c.icon size={13} />
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Dimension View Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap self-start xl:self-auto">
                {(
                  [
                    { key: "LIST", label: "Invoices List", icon: Receipt },
                    { key: "UNBILLED", label: `Unbilled Queue (${pendingUnbilledCount})`, icon: Clock },
                    { key: "AREA", label: "Area-Wise", icon: MapPin },
                    { key: "PERSON", label: "Person-Wise", icon: Users },
                    { key: "TIMELINE", label: "Timeline Buckets", icon: BarChart3 },
                  ] as const
                ).map((dim) => (
                  <button
                    key={dim.key}
                    type="button"
                    onClick={() => setDimensionView(dim.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      dimensionView === dim.key
                        ? "bg-white text-slate-900 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <dim.icon size={12} />
                    <span>{dim.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pickers, Territory/Rep Scopes & Chart Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {cadence === "DAILY" && (
                  <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-emerald-900">Date:</span>
                    <input
                      type="date"
                      value={cadenceDate}
                      onChange={(e) => {
                        setCadenceDate(e.target.value);
                        setInvoicePage(1);
                      }}
                      className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setCadenceDate(new Date().toISOString().slice(0, 10))}
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-[11px]"
                    >
                      Today
                    </button>
                  </div>
                )}

                {cadence === "MONTHLY" && (
                  <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-indigo-900">Month:</span>
                    <input
                      type="month"
                      value={cadenceMonth}
                      onChange={(e) => {
                        setCadenceMonth(e.target.value);
                        setInvoicePage(1);
                      }}
                      className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setCadenceMonth(new Date().toISOString().slice(0, 7))}
                      className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold text-[11px]"
                    >
                      Current
                    </button>
                  </div>
                )}

                {cadence === "QUARTERLY" && (
                  <div className="flex items-center gap-1.5 bg-purple-50/70 border border-purple-200 rounded-xl px-2.5 py-1.5">
                    <span className="font-semibold text-purple-900 mr-1">Quarter:</span>
                    {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setCadenceQuarter(q);
                          setInvoicePage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          cadenceQuarter === q
                            ? "bg-purple-700 text-white shadow-sm"
                            : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {cadence === "ALL" && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                    <SlidersHorizontal size={12} className="text-slate-400" />
                    <span className="text-slate-500 font-semibold">Custom Range:</span>
                    <input
                      type="date"
                      value={invoiceFrom}
                      onChange={(e) => {
                        setInvoiceFrom(e.target.value);
                        setInvoicePage(1);
                      }}
                      aria-label="From date"
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={invoiceTo}
                      onChange={(e) => {
                        setInvoiceTo(e.target.value);
                        setInvoicePage(1);
                      }}
                      aria-label="To date"
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTerritoryId}
                  onChange={(e) => {
                    setSelectedTerritoryId(e.target.value);
                    setInvoicePage(1);
                  }}
                  aria-label="Filter Territory"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
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
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setInvoicePage(1);
                  }}
                  aria-label="Filter Representative"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold"
                >
                  <option value="">All Sales Reps (MRs)</option>
                  {(invoicingSummary?.personBreakdowns || []).map((p: any) => (
                    <option key={p.employeeId} value={p.employeeId}>
                      {p.employeeName}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowCharts((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition inline-flex items-center gap-1.5 ${
                    showCharts
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  }`}
                >
                  <BarChart3 size={13} />
                  <span>{showCharts ? "Hide Charts" : "Visual Analytics"}</span>
                </button>

                {(selectedTerritoryId ||
                  selectedEmployeeId ||
                  cadence !== "ALL" ||
                  invoiceFrom ||
                  invoiceTo ||
                  invoiceOverdueOnly) && (
                  <button
                    type="button"
                    onClick={resetInvoiceFilters}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Reset Scopes
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Toggleable Recharts Visualizations */}
          {showCharts && invoicingSummary && (
            <InvoicingCharts
              cadenceBreakdowns={invoicingSummary.cadenceBreakdowns || []}
              areaBreakdowns={invoicingSummary.areaBreakdowns || []}
            />
          )}

          {/* Financial Analytics & Batch Generator Row */}
          {invoicingSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Total Invoiced ({summaryData?.cadence || "ALL"})</span>
                  <Receipt size={15} className="text-indigo-600" />
                </div>
                <p className="text-xl font-display font-bold text-slate-900 tabular-nums">
                  {currency(totalInvoicedAmt)}
                </p>
                <p className="text-[11px] text-slate-500">{summaryData?.totalInvoicesCount ?? 0} tax invoices issued</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Collections &amp; Aging</span>
                  <span className="text-[11px] font-bold text-emerald-700">{collectionRatePct}% Paid</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Paid</p>
                    <p className="text-sm font-bold text-emerald-700 tabular-nums">{currency(totalPaidAmt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">Unpaid</p>
                    <p className="text-sm font-bold text-amber-700 tabular-nums">{currency(totalUnpaidAmt)}</p>
                  </div>
                </div>
                <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${collectionRatePct}%` }} />
                </div>
              </div>

              {/* Overdue Aging Buckets Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Unpaid Aging Buckets</span>
                  <Clock size={14} className="text-amber-600" />
                </div>
                {agingData ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">0–15 Days ({agingData.current0To15Count})</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {currency(agingData.current0To15Amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">16–30 Days ({agingData.aging16To30Count})</span>
                      <span className="font-bold text-amber-700 tabular-nums">
                        {currency(agingData.aging16To30Amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDimensionView("LIST");
                          setInvoicePaid("");
                          setInvoiceOverdueOnly((v) => !v);
                          setInvoicePage(1);
                        }}
                        className={`font-bold inline-flex items-center gap-1 ${
                          invoiceOverdueOnly ? "text-red-700 underline" : "text-red-600 hover:underline"
                        }`}
                      >
                        30+d Overdue ({agingData.overdue30PlusCount})
                      </button>
                      <span className="font-bold text-red-700 tabular-nums">
                        {currency(agingData.overdue30PlusAmount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No unpaid aging data</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                    <Sparkles size={13} /> Batch Generator
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">GST Ready</span>
                </div>
                {pendingUnbilledCount > 0 ? (
                  <div>
                    <button
                      type="button"
                      disabled={batchGenerating}
                      onClick={() => triggerBatchInvoicing()}
                      className="w-full bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {batchGenerating ? (
                        <>
                          <RefreshCw size={13} className="animate-spin text-emerald-700" />
                          Generating {pendingUnbilledCount} Invoices…
                        </>
                      ) : (
                        <>
                          <FileCheck size={14} className="text-emerald-700" />
                          Generate All {pendingUnbilledCount} Invoices
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-emerald-100/90 text-center mt-1">
                      Auto-posts to Accounts Receivable &amp; GST Ledger
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/15 rounded-xl p-2 text-center">
                    <p className="text-xs font-bold text-white">All Orders Invoiced</p>
                    <p className="text-[10px] text-emerald-100">Zero pending unbilled orders</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── VIEW: UNBILLED QUEUE WITH MULTI-SELECT BATCHING ── */}
          {dimensionView === "UNBILLED" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <Clock size={16} className="text-purple-600" />
                    Unbilled Orders Queue ({unbilledQueue.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select specific orders to batch-generate GST tax invoices with auto ledger postings
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={unbilledSearch}
                      onChange={(e) => setUnbilledSearch(e.target.value)}
                      placeholder="Filter queue…"
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  {checkedUnbilledIds.length > 0 && (
                    <button
                      type="button"
                      disabled={batchGenerating}
                      onClick={() => triggerBatchInvoicing({ orderIds: checkedUnbilledIds })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      <FileCheck size={13} />
                      Generate Selected ({checkedUnbilledIds.length})
                    </button>
                  )}
                </div>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : unbilledQueue.length === 0 ? (
                <div className="px-6 py-14 text-center text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-600">No unbilled orders waiting in this scope.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={unbilledQueue.length > 0 && checkedUnbilledIds.length === unbilledQueue.length}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const next: Record<string, boolean> = {};
                              if (checked) {
                                for (const o of unbilledQueue) next[o.id] = true;
                              }
                              setSelectedUnbilledIds(next);
                            }}
                            aria-label="Select all unbilled orders"
                            className="rounded border-slate-300 text-emerald-600"
                          />
                        </th>
                        <th className="px-4 py-3 font-bold">Order Date</th>
                        <th className="px-4 py-3 font-bold">Chemist &amp; Territory</th>
                        <th className="px-4 py-3 font-bold">Prescriber &amp; Rep</th>
                        <th className="px-4 py-3 font-bold text-center">Items</th>
                        <th className="px-4 py-3 font-bold text-right">Order Value</th>
                        <th className="px-4 py-3 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unbilledQueue.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedUnbilledIds[o.id])}
                              onChange={(e) =>
                                setSelectedUnbilledIds((prev) => ({ ...prev, [o.id]: e.target.checked }))
                              }
                              aria-label={`Select order ${o.id}`}
                              className="rounded border-slate-300 text-emerald-600"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                            {new Date(o.orderDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900">{o.chemistName}</p>
                            <p className="text-[11px] text-slate-500">
                              {o.territoryName}
                              {o.subArea ? ` · ${o.subArea}` : ""}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <p className="font-semibold text-slate-700">{o.employeeName}</p>
                            {o.doctorName && <p className="text-[11px] text-purple-700">Dr. {o.doctorName}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700">{o.itemsCount}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                            {currency(o.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              disabled={batchGenerating}
                              onClick={() => triggerBatchInvoicing({ orderIds: [o.id] })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold disabled:opacity-50"
                            >
                              <FileCheck size={12} /> Generate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── VIEW: AREA-WISE BREAKDOWN ── */}
          {dimensionView === "AREA" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600" />
                    Area-Wise Invoicing &amp; Recovery Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Territory &amp; beat breakdown of billed revenue, recovery %, and unbilled backlog
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {(invoicingSummary?.areaBreakdowns || []).length} Areas
                </span>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : (invoicingSummary?.areaBreakdowns || []).length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No area data found for this selection.</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3 font-bold">Territory &amp; Sub-Area</th>
                      <th className="px-6 py-3 font-bold text-right">Invoiced Revenue</th>
                      <th className="px-6 py-3 font-bold text-center">Invoices</th>
                      <th className="px-6 py-3 font-bold">Paid vs Unpaid</th>
                      <th className="px-6 py-3 font-bold text-center">Pending Orders</th>
                      <th className="px-6 py-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoicingSummary?.areaBreakdowns || []).map((area: any) => {
                      const areaPaidPct =
                        area.totalInvoiced > 0 ? clampPct((area.paidAmount / area.totalInvoiced) * 100) : 0;
                      return (
                        <tr
                          key={`${area.territoryId}_${area.subArea || "all"}`}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{area.territoryName}</p>
                            {area.subArea ? (
                              <span className="inline-flex items-center gap-0.5 mt-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                                <MapPin size={9} /> {area.subArea}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Entire Territory</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">
                            {currency(area.totalInvoiced)}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-600">{area.invoiceCount}</td>
                          <td className="px-6 py-4 min-w-[180px]">
                            <div className="flex justify-between text-[11px] font-semibold mb-1">
                              <span className="text-emerald-700">{currency(area.paidAmount)}</span>
                              <span className="text-amber-700">{currency(area.unpaidAmount)}</span>
                            </div>
                            <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${areaPaidPct}%` }} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {area.pendingOrdersCount > 0 ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                                {area.pendingOrdersCount} ({currency(area.pendingOrdersAmount)})
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {area.pendingOrdersCount > 0 ? (
                              <button
                                type="button"
                                disabled={batchGenerating}
                                onClick={() =>
                                  triggerBatchInvoicing({
                                    territoryId: area.territoryId,
                                    subArea: area.subArea || undefined,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                              >
                                <FileCheck size={12} /> Generate ({area.pendingOrdersCount})
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTerritoryId(area.territoryId);
                                  setDimensionView("LIST");
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                View Invoices →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── VIEW: PERSON-WISE BREAKDOWN ── */}
          {dimensionView === "PERSON" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Person-Wise (MR) Invoicing &amp; Collections Performance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Individual rep invoicing revenue, collection recovery ratio, and pending order backlog
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {(invoicingSummary?.personBreakdowns || []).length} Sales Reps
                </span>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : (invoicingSummary?.personBreakdowns || []).length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No sales representatives found for this selection.</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3 font-bold">Sales Representative</th>
                      <th className="px-6 py-3 font-bold text-right">Invoiced Revenue</th>
                      <th className="px-6 py-3 font-bold text-center">Invoices</th>
                      <th className="px-6 py-3 font-bold">Paid vs Unpaid</th>
                      <th className="px-6 py-3 font-bold text-center">Pending Orders</th>
                      <th className="px-6 py-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoicingSummary?.personBreakdowns || []).map((person: any) => {
                      const paidPct =
                        person.totalInvoiced > 0 ? clampPct((person.paidAmount / person.totalInvoiced) * 100) : 0;
                      return (
                        <tr key={person.employeeId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{person.employeeName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {person.role || "MR"}
                              </span>
                              {person.phone && <span className="text-[11px] text-slate-400">· {person.phone}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">
                            {currency(person.totalInvoiced)}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-600">{person.invoiceCount}</td>
                          <td className="px-6 py-4 min-w-[180px]">
                            <div className="flex justify-between text-[11px] font-semibold mb-1">
                              <span className="text-emerald-700">{currency(person.paidAmount)}</span>
                              <span className="text-amber-700">{currency(person.unpaidAmount)}</span>
                            </div>
                            <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paidPct}%` }} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {person.pendingOrdersCount > 0 ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                                {person.pendingOrdersCount} ({currency(person.pendingOrdersAmount)})
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0</span>
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
                                <FileCheck size={12} /> Generate ({person.pendingOrdersCount})
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId(person.employeeId);
                                  setDimensionView("LIST");
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                View Invoices →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── VIEW: TIMELINE BUCKETS (cadenceBreakdowns) ── */}
          {dimensionView === "TIMELINE" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-600" />
                    Invoicing Cadence Timeline ({summaryData?.cadence || "MONTHLY"} Buckets)
                  </h3>
                  <p className="text-xs text-slate-500">Period-over-period invoiced volume and payment settlement trend</p>
                </div>
              </div>

              {(invoicingSummary?.cadenceBreakdowns || []).length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400">
                  <BarChart3 size={30} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No cadence timeline buckets found.</p>
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  {(() => {
                    const buckets: any[] = invoicingSummary?.cadenceBreakdowns || [];
                    const maxBucketAmt = Math.max(...buckets.map((b) => Number(b.invoicedAmount) || 0), 1);
                    return buckets.map((b) => {
                      const widthPct = clampPct(((Number(b.invoicedAmount) || 0) / maxBucketAmt) * 100);
                      const paidPct = b.invoicedAmount > 0 ? clampPct((b.paidAmount / b.invoicedAmount) * 100) : 0;
                      return (
                        <div key={b.bucketKey} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-sm text-slate-900">{b.bucketLabel}</p>
                              <p className="text-[11px] text-slate-500">
                                {b.invoiceCount} invoices · Paid {currency(b.paidAmount)} ({paidPct}%) · Unpaid{" "}
                                {currency(b.unpaidAmount)}
                              </p>
                            </div>
                            <p className="text-base font-display font-bold text-slate-900 tabular-nums">
                              {currency(b.invoicedAmount)}
                            </p>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── VIEW: INVOICES LIST (With Search, Collect Payment, Bulk Print, Read-Only Profit & Pagination) ── */}
          {dimensionView === "LIST" && (
            <div className="space-y-3.5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    name="q"
                    data-testid="invoice-search-q"
                    value={invoiceQ}
                    onChange={(e) => {
                      setInvoiceQ(e.target.value);
                      setInvoicePage(1);
                    }}
                    placeholder="Search invoice no. or customer…"
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    name="customer"
                    data-testid="invoice-search-customer"
                    value={invoiceCustomer}
                    onChange={(e) => {
                      setInvoiceCustomer(e.target.value);
                      setInvoicePage(1);
                    }}
                    placeholder="Customer name (e.g. Chemist)"
                    className="min-w-[180px] px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <SearchableSelect
                    name="paid"
                    data-testid="invoice-search-paid"
                    value={invoicePaid}
                    onChange={(e) => {
                      setInvoicePaid(e.target.value as "" | "true" | "false");
                      setInvoiceOverdueOnly(false);
                      setInvoicePage(1);
                    }}
                    className="min-w-[150px]"
                    placeholder="All Invoices"
                  >
                    <option value="">All Invoices</option>
                    <option value="true">Paid Only</option>
                    <option value="false">Unpaid Only</option>
                  </SearchableSelect>

                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceOverdueOnly((v) => !v);
                      setInvoicePage(1);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      invoiceOverdueOnly
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    Overdue &gt;30d
                  </button>

                  {checkedBatchPrintOrderIds.length > 0 && (
                    <Link
                      href={`/invoices/batch-print?ids=${checkedBatchPrintOrderIds.join(",")}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm"
                    >
                      <Printer size={13} />
                      Bulk Print ({checkedBatchPrintOrderIds.length})
                    </Link>
                  )}

                  {(invoiceQ ||
                    invoiceCustomer ||
                    invoicePaid ||
                    invoiceOverdueOnly ||
                    invoiceFrom ||
                    invoiceTo ||
                    selectedTerritoryId ||
                    selectedEmployeeId ||
                    cadence !== "ALL") && (
                    <button
                      type="button"
                      onClick={resetInvoiceFilters}
                      className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>

                {/* Admin Read-Only Profit Intelligence Banner */}
                {role === "ADMIN" && invoiceTotals && (
                  <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-emerald-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <p data-testid="invoice-total-profit" className="font-semibold text-slate-700">
                        Total profit (all matching invoices, not just this page):{" "}
                        <span className={`font-bold ${profitColor(invoiceTotals.profitAmount)}`}>
                          {currency(invoiceTotals.profitAmount)}
                        </span>
                      </p>
                      {typeof invoiceTotals.purchaseProfitAmount === "number" && invoiceTotals.purchaseCostComplete && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Exact Mfg Profit: {currency(invoiceTotals.purchaseProfitAmount)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-slate-500">
                      <span>
                        Revenue: <strong className="text-slate-800">{currency(invoiceTotals.revenue)}</strong>
                      </span>
                      {typeof invoiceTotals.cost === "number" && (
                        <span>
                          Est. Cost: <strong className="text-slate-700">{currency(invoiceTotals.cost)}</strong>
                        </span>
                      )}
                      {invoiceTotals.revenue > 0 && (
                        <span>
                          Avg Margin:{" "}
                          <strong className={profitColor(invoiceTotals.profitAmount)}>
                            {((invoiceTotals.profitAmount / invoiceTotals.revenue) * 100).toFixed(1)}%
                          </strong>
                        </span>
                      )}
                      <span className="text-emerald-700 font-semibold">✓ Certified Read-Only (0 DB writes)</span>
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
                  <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <th className="px-3.5 py-3 w-9">
                              <input
                                type="checkbox"
                                checked={invoices.length > 0 && checkedBatchPrintOrderIds.length === invoices.length}
                                onChange={(e) => {
                                  const next: Record<string, boolean> = {};
                                  if (e.target.checked) {
                                    for (const inv of invoices) next[inv.orderId] = true;
                                  }
                                  setSelectedInvoiceOrderIds(next);
                                }}
                                aria-label="Select all invoices on page for bulk print"
                                className="rounded border-slate-300 text-slate-900"
                              />
                            </th>
                            <th className="px-4 py-3 font-bold">Invoice No</th>
                            <th className="px-4 py-3 font-bold">Chemist (Customer)</th>
                            <th className="px-4 py-3 font-bold">Prescribed Doctor</th>
                            <th className="px-4 py-3 font-bold">Booked By</th>
                            <th className="px-4 py-3 font-bold text-right">Amount</th>
                            {role === "ADMIN" && <th className="px-4 py-3 font-bold text-right">Profit (₹)</th>}
                            {role === "ADMIN" && <th className="px-4 py-3 font-bold text-right">Margin %</th>}
                            <th className="px-3.5 py-3 font-bold text-center">Status</th>
                            <th className="px-4 py-3 font-bold">Date</th>
                            <th className="px-4 py-3 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices.map((inv) => {
                            const isProfitOpen = Boolean(expandedInvoiceIds[inv.id]);
                            const chemistObj = inv.order?.chemist;
                            return (
                              <React.Fragment key={inv.id}>
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-3.5 py-4 align-top">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selectedInvoiceOrderIds[inv.orderId])}
                                      onChange={(e) =>
                                        setSelectedInvoiceOrderIds((prev) => ({
                                          ...prev,
                                          [inv.orderId]: e.target.checked,
                                        }))
                                      }
                                      aria-label={`Select invoice ${inv.invoiceNo}`}
                                      className="mt-1 rounded border-slate-300 text-slate-900"
                                    />
                                  </td>

                                  <td className="px-4 py-4 align-top">
                                    <Link
                                      href={`/invoices/${inv.orderId}`}
                                      className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1.5"
                                    >
                                      {inv.invoiceNo}
                                      <Printer size={11} />
                                    </Link>
                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                                      {inv.order?.distributor?.name || "Unknown Distributor"}
                                    </p>
                                  </td>

                                  <td className="px-4 py-4 align-top">
                                    <p className="font-bold text-slate-900">
                                      {chemistObj?.name || "Unknown Chemist"}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      {chemistObj?.territory?.name && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-bold text-[10px] border border-sky-200">
                                          <MapPin size={9} />
                                          {chemistObj.territory.name}
                                        </span>
                                      )}
                                      {chemistObj?.subArea && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                          {chemistObj.subArea}
                                        </span>
                                      )}
                                      {chemistObj?.beatName && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[9px] border border-blue-200">
                                          Beat: {chemistObj.beatName}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 align-top">
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

                                  <td className="px-4 py-4 align-top">
                                    {inv.order?.employee ? (
                                      <div>
                                        <p className="font-semibold text-slate-800 text-xs">
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

                                  <td className="px-4 py-4 align-top text-right font-bold text-slate-900 tabular-nums">
                                    {currency(inv.amount)}
                                  </td>

                                  {role === "ADMIN" && (
                                    <td
                                      className={`px-4 py-4 align-top text-right font-bold tabular-nums ${profitColor(
                                        inv.profitAmount
                                      )}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedInvoiceIds((prev) => ({ ...prev, [inv.id]: !prev[inv.id] }))
                                        }
                                        className="hover:underline inline-flex items-center gap-1"
                                        title="Click for SKU margin breakdown"
                                      >
                                        {currency(inv.profitAmount)}
                                        {isProfitOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                      </button>
                                    </td>
                                  )}

                                  {role === "ADMIN" && (
                                    <td
                                      className={`px-4 py-4 align-top text-right font-bold tabular-nums ${
                                        inv.profitPct == null ? "text-slate-400" : profitColor(inv.profitPct)
                                      }`}
                                    >
                                      {inv.profitPct == null ? "—" : `${inv.profitPct.toFixed(1)}%`}
                                    </td>
                                  )}

                                  <td className="px-3.5 py-4 align-top text-center">
                                    <span
                                      className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                        inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {inv.paid ? "Paid" : "Unpaid"}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4 align-top text-slate-500 text-xs whitespace-nowrap">
                                    {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>

                                  <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInspectProfitItems(inv.profitItems);
                                          setInspectOrderId(inv.orderId);
                                        }}
                                        className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                                        title="Inspect Invoice & Dispatch"
                                      >
                                        <Eye size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleShareInvoiceWhatsApp(inv)}
                                        className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                                        title="Copy WhatsApp Bill Summary"
                                      >
                                        <Share2 size={14} />
                                      </button>
                                      {!inv.paid && chemistObj?.id && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCollectTarget({
                                              chemistId: chemistObj.id,
                                              chemistName: chemistObj.name,
                                              invoiceId: inv.id,
                                              invoiceNo: inv.invoiceNo,
                                              suggestedAmount: Number(inv.grandTotal ?? inv.amount),
                                            })
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold"
                                          title="Record Payment Collection"
                                        >
                                          <Wallet size={12} /> Collect
                                        </button>
                                      )}
                                      {isAdmin && (
                                        <button
                                          onClick={() => setEditInvoiceId(inv.id)}
                                          className="text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                                          title="Edit Invoice Details & Line Items (Admin Only)"
                                        >
                                          Edit
                                        </button>
                                      )}
                                      {canManageInvoices && (
                                        <button
                                          disabled={invoiceBusyId === inv.id}
                                          onClick={() => togglePaid(inv)}
                                          className="text-slate-600 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors font-semibold text-xs disabled:opacity-50"
                                        >
                                          {invoiceBusyId === inv.id ? "…" : `Mark ${inv.paid ? "Unpaid" : "Paid"}`}
                                        </button>
                                      )}
                                      {canDeleteInvoices && (
                                        <button
                                          onClick={() => {
                                            setDeleteInvoice(inv);
                                            setDeleteInvoiceError(null);
                                          }}
                                          className="text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors font-semibold text-xs"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Admin Per-SKU Margin Breakdown Drawer */}
                                {role === "ADMIN" && isProfitOpen && inv.profitItems && inv.profitItems.length > 0 && (
                                  <tr className="bg-slate-50/70">
                                    <td colSpan={11} className="px-8 py-3">
                                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100/80 text-slate-500 uppercase tracking-wider text-[10px]">
                                              <th className="px-3 py-2 text-left">SKU</th>
                                              <th className="px-3 py-2 text-right">Qty (+Free)</th>
                                              <th className="px-3 py-2 text-right">Billed Rate</th>
                                              <th className="px-3 py-2 text-right">Cost Basis</th>
                                              <th className="px-3 py-2 text-left">Source</th>
                                              <th className="px-3 py-2 text-right">Revenue</th>
                                              <th className="px-3 py-2 text-right">Cost</th>
                                              <th className="px-3 py-2 text-right">Line Profit</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {inv.profitItems.map((pi, idx) => (
                                              <tr key={pi.id || idx}>
                                                <td className="px-3 py-2 font-bold text-slate-800">{pi.productName}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  {pi.quantity}
                                                  {pi.freeQty > 0 && (
                                                    <span className="text-emerald-700 font-semibold">
                                                      {" "}
                                                      (+{pi.freeQty})
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  {currency(pi.billedPrice)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  {currency(pi.costBasis)}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                                                    {pi.costBasisSource}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  {currency(pi.lineRevenue)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                  {currency(pi.lineCost)}
                                                </td>
                                                <td
                                                  className={`px-3 py-2 text-right font-bold tabular-nums ${profitColor(
                                                    pi.lineProfit
                                                  )}`}
                                                >
                                                  {currency(pi.lineProfit)}
                                                  {pi.lineProfitPct != null && ` (${pi.lineProfitPct.toFixed(1)}%)`}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Invoice Cards */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {invoices.map((inv) => {
                        const chemistObj = inv.order?.chemist;
                        return (
                          <div key={inv.id} className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <Link
                                  href={`/invoices/${inv.orderId}`}
                                  className="font-mono font-bold text-xs text-indigo-600 inline-flex items-center gap-1"
                                >
                                  {inv.invoiceNo} <Printer size={11} />
                                </Link>
                                <p className="font-bold text-sm text-slate-900 mt-0.5">
                                  {chemistObj?.name || "Unknown Chemist"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {inv.order?.distributor?.name || "—"} ·{" "}
                                  {new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm text-slate-900 tabular-nums">{currency(inv.amount)}</p>
                                <span
                                  className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {inv.paid ? "Paid" : "Unpaid"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectProfitItems(inv.profitItems);
                                  setInspectOrderId(inv.orderId);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                              >
                                Inspect
                              </button>
                              {!inv.paid && chemistObj?.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCollectTarget({
                                      chemistId: chemistObj.id,
                                      chemistName: chemistObj.name,
                                      invoiceId: inv.id,
                                      invoiceNo: inv.invoiceNo,
                                      suggestedAmount: Number(inv.grandTotal ?? inv.amount),
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold"
                                >
                                  Collect
                                </button>
                              )}
                              {canManageInvoices && (
                                <button
                                  disabled={invoiceBusyId === inv.id}
                                  onClick={() => togglePaid(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                                >
                                  Mark {inv.paid ? "Unpaid" : "Paid"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Invoices Pagination Controls */}
              {invoicePagination && invoicePagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-1">
                  <button
                    disabled={invoicePage <= 1}
                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-slate-500 px-3 py-1.5">
                    Page {invoicePagination.page} of {invoicePagination.totalPages} · {invoicePagination.total} total
                  </span>
                  <button
                    disabled={invoicePage >= invoicePagination.totalPages}
                    onClick={() => setInvoicePage((p) => p + 1)}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: COMPLETE LEDGER HISTORY (Server-Paginated & Filterable)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="space-y-3.5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["ALL", "ORDER", "INVOICE", "COLLECTION"] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => {
                      setHistoryPage(1);
                      setHistoryTypeFilter(tp);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      historyTypeFilter === tp
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tp === "ALL" ? "All Activity" : tp}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => {
                    setHistoryPage(1);
                    setHistorySearch(e.target.value);
                  }}
                  placeholder="Search reference no, chemist, note…"
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between bg-sky-50/70 border border-sky-100 rounded-xl px-3.5 py-2">
                <span className="font-semibold text-sky-900">Orders Logged</span>
                <span className="font-bold text-sky-700 tabular-nums">{currency(historyTotals.ordersAmt)}</span>
              </div>
              <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl px-3.5 py-2">
                <span className="font-semibold text-indigo-900">Invoices Issued</span>
                <span className="font-bold text-indigo-700 tabular-nums">{currency(historyTotals.invoicedAmt)}</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-100 rounded-xl px-3.5 py-2">
                <span className="font-semibold text-emerald-900">Payments Collected</span>
                <span className="font-bold text-emerald-700 tabular-nums">{currency(historyTotals.collectedAmt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-x-auto">
            {historyLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                <History size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No matching transaction history found.</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3 font-bold">Transaction Date</th>
                    <th className="px-6 py-3 font-bold">Reference ID / No</th>
                    <th className="px-6 py-3 font-bold">Customer (Chemist)</th>
                    <th className="px-6 py-3 font-bold">Type</th>
                    <th className="px-6 py-3 font-bold">Activity Details</th>
                    <th className="px-6 py-3 font-bold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 text-xs">
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
                      <td className="px-6 py-4 font-semibold text-slate-800">{tx.partyName}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.type === "ORDER"
                              ? "bg-blue-100 text-blue-700"
                              : tx.type === "INVOICE"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{tx.description}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">
                        {tx.amount > 0 ? currency(tx.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {historyPagination && historyPagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-1">
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-500 px-3 py-1.5">
                Page {historyPagination.page} of {historyPagination.totalPages} · {historyPagination.total} total
              </span>
              <button
                disabled={historyPage >= historyPagination.totalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="px-3.5 py-1.5 rounded-xl bg-white text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Drawers & Modals ──────────────────────────────────────────────────── */}
      {inspectOrderId && (
        <OrderInvoiceDrawer
          orderId={inspectOrderId}
          profitItems={inspectProfitItems}
          isAdmin={isAdmin}
          onClose={() => {
            setInspectOrderId(null);
            setInspectProfitItems(undefined);
          }}
          onCollectPayment={(ctx) => setCollectTarget(ctx)}
          onEditInvoice={(invId) => setEditInvoiceId(invId)}
        />
      )}

      {collectTarget && (
        <CollectPaymentModal
          chemistId={collectTarget.chemistId}
          chemistName={collectTarget.chemistName}
          invoiceId={collectTarget.invoiceId}
          invoiceNo={collectTarget.invoiceNo}
          suggestedAmount={collectTarget.suggestedAmount}
          onClose={() => setCollectTarget(null)}
          onCollected={(msg) => {
            setCollectTarget(null);
            showToast(msg);
            refreshAll();
          }}
        />
      )}

      {showForm && (
        <NewOrderModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load(1, orderStatusFilter, orderSearch, orderUnbilledOnly);
            loadInvoices(1);
            loadInvoicingSummary();
            showToast("Secondary order booked & GST tax invoice generated.");
          }}
        />
      )}

      {editOrderId && (
        <EditOrderModal
          orderId={editOrderId}
          onClose={() => setEditOrderId(null)}
          onSaved={() => {
            setEditOrderId(null);
            load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
            loadInvoices();
            loadInvoicingSummary();
            showToast("Order changes saved & invoice synced.");
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
            load(ordersPage, orderStatusFilter, orderSearch, orderUnbilledOnly);
            loadInvoicingSummary();
            showToast("Invoice updated and ledger synchronized.");
          }}
        />
      )}

      {deleteOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Delete order {deleteOrder.id.slice(0, 8).toUpperCase()}?
              </h2>
              <button onClick={() => setDeleteOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              This permanently removes the order, restores deducted inventory, and voids its invoice &amp; ledger entries.
            </p>
            {deleteError && <p className="text-sm font-medium text-red-600">{deleteError}</p>}
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
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Delete invoice {deleteInvoice.invoiceNo}?
              </h2>
              <button onClick={() => setDeleteInvoice(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              This permanently removes invoice <span className="font-semibold text-slate-700">{deleteInvoice.invoiceNo}</span>{" "}
              and reverses its accounting ledger postings.
            </p>
            {deleteInvoiceError && <p className="text-sm font-medium text-red-600">{deleteInvoiceError}</p>}
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
                {deletingInvoice ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Order Line Items Editor + Scheme & GST Live Totals Summary ─────────
function computeBestScheme(schemes: ActiveScheme[], productId: string, quantity: number): ActiveScheme | null {
  const qualifying = schemes.filter((s) => s.productId === productId && quantity >= s.minQuantity);
  if (qualifying.length === 0) return null;
  return qualifying.reduce((best, cur) => (cur.discountPct > best.discountPct ? cur : best));
}

function estimateOrderTotals(items: LineItem[], products: Product[], schemes: ActiveScheme[]) {
  return items.reduce(
    (acc, it) => {
      const p = products.find((prod) => prod.id === it.productId);
      if (!p) return acc;
      const listPtr = Number(p.ptr ?? p.price) || 0;
      const qty = it.quantity || 0;
      const gross = listPtr * qty;
      const scheme = computeBestScheme(schemes, it.productId, qty);
      const effectiveDiscPct = scheme ? scheme.discountPct : it.discountPct || 0;
      const disc = gross * (effectiveDiscPct / 100);
      const net = gross - disc;
      const gst = net * ((Number(p.gstPct) || 0) / 100);
      return {
        gross: acc.gross + gross,
        discount: acc.discount + disc,
        netTaxable: acc.netTaxable + net,
        gst: acc.gst + gst,
        grandTotal: acc.grandTotal + net + gst,
      };
    },
    { gross: 0, discount: 0, netTaxable: 0, gst: 0, grandTotal: 0 }
  );
}

function OrderLineItemsEditor({
  items,
  products,
  activeSchemes = [],
  onUpdate,
  onAdd,
  onRemove,
}: {
  items: LineItem[];
  products: Product[];
  activeSchemes?: ActiveScheme[];
  onUpdate: (index: number, patch: Partial<LineItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const summary = estimateOrderTotals(items, products, activeSchemes);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Products{" "}
          <span className="font-normal normal-case text-slate-400">
            — PTR pricing governed by Admin master + auto-schemes
          </span>
        </label>
        <div className="space-y-2.5">
          {items.map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            const unitPrice = product ? Number(product.ptr ?? product.price) : 0;
            const stock = product?.stockQty;
            const lowStock = typeof stock === "number" && stock < item.quantity;
            const matchedScheme = item.productId
              ? computeBestScheme(activeSchemes, item.productId, item.quantity)
              : null;
            const effectiveDisc = matchedScheme ? matchedScheme.discountPct : item.discountPct || 0;
            const netLine = unitPrice * item.quantity * (1 - effectiveDisc / 100);

            return (
              <div key={index} className="border border-slate-200 rounded-xl p-3 space-y-2.5 bg-slate-50/40">
                <div className="flex items-center gap-2">
                  <SearchableSelect
                    value={item.productId}
                    onChange={(e) => {
                      const chosen = products.find((p) => p.id === e.target.value);
                      onUpdate(index, {
                        productId: e.target.value,
                        batchNo: chosen?.currentBatchNo ?? item.batchNo,
                        expDate: chosen?.currentExpDate ? String(chosen.currentExpDate).slice(0, 10) : item.expDate,
                      });
                    }}
                    placeholder="Select product"
                    searchPlaceholder="Search product SKU or name…"
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
                    name="quantity"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => onUpdate(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    title="Billed Quantity"
                    className="w-20 border border-slate-300 bg-white rounded-xl px-2.5 py-2 text-sm text-right font-bold"
                  />

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      aria-label="Remove product line"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {product && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pl-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                        {product.mrp && <span>MRP: {currency(product.mrp)}</span>}
                        <span>PTR: {currency(unitPrice)}</span>
                        {product.packSize && <span>Pack: {product.packSize}</span>}
                        {typeof stock === "number" && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              lowStock
                                ? "bg-red-100 text-red-700"
                                : stock <= 10
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            Stock: {stock}
                          </span>
                        )}
                        {matchedScheme && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                            Scheme: {matchedScheme.name} (-{matchedScheme.discountPct}%)
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums">Net: {currency(netLine)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Batch No</label>
                        <input
                          name="batchNo"
                          value={item.batchNo}
                          onChange={(e) => onUpdate(index, { batchNo: e.target.value })}
                          placeholder="Batch no."
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Expiry</label>
                        <input
                          name="expDate"
                          type="date"
                          value={item.expDate}
                          onChange={(e) => onUpdate(index, { expDate: e.target.value })}
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Free Qty</label>
                        <input
                          name="freeQty"
                          type="number"
                          min={0}
                          value={item.freeQty || ""}
                          onChange={(e) => onUpdate(index, { freeQty: Math.max(0, Number(e.target.value) || 0) })}
                          placeholder="0"
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                          Disc % {matchedScheme ? "(Scheme)" : ""}
                        </label>
                        <input
                          name="discountPct"
                          type="number"
                          min={0}
                          max={100}
                          disabled={Boolean(matchedScheme)}
                          value={matchedScheme ? matchedScheme.discountPct : item.discountPct || ""}
                          onChange={(e) =>
                            onUpdate(index, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                          }
                          placeholder="0"
                          className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs disabled:bg-indigo-50 disabled:text-indigo-700 disabled:font-bold"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
        >
          <Plus size={14} /> Add another product
        </button>
      </div>

      {/* Live Financial Breakdown Footer */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>PTR Subtotal</span>
          <span className="font-semibold tabular-nums">{currency(summary.gross)}</span>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Scheme / Line Discount</span>
            <span className="font-semibold tabular-nums">-{currency(summary.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <span>Estimated GST</span>
          <span className="font-semibold tabular-nums">+{currency(summary.gst)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm">
          <span className="font-bold text-slate-900">Estimated Total (incl. GST)</span>
          <span className="text-lg font-display font-bold text-slate-900 tabular-nums">
            {currency(summary.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── New Order Modal (With Credit Pre-Check & Active Scheme Auto-Preview) ────
function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [chemists, setChemists] = useState<Entity[]>([]);
  const [distributors, setDistributors] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSchemes, setActiveSchemes] = useState<ActiveScheme[]>([]);
  const [chemistCredit, setChemistCredit] = useState<ChemistCreditInfo | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  const [chemistId, setChemistId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0, discountPct: 0 },
  ]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [lrNo, setLrNo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [transport, setTransport] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [cases, setCases] = useState("");

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
    apiClient
      .get("/api/manager/entities", { params: { type: "CHEMIST", limit: 300 } })
      .then((res) => {
        const ents = res.data?.data?.entities || [];
        if (ents.length > 0) setChemists(ents);
        else {
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

    apiClient
      .get("/api/mr/territories")
      .then(async (res) => {
        const territories: { id: string }[] = res.data?.data?.territories ?? [];
        const merged = new Map<string, Entity>();
        if (territories.length > 0) {
          const results = await Promise.all(
            territories.map((t) =>
              apiClient
                .get("/api/manager/entities", { params: { type: "DISTRIBUTOR", territoryId: t.id, limit: 200 } })
                .catch(() => null)
            )
          );
          for (const r of results) {
            if (r?.data?.data?.entities) {
              for (const d of r.data.data.entities as Entity[]) merged.set(d.id, d);
            }
          }
        }
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
        if (allRes?.data?.data?.entities) setDistributors(allRes.data.data.entities);
      });

    apiClient
      .get("/api/products", { params: { limit: 150 } })
      .then((res) => setProducts(res.data?.data?.products || []))
      .catch((err) => console.error("Failed to load products:", err));

    apiClient
      .get("/api/orders/booking-context")
      .then((res) => setActiveSchemes(res.data?.data?.activeSchemes || []))
      .catch(() => {});
  }, []);

  // Load selected chemist's live credit headroom
  useEffect(() => {
    if (!chemistId) {
      setChemistCredit(null);
      return;
    }
    let cancelled = false;
    setCreditLoading(true);
    apiClient
      .get("/api/orders/booking-context", { params: { chemistId } })
      .then((res) => {
        if (!cancelled) {
          if (res.data?.data?.activeSchemes) setActiveSchemes(res.data.data.activeSchemes);
          setChemistCredit(res.data?.data?.chemistCredit ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setChemistCredit(null);
      })
      .finally(() => {
        if (!cancelled) setCreditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chemistId]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItem = () =>
    setItems((prev) => [...prev, { productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0, discountPct: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalsPreview = estimateOrderTotals(items, products, activeSchemes);
  const wouldExceedCredit =
    chemistCredit &&
    chemistCredit.availableHeadroom !== null &&
    totalsPreview.netTaxable > chemistCredit.availableHeadroom;

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
        lrNo: lrNo.trim() || undefined,
        dueDate: dueDate || undefined,
        transport: transport.trim() || undefined,
        vehicleNo: vehicleNo.trim() || undefined,
        cases: cases ? Number(cases) : undefined,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          batchNo: it.batchNo || undefined,
          expDate: it.expDate || undefined,
          freeQty: it.freeQty || undefined,
          discountPct: it.discountPct || undefined,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">Book Secondary Order</h2>
            <p className="text-xs text-slate-500">Live credit check, auto-schemes, stock deduction &amp; GST invoice</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
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
                    className="w-full border-2 border-emerald-500/50 bg-emerald-50/60 rounded-xl p-2.5 cursor-pointer hover:bg-emerald-50 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                        <Store size={15} />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-bold text-slate-900 text-sm truncate">{selectedChemist.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {selectedChemist.address || selectedChemist.territoryName || "Retail Partner"}
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
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg"
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
                      name="chemistSearch"
                      placeholder="Search chemist name, address, area…"
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
                      <div className="p-2 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center sticky top-0 border-b border-slate-200">
                        <span>{filteredChemists.length} Chemists</span>
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
                          {chemists.length === 0 ? "No chemists in your territory" : `No chemists matching "${chemistSearch}"`}
                        </div>
                      ) : (
                        filteredChemists.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => selectChemist(c)}
                            className={`p-2.5 cursor-pointer hover:bg-emerald-50/70 transition flex items-center justify-between text-left ${
                              c.id === chemistId ? "bg-emerald-50 font-semibold" : ""
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-sm text-slate-900 font-medium truncate">{c.name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {c.address || c.territoryName || "Retail Chemist"}
                                {c.mobile ? ` · ${c.mobile}` : ""}
                              </p>
                            </div>
                            {c.id === chemistId && <Check size={16} className="text-emerald-600 shrink-0" />}
                          </div>
                        ))
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
              name="distributorId"
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              placeholder="Select distributor"
              searchPlaceholder="Search distributor name…"
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

        {/* Live Chemist Credit Headroom Indicator */}
        {chemistId && (
          <div
            className={`rounded-xl px-3.5 py-2.5 border text-xs flex flex-wrap items-center justify-between gap-2 ${
              wouldExceedCredit || chemistCredit?.status === "BREACHED"
                ? "bg-red-50 border-red-200 text-red-800"
                : chemistCredit?.status === "WARNING"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            {creditLoading ? (
              <span>Checking chemist credit limit &amp; exposure…</span>
            ) : chemistCredit ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span className="font-bold">
                    Outstanding: {currency(chemistCredit.outstanding)}
                    {chemistCredit.unpaidInvoicesCount > 0 && ` (${chemistCredit.unpaidInvoicesCount} unpaid inv)`}
                  </span>
                  {chemistCredit.creditLimit !== null && (
                    <span>· Limit: {currency(chemistCredit.creditLimit)}</span>
                  )}
                </div>
                <span className="font-bold">
                  {wouldExceedCredit
                    ? `Exceeds headroom (${currency(chemistCredit.availableHeadroom ?? 0)})`
                    : chemistCredit.availableHeadroom !== null
                    ? `Headroom: ${currency(chemistCredit.availableHeadroom)}`
                    : "Unrestricted limit"}
                </span>
              </>
            ) : (
              <span>Chemist credit exposure synced on submit.</span>
            )}
          </div>
        )}

        {/* Prescribed Doctor Linkage */}
        <PrescribedDoctorPicker chemistId={chemistId} doctorId={doctorId} onChange={setDoctorId} />

        {/* Shared Line Item Editor */}
        <OrderLineItemsEditor
          items={items}
          products={products}
          activeSchemes={activeSchemes}
          onUpdate={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
        />

        {/* Optional Logistics & Dispatch Metadata */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDispatch((v) => !v)}
            className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700"
          >
            <span>Optional Transport, LR &amp; Due Date Details</span>
            {showDispatch ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDispatch && (
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">LR No</label>
                <input
                  name="lrNo"
                  value={lrNo}
                  onChange={(e) => setLrNo(e.target.value)}
                  placeholder="LR number"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Due Date</label>
                <input
                  name="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Cases</label>
                <input
                  name="cases"
                  type="number"
                  min={0}
                  value={cases}
                  onChange={(e) => setCases(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Transport</label>
                <input
                  name="transport"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  placeholder="Carrier name"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Vehicle No</label>
                <input
                  name="vehicleNo"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="e.g. TS09AB1234"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          {submitting ? "Booking Order…" : "Book Order & Issue Tax Invoice"}
        </button>
      </div>
    </div>
  );
}

// ─── Edit Order Modal ──────────────────────────────────────────────────────────
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
  const [activeSchemes, setActiveSchemes] = useState<ActiveScheme[]>([]);
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
      apiClient.get("/api/products", { params: { limit: 150 } }),
      apiClient.get("/api/orders/booking-context").catch(() => null),
    ])
      .then(([orderRes, productsRes, ctxRes]) => {
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
            expDate: it.expDate ? String(it.expDate).slice(0, 10) : "",
            freeQty: it.freeQty ?? 0,
            discountPct: Number(it.discountPct ?? 0),
          }))
        );
        setProducts(productsRes.data.data.products);
        if (ctxRes?.data?.data?.activeSchemes) setActiveSchemes(ctxRes.data.data.activeSchemes);
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
  const addItem = () =>
    setItems((prev) => [...prev, { productId: "", quantity: 1, batchNo: "", expDate: "", freeQty: 0, discountPct: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

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
          discountPct: it.discountPct || undefined,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-2xl space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-display font-bold text-slate-900">Edit Secondary Order</h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chemist</p>
                <p className="font-bold text-slate-900 mt-0.5">{chemistName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distributor</p>
                <p className="font-bold text-slate-900 mt-0.5">{distributorName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Order Status</p>
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

            <OrderLineItemsEditor
              items={items}
              products={products}
              activeSchemes={activeSchemes}
              onUpdate={updateItem}
              onAdd={addItem}
              onRemove={removeItem}
            />

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Saving Changes…" : "Save Changes & Sync Invoice"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Interactive Status Funnel Tile ────────────────────────────────────────────
function KpiTile({
  icon: Icon,
  label,
  value,
  sharePct,
  tone,
  active,
  onClick,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  sharePct: number;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-100 text-amber-700"
      : tone === "good"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "blue"
      ? "bg-sky-100 text-sky-700"
      : "bg-purple-100 text-purple-700";

  const barClass =
    tone === "warn"
      ? "bg-amber-500"
      : tone === "good"
      ? "bg-emerald-500"
      : tone === "blue"
      ? "bg-sky-500"
      : "bg-purple-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all hover:shadow-md ${
        active ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
          <Icon size={20} />
        </div>
        <span className="text-[11px] font-bold text-slate-400 tabular-nums">{sharePct}%</span>
      </div>
      <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mt-3.5 tabular-nums">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        {active && <span className="text-[10px] font-bold text-emerald-600">Filtered</span>}
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-2.5">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${sharePct}%` }} />
      </div>
    </button>
  );
}
