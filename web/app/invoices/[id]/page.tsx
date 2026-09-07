"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
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
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value));
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
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

  useEffect(() => {
    if (!orderId) return;
    Promise.all([apiClient.get(`/api/orders/${orderId}`), apiClient.get("/api/company-settings")])
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

  // Scan & Pay QR — standard UPI deep link (upi://pay?...), prefilled with the
  // grand total so scanning goes straight to the amount confirm screen.
  useEffect(() => {
    if (!company?.upiId || !order?.invoice) {
      setQrDataUrl(null);
      return;
    }
    const amount = Number(order.invoice.grandTotal ?? order.invoice.amount ?? 0);
    const upiLink =
      `upi://pay?pa=${encodeURIComponent(company.upiId)}` +
      `&pn=${encodeURIComponent(company.name || "Trend MR")}` +
      `&am=${amount.toFixed(2)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(order.invoice.invoiceNo)}`;
    QRCode.toDataURL(upiLink, { margin: 1, width: 160 })
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
        <p className="text-slate-500 text-sm">{error ?? "Invoice not found."}</p>
        <button onClick={() => router.back()} className="text-emerald-600 text-sm font-semibold hover:underline">
          Go back
        </button>
      </div>
    );
  }

  // item.price is already the final net rate (discount applied against PTR at
  // booking time, see /api/orders/secondary). Re-applying discountPct here
  // against MRP would double-discount whenever MRP != PTR — so the tax base
  // is price itself, at 0% further discount. discountPct is still shown in
  // its own column for reference (what % off MRP that price represents).
  const gstLines = order.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.price),
    discountPct: 0,
    gstPct: Number(item.gstPct),
  }));
  const inv = order.invoice;
  const buyerGstin = inv?.partyGstNo ?? order.chemist?.gstNo ?? null;
  const buyerName = inv?.partyName ?? order.chemist?.name ?? order.doctor?.fullName ?? "—";
  const buyerAddress = inv?.partyAddress ?? order.chemist?.address ?? order.doctor?.clinicAddress;
  const taxSplit = determineTaxSplit(company?.gstin, buyerGstin);
  const classSummary = taxClassSummaryWithSplit(gstLines, taxSplit);
  const freeStripsValue = computeFreeStripsValue(
    order.items.map((item) => ({ freeQty: item.freeQty, rate: Number(item.price) }))
  );
  const bookedBy = order.employee ? `${order.employee.firstName} ${order.employee.lastName}` : "—";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: A3 portrait; margin: 8mm; }
          html, body { width: 297mm; height: 420mm; }
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-card { border: 1.5pt solid #0f172a !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between no-print">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="invoice-card relative max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-[11px] leading-tight print:rounded-none print:shadow-none print:p-6 print:max-w-full print:bg-transparent overflow-hidden">
        {/* Watermark — centered on the invoice card itself, not the viewport,
            so it lands dead-center on the printed A3 page regardless of scroll/zoom. */}
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none">
          {company?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              aria-hidden="true"
              className="opacity-10 w-[65%] max-w-[420px] print:opacity-[0.12]"
            />
          ) : (
            <p
              aria-hidden="true"
              className="opacity-[0.06] -rotate-12 text-slate-900 text-6xl font-display font-bold whitespace-nowrap print:opacity-[0.1]"
            >
              {company?.name || "Trend MR"}
            </p>
          )}
        </div>

        <div className="relative z-10">
        {/* Header: Invoice / Order / Dispatch grid */}
        <div className="flex justify-between border-b-2 border-slate-800 pb-2 mb-2">
          <h1 className="text-lg font-display font-bold text-slate-900">GST INVOICE</h1>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-right">
            <span className="text-slate-500">Invoice No.</span>
            <span className="font-mono font-semibold">{inv?.invoiceNo ?? "—"}</span>
            <span className="text-slate-500">Invoice Date</span>
            <span>{shortDate(inv?.createdAt ?? order.createdAt)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-x-4 gap-y-1 border-b border-slate-200 pb-2 mb-2 text-slate-600">
          <div><span className="text-slate-400">Order No.:</span> {order.id.slice(0, 8).toUpperCase()}</div>
          <div><span className="text-slate-400">Order Date:</span> {shortDate(order.createdAt)}</div>
          <div><span className="text-slate-400">L.R. No.:</span> {inv?.lrNo ?? "—"}</div>
          <div><span className="text-slate-400">L.R. Date:</span> {shortDate(inv?.lrDate ?? null)}</div>
          <div><span className="text-slate-400">Cases:</span> {inv?.cases ?? "—"}</div>
          <div><span className="text-slate-400">Due Date:</span> {shortDate(inv?.dueDate ?? null)}</div>
          <div><span className="text-slate-400">Transport:</span> {inv?.transport ?? "—"}</div>
          <div><span className="text-slate-400">Vehicle No.:</span> {inv?.vehicleNo ?? "—"}</div>
        </div>

        {/* Seller / Buyer */}
        <div className="grid grid-cols-2 gap-6 border-b border-slate-200 pb-3 mb-3">
          <div>
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-10 mb-1.5 object-contain object-left" />
            )}
            <p className="font-bold text-slate-900 text-sm">{company?.name || "Trend MR"}</p>
            <p className="text-slate-600 mt-0.5">{company?.address}</p>
            {company?.phone && <p className="text-slate-500 mt-0.5">Phone: {company.phone}</p>}
            <p className="text-slate-500 mt-0.5">
              {company?.panNo && <>PAN: {company.panNo} · </>}
              {company?.dlNo1 && <>DL No.: {company.dlNo1}{company.dlNo2 ? ` & ${company.dlNo2}` : ""}</>}
            </p>
            {company?.gstin && <p className="text-slate-500 mt-0.5">GSTIN: {company.gstin}</p>}
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Buyer / Consignee</p>
            <p className="font-bold text-slate-900 text-sm mt-0.5">{buyerName}</p>
            <p className="text-slate-600 mt-0.5">{buyerAddress}</p>
            {inv?.partyPhone && <p className="text-slate-500 mt-0.5">Phone: {inv.partyPhone}</p>}
            {inv?.partyDlNo && <p className="text-slate-500 mt-0.5">DL No.: {inv.partyDlNo}</p>}
            {inv?.partyGstNo && <p className="text-slate-500 mt-0.5">GSTIN: {inv.partyGstNo}</p>}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full mb-2 border-collapse">
          <thead>
            <tr className="border-y-2 border-slate-800 text-left uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-1 font-semibold">S.N</th>
              <th className="py-1 pr-1 font-semibold">Product Name</th>
              <th className="py-1 pr-1 font-semibold">Pack</th>
              <th className="py-1 pr-1 font-semibold text-right">Qty</th>
              <th className="py-1 pr-1 font-semibold text-right">Free</th>
              <th className="py-1 pr-1 font-semibold">Batch</th>
              <th className="py-1 pr-1 font-semibold">Exp</th>
              <th className="py-1 pr-1 font-semibold text-right">M.R.P.</th>
              <th className="py-1 pr-1 font-semibold text-right">Rate</th>
              <th className="py-1 pr-1 font-semibold text-right">Dis%</th>
              <th className="py-1 pr-1 font-semibold text-right">{taxSplit === "CGST_SGST" ? "GST%" : "IGST%"}</th>
              <th className="py-1 pr-1 font-semibold text-right">Value</th>
              <th className="py-1 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item, i) => {
              const mrpDisplay = Number(item.mrp ?? item.price);
              const t = computeLineTotals({ quantity: item.quantity, price: Number(item.price), discountPct: 0, gstPct: Number(item.gstPct) });
              return (
                <tr key={item.id}>
                  <td className="py-1 pr-1">{i + 1}</td>
                  <td className="py-1 pr-1 font-medium text-slate-800">{item.product.name}</td>
                  <td className="py-1 pr-1">{item.packSize ?? "—"}</td>
                  <td className="py-1 pr-1 text-right">{item.quantity}</td>
                  <td className="py-1 pr-1 text-right">{item.freeQty || "—"}</td>
                  <td className="py-1 pr-1">{item.batchNo ?? "—"}</td>
                  <td className="py-1 pr-1">{shortDate(item.expDate)}</td>
                  <td className="py-1 pr-1 text-right">{currency(mrpDisplay)}</td>
                  <td className="py-1 pr-1 text-right">{currency(item.price)}</td>
                  <td className="py-1 pr-1 text-right">{Number(item.discountPct).toFixed(2)}</td>
                  <td className="py-1 pr-1 text-right">{Number(item.gstPct).toFixed(2)}</td>
                  <td className="py-1 pr-1 text-right">{currency(t.taxableValue)}</td>
                  <td className="py-1 text-right font-semibold">{currency(t.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer: tax summary + totals + bank */}
        <div className="grid grid-cols-2 gap-6 border-t-2 border-slate-800 pt-2">
          <div>
            <table className="w-full mb-3">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-300">
                  <th className="py-1 font-semibold">Class</th>
                  <th className="py-1 font-semibold text-right">Taxable</th>
                  {taxSplit === "CGST_SGST" ? (
                    <>
                      <th className="py-1 font-semibold text-right">CGST</th>
                      <th className="py-1 font-semibold text-right">SGST</th>
                    </>
                  ) : (
                    <th className="py-1 font-semibold text-right">IGST</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classSummary.map((c) => (
                  <tr key={c.gstPct}>
                    <td className="py-1">
                      {taxSplit === "CGST_SGST"
                        ? `CGST ${(c.gstPct / 2).toFixed(2)}% + SGST ${(c.gstPct / 2).toFixed(2)}%`
                        : `IGST ${c.gstPct.toFixed(2)}%`}
                    </td>
                    <td className="py-1 text-right">{currency(c.taxableValue)}</td>
                    {taxSplit === "CGST_SGST" ? (
                      <>
                        <td className="py-1 text-right">{currency(c.cgstAmount)}</td>
                        <td className="py-1 text-right">{currency(c.sgstAmount)}</td>
                      </>
                    ) : (
                      <td className="py-1 text-right">{currency(c.igstAmount)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-700 mb-1">Our Bank Details:</p>
                <p className="text-slate-600">Bank Name: {company?.bankName ?? "—"}</p>
                <p className="text-slate-600">Branch: {company?.bankBranch ?? "—"}</p>
                <p className="text-slate-600">Account No.: {company?.accountNo ?? "—"}</p>
                <p className="text-slate-600">IFSC Code: {company?.ifscCode ?? "—"}</p>
              </div>
              {qrDataUrl && (
                <div className="text-center shrink-0">
                  <p className="font-bold text-slate-700 mb-1">Scan &amp; Pay</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="UPI Scan and Pay QR code" className="w-20 h-20 mx-auto" />
                  <p className="text-slate-400 text-[9px] mt-1 max-w-[90px] break-words">{company?.upiId}</p>
                </div>
              )}
            </div>

            {company?.terms && (
              <>
                <p className="font-bold text-slate-700 mt-3 mb-1">Terms &amp; Conditions:</p>
                <p className="text-slate-500 whitespace-pre-line">{company.terms}</p>
              </>
            )}
          </div>

          <div>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Total Items / Qty</span><span>{inv?.totalItems ?? order.items.length} / {inv?.totalQty ?? order.items.reduce((s, i) => s + i.quantity, 0)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Discount Amount</span><span>{currency(inv?.totalDiscount ?? 0)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">{taxSplit === "CGST_SGST" ? "CGST + SGST Payable" : "IGST Payable"}</span><span>{currency(inv?.totalGst ?? 0)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Round Off</span><span>{currency(inv?.roundOff ?? 0)}</span></div>
            {freeStripsValue > 0 && (
              <div className="flex justify-between py-0.5"><span className="text-slate-500">Less: Free Qty Value</span><span>−{currency(freeStripsValue)}</span></div>
            )}
            <div className="flex justify-between py-2 mt-2 border-t-2 border-slate-800 text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span>₹{currency(inv?.grandTotal ?? inv?.amount ?? 0)}</span>
            </div>

            <div className="mt-16 text-right">
              <p className="font-semibold text-slate-700">For {company?.name || "Trend MR"}</p>
              <p className="mt-10 text-slate-500">Authorised Signatory</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
          <span>Order Status: {order.status}</span>
          <span>Booked by {bookedBy}</span>
        </div>
        </div>
      </div>
    </div>
  );
}
