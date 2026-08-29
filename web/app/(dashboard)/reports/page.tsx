"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  PieChart,
  TrendingUp,
  Download,
  Filter,
  ChevronRight,
  Layers,
  Search,
  DollarSign,
  Briefcase,
  TrendingDown,
  Percent,
  FileSpreadsheet,
  Printer,
  Calendar,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  CheckCircle2,
  Table as TableIcon,
  BarChart3,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ReportMeta {
  id: string;
  category: string;
  title: string;
  description: string;
}

interface ReportData {
  id: string;
  title: string;
  category: string;
  timeframe?: string;
  dateRange?: { startDate: string; endDate?: string };
  rows: any[];
  summary?: { totalExpenses?: number };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Sales & Commercial": "bg-blue-900/40 text-blue-300 border border-blue-800",
  "Activity & Field Force": "bg-emerald-900/40 text-emerald-300 border border-emerald-800",
  "Financial & Outstanding": "bg-amber-900/40 text-amber-300 border border-amber-800",
  "Compliance & Audit": "bg-red-900/40 text-red-300 border border-red-800",
  "Institutional": "bg-teal-900/40 text-teal-300 border border-teal-800",
  "HRMS": "bg-purple-900/40 text-purple-300 border border-purple-800",
};

// Map raw keys to beautiful display names
const KEY_LABELS: Record<string, string> = {
  name: "Product Name",
  sku: "SKU",
  therapySegment: "Therapy Segment",
  packSize: "Pack Size",
  mrp: "MRP (₹)",
  ptr: "PTR (₹)",
  pts: "PTS (₹)",
  stockQty: "Stock Qty",
  units: "Units Sold",
  ptsValue: "PTS Value (₹)",
  ptrValue: "PTR Value (₹)",
  profit: "Profit (₹)",
  marginPercent: "Margin %",
  markupPercent: "Markup %",
  mrName: "MR Name",
  territory: "Territory",
  salesValue: "Sales Value (₹)",
  expenses: "Expenses (₹)",
  netProfit: "Net Profit (₹)",
  profitMargin: "Profit Margin %",
  zone: "Zone",
  region: "Region",
  target: "Target (₹)",
  achieved: "Achieved (₹)",
  achievementPercent: "Achievement %",
  totalDoctors: "Total Doctors",
  doctorsVisited: "Doctors Visited",
  coveragePercent: "Coverage %",
  doctor: "Doctor",
  specialty: "Specialty",
  tier: "DPS Tier",
  dpsScore: "DPS Score",
  patientFootfall: "Daily Footfall",
  avgPrescriptions: "Daily Rx",
  requiredVisits: "Required Visits",
  actualVisits: "Actual Visits",
  adherencePct: "Adherence %",
  isKol: "Category",
  required: "Required Visits",
  actual: "Actual Visits",
  shortfall: "Shortfall",
  mr: "MR Name",
  totalCalls: "Total Calls",
  dailyAverage: "Daily Average",
  plannedDays: "Planned Tour Days",
  planStatus: "Plan Status",
  adherenceScore: "Adherence Score",
  allocatedQty: "Allocated Qty",
  distributedQty: "Distributed Qty",
  balanceStock: "Balance Stock",
  stockValue: "Stock Value",
  chemist: "Chemist Name",
  contactPerson: "Contact Person",
  creditLimit: "Credit Limit (₹)",
  totalBilled: "Total Billed (₹)",
  totalCollected: "Total Collected (₹)",
  outstanding: "Outstanding (₹)",
  utilizationPct: "Limit Utilized",
  riskCategory: "Risk Tier",
  invoiceNo: "Invoice No",
  orderNo: "Order No",
  partyName: "Party / Chemist",
  gstin: "GSTIN",
  taxableValue: "Taxable Value (₹)",
  cgstAmount: "CGST 6% (₹)",
  sgstAmount: "SGST 6% (₹)",
  totalGst: "Total GST (₹)",
  roundOff: "Round Off (₹)",
  grandTotal: "Grand Total (₹)",
  employee: "Employee",
  category: "Category",
  total: "Total Amount (₹)",
  claims: "Claims Count",
  amount: "Amount (₹)",
  status: "Status",
  daysPending: "Days Pending",
  entity: "Target Entity",
  loggedAt: "Logged At",
  details: "Details",
  tenderNo: "Tender No",
  hospital: "Hospital",
  contractRate: "Contract Rate (₹)",
  quantity: "Quantity",
  contractValue: "Contract Value (₹)",
  validTo: "Valid To",
  enrolled: "Courses Enrolled",
  completed: "Completed",
  quizScore: "Avg Quiz Score",
  completionPercent: "Completion %",
};

export default function ReportsDashboard() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>("product-wise-sales");
  const [timeframe, setTimeframe] = useState<string>("this_month");
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // Selected report data state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Sorting state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch report list
  useEffect(() => {
    apiClient.get("/api/reports")
      .then((res) => {
        const list = res.data.data.reports ?? [];
        setReports(list);
        if (list.length > 0 && !selected) {
          setSelected(list[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch reports catalog", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch report details when selection or timeframe changes
  const fetchReportData = (reportId: string, tf: string) => {
    setFetchingData(true);
    apiClient.get(`/api/reports?report=${reportId}&timeframe=${tf}`)
      .then((res) => {
        setReportData(res.data.data);
      })
      .catch((err) => {
        console.error(`Failed to fetch report data for ${reportId}`, err);
      })
      .finally(() => setFetchingData(false));
  };

  useEffect(() => {
    if (selected) {
      fetchReportData(selected, timeframe);
    }
  }, [selected, timeframe]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set(reports.map((r) => r.category));
    return ["ALL", ...Array.from(set)];
  }, [reports]);

  // Filtered reports in sidebar
  const visibleReports = useMemo(() => {
    return reports.filter((r) => {
      const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
      return matchCat;
    });
  }, [reports, categoryFilter]);

  // Sorted and searched rows
  const displayRows = useMemo(() => {
    if (!reportData?.rows) return [];
    let rows = [...reportData.rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(q)
        )
      );
    }

    if (sortKey) {
      rows.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return sortOrder === "asc"
          ? String(valA || "").localeCompare(String(valB || ""))
          : String(valB || "").localeCompare(String(valA || ""));
      });
    }

    return rows;
  }, [reportData, searchQuery, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // Dynamic KPI calculations
  const dynamicKpis = useMemo(() => {
    if (!displayRows.length) return null;
    const count = displayRows.length;

    // Detect primary numeric column
    const sampleRow = displayRows[0];
    const numericKeys = Object.keys(sampleRow).filter((k) => typeof sampleRow[k] === "number");

    if (!numericKeys.length) return { count, primaryTotal: null, primaryAvg: null, keyName: null };

    // Prefer value, ptrValue, salesValue, amount, actual, totalCalls
    const priority = ["ptrValue", "salesValue", "grandTotal", "totalBilled", "outstanding", "total", "amount", "totalCalls", "shortfall", "profit"];
    const chosenKey = priority.find((k) => numericKeys.includes(k)) || numericKeys[0];

    const sum = displayRows.reduce((acc, r) => acc + (Number(r[chosenKey]) || 0), 0);
    const avg = sum / count;

    return {
      count,
      primaryTotal: sum,
      primaryAvg: avg,
      keyName: KEY_LABELS[chosenKey] || chosenKey,
    };
  }, [displayRows]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!displayRows.length) return;
    const keys = Object.keys(displayRows[0]);
    const headers = keys.map((k) => `"${KEY_LABELS[k] || k}"`).join(",");
    const csvRows = displayRows.map((r) =>
      keys.map((k) => {
        const val = r[k];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );

    const csvContent = "\uFEFF" + [headers, ...csvRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selected}_${timeframe}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Executive View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary-600/20 text-primary-400 rounded-lg border border-primary-500/30">
              <BarChart3 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Executive BI & Pharmaceutical Reports
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Live Sync
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Multi-dimensional business analytics, field compliance audits, commercial tracking, and GST reporting.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => selected && fetchReportData(selected, timeframe)}
            disabled={fetchingData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
            title="Refresh live data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetchingData ? "animate-spin text-primary-400" : ""}`} />
            Sync
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!displayRows.length}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg border border-emerald-600 transition shadow-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!displayRows.length}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-lg border border-primary-500 transition shadow-sm disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* Main Grid Layout: Sidebar Report Catalog + Content Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Catalog & Categories */}
        <div className="lg:col-span-1 space-y-4">
          {/* Category Filter Pills */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Filter className="w-3.5 h-3.5 text-primary-400" /> Filter Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
                    categoryFilter === cat
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {cat === "ALL" ? "All Categories" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Reports Navigation List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1 max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-500 animate-pulse">Loading report catalog...</div>
            ) : (
              visibleReports.map((r) => {
                const isSelected = selected === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`w-full text-left p-3 rounded-lg transition group flex items-start justify-between border ${
                      isSelected
                        ? "bg-primary-950/60 border-primary-500/50 text-white shadow-inner"
                        : "bg-transparent border-transparent hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[r.category] || "bg-slate-800 text-slate-300"}`}>
                          {r.category}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white group-hover:text-primary-300 transition">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {r.description}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 mt-1 transition ${isSelected ? "text-primary-400 translate-x-0.5" : "text-slate-600 opacity-0 group-hover:opacity-100"}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Panel: Report Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Controls Bar: Timeframe & Search */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Timeframe Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-primary-400" /> Timeframe:
              </span>
              {[
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "qtd", label: "Quarter (QTD)" },
                { id: "ytd", label: "Fiscal (YTD)" },
                { id: "all", label: "All Time" },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                    timeframe === tf.id
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* View Mode & Search */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                    viewMode === "table" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("chart")}
                  className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                    viewMode === "chart" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Visual Analytics Chart"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 w-44 md:w-56"
                />
              </div>
            </div>
          </div>

          {/* Active Report Header & KPI Ribbon */}
          {reportData && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[reportData.category] || "bg-slate-800 text-slate-300"}`}>
                      {reportData.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Scope: {timeframe.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{reportData.title}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Showing</span>
                  <p className="text-base font-bold text-primary-400">
                    {displayRows.length} <span className="text-xs font-normal text-slate-400">Records</span>
                  </p>
                </div>
              </div>

              {/* Dynamic KPI Strip */}
              {dynamicKpis && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                    <p className="text-[11px] text-slate-400 font-medium">Dataset Count</p>
                    <p className="text-lg font-bold text-white mt-0.5">{dynamicKpis.count}</p>
                  </div>
                  {dynamicKpis.primaryTotal !== null && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                      <p className="text-[11px] text-slate-400 font-medium">Total {dynamicKpis.keyName}</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">
                        {dynamicKpis.primaryTotal >= 100000
                          ? `₹${(dynamicKpis.primaryTotal / 100000).toFixed(2)}L`
                          : typeof dynamicKpis.primaryTotal === "number" && dynamicKpis.primaryTotal % 1 !== 0
                          ? dynamicKpis.primaryTotal.toFixed(2)
                          : dynamicKpis.primaryTotal.toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                  {dynamicKpis.primaryAvg !== null && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                      <p className="text-[11px] text-slate-400 font-medium">Average per Row</p>
                      <p className="text-lg font-bold text-blue-400 mt-0.5">
                        {(dynamicKpis.primaryAvg as number).toFixed(1)}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                    <p className="text-[11px] text-slate-400 font-medium">Report Integrity</p>
                    <p className="text-lg font-bold text-teal-400 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> 100% DB Live
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Container: Table or Visual Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {fetchingData ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-400" />
                <p className="text-xs">Computing report from live database...</p>
              </div>
            ) : !displayRows.length ? (
              <div className="p-12 text-center text-slate-500 space-y-1">
                <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No records found</p>
                <p className="text-xs">Try selecting a different timeframe or adjusting your search query.</p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto max-h-[580px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800/90 text-slate-300 sticky top-0 z-10 backdrop-blur">
                    <tr>
                      <th className="p-3 border-b border-slate-700 font-semibold text-slate-400 w-12 text-center">#</th>
                      {Object.keys(displayRows[0]).map((key) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className="p-3 border-b border-slate-700 font-semibold text-slate-200 cursor-pointer hover:bg-slate-700/60 transition whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{KEY_LABELS[key] || key}</span>
                            {sortKey === key ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="w-3 h-3 text-primary-400" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-primary-400" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-40 hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 text-slate-500 font-mono text-center">{idx + 1}</td>
                        {Object.keys(displayRows[0]).map((key) => {
                          const val = row[key];
                          const isNumber = typeof val === "number";
                          const isFormattedAmount = key.toLowerCase().includes("value") || key.toLowerCase().includes("amount") || key.toLowerCase().includes("profit") || key.toLowerCase().includes("billed") || key.toLowerCase().includes("collected") || key.toLowerCase().includes("outstanding") || key.toLowerCase().includes("target") || key.toLowerCase().includes("achieved") || key.toLowerCase().includes("rate");

                          return (
                            <td key={key} className="p-3 text-slate-200 whitespace-nowrap font-medium">
                              {val === null || val === undefined ? (
                                <span className="text-slate-600">-</span>
                              ) : key === "riskCategory" || key === "status" || key === "planStatus" ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  val === "HEALTHY" || val === "PAID" || val === "APPROVED" || val === "ADEQUATE"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : val === "HIGH_RISK" || val === "OUTSTANDING" || val === "LOW_STOCK" || val === "REJECTED"
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                }`}>
                                  {String(val)}
                                </span>
                              ) : isNumber && isFormattedAmount ? (
                                <span className="font-mono text-slate-100">
                                  ₹{val.toLocaleString("en-IN")}
                                </span>
                              ) : isNumber ? (
                                <span className="font-mono text-slate-200">{val.toLocaleString("en-IN")}</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Visual Analytics Chart View */
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Top Distribution Ranking</h3>
                  <span className="text-xs text-slate-400">Sorted by primary metric</span>
                </div>
                <div className="space-y-3">
                  {displayRows.slice(0, 10).map((row, idx) => {
                    const labelKey = Object.keys(row).find((k) => typeof row[k] === "string" && !k.includes("Date") && !k.includes("Id")) || Object.keys(row)[0];
                    const numKey = Object.keys(row).find((k) => typeof row[k] === "number") || Object.keys(row)[1];
                    const label = String(row[labelKey] || `Item ${idx + 1}`);
                    const val = Number(row[numKey] || 0);
                    const maxVal = Math.max(...displayRows.map((r) => Number(r[numKey] || 0))) || 1;
                    const pct = Math.min(100, Math.max(5, (val / maxVal) * 100));

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200 truncate max-w-xs">{label}</span>
                          <span className="text-primary-400 font-mono">
                            {KEY_LABELS[numKey] || numKey}: {val.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
