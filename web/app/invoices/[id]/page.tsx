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
    <div className="min-h-screen bg-slate-100 py-6 px-3 print:bg-white print:p-0">
      {/* Print Layout Styling specifically strictly enforced for A5 Printing Only */}
      <style>{`
        @media print {
          @page {
            size: A5 portrait !important;
            margin: 4mm 5mm !important;
          }
          html, body {
            width: 148mm !important;
            height: auto !important;
            max-height: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-card {
            border: 2pt double #0f172a !important;
            box-shadow: none !important;
            width: 138mm !important;
            max-width: 138mm !important;
            min-height: 198mm !important;
            max-height: 200mm !important;
            margin: 0 auto !important;
            padding: 3.5mm 3.5mm !important;
            border-radius: 0 !important;
            font-size: 7pt !important;
            line-height: 1.15 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
          .invoice-table th, .invoice-table td {
            font-size: 6.8pt !important;
            padding: 2.2pt 2pt !important;
            line-height: 1.1 !important;
          }
          .invoice-title {
            font-size: 14pt !important;
          }
          .invoice-company-name {
            font-size: 10pt !important;
          }
          .invoice-grand-total {
            font-size: 12pt !important;
          }
          .invoice-watermark {
            opacity: 0.05 !important;
            font-size: 32pt !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Screen Only) */}
      <div className="max-w-3xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-300 text-blue-900 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            A5 Format Only (148 × 210 mm • Half of A4)
          </span>

          <div className="flex bg-white border border-slate-300 rounded-lg p-0.5 text-xs font-bold text-slate-700">
            {(["ORIGINAL", "DUPLICATE", "TRIPLICATE"] as const).map((copy) => (
              <button
                key={copy}
                onClick={() => setInvoiceCopy(copy)}
                className={`px-2.5 py-1 rounded-md transition ${
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
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition"
          >
            <Printer size={15} /> Print A5 Invoice Only
          </button>
        </div>
      </div>

      {/* Main Invoice Document Container with Double Outer Border (Scaled to A5) */}
      <div className="invoice-card relative max-w-3xl mx-auto bg-white rounded-lg shadow-lg border-2 border-slate-900 p-4 sm:p-5 text-xs leading-normal overflow-hidden">
        
        {/* Full Document Diagonal Security Watermark */}
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none overflow-hidden">
          <div className="invoice-watermark -rotate-25 text-center flex flex-col items-center justify-center opacity-[0.05] print:opacity-[0.05] text-slate-900">
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                className="w-36 h-36 object-contain mb-2 grayscale"
              />
            )}
            <span className="text-3xl sm:text-4xl font-display font-black tracking-widest uppercase">
              {company?.name || "METAPHARSIC LIFESCIENCES"}
            </span>
            <span className="text-base font-bold tracking-widest mt-1 uppercase">
              PHARMACEUTICAL COMMERCIAL TAX INVOICE • A5 FORMAT (HALF A4)
            </span>
          </div>
        </div>

        {/* Content Container (Above Watermark) */}
        <div className="relative z-10 space-y-2.5">

          {/* 1. Header Banner & Official Copy Badge */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="invoice-title text-xl sm:text-2xl font-display font-black tracking-tight text-slate-900 uppercase">
                  TAX INVOICE
                </h1>
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  <ShieldCheck size={11} /> GST COMPLIANT
                </span>
                <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-300 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider print:border-slate-800 print:text-slate-900">
                  A5 PRINT ONLY (HALF A4)
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Issued Under Section 31 of CGST / SGST Act 2017
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block border border-slate-800 bg-slate-50 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider text-slate-900 shadow-2xs">
                {copyLabelMap[invoiceCopy]}
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-[10px] sm:text-[11px] text-right">
                <span className="font-semibold text-slate-500">Invoice No:</span>
                <span className="font-mono font-bold text-slate-900">{inv?.invoiceNo ?? "—"}</span>
                <span className="font-semibold text-slate-500">Invoice Date:</span>
                <span className="font-bold text-slate-900">{shortDate(inv?.createdAt ?? order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* 2. Order, Transport & Dispatch Matrix Box */}
          <div className="border border-slate-300 rounded bg-slate-50/70 p-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[10px]">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Order Ref</span>
              <span className="font-semibold text-slate-900">{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Order Date</span>
              <span className="font-semibold text-slate-900">{shortDate(order.createdAt)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">L.R. / Bilty No.</span>
              <span className="font-semibold text-slate-900">{inv?.lrNo ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">L.R. Date</span>
              <span className="font-semibold text-slate-900">{shortDate(inv?.lrDate ?? null)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Total Cases</span>
              <span className="font-semibold text-slate-900">{inv?.cases ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Due Date</span>
              <span className="font-semibold text-slate-900 text-rose-700">{shortDate(inv?.dueDate ?? null)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Transporter</span>
              <span className="font-semibold text-slate-900">{inv?.transport ?? "—"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Vehicle No</span>
              <span className="font-semibold text-slate-900">{inv?.vehicleNo ?? "—"}</span>
            </div>
          </div>

          {/* 3. Billed By (Seller) & Billed To (Buyer) Side-by-Side Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Seller Details */}
            <div className="border border-slate-300 rounded p-2.5 bg-white space-y-0.5">
              <div className="border-b border-slate-200 pb-1 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Consignor (Billed By)
                </span>
                {company?.gstin && (
                  <span className="text-[10px] font-mono font-bold text-slate-600">
                    GSTIN: {company.gstin}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2">
                {company?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.name} className="h-8 w-auto object-contain shrink-0" />
                )}
                <div>
                  <h2 className="invoice-company-name text-xs sm:text-sm font-black text-slate-900">
                    {company?.name || "Metapharsic Lifesciences"}
                  </h2>
                  <p className="text-[11px] text-slate-700 leading-tight">{company?.address}</p>
                </div>
              </div>
              <div className="pt-1 text-[10px] text-slate-600 space-y-0.2 border-t border-slate-100">
                {company?.phone && <p><span className="font-semibold text-slate-500">Phone:</span> {company.phone}</p>}
                <p>
                  {company?.panNo && <><span className="font-semibold text-slate-500">PAN:</span> {company.panNo} · </>}
                  {company?.dlNo1 && <><span className="font-semibold text-slate-500">DL:</span> {company.dlNo1}{company.dlNo2 ? ` & ${company.dlNo2}` : ""}</>}
                </p>
              </div>
            </div>

            {/* Buyer Details */}
            <div className="border border-slate-300 rounded p-2.5 bg-white space-y-0.5">
              <div className="border-b border-slate-200 pb-1 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Buyer / Consignee (Billed To)
                </span>
                {buyerGstin && (
                  <span className="text-[10px] font-mono font-bold text-slate-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                    GSTIN: {buyerGstin}
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-black text-slate-900">
                {buyerName}
              </h2>
              <p className="text-[11px] text-slate-700 leading-tight">{buyerAddress}</p>
              <div className="pt-1 text-[10px] text-slate-600 space-y-0.2 border-t border-slate-100">
                {inv?.partyPhone && <p><span className="font-semibold text-slate-500">Contact:</span> {inv.partyPhone}</p>}
                {inv?.partyDlNo && <p><span className="font-semibold text-slate-500">Drug License:</span> {inv.partyDlNo}</p>}
              </div>
            </div>
          </div>

          {/* 4. Complete Line Items Table with Structured Grid Borders */}
          <div className="border border-slate-900 rounded overflow-hidden">
            <table className="invoice-table w-full border-collapse text-[10px] sm:text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black uppercase tracking-wider border-b border-slate-900 text-[10px]">
                  <th className="py-1 px-1.5 text-center border-r border-slate-300 w-8">#</th>
                  <th className="py-1 px-2 text-left border-r border-slate-300">Description</th>
                  <th className="py-1 px-1.5 text-left border-r border-slate-300">Pack</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-300">Batch</th>
                  <th className="py-1 px-1.5 text-center border-r border-slate-300">Exp</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300 w-10">Qty</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300 w-10">Free</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300">M.R.P.</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300">Rate</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300 w-10">Dis%</th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300 w-12">
                    {taxSplit === "CGST_SGST" ? "GST%" : "IGST%"}
                  </th>
                  <th className="py-1 px-1.5 text-right border-r border-slate-300">Taxable</th>
                  <th className="py-1 px-2 text-right">Net Amt</th>
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
                      <td className="py-1 px-1.5 text-center border-r border-slate-200 text-slate-500">{i + 1}</td>
                      <td className="py-1 px-2 text-left border-r border-slate-200 font-bold text-slate-900">
                        {item.product.name}
                        {item.hsnCode && (
                          <span className="block text-[9px] text-slate-400 font-mono font-normal">HSN: {item.hsnCode}</span>
                        )}
                      </td>
                      <td className="py-1 px-1.5 text-left border-r border-slate-200">{item.packSize ?? "—"}</td>
                      <td className="py-1 px-1.5 text-center border-r border-slate-200 font-mono">{item.batchNo ?? "—"}</td>
                      <td className="py-1 px-1.5 text-center border-r border-slate-200 font-mono">{shortDate(item.expDate)}</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 text-emerald-700 font-semibold">{item.freeQty || "—"}</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 text-slate-600">{currency(mrpDisplay)}</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">{currency(item.price)}</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 text-slate-500">{Number(item.discountPct).toFixed(1)}%</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 font-semibold">{Number(item.gstPct).toFixed(1)}%</td>
                      <td className="py-1 px-1.5 text-right border-r border-slate-200 font-mono">{currency(t.taxableValue)}</td>
                      <td className="py-1 px-2 text-right font-bold text-slate-900 font-mono">{currency(t.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. Summary Grid: Tax Split, Bank Details, and Grand Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            
            {/* Left Column: Tax Class Breakdown + Bank Details */}
            <div className="space-y-2">
              {/* GST Tax Summary Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="py-1 px-1.5 text-left">Tax Class</th>
                      <th className="py-1 px-1.5 text-right">Taxable Val</th>
                      {taxSplit === "CGST_SGST" ? (
                        <>
                          <th className="py-1 px-1.5 text-right">CGST</th>
                          <th className="py-1 px-1.5 text-right">SGST</th>
                        </>
                      ) : (
                        <th className="py-1 px-1.5 text-right">IGST</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classSummary.map((c) => (
                      <tr key={c.gstPct}>
                        <td className="py-1 px-1.5 font-medium">
                          {taxSplit === "CGST_SGST"
                            ? `GST ${c.gstPct.toFixed(1)}%`
                            : `IGST ${c.gstPct.toFixed(1)}%`}
                        </td>
                        <td className="py-1 px-1.5 text-right font-mono">{currency(c.taxableValue)}</td>
                        {taxSplit === "CGST_SGST" ? (
                          <>
                            <td className="py-1 px-1.5 text-right font-mono">{currency(c.cgstAmount)}</td>
                            <td className="py-1 px-1.5 text-right font-mono">{currency(c.sgstAmount)}</td>
                          </>
                        ) : (
                          <td className="py-1 px-1.5 text-right font-mono">{currency(c.igstAmount)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bank Details & Scan to Pay Box */}
              <div className="border border-slate-300 rounded p-2 bg-white flex items-start justify-between gap-2 text-[10px]">
                <div className="space-y-0.5">
                  <p className="font-black text-slate-800 uppercase tracking-wider text-[9px] mb-0.5">
                    Bank Remittance:
                  </p>
                  <p><span className="font-semibold text-slate-500">Bank:</span> {company?.bankName ?? "State Bank of India"}</p>
                  <p><span className="font-semibold text-slate-500">A/C:</span> <span className="font-mono font-bold text-slate-900">{company?.accountNo ?? "45259232976"}</span></p>
                  <p><span className="font-semibold text-slate-500">IFSC:</span> <span className="font-mono font-bold text-slate-900">{company?.ifscCode ?? "SBIN0007109"}</span></p>
                </div>

                {qrDataUrl && (
                  <div className="text-center shrink-0 border-l border-slate-200 pl-2">
                    <p className="font-black text-slate-800 uppercase tracking-wider text-[8px] mb-0.5">
                      UPI Pay
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="UPI QR Code" className="w-14 h-14 mx-auto border border-slate-200 p-0.5 rounded shadow-2xs" />
                    <p className="text-slate-500 font-mono text-[8px] mt-0.5 max-w-[80px] truncate">{company?.upiId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Totals & Signatory Block */}
            <div className="space-y-2 flex flex-col justify-between">
              <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1 text-xs">
                <div className="flex justify-between py-0.2 text-[11px]">
                  <span className="text-slate-600 font-medium">Total Items / Units:</span>
                  <span className="font-bold text-slate-900">
                    {inv?.totalItems ?? order.items.length} items / {inv?.totalQty ?? order.items.reduce((s, i) => s + i.quantity, 0)} units
                  </span>
                </div>
                <div className="flex justify-between py-0.2 text-[11px]">
                  <span className="text-slate-600 font-medium">Discount Deducted:</span>
                  <span className="font-mono text-slate-900">₹{currency(inv?.totalDiscount ?? 0)}</span>
                </div>
                <div className="flex justify-between py-0.2 text-[11px]">
                  <span className="text-slate-600 font-medium">{taxSplit === "CGST_SGST" ? "Total GST:" : "Total IGST:"}</span>
                  <span className="font-mono text-slate-900 font-semibold">₹{currency(inv?.totalGst ?? 0)}</span>
                </div>
                <div className="flex justify-between py-0.2 text-[11px]">
                  <span className="text-slate-600 font-medium">Round Off:</span>
                  <span className="font-mono text-slate-900">₹{currency(inv?.roundOff ?? 0)}</span>
                </div>
                {freeStripsValue > 0 && (
                  <div className="flex justify-between py-0.2 text-emerald-700 text-[11px]">
                    <span className="font-medium">Free Bonus Value:</span>
                    <span className="font-mono font-semibold">−₹{currency(freeStripsValue)}</span>
                  </div>
                )}

                {/* Grand Total Callout */}
                <div className="border-t border-slate-900 pt-1.5 mt-1 flex items-baseline justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase">Grand Total:</span>
                  <span className="invoice-grand-total text-base sm:text-lg font-black text-emerald-900 font-mono">
                    ₹{currency(finalGrandTotal)}
                  </span>
                </div>

                {/* Amount in Words */}
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">In Words:</span>
                  <span className="text-[11px] font-bold text-slate-800 italic">
                    {numberToWords(finalGrandTotal)}
                  </span>
                </div>
              </div>

              {/* Authorised Signatory Stamp Box */}
              <div className="border border-slate-300 rounded p-2 bg-white text-right space-y-3">
                <p className="text-[10px] font-bold text-slate-800 uppercase">
                  For {company?.name || "Metapharsic Lifesciences"}
                </p>
                <div className="pt-4">
                  <p className="text-[10px] font-bold text-slate-700 border-t border-dashed border-slate-400 inline-block pt-0.5 px-3">
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* 6. Terms & Conditions and Audit Trail Footer */}
          <div className="border-t border-slate-300 pt-1.5 text-[10px] text-slate-600 flex flex-col sm:flex-row items-start justify-between gap-1">
            <div className="max-w-xl">
              <span className="font-bold text-slate-700">Terms: </span>
              <span>{company?.terms || "1. Goods once sold will not be taken back. 2. Bills not paid on due date attract 24% interest. 3. Disputes subject to local jurisdiction."}</span>
            </div>
            <div className="text-right text-[9px] text-slate-400 shrink-0">
              <span>Status: <b className="text-slate-600">{order.status}</b></span> · <span>Booked by {bookedBy}</span>
            </div>
          </div>

          {/* Official A5 Standard Print Notice */}
          <div className="border-t border-slate-200 pt-1 text-center text-[9px] uppercase font-bold tracking-widest text-slate-400 print:text-slate-700">
            METAPHARSIC COMMERCIAL TAX INVOICE • STRICTLY CONFIGURED FOR A5 PAPER PRINTING ONLY (148 mm × 210 mm • EXACT HALF OF A4)
          </div>

        </div>
      </div>
    </div>
  );
}
