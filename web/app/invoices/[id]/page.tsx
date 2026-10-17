"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Download, Layers, FileText, CheckCircle2, Scissors } from "lucide-react";
import QRCode from "qrcode";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import { computeLineTotals, computeLineTotalsWithSplit, determineTaxSplit, taxClassSummaryWithSplit, computeFreeStripsValue } from "@/lib/gst";

// ============================================================================
// SENIOR ACCOUNTANT GRADE PHARMACEUTICAL TAX INVOICE SYSTEM
// Compliant with Section 31 CGST Act 2017 & Section 19 Drugs & Cosmetics Act 1940
// Calibrated to Exact Half-A4 Paper Dimensions (148 x 210 mm) Matching Accountant Sample
// Supports: Half-A4 Top Slip (Sample Size), A4 Landscape (2-Up Dual), & A3 Landscape
// ============================================================================

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

function getStateFromGstin(gstin: string | null): { code: string; name: string } {
  if (!gstin || gstin.trim().length < 2) return { code: "—", name: "—" };
  const prefix = gstin.trim().slice(0, 2);
  const STATE_CODES: Record<string, string> = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa", "32": "Kerala",
    "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh"
  };
  return { code: prefix, name: STATE_CODES[prefix] || "State Code " + prefix };
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
  variant?: "single" | "dual";
}

// Senior Accountant Grade Invoice Sheet (Sized to Exact Half-A4 Paper)
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
  variant = "single",
}: SingleInvoiceProps) {
  const inv = order.invoice;
  const isSingle = variant === "single";

  // Account State Data
  const sellerState = getStateFromGstin(company?.gstin ?? null);
  const buyerState = getStateFromGstin(buyerGstin);

  // Totals Summation for Table Footer
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalFreeQty = order.items.reduce((sum, item) => sum + (item.freeQty || 0), 0);
  const totalTaxable = classSummary.reduce((sum, c) => sum + c.taxableValue, 0);
  const totalCgst = classSummary.reduce((sum, c) => sum + c.cgstAmount, 0);
  const totalSgst = classSummary.reduce((sum, c) => sum + c.sgstAmount, 0);
  const totalIgst = classSummary.reduce((sum, c) => sum + c.igstAmount, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  return (
    <div
      className={`invoice-card ${
        isSingle ? "single-mode" : "dual-mode"
      } relative bg-white border-2 border-slate-900 text-slate-900 leading-tight flex flex-col justify-between`}
      style={{ boxSizing: "border-box" }}
    >
      {/* 1. Senior Accountant Diagonal Watermark (Anti-Counterfeit Background) */}
      <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none overflow-hidden">
        <div className="invoice-watermark opacity-[0.12] -rotate-25 text-center flex flex-col items-center justify-center text-slate-900 pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company?.logoUrl || "/logo.png"}
            alt="Watermark Logo"
            className={`${isSingle ? "w-40 h-40 mb-1" : "w-28 h-28 mb-1"} object-contain grayscale opacity-60`}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== window.location.origin + "/logo.png") {
                target.src = "/logo.png";
              }
            }}
          />
          <span className={`${isSingle ? "text-3xl" : "text-xl"} font-serif font-black tracking-widest uppercase`}>
            {company?.name || "METAPHARSIC LIFESCIENCES"}
          </span>
          <span className="text-[9px] font-mono font-bold tracking-widest mt-0.5 uppercase text-slate-800">
            OFFICIAL GST TAX INVOICE • STATUTORY COMMERCIAL COPY
          </span>
        </div>
      </div>

      {/* Main Document Content Container */}
      <div className="relative z-10 flex flex-col justify-between h-full space-y-1">
        
        {/* ==================================================================== */}
        {/* SECTION 1: STATUTORY HEADER & OFFICIAL COPY BADGE                     */}
        {/* ==================================================================== */}
        <div className="border-b-2 border-slate-900 pb-1 flex items-start justify-between gap-2">
          {/* Company Identity */}
          <div className="flex items-start gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={company?.logoUrl || "/logo.png"}
              alt="Company Logo"
              className={`${isSingle ? "h-10 max-w-[130px]" : "h-8 max-w-[100px]"} w-auto object-contain border border-slate-300 p-0.5 bg-white shrink-0 shadow-2xs`}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== window.location.origin + "/logo.png") {
                  target.src = "/logo.png";
                }
              }}
            />
            <div>
              <h1 className="invoice-company-name text-xs sm:text-sm font-black tracking-tight text-slate-950 uppercase leading-none">
                {company?.name || "METAPHARSIC LIFESCIENCES"}
              </h1>
              <p className="text-[8px] text-slate-700 leading-tight mt-0.5 max-w-md">
                {company?.address || "H.NO.4-8-147, GROUND FLOOR, HMT NAGAR, NACHARAM, UPPAL, TELANGANA"}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.2 text-[8px] font-mono text-slate-800 mt-0.2">
                <span><b>GSTIN:</b> {company?.gstin || "36ACHFM8773D1ZC"}</span>
                <span>•</span>
                <span><b>PAN:</b> {company?.panNo || "ACHFM7420L"}</span>
                {company?.phone && (
                  <>
                    <span>•</span>
                    <span><b>Ph:</b> {company.phone}</span>
                  </>
                )}
                <span>•</span>
                <span><b>State:</b> {sellerState.name} ({sellerState.code})</span>
              </div>
            </div>
          </div>

          {/* Document Title & Copy Box */}
          <div className="text-right shrink-0">
            <div className="inline-block border border-slate-900 bg-slate-900 text-white px-2.5 py-0.2 font-mono text-[9px] font-black uppercase tracking-wider shadow-2xs">
              {copyLabel}
            </div>
            <div className="mt-0.5">
              <h2 className="invoice-title text-sm sm:text-base font-serif font-black tracking-wide text-slate-950 uppercase leading-none">
                TAX INVOICE
              </h2>
              <p className="text-[7px] font-mono font-bold text-slate-600 uppercase tracking-tight mt-0.2">
                (Under Sec 31 CGST Act 2017 & Rule 46 CGST Rules)
              </p>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 2: CONSIGNOR & CONSIGNEE ACCOUNTS LEDGER BOX                  */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 gap-1 border border-slate-800 bg-slate-50/20 text-[8.5px]">
          {/* Left: Consignor (Details of Supplier) */}
          <div className="p-1 border-r border-slate-800 space-y-0.2">
            <div className="flex items-center justify-between border-b border-slate-300 pb-0.2 mb-0.2">
              <span className="font-mono font-black text-slate-950 uppercase text-[8px]">
                CONSIGNOR / SUPPLIER (BILLED FROM)
              </span>
              <span className="font-mono text-[7.5px] text-slate-600 font-bold">
                DL: 20B / 21B
              </span>
            </div>
            <p className="font-bold text-slate-950 text-[9px] leading-tight">
              {company?.name || "METAPHARSIC LIFESCIENCES"}
            </p>
            <p className="text-slate-700 leading-tight text-[8px] line-clamp-1">{company?.address}</p>
            <div className="grid grid-cols-2 gap-x-1 pt-0.2 text-[8px] font-mono border-t border-slate-200">
              <div><span className="text-slate-500 font-sans">GSTIN:</span> <b>{company?.gstin || "—"}</b></div>
              <div><span className="text-slate-500 font-sans">State:</span> <b>{sellerState.name} ({sellerState.code})</b></div>
              <div><span className="text-slate-500 font-sans">DL:</span> <b>{company?.dlNo1 || "TG/MDL/2020-147387"}</b></div>
              <div><span className="text-slate-500 font-sans">PAN:</span> <b>{company?.panNo || "ACHFM7420L"}</b></div>
            </div>
          </div>

          {/* Right: Consignee (Details of Recipient / Buyer) */}
          <div className="p-1 space-y-0.2">
            <div className="flex items-center justify-between border-b border-slate-300 pb-0.2 mb-0.2">
              <span className="font-mono font-black text-slate-950 uppercase text-[8px]">
                CONSIGNEE / RECIPIENT (BILLED TO)
              </span>
              <span className="font-mono text-[7.5px] font-bold text-slate-700">
                REV CHARGE: <b className="text-slate-950">NO</b>
              </span>
            </div>
            <p className="font-bold text-slate-950 text-[9px] leading-tight">
              M/S {buyerName}
            </p>
            <p className="text-slate-700 leading-tight text-[8px] line-clamp-1">{buyerAddress}</p>
            <div className="grid grid-cols-2 gap-x-1 pt-0.2 text-[8px] font-mono border-t border-slate-200">
              <div><span className="text-slate-500 font-sans">GSTIN:</span> <b>{buyerGstin || "UNREGISTERED"}</b></div>
              <div><span className="text-slate-500 font-sans">State:</span> <b>{buyerState.name} ({buyerState.code})</b></div>
              <div><span className="text-slate-500 font-sans">DL No:</span> <b>{inv?.partyDlNo || "—"}</b></div>
              <div><span className="text-slate-500 font-sans">Contact:</span> <b>{inv?.partyPhone || order.chemist?.mobile || "—"}</b></div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 3: INVOICE & DISPATCH AUDIT MATRIX                             */}
        {/* ==================================================================== */}
        <div className="border border-slate-800 bg-transparent grid grid-cols-4 sm:grid-cols-6 divide-x divide-slate-800 text-[8px] font-mono">
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">Invoice No</span>
            <span className="font-bold text-slate-950 text-[9px]">{inv?.invoiceNo ?? "INV-PENDING"}</span>
          </div>
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">Invoice Date</span>
            <span className="font-bold text-slate-950">{shortDate(inv?.createdAt ?? order.createdAt)}</span>
          </div>
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">Order / PO Ref</span>
            <span className="font-bold text-slate-950">{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">L.R. / GR No & Date</span>
            <span className="font-bold text-slate-950 truncate block">{inv?.lrNo ? `${inv.lrNo} · ${shortDate(inv.lrDate)}` : "—"}</span>
          </div>
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">Transport / Vehicle</span>
            <span className="font-bold text-slate-950 truncate block">{inv?.transport || inv?.vehicleNo ? `${inv?.transport ?? ""} ${inv?.vehicleNo ?? ""}` : "Direct Dispatch"}</span>
          </div>
          <div className="p-0.5 px-1">
            <span className="block text-[7px] font-sans font-bold text-slate-500 uppercase">Due Date / Terms</span>
            <span className="font-bold text-slate-950">{inv?.dueDate ? shortDate(inv.dueDate) : "Net 21 Days"}</span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 4: STRICT ACCOUNTING LINE ITEMS TABLE                         */}
        {/* ==================================================================== */}
        <div className="border border-slate-900 overflow-hidden bg-transparent">
          <table className="invoice-table w-full border-collapse text-[8px] bg-transparent">
            <thead>
              <tr className="bg-slate-900 text-white font-mono font-bold uppercase text-[7.5px] border-b border-slate-900 tracking-tight">
                <th className="py-0.5 px-1 text-center border-r border-slate-700 w-5">#</th>
                <th className="py-0.5 px-1 text-left border-r border-slate-700">Product Description & Pack</th>
                <th className="py-0.5 px-1 text-center border-r border-slate-700 w-11">HSN/SAC</th>
                <th className="py-0.5 px-1 text-left border-r border-slate-700 w-10">Pack</th>
                <th className="py-0.5 px-1 text-center border-r border-slate-700 w-11">Batch</th>
                <th className="py-0.5 px-1 text-center border-r border-slate-700 w-10">Exp</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-8">Qty</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-7">Free</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-11">M.R.P.</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-11">Rate</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-8">Dis%</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-12">Taxable Val</th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-8">
                  {taxSplit === "CGST_SGST" ? "GST%" : "IGST%"}
                </th>
                <th className="py-0.5 px-1 text-right border-r border-slate-700 w-11">
                  {taxSplit === "CGST_SGST" ? "CGST" : "IGST"}
                </th>
                {taxSplit === "CGST_SGST" && (
                  <th className="py-0.5 px-1 text-right border-r border-slate-700 w-11">SGST</th>
                )}
                <th className="py-0.5 px-1 text-right w-14">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 font-mono">
              {order.items.map((item, i) => {
                const mrpDisplay = Number(item.mrp ?? item.price);
                const t = computeLineTotalsWithSplit(
                  {
                    quantity: item.quantity,
                    price: Number(item.price),
                    discountPct: 0,
                    gstPct: Number(item.gstPct),
                  },
                  taxSplit as any
                );
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-0.5 px-1 text-center border-r border-slate-300 text-slate-500">{i + 1}</td>
                    <td className="py-0.5 px-1 text-left border-r border-slate-300 font-sans font-bold text-slate-950">
                      {item.product.name}
                    </td>
                    <td className="py-0.5 px-1 text-center border-r border-slate-300 text-slate-700">{item.hsnCode || "300490"}</td>
                    <td className="py-0.5 px-1 text-left border-r border-slate-300 font-sans text-slate-700">{item.packSize ?? "10x10"}</td>
                    <td className="py-0.5 px-1 text-center border-r border-slate-300 font-bold text-slate-900">{item.batchNo ?? "BTH-921"}</td>
                    <td className="py-0.5 px-1 text-center border-r border-slate-300 text-slate-700">{shortDate(item.expDate)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 font-bold text-slate-950">{item.quantity}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-700 font-bold">{item.freeQty || "—"}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-700">{currency(mrpDisplay)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 font-semibold">{currency(item.price)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-600">{Number(item.discountPct).toFixed(1)}%</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 font-bold text-slate-900">{currency(t.taxableValue)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-700">{Number(item.gstPct).toFixed(1)}%</td>
                    <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-800">
                      {taxSplit === "CGST_SGST" ? currency(t.cgstAmount) : currency(t.igstAmount)}
                    </td>
                    {taxSplit === "CGST_SGST" && (
                      <td className="py-0.5 px-1 text-right border-r border-slate-300 text-slate-800">
                        {currency(t.sgstAmount)}
                      </td>
                    )}
                    <td className="py-0.5 px-1 text-right font-black text-slate-950">{currency(t.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer: Senior Accountant Ledger Totals Row */}
            <tfoot>
              <tr className="bg-slate-100 text-slate-950 font-mono font-black text-[8px] border-t-2 border-slate-900">
                <td colSpan={6} className="py-0.5 px-1 text-left border-r border-slate-400 font-sans uppercase">
                  <b>Total:</b> {order.items.length} Lines
                </td>
                <td className="py-0.5 px-1 text-right border-r border-slate-400">{totalQuantity}</td>
                <td className="py-0.5 px-1 text-right border-r border-slate-400">{totalFreeQty || "—"}</td>
                <td colSpan={3} className="py-0.5 px-1 text-right border-r border-slate-400 font-sans uppercase text-[7px]">
                  Sub-Totals:
                </td>
                <td className="py-0.5 px-1 text-right border-r border-slate-400">{currency(totalTaxable)}</td>
                <td className="py-0.5 px-1 text-center border-r border-slate-400">—</td>
                <td className="py-0.5 px-1 text-right border-r border-slate-400">
                  {taxSplit === "CGST_SGST" ? currency(totalCgst) : currency(totalIgst)}
                </td>
                {taxSplit === "CGST_SGST" && (
                  <td className="py-0.5 px-1 text-right border-r border-slate-400">{currency(totalSgst)}</td>
                )}
                <td className="py-0.5 px-1 text-right text-slate-950">{currency(finalGrandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ==================================================================== */}
        {/* SECTION 5: ACCOUNTING THREE-WAY AUDIT SCHEDULE & SETTLEMENT            */}
        {/* ==================================================================== */}
        <div className={`grid ${isSingle ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3"} gap-1 pt-0.2 text-[8px]`}>
          
          {/* Column 1: Statutory GST Tax Schedule & Bank Remittance */}
          <div className="space-y-0.5">
            <div className="border border-slate-800 bg-transparent">
              <div className="bg-slate-800 text-white font-mono text-[7.5px] font-bold px-1 py-0.2 uppercase">
                Statutory GST Tax Summary
              </div>
              <table className="w-full text-[7.5px] font-mono bg-transparent">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="py-0.2 px-1 text-left">Rate</th>
                    <th className="py-0.2 px-1 text-right">Taxable</th>
                    {taxSplit === "CGST_SGST" ? (
                      <>
                        <th className="py-0.2 px-1 text-right">CGST</th>
                        <th className="py-0.2 px-1 text-right">SGST</th>
                      </>
                    ) : (
                      <th className="py-0.2 px-1 text-right">IGST</th>
                    )}
                    <th className="py-0.2 px-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classSummary.map((c) => (
                    <tr key={c.gstPct}>
                      <td className="py-0.2 px-1 font-bold">{c.gstPct.toFixed(1)}%</td>
                      <td className="py-0.2 px-1 text-right">{currency(c.taxableValue)}</td>
                      {taxSplit === "CGST_SGST" ? (
                        <>
                          <td className="py-0.2 px-1 text-right">{currency(c.cgstAmount)}</td>
                          <td className="py-0.2 px-1 text-right">{currency(c.sgstAmount)}</td>
                        </>
                      ) : (
                        <td className="py-0.2 px-1 text-right">{currency(c.igstAmount)}</td>
                      )}
                      <td className="py-0.2 px-1 text-right font-bold">
                        {currency(taxSplit === "CGST_SGST" ? c.cgstAmount + c.sgstAmount : c.igstAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Electronic Bank Remittance & High-Accuracy UPI QR Code */}
            <div className="border border-slate-800 p-0.5 px-1 bg-transparent flex items-start justify-between gap-1 text-[7.5px] font-mono">
              <div className="space-y-0.2 leading-tight">
                <span className="font-sans font-bold text-slate-900 uppercase block text-[7px]">
                  Bank Remittance (NEFT / RTGS):
                </span>
                <p><span className="text-slate-500 font-sans">Bank:</span> <b>{company?.bankName ?? "State Bank of India"}</b></p>
                <p><span className="text-slate-500 font-sans">A/C:</span> <b className="text-slate-950 font-bold">{company?.accountNo ?? "45259232976"}</b></p>
                <p><span className="text-slate-500 font-sans">IFSC:</span> <b className="text-slate-950 font-bold">{company?.ifscCode ?? "SBIN0007109"}</b></p>
                <p><span className="text-slate-500 font-sans">Branch:</span> <b>{company?.bankBranch ?? "Nacharam"}</b></p>
              </div>
              {qrDataUrl && (
                <div className="text-center shrink-0 border-l border-slate-300 pl-1.5 flex flex-col items-center justify-center">
                  <div className="bg-white p-0.5 border border-slate-400 rounded-none shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="Scan UPI QR"
                      className={`${isSingle ? "w-16 h-16 sm:w-18 sm:h-18" : "w-14 h-14"} mx-auto object-contain`}
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <span className="text-[6.5px] font-sans font-black text-slate-950 uppercase tracking-tight mt-0.5">
                    Scan & Pay (UPI)
                  </span>
                  <span className="text-[6px] text-slate-700 block truncate max-w-[75px] font-mono">
                    {company?.upiId || "metapharsic@upi"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Legal Declarations & Terms of Sale */}
          <div className="border border-slate-800 p-1 bg-transparent space-y-0.5 flex flex-col justify-between text-[7px] leading-tight">
            <div>
              <p className="font-mono font-black text-slate-950 uppercase border-b border-slate-300 pb-0.2 mb-0.5">
                Statutory Pharma Warranty (Sec 19)
              </p>
              <p className="italic text-slate-800 font-serif leading-snug">
                &ldquo;We hereby certify that food/drugs mentioned in this invoice are warranted to be of the nature, substance and quality which these purport to be under Section 19 of the Drugs & Cosmetics Act, 1940.&rdquo;
              </p>
            </div>

            <div className="space-y-0.2 border-t border-slate-200 pt-0.5 text-slate-700">
              <p className="font-bold text-slate-900 font-sans uppercase text-[6.5px]">Conditions of Sale:</p>
              <p>1. Overdue bills attract interest @ 18% p.a. from due date.</p>
              <p>2. Goods once sold will not be accepted back or exchanged.</p>
              <p>3. Breakage/shortage must be notified within 24 hours.</p>
              <p>4. All disputes subject to local jurisdiction only.</p>
            </div>

            <div className="border-t border-slate-200 pt-0.2 text-slate-500 font-mono text-[6.5px] flex justify-between">
              <span>Booked: <b>{bookedBy}</b></span>
              <span>Status: <b className="uppercase">{order.status}</b></span>
            </div>
          </div>

          {/* Column 3: Ledger Settlement & Authorised Signatures */}
          <div className="space-y-0.5 flex flex-col justify-between">
            {/* Financial Settlement Box */}
            <div className="border border-slate-900 p-1 bg-slate-50/50 font-mono text-[8.5px] space-y-0.2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans text-[7.5px]">Gross Taxable:</span>
                <span>₹{currency(totalTaxable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans text-[7.5px]">Total Tax (GST):</span>
                <span>₹{currency(totalTax)}</span>
              </div>
              {Number(inv?.totalDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span className="font-sans text-[7.5px]">Trade Discount:</span>
                  <span>−₹{currency(inv?.totalDiscount ?? 0)}</span>
                </div>
              )}
              {Number(inv?.roundOff ?? 0) !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans text-[7.5px]">Round Off:</span>
                  <span>₹{currency(inv?.roundOff ?? 0)}</span>
                </div>
              )}

              {/* Grand Total Callout Box */}
              <div className="border-t border-b border-slate-950 py-0.5 my-0.5 flex items-baseline justify-between bg-white px-1">
                <span className="font-sans font-black text-slate-950 uppercase text-[8px]">
                  NET TOTAL:
                </span>
                <span className="invoice-grand-total text-sm font-black text-slate-950">
                  ₹{currency(finalGrandTotal)}
                </span>
              </div>

              {/* Amount in Words */}
              <div className="text-[7px] leading-tight text-slate-800">
                <span className="font-sans font-bold text-slate-500 uppercase block">In Words:</span>
                <span className="font-bold italic uppercase block mt-0.2 line-clamp-1">
                  ** {numberToWords(finalGrandTotal)} **
                </span>
              </div>
            </div>

            {/* Formal Double Signature Matrix */}
            <div className="border border-slate-800 p-0.5 bg-white grid grid-cols-2 gap-1 text-[7px]">
              <div className="border-r border-slate-300 pr-1 text-center flex flex-col justify-between min-h-[32px]">
                <span className="text-slate-500 font-sans">Receiver&apos;s Signature:</span>
                <span className="border-t border-dashed border-slate-400 block pt-0.2 font-bold text-slate-700">
                  Seal & Stamp
                </span>
              </div>
              <div className="text-right flex flex-col justify-between min-h-[32px]">
                <span className="font-bold text-slate-900 block truncate">
                  For {company?.name || "METAPHARSIC LIFESCIENCES"}
                </span>
                <span className="border-t border-dashed border-slate-400 inline-block pt-0.2 font-bold text-slate-950">
                  Authorised Signatory
                </span>
              </div>
            </div>
          </div>
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
  
  // Paper Size & Layout States
  // Default to HALF_A4 (exact size of accountant sample image)
  const [paperSize, setPaperSize] = useState<"HALF_A4" | "A4" | "A3">("HALF_A4");
  const [viewMode, setViewMode] = useState<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE" | "ALL_THREE" | "DUAL_2UP">("ORIGINAL");
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
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load invoice");
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const inv = order.invoice;
    const finalAmount = Number(inv?.grandTotal ?? inv?.amount ?? 0);
    const payeeVpa = company?.upiId || "SBIBHIM.INSTANT90889373636766474@sbipay";
    const payeeName = company?.name || "Metapharsic Lifesciences";
    const invoiceRef = inv?.invoiceNo || order.id.slice(0, 8);

    // NPCI UPI Specification Compliant Deep-Link URI
    const upiUri = `upi://pay?pa=${encodeURIComponent(
      payeeVpa
    )}&pn=${encodeURIComponent(payeeName)}&am=${finalAmount.toFixed(
      2
    )}&cu=INR&tn=${encodeURIComponent(
      `Inv ${invoiceRef}`
    )}`;

    // High-Accuracy, High-Density Crisp QR Code Generation
    QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "H", // High accuracy: 30% error correction recovery
      width: 512,                // Crisp 512x512 bitmap for laser printing & screen clarity
      margin: 1,                 // Exact quiet zone
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("QR Code Error:", err));
  }, [order, company]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-300 p-8 text-center max-w-sm w-full space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-mono text-xs uppercase font-bold text-slate-700">Loading Pharmaceutical Tax Invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <p className="text-rose-600 font-mono font-bold text-sm mb-4">{error || "Invoice not found"}</p>
        <button
          onClick={() => router.back()}
          className="bg-slate-900 text-white font-mono px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-slate-800"
        >
          Return to Console
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

  const handleDownload = (mode: "ORIGINAL" | "DUPLICATE" | "TRIPLICATE" | "ALL_THREE" | "DUAL_2UP") => {
    setViewMode(mode);
    const invNo = order?.invoice?.invoiceNo || order?.id?.slice(0, 8) || "INV";
    const labelMap: Record<string, string> = {
      ORIGINAL: "ORIGINAL",
      DUPLICATE: "DUPLICATE",
      TRIPLICATE: "TRIPLICATE",
      ALL_THREE: "TRIPLICATE_SET",
      DUAL_2UP: "DUAL_COPIES",
    };
    const oldTitle = document.title;
    document.title = `Tax_Invoice_${invNo}_${labelMap[mode] || mode}_${paperSize}_Landscape`;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = oldTitle;
      }, 1500);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-3 print:bg-white print:p-0">
      {/* Strict Senior Accountant Print CSS for A3 Landscape, A4 Landscape (Exact Half-A4 Slips) and Sample Top-Slip */}
      <style>{`
        .invoice-card table,
        .invoice-card tbody tr,
        .invoice-card td {
          background-color: transparent !important;
        }
        .invoice-watermark {
          opacity: 0.12;
          font-size: 26pt;
          display: flex;
          visibility: visible;
        }
        @media print {
          @page {
            size: A3 landscape !important;
            size: A4 landscape !important;
            size: ${
              paperSize === "A3"
                ? "A3 landscape"
                : paperSize === "A4"
                ? "A4 landscape"
                : "A4 portrait"
            } !important;
            margin: ${
              paperSize === "A3"
                ? "6mm 8mm"
                : paperSize === "A4"
                ? "4mm 5mm"
                : "5mm 6mm"
            } !important;
          }
          html, body {
            width: 420mm !important;
            height: 297mm !important;
            width: 297mm !important;
            height: 210mm !important;
            width: ${
              paperSize === "A3" ? "420mm" : paperSize === "A4" ? "297mm" : "210mm"
            } !important;
            height: ${
              paperSize === "A3" ? "297mm" : paperSize === "A4" ? "210mm" : "297mm"
            } !important;
            min-height: ${
              paperSize === "A3" ? "297mm" : paperSize === "A4" ? "210mm" : "297mm"
            } !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .a3-single-sheet {
            width: ${
              paperSize === "A3" ? "404mm" : paperSize === "A4" ? "287mm" : "198mm"
            } !important;
            max-width: ${
              paperSize === "A3" ? "404mm" : paperSize === "A4" ? "287mm" : "198mm"
            } !important;
            min-height: ${
              paperSize === "A3" ? "283mm" : paperSize === "A4" ? "200mm" : "138mm"
            } !important;
            max-height: ${
              paperSize === "A3" ? "285mm" : paperSize === "A4" ? "202mm" : "142mm"
            } !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
          .dual-a4-sheet, .a3-dual-sheet {
            display: grid !important;
            grid-template-columns: 141mm 141mm !important;
            grid-template-columns: ${
              paperSize === "A3" ? "198mm 198mm" : "141mm 141mm"
            } !important;
            column-gap: ${paperSize === "A3" ? "8mm" : "6mm"} !important;
            width: ${
              paperSize === "A3" ? "404mm" : "288mm"
            } !important;
            max-width: ${
              paperSize === "A3" ? "404mm" : "288mm"
            } !important;
            min-height: ${
              paperSize === "A3" ? "283mm" : "200mm"
            } !important;
            max-height: ${
              paperSize === "A3" ? "285mm" : "202mm"
            } !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
          .invoice-card {
            border: 2pt double #0f172a !important;
            box-shadow: none !important;
            width: 100% !important;
            height: 100% !important;
            padding: 2.5mm 3.5mm !important;
            border-radius: 0 !important;
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .invoice-card.dual-mode {
            padding: 2mm 2.5mm !important;
            font-size: 6.8pt !important;
            line-height: 1.12 !important;
          }
          .invoice-table th, .invoice-table td {
            font-size: 7pt !important;
            padding: 1.2pt 1.8pt !important;
            line-height: 1.05 !important;
            border-color: #000000 !important;
          }
          .invoice-card.dual-mode .invoice-table th,
          .invoice-card.dual-mode .invoice-table td {
            font-size: 6.2pt !important;
            padding: 1pt 1.2pt !important;
          }
          .invoice-title {
            font-size: 11pt !important;
          }
          .invoice-company-name {
            font-size: 9.5pt !important;
          }
          .invoice-grand-total {
            font-size: 11pt !important;
          }
          .invoice-watermark {
            opacity: 0.12 !important;
            font-size: 26pt !important;
            display: flex !important;
            visibility: visible !important;
          }
          .invoice-card div,
          .invoice-card table,
          .invoice-card tr,
          .invoice-card td,
          .invoice-card th {
            background-color: transparent !important;
          }
          .invoice-card table thead tr {
            background-color: #0f172a !important;
            color: #ffffff !important;
          }
        }
      `}</style>

      {/* Senior Executive Accounting Console (Screen Only) */}
      <div className="max-w-[1200px] mx-auto mb-4 bg-slate-900 text-white border-2 border-slate-950 p-3 shadow-lg space-y-3 no-print">
        {/* Row 1: Back, Paper Specification & Direct Download Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200 bg-slate-800 border border-slate-700 px-3 py-1.5 hover:bg-slate-700 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {/* Paper Size / Slip Format Selector */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 text-xs font-mono">
              <span className="text-slate-400 font-bold text-[10px] uppercase">Size:</span>
              <button
                onClick={() => setPaperSize("HALF_A4")}
                className={`px-2 py-0.5 text-xs font-bold transition ${
                  paperSize === "HALF_A4"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Exact Half of A4 Paper (Top Half • Like Sample Image)"
              >
                Half-A4 (Like Sample)
              </button>
              <button
                onClick={() => setPaperSize("A4")}
                className={`px-2 py-0.5 text-xs font-bold transition ${
                  paperSize === "A4"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
                title="A4 Landscape (2x Half-A4 Slips Side-by-Side • 297 x 210 mm)"
              >
                A4 Landscape (2-Up)
              </button>
              <button
                onClick={() => setPaperSize("A3")}
                className={`px-2 py-0.5 text-xs font-bold transition ${
                  paperSize === "A3"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
                title="A3 Landscape (420 x 297 mm)"
              >
                A3 Landscape
              </button>
            </div>
          </div>

          {/* Quick Statutory Download Options */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-400">Download Copy:</span>
            <button
              onClick={() => handleDownload("ORIGINAL")}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white px-2.5 py-1 text-xs font-mono font-bold transition"
              title="Download / Print Original for Recipient"
            >
              <Download size={13} /> Original
            </button>
            <button
              onClick={() => handleDownload("DUPLICATE")}
              className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white px-2.5 py-1 text-xs font-mono font-bold transition"
              title="Download / Print Duplicate for Transporter"
            >
              <Download size={13} /> Duplicate
            </button>
            <button
              onClick={() => handleDownload("TRIPLICATE")}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white px-2.5 py-1 text-xs font-mono font-bold transition"
              title="Download / Print Triplicate for Supplier"
            >
              <Download size={13} /> Triplicate
            </button>
            <button
              onClick={() => handleDownload("ALL_THREE")}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1 text-xs font-mono font-bold transition"
              title="Download Complete 3-Page Triplicate Set Bundle"
            >
              <Layers size={13} /> All 3 Copies (Bundle)
            </button>
          </div>
        </div>

        {/* Row 2: View Mode Switcher & Master Print Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-400">Format:</span>
            {(["ORIGINAL", "DUPLICATE", "TRIPLICATE", "ALL_THREE", "DUAL_2UP"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs font-mono font-bold transition ${
                  viewMode === mode
                    ? "bg-white text-slate-950 font-black shadow-xs"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {mode === "ORIGINAL"
                  ? "Original Copy"
                  : mode === "DUPLICATE"
                  ? "Duplicate Copy"
                  : mode === "TRIPLICATE"
                  ? "Triplicate Copy"
                  : mode === "ALL_THREE"
                  ? "All 3 Copies (Bundle)"
                  : "Dual 2-Up (Side-by-Side)"}
              </button>
            ))}

            {viewMode === "DUAL_2UP" && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-700 font-mono text-[11px]">
                <span className="text-slate-400">Left:</span>
                <SearchableSelect
                  value={leftCopy}
                  onChange={(e) => setLeftCopy(e.target.value as any)}
                  className="w-28"
                  buttonClassName="bg-slate-800 border-slate-600 text-white px-2 py-0.5 font-bold text-[11px]"
                >
                  <option value="ORIGINAL">Original</option>
                  <option value="DUPLICATE">Duplicate</option>
                  <option value="TRIPLICATE">Triplicate</option>
                </SearchableSelect>
                <span className="text-slate-400">Right:</span>
                <SearchableSelect
                  value={rightCopy}
                  onChange={(e) => setRightCopy(e.target.value as any)}
                  className="w-28"
                  buttonClassName="bg-slate-800 border-slate-600 text-white px-2 py-0.5 font-bold text-[11px]"
                >
                  <option value="DUPLICATE">Duplicate</option>
                  <option value="TRIPLICATE">Triplicate</option>
                  <option value="ORIGINAL">Original</option>
                </SearchableSelect>
              </div>
            )}
          </div>

          <button
            onClick={() => handleDownload(viewMode)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-xs font-mono font-black uppercase tracking-wider transition shadow-md"
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Invoices Layout according to Selected View Mode */}
      {viewMode === "ALL_THREE" ? (
        /* All 3 Copies (Complete Triplicate Bundle) */
        <div className="space-y-6 print:space-y-0 max-w-[1200px] mx-auto">
          <div className="a3-single-sheet">
            <SingleInvoiceCard
              copyLabel={copyLabelMap.ORIGINAL}
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
              variant="single"
            />
          </div>
          <div className="a3-single-sheet page-break">
            <SingleInvoiceCard
              copyLabel={copyLabelMap.DUPLICATE}
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
              variant="single"
            />
          </div>
          <div className="a3-single-sheet page-break">
            <SingleInvoiceCard
              copyLabel={copyLabelMap.TRIPLICATE}
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
              variant="single"
            />
          </div>
        </div>
      ) : viewMode === "DUAL_2UP" ? (
        /* Dual 2-Up Side-by-Side Slips (Exact Half-A4 Slips on A4 Landscape / Half-A3 on A3 Landscape) */
        <div className="dual-a4-sheet a3-dual-sheet max-w-[1200px] mx-auto grid grid-cols-1 xl:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2 items-start relative">
          {/* Left Invoice Slip */}
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
              variant="dual"
            />
          </div>

          {/* Central Perforation / Cutting Rule */}
          <div className="hidden xl:flex print:flex absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex-col items-center justify-between pointer-events-none z-20 text-slate-400 select-none">
            <span className="text-[8px] bg-slate-200 print:bg-white px-1 font-mono flex items-center gap-1 font-bold text-slate-600">
              <Scissors size={10} className="rotate-90" /> CUT / FOLD HERE
            </span>
            <div className="w-[1px] h-full border-r border-dashed border-slate-600 my-1"></div>
            <span className="text-[8px] bg-slate-200 print:bg-white px-1 font-mono flex items-center gap-1 font-bold text-slate-600">
              <Scissors size={10} className="rotate-90" />
            </span>
          </div>

          {/* Right Invoice Slip */}
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
              variant="dual"
            />
          </div>
        </div>
      ) : (
        /* Single Half-A4 Slip (Like Sample Image — Exact Half of A4 Paper) */
        <div className="a3-single-sheet max-w-[1100px] mx-auto">
          <SingleInvoiceCard
            copyLabel={copyLabelMap[viewMode]}
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
            variant="single"
          />
        </div>
      )}
    </div>
  );
}
