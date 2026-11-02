"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, FileText, User, Truck, AlertCircle, Calendar } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { computeInvoiceTotals, round2 } from "@/lib/gst";

interface Product {
  id: string;
  name: string;
  sku: string;
  ptr: string | number | null;
  price: string | number;
  mrp: string | number | null;
  gstPct?: string | number | null;
  hsnCode?: string | null;
}

interface EditableInvoiceItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  freeQty: number;
  price: number;
  discountPct: number;
  gstPct: number;
  batchNo: string;
  expDate: string;
  mfgDate: string;
  hsnCode: string;
  packSize: string;
  mrp: number;
}

interface EditInvoiceModalProps {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => void;
}

function currency(val: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val) || 0);
}

export function EditInvoiceModal({ invoiceId, onClose, onSaved }: EditInvoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);

  // Invoice header & metadata
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);

  // Party / Billing Details
  const [partyName, setPartyName] = useState("");
  const [partyGstNo, setPartyGstNo] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyDlNo, setPartyDlNo] = useState("");

  // Logistics / Dispatch Details
  const [transport, setTransport] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [cases, setCases] = useState<number>(1);

  // Line items
  const [items, setItems] = useState<EditableInvoiceItem[]>([]);

  useEffect(() => {
    if (!invoiceId) return;

    setLoading(true);
    Promise.all([
      apiClient.get(`/api/invoices/${invoiceId}`),
      apiClient.get("/api/products", { params: { limit: 200 } }),
    ])
      .then(([invRes, prodRes]) => {
        const inv = invRes.data.data.invoice;
        const availableProducts = (prodRes.data.data.products || []) as Product[];
        setProducts(availableProducts);

        setInvoiceNo(inv.invoiceNo || "");
        setInvoiceDate(inv.createdAt ? new Date(inv.createdAt).toISOString().slice(0, 10) : "");
        setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
        setPaid(Boolean(inv.paid));

        setPartyName(inv.partyName || inv.order?.chemist?.name || "");
        setPartyGstNo(inv.partyGstNo || inv.order?.chemist?.gstNo || "");
        setPartyPhone(inv.partyPhone || inv.order?.chemist?.mobile || "");
        setPartyAddress(inv.partyAddress || inv.order?.chemist?.address || "");
        setPartyDlNo(inv.partyDlNo || inv.order?.chemist?.licenseNo || "");

        setTransport(inv.transport || "");
        setLrNo(inv.lrNo || "");
        setLrDate(inv.lrDate ? new Date(inv.lrDate).toISOString().slice(0, 10) : "");
        setVehicleNo(inv.vehicleNo || "");
        setCases(inv.cases || 1);

        const orderItems = inv.order?.items || [];
        if (orderItems.length > 0) {
          setItems(
            orderItems.map((it: any) => ({
              id: it.id,
              productId: it.productId || it.product?.id || "",
              productName: it.product?.name || "Product",
              quantity: it.quantity || 1,
              freeQty: it.freeQty || 0,
              price: Number(it.price || it.product?.ptr || it.product?.price || 0),
              discountPct: Number(it.discountPct || 0),
              gstPct: Number(it.gstPct || 12),
              batchNo: it.batchNo || "",
              expDate: it.expDate ? new Date(it.expDate).toISOString().slice(0, 10) : "",
              mfgDate: it.mfgDate ? new Date(it.mfgDate).toISOString().slice(0, 10) : "",
              hsnCode: it.hsnCode || it.product?.hsnCode || "",
              packSize: it.packSize || "",
              mrp: Number(it.mrp || it.product?.mrp || 0),
            }))
          );
        } else {
          // Fallback initial empty row
          setItems([
            {
              productId: "",
              productName: "",
              quantity: 1,
              freeQty: 0,
              price: 0,
              discountPct: 0,
              gstPct: 12,
              batchNo: "",
              expDate: "",
              mfgDate: "",
              hsnCode: "",
              packSize: "",
              mrp: 0,
            },
          ]);
        }
      })
      .catch((err) => {
        console.error("Failed to load invoice:", err);
        setError(err.response?.data?.error || err.message || "Failed to load invoice details");
      })
      .finally(() => setLoading(false));
  }, [invoiceId]);

  // Handle Product Selection on a row
  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const rate = selectedProd ? Number(selectedProd.ptr ?? selectedProd.price ?? 0) : item.price;
        const gst = selectedProd?.gstPct != null ? Number(selectedProd.gstPct) : item.gstPct;
        const mrp = selectedProd?.mrp != null ? Number(selectedProd.mrp) : item.mrp;
        const hsn = selectedProd?.hsnCode ?? item.hsnCode;
        return {
          ...item,
          productId,
          productName: selectedProd?.name ?? item.productName,
          price: rate,
          gstPct: gst,
          mrp,
          hsnCode: hsn,
        };
      })
    );
  };

  // Update item field
  const updateItem = (index: number, patch: Partial<EditableInvoiceItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  // Add line item
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        quantity: 1,
        freeQty: 0,
        price: 0,
        discountPct: 0,
        gstPct: 12,
        batchNo: "",
        expDate: "",
        mfgDate: "",
        hsnCode: "",
        packSize: "",
        mrp: 0,
      },
    ]);
  };

  // Remove line item
  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setError("An invoice must have at least one line item.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Live Totals calculation
  const calculatedTotals = React.useMemo(() => {
    const validLines = items
      .filter((i) => i.productId && i.quantity > 0)
      .map((i) => ({
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 0),
        discountPct: Number(i.discountPct || 0),
        gstPct: Number(i.gstPct || 0),
      }));
    if (validLines.length === 0) {
      return {
        totalItems: 0,
        totalQty: 0,
        totalDiscount: 0,
        totalGst: 0,
        subtotal: 0,
        roundOff: 0,
        grandTotal: 0,
      };
    }
    return computeInvoiceTotals(validLines);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((it) => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setError("Please select at least one product with quantity > 0.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.put(`/api/invoices/${invoiceId}`, {
        invoiceNo: invoiceNo.trim() || undefined,
        date: invoiceDate || undefined,
        dueDate: dueDate || null,
        paid,
        partyName: partyName.trim() || null,
        partyGstNo: partyGstNo.trim() || null,
        partyPhone: partyPhone.trim() || null,
        partyAddress: partyAddress.trim() || null,
        partyDlNo: partyDlNo.trim() || null,
        transport: transport.trim() || null,
        lrNo: lrNo.trim() || null,
        lrDate: lrDate || null,
        vehicleNo: vehicleNo.trim() || null,
        cases: Number(cases) || 1,
        items: validItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: Number(i.quantity),
          freeQty: Number(i.freeQty || 0),
          price: Number(i.price),
          discountPct: Number(i.discountPct || 0),
          gstPct: Number(i.gstPct || 0),
          batchNo: i.batchNo.trim() || null,
          expDate: i.expDate || null,
          mfgDate: i.mfgDate || null,
          hsnCode: i.hsnCode.trim() || null,
          packSize: i.packSize.trim() || null,
          mrp: i.mrp ? Number(i.mrp) : null,
        })),
      });

      onSaved();
    } catch (err: any) {
      console.error("Failed to update invoice:", err);
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message || "Failed to update invoice.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto max-h-[95vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Admin Invoice Editor</h2>
              <p className="text-xs text-slate-400 font-mono">Invoice #{invoiceNo || invoiceId.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
            <p className="text-sm font-medium text-slate-500 font-mono">Loading invoice details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: Invoice Key Dates & Settlement Status */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Payment Status
                </label>
                <select
                  value={paid ? "true" : "false"}
                  onChange={(e) => setPaid(e.target.value === "true")}
                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    paid ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-800"
                  }`}
                >
                  <option value="false">Unpaid / Open Receivable</option>
                  <option value="true">Paid / Cash Collected</option>
                </select>
              </div>
            </div>

            {/* SECTION 2: Billing Recipient (Party) Snapshot */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <User size={15} className="text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Billing Party Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer / Party Name</label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Chemist or Distributor Name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={partyGstNo}
                    onChange={(e) => setPartyGstNo(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="98XXXXXXXX"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Billing Address</label>
                  <input
                    type="text"
                    value={partyAddress}
                    onChange={(e) => setPartyAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Shop #, Street, Locality, City, State, PIN"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Drug License (D.L. No)</label>
                  <input
                    type="text"
                    value={partyDlNo}
                    onChange={(e) => setPartyDlNo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="MH-MZ2-XXXXX"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Logistics & Dispatch */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Truck size={15} className="text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dispatch & Transport Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Transporter / Courier</label>
                  <input
                    type="text"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Blue Dart"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">LR / Docket No</label>
                  <input
                    type="text"
                    value={lrNo}
                    onChange={(e) => setLrNo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="LR-123456"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">LR Date</label>
                  <input
                    type="date"
                    value={lrDate}
                    onChange={(e) => setLrDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vehicle No</label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="MH-12-AB-1234"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Total Cases / Boxes</label>
                  <input
                    type="number"
                    min="1"
                    value={cases}
                    onChange={(e) => setCases(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: Line Items Table with Real-time Calculations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Invoice Line Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold transition border border-indigo-200"
                >
                  <Plus size={13} /> Add Product
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-2 py-2.5 w-20">Batch</th>
                      <th className="px-2 py-2.5 w-24">Exp</th>
                      <th className="px-2 py-2.5 w-16 text-right">Qty</th>
                      <th className="px-2 py-2.5 w-14 text-right">Free</th>
                      <th className="px-2 py-2.5 w-20 text-right">Rate (PTR)</th>
                      <th className="px-2 py-2.5 w-16 text-right">Disc%</th>
                      <th className="px-2 py-2.5 w-16 text-right">GST%</th>
                      <th className="px-3 py-2.5 w-24 text-right">Amount</th>
                      <th className="px-2 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {items.map((item, idx) => {
                      const gross = Number(item.quantity || 0) * Number(item.price || 0);
                      const disc = gross * (Number(item.discountPct || 0) / 100);
                      const taxable = gross - disc;
                      const tax = taxable * (Number(item.gstPct || 0) / 100);
                      const lineTotal = taxable + tax;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="px-3 py-2">
                            <select
                              value={item.productId}
                              onChange={(e) => handleProductChange(idx, e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-sans text-xs focus:ring-1 focus:ring-indigo-500 font-semibold"
                            >
                              <option value="">-- Select Product --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.sku ? `(${p.sku})` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.batchNo}
                              onChange={(e) => updateItem(idx, { batchNo: e.target.value.toUpperCase() })}
                              placeholder="Batch"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              value={item.expDate}
                              onChange={(e) => updateItem(idx, { expDate: e.target.value })}
                              className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px]"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right font-bold"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.freeQty}
                              onChange={(e) => updateItem(idx, { freeQty: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={(e) => updateItem(idx, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.discountPct}
                              onChange={(e) => updateItem(idx, { discountPct: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.gstPct}
                              onChange={(e) => updateItem(idx, { gstPct: parseFloat(e.target.value) || 0 })}
                              className="w-full px-1 py-1 border border-slate-200 rounded text-xs text-right"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">
                            ₹{round2(lineTotal).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                              title="Delete row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 5: Statutory Accounting & Grand Total Summary */}
            <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Total Items</span>
                  <span className="font-bold text-sm text-slate-200">{calculatedTotals.totalItems} ({calculatedTotals.totalQty} units)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Discount</span>
                  <span className="font-bold text-sm text-slate-200">−₹{calculatedTotals.totalDiscount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Total GST</span>
                  <span className="font-bold text-sm text-slate-200">+₹{calculatedTotals.totalGst.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Round Off</span>
                  <span className="font-bold text-sm text-slate-200">₹{calculatedTotals.roundOff.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-700 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Net Invoice Total</span>
                <span className="text-2xl font-black font-mono text-white tracking-tight">
                  {currency(calculatedTotals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                    <span>Saving Invoice...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save & Update Invoice</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
