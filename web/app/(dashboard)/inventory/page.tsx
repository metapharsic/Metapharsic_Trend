"use client";

import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Package,
  RefreshCw,
  X,
  ShieldAlert,
  Trash2,
  History,
  TrendingDown,
  Calculator,
  Percent,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { costBasis, type CostBasisSource } from "@/lib/pricing";
import { ProductPricingAgentsService } from "@/services/product-pricing-agents.service";

interface ProductMarginSettings {
  chemistMarginPct: number;
  stockistMarginPct: number;
  companyMarginPct: number;
  purchaseRate: number;
  autoCalculate: boolean;
}

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
  purchaseRate?: number | null;
  marginStructure?: string | null;
  marginSettings?: ProductMarginSettings | null;
  grossMarginPct?: number | null;
  /** True only when purchaseRate is a real paid cost (API-supplied). */
  costBasisExact?: boolean;
  /** Which field the cost came from, so the UI can flag an estimate. */
  costBasisSource?: CostBasisSource;
  stockValueAtCost?: number | null;
  hsnCode?: string | null;
  gstPct?: number | null;
  stockQty: number;
  therapySegment: string | null;
  currentBatchNo: string | null;
  currentMfgDate: string | null;
  currentExpDate: string | null;
  stockValue?: number;
  lastMovementAt?: string;
  forecast?: { burnRatePerDay: number; daysRemaining: number | null };
}

/**
 * What a catalog row COSTS us.
 *
 * The page must never invent a cost basis or a multiplier (the old
 * `pts * 0.6` here was exactly that). `costBasis()` in @/lib/pricing is the
 * single source of truth; the products API also returns costBasisExact /
 * costBasisSource, which we prefer when present because the API knows
 * whether purchaseRate came from the DB or was derived.
 */
function rowCost(p: Product): { value: number; exact: boolean; source: CostBasisSource } {
  const basis = costBasis(p);
  const source = p.costBasisSource ?? basis.source;
  const exact = p.costBasisExact ?? basis.source === "purchaseRate";
  return { value: basis.value, exact, source };
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
  items: { id: string; productId: string; productName: string; quantity: number; unitValue: number; estimatedValue: number; lastGivenAt: string }[];
  totalEstimatedValue: number;
}

function currency(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export default function InventoryPage() {
  const [role, setRole] = useState<string | null>(null);
  const canManage = role === "ADMIN" || role === "MD" || role === "ASM" || role === "WAREHOUSE" || (role !== "MR" && role !== "DOCTOR" && role !== "DISTRIBUTOR");
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
  const [editingStockRow, setEditingStockRow] = useState<{ id: string; employeeId: string; productName: string; quantity: number } | null>(null);
  const [editStockQty, setEditStockQty] = useState("");
  const [editStockSubmitting, setEditStockSubmitting] = useState(false);
  const [editStockError, setEditStockError] = useState("");

  // Form states for add/edit with dynamic multi-agent pricing
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    composition: string;
    strength: string;
    packSize: string;
    mrp: number;
    ptr: number;
    pts: number;
    purchaseRate: number;
    chemistMarginPct: number;
    stockistMarginPct: number;
    companyMarginPct: number;
    autoCalculate: boolean;
    anchorMode: "PURCHASE_RATE" | "MRP";
    boxRate: string;
    packUnits: string;
    hsnCode: string;
    gstPct: number;
    stockQty: number;
    therapySegment: string;
    currentBatchNo: string;
    currentMfgDate: string;
    currentExpDate: string;
  }>({
    name: "",
    sku: "",
    composition: "",
    strength: "",
    packSize: "",
    mrp: 97.22,
    ptr: 77.78,
    pts: 70,
    purchaseRate: 50,
    chemistMarginPct: 20,
    stockistMarginPct: 10,
    companyMarginPct: 40,
    autoCalculate: true,
    anchorMode: "PURCHASE_RATE",
    boxRate: "",
    packUnits: "10",
    hsnCode: "",
    gstPct: 5,
    stockQty: 0,
    therapySegment: "",
    currentBatchNo: "",
    currentMfgDate: "",
    currentExpDate: "",
  });

  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  // Manual pricing helper: Quick Chemist Margin Preset (sets PTR = MRP * (1 - Chemist%))
  const handleApplyChemistPreset = (pct: number) => {
    setFormData((prev) => {
      const chemistMarginPct = pct;
      const mrp = Number(prev.mrp) || 0;
      const ptr = mrp > 0 ? round2(mrp * (1 - pct / 100)) : prev.ptr;
      return { ...prev, chemistMarginPct, ptr, pts: ptr };
    });
  };

  // Manual Box Rate converter helper (calculates cost basis per unit from box price)
  const handleApplyBoxRate = () => {
    const boxVal = Number(formData.boxRate);
    const units = Number(formData.packUnits) || 10;
    if (boxVal > 0 && units > 0) {
      const perUnitRate = round2(boxVal / units);
      setFormData((prev) => ({ ...prev, purchaseRate: perUnitRate }));
    }
  };

  const fetchProducts = () => {
    setLoading(true);
    setError("");
    apiClient
      .get("/api/products", { params: { limit: 100 } })
      .then((res) => {
        setProducts(res.data.data.products ?? []);
      })
      .catch((err) => {
        console.error("Failed to fetch products", err);
        const msg = err?.response?.data?.error?.message || err?.response?.data?.message || "Could not load inventory catalog.";
        setError(msg);
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
    if (decodedRole === "ASM" || decodedRole === "ADMIN" || decodedRole === "MD" || decodedRole === "WAREHOUSE") {
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
      setAllocError(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to allocate stock.");
    } finally {
      setAllocSubmitting(false);
    }
  };

  const handleOpenStockEdit = (rep: MrStockRep, item: MrStockRep["items"][number]) => {
    setEditingStockRow({ id: item.id, employeeId: rep.employeeId, productName: item.productName, quantity: item.quantity });
    setEditStockQty(String(item.quantity));
    setEditStockError("");
  };

  const handleSaveStockEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockRow) return;
    const qty = Number(editStockQty);
    if (Number.isNaN(qty) || qty < 0) {
      setEditStockError("Enter a valid quantity.");
      return;
    }
    setEditStockSubmitting(true);
    setEditStockError("");
    try {
      await apiClient.patch(`/api/manager/mr-stock/${editingStockRow.id}`, { quantity: qty });
      setEditingStockRow(null);
      refreshMrStock();
    } catch (err: any) {
      setEditStockError(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to update stock.");
    } finally {
      setEditStockSubmitting(false);
    }
  };

  const handleDeleteStockRow = async (item: MrStockRep["items"][number]) => {
    if (!window.confirm(`Remove "${item.productName}" from this MR's sample stock entirely?`)) return;
    try {
      await apiClient.delete(`/api/manager/mr-stock/${item.id}`);
      refreshMrStock();
    } catch (err: any) {
      console.error("Failed to delete MR stock row", err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to remove stock row.");
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    const mrp = Number(p.mrp || 0);
    const ptr = Number(p.ptr || 0);
    const pts = Number(p.pts || 0);

    let chemistMarginPct = 20;
    let stockistMarginPct = 10;
    let companyMarginPct = 40;
    let purchaseRate = Number(p.purchaseRate || 0);
    let autoCalculate = true;
    let anchorMode: "PURCHASE_RATE" | "MRP" = "PURCHASE_RATE";

    if (p.marginSettings) {
      chemistMarginPct = p.marginSettings.chemistMarginPct;
      stockistMarginPct = p.marginSettings.stockistMarginPct;
      companyMarginPct = p.marginSettings.companyMarginPct;
      purchaseRate = p.marginSettings.purchaseRate || purchaseRate;
      autoCalculate = p.marginSettings.autoCalculate !== false;
      anchorMode = (p.marginSettings as any).anchorMode || "PURCHASE_RATE";
    } else if (p.marginStructure) {
      try {
        const ms = JSON.parse(p.marginStructure);
        chemistMarginPct = Number(ms.chemistMarginPct) || 20;
        stockistMarginPct = Number(ms.stockistMarginPct) || 10;
        companyMarginPct = Number(ms.companyMarginPct) || 40;
        purchaseRate = Number(ms.purchaseRate) || purchaseRate;
        autoCalculate = ms.autoCalculate !== false;
        anchorMode = ms.anchorMode || "PURCHASE_RATE";
      } catch {
        // fallback
      }
    }

    if (!purchaseRate && pts > 0) {
      purchaseRate = round2(pts / (1 + companyMarginPct / 100));
    }

    if (purchaseRate > 0 && pts > 0) {
      companyMarginPct = round2(((pts - purchaseRate) / purchaseRate) * 100);
    }

    if (ptr > 0 && pts > 0 && pts <= ptr) {
      stockistMarginPct = round2(((ptr - pts) / ptr) * 100);
    }
    if (mrp > 0 && ptr > 0) {
      chemistMarginPct = round2(((mrp - ptr) / mrp) * 100);
    }

    setFormData({
      name: p.name,
      sku: p.sku,
      composition: p.composition || "",
      strength: p.strength || "",
      packSize: p.packSize || "",
      mrp,
      ptr,
      pts,
      purchaseRate,
      chemistMarginPct,
      stockistMarginPct,
      companyMarginPct,
      autoCalculate,
      anchorMode,
      boxRate: "",
      packUnits: "10",
      hsnCode: p.hsnCode || "",
      gstPct: Number(p.gstPct || 5),
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
      purchaseRate: 50,
      companyMarginPct: 40,
      pts: 70,
      stockistMarginPct: 10,
      ptr: 77.78,
      chemistMarginPct: 20,
      mrp: 97.22,
      autoCalculate: true,
      anchorMode: "PURCHASE_RATE",
      boxRate: "",
      packUnits: "10",
      hsnCode: "30049099",
      gstPct: 5,
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
      const marginStructure = JSON.stringify({
        anchorMode: formData.anchorMode,
        purchaseRate: Number(formData.purchaseRate) || 0,
        companyMarginPct: Number(formData.companyMarginPct) || 40,
        stockistMarginPct: Number(formData.stockistMarginPct) || 10,
        chemistMarginPct: Number(formData.chemistMarginPct) || 20,
        autoCalculate: formData.autoCalculate,
        calculationMode: formData.autoCalculate ? "PERCENTAGE" : "MANUAL",
      });

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        price: Number(formData.ptr) || Number(formData.mrp) || 0,
        composition: formData.composition.trim() || null,
        strength: formData.strength.trim() || null,
        packSize: formData.packSize.trim() || null,
        mrp: Number(formData.mrp) || 0,
        ptr: Number(formData.ptr) || 0,
        pts: Number(formData.pts) || 0,
        purchaseRate: Number(formData.purchaseRate) || 0,
        marginStructure,
        hsnCode: formData.hsnCode.trim() || null,
        gstPct: Number(formData.gstPct) || null,
        stockQty: Number(formData.stockQty) || 0,
        therapySegment: formData.therapySegment.trim() || null,
        currentBatchNo: formData.currentBatchNo.trim() || null,
        currentMfgDate: formData.currentMfgDate ? formData.currentMfgDate : null,
        currentExpDate: formData.currentExpDate ? formData.currentExpDate : null,
      };

      if (isAdding) {
        await apiClient.post("/api/products", payload);
        setSuccess("Product added to catalog with multi-agent margin structure.");
        setIsAdding(false);
      } else if (editingProduct) {
        await apiClient.put(`/api/products/${editingProduct.id}`, payload);
        setSuccess("Product catalog pricing and margin structure saved.");
        setEditingProduct(null);
      }
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to save product details.";
      setError(msg);
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
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || `Failed to delete product "${name}".`;
      setError(msg);
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
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenStockEdit(rep, it)}
                                  className="p-1.5 hover:bg-slate-200 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-400"
                                  title="Edit quantity"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteStockRow(it)}
                                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer text-slate-400"
                                  title="Remove from MR's stock"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
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
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Purchase Rate (cost)</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Gross Margin (% of PTR)</th>
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
                    <td colSpan={13} className="px-4 py-12 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const cost = rowCost(p);
                    // Gross margin here is a MARGIN ON THE SELLING PRICE (PTR),
                    // i.e. (PTR - cost) / PTR. It is NOT the markup on cost that
                    // drives the pricing ladder - the two are different numbers.
                    const ptrValue = Number(p.ptr || 0);
                    const grossMarginOnPtrPct =
                      ptrValue > 0 && cost.value > 0
                        ? Math.round(((ptrValue - cost.value) / ptrValue) * 1000) / 10
                        : null;
                    return (
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
                      <td className="px-4 py-3 text-right font-semibold text-slate-600">
                        {cost.value > 0 ? (
                          <>
                            ₹{cost.value.toFixed(2)}
                            {!cost.exact && (
                              <span
                                className="ml-1 inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 align-middle"
                                title={`Estimated: no purchase rate is recorded, so this uses ${cost.source} as a proxy for cost.`}
                              >
                                est.
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300" title="No purchase rate, PTS, PTR or price is set for this product.">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {grossMarginOnPtrPct === null ? (
                          <span className="text-slate-300" title="Needs a PTR and a cost basis.">—</span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              cost.exact
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                            title={
                              cost.exact
                                ? "(PTR - purchase rate) / PTR - margin on the PTR selling price."
                                : `Estimate: (PTR - ${cost.source}) / PTR. No purchase rate is recorded for this product.`
                            }
                          >
                            {grossMarginOnPtrPct.toFixed(1)}%{cost.exact ? "" : " est."}
                          </span>
                        )}
                      </td>
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
                    );
                  })
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

              {/* Manual Medicine Pricing Inputs */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-lg bg-indigo-100 text-indigo-700">
                      <Calculator size={14} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">
                        Manual Medicine Pricing
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Set MRP, PTR, &amp; Purchase Rate manually
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Manual Entry
                  </span>
                </div>

                {/* Quick Chemist Margin Preset Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-600">Chemist / Retailer Margin Preset:</span>
                    <span className="font-bold text-indigo-600">
                      {formData.mrp > 0 ? round2(((formData.mrp - formData.ptr) / formData.mrp) * 100) : 0}% off MRP
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[15, 20, 25, 30].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleApplyChemistPreset(pct)}
                        className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                          formData.chemistMarginPct === pct
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {pct}% {pct === 20 && "(Std)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 Manual Numeric Fields: MRP, PTR, Purchase Rate */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="space-y-1 bg-white p-2 rounded-xl border border-indigo-200 shadow-xs">
                    <label className="font-bold text-indigo-950 text-[10px] block">
                      MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.mrp || ""}
                      onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full bg-indigo-50/50 border border-indigo-300 rounded-lg px-2 py-1 text-right font-black text-xs text-indigo-900 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[8px] text-slate-400 block text-right">Max Retail</span>
                  </div>

                  <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                    <label className="font-bold text-slate-800 text-[10px] block">
                      PTR (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.ptr || ""}
                      onChange={(e) => setFormData({ ...formData, ptr: Number(e.target.value), pts: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-right font-black text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[8px] text-slate-400 block text-right">To Retailer</span>
                  </div>

                  <div className="space-y-1 bg-white p-2 rounded-xl border border-emerald-200 shadow-xs">
                    <label className="font-bold text-emerald-950 text-[10px] block">
                      Cost Basis (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.purchaseRate || ""}
                      onChange={(e) => setFormData({ ...formData, purchaseRate: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-2 py-1 text-right font-black text-xs text-emerald-900 focus:outline-none focus:border-emerald-600"
                    />
                    <span className="text-[8px] text-emerald-600 font-medium block text-right">Purchase Rate</span>
                  </div>
                </div>

                {/* Box Rate to Strip Converter Helper */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                  <span className="text-slate-600 font-medium">Box/Pack Rate:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Box ₹"
                      value={formData.boxRate}
                      onChange={(e) => setFormData({ ...formData, boxRate: e.target.value })}
                      className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-right font-medium text-[10px]"
                    />
                    <span className="text-slate-400">÷</span>
                    <input
                      type="number"
                      placeholder="Units"
                      value={formData.packUnits}
                      onChange={(e) => setFormData({ ...formData, packUnits: e.target.value })}
                      className="w-12 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-medium text-[10px]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBoxRate}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[9px] cursor-pointer"
                    >
                      Set Cost
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual Inventory Stock & Batch Details */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
                      <Package size={14} />
                    </div>
                    <span className="font-bold text-slate-800 text-xs">
                      Medicine Inventory &amp; Batch Setup
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                    Stock &amp; Batches
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Stock Qty (Warehouse)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.stockQty}
                      onChange={(e) => setFormData({ ...formData, stockQty: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Batch Number</label>
                    <input
                      type="text"
                      value={formData.currentBatchNo}
                      onChange={(e) => setFormData({ ...formData, currentBatchNo: e.target.value })}
                      placeholder="e.g. B-2026-09"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Manufacturing Date</label>
                    <input
                      type="date"
                      value={formData.currentMfgDate}
                      onChange={(e) => setFormData({ ...formData, currentMfgDate: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.currentExpDate}
                      onChange={(e) => setFormData({ ...formData, currentExpDate: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                      placeholder="e.g. 30049099"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">GST Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={formData.gstPct}
                      onChange={(e) => setFormData({ ...formData, gstPct: Number(e.target.value) })}
                      placeholder="e.g. 5"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Multi-Agent Live Status Telemetry Grid */}
              <div className="p-3 bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl space-y-2.5 shadow-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400 animate-pulse" />
                    <span className="font-bold text-xs">Multi-Agent Status Telemetry</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    4 Agents Active
                  </span>
                </div>

                {/* 2x2 Agent Telemetry Grid */}
                {(() => {
                  const agentReport = ProductPricingAgentsService.calculatePricing({
                    mrp: formData.mrp,
                    ptr: formData.ptr,
                    purchaseRate: formData.purchaseRate,
                    chemistMarginPct: formData.chemistMarginPct,
                    autoCalculate: false,
                  });

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {agentReport.agents.map((ag) => (
                          <div
                            key={ag.id}
                            className="p-2 rounded-xl bg-white/10 border border-white/10 space-y-1 backdrop-blur-xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-white text-[10px] truncate">{ag.name}</span>
                              <span
                                className={`text-[8px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                                  ag.status === "ONLINE" || ag.status === "SYNCED" || ag.status === "AUDITED"
                                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                                    : "bg-rose-500/30 text-rose-300 border border-rose-400/40"
                                }`}
                              >
                                {ag.status}
                              </span>
                            </div>
                            <p className="text-[8.5px] text-slate-300 leading-tight line-clamp-2">{ag.summary}</p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1">
                          {agentReport.hierarchyValid ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Hierarchy Valid: Cost &lt; PTR &lt; MRP
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <AlertTriangle size={12} /> Inverted Price Hazard
                            </span>
                          )}
                        </div>
                        <span className="text-slate-300 font-medium">
                          Valuation: <strong className="text-amber-300">₹{(formData.stockQty * formData.purchaseRate).toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                    </>
                  );
                })()}
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

      {editingStockRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Edit MR Stock — {editingStockRow.productName}</h2>
              <button onClick={() => setEditingStockRow(null)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveStockEdit} className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">New Quantity</label>
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={editStockQty}
                  onChange={(e) => setEditStockQty(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {editStockError && <p className="text-rose-600">{editStockError}</p>}
              <button
                type="submit"
                disabled={editStockSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                {editStockSubmitting ? "Saving..." : "Save Quantity"}
              </button>
            </form>
          </div>
        </div>
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
