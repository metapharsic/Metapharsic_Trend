"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, ShieldCheck, Scissors } from "lucide-react";
import QRCode from "qrcode";
import { apiClient } from "@/lib/api-client";
import { computeLineTotals, determineTaxSplit, taxClassSummaryWithSplit, computeFreeStripsValue } from "@/lib/gst";

interface OrderItem {
  id: string;
  quantity: number;
  price: string;
  hsnCode: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expDate: string | null;
  packSize: string | null;
  freeQty: number;
  mrp: string | null;
  discountPct: string;
  gstPct: string;
  product: { id: string; name: string; sku: string };
}

interface Invoice {
  invoiceNo: string;
  amount: string;
  paid: boolean;
  createdAt: string;
  partyName: string | null;
  partyGstNo: string | null;
  partyAddress: string | null;
  partyDlNo: string | null;
  partyPhone: string | null;
  lrNo: string | null;
  lrDate: string | null;
  cases: number | null;
  dueDate: string | null;
  transport: string | null;
  vehicleNo: string | null;
  totalItems: number | null;
  totalQty: number | null;
  totalDiscount: string | null;
  totalGst: string | null;
  roundOff: string;
  grandTotal: string | null;
}

interface CompanySettings {
  name: string;
  address: string;
  phone: string | null;
  panNo: string | null;
  dlNo1: string | null;
  dlNo2: string | null;
  gstin: string | null;
  bankName: string | null;
  bankBranch: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  upiId: string | null;
  terms: string | null;
  logoUrl: string | null;
}

interface OrderDetail {
  id: string;
  status: string;
  createdAt: string;
  chemist: { name: string; address: string; mobile: string | null; gstNo: string | null } | null;
  doctor: { fullName: string; clinicAddress: string; mobile: string | null } | null;
  distributor: { name: string; address: string; gstNo: string | null };
  employee: { firstName: string; lastName: string } | null;
  items: OrderItem[];
  invoice: Invoice | null;
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatChunk = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = "";
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remaining = rupees % 1000;

  if (crore > 0) result += formatChunk(crore) + "Crore ";
  if (lakh > 0) result += formatChunk(lakh) + "Lakh ";
  if (thousand > 0) result += formatChunk(thousand) + "Thousand ";
  if (remaining > 0) result += formatChunk(remaining);

  result = result.trim() ? "INR " + result.trim() + " Rupees" : "Zero Rupees";
  if (paise > 0) {
    result += " and " + formatChunk(paise).trim() + "Paise";
  }
  return result + " Only";
}

interface SingleInvoiceProps {
  copyLabel: string;
  order: OrderDetail;
  company: CompanySettings | null;
  qrDataUrl: string | null;
  taxSplit: string;
  classSummary: Array<{
    gstPct: number;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  }>;
  freeStripsValue: number;
  bookedBy: string;
  finalGrandTotal: number;
  buyerGstin: string | null;
  buyerName: string;
  buyerAddress: string;
}

function SingleInvoiceCard({
  copyLabel,
  order,
  company,
  qrDataUrl,
  taxSplit,
  classSummary,
  freeStripsValue,
  bookedBy,
  finalGrandTotal,
  buyerGstin,
  buyerName,
  buyerAddress,
}: SingleInvoiceProps) {
  const inv = order.invoice;

  return (
    <div className="invoice-card relative bg-white rounded-lg shadow-sm border-2 border-slate-900 p-3 sm:p-3.5 text-xs leading-tight overflow-hidden h-full flex flex-col justify-between">
      {/* Full Document Diagonal Security Watermark */}
      <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none overflow-hidden">
        <div className="invoice-watermark -rotate-25 text-center flex flex-col items-center justify-center opacity-[0.04] print:opacity-[0.04] text-slate-900">
          {company?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              className="w-28 h-28 object-contain mb-1 grayscale"
            />
          )}
          <span className="text-2xl sm:text-3xl font-display font-black tracking-widest uppercase">
            {company?.name || "METAPHARSIC LIFESCIENCES"}
          </span>
          <span className="text-xs font-bold tracking-widest mt-0.5 uppercase">
            COMMERCIAL TAX INVOICE • A5 FORMAT
          </span>
        </div>
      </div>

      {/* Content Container (Above Watermark) */}
      <div className="relative z-10 space-y-2">
        {/* 1. Header Banner & Official Copy Badge */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="invoice-title text-base sm:text-lg font-display font-black tracking-tight text-slate-900 uppercase">
                TAX INVOICE
              </h1>
              <span className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                <ShieldCheck size={10} /> GST
              </span>
              <span className="inline-flex items-center gap-0.5 bg-blue-50 border border-blue-300 text-blue-900 text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider print:border-slate-800 print:text-slate-900">
                A5 (1/2 A4)
              </span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Sec 31 CGST / SGST Act 2017
            </p>
          </div>

          <div className="text-right space-y-0.5">
            <div className="inline-block border border-slate-800 bg-slate-50 px-2 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider text-slate-900 shadow-2xs">
              {copyLabel}
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 text-[10px] text-right">
              <span className="font-semibold text-slate-500">Inv No:</span>
              <span className="font-mono font-bold text-slate-900">{inv?.invoiceNo ?? "—"}</span>
              <span className="font-semibold text-slate-500">Date:</span>
              <span className="font-bold text-slate-900">{shortDate(inv?.createdAt ?? order.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 2. Order, Transport & Dispatch Matrix Box */}
        <div className="border border-slate-300 rounded bg-slate-50/70 p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1 text-[9px]">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Order Ref</span>
            <span className="font-semibold text-slate-900">{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Order Date</span>
            <span className="font-semibold text-slate-900">{shortDate(order.createdAt)}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">L.R. No</span>
            <span className="font-semibold text-slate-900">{inv?.lrNo ?? "—"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">L.R. Date</span>
            <span className="font-semibold text-slate-900">{shortDate(inv?.lrDate ?? null)}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Cases</span>
            <span className="font-semibold text-slate-900">{inv?.cases ?? "—"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Due Date</span>
            <span className="font-semibold text-slate-900 text-rose-700">{shortDate(inv?.dueDate ?? null)}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Transporter</span>
            <span className="font-semibold text-slate-900 truncate block">{inv?.transport ?? "—"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px] block">Vehicle</span>
            <span className="font-semibold text-slate-900">{inv?.vehicleNo ?? "—"}</span>
          </div>
        </div>

        {/* 3. Billed By (Seller) & Billed To (Buyer) Side-by-Side Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          {/* Seller Details */}
          <div className="border border-slate-300 rounded p-2 bg-white space-y-0.5">
            <div className="border-b border-slate-200 pb-0.5 mb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
                Consignor (Billed By)
              </span>
              {company?.gstin && (
                <span className="text-[9px] font-mono font-bold text-slate-600">
                  GST: {company.gstin}
                </span>
              )}
            </div>
            <div className="flex items-start gap-1.5">
              {company?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-6 w-auto object-contain shrink-0" />
              )}
              <div>
                <h2 className="invoice-company-name text-[11px] sm:text-xs font-black text-slate-900">
                  {company?.name || "Metapharsic Lifesciences"}
                </h2>
                <p className="text-[10px] text-slate-700 leading-tight">{company?.address}</p>
              </div>
            </div>
            <div className="pt-0.5 text-[9px] text-slate-600 space-y-0.2 border-t border-slate-100">
              {company?.phone && <p><span className="font-semibold text-slate-500">Ph:</span> {company.phone}</p>}
              <p>
                {company?.panNo && <><span className="font-semibold text-slate-500">PAN:</span> {company.panNo} · </>}
                {company?.dlNo1 && <><span className="font-semibold text-slate-500">DL:</span> {company.dlNo1}</>}
              </p>
            </div>
          </div>

          {/* Buyer Details */}
          <div className="border border-slate-300 rounded p-2 bg-white space-y-0.5">
            <div className="border-b border-slate-200 pb-0.5 mb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">
                Buyer (Billed To)
              </span>
              {buyerGstin && (
                <span className="text-[9px] font-mono font-bold text-slate-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                  GST: {buyerGstin}
                </span>
              )}
            </div>
            <h2 className="text-[11px] sm:text-xs font-black text-slate-900">
              {buyerName}
            </h2>
            <p className="text-[10px] text-slate-700 leading-tight">{buyerAddress}</p>
            <div className="pt-0.5 text-[9px] text-slate-600 space-y-0.2 border-t border-slate-100">
              {inv?.partyPhone && <p><span className="font-semibold text-slate-500">Contact:</span> {inv.partyPhone}</p>}
              {inv?.partyDlNo && <p><span className="font-semibold text-slate-500">DL:</span> {inv.partyDlNo}</p>}
            </div>
          </div>
        </div>

        {/* 4. Complete Line Items Table */}
        <div className="border border-slate-900 rounded overflow-hidden">
          <table className="invoice-table w-full border-collapse text-[9px] sm:text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b border-slate-900 text-[9px]">
                <th className="py-0.5 px-1 text-center border-r border-slate-300 w-6">#</th>
                <th className="py-0.5 px-1.5 text-left border-r border-slate-300">Description</th>
                <th className="py-0.5 px-1 text-left border-r border-slate-300">Pack</th>
                <th className="py-0.5 px-1 text-center border-r border-slate-300">Batch</th>
                <th className="py-0.5 px-1 text-center border-r border-slate-300">Exp</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300 w-8">Qty</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300 w-8">Free</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300">MRP</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300">Rate</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300 w-8">Dis%</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300 w-9">
                  {taxSplit === "CGST_SGST" ? "GST%" : "IGST%"}
                </th>
                <th className="py-0.5 px-1 text-right border-r border-slate-300">Taxable</th>
                <th className="py-0.5 px-1.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {order.items.map((item, i) => {
                const mrpDisplay = Number(item.mrp ?? item.price);
                const t = computeLineTotals({
                  quantity: item.quantity,
                  price: Number(item.price),
                  discountPct: 0,
                  gstPct: Number(item.gstPct),
                });
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-0.5 px-1 text-center border-r border-slate-200 text-slate-500">{i + 1}</td>
                    <td className="py-0.5 px-1.5 text-left border-r border-slate-200 font-bold text-slate-900">
                      {item.product.name}
                      {item.hsnCode && (
                        <span className="block text-[8px] text-slate-400 font-mono font-normal">HSN: {item.hsnCode}</span>
                      )}
                    </td>
                    <td className="py-0.5 px-1 text-left border-r border-slate-200">{item.packSize ?? "—"}</td>
                    <td className="py-0.5 px-1 text-center border-r border-slate-200 font-mono text-[8px]">{item.batchNo ?? "—"}</td>
                    <td className="py-0.5 px-1 text-center border-r border-slate-200 font-mono text-[8px]">{shortDate(item.expDate)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 font-bold text-slate-900">{item.quantity}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 text-emerald-700 font-semibold">{item.freeQty || "—"}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 text-slate-600">{currency(mrpDisplay)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 font-semibold">{currency(item.price)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 text-slate-500">{Number(item.discountPct).toFixed(1)}%</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 font-semibold">{Number(item.gstPct).toFixed(1)}%</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-200 font-mono">{currency(t.taxableValue)}</td>
                    <td className="py-0.5 px-1.5 text-right font-bold text-slate-900 font-mono">{currency(t.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
          {/* Left Column: GST Summary & Bank Remittance */}
          <div className="space-y-1.5">
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="py-0.5 px-1 text-left">Tax Class</th>
                    <th className="py-0.5 px-1 text-right">Taxable Val</th>
                    {taxSplit === "CGST_SGST" ? (
                      <>
                        <th className="py-0.5 px-1 text-right">CGST</th>
                        <th className="py-0.5 px-1 text-right">SGST</th>
                      </>
                    ) : (
                      <th className="py-0.5 px-1 text-right">IGST</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classSummary.map((c) => (
                    <tr key={c.gstPct}>
                      <td className="py-0.5 px-1 font-medium">
                        {taxSplit === "CGST_SGST"
                          ? `GST ${c.gstPct.toFixed(1)}%`
                          : `IGST ${c.gstPct.toFixed(1)}%`}
                      </td>
                      <td className="py-0.5 px-1 text-right font-mono">{currency(c.taxableValue)}</td>
                      {taxSplit === "CGST_SGST" ? (
                        <>
                          <td className="py-0.5 px-1 text-right font-mono">{currency(c.cgstAmount)}</td>
                          <td className="py-0.5 px-1 text-right font-mono">{currency(c.sgstAmount)}</td>
                        </>
                      ) : (
                        <td className="py-0.5 px-1 text-right font-mono">{currency(c.igstAmount)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-slate-300 rounded p-1.5 bg-white flex items-start justify-between gap-1.5 text-[9px]">
              <div className="space-y-0.2">
                <p className="font-black text-slate-800 uppercase tracking-wider text-[8px]">
                  Bank Remittance:
                </p>
                <p><span className="font-semibold text-slate-500">Bank:</span> {company?.bankName ?? "State Bank of India"}</p>
                <p><span className="font-semibold text-slate-500">A/C:</span> <span className="font-mono font-bold text-slate-900">{company?.accountNo ?? "45259232976"}</span></p>
                <p><span className="font-semibold text-slate-500">IFSC:</span> <span className="font-mono font-bold text-slate-900">{company?.ifscCode ?? "SBIN0007109"}</span></p>
              </div>

              {qrDataUrl && (
                <div className="text-center shrink-0 border-l border-slate-200 pl-1.5">
                  <p className="font-black text-slate-800 uppercase tracking-wider text-[7px] mb-0.5">
                    UPI Pay
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="UPI QR" className="w-10 h-10 mx-auto border border-slate-200 p-0.2 rounded" />
                  <p className="text-slate-500 font-mono text-[7px] max-w-[65px] truncate">{company?.upiId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Totals & Signatory */}
          <div className="space-y-1.5 flex flex-col justify-between">
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50 space-y-0.5 text-[10px]">
              <div className="flex justify-between py-0.2 text-[9px]">
                <span className="text-slate-600 font-medium">Items / Units:</span>
                <span className="font-bold text-slate-900">
                  {inv?.totalItems ?? order.items.length} items / {inv?.totalQty ?? order.items.reduce((s, i) => s + i.quantity, 0)} units
                </span>
              </div>
              <div className="flex justify-between py-0.2 text-[9px]">
                <span className="text-slate-600 font-medium">Discount:</span>
                <span className="font-mono text-slate-900">₹{currency(inv?.totalDiscount ?? 0)}</span>
              </div>
              <div className="flex justify-between py-0.2 text-[9px]">
                <span className="text-slate-600 font-medium">{taxSplit === "CGST_SGST" ? "Total GST:" : "Total IGST:"}</span>
                <span className="font-mono text-slate-900 font-semibold">₹{currency(inv?.totalGst ?? 0)}</span>
              </div>
              <div className="flex justify-between py-0.2 text-[9px]">
                <span className="text-slate-600 font-medium">Round Off:</span>
                <span className="font-mono text-slate-900">₹{currency(inv?.roundOff ?? 0)}</span>
              </div>
              {freeStripsValue > 0 && (
                <div className="flex justify-between py-0.2 text-emerald-700 text-[9px]">
                  <span className="font-medium">Free Scheme Bonus:</span>
                  <span className="font-mono font-semibold">−₹{currency(freeStripsValue)}</span>
                </div>
              )}

              {/* Grand Total Callout */}
              <div className="border-t border-slate-900 pt-1 mt-0.5 flex items-baseline justify-between">
                <span className="text-[10px] font-black text-slate-900 uppercase">Grand Total:</span>
                <span className="invoice-grand-total text-sm sm:text-base font-black text-emerald-900 font-mono">
                  ₹{currency(finalGrandTotal)}
                </span>
              </div>

              {/* Amount in Words */}
              <div className="pt-0.5 border-t border-slate-200">
                <span className="text-[8px] font-bold text-slate-500 uppercase block">In Words:</span>
                <span className="text-[9px] font-bold text-slate-800 italic block leading-tight">
                  {numberToWords(finalGrandTotal)}
                </span>
              </div>
            </div>

            {/* Authorised Signatory */}
            <div className="border border-slate-300 rounded p-1.5 bg-white text-right space-y-2">
              <p className="text-[9px] font-bold text-slate-800 uppercase">
                For {company?.name || "Metapharsic Lifesciences"}
              </p>
              <div className="pt-3">
                <p className="text-[9px] font-bold text-slate-700 border-t border-dashed border-slate-400 inline-block pt-0.5 px-2">
                  Authorised Signatory
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Terms & Footer */}
        <div className="border-t border-slate-300 pt-1 text-[8px] text-slate-600 flex flex-col sm:flex-row items-start justify-between gap-0.5">
          <div className="max-w-xs">
            <span className="font-bold text-slate-700">Terms: </span>
            <span>{company?.terms || "Goods once sold not taken back. Overdue bills attract 24% interest."}</span>
          </div>
          <div className="text-right text-[8px] text-slate-400 shrink-0">
            <span>Status: <b className="text-slate-600">{order.status}</b></span> · <span>Booked: {bookedBy}</span>
          </div>
        </div>

        {/* Official Compliance Notice */}
        <div className="border-t border-slate-200 pt-0.5 text-center text-[8px] uppercase font-bold tracking-widest text-slate-400 print:text-slate-700">
          METAPHARSIC COMMERCIAL TAX INVOICE • A4 LANDSCAPE (DUAL A5 COPIES • 148 × 210 MM)
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [leftCopy, setLeftCopy] = useState<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE">("ORIGINAL");
  const [rightCopy, setRightCopy] = useState<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE">("DUPLICATE");

  useEffect(() => {
    if (!orderId) return;
    Promise.all([
      apiClient.get(`/api/orders/${orderId}`),
      apiClient.get("/api/company-settings"),
    ])
      .then(([orderRes, companyRes]) => {
        setOrder(orderRes.data.data.order);
        setCompany(companyRes.data.data.settings);
      })
      .catch((err: unknown) => {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Failed to load invoice.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!company?.upiId || !order?.invoice) {
      setQrDataUrl(null);
      return;
    }
    const amount = Number(order.invoice.grandTotal ?? order.invoice.amount ?? 0);
    const upiLink =
      `upi://pay?pa=${encodeURIComponent(company.upiId)}` +
      `&pn=${encodeURIComponent(company.name || "Metapharsic Lifesciences")}` +
      `&am=${amount.toFixed(2)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(order.invoice.invoiceNo)}`;
    QRCode.toDataURL(upiLink, { margin: 1, width: 140 })
      .then(setQrDataUrl)
      .catch((err) => console.error("Failed to generate QR:", err));
  }, [company?.upiId, company?.name, order?.invoice]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-3">
        <p className="text-slate-600 text-base">{error ?? "Invoice not found."}</p>
        <button onClick={() => router.back()} className="text-emerald-600 text-sm font-semibold hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const gstLines = order.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.price),
    discountPct: 0,
    gstPct: Number(item.gstPct),
  }));
  const inv = order.invoice;
  const buyerGstin = inv?.partyGstNo ?? order.chemist?.gstNo ?? null;
  const buyerName = inv?.partyName ?? order.chemist?.name ?? order.doctor?.fullName ?? "—";
  const buyerAddress = inv?.partyAddress ?? order.chemist?.address ?? order.doctor?.clinicAddress ?? "—";
  const taxSplit = determineTaxSplit(company?.gstin, buyerGstin);
  const classSummary = taxClassSummaryWithSplit(gstLines, taxSplit);
  const freeStripsValue = computeFreeStripsValue(
    order.items.map((item) => ({ freeQty: item.freeQty, rate: Number(item.price) }))
  );
  const bookedBy = order.employee ? `${order.employee.firstName} ${order.employee.lastName}` : "—";
  const finalGrandTotal = Number(inv?.grandTotal ?? inv?.amount ?? 0);

  const copyLabelMap: Record<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE", string> = {
    ORIGINAL: "ORIGINAL FOR RECIPIENT",
    DUPLICATE: "DUPLICATE FOR TRANSPORTER",
    TRIPLICATE: "TRIPLICATE FOR SUPPLIER",
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 print:bg-white print:p-0">
      {/* Print Layout Styling specifically strictly enforced for 2 Invoices on A4 Landscape */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 3mm 4mm !important;
          }
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          .dual-a4-sheet {
            display: grid !important;
            grid-template-columns: 141mm 141mm !important;
            column-gap: 6mm !important;
            width: 288mm !important;
            height: 204mm !important;
            max-height: 204mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
          .invoice-half {
            width: 141mm !important;
            max-width: 141mm !important;
            height: 202mm !important;
            max-height: 202mm !important;
            box-sizing: border-box !important;
          }
          .invoice-card {
            border: 1.5pt double #0f172a !important;
            box-shadow: none !important;
            width: 100% !important;
            height: 100% !important;
            padding: 2.2mm 2.5mm !important;
            border-radius: 0 !important;
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .invoice-table th, .invoice-table td {
            font-size: 6pt !important;
            padding: 1.5pt 1.2pt !important;
            line-height: 1.05 !important;
          }
          .invoice-title {
            font-size: 12pt !important;
          }
          .invoice-company-name {
            font-size: 9pt !important;
          }
          .invoice-grand-total {
            font-size: 10.5pt !important;
          }
          .invoice-watermark {
            opacity: 0.04 !important;
            font-size: 24pt !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Screen Only) */}
      <div className="max-w-[1450px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-300 text-blue-900 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            A4 Landscape • 2 Invoices per Sheet (Dual A5 • 148 × 210 mm)
          </span>

          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500 pl-1">Left Copy:</span>
            {(["ORIGINAL", "DUPLICATE", "TRIPLICATE"] as const).map((copy) => (
              <button
                key={copy}
                onClick={() => setLeftCopy(copy)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  leftCopy === copy
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {copy === "ORIGINAL" ? "Original" : copy === "DUPLICATE" ? "Duplicate" : "Triplicate"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500 pl-1">Right Copy:</span>
            {(["DUPLICATE", "TRIPLICATE", "ORIGINAL"] as const).map((copy) => (
              <button
                key={copy}
                onClick={() => setRightCopy(copy)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  rightCopy === copy
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {copy === "ORIGINAL" ? "Original" : copy === "DUPLICATE" ? "Duplicate" : "Triplicate"}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition"
          >
            <Printer size={16} /> Print Dual A5 (A4 Landscape)
          </button>
        </div>
      </div>

      {/* Main Dual Invoices Container on A4 Landscape Sheet */}
      <div className="dual-a4-sheet max-w-[1450px] mx-auto grid grid-cols-1 xl:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2 items-start relative">
        {/* Left Invoice Panel */}
        <div className="invoice-half w-full">
          <SingleInvoiceCard
            copyLabel={copyLabelMap[leftCopy]}
            order={order}
            company={company}
            qrDataUrl={qrDataUrl}
            taxSplit={taxSplit}
            classSummary={classSummary}
            freeStripsValue={freeStripsValue}
            bookedBy={bookedBy}
            finalGrandTotal={finalGrandTotal}
            buyerGstin={buyerGstin}
            buyerName={buyerName}
            buyerAddress={buyerAddress}
          />
        </div>

        {/* Center Cutting Guideline */}
        <div className="hidden xl:flex print:flex absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex-col items-center justify-between pointer-events-none z-20 text-slate-400 select-none">
          <span className="text-[9px] bg-slate-100 print:bg-white px-1 font-mono flex items-center gap-1 font-bold">
            <Scissors size={10} className="rotate-90" /> CUT / FOLD HERE
          </span>
          <div className="w-[1px] h-full border-r-2 border-dashed border-slate-400/80 my-1"></div>
          <span className="text-[9px] bg-slate-100 print:bg-white px-1 font-mono flex items-center gap-1 font-bold">
            <Scissors size={10} className="rotate-90" />
          </span>
        </div>

        {/* Right Invoice Panel */}
        <div className="invoice-half w-full">
          <SingleInvoiceCard
            copyLabel={copyLabelMap[rightCopy]}
            order={order}
            company={company}
            qrDataUrl={qrDataUrl}
            taxSplit={taxSplit}
            classSummary={classSummary}
            freeStripsValue={freeStripsValue}
            bookedBy={bookedBy}
            finalGrandTotal={finalGrandTotal}
            buyerGstin={buyerGstin}
            buyerName={buyerName}
            buyerAddress={buyerAddress}
          />
        </div>
      </div>
    </div>
  );
}
