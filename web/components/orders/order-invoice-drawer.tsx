"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Printer,
  Truck,
  Receipt,
  MapPin,
  Stethoscope,
  Wallet,
  Copy,
  Check,
  FileText,
  ArrowUpRight,
  Package,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface OrderInvoiceDrawerProps {
  orderId: string;
  profitItems?: Array<{
    id?: string;
    productName: string;
    quantity: number;
    freeQty: number;
    billedPrice: number;
    costBasis: number;
    costBasisSource: string;
    lineProfit: number;
    lineProfitPct: number | null;
  }>;
  isAdmin?: boolean;
  onClose: () => void;
  onCollectPayment?: (ctx: {
    chemistId: string;
    chemistName: string;
    invoiceId?: string;
    invoiceNo?: string;
    suggestedAmount: number;
  }) => void;
  onEditInvoice?: (invoiceId: string) => void;
}

function currency(val: number | string | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(val) || 0);
}

const PIPELINE_STEPS = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;

export function OrderInvoiceDrawer({
  orderId,
  profitItems,
  isAdmin,
  onClose,
  onCollectPayment,
  onEditInvoice,
}: OrderInvoiceDrawerProps) {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get(`/api/orders/${orderId}`)
      .then((res) => {
        if (!cancelled) setOrder(res.data?.data?.order ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message || "Failed to load order/invoice details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleCopySummary = async () => {
    if (!order) return;
    const inv = order.invoice;
    const total = Number(inv?.grandTotal ?? inv?.amount ?? 0);
    const lines = (order.items || []).map(
      (it: any) => `• ${it.product?.name} × ${it.quantity}${it.freeQty ? ` (+${it.freeQty} free)` : ""}`
    );
    const text = [
      `*TAX INVOICE SUMMARY*`,
      inv ? `Invoice: *${inv.invoiceNo}* (${inv.paid ? "PAID" : "UNPAID"})` : `Order Ref: *${order.id.slice(0, 8).toUpperCase()}*`,
      `Customer: *${inv?.partyName || order.chemist?.name || "Customer"}*`,
      `Distributor: ${order.distributor?.name || "—"}`,
      order.doctor ? `Prescribed By: Dr. ${order.doctor.fullName}` : "",
      `Date: ${new Date(inv?.createdAt ?? order.createdAt).toLocaleDateString("en-IN")}`,
      inv?.dueDate ? `Due Date: ${new Date(inv.dueDate).toLocaleDateString("en-IN")}` : "",
      ``,
      `*Items (${lines.length}):*`,
      ...lines,
      ``,
      `*Grand Total: ₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}*`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // Clipboard blocked in non-HTTPS test contexts
    }
  };

  const inv = order?.invoice;
  const activeStepIdx = order ? PIPELINE_STEPS.indexOf(order.status) : -1;
  const lineTotal =
    order?.items?.reduce((s: number, it: any) => s + Number(it.price || 0) * (it.quantity || 0), 0) ?? 0;
  const grandTotal = Number(inv?.grandTotal ?? inv?.amount ?? lineTotal);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drawer Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Commercial Audit Inspector
            </p>
            <h2 className="text-lg font-display font-bold mt-0.5">
              {inv ? inv.invoiceNo : `Order ${orderId.slice(0, 8).toUpperCase()}`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition"
              >
                {copiedSummary ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedSummary ? "Copied WhatsApp" : "Copy Summary"}
              </button>
            )}
            <Link
              href={`/invoices/${orderId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition"
            >
              <Printer size={13} /> Print Slip
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector drawer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : error || !order ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium">
              {error || "Order not found."}
            </div>
          ) : (
            <>
              {/* Fulfilment Stepper */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Fulfilment Lifecycle
                  </span>
                  <span className="text-xs font-bold text-slate-900">{order.status}</span>
                </div>
                {order.status === "CANCELLED" ? (
                  <p className="text-xs font-bold text-red-600">This order has been cancelled.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {PIPELINE_STEPS.map((st, idx) => {
                      const done = activeStepIdx >= idx;
                      return (
                        <div key={st} className="space-y-1">
                          <div className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-200"}`} />
                          <p
                            className={`text-[10px] font-bold ${
                              done ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            {st}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Billing & Financial Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <FileText size={12} className="text-indigo-600" />
                    Consignee Snapshot
                  </div>
                  <p className="text-sm font-bold text-slate-900">{inv?.partyName || order.chemist?.name || "—"}</p>
                  <p className="text-slate-500">{inv?.partyAddress || order.chemist?.address || "—"}</p>
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-600 font-mono">
                    {inv?.partyGstNo && <span>GSTIN: {inv.partyGstNo}</span>}
                    {inv?.partyDlNo && <span>DL: {inv.partyDlNo}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {order.chemist?.territory?.name && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-[10px]">
                        <MapPin size={9} /> {order.chemist.territory.name}
                      </span>
                    )}
                    {order.doctor && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold text-[10px]">
                        <Stethoscope size={9} /> Dr. {order.doctor.fullName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Receipt size={12} className="text-emerald-600" /> GST Billing Summary
                    </span>
                    {inv && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {inv.paid ? "Paid" : "Unpaid"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable / Subtotal</span>
                      <span className="font-semibold tabular-nums">{currency(inv?.amount ?? lineTotal)}</span>
                    </div>
                    {Number(inv?.totalDiscount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Trade Discount</span>
                        <span className="font-semibold tabular-nums">-{currency(inv.totalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Total GST</span>
                      <span className="font-semibold tabular-nums">{currency(inv?.totalGst ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                      <span>Grand Total</span>
                      <span className="tabular-nums">{currency(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch / LR Card */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Truck size={13} className="text-sky-600" /> Logistics &amp; Dispatch Details
                  </span>
                  {isAdmin && inv && onEditInvoice && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditInvoice(inv.id);
                      }}
                      className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5"
                    >
                      Edit Dispatch / Items <ArrowUpRight size={11} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <p className="text-[10px] text-slate-400">Distributor</p>
                    <p className="font-semibold text-slate-800">{order.distributor?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Transport / Vehicle</p>
                    <p className="font-semibold text-slate-800">
                      {inv?.transport || inv?.vehicleNo ? `${inv?.transport || ""} ${inv?.vehicleNo || ""}`.trim() : "Direct"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">LR No &amp; Cases</p>
                    <p className="font-semibold text-slate-800">
                      {inv?.lrNo || "—"} {inv?.cases ? `(${inv.cases} cases)` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Due Date</p>
                    <p className="font-semibold text-slate-800">
                      {inv?.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "Net 21 Days"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Booked By</p>
                    <p className="font-semibold text-slate-800">
                      {order.employee ? `${order.employee.firstName} ${order.employee.lastName}` : "Central Booking"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <Package size={13} className="text-emerald-600" />
                  Order Line Items ({order.items?.length ?? 0})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 text-[10px] text-slate-500 uppercase border-b border-slate-100">
                        <th className="px-3.5 py-2 text-left">Product</th>
                        <th className="px-3.5 py-2 text-left">Batch / Exp</th>
                        <th className="px-3.5 py-2 text-right">Qty (+Free)</th>
                        <th className="px-3.5 py-2 text-right">Rate</th>
                        <th className="px-3.5 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(order.items || []).map((it: any) => (
                        <tr key={it.id}>
                          <td className="px-3.5 py-2.5">
                            <p className="font-bold text-slate-800">{it.product?.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {it.product?.sku} {it.gstPct ? `· GST ${Number(it.gstPct)}%` : ""}
                            </p>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500">
                            {it.batchNo || "Auto"}
                            {it.expDate && ` · ${String(it.expDate).slice(0, 7)}`}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums font-bold">
                            {it.quantity}
                            {it.freeQty > 0 && <span className="text-emerald-600"> (+{it.freeQty})</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums">{currency(it.price)}</td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                            {currency(Number(it.price) * it.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Profit Breakdown if available */}
              {isAdmin && profitItems && profitItems.length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-2 text-xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    Admin Margin Breakdown (Read-Only)
                  </p>
                  <div className="divide-y divide-emerald-100">
                    {profitItems.map((pi, idx) => (
                      <div key={pi.id || idx} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          {pi.productName}{" "}
                          <span className="text-[10px] font-mono text-slate-500">({pi.costBasisSource})</span>
                        </span>
                        <span className={`font-bold tabular-nums ${pi.lineProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                          {currency(pi.lineProfit)} {pi.lineProfitPct != null ? `(${pi.lineProfitPct.toFixed(1)}%)` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Footer Actions */}
        {order && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-slate-500">
              {inv ? `Invoice ${inv.invoiceNo}` : "Unbilled order"}
            </span>
            <div className="flex items-center gap-2">
              {inv && !inv.paid && order.chemist?.id && onCollectPayment && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCollectPayment({
                      chemistId: order.chemist.id,
                      chemistName: order.chemist.name,
                      invoiceId: inv.id,
                      invoiceNo: inv.invoiceNo,
                      suggestedAmount: grandTotal,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm"
                >
                  <Wallet size={13} /> Record Payment
                </button>
              )}
              <Link
                href={`/invoices/${order.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                <Printer size={13} /> Full Print View
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
