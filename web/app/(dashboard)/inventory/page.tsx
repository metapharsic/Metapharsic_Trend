"use client";

import React, { useEffect, useState } from "react";
import { Search, Plus, Edit2, Package, RefreshCw, X, ShieldAlert, Trash2 } from "lucide-react";
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
}

interface MySample {
  productId: string;
  productName: string;
  quantity: number;
}

export default function InventoryPage() {
  const [role, setRole] = useState<string | null>(null);
  const canManage = role !== "MR";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mySamples, setMySamples] = useState<MySample[]>([]);
  const [mySamplesLoading, setMySamplesLoading] = useState(false);

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
  }, []);

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
              {mySamples.length} product{mySamples.length === 1 ? "" : "s"} in hand
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Product</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Qty With Me</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mySamplesLoading ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto" />
                    </td>
                  </tr>
                ) : mySamples.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-400 font-medium">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Current Batch</th>
                  {canManage && <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
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
    </div>
  );
}
