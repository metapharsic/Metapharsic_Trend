"use client";

import React, { useEffect, useRef, useState } from "react";
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
  TrendingUp,
  Calculator,
  Percent,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Eye,
  Layers,
  Download,
  ChevronDown,
  Printer,
  FileText,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import { ScrollSearchBar } from "@/components/ui/scroll-search-bar";
import { costBasis, type CostBasisSource } from "@/lib/pricing";
import { getMedicineReference, computeShelfLife, type ClinicalReference, type ShelfLifeStatus } from "@/lib/medicine-reference";
import {
  downloadInventoryExcel,
  downloadInventoryHtml,
  downloadInventoryCsv,
  downloadInventoryJson,
  printInventoryPdf,
  downloadSingleMedicineExcel,
  downloadSingleMedicineHtml,
  downloadSingleMedicineJson,
  printSingleMedicinePdf,
} from "@/lib/inventory-exports";
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
  unitProfit?: number;
  potentialStockProfit?: number;
  stockBoxes?: number;
  earliestStockQty?: number;
  mrSampleQty?: number;
  profitAnalytics?: {
    invoicedCount: number;
    invoicedBilledQty: number;
    invoicedFreeQty: number;
    freeRatioPct: number;
    realizedRevenue: number;
    realizedCost: number;
    billedCostOnly: number;
    freeCostBurden: number;
    realizedProfit: number;
    realizedMarginPct: number | null;
    exactCost: boolean;
  };
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

function currencyExact(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
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

interface DownloadFormatDropdownProps {
  buttonLabel: string;
  scopeNote: string;
  compact?: boolean;
  onExcel: () => Promise<void> | void;
  onCsv?: () => void;
  onHtml: () => void;
  onPdf: () => void;
  onJson: () => void;
}

function DownloadFormatDropdown({
  buttonLabel,
  scopeNote,
  compact = false,
  onExcel,
  onCsv,
  onHtml,
  onPdf,
  onJson,
}: DownloadFormatDropdownProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open]);

  const runAction = async (fn: () => Promise<void> | void) => {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const options: Array<{
    label: string;
    hint: string;
    icon: React.ReactNode;
    accent: string;
    action: () => void;
  }> = [
    {
      label: "Excel Workbook (.xlsx)",
      hint: "Live formulas, Stock & Profit sheets",
      icon: <FileSpreadsheet size={15} />,
      accent: "text-emerald-600 bg-emerald-50",
      action: () => void runAction(onExcel),
    },
    ...(onCsv
      ? [
          {
            label: "CSV Spreadsheet (.csv)",
            hint: "Flat UTF-8 table for Excel / Sheets",
            icon: <FileText size={15} />,
            accent: "text-indigo-600 bg-indigo-50",
            action: () => void runAction(onCsv),
          },
        ]
      : []),
    {
      label: "Styled HTML Report (.html)",
      hint: "Executive report openable in any browser",
      icon: <FileText size={15} />,
      accent: "text-sky-600 bg-sky-50",
      action: () => void runAction(onHtml),
    },
    {
      label: "Print / Save as PDF",
      hint: "Print-formatted A4 landscape summary",
      icon: <Printer size={15} />,
      accent: "text-amber-600 bg-amber-50",
      action: () => void runAction(onPdf),
    },
    {
      label: "JSON Audit Snapshot (.json)",
      hint: "Structured backup & clinical payload",
      icon: <FileJson size={15} />,
      accent: "text-slate-600 bg-slate-100",
      action: () => void runAction(onJson),
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-600/20 ${
          compact ? "px-3 py-1.5" : "px-3.5 py-2.5"
        }`}
        title={scopeNote}
      >
        <Download size={compact ? 13 : 15} />
        <span>{busy ? "Preparing..." : buttonLabel}</span>
        <ChevronDown size={compact ? 12 : 14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 overflow-hidden"
        >
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/80">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Export Format</p>
            <p className="text-[11px] font-medium text-slate-600 mt-0.5">{scopeNote}</p>
          </div>
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                role="menuitem"
                onClick={opt.action}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <span className={`p-1.5 rounded-lg shrink-0 ${opt.accent}`}>{opt.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-800 leading-tight">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [role, setRole] = useState<string | null>(null);
  const canManage = role === "ADMIN" || role === "MD" || role === "ASM" || role === "WAREHOUSE" || (role !== "MR" && role !== "DOCTOR" && role !== "DISTRIBUTOR");
  // Purchase rate, margins, stock value/level, forecast, batch & audit are commercially
  // confidential -- only ADMIN sees them here, in both the header and every row.
  const isAdmin = role === "ADMIN";
  const tableColSpan = 4 + (isAdmin ? 8 : 0) + (canManage ? 1 : 0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [inspectProduct, setInspectProduct] = useState<Product | null>(null);
  const [catalogView, setCatalogView] = useState<"cards" | "table">("cards");
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
    purchaseRate: 50,
    chemistMarginPct: 20,
    stockistMarginPct: 0,
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
      return { ...prev, chemistMarginPct, ptr };
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

    let chemistMarginPct = 20;
    const stockistMarginPct = 0;
    let companyMarginPct = 40;
    let purchaseRate = Number(p.purchaseRate || 0);
    let autoCalculate = true;
    let anchorMode: "PURCHASE_RATE" | "MRP" = "PURCHASE_RATE";

    if (p.marginSettings) {
      chemistMarginPct = p.marginSettings.chemistMarginPct;
      companyMarginPct = p.marginSettings.companyMarginPct;
      purchaseRate = p.marginSettings.purchaseRate || purchaseRate;
      autoCalculate = p.marginSettings.autoCalculate !== false;
      anchorMode = (p.marginSettings as any).anchorMode || "PURCHASE_RATE";
    } else if (p.marginStructure) {
      try {
        const ms = JSON.parse(p.marginStructure);
        chemistMarginPct = Number(ms.chemistMarginPct) || 20;
        companyMarginPct = Number(ms.companyMarginPct) || 40;
        purchaseRate = Number(ms.purchaseRate) || purchaseRate;
        autoCalculate = ms.autoCalculate !== false;
        anchorMode = ms.anchorMode || "PURCHASE_RATE";
      } catch {
        // fallback
      }
    }

    if (!purchaseRate && ptr > 0) {
      purchaseRate = round2(ptr / (1 + companyMarginPct / 100));
    }

    if (purchaseRate > 0 && ptr > 0) {
      companyMarginPct = round2(((ptr - purchaseRate) / purchaseRate) * 100);
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
      stockistMarginPct: 0,
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
        stockistMarginPct: 0,
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
        pts: Number(formData.ptr) || 0,
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

  const portfolioSummary = isAdmin
    ? products.reduce(
        (acc, p) => {
          const cost = Number(p.stockValueAtCost ?? (p.stockQty * rowCost(p).value));
          const stockVal = Number(p.stockValue ?? (p.stockQty * Number(p.ptr || p.price || 0)));
          const potentialProfit = Number(p.potentialStockProfit ?? stockVal - cost);
          const pa = p.profitAnalytics;
          acc.totalStrips += p.stockQty;
          acc.totalBoxes += Number(p.stockBoxes ?? p.stockQty / 10);
          acc.totalSamples += Number(p.mrSampleQty ?? 0);
          acc.totalStockCost += cost;
          acc.totalStockValue += stockVal;
          acc.totalPotentialProfit += potentialProfit;
          acc.realizedRevenue += Number(pa?.realizedRevenue ?? 0);
          acc.realizedCost += Number(pa?.realizedCost ?? 0);
          acc.realizedProfit += Number(pa?.realizedProfit ?? 0);
          acc.totalBilledSold += Number(pa?.invoicedBilledQty ?? 0);
          acc.totalFreeGiven += Number(pa?.invoicedFreeQty ?? 0);
          if (p.stockQty <= 50) acc.lowStockCount += 1;
          return acc;
        },
        {
          totalStrips: 0,
          totalBoxes: 0,
          totalSamples: 0,
          totalStockCost: 0,
          totalStockValue: 0,
          totalPotentialProfit: 0,
          realizedRevenue: 0,
          realizedCost: 0,
          realizedProfit: 0,
          totalBilledSold: 0,
          totalFreeGiven: 0,
          lowStockCount: 0,
        }
      )
    : null;

  const exportProductsList = filteredProducts.length > 0 ? filteredProducts : products;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/90 rounded-2xl p-6 shadow-lg border border-slate-800 text-white space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start gap-3.5">
            <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <Package size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-display font-bold tracking-tight">Central Product Inventory</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                  PTR Billing Only
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Know every medicine&apos;s formula, stock (strips &amp; boxes), PTR pricing, and real profit after free schemes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={fetchProducts}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh inventory list"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {products.length > 0 && (
              <DownloadFormatDropdown
                buttonLabel="Download Report"
                scopeNote={
                  isAdmin
                    ? `${exportProductsList.length} medicine${exportProductsList.length === 1 ? "" : "s"} · Full Stock, Clinical & Profit Analysis`
                    : `${exportProductsList.length} medicine${exportProductsList.length === 1 ? "" : "s"} · Catalog & Clinical Dossier`
                }
                onExcel={() => downloadInventoryExcel(exportProductsList, isAdmin)}
                onCsv={() => downloadInventoryCsv(exportProductsList, isAdmin)}
                onHtml={() => downloadInventoryHtml(exportProductsList, isAdmin)}
                onPdf={() => printInventoryPdf(exportProductsList, isAdmin)}
                onJson={() => downloadInventoryJson(exportProductsList, isAdmin)}
              />
            )}
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-indigo-600/25"
              >
                <Plus size={16} /> Add Product
              </button>
            )}
          </div>
        </div>

        {/* Crisp live banner status strip */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-200 font-semibold">
            {products.length} Active Medicine{products.length === 1 ? "" : "s"}
          </span>
          {searchQuery.trim() && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 font-semibold">
              Filtered View: {filteredProducts.length} shown (exports match filter)
            </span>
          )}
          {isAdmin && portfolioSummary && (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-200 font-semibold">
                {portfolioSummary.totalStrips.toLocaleString("en-IN")} Strips ({portfolioSummary.totalBoxes.toFixed(1)} Boxes)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                Realized Profit: {currency(portfolioSummary.realizedProfit)}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold">
                Potential Stock Profit @ PTR: {currency(portfolioSummary.totalPotentialProfit)}
              </span>
              {portfolioSummary.lowStockCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-200 font-bold">
                  {portfolioSummary.lowStockCount} Low Stock Alert{portfolioSummary.lowStockCount === 1 ? "" : "s"}
                </span>
              )}
            </>
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

      {/* Admin/MD Portfolio Profit Strip & Central Product Inventory appear first (MR allocation panels sit cleanly below) */}
      {/* Admin Executive Profit & Valuation Overview */}
      {isAdmin && portfolioSummary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Warehouse Stock</span>
                <Layers size={14} className="text-indigo-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                {portfolioSummary.totalStrips.toLocaleString("en-IN")} <span className="text-xs font-semibold text-slate-500">strips</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {portfolioSummary.totalBoxes.toFixed(1)} boxes · MR samples: {portfolioSummary.totalSamples.toLocaleString("en-IN")}
                {portfolioSummary.lowStockCount > 0 && (
                  <span className="ml-1.5 text-rose-600 font-bold">· {portfolioSummary.lowStockCount} low</span>
                )}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Stock Cost Outlay</span>
                <Package size={14} className="text-slate-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                {currencyExact(portfolioSummary.totalStockCost)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Capital at purchase cost
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <span>Stock Profit (@ PTR)</span>
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <p className="text-xl font-black text-emerald-700 mt-1 tabular-nums">
                {currencyExact(portfolioSummary.totalPotentialProfit)}
              </p>
              <p className="text-[11px] text-emerald-700/80 mt-1 tabular-nums">
                Sell Value @ PTR: {currencyExact(portfolioSummary.totalStockValue)}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Invoiced Sales (Excl. GST)</span>
                <Calculator size={14} className="text-indigo-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                {currencyExact(portfolioSummary.realizedRevenue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {portfolioSummary.totalBilledSold.toLocaleString("en-IN")} billed + {portfolioSummary.totalFreeGiven.toLocaleString("en-IN")} free strips
              </p>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                <span>Realized Net Profit</span>
                <Sparkles size={14} className="text-amber-400" />
              </div>
              <p className={`text-xl font-black mt-1 tabular-nums ${
                portfolioSummary.realizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {currencyExact(portfolioSummary.realizedProfit)}
              </p>
              <p className="text-[11px] text-slate-300 mt-1 tabular-nums">
                Margin:{" "}
                <strong className="text-white">
                  {portfolioSummary.realizedRevenue > 0
                    ? `${((portfolioSummary.realizedProfit / portfolioSummary.realizedRevenue) * 100).toFixed(1)}%`
                    : "0.0%"}
                </strong>{" "}
                (after free schemes)
              </p>
            </div>
          </div>

          {/* Profit Contribution Leaderboard Strip across all Medicines */}
          {portfolioSummary.realizedProfit > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Realized Profit Leaderboard by Medicine (Click any SKU to inspect)
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Total Realized: {currencyExact(portfolioSummary.realizedProfit)} across {products.length} medicines
                </span>
              </div>
              {(() => {
                const palette = ["bg-indigo-600", "bg-emerald-500", "bg-cyan-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-slate-500"];
                const ranked = [...products]
                  .filter((p) => (p.profitAnalytics?.realizedProfit ?? 0) > 0)
                  .sort((a, b) => (b.profitAnalytics?.realizedProfit ?? 0) - (a.profitAnalytics?.realizedProfit ?? 0));
                return (
                  <>
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100">
                      {ranked.map((p, idx) => {
                        const pct = ((p.profitAnalytics?.realizedProfit ?? 0) / portfolioSummary.realizedProfit) * 100;
                        return (
                          <div
                            key={p.id}
                            style={{ width: `${Math.max(1.5, pct)}%` }}
                            className={`${palette[idx % palette.length]} h-full transition-all`}
                            title={`${p.name}: ${currencyExact(p.profitAnalytics?.realizedProfit ?? 0)} (${pct.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ranked.map((p, idx) => {
                        const val = p.profitAnalytics?.realizedProfit ?? 0;
                        const share = (val / portfolioSummary.realizedProfit) * 100;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setInspectProduct(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-[11px] transition-colors cursor-pointer"
                          >
                            <span className={`w-2 h-2 rounded-full ${palette[idx % palette.length]}`} />
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className="font-bold text-emerald-700 tabular-nums">{currencyExact(val)}</span>
                            <span className="text-[10px] text-slate-400 tabular-nums">({share.toFixed(1)}%)</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: List and Add/Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table List */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${
          editingProduct || isAdding ? "lg:col-span-8" : "lg:col-span-12"
        }`}>
          {/* Table Search & View Switcher */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setCatalogView("cards")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    catalogView === "cards"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Medicine Cards
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogView("table")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    catalogView === "table"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Full Table
                </button>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Showing {filteredProducts.length} of {products.length} Products
              </span>
            </div>
          </div>

          {catalogView === "cards" ? (
            <div className="p-4">
              {loading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                  Loading products...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium text-xs">
                  No products found.
                </div>
              ) : (
                <div className={`grid grid-cols-1 gap-4 ${
                  editingProduct || isAdding ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"
                }`}>
                  {filteredProducts.map((p) => {
                    const cost = rowCost(p);
                    const ptrValue = Number(p.ptr || p.price || 0);
                    const mrpValue = Number(p.mrp || 0);
                    const unitProfit = p.unitProfit ?? (ptrValue > 0 && cost.value > 0 ? Math.round((ptrValue - cost.value) * 100) / 100 : 0);
                    const grossMarginOnPtrPct = ptrValue > 0 && cost.value > 0 ? Math.round(((ptrValue - cost.value) / ptrValue) * 1000) / 10 : null;
                    const boxesEq = p.stockBoxes ?? Math.round((p.stockQty / 10) * 10) / 10;
                    const stockCost = Number(p.stockValueAtCost ?? Math.round(p.stockQty * cost.value * 100) / 100);
                    const stockVal = Number(p.stockValue ?? Math.round(p.stockQty * ptrValue * 100) / 100);
                    const potentialProfit = Number(p.potentialStockProfit ?? Math.round((stockVal - stockCost) * 100) / 100);
                    const pa = p.profitAnalytics;
                    const shareOfProfitPct =
                      portfolioSummary && portfolioSummary.realizedProfit > 0 && pa
                        ? Math.round((pa.realizedProfit / portfolioSummary.realizedProfit) * 1000) / 10
                        : null;
                    const clinical = getMedicineReference(p);
                    const shelf = computeShelfLife(p.currentExpDate);

                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3"
                      >
                        {/* Header & Medicine Identity */}
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-black text-slate-900">{p.name}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700">
                                  {p.therapySegment || "General"}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                SKU: <span className="font-semibold text-slate-700">{p.sku}</span> · Pack:{" "}
                                <span className="font-semibold text-slate-700">{p.packSize || "N/A"}</span>
                                {p.gstPct != null && ` · GST ${Number(p.gstPct)}%`}
                                {p.hsnCode && ` · HSN ${p.hsnCode}`}
                              </p>
                            </div>
                            {isAdmin && (
                              <span
                                className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums ${
                                  p.stockQty <= 20
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {p.stockQty.toLocaleString("en-IN")} strips
                              </span>
                            )}
                          </div>

                          <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 space-y-1">
                            <p className="text-xs font-medium text-slate-700">
                              {p.composition || "Composition not set"}
                              {p.strength ? ` (${p.strength})` : ""}
                            </p>
                            <p className="text-[10px] font-semibold text-indigo-700">
                              {clinical.therapeuticClass}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {clinical.targetSpecialties.slice(0, 3).map((spec) => (
                                <span
                                  key={spec}
                                  className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-semibold text-slate-600"
                                >
                                  {spec}
                                </span>
                              ))}
                              {shelf.status !== "UNKNOWN" && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    shelf.status === "EXPIRED" || shelf.status === "EXPIRING_SOON"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : shelf.status === "WATCH"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  Exp: {shelf.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Pricing & Margin Ladder */}
                        <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">MRP</span>
                            <span className="text-xs font-bold text-slate-700 tabular-nums">₹{mrpValue.toFixed(2)}</span>
                          </div>
                          <div className="border-x border-slate-200">
                            <span className="text-[9px] font-bold uppercase text-indigo-600 block">PTR (Sell)</span>
                            <span className="text-xs font-black text-slate-900 tabular-nums">₹{ptrValue.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-emerald-700 block">
                              {isAdmin ? "Cost / +Profit" : "Pack"}
                            </span>
                            {isAdmin ? (
                              <span className="text-xs font-bold text-emerald-700 tabular-nums">
                                ₹{cost.value.toFixed(2)} / +₹{unitProfit.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-600">{p.packSize || "—"}</span>
                            )}
                          </div>
                        </div>

                        {/* Admin Stock + Realized Profit Box */}
                        {isAdmin && (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5 tabular-nums">
                              <span>
                                Stock: <strong className="text-slate-900">{boxesEq.toFixed(1)} boxes</strong>
                                {p.mrSampleQty ? ` · MR ${p.mrSampleQty}` : ""}
                                {p.earliestStockQty != null ? ` (from ${p.earliestStockQty.toLocaleString("en-IN")}u)` : ""}
                              </span>
                              <span>
                                {p.currentBatchNo ? `Batch ${p.currentBatchNo}` : "No batch"}
                                {p.forecast?.daysRemaining != null ? ` · ${p.forecast.daysRemaining}d left` : ""}
                              </span>
                            </div>

                            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                  Realized Profit ({pa?.invoicedCount ?? 0} inv)
                                </span>
                                {shareOfProfitPct !== null && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {shareOfProfitPct}% share
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline justify-between gap-2 tabular-nums">
                                <span className={`text-base font-black ${(pa?.realizedProfit ?? 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                  {currencyExact(pa?.realizedProfit ?? 0)}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {pa?.realizedMarginPct != null ? `${pa.realizedMarginPct.toFixed(1)}% net` : `${grossMarginOnPtrPct?.toFixed(1) ?? "0.0"}% PTR`}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-emerald-200/60 tabular-nums">
                                <span>
                                  Sold: {pa?.invoicedBilledQty ?? 0} + {pa?.invoicedFreeQty ?? 0} free (Burden {currency(pa?.freeCostBurden ?? 0)})
                                </span>
                                <span className="font-semibold text-slate-800">
                                  Stock Profit: {currency(potentialProfit)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectProduct(p)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye size={13} /> {isAdmin ? "Know Medicine & Profit" : "Know Medicine"}
                          </button>
                          <div className="flex items-center gap-1">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setHistoryProduct(p)}
                                className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-400"
                                title="View stock movement audit trail"
                              >
                                <History size={14} />
                              </button>
                            )}
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(p)}
                                  className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-500"
                                  title="Edit Product details / stock"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p.id, p.name)}
                                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer text-slate-500"
                                  title="Delete Product"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Product</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Molecule / Segment</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">MRP</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">PTR</th>
                  {isAdmin && (
                    <>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Cost &amp; Unit Profit</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Margin %</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Warehouse Stock</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Stock Value &amp; Profit</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Realized Sales Profit</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Forecast / Updated</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Current Batch</th>
                      <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Know / Audit</th>
                    </>
                  )}
                  {canManage && <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const cost = rowCost(p);
                    const ptrValue = Number(p.ptr || 0);
                    const unitProfit = p.unitProfit ?? (ptrValue > 0 && cost.value > 0 ? Math.round((ptrValue - cost.value) * 100) / 100 : 0);
                    const grossMarginOnPtrPct =
                      ptrValue > 0 && cost.value > 0
                        ? Math.round(((ptrValue - cost.value) / ptrValue) * 1000) / 10
                        : null;
                    const boxesEq = p.stockBoxes ?? Math.round((p.stockQty / 10) * 10) / 10;
                    const potentialProfit =
                      p.potentialStockProfit ??
                      (p.stockValue !== undefined && p.stockValueAtCost !== undefined && p.stockValueAtCost !== null
                        ? Math.round((p.stockValue - p.stockValueAtCost) * 100) / 100
                        : null);
                    const pa = p.profitAnalytics;
                    return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setInspectProduct(p)}
                            className="text-left group cursor-pointer"
                            title="Inspect medicine details & profit breakdown"
                          >
                            <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight underline decoration-dotted decoration-slate-300 underline-offset-2">
                              {p.name}
                            </p>
                          </button>
                        ) : (
                          <p className="font-bold text-slate-800 leading-tight">{p.name}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          SKU: {p.sku} · Pack: {p.packSize || "N/A"}
                          {p.gstPct != null && ` · GST ${Number(p.gstPct)}%`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-700 leading-tight">{p.composition || "-"}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700">
                            {p.therapySegment || "General"}
                          </span>
                          {p.hsnCode && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500">
                              HSN {p.hsnCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">₹{Number(p.mrp || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">₹{Number(p.ptr || 0).toFixed(2)}</td>
                      {isAdmin && (
                        <>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {cost.value > 0 ? (
                            <>
                              <p className="font-semibold text-slate-700">
                                ₹{cost.value.toFixed(2)}
                                {!cost.exact && (
                                  <span
                                    className="ml-1 inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 align-middle"
                                    title={`Estimated: no purchase rate is recorded, so this uses ${cost.source} as a proxy for cost.`}
                                  >
                                    est.
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                +₹{unitProfit.toFixed(2)}/strip
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-300" title="No purchase rate, PTR or price is set for this product.">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {grossMarginOnPtrPct === null ? (
                            <span className="text-slate-300" title="Needs a PTR and a cost basis.">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  cost.exact
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                                title={
                                  cost.exact
                                    ? "(PTR - purchase rate) / PTR - gross margin before free scheme goods."
                                    : `Estimate: (PTR - ${cost.source}) / PTR. No purchase rate is recorded for this product.`
                                }
                              >
                                {grossMarginOnPtrPct.toFixed(1)}% PTR{cost.exact ? "" : " est."}
                              </span>
                              {pa && pa.realizedMarginPct !== null && (
                                <span
                                  className="text-[10px] font-semibold text-indigo-700"
                                  title="Net realized profit margin across raised invoices after free scheme cost"
                                >
                                  {pa.realizedMarginPct.toFixed(1)}% Net
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={`inline-block font-bold text-xs ${
                            p.stockQty <= 20 ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg" : "text-emerald-700"
                          }`}>
                            {p.stockQty.toLocaleString("en-IN")} strips
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {boxesEq.toFixed(1)} boxes{p.mrSampleQty ? ` · MR ${p.mrSampleQty}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <p className="font-semibold text-slate-700">
                            {p.stockValue !== undefined ? currency(p.stockValue) : "—"}
                          </p>
                          {potentialProfit !== null && (
                            <p className="text-[10px] font-bold text-emerald-700 mt-0.5" title="Potential gross profit if current warehouse stock sells at PTR">
                              Profit {currency(potentialProfit)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {pa && pa.invoicedCount > 0 ? (
                            <>
                              <p className={`font-bold text-xs ${pa.realizedProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                {currencyExact(pa.realizedProfit)}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5" title={`${pa.invoicedCount} invoices · ${pa.invoicedBilledQty} billed + ${pa.invoicedFreeQty} free strips`}>
                                {pa.invoicedCount} inv · {pa.invoicedBilledQty}+{pa.invoicedFreeQty}u
                              </p>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-300">No invoices yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.forecast?.daysRemaining !== null && p.forecast?.daysRemaining !== undefined ? (
                            <p className={`inline-flex items-center gap-1 text-xs font-bold ${
                              p.forecast.daysRemaining <= 7 ? "text-rose-600" : p.forecast.daysRemaining <= 21 ? "text-amber-600" : "text-slate-600"
                            }`}>
                              <TrendingDown size={12} />
                              {p.forecast.daysRemaining}d left
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-300">No 30d burn</p>
                          )}
                          {p.lastMovementAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(p.lastMovementAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            </p>
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInspectProduct(p)}
                              className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                              title="Know medicine & full profit dossier"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryProduct(p)}
                              className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-400"
                              title="View stock movement audit trail"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                        </>
                      )}
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
          )}
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
                      onChange={(e) => setFormData({ ...formData, ptr: Number(e.target.value) })}
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

      {/* Admin/ASM: give stock to an MR */}
      {(role === "ASM" || role === "ADMIN" || role === "MD") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-800">Give Stock to MR</h2>
          </div>
          <form onSubmit={handleAllocate} className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-slate-600">MR</label>
              <SearchableSelect
                value={allocEmployeeId}
                onChange={(e) => setAllocEmployeeId(e.target.value)}
                placeholder="Select MR"
                searchPlaceholder="Search MR..."
                allowClear
              >
                <option value="">Select MR</option>
                {mrList.map((m) => (
                  <option key={m.employeeId} value={m.employeeId}>{m.firstName} {m.lastName}</option>
                ))}
              </SearchableSelect>
            </div>
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-slate-600">Product</label>
              <SearchableSelect
                value={allocProductId}
                onChange={(e) => setAllocProductId(e.target.value)}
                placeholder="Select product"
                searchPlaceholder="Search product..."
                allowClear
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </SearchableSelect>
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

      {inspectProduct && (
        <MedicineDetailModal
          product={inspectProduct}
          products={products}
          isAdmin={isAdmin}
          canManage={canManage}
          onSelectProduct={(next) => setInspectProduct(next)}
          onClose={() => setInspectProduct(null)}
          onEdit={() => {
            const p = inspectProduct;
            setInspectProduct(null);
            handleOpenEdit(p);
          }}
        />
      )}

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

function MovementLedgerBody({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState("");

  useEffect(() => {
    setLedgerSearch("");
    setLoading(true);
    apiClient
      .get(`/api/products/${productId}/movements`)
      .then((res) => setMovements(res.data.data.movements ?? []))
      .catch((err) => console.error("Failed to load stock history:", err))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    );
  }
  if (movements.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-12">No stock movements recorded yet.</p>;
  }

  const q = ledgerSearch.trim().toLowerCase();
  const filteredMovements = q
    ? movements.filter((m) => {
        const typeLabel = MOVEMENT_LABEL[m.type].toLowerCase();
        const emp = m.employee ? `${m.employee.firstName} ${m.employee.lastName}`.toLowerCase() : "system";
        const dt = new Date(m.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toLowerCase();
        return (
          typeLabel.includes(q) ||
          (m.note || "").toLowerCase().includes(q) ||
          emp.includes(q) ||
          dt.includes(q) ||
          String(m.delta).includes(q)
        );
      })
    : movements;

  return (
    <div>
      <div className="p-3 bg-slate-50/70 border-b border-slate-100 sticky top-0 z-20">
        <ScrollSearchBar
          value={ledgerSearch}
          onChange={setLedgerSearch}
          placeholder="Search stock ledger by note, type, user, or qty…"
          matchedCount={filteredMovements.length}
          totalCount={movements.length}
        />
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Date/Time</th>
            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">Type</th>
            <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">Change</th>
            <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider text-[10px]">Balance</th>
            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {filteredMovements.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                No stock movements matching &ldquo;{ledgerSearch}&rdquo;
              </td>
            </tr>
          ) : (
            filteredMovements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 text-slate-600">
                  {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                  {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.type === "ORDER_DEDUCTION"
                        ? "bg-blue-50 text-blue-700"
                        : m.type === "RESTOCK"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {MOVEMENT_LABEL[m.type]}
                  </span>
                  {m.note && <p className="text-[10px] text-slate-400 mt-0.5">{m.note}</p>}
                </td>
                <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${m.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{m.quantityAfter}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : "System"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockHistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Stock Audit — {product.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Current leftover: {product.stockQty.toLocaleString("en-IN")} strips ({(product.stockBoxes ?? product.stockQty / 10).toFixed(1)} boxes)
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MovementLedgerBody productId={product.id} />
        </div>
      </div>
    </div>
  );
}

interface MedicineIntelligencePayload {
  clinicalProfile?: ClinicalReference;
  shelfLife?: ShelfLifeStatus;
  monthlyTrend?: Array<{
    month: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
  }>;
  topChemists?: Array<{
    chemistId: string;
    chemistName: string;
    area: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    totalUnits: number;
    revenue: number;
    profit: number;
    marginPct: number | null;
    lastOrderDate: string;
  }>;
  mrBreakdown?: Array<{
    employeeId: string;
    mrName: string;
    invoicesCount: number;
    billedQty: number;
    freeQty: number;
    sampleQtyHeld: number;
    lastSampleGivenAt: string | null;
    revenue: number;
    profit: number;
    marginPct: number | null;
  }>;
  schemeMix?: Array<{
    ratioLabel: string;
    linesCount: number;
    billedQty: number;
    freeQty: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
  }>;
  recentInvoices?: Array<{
    invoiceNo: string;
    date: string;
    partyName: string;
    area: string;
    mrName: string;
    billedQty: number;
    freeQty: number;
    unitRate: number;
    lineRevenue: number;
    lineCost: number;
    lineProfit: number;
    lineMarginPct: number | null;
  }>;
}

function MedicineDetailModal({
  product,
  products,
  isAdmin,
  canManage,
  onSelectProduct,
  onClose,
  onEdit,
}: {
  product: Product;
  products: Product[];
  isAdmin: boolean;
  canManage: boolean;
  onSelectProduct: (p: Product) => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "clinical" | "market" | "ledger">(
    isAdmin ? "overview" : "clinical"
  );
  const [docPctSim, setDocPctSim] = useState<number>(0);
  const [intel, setIntel] = useState<MedicineIntelligencePayload | null>(null);
  const [intelLoading, setIntelLoading] = useState<boolean>(true);
  const [chemistSearch, setChemistSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  useEffect(() => {
    setChemistSearch("");
    setInvoiceSearch("");
    let cancelled = false;
    setIntelLoading(true);
    apiClient
      .get(`/api/products/${product.id}/intelligence`)
      .then((res) => {
        if (!cancelled) {
          setIntel(res.data?.data ?? null);
        }
      })
      .catch((err) => {
        console.error("Failed to load medicine intelligence:", err);
        if (!cancelled) setIntel(null);
      })
      .finally(() => {
        if (!cancelled) setIntelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const cost = rowCost(product);
  const ptrVal = Number(product.ptr || product.price || 0);
  const mrpVal = Number(product.mrp || 0);
  const unitProfit = product.unitProfit ?? Math.round((ptrVal - cost.value) * 100) / 100;
  const grossMarginPct = ptrVal > 0 && cost.value > 0 ? Math.round(((ptrVal - cost.value) / ptrVal) * 1000) / 10 : 0;
  const chemistMarginPct = mrpVal > 0 && ptrVal > 0 ? Math.round(((mrpVal - ptrVal) / mrpVal) * 1000) / 10 : 0;
  const stockCost = Number(product.stockValueAtCost ?? Math.round(product.stockQty * cost.value * 100) / 100);
  const stockPtrVal = Number(product.stockValue ?? Math.round(product.stockQty * ptrVal * 100) / 100);
  const potentialProfit = Number(product.potentialStockProfit ?? Math.round((stockPtrVal - stockCost) * 100) / 100);
  const boxesEq = product.stockBoxes ?? Math.round((product.stockQty / 10) * 10) / 10;
  const pa = product.profitAnalytics;

  const clinical = intel?.clinicalProfile ?? getMedicineReference(product);
  const shelf = intel?.shelfLife ?? computeShelfLife(product.currentExpDate);

  const curIdx = products.findIndex((x) => x.id === product.id);
  const prevProd = curIdx > 0 ? products[curIdx - 1] : null;
  const nextProd = curIdx >= 0 && curIdx < products.length - 1 ? products[curIdx + 1] : null;

  const tabs: Array<{ id: "overview" | "clinical" | "market" | "ledger"; label: string }> = isAdmin
    ? [
        { id: "overview", label: "Overview & Profit" },
        { id: "clinical", label: "Clinical & Detailing" },
        { id: "market", label: "Chemists, MRs & Sales" },
        { id: "ledger", label: "Stock Ledger" },
      ]
    : [{ id: "clinical", label: "Clinical & Detailing" }];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Quick Switcher */}
        <div className="p-5 border-b border-slate-800 bg-slate-900 text-white space-y-3">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">{product.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {product.therapySegment || "General"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  SKU: {product.sku}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {clinical.therapeuticClass}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {product.composition || "Composition not set"}
                {product.strength ? ` · ${product.strength}` : ""} · Pack: {product.packSize || "N/A"}
                {product.hsnCode ? ` · HSN ${product.hsnCode}` : ""}
                {product.gstPct != null ? ` · GST ${Number(product.gstPct)}%` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {products.length > 1 && (
                <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    disabled={!prevProd}
                    onClick={() => prevProd && onSelectProduct(prevProd)}
                    className="px-2 py-1 rounded-lg hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
                    title="Previous medicine"
                  >
                    Prev
                  </button>
                  <select
                    aria-label="Switch medicine"
                    value={product.id}
                    onChange={(e) => {
                      const found = products.find((x) => x.id === e.target.value);
                      if (found) onSelectProduct(found);
                    }}
                    className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2 py-1 border border-slate-700 focus:outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!nextProd}
                    onClick={() => nextProd && onSelectProduct(nextProd)}
                    className="px-2 py-1 rounded-lg hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
                    title="Next medicine"
                  >
                    Next
                  </button>
                </div>
              )}
              <DownloadFormatDropdown
                compact
                buttonLabel="Download Dossier"
                scopeNote={
                  isAdmin
                    ? `${product.name} · Clinical, Profit, Scheme & Monthly Ledger`
                    : `${product.name} · Clinical & Detailing Dossier`
                }
                onExcel={() => downloadSingleMedicineExcel(product, intel, isAdmin, docPctSim)}
                onHtml={() => downloadSingleMedicineHtml(product, intel, isAdmin, docPctSim)}
                onPdf={() => printSingleMedicinePdf(product, intel, isAdmin, docPctSim)}
                onJson={() => downloadSingleMedicineJson(product, intel, isAdmin)}
              />
              {canManage && isAdmin && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={13} /> Edit Medicine / Stock
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: OVERVIEW & PROFIT (Admin) */}
          {activeTab === "overview" && isAdmin && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit Economics / Strip</p>
                  <p className="text-lg font-black text-emerald-700 mt-1 tabular-nums">+₹{unitProfit.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
                    PTR ₹{ptrVal.toFixed(2)} − Cost ₹{cost.value.toFixed(2)} ({grossMarginPct.toFixed(1)}%{cost.exact ? "" : " est."})
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Realized Profit (Invoices)</p>
                  <p className={`text-lg font-black mt-1 tabular-nums ${(pa?.realizedProfit ?? 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {currencyExact(pa?.realizedProfit ?? 0)}
                  </p>
                  <p className="text-[11px] text-emerald-800/80 mt-1 tabular-nums">
                    {pa?.invoicedCount ?? 0} invoices ·{" "}
                    {pa?.realizedMarginPct !== null && pa?.realizedMarginPct !== undefined
                      ? `${pa.realizedMarginPct.toFixed(1)}% net margin`
                      : "No sales yet"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Warehouse Stock Profit (@ PTR)</p>
                  <p className="text-lg font-black text-slate-900 mt-1 tabular-nums">{currencyExact(potentialProfit)}</p>
                  <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
                    {product.stockQty.toLocaleString("en-IN")} strips ({boxesEq.toFixed(1)} boxes) · Cost {currency(stockCost)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Batch, Shelf Life &amp; Burn</p>
                  <p className="text-sm font-black text-slate-800 mt-1">
                    {product.currentBatchNo || "No batch set"} · <span className="text-emerald-700">{shelf.label}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    MR stock: {product.mrSampleQty ?? 0}
                    {product.forecast?.daysRemaining != null ? ` · ${product.forecast.daysRemaining}d stock left` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                    Strip &amp; Box Pricing Structure (Invoicing on PTR Only)
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Purchase Cost</span>
                      <p className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">₹{cost.value.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-400">Box ₹{(cost.value * 10).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase">PTR (Sell Rate)</span>
                      <p className="text-sm font-black text-indigo-900 mt-0.5 tabular-nums">₹{ptrVal.toFixed(2)}</p>
                      <span className="text-[10px] text-indigo-600">Box ₹{(ptrVal * 10).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">MRP</span>
                      <p className="text-sm font-black text-slate-900 mt-0.5 tabular-nums">₹{mrpVal.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-400">Chemist {chemistMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs pt-1 text-slate-600">
                    <span>Stock Selling Value (@ PTR)</span>
                    <strong className="text-slate-900 tabular-nums">{currencyExact(stockPtrVal)}</strong>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Stock Purchase Cost Outlay</span>
                    <strong className="text-slate-900 tabular-nums">{currencyExact(stockCost)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Realized Invoice P&amp;L ({pa?.invoicedCount ?? 0} Invoices · Excl. GST)
                    </h3>
                    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                      {[
                        { pct: 0, label: "0% Gross" },
                        { pct: 15, label: "15% Doc" },
                        { pct: 20, label: "20% Doc" },
                      ].map((opt) => (
                        <button
                          key={opt.pct}
                          type="button"
                          onClick={() => setDocPctSim(opt.pct)}
                          className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                            docPctSim === opt.pct ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Units Dispatched (Billed + Free Scheme)</span>
                      <strong className="text-slate-800 tabular-nums">
                        {(pa?.invoicedBilledQty ?? 0).toLocaleString("en-IN")} billed + {(pa?.invoicedFreeQty ?? 0).toLocaleString("en-IN")} free ({pa?.freeRatioPct ?? 0}%)
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Realized Invoiced Sales (Excl. GST)</span>
                      <strong className="text-slate-900 tabular-nums">{currencyExact(pa?.realizedRevenue ?? 0)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Less: Cost of Billed Strips</span>
                      <span className="text-slate-700 tabular-nums">({currencyExact(pa?.billedCostOnly ?? 0)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Less: Free Scheme Strip Cost Burden</span>
                      <span className="text-rose-600 font-medium tabular-nums">({currencyExact(pa?.freeCostBurden ?? 0)})</span>
                    </div>
                    {(() => {
                      const rev = pa?.realizedRevenue ?? 0;
                      const gross = pa?.realizedProfit ?? 0;
                      const docCost = Math.round(((rev * docPctSim) / 100) * 100) / 100;
                      const netAfterDoc = Math.round((gross - docCost) * 100) / 100;
                      const netPct = rev > 0 ? Math.round((netAfterDoc / rev) * 1000) / 10 : null;
                      return (
                        <>
                          {docPctSim > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Less: Doctor Commission ({docPctSim}% simulated)</span>
                              <span className="text-rose-600 font-medium tabular-nums">({currencyExact(docCost)})</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm">
                            <span className="text-slate-900">
                              {docPctSim > 0 ? `Est. Net Profit (After ${docPctSim}% Doc)` : "Net Realized Profit (Before Doc / Overheads)"}
                            </span>
                            <span className={`tabular-nums ${netAfterDoc >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                              {currencyExact(netAfterDoc)}
                              {netPct !== null ? ` (${netPct.toFixed(1)}%)` : ""}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CLINICAL & DETAILING PROFILE (Available to ALL roles including MR) */}
          {activeTab === "clinical" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Therapeutic Classification</span>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">{clinical.therapeuticClass}</h3>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Formula / Composition</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      {product.composition || "Composition not recorded"}{product.strength ? ` · ${product.strength}` : ""}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">How It Works (Mechanism of Action)</span>
                    <p className="text-xs text-slate-700 leading-relaxed mt-0.5">{clinical.mechanismOfAction}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Standard Adult Dosing Guidance</span>
                    <p className="text-xs font-medium text-slate-800 mt-0.5 bg-indigo-50/50 px-3 py-2 rounded-lg border border-indigo-100">
                      {clinical.standardDosage}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Primary Clinical Indications</span>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700 list-disc pl-4">
                      {clinical.indications.map((ind) => (
                        <li key={ind}>{ind}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Doctor Specialties</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {clinical.targetSpecialties.map((spec) => (
                        <span
                          key={spec}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Field Detailing Highlights (USP)</span>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700 list-disc pl-4">
                      {clinical.detailingHighlights.map((hl) => (
                        <li key={hl}>{hl}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 max-w-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Safety Precautions &amp; Storage Conditions</span>
                  <p className="text-xs text-amber-950">{clinical.precautionsAndStorage}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-slate-800">
                    MRP ₹{mrpVal.toFixed(2)} · PTR ₹{ptrVal.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Pack: {product.packSize || "N/A"} · Shelf Life: <strong>{shelf.label}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CHEMISTS, MRs, MONTHLY SALES & SCHEMES (Admin) */}
          {activeTab === "market" && isAdmin && (
            <div className="space-y-4">
              {intelLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto mb-2" />
                  Loading per-medicine chemist, MR &amp; sales analytics...
                </div>
              ) : (
                <>
                  {/* Monthly Trend + Scheme Mix */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Monthly Sales &amp; Profit Trajectory</h3>
                      </div>
                      {!intel?.monthlyTrend?.length ? (
                        <p className="p-4 text-xs text-slate-400">No monthly invoice sales recorded yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100 text-[10px] uppercase">
                              <th className="px-3 py-2 text-left">Month</th>
                              <th className="px-3 py-2 text-right">Inv</th>
                              <th className="px-3 py-2 text-right">Billed+Free</th>
                              <th className="px-3 py-2 text-right">Revenue</th>
                              <th className="px-3 py-2 text-right">Profit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums">
                            {intel.monthlyTrend.map((m) => (
                              <tr key={m.month}>
                                <td className="px-3 py-2 font-semibold text-slate-800">{m.month}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{m.invoicesCount}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{m.billedQty}+{m.freeQty}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">{currencyExact(m.revenue)}</td>
                                <td className={`px-3 py-2 text-right font-bold ${m.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                  {currencyExact(m.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Scheme Ratio Mix on Invoices</h3>
                      </div>
                      {!intel?.schemeMix?.length ? (
                        <p className="p-4 text-xs text-slate-400">No scheme line-items recorded yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100 text-[10px] uppercase">
                              <th className="px-3 py-2 text-left">Scheme</th>
                              <th className="px-3 py-2 text-right">Lines</th>
                              <th className="px-3 py-2 text-right">Units (B+F)</th>
                              <th className="px-3 py-2 text-right">Profit</th>
                              <th className="px-3 py-2 text-right">Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums">
                            {intel.schemeMix.map((sc) => (
                              <tr key={sc.ratioLabel}>
                                <td className="px-3 py-2 font-bold text-indigo-700">{sc.ratioLabel}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{sc.linesCount}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{sc.billedQty}+{sc.freeQty}</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-700">{currencyExact(sc.profit)}</td>
                                <td className="px-3 py-2 text-right text-slate-700">
                                  {sc.marginPct != null ? `${sc.marginPct.toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Top Chemists & MR Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Top Buying Chemists / Medical Halls</h3>
                        {Boolean(intel?.topChemists?.length) && (
                          <ScrollSearchBar
                            value={chemistSearch}
                            onChange={setChemistSearch}
                            placeholder="Search chemist or area…"
                            matchedCount={
                              intel!.topChemists!.filter((ch) => {
                                const q = chemistSearch.trim().toLowerCase();
                                return !q || ch.chemistName.toLowerCase().includes(q) || ch.area.toLowerCase().includes(q);
                              }).length
                            }
                            totalCount={intel!.topChemists!.length}
                          />
                        )}
                      </div>
                      {!intel?.topChemists?.length ? (
                        <p className="p-4 text-xs text-slate-400">No chemist purchases recorded yet.</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100 text-[10px] uppercase sticky top-0">
                                <th className="px-3 py-2 text-left">Chemist</th>
                                <th className="px-3 py-2 text-right">Inv</th>
                                <th className="px-3 py-2 text-right">Units (B+F)</th>
                                <th className="px-3 py-2 text-right">Profit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 tabular-nums">
                              {intel.topChemists
                                .filter((ch) => {
                                  const q = chemistSearch.trim().toLowerCase();
                                  return !q || ch.chemistName.toLowerCase().includes(q) || ch.area.toLowerCase().includes(q);
                                })
                                .map((ch) => (
                                  <tr key={ch.chemistId}>
                                    <td className="px-3 py-2">
                                      <p className="font-semibold text-slate-800">{ch.chemistName}</p>
                                      <p className="text-[10px] text-slate-400">{ch.area}</p>
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600">{ch.invoicesCount}</td>
                                    <td className="px-3 py-2 text-right text-slate-600">{ch.billedQty}+{ch.freeQty}</td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{currencyExact(ch.profit)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">MR Sales &amp; Field Sample Allocation</h3>
                      </div>
                      {!intel?.mrBreakdown?.length ? (
                        <p className="p-4 text-xs text-slate-400">No MR sales or sample allocations recorded.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100 text-[10px] uppercase">
                              <th className="px-3 py-2 text-left">MR Name</th>
                              <th className="px-3 py-2 text-right">Sold (B+F)</th>
                              <th className="px-3 py-2 text-right">Profit</th>
                              <th className="px-3 py-2 text-right">Samples</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums">
                            {intel.mrBreakdown.map((mr) => (
                              <tr key={mr.employeeId}>
                                <td className="px-3 py-2 font-semibold text-slate-800">{mr.mrName}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{mr.billedQty}+{mr.freeQty} ({mr.invoicesCount} inv)</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-700">{currencyExact(mr.profit)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-indigo-700">{mr.sampleQtyHeld}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Recent Invoices for this Medicine */}
                  {Boolean(intel?.recentInvoices?.length) && (() => {
                    const q = invoiceSearch.trim().toLowerCase();
                    const filteredInvoices = q
                      ? intel!.recentInvoices!.filter(
                          (inv) =>
                            inv.invoiceNo.toLowerCase().includes(q) ||
                            inv.partyName.toLowerCase().includes(q) ||
                            inv.mrName.toLowerCase().includes(q) ||
                            inv.area.toLowerCase().includes(q)
                        )
                      : intel!.recentInvoices!;
                    return (
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Invoices for {product.name}</h3>
                          <span className="text-[10px] text-slate-500">Latest {intel!.recentInvoices!.length} entries</span>
                        </div>
                        <ScrollSearchBar
                          value={invoiceSearch}
                          onChange={setInvoiceSearch}
                          placeholder="Search invoices by #no, chemist party, MR or area…"
                          matchedCount={filteredInvoices.length}
                          totalCount={intel!.recentInvoices!.length}
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100 text-[10px] uppercase sticky top-0">
                              <th className="px-3 py-2 text-left">Invoice / Date</th>
                              <th className="px-3 py-2 text-left">Party / MR</th>
                              <th className="px-3 py-2 text-right">Qty (B+F)</th>
                              <th className="px-3 py-2 text-right">Rate</th>
                              <th className="px-3 py-2 text-right">Line Profit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 tabular-nums">
                            {filteredInvoices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                  No invoices matching &ldquo;{invoiceSearch}&rdquo;
                                </td>
                              </tr>
                            ) : (
                              filteredInvoices.map((inv, idx) => (
                                <tr key={`${inv.invoiceNo}-${idx}`}>
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-slate-800">{inv.invoiceNo}</p>
                                    <p className="text-[10px] text-slate-400">
                                      {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <p className="text-slate-700 font-medium">{inv.partyName}</p>
                                    <p className="text-[10px] text-slate-400">{inv.mrName}</p>
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-700">{inv.billedQty}+{inv.freeQty}</td>
                                  <td className="px-3 py-2 text-right text-slate-700">₹{inv.unitRate.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{currencyExact(inv.lineProfit)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* TAB 4: STOCK MOVEMENT AUDIT LEDGER (Admin / CanManage) */}
          {activeTab === "ledger" && isAdmin && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Stock Movement &amp; Reconciliation Ledger</h3>
                <span className="text-[11px] text-slate-500">Live audit trail</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <MovementLedgerBody productId={product.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
