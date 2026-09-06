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

  // Real-time Multi-Agent Pricing Formula: Calculates directly ON Purchase Rate (Cost-Up) or reverse from MRP
  const computePricing = (
    mode: "PURCHASE_RATE" | "MRP",
    baseVal: number,
    companyPct: number,
    stockistPct: number,
    chemistPct: number
  ) => {
    let purchaseRateVal = 0;
    let ptsVal = 0;
    let ptrVal = 0;
    let mrpVal = 0;

    if (mode === "PURCHASE_RATE") {
      // 1. COST-UP PRICING: The percentage is calculated directly ON the Purchase Rate
      purchaseRateVal = round2(baseVal);
      // PTS = Purchase Rate + (Company Margin % of Purchase Rate)
      ptsVal = round2(purchaseRateVal * (1 + companyPct / 100));
      // Stockist Margin % off PTR: PTR = PTS / (1 - Stockist Margin %)
      ptrVal = round2(ptsVal / Math.max(0.01, 1 - stockistPct / 100));
      // Chemist Margin % off MRP: MRP = PTR / (1 - Chemist Margin %)
      mrpVal = round2(ptrVal / Math.max(0.01, 1 - chemistPct / 100));
    } else {
      // 2. REVERSE PRICING: Top-Down from MRP
      mrpVal = round2(baseVal);
      ptrVal = round2(mrpVal * (1 - chemistPct / 100));
      ptsVal = round2(ptrVal * (1 - stockistPct / 100));
      purchaseRateVal = round2(ptsVal / Math.max(0.01, 1 + companyPct / 100));
    }

    return {
      purchaseRate: purchaseRateVal,
      pts: ptsVal,
      ptr: ptrVal,
      mrp: mrpVal,
    };
  };

  const handlePurchaseRateChange = (newRate: number) => {
    if (formData.autoCalculate && formData.anchorMode === "PURCHASE_RATE") {
      const { pts, ptr, mrp } = computePricing(
        "PURCHASE_RATE",
        newRate,
        formData.companyMarginPct,
        formData.stockistMarginPct,
        formData.chemistMarginPct
      );
      setFormData((prev) => ({ ...prev, purchaseRate: newRate, pts, ptr, mrp }));
    } else {
      setFormData((prev) => ({ ...prev, purchaseRate: newRate }));
    }
  };

  const handleApplyBoxRate = () => {
    const boxVal = Number(formData.boxRate);
    const units = Number(formData.packUnits) || 10;
    if (boxVal > 0 && units > 0) {
      const perUnitRate = round2(boxVal / units);
      handlePurchaseRateChange(perUnitRate);
    }
  };

  const handleCompanyMarginChange = (pct: number) => {
    if (formData.autoCalculate) {
      if (formData.anchorMode === "PURCHASE_RATE") {
        const { pts, ptr, mrp } = computePricing(
          "PURCHASE_RATE",
          formData.purchaseRate,
          pct,
          formData.stockistMarginPct,
          formData.chemistMarginPct
        );
        setFormData((prev) => ({ ...prev, companyMarginPct: pct, pts, ptr, mrp }));
      } else {
        const { purchaseRate } = computePricing(
          "MRP",
          formData.mrp,
          pct,
          formData.stockistMarginPct,
          formData.chemistMarginPct
        );
        setFormData((prev) => ({ ...prev, companyMarginPct: pct, purchaseRate }));
      }
    } else {
      setFormData((prev) => ({ ...prev, companyMarginPct: pct }));
    }
  };

  const handleStockistMarginChange = (pct: number) => {
    if (formData.autoCalculate) {
      if (formData.anchorMode === "PURCHASE_RATE") {
        const { ptr, mrp } = computePricing(
          "PURCHASE_RATE",
          formData.purchaseRate,
          formData.companyMarginPct,
          pct,
          formData.chemistMarginPct
        );
        setFormData((prev) => ({ ...prev, stockistMarginPct: pct, ptr, mrp }));
      } else {
        const { pts, purchaseRate } = computePricing(
          "MRP",
          formData.mrp,
          formData.companyMarginPct,
          pct,
          formData.chemistMarginPct
        );
        setFormData((prev) => ({ ...prev, stockistMarginPct: pct, pts, purchaseRate }));
      }
    } else {
      setFormData((prev) => ({ ...prev, stockistMarginPct: pct }));
    }
  };

  const handleChemistMarginChange = (pct: number) => {
    if (formData.autoCalculate) {
      if (formData.anchorMode === "PURCHASE_RATE") {
        const { mrp } = computePricing(
          "PURCHASE_RATE",
          formData.purchaseRate,
          formData.companyMarginPct,
          formData.stockistMarginPct,
          pct
        );
        setFormData((prev) => ({ ...prev, chemistMarginPct: pct, mrp }));
      } else {
        const { ptr, pts, purchaseRate } = computePricing(
          "MRP",
          formData.mrp,
          formData.companyMarginPct,
          formData.stockistMarginPct,
          pct
        );
        setFormData((prev) => ({ ...prev, chemistMarginPct: pct, ptr, pts, purchaseRate }));
      }
    } else {
      setFormData((prev) => ({ ...prev, chemistMarginPct: pct }));
    }
  };

  const handleMrpChange = (newMrp: number) => {
    if (formData.autoCalculate && formData.anchorMode === "MRP") {
      const { ptr, pts, purchaseRate } = computePricing(
        "MRP",
        newMrp,
        formData.companyMarginPct,
        formData.stockistMarginPct,
        formData.chemistMarginPct
      );
      setFormData((prev) => ({ ...prev, mrp: newMrp, ptr, pts, purchaseRate }));
    } else {
      setFormData((prev) => ({ ...prev, mrp: newMrp }));
    }
  };

  const handleManualPtsChange = (val: number) => {
    const impliedCompanyPct = formData.purchaseRate > 0 ? round2(((val - formData.purchaseRate) / formData.purchaseRate) * 100) : 40;
    if (formData.autoCalculate) {
      const ptr = round2(val / Math.max(0.01, 1 - formData.stockistMarginPct / 100));
      const mrp = round2(ptr / Math.max(0.01, 1 - formData.chemistMarginPct / 100));
      setFormData((prev) => ({ ...prev, pts: val, ptr, mrp, companyMarginPct: impliedCompanyPct }));
    } else {
      setFormData((prev) => ({ ...prev, pts: val, companyMarginPct: impliedCompanyPct }));
    }
  };

  const handleManualPtrChange = (val: number) => {
    const impliedStockistPct = val > 0 ? round2(((val - formData.pts) / val) * 100) : 10;
    if (formData.autoCalculate) {
      const mrp = round2(val / Math.max(0.01, 1 - formData.chemistMarginPct / 100));
      setFormData((prev) => ({ ...prev, ptr: val, mrp, stockistMarginPct: impliedStockistPct }));
    } else {
      setFormData((prev) => ({ ...prev, ptr: val, stockistMarginPct: impliedStockistPct }));
    }
  };

  const handleManualPurchaseRateChange = (val: number) => {
    const impliedCompanyPct = val > 0 ? round2(((formData.pts - val) / val) * 100) : 40;
    setFormData((prev) => ({ ...prev, purchaseRate: val, companyMarginPct: impliedCompanyPct }));
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

              {/* Commercial Pricing & Multi-Agent Margin Engine */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
                {/* Header & Mode Selector */}
                <div className="border-b border-slate-200/70 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
                        <Calculator size={14} />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">
                          Commercial Pricing Engine (Multi-Agent)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formData.anchorMode === "PURCHASE_RATE"
                            ? "Cost-Up: Margins calculated directly ON Purchase Rate"
                            : "Reverse Mode: Derived Top-Down from MRP"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextAuto = !formData.autoCalculate;
                        setFormData((prev) => {
                          if (nextAuto) {
                            const { pts, ptr, mrp, purchaseRate } = computePricing(
                              prev.anchorMode,
                              prev.anchorMode === "PURCHASE_RATE" ? prev.purchaseRate : prev.mrp,
                              prev.companyMarginPct,
                              prev.stockistMarginPct,
                              prev.chemistMarginPct
                            );
                            return { ...prev, autoCalculate: true, pts, ptr, mrp, purchaseRate };
                          }
                          return { ...prev, autoCalculate: false };
                        });
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        formData.autoCalculate
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm"
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      }`}
                    >
                      <Sparkles size={11} className={formData.autoCalculate ? "text-emerald-600" : "text-slate-400"} />
                      <span>Auto-Calculate: {formData.autoCalculate ? "ON" : "OFF"}</span>
                    </button>
                  </div>

                  {/* Anchor Mode Direction Toggle */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, anchorMode: "PURCHASE_RATE" }));
                        handlePurchaseRateChange(formData.purchaseRate);
                      }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        formData.anchorMode === "PURCHASE_RATE"
                          ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      🎯 Calculate on Purchase Rate (Cost-Up)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, anchorMode: "MRP" }));
                        handleMrpChange(formData.mrp);
                      }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        formData.anchorMode === "MRP"
                          ? "bg-white text-indigo-700 shadow-sm border border-indigo-200"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      🔄 Reverse from MRP (Top-Down)
                    </button>
                  </div>
                </div>

                {/* 1. FOUNDATIONAL INPUT: Purchase Rate (Procurement / Cost Basis) */}
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-black text-[9px] flex items-center justify-center">1</span>
                        <label className="font-bold text-emerald-950 text-xs">
                          Purchase Rate (Manufacturer Cost Basis)
                        </label>
                      </div>
                      <p className="text-[10px] text-emerald-700 pl-5.5">
                        Procurement cost per unit / strip — margins are calculated on this base
                      </p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                      Primary Base
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-emerald-700 font-bold text-base">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0.01}
                      value={formData.purchaseRate || ""}
                      onChange={(e) => handlePurchaseRateChange(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-white border-2 border-emerald-400 rounded-xl pl-8 pr-3 py-2.5 text-slate-900 font-black text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                    />
                  </div>

                  {/* Optional Box Rate to Strip Rate Converter */}
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <span className="text-emerald-900 font-medium">Or enter Box / Pack Rate:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Box ₹"
                        value={formData.boxRate}
                        onChange={(e) => setFormData({ ...formData, boxRate: e.target.value })}
                        className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-right font-medium text-[10px]"
                      />
                      <span className="text-slate-400">÷</span>
                      <input
                        type="number"
                        placeholder="Units"
                        value={formData.packUnits}
                        onChange={(e) => setFormData({ ...formData, packUnits: e.target.value })}
                        className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-medium text-[10px]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBoxRate}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[9px] transition-colors cursor-pointer"
                      >
                        Apply Rate
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. PTS (PRICE TO STOCKIST) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center">2</span>
                      <label className="font-bold text-slate-800 text-xs">
                        PTS (Price to Stockist)
                      </label>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Company markup over cost: +₹{round2(formData.pts - formData.purchaseRate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium text-slate-600">Company Selling Rate to Stockist:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.pts || ""}
                        onChange={(e) => handleManualPtsChange(Number(e.target.value))}
                        className="w-28 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-right font-black text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. STOCKIST MARGIN (% ON PTR) -> PTR */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center">3</span>
                      <label className="font-bold text-slate-800 text-xs">
                        Stockist / Distributor Margin (% on PTR)
                      </label>
                    </div>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {formData.stockistMarginPct}% off PTR
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[8, 10, 12, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleStockistMarginChange(pct)}
                        className={`flex-1 py-1.5 px-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                          formData.stockistMarginPct === pct
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {pct}% {pct === 10 && "(Std)"}
                      </button>
                    ))}
                    <div className="w-16 relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={formData.stockistMarginPct}
                        onChange={(e) => handleStockistMarginChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-[11px] text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700">Calculated PTR (Price to Retailer):</span>
                      <p className="text-[9px] text-indigo-600 font-semibold">
                        Stockist spread: +₹{round2(formData.ptr - formData.pts)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.ptr || ""}
                        onChange={(e) => handleManualPtrChange(Number(e.target.value))}
                        className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-right font-black text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. CHEMIST MARGIN (% ON MRP) -> MRP */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center">4</span>
                      <label className="font-bold text-slate-800 text-xs">
                        Chemist / Retailer Discount (% on MRP)
                      </label>
                    </div>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {formData.chemistMarginPct}% off MRP
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[15, 20, 25, 30].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleChemistMarginChange(pct)}
                        className={`flex-1 py-1.5 px-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                          formData.chemistMarginPct === pct
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {pct}% {pct === 20 && "(Std)"}
                      </button>
                    ))}
                    <div className="w-16 relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="90"
                        value={formData.chemistMarginPct}
                        onChange={(e) => handleChemistMarginChange(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-[11px] text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700">Maximum Retail Price (MRP):</span>
                      <p className="text-[9px] text-indigo-600 font-semibold">
                        Retailer spread: +₹{round2(formData.mrp - formData.ptr)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.mrp || ""}
                        onChange={(e) => handleMrpChange(Number(e.target.value))}
                        className="w-24 bg-indigo-50/60 border border-indigo-300 rounded-lg px-2 py-1 text-right font-black text-xs text-indigo-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Margin Waterfall & Multi-Agent Verification */}
                <div className="bg-gradient-to-br from-indigo-50/80 to-slate-50 p-3 rounded-xl border border-indigo-100 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800">Commercial Waterfall (Cost ➔ MRP)</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      Gross Margin (% of MRP): {formData.mrp > 0 ? Math.round(((formData.mrp - formData.purchaseRate) / formData.mrp) * 1000) / 10 : 0}%
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-xs">
                      <div className="text-emerald-700 font-bold text-[9px] uppercase">1. Cost Basis</div>
                      <div className="font-black text-emerald-800 text-xs">₹{Number(formData.purchaseRate || 0).toFixed(2)}</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">Procurement</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
                      <div className="text-slate-500 font-bold text-[9px] uppercase">2. PTS</div>
                      <div className="font-black text-slate-800 text-xs">₹{Number(formData.pts || 0).toFixed(2)}</div>
                      <div className="text-[8px] text-emerald-600 font-bold mt-0.5">Selling Rate</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
                      <div className="text-slate-500 font-bold text-[9px] uppercase">3. PTR</div>
                      <div className="font-black text-slate-800 text-xs">₹{Number(formData.ptr || 0).toFixed(2)}</div>
                      <div className="text-[8px] text-indigo-600 font-bold mt-0.5">+{formData.stockistMarginPct}% Stockist</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-200 shadow-xs">
                      <div className="text-indigo-700 font-bold text-[9px] uppercase">4. MRP</div>
                      <div className="font-black text-indigo-900 text-xs">₹{Number(formData.mrp || 0).toFixed(2)}</div>
                      <div className="text-[8px] text-indigo-600 font-bold mt-0.5">+{formData.chemistMarginPct}% Chemist</div>
                    </div>
                  </div>

                  {/* Multi-Agent Orchestration & Audit Status */}
                  <div className="pt-2 border-t border-indigo-100/90 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      {formData.purchaseRate < formData.pts && formData.pts < formData.ptr && formData.ptr < formData.mrp ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Hierarchy 100% Compliant: Cost &lt; PTS &lt; PTR &lt; MRP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <AlertTriangle size={13} className="text-rose-500" />
                          Hazard: Inverted rate detected! Check margins.
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-400">4 Agents Active</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      <div className="p-1.5 bg-white/90 rounded border border-slate-200/80 text-slate-600">
                        <span className="font-bold text-slate-800">Company profit at PTS, over cost:</span> +₹
                        {round2(formData.pts - formData.purchaseRate)} / unit
                        {formData.purchaseRate > 0 && (
                          <>
                            {" "}
                            (
                            {round2(((formData.pts - formData.purchaseRate) / formData.purchaseRate) * 100)}% markup on
                            cost)
                          </>
                        )}
                      </div>
                      <div className="p-1.5 bg-white/90 rounded border border-slate-200/80 text-slate-600">
                        <span className="font-bold text-slate-800">Warehouse Value at Cost:</span> ₹{round2(formData.stockQty * formData.purchaseRate).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
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
