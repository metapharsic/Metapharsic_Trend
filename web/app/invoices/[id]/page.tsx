"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, ShieldCheck } from "lucide-react";
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

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [invoiceCopy, setInvoiceCopy] = useState<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE">("ORIGINAL");

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
    QRCode.toDataURL(upiLink, { margin: 1, width: 180 })
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

  const copyLabelMap = {
    ORIGINAL: "ORIGINAL FOR RECIPIENT",
    DUPLICATE: "DUPLICATE FOR TRANSPORTER",
    TRIPLICATE: "TRIPLICATE FOR SUPPLIER",
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
      {/* Print Layout Styling specifically optimized for A3 & Standard Paper */}
      <style>{`
        @media print {
          @page {
            size: A3 portrait;
            margin: 12mm 15mm;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 13pt !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-card {
            border: 3pt double #0f172a !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 14mm 12mm !important;
            border-radius: 0 !important;
            font-size: 12pt !important;
            line-height: 1.4 !important;
          }
          .invoice-table th, .invoice-table td {
            font-size: 11pt !important;
            padding: 6pt 5pt !important;
          }
          .invoice-title {
            font-size: 26pt !important;
          }
          .invoice-company-name {
            font-size: 20pt !important;
          }
          .invoice-grand-total {
            font-size: 22pt !important;
          }
          .invoice-watermark {
            opacity: 0.07 !important;
            font-size: 72pt !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Screen Only) */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 transition shadow-xs"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-300 rounded-xl p-1 text-xs font-bold text-slate-700">
            {(["ORIGINAL", "DUPLICATE", "TRIPLICATE"] as const).map((copy) => (
              <button
                key={copy}
                onClick={() => setInvoiceCopy(copy)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  invoiceCopy === copy
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {copy === "ORIGINAL" ? "Original" : copy === "DUPLICATE" ? "Duplicate" : "Triplicate"}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition"
          >
            <Printer size={18} /> Print Invoice (A3 / Standard)
          </button>
        </div>
      </div>

      {/* Main Invoice Document Container with Double Outer Border */}
      <div className="invoice-card relative max-w-6xl mx-auto bg-white rounded-xl shadow-lg border-2 border-slate-900 p-8 text-sm leading-relaxed overflow-hidden">
        
        {/* Full Document Diagonal Security Watermark */}
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none overflow-hidden">
          <div className="invoice-watermark -rotate-25 text-center flex flex-col items-center justify-center opacity-[0.06] print:opacity-[0.08] text-slate-900">
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                className="w-80 h-80 object-contain mb-4 grayscale"
              />
            )}
            <span className="text-6xl sm:text-7xl font-display font-black tracking-widest uppercase">
              {company?.name || "METAPHARSIC LIFESCIENCES"}
            </span>
            <span className="text-2xl font-bold tracking-widest mt-2 uppercase">
              PHARMACEUTICAL COMMERCIAL TAX INVOICE
            </span>
          </div>
        </div>

        {/* Content Container (Above Watermark) */}
        <div className="relative z-10 space-y-4">

          {/* 1. Header Banner & Official Copy Badge */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="invoice-title text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-900 uppercase">
                  TAX INVOICE
                </h1>
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-md">
                  <ShieldCheck size={13} /> GST COMPLIANT
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Issued Under Section 31 of CGST / SGST Act 2017
              </p>
            </div>

            <div className="text-right space-y-2">
              <div className="inline-block border-2 border-slate-800 bg-slate-50 px-3.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider text-slate-900 shadow-xs">
                {copyLabelMap[invoiceCopy]}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-right">
                <span className="font-semibold text-slate-500">Invoice No:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{inv?.invoiceNo ?? "—"}</span>
                <span className="font-semibold text-slate-500">Invoice Date:</span>
                <span className="font-bold text-slate-900">{shortDate(inv?.createdAt ?? order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* 2. Order, Transport & Dispatch Matrix Box */}
          <div className="border border-slate-300 rounded-lg bg-slate-50/70 p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Order Ref</span>
              <span className="font-semibold text-slate-900">{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Order Date</span>
              <span className="font-semibold text-slate-900">{shortDate(order.createdAt)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">L.R. / Bilty No.</span>
              <span className="font-semibold text-slate-900">{inv?.lrNo ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">L.R. Date</span>
              <span className="font-semibold text-slate-900">{shortDate(inv?.lrDate ?? null)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Total Cases</span>
              <span className="font-semibold text-slate-900">{inv?.cases ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Payment Due Date</span>
              <span className="font-semibold text-slate-900 text-rose-700">{shortDate(inv?.dueDate ?? null)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Transporter Name</span>
              <span className="font-semibold text-slate-900">{inv?.transport ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block">Vehicle Number</span>
              <span className="font-semibold text-slate-900">{inv?.vehicleNo ?? "—"}</span>
            </div>
          </div>

          {/* 3. Billed By (Seller) & Billed To (Buyer) Side-by-Side Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Seller Details */}
            <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-1">
              <div className="border-b border-slate-200 pb-1.5 mb-2 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                  Consignor (Billed By)
                </span>
                {company?.gstin && (
                  <span className="text-[11px] font-mono font-bold text-slate-600">
                    GSTIN: {company.gstin}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                {company?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.name} className="h-10 w-auto object-contain shrink-0" />
                )}
                <div>
                  <h2 className="invoice-company-name text-base sm:text-lg font-black text-slate-900">
                    {company?.name || "Metapharsic Lifesciences"}
                  </h2>
                  <p className="text-xs text-slate-700 mt-0.5 leading-snug">{company?.address}</p>
                </div>
              </div>
              <div className="pt-2 text-xs text-slate-600 space-y-0.5 border-t border-slate-100">
                {company?.phone && <p><span className="font-semibold text-slate-500">Phone:</span> {company.phone}</p>}
                <p>
                  {company?.panNo && <><span className="font-semibold text-slate-500">PAN:</span> {company.panNo} · </>}
                  {company?.dlNo1 && <><span className="font-semibold text-slate-500">DL:</span> {company.dlNo1}{company.dlNo2 ? ` & ${company.dlNo2}` : ""}</>}
                </p>
              </div>
            </div>

            {/* Buyer Details */}
            <div className="border border-slate-300 rounded-lg p-4 bg-white space-y-1">
              <div className="border-b border-slate-200 pb-1.5 mb-2 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Buyer / Consignee (Billed To)
                </span>
                {buyerGstin && (
                  <span className="text-[11px] font-mono font-bold text-slate-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    GSTIN: {buyerGstin}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {buyerName}
              </h2>
              <p className="text-xs text-slate-700 mt-0.5 leading-snug">{buyerAddress}</p>
              <div className="pt-2 text-xs text-slate-600 space-y-0.5 border-t border-slate-100">
                {inv?.partyPhone && <p><span className="font-semibold text-slate-500">Contact:</span> {inv.partyPhone}</p>}
                {inv?.partyDlNo && <p><span className="font-semibold text-slate-500">Drug License:</span> {inv.partyDlNo}</p>}
              </div>
            </div>
          </div>

          {/* 4. Complete Line Items Table with Structured Grid Borders */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <table className="invoice-table w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b-2 border-slate-900">
                  <th className="py-2 px-2 text-center border-r border-slate-300 w-10">S.N</th>
                  <th className="py-2 px-3 text-left border-r border-slate-300">Description of Goods</th>
                  <th className="py-2 px-2 text-left border-r border-slate-300">Pack</th>
                  <th className="py-2 px-2 text-center border-r border-slate-300">Batch</th>
                  <th className="py-2 px-2 text-center border-r border-slate-300">Exp</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-12">Qty</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-12">Free</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">M.R.P.</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Rate (PTR)</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-12">Dis%</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-14">
                    {taxSplit === "CGST_SGST" ? "GST%" : "IGST%"}
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Taxable Val</th>
                  <th className="py-2 px-3 text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-medium">
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
                      <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3 text-left border-r border-slate-200 font-bold text-slate-900">
                        {item.product.name}
                        {item.hsnCode && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">HSN: {item.hsnCode}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-left border-r border-slate-200">{item.packSize ?? "—"}</td>
                      <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">{item.batchNo ?? "—"}</td>
                      <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">{shortDate(item.expDate)}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 text-emerald-700 font-semibold">{item.freeQty || "—"}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 text-slate-600">{currency(mrpDisplay)}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 font-semibold">{currency(item.price)}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 text-slate-500">{Number(item.discountPct).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 font-semibold">{Number(item.gstPct).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right border-r border-slate-200 font-mono">{currency(t.taxableValue)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">{currency(t.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. Summary Grid: Tax Split, Bank Details, and Grand Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            {/* Left Column: Tax Class Breakdown + Bank Details */}
            <div className="space-y-3">
              {/* GST Tax Summary Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="py-1.5 px-2 text-left">Tax Class</th>
                      <th className="py-1.5 px-2 text-right">Taxable Value</th>
                      {taxSplit === "CGST_SGST" ? (
                        <>
                          <th className="py-1.5 px-2 text-right">CGST</th>
                          <th className="py-1.5 px-2 text-right">SGST</th>
                        </>
                      ) : (
                        <th className="py-1.5 px-2 text-right">IGST</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classSummary.map((c) => (
                      <tr key={c.gstPct}>
                        <td className="py-1.5 px-2 font-medium">
                          {taxSplit === "CGST_SGST"
                            ? `GST ${c.gstPct.toFixed(1)}% (${(c.gstPct / 2).toFixed(1)}% + ${(c.gstPct / 2).toFixed(1)}%)`
                            : `IGST ${c.gstPct.toFixed(1)}%`}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{currency(c.taxableValue)}</td>
                        {taxSplit === "CGST_SGST" ? (
                          <>
                            <td className="py-1.5 px-2 text-right font-mono">{currency(c.cgstAmount)}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{currency(c.sgstAmount)}</td>
                          </>
                        ) : (
                          <td className="py-1.5 px-2 text-right font-mono">{currency(c.igstAmount)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bank Details & Scan to Pay Box */}
              <div className="border border-slate-300 rounded-lg p-3 bg-white flex items-start justify-between gap-4">
                <div className="text-xs space-y-1">
                  <p className="font-black text-slate-800 uppercase tracking-wider text-[11px] mb-1">
                    Bank Remittance Details:
                  </p>
                  <p><span className="font-semibold text-slate-500">Bank Name:</span> {company?.bankName ?? "State Bank of India"}</p>
                  <p><span className="font-semibold text-slate-500">Branch:</span> {company?.bankBranch ?? "Main Commercial Branch"}</p>
                  <p><span className="font-semibold text-slate-500">Account No:</span> <span className="font-mono font-bold text-slate-900">{company?.accountNo ?? "45259232976"}</span></p>
                  <p><span className="font-semibold text-slate-500">IFSC Code:</span> <span className="font-mono font-bold text-slate-900">{company?.ifscCode ?? "SBIN0007109"}</span></p>
                </div>

                {qrDataUrl && (
                  <div className="text-center shrink-0 border-l border-slate-200 pl-4">
                    <p className="font-black text-slate-800 uppercase tracking-wider text-[10px] mb-1">
                      UPI Scan &amp; Pay
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="UPI QR Code" className="w-20 h-20 mx-auto border border-slate-200 p-0.5 rounded shadow-2xs" />
                    <p className="text-slate-500 font-mono text-[9px] mt-1 max-w-[100px] break-all">{company?.upiId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Totals & Signatory Block */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600 font-medium">Total Line Items / Units:</span>
                  <span className="font-bold text-slate-900">
                    {inv?.totalItems ?? order.items.length} items / {inv?.totalQty ?? order.items.reduce((s, i) => s + i.quantity, 0)} units
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600 font-medium">Total Discount Deducted:</span>
                  <span className="font-mono text-slate-900">₹{currency(inv?.totalDiscount ?? 0)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600 font-medium">{taxSplit === "CGST_SGST" ? "Total GST (CGST + SGST):" : "Total IGST Amount:"}</span>
                  <span className="font-mono text-slate-900 font-semibold">₹{currency(inv?.totalGst ?? 0)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600 font-medium">Round Off Adjustment:</span>
                  <span className="font-mono text-slate-900">₹{currency(inv?.roundOff ?? 0)}</span>
                </div>
                {freeStripsValue > 0 && (
                  <div className="flex justify-between py-0.5 text-emerald-700">
                    <span className="font-medium">Free Scheme Bonus Value:</span>
                    <span className="font-mono font-semibold">−₹{currency(freeStripsValue)}</span>
                  </div>
                )}

                {/* Grand Total Callout */}
                <div className="border-t-2 border-slate-900 pt-2 mt-2 flex items-baseline justify-between">
                  <span className="text-base font-black text-slate-900 uppercase">Grand Total:</span>
                  <span className="invoice-grand-total text-xl sm:text-2xl font-black text-emerald-900 font-mono">
                    ₹{currency(finalGrandTotal)}
                  </span>
                </div>

                {/* Amount in Words */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Amount in Words:</span>
                  <span className="text-xs font-bold text-slate-800 italic">
                    {numberToWords(finalGrandTotal)}
                  </span>
                </div>
              </div>

              {/* Authorised Signatory Stamp Box */}
              <div className="border border-slate-300 rounded-lg p-3 bg-white text-right space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase">
                    For {company?.name || "Metapharsic Lifesciences"}
                  </p>
                </div>
                <div className="pt-8">
                  <p className="text-xs font-bold text-slate-700 border-t border-dashed border-slate-400 inline-block pt-1 px-4">
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* 6. Terms & Conditions and Audit Trail Footer */}
          <div className="border-t border-slate-300 pt-2 text-[11px] text-slate-600 flex flex-col sm:flex-row items-start justify-between gap-2">
            <div className="max-w-2xl">
              <span className="font-bold text-slate-700">Terms &amp; Conditions: </span>
              <span>{company?.terms || "1. Goods once sold will not be taken back or exchanged. 2. Bills not paid on due date will attract 24% interest. 3. Disputes subject to local jurisdiction."}</span>
            </div>
            <div className="text-right text-[10px] text-slate-400 shrink-0">
              <span>Status: <b className="text-slate-600">{order.status}</b></span> · <span>Booked by {bookedBy}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
