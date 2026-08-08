"use client";

import React, { useEffect, useState } from "react";
import { Search, Plus, Edit2, Package, RefreshCw, X, ShieldAlert, Trash2, History, TrendingDown } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  composition: string | null;
  strength: string | null;
  packSize: string | null;
  mrp: number | null;
  ptr: number | null;
  pts: number | null;
  stockQty: number;
  therapySegment: string | null;
  currentBatchNo: string | null;
  currentMfgDate: string | null;
  currentExpDate: string | null;
  stockValue?: number;
  lastMovementAt?: string;
  forecast?: { burnRatePerDay: number; daysRemaining: number | null };
}

interface MySample {
  productId: string;
  productName: string;
  quantity: number;
  unitValue: number;
  estimatedValue: number;
  lastGivenAt: string;
}

interface MrStockRep {
  employeeId: string;
  employeeName: string;
  items: { productId: string; productName: string; quantity: number; unitValue: number; estimatedValue: number; lastGivenAt: string }[];
  totalEstimatedValue: number;
}

function currency(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export default function InventoryPage() {
  const [role, setRole] = useState<string | null>(null);
  const canManage = role !== "MR";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mySamples, setMySamples] = useState<MySample[]>([]);
  const [mySamplesLoading, setMySamplesLoading] = useState(false);
  const [mrStock, setMrStock] = useState<MrStockRep[]>([]);
  const [mrStockLoading, setMrStockLoading] = useState(false);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [mrList, setMrList] = useState<{ id: string; employeeId: string; firstName: string; lastName: string }[]>([]);
  const [allocEmployeeId, setAllocEmployeeId] = useState("");
  const [allocProductId, setAllocProductId] = useState("");
  const [allocQty, setAllocQty] = useState("");
  const [allocSubmitting, setAllocSubmitting] = useState(false);
  const [allocError, setAllocError] = useState("");
  const [allocSuccess, setAllocSuccess] = useState("");

  // Form states for add/edit
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    composition: "",
    strength: "",
    packSize: "",
    mrp: 0,
    ptr: 0,
    pts: 0,
    stockQty: 0,
    therapySegment: "",
    currentBatchNo: "",
    currentMfgDate: "",
    currentExpDate: "",
  });

  const fetchProducts = () => {
    setLoading(true);
    apiClient
      .get("/api/products", { params: { limit: 100 } })
      .then((res) => {
        setProducts(res.data.data.products ?? []);
      })
      .catch((err) => {
        console.error("Failed to fetch products", err);
        setError("Could not load inventory catalog.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    let decodedRole: string | null = null;
    if (token) {
      try {
        decodedRole = JSON.parse(atob(token.split(".")[1])).role;
        setRole(decodedRole);
      } catch (e) {
        console.error("Failed to decode token");
      }
    }
    fetchProducts();
    if (decodedRole === "MR") {
      setMySamplesLoading(true);
      apiClient
        .get("/api/mr/samples")
        .then((res) => setMySamples(res.data.data.samples ?? []))
        .catch((err) => console.error("Failed to fetch my sample stock", err))
        .finally(() => setMySamplesLoading(false));
    }
    if (decodedRole === "ASM" || decodedRole === "ADMIN" || decodedRole === "MD") {
      setMrStockLoading(true);
      apiClient
        .get("/api/manager/mr-stock")
        .then((res) => setMrStock(res.data.data.reps ?? []))
        .catch((err) => console.error("Failed to fetch MR stock", err))
        .finally(() => setMrStockLoading(false));
      apiClient
        .get("/api/manager/mrs")
        .then((res) => setMrList(res.data.data?.mrs ?? []))
        .catch((err) => console.error("Failed to fetch MR list", err));
    }
  }, []);

  const refreshMrStock = () => {
    setMrStockLoading(true);
    apiClient
      .get("/api/manager/mr-stock")
      .then((res) => setMrStock(res.data.data.reps ?? []))
      .catch((err) => console.error("Failed to fetch MR stock", err))
      .finally(() => setMrStockLoading(false));
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocError("");
    setAllocSuccess("");
    if (!allocEmployeeId) return setAllocError("Select an MR.");
    if (!allocProductId) return setAllocError("Select a product.");
    const qty = Number(allocQty);
    if (!qty || qty < 1) return setAllocError("Enter a valid quantity.");

    setAllocSubmitting(true);
    try {
      await apiClient.post("/api/manager/mr-stock/allocate", {
        employeeId: allocEmployeeId,
        productId: allocProductId,
        quantity: qty,
      });
      setAllocSuccess("Stock allocated to MR.");
      setAllocQty("");
      refreshMrStock();
    } catch (err: any) {
      setAllocError(err?.response?.data?.error?.message || "Failed to allocate stock.");
    } finally {
      setAllocSubmitting(false);
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      composition: p.composition || "",
      strength: p.strength || "",
      packSize: p.packSize || "",
      mrp: Number(p.mrp || 0),
      ptr: Number(p.ptr || 0),
      pts: Number(p.pts || 0),
      stockQty: p.stockQty,
      therapySegment: p.therapySegment || "",
      currentBatchNo: p.currentBatchNo || "",
      currentMfgDate: p.currentMfgDate ? p.currentMfgDate.slice(0, 10) : "",
      currentExpDate: p.currentExpDate ? p.currentExpDate.slice(0, 10) : "",
    });
    setIsAdding(false);
    setError("");
    setSuccess("");
  };

  const handleOpenAdd = () => {
    setIsAdding(true);
    setEditingProduct(null);
    setFormData({
      name: "",
      sku: "",
      composition: "",
      strength: "",
      packSize: "",
      mrp: 0,
      ptr: 0,
      pts: 0,
      stockQty: 0,
      therapySegment: "",
      currentBatchNo: "",
      currentMfgDate: "",
      currentExpDate: "",
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...formData,
        price: formData.ptr,
        currentMfgDate: formData.currentMfgDate || undefined,
        currentExpDate: formData.currentExpDate || undefined,
      };
      if (isAdding) {
        // Price is set to PTR for general orders compatibility
        await apiClient.post("/api/products", payload);
        setSuccess("Product added to catalog successfully.");
        setIsAdding(false);
      } else if (editingProduct) {
        await apiClient.put(`/api/products/${editingProduct.id}`, payload);
        setSuccess("Product details and stock levels updated.");
        setEditingProduct(null);
      }
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to save product details.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from the inventory catalog?`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/api/products/${id}`);
      setSuccess(`Product "${name}" has been deleted.`);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || `Failed to delete product "${name}".`);
    }
  };

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.composition || "").toLowerCase().includes(query) ||
      (p.therapySegment || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Central Product Inventory</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage product formulas, pricing structures, and central warehouse stock levels.
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={fetchProducts}
            className="p-2.5 bg-slate-850 hover:bg-slate-800 text-white rounded-xl transition-colors cursor-pointer"
            title="Refresh inventory list"
          >
            <RefreshCw size={16} />
          </button>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-indigo-600/20 w-full sm:w-auto"
            >
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
          <span>{success}</span>
        </div>
      )}

      {/* MR personal sample-carry stock */}
      {role === "MR" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-800">My Sample Stock (carried inventory)</h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {mySamples.length} product{mySamples.length === 1 ? "" : "s"} in hand · {currency(mySamples.reduce((s, x) => s + x.estimatedValue, 0))} est. value
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Product</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Qty With Me</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Unit Value</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Est. Value</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Last Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mySamplesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto" />
                    </td>
                  </tr>
                ) : mySamples.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                      No sample stock allocated to you yet.
                    </td>
                  </tr>
                ) : (
                  mySamples.map((s) => (
                    <tr key={s.productId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">{s.productName}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block font-bold text-xs ${
                          s.quantity <= 5 ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg" : "text-emerald-700"
                        }`}>
                          {s.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{currency(s.unitValue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{currency(s.estimatedValue)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(s.lastGivenAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {" "}
                        <span className="text-[10px] text-slate-400">{new Date(s.lastGivenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin/ASM: give stock to an MR */}
      {(role === "ASM" || role === "ADMIN" || role === "MD") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-800">Give Stock to MR</h2>
          </div>
          <form onSubmit={handleAllocate} className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-slate-600">MR</label>
              <select
                value={allocEmployeeId}
                onChange={(e) => setAllocEmployeeId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
              >
                <option value="">Select MR</option>
                {mrList.map((m) => (
                  <option key={m.employeeId} value={m.employeeId}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-slate-600">Product</label>
              <select
                value={allocProductId}
                onChange={(e) => setAllocProductId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-28 space-y-1">
              <label className="text-xs font-semibold text-slate-600">Qty</label>
              <input
                type="number"
                min={1}
                value={allocQty}
                onChange={(e) => setAllocQty(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={allocSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 w-full sm:w-auto"
            >
              {allocSubmitting ? "Giving..." : "Give Stock"}
            </button>
          </form>
          {allocError && <p className="px-4 pb-3 text-xs text-rose-600">{allocError}</p>}
          {allocSuccess && <p className="px-4 pb-3 text-xs text-emerald-600">{allocSuccess}</p>}
        </div>
      )}

      {/* Admin/ASM: per-MR stock value across the field force */}
      {(role === "ASM" || role === "ADMIN" || role === "MD") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-800">MR Sample Stock &amp; Estimated Value</h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {mrStock.length} rep{mrStock.length === 1 ? "" : "s"} · {currency(mrStock.reduce((s, r) => s + r.totalEstimatedValue, 0))} total
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {mrStockLoading ? (
              <div className="px-4 py-8 text-center text-slate-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto" />
              </div>
            ) : mrStock.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 font-medium text-xs">No MR carrying stock currently.</div>
            ) : (
              mrStock.map((rep) => (
                <div key={rep.employeeId}>
                  <button
                    onClick={() => setExpandedRep(expandedRep === rep.employeeId ? null : rep.employeeId)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="font-bold text-slate-800 text-xs">{rep.employeeName}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">{rep.items.length} product{rep.items.length === 1 ? "" : "s"}</span>
                      <span className="font-bold text-indigo-700">{currency(rep.totalEstimatedValue)}</span>
                    </span>
                  </button>
                  {expandedRep === rep.employeeId && (
                    <table className="w-full text-left text-xs border-collapse bg-slate-50/50">
                      <tbody className="divide-y divide-slate-100">
                        {rep.items.map((it) => (
                          <tr key={it.productId}>
                            <td className="px-4 py-2 pl-8 text-slate-600">{it.productName}</td>
                            <td className="px-4 py-2 text-right text-slate-500">Qty {it.quantity}</td>
                            <td className="px-4 py-2 text-right text-slate-500">{currency(it.unitValue)}/u</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-700">{currency(it.estimatedValue)}</td>
                            <td className="px-4 py-2 text-right text-slate-400 text-[10px]">
                              {new Date(it.lastGivenAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                              {new Date(it.lastGivenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Grid: List and Add/Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table List */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${
          editingProduct || isAdding ? "lg:col-span-8" : "lg:col-span-12"
        }`}>
          {/* Table Search */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center gap-3">
            <div className="relative w-full max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search SKU, name, molecule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 w-full text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Showing {filteredProducts.length} of {products.length} Products
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Product</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Molecule / Segment</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">MRP</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">PTR</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">PTS</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Stock level</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Stock Value</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Last Updated</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Forecast</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Current Batch</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Audit</th>
                  {canManage && <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 leading-tight">{p.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">SKU: {p.sku} | Pack: {p.packSize || "N/A"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700 leading-tight">{p.composition || "-"}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700">
                          {p.therapySegment || "General"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">₹{Number(p.mrp || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">₹{Number(p.ptr || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">₹{Number(p.pts || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block font-bold text-xs ${
                          p.stockQty <= 20 ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg" : "text-emerald-700"
                        }`}>
                          {p.stockQty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {p.stockValue !== undefined ? `₹${p.stockValue.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.lastMovementAt ? (
                          <>
                            <p className="text-slate-700">{new Date(p.lastMovementAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                            <p className="text-[10px] text-slate-400">{new Date(p.lastMovementAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.forecast?.daysRemaining !== null && p.forecast?.daysRemaining !== undefined ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            p.forecast.daysRemaining <= 7 ? "text-rose-600" : p.forecast.daysRemaining <= 21 ? "text-amber-600" : "text-slate-600"
                          }`}>
                            <TrendingDown size={12} />
                            {p.forecast.daysRemaining}d left
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">No recent sales</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.currentBatchNo ? (
                          <>
                            <p className="font-bold text-slate-800 leading-tight">{p.currentBatchNo}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {p.currentExpDate ? `Exp ${new Date(p.currentExpDate).toLocaleDateString("en-IN", { month: "2-digit", year: "2-digit" })}` : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setHistoryProduct(p)}
                          className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-400"
                          title="View stock movement audit trail"
                        >
                          <History size={14} />
                        </button>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-500"
                            title="Edit Product details / stock"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer text-slate-500"
                            title="Delete Product"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Side Form */}
        {(editingProduct || isAdding) && (
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col self-start">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-800">
                {isAdding ? "Add New Product" : "Edit Product Catalog"}
              </h2>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsAdding(false);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Pancloc-40"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">SKU Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. PAN-40MG-10"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Pack Size</label>
                  <input
                    type="text"
                    value={formData.packSize}
                    onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                    placeholder="e.g. 10 tablets"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Molecule / Composition</label>
                  <input
                    type="text"
                    value={formData.composition}
                    onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                    placeholder="e.g. Pantoprazole"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Therapy Segment</label>
                  <input
                    type="text"
                    value={formData.therapySegment}
                    onChange={(e) => setFormData({ ...formData, therapySegment: e.target.value })}
                    placeholder="e.g. Gastroenterology"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">PTR (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.ptr}
                    onChange={(e) => setFormData({ ...formData, ptr: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">PTS (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.pts}
                    onChange={(e) => setFormData({ ...formData, pts: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Stock level (Qty in Warehouse)</label>
                <input
                  type="number"
                  required
                  value={formData.stockQty}
                  onChange={(e) => setFormData({ ...formData, stockQty: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100">
                <label className="font-semibold text-slate-600">
                  Current Batch No. <span className="font-normal text-slate-400">— auto-fills new orders &amp; invoices</span>
                </label>
                <input
                  type="text"
                  value={formData.currentBatchNo}
                  onChange={(e) => setFormData({ ...formData, currentBatchNo: e.target.value })}
                  placeholder="e.g. T-2607025"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Mfg Date</label>
                  <input
                    type="date"
                    value={formData.currentMfgDate}
                    onChange={(e) => setFormData({ ...formData, currentMfgDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Exp Date</label>
                  <input
                    type="date"
                    value={formData.currentExpDate}
                    onChange={(e) => setFormData({ ...formData, currentExpDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors shadow-md text-center block mt-6"
              >
                {isAdding ? "Create Product Entry" : "Save Changes"}
              </button>
            </form>
          </div>
        )}
      </div>

      {historyProduct && (
        <StockHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
    </div>
  );
}

interface Movement {
  id: string;
  type: "ORDER_DEDUCTION" | "MANUAL_ADJUSTMENT" | "RESTOCK";
  delta: number;
  quantityAfter: number;
  note: string | null;
  createdAt: string;
  employee: { firstName: string; lastName: string } | null;
}

const MOVEMENT_LABEL: Record<Movement["type"], string> = {
  ORDER_DEDUCTION: "Order Sold",
  MANUAL_ADJUSTMENT: "Manual Edit",
  RESTOCK: "Restock",
};

function StockHistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`/api/products/${product.id}/movements`)
      .then((res) => setMovements(res.data.data.movements ?? []))
      .catch((err) => console.error("Failed to load stock history:", err))
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Stock Audit — {product.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Current leftover: {product.stockQty} units</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">No stock movements recorded yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0">
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Date/Time</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Type</th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">Change</th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">Balance</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      {" "}
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.type === "ORDER_DEDUCTION" ? "bg-blue-50 text-blue-700" : m.type === "RESTOCK" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {MOVEMENT_LABEL[m.type]}
                      </span>
                      {m.note && <p className="text-[10px] text-slate-400 mt-0.5">{m.note}</p>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${m.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {m.delta > 0 ? "+" : ""}{m.delta}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{m.quantityAfter}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
