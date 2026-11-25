"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  buildReferenceSheetRows,
  buildRowsFromCatalogProducts,
  CatalogProductOption,
  computeProfitTestingSheet,
  CostBasisMode,
  createBlankTestingRow,
  DEFAULT_PROFIT_TESTING_ASSUMPTIONS,
  downloadProfitTestingExcel,
  ProfitTestingAssumptions,
  ProfitTestingRowInput,
  round2,
  SellingPriceBasis,
  TaxTreatment,
} from "@/lib/profit-testing";

/** Suppresses browser spinner buttons inside numeric cells so every digit stays visible. */
const NO_SPIN_INPUT =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function formatInr(value: number, showParensForNegative = true): string {
  const abs = Math.abs(value);
  const formatted = `₹${abs.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  if (value < -0.004 && showParensForNegative) return `(${formatted})`;
  if (value < -0.004) return `-${formatted}`;
  return formatted;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function ProfitTestingSheet() {
  const [assumptions, setAssumptions] = useState<ProfitTestingAssumptions>(
    DEFAULT_PROFIT_TESTING_ASSUMPTIONS
  );
  const [rows, setRows] = useState<ProfitTestingRowInput[]>(() => buildReferenceSheetRows([], 0));
  const [catalog, setCatalog] = useState<CatalogProductOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<"REFERENCE" | "CATALOG" | "BLANK">("REFERENCE");
  const [columnView, setColumnView] = useState<"ALL" | "COMPACT">("ALL");

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    setCatalogLoading(true);
    setCatalogError(null);

    apiClient
      .get("/api/products?limit=100")
      .then((res) => {
        if (!mounted) return;
        const prods: CatalogProductOption[] = (res.data?.data?.products ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          packSize: p.packSize ?? null,
          mrp: Number(p.mrp || 0),
          ptr: Number(p.ptr || 0),
          pts: Number(p.pts || 0),
          purchaseRate: p.purchaseRate != null ? Number(p.purchaseRate) : null,
          marginStructure: p.marginStructure ?? null,
          gstPct: p.gstPct != null ? Number(p.gstPct) : null,
        }));
        setCatalog(prods);
        setRows((prev) => {
          const byName = new Map(prods.map((p) => [p.name.trim().toLowerCase(), p]));
          return prev.map((r) => {
            const norm = r.item.trim().toLowerCase();
            const matched =
              byName.get(norm) || (norm === "metaclav-cv" ? byName.get("metamox-cv") : undefined);
            if (!matched) return r;
            return {
              ...r,
              productId: matched.id,
              catalogPurchaseRate: round2(Number(matched.purchaseRate || r.catalogPurchaseRate || 0)),
              pts: round2(Number(matched.pts || r.pts || 0)),
              marginStructure: matched.marginStructure ?? r.marginStructure ?? null,
            };
          });
        });
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to fetch live catalog for Profit Testing Sheet:", err);
        setCatalogError("Could not reach live catalog; offline sheet reference preset loaded.");
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const { computedRows, summary } = useMemo(
    () => computeProfitTestingSheet(assumptions, rows),
    [assumptions, rows]
  );

  const catalogComparison = useMemo(() => {
    if (assumptions.costBasisMode === "CATALOG_PURCHASE_RATE") return null;
    return computeProfitTestingSheet(
      { ...assumptions, costBasisMode: "CATALOG_PURCHASE_RATE" },
      rows
    ).summary;
  }, [assumptions, rows]);

  const updateRow = (rowId: string, patch: Partial<ProfitTestingRowInput>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const handleSelectCatalogProduct = (rowId: string, productId: string) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const wasEmpty = !r.item.trim() && r.billedQty === 0 && r.freeQty === 0;
        return {
          ...r,
          productId: product.id,
          item: product.name,
          packing: product.packSize || "10X10 Standard",
          mrp: round2(product.mrp),
          ptr: round2(product.ptr),
          pts: round2(product.pts),
          catalogPurchaseRate: round2(Number(product.purchaseRate || 0)),
          marginStructure: product.marginStructure ?? null,
          billedQty: wasEmpty ? 10 : r.billedQty,
          freeQty: wasEmpty ? 5 : r.freeQty,
          costPerStripOverride: null,
          sellRateOverride: null,
        };
      })
    );
  };

  const handleLoadReferencePreset = () => {
    setAssumptions(DEFAULT_PROFIT_TESTING_ASSUMPTIONS);
    setRows(buildReferenceSheetRows(catalog, 0));
    setActivePreset("REFERENCE");
  };

  const handleLoadLiveCatalog = () => {
    if (catalog.length === 0) return;
    setRows(buildRowsFromCatalogProducts(catalog, 10, 5, 0));
    setActivePreset("CATALOG");
  };

  const handleClearBlank = () => {
    setRows([createBlankTestingRow(1)]);
    setActivePreset("BLANK");
  };

  const applySchemeQtyAllActive = (billedQty: number, freeQty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.item.trim() || r.billedQty > 0 || r.freeQty > 0 ? { ...r, billedQty, freeQty } : r
      )
    );
  };

  const scrollTableBy = (delta: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
    }
  };

  const syncScroll = (source: "TOP" | "MAIN") => {
    if (syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    const topEl = topScrollRef.current;
    const mainEl = tableScrollRef.current;
    if (topEl && mainEl) {
      if (source === "TOP") mainEl.scrollLeft = topEl.scrollLeft;
      else topEl.scrollLeft = mainEl.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      await downloadProfitTestingExcel(assumptions, computedRows, summary);
    } finally {
      setExporting(false);
    }
  };

  const handleCopySummary = async () => {
    const lines = [
      "*PROFIT TESTING SHEET SUMMARY — TREND MR*",
      `Cost Basis: ${assumptions.costBasisMode} | Sell Basis: ${assumptions.sellingPriceBasis}`,
      `Assumptions: Doctor ${assumptions.doctorCommissionPct}% | Purchase GST ${assumptions.purchaseGstPct}% | Sales GST ${assumptions.salesGstPct}% | Other Charges ${formatInr(assumptions.otherCharges)}`,
      `Active SKUs: ${summary.activeRowsCount} (${summary.totalBilledQty} billed + ${summary.totalFreeQty} free = ${summary.totalQty} total strips)`,
      `Billed Sales Excl. GST: ${formatInr(summary.billedSalesExclGst)}`,
      `Sales GST Collected: ${formatInr(summary.salesGstCollected)}`,
      `Invoice Total Incl. GST: ${formatInr(summary.invoiceTotalInclGst)}`,
      `Free Value @ PTR: ${formatInr(summary.freeValueAtPtr)} | Free Strip Cost: ${formatInr(summary.freeStripCost)}`,
      `Purchase Cost Excl. GST: ${formatInr(summary.purchaseCostExclGst)} | Purchase GST Paid (ITC): ${formatInr(summary.purchaseGstPaid)}`,
      `Gross Profit: ${formatInr(summary.grossProfitAfterInputGstCredit)}`,
      `Doctor Commission: ${formatInr(summary.doctorCommission)} | Line-Item Net Profit: ${formatInr(summary.lineItemNetProfitBeforeOtherCharges)}`,
      `Other Charges: ${formatInr(summary.otherCharges)}`,
      `*Net Profit / Earnings:* ${formatInr(summary.netProfitEarnings)} (${formatPct(summary.netMarginPct)})`,
      `Cash Earnings Before ITC: ${formatInr(summary.cashEarningsBeforeInputGstCredit)}`,
      `Input GST Credit (ITC): ${formatInr(summary.inputGstCredit)}`,
    ].join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(lines);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const isPositiveNet = summary.netProfitEarnings >= 0;
  const showFull = columnView === "ALL";

  return (
    <div className="space-y-6 pb-10 min-w-0">
      {/* ── Top Executive Header ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-7 border border-slate-800 shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                <FileSpreadsheet size={12} /> Commercial What-If Workbook
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-[10px] font-bold text-amber-200">
                Read-Only Sandbox — Zero DB Mutations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              Profit Testing Sheet
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
              Blue/amber cells are inputs. Green cells are linked calculated values. PTR is used as the default cost
              basis (switchable to Catalog Purchase Rate). Purchase &amp; Sales GST stay separated so profit, cash outlay,
              and input tax credit remain transparent.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadReferencePreset}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                activePreset === "REFERENCE"
                  ? "bg-amber-400 text-slate-950 border-amber-300"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/15"
              }`}
            >
              <RotateCcw size={13} /> Reference Preset (10+5)
            </button>

            <button
              type="button"
              onClick={handleLoadLiveCatalog}
              disabled={catalogLoading || catalog.length === 0}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 disabled:opacity-50 ${
                activePreset === "CATALOG"
                  ? "bg-indigo-500 text-white border-indigo-400"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/15"
              }`}
            >
              {catalogLoading ? <RefreshCw size={13} className="animate-spin" /> : <Database size={13} />}
              Load Live Catalog ({catalog.length})
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white transition flex items-center gap-1.5"
            >
              {copiedSummary ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedSummary ? "Copied Summary" : "Copy Summary"}
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? "Building .xlsx…" : "Export Formula Excel"}
            </button>
          </div>
        </div>

        {/* Live Telemetry Strip */}
        <div className="relative mt-5 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Billed Sales Excl. GST
            </p>
            <p className="text-xl font-display font-bold text-white mt-0.5 tabular-nums whitespace-nowrap">
              {formatInr(summary.billedSalesExclGst)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.totalBilledQty} billed + {summary.totalFreeQty} free ({summary.totalQty} strips)
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Purchase Outlay Incl. GST
            </p>
            <p className="text-xl font-display font-bold text-amber-300 mt-0.5 tabular-nums whitespace-nowrap">
              {formatInr(summary.purchaseCashOutlayInclGst)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cost: {formatInr(summary.purchaseCostExclGst)} + ITC: {formatInr(summary.purchaseGstPaid)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gross Profit ({assumptions.taxTreatment === "RECOVERABLE_ITC" ? "Excl. ITC" : "Incl. GST"})
            </p>
            <p
              className={`text-xl font-display font-bold mt-0.5 tabular-nums whitespace-nowrap ${
                summary.grossProfitAfterInputGstCredit >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {formatInr(summary.grossProfitAfterInputGstCredit)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Free Value @ PTR: {formatInr(summary.freeValueAtPtr)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Net Profit / Earnings
              </p>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  isPositiveNet ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {formatPct(summary.netMarginPct)}
              </span>
            </div>
            <p
              data-testid="summary-net-profit-hero"
              className={`text-xl font-display font-bold mt-0.5 tabular-nums whitespace-nowrap ${
                isPositiveNet ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatInr(summary.netProfitEarnings)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cash pre-ITC: {formatInr(summary.cashEarningsBeforeInputGstCredit)}
            </p>
          </div>
        </div>
      </section>

      {catalogError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {catalogError}
        </div>
      )}

      {/* ── Key Assumptions Panel (Spacious 3-Column Grid so zero numbers ever clip) ── */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
              <Calculator size={16} className="text-indigo-600" />
              Key Assumptions
            </h2>
            <p className="text-xs text-slate-500">
              Changes recalculate every line item, GST split, cash outlay, and earnings metric immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-sky-900">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Blue / Yellow = Editable Input
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Green = Linked Formula Value
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Doctor commission % */}
          <label className="block rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Doctor commission %
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                aria-label="Doctor commission %"
                value={assumptions.doctorCommissionPct}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    doctorCommissionPct: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className={`w-full min-w-[90px] bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
              />
              <span className="text-xs font-bold text-slate-600 shrink-0">%</span>
            </div>
          </label>

          {/* Other charges */}
          <label className="block rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Other charges (₹)
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm font-bold text-slate-600 shrink-0">₹</span>
              <input
                type="number"
                step="50"
                min="0"
                aria-label="Other charges"
                value={assumptions.otherCharges}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    otherCharges: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className={`w-full min-w-[110px] bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
              />
            </div>
          </label>

          {/* Purchase GST % */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Purchase GST %
              </span>
              <div className="flex gap-1 shrink-0">
                {[0, 5, 12, 18].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setAssumptions((prev) => ({ ...prev, purchaseGstPct: g }))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      assumptions.purchaseGstPct === g
                        ? "bg-sky-700 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g}%
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                aria-label="Purchase GST %"
                value={assumptions.purchaseGstPct}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    purchaseGstPct: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className={`w-full min-w-[90px] bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
              />
              <span className="text-xs font-bold text-slate-600 shrink-0">%</span>
            </div>
          </div>

          {/* Sales GST % */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Sales GST %
              </span>
              <div className="flex gap-1 shrink-0">
                {[0, 5, 12, 18].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setAssumptions((prev) => ({ ...prev, salesGstPct: g }))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      assumptions.salesGstPct === g
                        ? "bg-sky-700 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g}%
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                aria-label="Sales GST %"
                value={assumptions.salesGstPct}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    salesGstPct: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className={`w-full min-w-[90px] bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
              />
              <span className="text-xs font-bold text-slate-600 shrink-0">%</span>
            </div>
          </div>

          {/* Cost basis */}
          <label className="block rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              Cost Basis / Strip
            </span>
            <select
              aria-label="Cost Basis"
              value={assumptions.costBasisMode}
              onChange={(e) =>
                setAssumptions((prev) => ({
                  ...prev,
                  costBasisMode: e.target.value as CostBasisMode,
                }))
              }
              className="mt-1.5 w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="PTR">PTR (Sheet Default)</option>
              <option value="CATALOG_PURCHASE_RATE">Catalog Purchase Rate</option>
              <option value="CATALOG_PTS">Catalog PTS (Stockist)</option>
            </select>
          </label>

          {/* Tax treatment & Selling basis */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 grid grid-cols-1 gap-2.5">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                Tax Treatment
              </span>
              <select
                aria-label="Tax treatment"
                value={assumptions.taxTreatment}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    taxTreatment: e.target.value as TaxTreatment,
                  }))
                }
                className="mt-1 w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="RECOVERABLE_ITC">Purchase GST recoverable (ITC)</option>
                <option value="NON_RECOVERABLE">Purchase GST non-recoverable</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                Selling Price Basis
              </span>
              <select
                aria-label="Selling price basis"
                value={assumptions.sellingPriceBasis}
                onChange={(e) =>
                  setAssumptions((prev) => ({
                    ...prev,
                    sellingPriceBasis: e.target.value as SellingPriceBasis,
                  }))
                }
                className="mt-1 w-full bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="PTR">PTR / strip</option>
                <option value="MRP">MRP / strip</option>
                <option value="PTS">PTS / strip</option>
              </select>
            </label>
          </div>
        </div>

        {/* Quick Scheme & Action Toolbar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Quick Scheme Test:
            </span>
            {[
              { label: "10 + 5 Free", b: 10, f: 5 },
              { label: "10 + 3 Free", b: 10, f: 3 },
              { label: "10 + 2 Free", b: 10, f: 2 },
              { label: "10 + 1 Free", b: 10, f: 1 },
              { label: "10 + 0 Free", b: 10, f: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applySchemeQtyAllActive(preset.b, preset.f)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 text-slate-700 text-[11px] font-bold transition"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, createBlankTestingRow(prev.length + 1)])}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
            >
              <Plus size={13} /> Add Line
            </button>
            <button
              type="button"
              onClick={handleClearBlank}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <Trash2 size={13} /> Clear Sheet
            </button>
          </div>
        </div>
      </section>

      {/* ── Line-by-Line Profit Test Grid ── */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900">
              Line-by-Line Profit Test
            </h2>
            <p className="text-xs text-slate-500">
              Select a SKU in column B, set Billed Qty (D) &amp; Free Qty (E), or overwrite Sell Rate (J) / Cost per Strip (I).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setColumnView("ALL")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  showFull ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Columns size={13} /> All 23 Sheet Columns
              </button>
              <button
                type="button"
                onClick={() => setColumnView("COMPACT")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  !showFull ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compact Fit View
              </button>
            </div>

            {showFull && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollTableBy(-420)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  title="Scroll sheet left"
                  aria-label="Scroll table left"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTableBy(420)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  title="Scroll sheet right"
                  aria-label="Scroll table right"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <span className="text-xs font-bold text-slate-600 tabular-nums ml-1">
              {summary.activeRowsCount} / {computedRows.length} rows
            </span>
          </div>
        </div>

        {/* Top Synchronized Horizontal Scrollbar when showing all 23 columns */}
        {showFull && (
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll("TOP")}
            className="overflow-x-auto border-b border-slate-200 bg-slate-100/70"
            aria-label="Top horizontal table scrollbar"
          >
            <div className="min-w-[2720px] h-3" />
          </div>
        )}

        <div
          ref={tableScrollRef}
          onScroll={() => syncScroll("MAIN")}
          className="overflow-x-auto"
        >
          <table
            className={`${
              showFull ? "min-w-[2720px]" : "min-w-[1260px]"
            } w-full text-xs border-collapse`}
          >
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                <th className="px-2 py-3 text-center border-r border-slate-700 sticky left-0 z-20 bg-slate-900 w-[52px] min-w-[52px] max-w-[52px]">
                  No.
                </th>
                <th className="px-3 py-3 text-left border-r border-slate-700 sticky left-[52px] z-20 bg-slate-900 w-[230px] min-w-[230px] max-w-[230px] shadow-[3px_0_8px_-2px_rgba(0,0,0,0.35)]">
                  Item (Col B)
                </th>
                {showFull && (
                  <th className="px-3 py-3 text-left border-r border-slate-700 min-w-[140px] whitespace-nowrap">
                    Packing
                  </th>
                )}
                <th className="px-2.5 py-3 text-right border-r border-slate-700 bg-sky-950/60 min-w-[92px] whitespace-nowrap">
                  Billed Qty
                </th>
                <th className="px-2.5 py-3 text-right border-r border-slate-700 bg-sky-950/60 min-w-[92px] whitespace-nowrap">
                  Free Qty
                </th>
                {showFull && (
                  <th className="px-2.5 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[84px] whitespace-nowrap">
                    Total Qty
                  </th>
                )}
                <th className="px-2.5 py-3 text-right border-r border-slate-700 min-w-[104px] whitespace-nowrap">
                  MRP
                </th>
                <th className="px-2.5 py-3 text-right border-r border-slate-700 min-w-[104px] whitespace-nowrap">
                  PTR
                </th>
                <th className="px-2.5 py-3 text-right border-r border-slate-700 min-w-[114px] whitespace-nowrap">
                  Cost / Strip
                </th>
                <th className="px-2.5 py-3 text-right border-r border-slate-700 bg-sky-950/60 min-w-[114px] whitespace-nowrap">
                  Sell Rate (J)
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[116px] whitespace-nowrap">
                  Billed Sales
                </th>
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[104px] whitespace-nowrap">
                    Sales GST
                  </th>
                )}
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[118px] whitespace-nowrap">
                    Invoice Total
                  </th>
                )}
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[126px] whitespace-nowrap">
                    Free Value @ PTR
                  </th>
                )}
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[120px] whitespace-nowrap">
                    Free Strip Cost
                  </th>
                )}
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[118px] whitespace-nowrap">
                  Purchase Cost
                </th>
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[110px] whitespace-nowrap">
                    Purchase GST
                  </th>
                )}
                {showFull && (
                  <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[134px] whitespace-nowrap">
                    Cash Outlay Incl. GST
                  </th>
                )}
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[118px] whitespace-nowrap">
                  Gross Profit
                </th>
                <th className="px-2.5 py-3 text-right border-r border-slate-700 bg-sky-950/60 min-w-[88px] whitespace-nowrap">
                  Doctor %
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[114px] whitespace-nowrap">
                  Doctor Cost
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[118px] whitespace-nowrap">
                  Net Profit
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-700 bg-emerald-950/50 min-w-[96px] whitespace-nowrap">
                  Net Margin
                </th>
                <th className="px-2 py-3 text-center w-16 min-w-[64px]">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {computedRows.map((r) => (
                <tr
                  key={r.id}
                  className={r.isActive ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/40 text-slate-400"}
                >
                  <td className="px-2 py-2 text-center font-bold text-slate-600 border-r border-slate-200 sticky left-0 z-10 bg-white w-[52px] min-w-[52px] max-w-[52px]">
                    {r.no}
                  </td>

                  {/* Col B: Item picker + editable input (100% opaque sticky) */}
                  <td className="px-2.5 py-1.5 border-r border-slate-200 sticky left-[52px] z-10 bg-amber-50 w-[230px] min-w-[230px] max-w-[230px] shadow-[3px_0_8px_-2px_rgba(15,23,42,0.1)]">
                    <div className="space-y-1">
                      <select
                        aria-label={`Select catalog product for row ${r.no}`}
                        value={r.productId || ""}
                        onChange={(e) => {
                          if (e.target.value) handleSelectCatalogProduct(r.id, e.target.value);
                        }}
                        className="w-full rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-bold text-sky-950 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">
                          {r.item ? `Selected: ${r.item}` : "Pick SKU from catalog…"}
                        </option>
                        {catalog.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (PTR ₹{p.ptr})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        aria-label={`Item name row ${r.no}`}
                        placeholder="Or type custom item"
                        value={r.item}
                        onChange={(e) => updateRow(r.id, { item: e.target.value, productId: null })}
                        className="w-full bg-transparent px-1 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </td>

                  {/* Col C: Packing */}
                  {showFull && (
                    <td className="px-2.5 py-1.5 border-r border-slate-200 min-w-[140px]">
                      <input
                        type="text"
                        aria-label={`Packing row ${r.no}`}
                        value={r.packing}
                        placeholder="10X10"
                        onChange={(e) => updateRow(r.id, { packing: e.target.value })}
                        className="w-full bg-transparent px-1.5 py-1 rounded hover:bg-slate-100 text-xs text-slate-700 focus:outline-none focus:bg-amber-50"
                      />
                    </td>
                  )}

                  {/* Col D: Billed Qty */}
                  <td className="px-2 py-1.5 border-r border-slate-200 bg-amber-50/70 min-w-[92px]">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Billed Qty row ${r.no}`}
                      value={r.billedQty}
                      onChange={(e) =>
                        updateRow(r.id, { billedQty: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className={`w-full text-right bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
                    />
                  </td>

                  {/* Col E: Free Qty */}
                  <td className="px-2 py-1.5 border-r border-slate-200 bg-amber-50/70 min-w-[92px]">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Free Qty row ${r.no}`}
                      value={r.freeQty}
                      onChange={(e) =>
                        updateRow(r.id, { freeQty: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className={`w-full text-right bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
                    />
                  </td>

                  {/* Col F: Total Qty */}
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold text-emerald-950 tabular-nums whitespace-nowrap min-w-[84px]">
                      {r.isActive ? r.totalQty : "—"}
                    </td>
                  )}

                  {/* Col G: MRP */}
                  <td className="px-2 py-1.5 border-r border-slate-200 min-w-[104px]">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={`MRP row ${r.no}`}
                      value={r.mrp || ""}
                      placeholder="0.00"
                      onChange={(e) => updateRow(r.id, { mrp: Math.max(0, Number(e.target.value) || 0) })}
                      className={`w-full text-right bg-slate-50/70 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 tabular-nums focus:outline-none focus:bg-amber-50 ${NO_SPIN_INPUT}`}
                    />
                  </td>

                  {/* Col H: PTR */}
                  <td className="px-2 py-1.5 border-r border-slate-200 min-w-[104px]">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={`PTR row ${r.no}`}
                      value={r.ptr || ""}
                      placeholder="0.00"
                      onChange={(e) => updateRow(r.id, { ptr: Math.max(0, Number(e.target.value) || 0) })}
                      className={`w-full text-right bg-slate-50/70 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 tabular-nums focus:outline-none focus:bg-amber-50 ${NO_SPIN_INPUT}`}
                    />
                  </td>

                  {/* Col I: Cost / Strip */}
                  <td className="px-2 py-1.5 border-r border-slate-200 bg-emerald-50/40 min-w-[114px]">
                    <div className="flex items-center gap-1">
                      {r.costPerStripOverride !== null && (
                        <button
                          type="button"
                          title="Reset to selected Cost Basis"
                          onClick={() => updateRow(r.id, { costPerStripOverride: null })}
                          className="text-sky-600 hover:text-sky-800 text-xs shrink-0"
                        >
                          ↺
                        </button>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Cost per strip row ${r.no}`}
                        value={r.costPerStripOverride !== null ? r.costPerStripOverride : r.costPerStrip || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateRow(r.id, {
                            costPerStripOverride:
                              e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={`w-full text-right bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-950 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500 ${NO_SPIN_INPUT}`}
                      />
                    </div>
                  </td>

                  {/* Col J: Sell Rate */}
                  <td className="px-2 py-1.5 border-r border-slate-200 bg-amber-50/70 min-w-[114px]">
                    <div className="flex items-center gap-1">
                      {r.sellRateOverride !== null && (
                        <button
                          type="button"
                          title="Reset Sell Rate to Basis"
                          onClick={() => updateRow(r.id, { sellRateOverride: null })}
                          className="text-sky-600 hover:text-sky-800 text-xs shrink-0"
                        >
                          ↺
                        </button>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Sell Rate row ${r.no}`}
                        value={r.sellRateOverride !== null ? r.sellRateOverride : r.sellRate || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateRow(r.id, {
                            sellRateOverride:
                              e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={`w-full text-right bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
                      />
                    </div>
                  </td>

                  {/* Col K: Billed Sales */}
                  <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-semibold text-slate-900 tabular-nums whitespace-nowrap min-w-[116px]">
                    {r.isActive ? formatInr(r.billedSales) : "—"}
                  </td>
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 text-slate-700 tabular-nums whitespace-nowrap min-w-[104px]">
                      {r.isActive ? formatInr(r.salesGst) : "—"}
                    </td>
                  )}
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold text-slate-900 tabular-nums whitespace-nowrap min-w-[118px]">
                      {r.isActive ? formatInr(r.invoiceTotal) : "—"}
                    </td>
                  )}
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 text-indigo-800 tabular-nums whitespace-nowrap min-w-[126px]">
                      {r.isActive ? formatInr(r.freeValueAtPtr) : "—"}
                    </td>
                  )}
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 text-slate-800 tabular-nums whitespace-nowrap min-w-[120px]">
                      {r.isActive ? formatInr(r.freeStripCost) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-semibold text-slate-900 tabular-nums whitespace-nowrap min-w-[118px]">
                    {r.isActive ? formatInr(r.purchaseCost) : "—"}
                  </td>
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 text-amber-800 tabular-nums whitespace-nowrap min-w-[110px]">
                      {r.isActive ? formatInr(r.purchaseGst) : "—"}
                    </td>
                  )}
                  {showFull && (
                    <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-semibold text-slate-900 tabular-nums whitespace-nowrap min-w-[134px]">
                      {r.isActive ? formatInr(r.cashOutlayInclGst) : "—"}
                    </td>
                  )}
                  <td
                    className={`px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold tabular-nums whitespace-nowrap min-w-[118px] ${
                      r.grossProfit < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {r.isActive ? formatInr(r.grossProfit) : "—"}
                  </td>

                  {/* Col T: Doctor % */}
                  <td className="px-2 py-1.5 border-r border-slate-200 bg-amber-50/70 min-w-[88px]">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      aria-label={`Doctor % row ${r.no}`}
                      value={r.doctorPctOverride !== null ? r.doctorPctOverride : assumptions.doctorCommissionPct}
                      onChange={(e) =>
                        updateRow(r.id, {
                          doctorPctOverride:
                            e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={`w-full text-right bg-white border border-sky-200 rounded-lg px-2 py-1.5 text-xs font-bold text-sky-950 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500 ${NO_SPIN_INPUT}`}
                    />
                  </td>

                  {/* Col U..W */}
                  <td className="px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 text-slate-800 tabular-nums whitespace-nowrap min-w-[114px]">
                    {r.isActive ? formatInr(r.doctorCost) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold tabular-nums whitespace-nowrap min-w-[118px] ${
                      r.netProfit < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {r.isActive ? formatInr(r.netProfit) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold tabular-nums whitespace-nowrap min-w-[96px] ${
                      r.netMarginPct < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {r.isActive ? formatPct(r.netMarginPct) : "—"}
                  </td>

                  <td className="px-2 py-2 text-center min-w-[56px]">
                    <button
                      type="button"
                      aria-label={`Remove row ${r.no}`}
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                <td className="px-2 py-3 text-center border-r border-slate-300 sticky left-0 z-10 bg-slate-100 w-[52px] min-w-[52px] max-w-[52px]">
                  Σ
                </td>
                <td className="px-3 py-3 border-r border-slate-300 sticky left-[52px] z-10 bg-slate-100 w-[230px] min-w-[230px] max-w-[230px] shadow-[3px_0_8px_-2px_rgba(15,23,42,0.12)]">
                  LINE TOTAL ({summary.activeRowsCount} SKUs)
                </td>
                {showFull && (
                  <td className="px-3 py-3 border-r border-slate-300 text-slate-500 whitespace-nowrap">
                    —
                  </td>
                )}
                <td className="px-2.5 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {summary.totalBilledQty}
                </td>
                <td className="px-2.5 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {summary.totalFreeQty}
                </td>
                {showFull && (
                  <td className="px-2.5 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                    {summary.totalQty}
                  </td>
                )}
                <td
                  colSpan={4}
                  className="px-2.5 py-3 text-right border-r border-slate-300 text-slate-500 whitespace-nowrap"
                >
                  Line-Item Subtotal (Before Other Charges) →
                </td>
                <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {formatInr(summary.billedSalesExclGst)}
                </td>
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                    {formatInr(summary.salesGstCollected)}
                  </td>
                )}
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                    {formatInr(summary.invoiceTotalInclGst)}
                  </td>
                )}
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 text-indigo-800 tabular-nums whitespace-nowrap">
                    {formatInr(summary.freeValueAtPtr)}
                  </td>
                )}
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                    {formatInr(summary.freeStripCost)}
                  </td>
                )}
                <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {formatInr(summary.purchaseCostExclGst)}
                </td>
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 text-amber-800 tabular-nums whitespace-nowrap">
                    {formatInr(summary.purchaseGstPaid)}
                  </td>
                )}
                {showFull && (
                  <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                    {formatInr(summary.purchaseCashOutlayInclGst)}
                  </td>
                )}
                <td
                  className={`px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap ${
                    summary.grossProfitAfterInputGstCredit < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatInr(summary.grossProfitAfterInputGstCredit)}
                </td>
                <td className="px-2.5 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {formatPct(summary.effectiveDoctorPct)}
                </td>
                <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {formatInr(summary.doctorCommission)}
                </td>
                <td
                  className={`px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap ${
                    summary.lineItemNetProfitBeforeOtherCharges < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatInr(summary.lineItemNetProfitBeforeOtherCharges)}
                </td>
                <td className="px-3 py-3 text-right border-r border-slate-300 tabular-nums whitespace-nowrap">
                  {summary.billedSalesExclGst > 0
                    ? formatPct((summary.lineItemNetProfitBeforeOtherCharges / summary.billedSalesExclGst) * 100)
                    : "0.0%"}
                </td>
                <td className="px-2 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Earnings Summary & How to Use Split Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Complete Reconciled Earnings Summary */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">Earnings Summary</h2>
              <p className="text-xs text-slate-500">
                Line-for-line reconciled GST, ITC credit, other charges, and cash-flow P&amp;L statement
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                isPositiveNet ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {isPositiveNet ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isPositiveNet ? "Net Profitable" : "Net Deficit"}
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            {[
              { label: "Billed sales excl. GST", val: formatInr(summary.billedSalesExclGst) },
              { label: `Sales GST collected (${assumptions.salesGstPct}%)`, val: formatInr(summary.salesGstCollected) },
              { label: "Invoice total incl. GST", val: formatInr(summary.invoiceTotalInclGst), bold: true },
              { label: "Free value @ PTR (not billed)", val: formatInr(summary.freeValueAtPtr), tone: "indigo" },
              { label: "Free strip cost", val: formatInr(summary.freeStripCost) },
              { label: "Purchase cost excl. GST", val: formatInr(summary.purchaseCostExclGst) },
              { label: `Purchase GST paid (${assumptions.purchaseGstPct}%)`, val: formatInr(summary.purchaseGstPaid), tone: "amber" },
              { label: "Purchase cash outlay incl. GST", val: formatInr(summary.purchaseCashOutlayInclGst) },
              {
                label:
                  assumptions.taxTreatment === "RECOVERABLE_ITC"
                    ? "Gross profit after input GST credit"
                    : "Gross profit after non-recoverable GST",
                val: formatInr(summary.grossProfitAfterInputGstCredit),
                bold: true,
                neg: summary.grossProfitAfterInputGstCredit < 0,
                highlight: "green",
              },
              {
                label: `Doctor commission (${formatPct(summary.effectiveDoctorPct)})`,
                val: formatInr(summary.doctorCommission),
              },
              {
                label: "Line-item net profit (before other charges)",
                val: formatInr(summary.lineItemNetProfitBeforeOtherCharges),
                neg: summary.lineItemNetProfitBeforeOtherCharges < 0,
              },
              { label: "Less: Other charges", val: formatInr(summary.otherCharges) },
              {
                label: "Net profit / earnings (Final After Other Charges)",
                val: formatInr(summary.netProfitEarnings),
                bold: true,
                neg: summary.netProfitEarnings < 0,
                highlight: isPositiveNet ? "green" : "rose",
              },
              {
                label: "Net margin (% of Billed Sales)",
                val: formatPct(summary.netMarginPct),
                neg: summary.netMarginPct < 0,
              },
              {
                label: `Return on total cost (${formatInr(summary.totalOperatingCost)})`,
                val: formatPct(summary.returnOnTotalCostPct),
                neg: summary.returnOnTotalCostPct < 0,
              },
              {
                label: "Cash earnings before input GST credit (Net Profit - ITC)",
                val: formatInr(summary.cashEarningsBeforeInputGstCredit),
                bold: true,
                neg: summary.cashEarningsBeforeInputGstCredit < 0,
              },
              {
                label: "Input GST credit (Recoverable ITC)",
                val: formatInr(summary.inputGstCredit),
                tone: "emerald",
              },
              {
                label: "Net GST payable / (ITC credit carryforward)",
                val: formatInr(summary.netGstPosition),
                neg: summary.netGstPosition < 0,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-6 py-2.5 flex items-center justify-between gap-4 ${
                  item.highlight === "green"
                    ? "bg-emerald-50/70"
                    : item.highlight === "rose"
                    ? "bg-rose-50/70"
                    : ""
                }`}
              >
                <span className={`text-xs sm:text-sm ${item.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
                  {item.label}
                </span>
                <span
                  className={`font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap shrink-0 ${
                    item.bold ? "font-extrabold" : "font-semibold"
                  } ${
                    item.neg
                      ? "text-rose-700"
                      : item.tone === "indigo"
                      ? "text-indigo-700"
                      : item.tone === "amber"
                      ? "text-amber-700"
                      : item.tone === "emerald"
                      ? "text-emerald-700"
                      : "text-slate-900"
                  }`}
                >
                  {item.val}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Cost Basis Insight + How to Use */}
        <section className="lg:col-span-5 space-y-6">
          {catalogComparison && (
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles size={11} /> Cost Basis Comparison
                  </span>
                  <h3 className="text-sm font-display font-bold text-slate-900 mt-1.5">
                    Same Scheme @ Actual Catalog Purchase Rate
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAssumptions((prev) => ({
                      ...prev,
                      costBasisMode: "CATALOG_PURCHASE_RATE",
                    }))
                  }
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
                >
                  Switch to Catalog Cost
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                With <strong>PTR</strong> as cost basis and Selling Rate = PTR, giving free goods creates a deficit on
                paper because free strips cost 100% of PTR. Using your live catalog{" "}
                <strong>Purchase Rate</strong> for this exact mix yields:
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Actual Purchase Cost</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5 tabular-nums whitespace-nowrap">
                    {formatInr(catalogComparison.purchaseCostExclGst)}
                  </p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Actual Net Profit</p>
                  <p
                    className={`text-sm font-extrabold mt-0.5 tabular-nums whitespace-nowrap ${
                      catalogComparison.netProfitEarnings >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatInr(catalogComparison.netProfitEarnings)} ({formatPct(catalogComparison.netMarginPct)})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* How to Use Panel */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
              <Info size={16} className="text-sky-600" />
              How to Use
            </h3>
            <ol className="space-y-3 text-xs sm:text-sm text-slate-700">
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <span>
                  Select an item in <strong>column B</strong> from your live PostgreSQL catalog (or type a custom
                  product).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <span>
                  Enter <strong>Billed Qty</strong> in column D and <strong>Free Qty</strong> in column E (or test schemes
                  like 10+5, 10+2 via Quick Scheme Test).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <span>
                  <strong>Selling rate</strong> defaults to PTR; overwrite column J on any row to test another billing
                  rate.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <span>
                  <strong>Purchase GST</strong> is included in Cash Outlay Incl. GST and tracked separately as
                  recoverable Input Tax Credit (ITC).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                  5
                </span>
                <span>
                  Check <strong>Net profit / earnings</strong> for P&amp;L after ITC and{" "}
                  <strong>Cash earnings before input GST credit</strong> for upfront working capital impact. Use{" "}
                  <strong>Compact Fit View</strong> anytime to view core P&amp;L numbers without horizontal scrolling.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
