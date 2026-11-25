"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Layers } from "lucide-react";
import QRCode from "qrcode";
import { apiClient } from "@/lib/api-client";
import { computeLineTotalsWithSplit, determineTaxSplit, taxClassSummaryWithSplit } from "@/lib/gst";

function formatMoney(v: number | string): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(v) || 0
  );
}

function BatchPrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get("ids") || "";
  const orderIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [orders, setOrders] = useState<any[]>([]);
  const [company, setCompany] = useState<any | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient.get("/api/company-settings").catch(() => null),
      ...orderIds.map((id) => apiClient.get(`/api/orders/${id}`).catch(() => null)),
    ])
      .then(async ([compRes, ...ordResults]) => {
        if (cancelled) return;
        const comp = compRes?.data?.data?.settings ?? null;
        setCompany(comp);
        const loaded = ordResults
          .map((r) => r?.data?.data?.order)
          .filter(Boolean);
        setOrders(loaded);

        const nextQr: Record<string, string> = {};
        for (const ord of loaded) {
          const amt = Number(ord.invoice?.grandTotal ?? ord.invoice?.amount ?? 0);
          const vpa = comp?.upiId || "SBIBHIM.INSTANT90889373636766474@sbipay";
          const uri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
            comp?.name || "Metapharsic Lifesciences"
          )}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Inv ${ord.invoice?.invoiceNo || ord.id}`)}`;
          try {
            nextQr[ord.id] = await QRCode.toDataURL(uri, { width: 256, margin: 1 });
          } catch {}
        }
        if (!cancelled) setQrMap(nextQr);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs font-bold uppercase text-slate-600">
            Preparing {orderIds.length} GST Tax Invoices…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .batch-invoice-sheet {
            page-break-after: always;
          }
          .batch-invoice-sheet:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="max-w-4xl mx-auto mb-6 bg-slate-950 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <p className="text-sm font-bold flex items-center gap-1.5">
              <Layers size={15} className="text-emerald-400" />
              Bulk GST Invoice Print Queue ({orders.length})
            </p>
            <p className="text-[11px] text-slate-400">One page per statutory tax invoice</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={orders.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold disabled:opacity-50"
        >
          <Printer size={14} /> Print All ({orders.length})
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-8 text-center border border-slate-300">
          <p className="text-sm font-bold text-slate-700">No invoices selected for bulk printing.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
          {orders.map((order) => {
            const inv = order.invoice;
            const buyerGstin = inv?.partyGstNo ?? order.chemist?.gstNo ?? null;
            const buyerName = inv?.partyName ?? order.chemist?.name ?? order.doctor?.fullName ?? "Customer";
            const buyerAddress = inv?.partyAddress ?? order.chemist?.address ?? order.doctor?.clinicAddress ?? "—";
            const taxSplit = determineTaxSplit(company?.gstin ?? null, buyerGstin);
            const gstLines = (order.items || []).map((item: any) => ({
              quantity: item.quantity,
              price: Number(item.price),
              discountPct: 0,
              gstPct: Number(item.gstPct || 0),
            }));
            const classSummary = taxClassSummaryWithSplit(gstLines, taxSplit);
            const finalGrandTotal = Number(inv?.grandTotal ?? inv?.amount ?? 0);

            return (
              <div
                key={order.id}
                className="batch-invoice-sheet bg-white border-2 border-slate-900 p-5 text-slate-900 text-xs shadow-md print:shadow-none"
              >
                <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start gap-4">
                  <div>
                    <h1 className="text-base font-black uppercase">{company?.name || "METAPHARSIC LIFESCIENCES"}</h1>
                    <p className="text-[10px] text-slate-700 mt-0.5">{company?.address || "Registered Pharma Office"}</p>
                    <p className="text-[10px] font-mono mt-0.5">
                      <b>GSTIN:</b> {company?.gstin || "—"} | <b>PAN:</b> {company?.panNo || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-slate-950 text-white px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                      ORIGINAL FOR RECIPIENT
                    </span>
                    <p className="text-base font-serif font-black mt-1">TAX INVOICE</p>
                    <p className="font-mono font-bold text-sm">{inv?.invoiceNo || order.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-300 text-[11px]">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-500">Billed To (Consignee)</p>
                    <p className="font-bold text-slate-950">M/S {buyerName}</p>
                    <p className="text-slate-700">{buyerAddress}</p>
                    <p className="font-mono text-[10px] mt-0.5">
                      GSTIN: {buyerGstin || "UNREGISTERED"} | DL: {inv?.partyDlNo || "—"}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5 font-mono text-[10px]">
                    <p>Date: <b>{new Date(inv?.createdAt ?? order.createdAt).toLocaleDateString("en-IN")}</b></p>
                    <p>Order Ref: <b>{order.id.slice(0, 8).toUpperCase()}</b></p>
                    <p>Distributor: <b>{order.distributor?.name || "—"}</b></p>
                    <p>Due Date: <b>{inv?.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "Net 21 Days"}</b></p>
                  </div>
                </div>

                <table className="w-full border-collapse my-3 text-[10px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-mono">
                      <th className="py-1.5 px-2 text-left">#</th>
                      <th className="py-1.5 px-2 text-left">Product</th>
                      <th className="py-1.5 px-2 text-center">Batch</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Free</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">GST%</th>
                      <th className="py-1.5 px-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-mono">
                    {(order.items || []).map((item: any, idx: number) => {
                      const lt = computeLineTotalsWithSplit(
                        {
                          quantity: item.quantity,
                          price: Number(item.price),
                          discountPct: 0,
                          gstPct: Number(item.gstPct || 0),
                        },
                        taxSplit
                      );
                      return (
                        <tr key={item.id}>
                          <td className="py-1 px-2">{idx + 1}</td>
                          <td className="py-1 px-2 font-sans font-bold">{item.product?.name}</td>
                          <td className="py-1 px-2 text-center">{item.batchNo || "—"}</td>
                          <td className="py-1 px-2 text-right font-bold">{item.quantity}</td>
                          <td className="py-1 px-2 text-right">{item.freeQty || "—"}</td>
                          <td className="py-1 px-2 text-right">{formatMoney(item.price)}</td>
                          <td className="py-1 px-2 text-right">{Number(item.gstPct || 0).toFixed(1)}%</td>
                          <td className="py-1 px-2 text-right font-bold">{formatMoney(lt.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="border-t-2 border-slate-900 pt-3 flex items-center justify-between gap-4">
                  <div className="text-[10px] space-y-1">
                    <p className="font-mono font-bold">
                      Tax Summary:{" "}
                      {classSummary
                        .map((c) => `${c.gstPct}% Taxable ₹${formatMoney(c.taxableValue)}`)
                        .join(" | ")}
                    </p>
                    <p className="italic text-slate-700">
                      Certified under Sec 19 Drugs &amp; Cosmetics Act, 1940. Subject to local jurisdiction.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {qrMap[order.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrMap[order.id]} alt="UPI QR" className="w-16 h-16 border border-slate-400" />
                    )}
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Net Grand Total</p>
                      <p className="text-lg font-mono font-black">₹{formatMoney(finalGrandTotal)}</p>
                      <p className="text-[9px] font-bold uppercase mt-1">
                        {inv?.paid ? "STATUS: PAID" : "STATUS: UNPAID"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BatchPrintInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm">Loading print queue…</div>}>
      <BatchPrintContent />
    </Suspense>
  );
}
