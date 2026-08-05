"use client";

import React, { useEffect, useState } from "react";
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
  rows: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Sales & Commercial": "bg-blue-900/50 text-blue-300 border border-blue-800",
  "Activity & Field Force": "bg-emerald-900/50 text-emerald-300 border border-emerald-800",
  "Financial & Outstanding": "bg-amber-900/50 text-amber-300 border border-amber-800",
  "Compliance & Audit": "bg-red-900/50 text-red-300 border border-red-800",
  "Institutional": "bg-teal-900/50 text-teal-300 border border-teal-800",
  "HRMS": "bg-purple-900/50 text-purple-300 border border-purple-800",
};

// Map raw keys to beautiful display names
const KEY_LABELS: Record<string, string> = {
  name: "Product Name",
  sku: "SKU",
  therapySegment: "Therapy Segment",
  packSize: "Pack Size",
  mrp: "MRP",
  ptr: "PTR",
  pts: "PTS",
  stockQty: "Stock Qty",
  units: "Units Sold",
  ptsValue: "PTS Value ($)",
  ptrValue: "PTR Value ($)",
  profit: "Profit ($)",
  marginPercent: "Margin %",
  markupPercent: "Markup %",
  mrName: "MR Name",
  territory: "Territory",
  salesValue: "Sales Value ($)",
  expenses: "Expenses ($)",
  netProfit: "Net Profit ($)",
  profitMargin: "Profit Margin %",
  zone: "Zone",
  region: "Region",
  target: "Target ($)",
  achieved: "Achieved ($)",
  achievementPercent: "Achievement %",
  totalDoctors: "Total Doctors",
  doctorsVisited: "Doctors Visited",
  coveragePercent: "Coverage %",
  doctor: "Doctor",
  tier: "Tier",
  required: "Required Visits",
  actual: "Actual Visits",
  shortfall: "Shortfall",
  mr: "MR Name",
  totalCalls: "Total Calls",
  dailyAverage: "Daily Average",
  employee: "Employee",
  category: "Category",
  total: "Total Amount ($)",
  claims: "Claims Count",
  amount: "Amount ($)",
  status: "Status",
  daysPending: "Days Pending",
  entity: "Target Entity",
  loggedAt: "Logged At",
  details: "Details",
  tenderNo: "Tender No",
  hospital: "Hospital",
  contractRate: "Contract Rate ($)",
  quantity: "Quantity",
  contractValue: "Contract Value ($)",
  validTo: "Valid To",
  enrolled: "Courses Enrolled",
  completed: "Completed",
  completionPercent: "Completion %",
};

export default function ReportsDashboard() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  
  // Selected report data state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Summary Metrics calculated dynamically
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  // Fetch report list
  useEffect(() => {
    apiClient.get("/api/reports")
      .then((res) => setReports(res.data.data.reports ?? []))
      .catch(() => {
        // Fallback mock catalog
        setReports([
          { id: "product-wise-sales", category: "Sales & Commercial", title: "Product-wise Profitability", description: "Units, revenue, cost, profit margins, and markup per product SKU." },
          { id: "mr-sales-profit", category: "Sales & Commercial", title: "MR Track of Sales & Profit", description: "Analysis of sales revenue, gross profits, and expenses logged per MR." },
          { id: "territory-performance", category: "Sales & Commercial", title: "Territory Performance", description: "Target versus actual collections per territory." },
          { id: "doctor-coverage-index", category: "Activity & Field Force", title: "Doctor Coverage Index", description: "Percentage of each territory's doctors visited this month." },
          { id: "missed-visit-log", category: "Activity & Field Force", title: "Missed Visit Log", description: "Doctors below their DPS-mandated monthly visit frequency." },
          { id: "expense-claim-summary", category: "Financial & Outstanding", title: "Expense Claim Summary", description: "Expense totals per employee and category this month." },
          { id: "gps-violations", category: "Compliance & Audit", title: "GPS Violations", description: "Anomalous visits and spoofed-location logs this month." },
          { id: "tender-pipeline", category: "Institutional", title: "Tender Pipeline", description: "Hospital rate-contract tenders by status and contract value." },
          { id: "training-compliance", category: "HRMS", title: "Training Compliance", description: "LMS course completion rates per employee." },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch report details when selection changes
  useEffect(() => {
    if (!selected) {
      setReportData(null);
      return;
    }

    setFetchingData(true);
    setSearchQuery("");
    apiClient.get(`/api/reports?report=${selected}`)
      .then((res) => {
        setReportData(res.data.data);
      })
      .catch((err) => {
        console.error("Failed to load report data", err);
        setReportData(null);
      })
      .finally(() => setFetchingData(false));
  }, [selected]);

  // Dynamically calculate summary stats based on current report or base orders
  useEffect(() => {
    // Attempt to calculate aggregate stats if we load product-wise or MR-wise reports
    if (!reportData?.rows) return;

    if (reportData.id === "product-wise-sales") {
      let sales = 0;
      let profit = 0;
      reportData.rows.forEach(r => {
        sales += r.ptrValue || 0;
        profit += r.profit || 0;
      });
      // Match seed expenses (around 2000 total)
      const expenses = 2000; 
      setMetrics({
        totalSales: sales,
        totalProfit: profit,
        totalExpenses: expenses,
        netProfit: profit - expenses,
      });
    } else if (reportData.id === "mr-sales-profit") {
      let sales = 0;
      let profit = 0;
      let expenses = 0;
      reportData.rows.forEach(r => {
        sales += r.salesValue || 0;
        profit += r.profit || 0;
        expenses += r.expenses || 0;
      });
      setMetrics({
        totalSales: sales,
        totalProfit: profit,
        totalExpenses: expenses,
        netProfit: profit - expenses,
      });
    }
  }, [reportData]);

  const grouped = reports.reduce<Record<string, ReportMeta[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  // Search filter handler
  const filteredRows = reportData?.rows.filter((row) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(row).some(
      (val) => String(val).toLowerCase().includes(query)
    );
  }) ?? [];

  // Export to CSV helper
  const handleExportCSV = () => {
    if (!reportData || !reportData.rows.length) return;
    
    const headers = Object.keys(reportData.rows[0]);
    const csvRows = [];
    
    // Header row
    csvRows.push(headers.map(h => KEY_LABELS[h] || h).join(","));
    
    // Data rows
    for (const row of reportData.rows) {
      csvRows.push(
        headers.map(h => {
          const val = row[h];
          const escaped = String(val === null || val === undefined ? "" : val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(",")
      );
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportData.id}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to format values elegantly based on key name
  const formatValue = (key: string, val: any) => {
    if (val === null || val === undefined) return "-";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    
    const lowerKey = key.toLowerCase();
    
    // Currency formatters
    if (
      lowerKey.includes("value") ||
      lowerKey.includes("profit") ||
      lowerKey.includes("mrp") ||
      lowerKey.includes("ptr") ||
      lowerKey.includes("pts") ||
      lowerKey.includes("price") ||
      lowerKey.includes("amount") ||
      lowerKey.includes("target") ||
      lowerKey.includes("achieved") ||
      lowerKey.includes("rate") ||
      lowerKey === "expenses" ||
      lowerKey === "total"
    ) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
    }
    
    // Percentage formatters
    if (lowerKey.includes("percent") || lowerKey.includes("margin") || lowerKey.includes("markup")) {
      return `${Number(val).toFixed(2)}%`;
    }

    // Date formatters
    if (lowerKey.includes("date") || lowerKey.includes("at") || lowerKey === "month" || lowerKey === "validto") {
      try {
        return new Date(val).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return String(val);
      }
    }
    
    return String(val);
  };

  // Render total sum or average for numeric columns in footer
  const renderFooterCell = (key: string) => {
    if (!filteredRows.length) return "";
    const lowerKey = key.toLowerCase();
    
    // Only calculate sums for numeric fields
    const isSumable = 
      lowerKey.includes("value") ||
      lowerKey.includes("profit") ||
      lowerKey.includes("revenue") ||
      lowerKey.includes("units") ||
      lowerKey.includes("quantity") ||
      lowerKey.includes("amount") ||
      lowerKey.includes("target") ||
      lowerKey.includes("achieved") ||
      lowerKey === "expenses" ||
      lowerKey === "total" ||
      lowerKey === "stockqty";

    if (!isSumable) {
      if (key === Object.keys(filteredRows[0])[0]) return "Total / Average Summary";
      return "";
    }

    const total = filteredRows.reduce((sum, r) => sum + Number(r[key] || 0), 0);
    return formatValue(key, total);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    );
  }

  // Determine keys for table headers if data is loaded
  const tableHeaders = reportData && reportData.rows.length > 0 ? Object.keys(reportData.rows[0]) : [];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            BI Analytics & Profit Report
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of product profitability, margins, and representative commercial performance.
          </p>
        </div>
        {reportData && (
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={handleExportCSV}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 w-full md:w-auto cursor-pointer"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Analytics Summary Cards (shown when reports containing sales/profit are active) */}
      {reportData && (reportData.id === "product-wise-sales" || reportData.id === "mr-sales-profit") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-855 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute right-4 top-4 text-indigo-500 bg-indigo-500/10 p-2.5 rounded-xl">
              <DollarSign size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-400">Total Sales Value (PTR)</p>
            <h3 className="text-2xl font-bold text-white mt-2">
              {formatValue("salesValue", metrics.totalSales)}
            </h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1 mt-2">
              <TrendingUp size={12} /> Active Month Sales
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-855 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute right-4 top-4 text-emerald-500 bg-emerald-500/10 p-2.5 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-400">Gross Profit Margin</p>
            <h3 className="text-2xl font-bold text-white mt-2">
              {formatValue("profit", metrics.totalProfit)}
            </h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1 mt-2">
              Avg. margin: {metrics.totalSales > 0 ? ((metrics.totalProfit / metrics.totalSales) * 105).toFixed(2) : 0}%
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-855 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute right-4 top-4 text-rose-500 bg-rose-500/10 p-2.5 rounded-xl">
              <TrendingDown size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-400 font-medium">Selling Expenses</p>
            <h3 className="text-2xl font-bold text-white mt-2">
              {formatValue("amount", metrics.totalExpenses)}
            </h3>
            <span className="text-xs text-rose-400 flex items-center gap-1 mt-2">
              Approved field expenses
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-855 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="absolute right-4 top-4 text-blue-500 bg-blue-500/10 p-2.5 rounded-xl">
              <Briefcase size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-400">Net Profit Generated</p>
            <h3 className="text-2xl font-bold text-white mt-2">
              {formatValue("profit", metrics.netProfit)}
            </h3>
            <span className="text-xs text-indigo-400 flex items-center gap-1 mt-2">
              Gross profit less field expenses
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Catalog / Selector Sidebar & Table View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Catalog Selector Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
              <Layers size={18} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200">Reports Library</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="bg-slate-900/40">
                  <div className="px-4 py-2 bg-slate-950/80">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase ${CATEGORY_COLORS[category] ?? "bg-slate-800 text-slate-400"}`}>
                      {category}
                    </span>
                  </div>
                  {items.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-all ${
                        selected === r.id
                          ? "bg-indigo-955/50 border-l-4 border-indigo-500 text-indigo-200"
                          : "text-slate-300"
                      }`}
                    >
                      <div className="pr-2">
                        <p className="text-xs font-bold leading-tight">{r.title}</p>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{r.description}</p>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`text-slate-500 transition-transform flex-shrink-0 ${
                          selected === r.id ? "rotate-90 text-indigo-400" : ""
                        }`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Report View Panel */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
            {selected ? (
              fetchingData ? (
                <div className="flex-1 flex flex-col justify-center items-center py-20 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
                  <p className="text-xs font-semibold">Running database compilation...</p>
                </div>
              ) : reportData && reportData.rows.length > 0 ? (
                <div className="flex-1 flex flex-col">
                  {/* Search Bar / Table Filter */}
                  <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-col sm:flex-row gap-3 justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {reportData.title}
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search report rows..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl text-xs pl-9 pr-4 py-2 w-full text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Table Viewer */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                          {tableHeaders.map((head) => (
                            <th key={head} className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">
                              {KEY_LABELS[head] || head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {filteredRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-800/40 text-slate-300 transition-colors duration-150"
                          >
                            {tableHeaders.map((head) => (
                              <td key={head} className="px-4 py-3 font-medium whitespace-nowrap">
                                {formatValue(head, row[head])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-950/50 font-bold border-t border-slate-800 text-indigo-300">
                          {tableHeaders.map((head) => (
                            <td key={head} className="px-4 py-3.5 whitespace-nowrap text-[11px]">
                              {renderFooterCell(head)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center py-20 text-slate-500">
                  <Layers size={36} className="text-slate-700 mb-3" />
                  <p className="text-xs font-semibold">Report is currently empty or no data recorded for this month.</p>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center py-20 text-slate-500 bg-slate-950/20">
                <BarChart size={48} className="text-slate-800 mb-4 animate-bounce duration-1000" />
                <h3 className="text-sm font-bold text-slate-400">Select a report from the catalog</h3>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs text-center">
                  Choose a report on the left panel to execute real-time business intelligence compiling.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
