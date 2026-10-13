"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  MessageCircle,
  Calculator,
  Cpu,
  Copy,
  Check,
  X,
  FileDown,
  Compass,
  Building2,
  Users,
  ShieldCheck,
  Award,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { downloadExcelReportWithDashboard } from "@/lib/excel-export";

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
  "Sales & Commercial": "bg-blue-900/40 text-blue-300 border border-blue-800/80",
  "Activity & Field Force": "bg-emerald-900/40 text-emerald-300 border border-emerald-800/80",
  "Financial & Outstanding": "bg-amber-900/40 text-amber-300 border border-amber-800/80",
  "Compliance & Audit": "bg-rose-900/40 text-rose-300 border border-rose-800/80",
  "Institutional": "bg-teal-900/40 text-teal-300 border border-teal-800/80",
  "HRMS": "bg-purple-900/40 text-purple-300 border border-purple-800/80",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Sales & Commercial": <DollarSign className="w-3.5 h-3.5" />,
  "Activity & Field Force": <Compass className="w-3.5 h-3.5" />,
  "Financial & Outstanding": <Calculator className="w-3.5 h-3.5" />,
  "Compliance & Audit": <ShieldCheck className="w-3.5 h-3.5" />,
  "Institutional": <Building2 className="w-3.5 h-3.5" />,
  "HRMS": <Award className="w-3.5 h-3.5" />,
};

// Map raw keys to executive display labels
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
  molecule: "Active Molecule / Salt",
  brandNames: "Brand SKUs",
  skuCount: "SKUs Count",
  unitsSold: "Units Sold",
  deliveredUnits: "Delivered Units",
  freeQty: "Free Bonus Qty",
  revenue: "Revenue (₹)",
  cost: "COGS Cost (₹)",
  grossProfit: "Gross Profit (₹)",
  totalStock: "Total Stock (Units)",
  avgSellingPrice: "Avg Selling Price (₹)",
  activeDoctorsPrescribing: "Prescribing Doctors",
  location: "GPS Coordinates",
  address: "Address",
  totalOrders: "Total Orders",
  lastVisitDate: "Last Visited",
  lastVisitedMr: "Last Visited MR",
  daysSinceVisit: "Days Since Visit",
  lastLocation: "Last Known GPS Coordinates",
  lastLocationTime: "Last Ping Time",
  locationSource: "Location Telemetry Source",
  gpsStatus: "GPS Telemetry Status",
  lastVisitedEntity: "Last Visited Stop",
  doctorCalls: "Doctor Calls",
  chemistCalls: "Chemist Calls",
  collectionsRealized: "Collections Realized (₹)",
  approvedExpenses: "Approved Expenses (₹)",
  netContribution: "Net Contribution (₹)",
  dailyCallAverage: "Daily Call Avg",
  clinicLocation: "Clinic GPS Coordinates",
  prescribedUnits: "Prescribed Units (Rx)",
  samplesDropped: "Samples Dropped",
  productName: "Product Name",
  batchNo: "Batch Number",
  mfgDate: "Mfg Date",
  expDate: "Expiry Date",
  daysToExpiry: "Days to Expiry",
  expiryRisk: "Expiry Risk Tier",
  mrLocation: "MR Recorded GPS",
  targetLocation: "Entity Registered GPS",
  distanceMeters: "Geofence Distance (m)",
  geofenceStatus: "Geofence Status",
  cqsScore: "Call Quality (CQS)",
  visitTime: "Visit Timestamp",
  entityVisited: "Entity Visited",
  entityType: "Entity Type",
  secondarySales: "Secondary Sales (₹)",
  primaryAttainment: "Target Attainment %",
  collectionEfficiency: "Collection Efficiency",
  activeChemists: "Active Chemist Accounts",
};

export default function ReportsDashboard() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>("molecule-sales-summary");
  const [timeframe, setTimeframe] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // Selected report data state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Sorting state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Clipboard copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Multi-Agent Council Telemetry state
  const [councilSynthesis, setCouncilSynthesis] = useState<{
    score: number;
    grade: string;
    summary: string;
    totalMrs: number;
  } | null>(null);

  // Direct export spinner
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Fetch Multi-Agent Council summary
  useEffect(() => {
    apiClient
      .get("/api/mr/reports/multi-agent?period=monthly")
      .then((res) => {
        const list = res.data?.data?.reports || (Array.isArray(res.data?.data) ? res.data.data : []);
        if (list.length > 0) {
          const avgScore = Math.round(
            list.reduce((s: number, r: any) => s + (r.councilEvaluation?.councilScore || 0), 0) / list.length
          );
          const grade = avgScore >= 90 ? "A+" : avgScore >= 80 ? "A" : avgScore >= 70 ? "B" : "C";
          setCouncilSynthesis({
            score: avgScore,
            grade,
            summary: `Multi-Agent Council evaluated ${list.length} active field representatives across India.`,
            totalMrs: list.length,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch report catalog
  useEffect(() => {
    apiClient
      .get("/api/reports")
      .then((res) => {
        const list = res.data?.data?.reports ?? [];
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
    apiClient
      .get(`/api/reports?report=${reportId}&timeframe=${tf}`)
      .then((res) => {
        setReportData(res.data?.data);
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
      const matchSearch =
        !reportSearch.trim() ||
        r.title.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(reportSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [reports, categoryFilter, reportSearch]);

  // Sorted and searched rows
  const displayRows = useMemo(() => {
    if (!reportData?.rows) return [];
    let rows = [...reportData.rows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) => String(val).toLowerCase().includes(q))
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

  // Copy coordinates helper
  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
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

    // Prefer value, ptrValue, salesValue, amount, actual, totalCalls, revenue, grossProfit
    const priority = [
      "revenue",
      "salesValue",
      "ptrValue",
      "grandTotal",
      "totalBilled",
      "outstanding",
      "grossProfit",
      "totalStock",
      "totalCalls",
      "amount",
      "total",
      "shortfall",
    ];
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

  // Export to Professional Excel (.xlsx) with Executive Dashboard & Potential Customer Highlights
  const handleExportExcel = async (exportFilteredOnly: boolean = true) => {
    if (!reportData?.rows?.length) return;
    const rowsToExport = exportFilteredOnly ? displayRows : reportData.rows;
    if (!rowsToExport.length) return;

    setExportingExcel(true);
    try {
      const keys = Object.keys(rowsToExport[0]);
      const detailHeaders = keys.map((k) => KEY_LABELS[k] || k);
      const detailRows = rowsToExport.map((r) =>
        keys.map((k) => {
          const val = r[k];
          return val === null || val === undefined ? "" : val;
        })
      );

      const activeMeta = reports.find((r) => r.id === selected);
      const activeTitle = activeMeta?.title || (selected ? selected.replace(/-/g, " ").toUpperCase() : "Pharmaceutical Report");
      const activeDesc = exportFilteredOnly && searchQuery.trim()
        ? `Filtered Search View: "${searchQuery}" (${rowsToExport.length} of ${reportData.rows.length} records)`
        : activeMeta?.description || "Executive Multi-Dimensional Business Intelligence";

      const kpis = [
        { label: "Report Domain", value: activeTitle, note: "Analytical Domain" },
        {
          label: "Exported Records",
          value: rowsToExport.length,
          note: exportFilteredOnly && searchQuery.trim() ? `Filtered by "${searchQuery}"` : "Reconciled DB Dataset",
        },
        { label: "Reporting Cycle", value: timeframe.toUpperCase(), note: "Active Timeframe" },
      ];

      if (exportFilteredOnly && searchQuery.trim()) {
        kpis.push({
          label: "Search Filter Query",
          value: `"${searchQuery}"`,
          note: `Matches: ${rowsToExport.length} records`,
        });
      }

      // Add numeric aggregates if any exist in the rows
      for (const k of keys) {
        if (typeof rowsToExport[0][k] === "number" && !k.toLowerCase().includes("id")) {
          const sum = rowsToExport.reduce((acc, row) => acc + (Number(row[k]) || 0), 0);
          const isCurrency =
            k.toLowerCase().includes("amount") ||
            k.toLowerCase().includes("value") ||
            k.toLowerCase().includes("revenue") ||
            k.toLowerCase().includes("profit") ||
            k.toLowerCase().includes("billed") ||
            k.toLowerCase().includes("collected") ||
            k.toLowerCase().includes("outstanding") ||
            k.toLowerCase().includes("price");
          kpis.push({
            label: `Total ${KEY_LABELS[k] || k}`,
            value: isCurrency ? `₹${sum.toLocaleString("en-IN")}` : sum.toLocaleString("en-IN"),
            note: "Computed aggregate sum",
          });
          if (kpis.length >= 6) break;
        }
      }

      // Fetch live Potential Customer Intelligence concurrently
      let potentialTable: { headers: string[]; rows: (string | number)[][] } | undefined = undefined;
      let potSummary: any = undefined;

      try {
        const res = await fetch("/api/reports/potential-customers?limit=40");
        if (res.ok) {
          const data = await res.json();
          if (data && data.topOpportunities) {
            potSummary = {
              vipKolCount: data.vipKolCount,
              coreTierCount: data.coreTierCount,
              growthTierCount: data.growthTierCount,
              retainTierCount: data.retainTierCount,
              totalEstimatedMonthlyPotentialInr: data.totalEstimatedMonthlyPotentialInr,
              urgentFollowupsCount: data.urgentFollowupsCount,
            };

            potentialTable = {
              headers: [
                "Customer / Account Name",
                "Entity Type",
                "Specialty / Category",
                "Territory",
                "Assigned MR",
                "Potential Tier",
                "Score",
                "Daily Footfall",
                "Est. Monthly Value",
                "Current Stage",
                "Urgency Window",
                "Conversion Highlights & Strategic Value Points",
                "Recommended Tactical Next Action",
              ],
              rows: data.topOpportunities.map((item: any) => [
                item.name,
                item.customerType,
                item.specialty,
                item.territory,
                item.assignedMr,
                item.potentialTier,
                item.potentialScore,
                item.dailyPatientFootfall,
                `₹${(item.estimatedMonthlyValueInr || 0).toLocaleString("en-IN")}`,
                item.currentStage,
                item.urgencyLevel,
                (item.keyHighlightPoints || []).join(" | "),
                item.recommendedTacticalAction,
              ]),
            };
          }
        }
      } catch (err) {
        console.warn("Potential customer fetch fallback:", err);
      }

      const searchTag = exportFilteredOnly && searchQuery.trim()
        ? `_Filtered_${searchQuery.replace(/[^a-zA-Z0-9]/g, "_")}`
        : "_Full";
      const filename = `Metapharsic_${selected}_${timeframe}${searchTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      await downloadExcelReportWithDashboard(
        {
          reportTitle: activeTitle,
          reportSubtitle: activeDesc,
          period: timeframe.toUpperCase(),
          searchFilterQuery: exportFilteredOnly && searchQuery.trim() ? searchQuery.trim() : undefined,
          kpis,
          potentialCustomersTable: potentialTable,
          potentialCustomerSummary: potSummary,
          detailHeaders,
          detailRows,
        },
        filename
      );
    } catch (e) {
      console.error("Excel export error:", e);
    } finally {
      setExportingExcel(false);
    }
  };

  // Direct export of any report directly from the sidebar without needing to open it
  const exportReportDirectly = async (reportId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setExportingReportId(reportId);
    try {
      const res = await apiClient.get(`/api/reports?report=${reportId}&timeframe=${timeframe}`);
      const repData = res.data?.data;
      if (!repData || !repData.rows || !repData.rows.length) {
        alert("No data records available for this report in the selected timeframe.");
        return;
      }

      const rows = repData.rows;
      const keys = Object.keys(rows[0]);
      const detailHeaders = keys.map((k) => KEY_LABELS[k] || k);
      const detailRows = rows.map((r: any) =>
        keys.map((k) => {
          const val = r[k];
          return val === null || val === undefined ? "" : val;
        })
      );

      const repMeta = reports.find((r) => r.id === reportId);
      const title = repMeta?.title || repData.title || reportId.toUpperCase();
      const desc = repMeta?.description || repData.category;

      const kpis = [
        { label: "Report Domain", value: title, note: "Executive Intelligence Report" },
        { label: "Total Audited Records", value: rows.length, note: "Live Database Reconciliation" },
        { label: "Reporting Cycle", value: timeframe.toUpperCase(), note: "Selected Timeframe" },
      ];

      for (const k of keys) {
        if (typeof rows[0][k] === "number" && !k.toLowerCase().includes("id")) {
          const sum = rows.reduce((acc: number, row: any) => acc + (Number(row[k]) || 0), 0);
          const isCurr =
            k.toLowerCase().includes("amount") ||
            k.toLowerCase().includes("value") ||
            k.toLowerCase().includes("revenue") ||
            k.toLowerCase().includes("profit") ||
            k.toLowerCase().includes("cost") ||
            k.toLowerCase().includes("price");
          kpis.push({
            label: `Total ${KEY_LABELS[k] || k}`,
            value: isCurr ? `₹${sum.toLocaleString("en-IN")}` : sum.toLocaleString("en-IN"),
            note: "Computed Column Sum",
          });
          if (kpis.length >= 6) break;
        }
      }

      const filename = `Metapharsic_${reportId}_${timeframe}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await downloadExcelReportWithDashboard(
        {
          reportTitle: title,
          reportSubtitle: desc,
          period: timeframe.toUpperCase(),
          kpis,
          detailHeaders,
          detailRows,
        },
        filename
      );
    } catch (err) {
      console.error("Direct export error:", err);
    } finally {
      setExportingReportId(null);
    }
  };

  // Print Executive View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-gradient-to-br from-primary-600 to-indigo-700 text-white rounded-xl shadow-lg shadow-primary-950/40 border border-primary-500/30">
              <BarChart3 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Executive BI &amp; Pharmaceutical Reports
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-dimensional enterprise intelligence: molecule analytics, chemist ledger audits, MR geolocation, clinical compliance, and statutory GST reports.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => selected && fetchReportData(selected, timeframe)}
            disabled={fetchingData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 transition shadow-sm hover:border-slate-600"
            title="Refresh live dataset"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetchingData ? "animate-spin text-primary-400" : ""}`} />
            Sync
          </button>

          {/* Download Filtered Search Button */}
          {searchQuery.trim() && (
            <button
              onClick={() => handleExportExcel(true)}
              disabled={!displayRows.length || exportingExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl border border-emerald-400/30 transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              title={`Download ${displayRows.length} search results in professional Excel format`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingExcel ? "animate-bounce" : ""}`} />
              <span>Export Search ({displayRows.length})</span>
            </button>
          )}

          {/* Master Full Report Download Button */}
          <button
            onClick={() => handleExportExcel(false)}
            disabled={!reportData?.rows?.length || exportingExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white rounded-xl border border-primary-500 transition shadow-lg shadow-primary-950/40 disabled:opacity-50"
            title="Download full report dataset in multi-sheet Excel workbook with Executive Dashboard"
          >
            <Download className={`w-3.5 h-3.5 ${exportingExcel ? "animate-bounce" : ""}`} />
            <span>{exportingExcel ? "Exporting XLSX..." : "Export Full Report (.xlsx)"}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!displayRows.length}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/80 transition shadow-sm disabled:opacity-50"
            title="Print Executive PDF Summary"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* ── Cross-Module Intelligence Quick Navigation ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <span className="text-slate-400 font-medium mr-1 shrink-0 uppercase tracking-wider text-[10px]">Domain:</span>
        <span className="px-3 py-1.5 rounded-xl bg-primary-600 text-white shrink-0 border border-primary-500 flex items-center gap-1.5 shadow-sm">
          <BarChart3 size={13} />
          <span>Executive BI Reports ({reports.length})</span>
        </span>
        <Link
          href="/reports/mr-daily-calls"
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-800 transition flex items-center gap-1.5"
        >
          <Compass size={13} className="text-indigo-400" />
          <span>MR Daily Calls &amp; DCR</span>
        </Link>
        <Link
          href="/mr/reports/council"
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-800 transition flex items-center gap-1.5"
        >
          <MessageCircle size={13} className="text-emerald-400" />
          <span>Multi-Agent Council &amp; WhatsApp</span>
        </Link>
        <Link
          href="/simulator"
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-800 transition flex items-center gap-1.5"
        >
          <Calculator size={13} className="text-fuchsia-400" />
          <span>Scheme Margin Simulator</span>
        </Link>
        <Link
          href="/marketing"
          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-800 transition flex items-center gap-1.5"
        >
          <Sparkles size={13} className="text-purple-400" />
          <span>Marketing &amp; Campaign ROI</span>
        </Link>
      </div>

      {/* ── Multi-Agent Council Telemetry Ribbon ── */}
      {councilSynthesis && (
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-4 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <Cpu className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  8-Domain AI Council Telemetry
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Grade {councilSynthesis.grade} ({councilSynthesis.score}%)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{councilSynthesis.summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <Link
              href="/mr/reports/council"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <MessageCircle size={13} />
              <span>Open Daily Dispatch</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Main Grid Layout: Sidebar Catalog + Viewer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Left Sidebar: Report Search & Catalog ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report Catalog Search Input */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2.5 shadow-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${reports.length} reports...`}
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 w-full transition"
              />
              {reportSearch && (
                <button
                  onClick={() => setReportSearch("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1">
                  <Filter className="w-3 h-3 text-primary-400" /> Category
                </span>
                <span className="text-[10px] text-slate-500">{visibleReports.length} listed</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const count =
                    cat === "ALL"
                      ? reports.length
                      : reports.filter((r) => r.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                        categoryFilter === cat
                          ? "bg-primary-600 text-white shadow-sm"
                          : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80"
                      }`}
                    >
                      <span>{cat === "ALL" ? "All" : cat}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded-full bg-slate-900/60 font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reports Catalog Navigation List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 space-y-1 max-h-[680px] overflow-y-auto shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary-400" />
                <p>Loading enterprise catalog...</p>
              </div>
            ) : !visibleReports.length ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <Layers className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                <p className="font-semibold text-slate-400">No reports matched</p>
                <p className="text-[11px]">Clear search or change category filter</p>
              </div>
            ) : (
              visibleReports.map((r) => {
                const isSelected = selected === r.id;
                const isExportingThis = exportingReportId === r.id;

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`w-full text-left p-3 rounded-xl transition group flex items-start justify-between border cursor-pointer ${
                      isSelected
                        ? "bg-primary-950/60 border-primary-500/60 text-white shadow-inner"
                        : "bg-transparent border-transparent hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div className="space-y-1 pr-2 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                            CATEGORY_COLORS[r.category] || "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {CATEGORY_ICONS[r.category]}
                          {r.category}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white group-hover:text-primary-300 transition">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{r.description}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      {/* One-click direct Excel download button per report */}
                      <button
                        onClick={(e) => exportReportDirectly(r.id, e)}
                        disabled={isExportingThis}
                        className={`p-1.5 rounded-lg transition hover:bg-slate-700/80 text-slate-400 hover:text-emerald-400 ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                        title={`Download ${r.title} as Excel (.xlsx)`}
                      >
                        <FileSpreadsheet className={`w-3.5 h-3.5 ${isExportingThis ? "animate-spin text-emerald-400" : ""}`} />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 transition ${
                          isSelected ? "text-primary-400 translate-x-0.5" : "text-slate-600 opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Main Panel: Report Controls & Content ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Controls Bar: Timeframe & Search */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
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
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
                    timeframe === tf.id
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* View Mode & Search with Inline Export */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/80">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    viewMode === "table" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("chart")}
                  className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    viewMode === "chart" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Visual Analytics Chart"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Record Filter Search Input with Clear Button */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter active records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 w-48 md:w-60 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Inline Quick Export for Current Search */}
              <button
                onClick={() => handleExportExcel(true)}
                disabled={!displayRows.length || exportingExcel}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700/40 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                title={`Quick download ${displayRows.length} records as Excel`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Active Search Notification Banner when user filters */}
          {searchQuery.trim() && reportData && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 px-4 bg-primary-950/40 border border-primary-500/30 rounded-xl text-xs text-primary-200 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary-400 shrink-0" />
                <span>
                  Filtering on <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">"{searchQuery}"</strong> — showing{" "}
                  <strong className="text-emerald-400 font-bold">{displayRows.length}</strong> of {reportData.rows.length} records
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleExportExcel(true)}
                  disabled={exportingExcel || !displayRows.length}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow-sm"
                  title="Download exact matched records into an executive Excel dashboard"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>Download Filtered Excel ({displayRows.length})</span>
                </button>
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Report Header & KPI Ribbon */}
          {reportData && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                        CATEGORY_COLORS[reportData.category] || "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {CATEGORY_ICONS[reportData.category]}
                      {reportData.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Scope: {timeframe.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{reportData.title}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Active Dataset</span>
                  <p className="text-base font-bold text-primary-400">
                    {displayRows.length}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      {searchQuery ? `of ${reportData.rows.length} Records` : "Records"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Dynamic KPI Strip */}
              {dynamicKpis && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
                    <p className="text-[11px] text-slate-400 font-medium">
                      {searchQuery ? "Filtered Records" : "Dataset Count"}
                    </p>
                    <p className="text-xl font-bold text-white mt-0.5">{dynamicKpis.count}</p>
                  </div>
                  {dynamicKpis.primaryTotal !== null && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
                      <p className="text-[11px] text-slate-400 font-medium">Total {dynamicKpis.keyName}</p>
                      <p className="text-xl font-bold text-emerald-400 mt-0.5">
                        {dynamicKpis.primaryTotal >= 100000
                          ? `₹${(dynamicKpis.primaryTotal / 100000).toFixed(2)}L`
                          : typeof dynamicKpis.primaryTotal === "number" && dynamicKpis.primaryTotal % 1 !== 0
                          ? dynamicKpis.primaryTotal.toFixed(2)
                          : dynamicKpis.primaryTotal.toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                  {dynamicKpis.primaryAvg !== null && (
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
                      <p className="text-[11px] text-slate-400 font-medium">Average per Row</p>
                      <p className="text-xl font-bold text-blue-400 mt-0.5">
                        {(dynamicKpis.primaryAvg as number).toFixed(1)}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
                    <p className="text-[11px] text-slate-400 font-medium">Report Integrity</p>
                    <p className="text-xl font-bold text-teal-400 mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> 100% DB Live
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── View Container: Table or Visual Chart ── */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {fetchingData ? (
              <div className="p-16 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary-400" />
                <p className="text-xs font-semibold">Computing live report from PostgreSQL database...</p>
              </div>
            ) : !displayRows.length ? (
              <div className="p-16 text-center text-slate-500 space-y-2">
                <Layers className="w-9 h-9 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No records found matching query</p>
                <p className="text-xs">
                  Try adjusting your search criteria, switching timeframes, or clicking "All Time".
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            ) : viewMode === "table" ? (
              <div className="space-y-0">
                <div className="overflow-x-auto max-h-[620px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800/95 text-slate-300 sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-3 border-b border-slate-700 font-semibold text-slate-400 w-12 text-center">
                          #
                        </th>
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
                            const isFormattedAmount =
                              key.toLowerCase().includes("value") ||
                              key.toLowerCase().includes("amount") ||
                              key.toLowerCase().includes("profit") ||
                              key.toLowerCase().includes("billed") ||
                              key.toLowerCase().includes("collected") ||
                              key.toLowerCase().includes("outstanding") ||
                              key.toLowerCase().includes("target") ||
                              key.toLowerCase().includes("achieved") ||
                              key.toLowerCase().includes("rate") ||
                              key.toLowerCase().includes("revenue") ||
                              key.toLowerCase().includes("cost") ||
                              key.toLowerCase().includes("contribution") ||
                              key.toLowerCase().includes("expenses") ||
                              (key.toLowerCase().includes("price") && !key.toLowerCase().includes("pack"));

                            const isBadgeKey =
                              key === "riskCategory" ||
                              key === "status" ||
                              key === "planStatus" ||
                              key === "gpsStatus" ||
                              key === "locationSource" ||
                              key === "expiryRisk" ||
                              key === "geofenceStatus";

                            const isLocation =
                              key === "lastLocation" ||
                              key === "location" ||
                              key === "clinicLocation" ||
                              key === "mrLocation" ||
                              key === "targetLocation";

                            return (
                              <td key={key} className="p-3 text-slate-200 whitespace-nowrap font-medium">
                                {val === null || val === undefined ? (
                                  <span className="text-slate-600">-</span>
                                ) : isBadgeKey ? (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      val === "HEALTHY" ||
                                      val === "PAID" ||
                                      val === "APPROVED" ||
                                      val === "ADEQUATE" ||
                                      val === "ACTIVE" ||
                                      val === "GEO-VERIFIED" ||
                                      val === "VERIFIED_ON_SITE" ||
                                      String(val).startsWith("SAFE")
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        : val === "HIGH_RISK" ||
                                          val === "OUTSTANDING" ||
                                          val === "LOW_STOCK" ||
                                          val === "REJECTED" ||
                                          val === "INACTIVE" ||
                                          val === "MOCKED_GPS" ||
                                          val === "OUT_OF_GEOFENCE" ||
                                          val === "ANOMALY_FLAGGED" ||
                                          String(val).startsWith("CRITICAL")
                                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                        : val === "GPS Telemetry" ||
                                          val === "Visit Geotag" ||
                                          val === "Clinic Check-in" ||
                                          val === "ACTIVE_ZONE"
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    {String(val)}
                                  </span>
                                ) : isLocation && typeof val === "string" && val.includes("°") ? (
                                  <div
                                    onClick={() => handleCopy(val)}
                                    className="flex items-center gap-1.5 cursor-pointer group/loc font-mono text-[11px] text-primary-300 hover:text-white"
                                    title="Click to copy GPS coordinates"
                                  >
                                    <span>{val}</span>
                                    {copiedText === val ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover/loc:opacity-100 transition" />
                                    )}
                                  </div>
                                ) : isNumber && isFormattedAmount ? (
                                  <span className="font-mono text-slate-100">
                                    ₹{val.toLocaleString("en-IN")}
                                  </span>
                                ) : isNumber ? (
                                  <span className="font-mono text-slate-200">
                                    {val.toLocaleString("en-IN")}
                                  </span>
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

                {/* Table Bottom Action Ribbon */}
                <div className="bg-slate-800/80 border-t border-slate-700/80 p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>
                      Showing <strong className="text-white">{displayRows.length}</strong> of {reportData?.rows?.length ?? 0} rows
                      {searchQuery ? ` matching "${searchQuery}"` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportExcel(true)}
                      disabled={exportingExcel || !displayRows.length}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition shadow-sm"
                      title="Download these records in Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Download View ({displayRows.length} Records)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Visual Analytics Chart View */
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Top Distribution Ranking</h3>
                    <p className="text-xs text-slate-400">Ranked by primary analytical metric in active scope</p>
                  </div>
                  <button
                    onClick={() => handleExportExcel(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Chart Data (.xlsx)</span>
                  </button>
                </div>

                <div className="space-y-3.5">
                  {displayRows.slice(0, 10).map((row, idx) => {
                    const labelKey =
                      Object.keys(row).find(
                        (k) => typeof row[k] === "string" && !k.includes("Date") && !k.includes("Id") && !k.includes("Location")
                      ) || Object.keys(row)[0];
                    const numKey =
                      Object.keys(row).find((k) => typeof row[k] === "number") || Object.keys(row)[1];
                    const label = String(row[labelKey] || `Record #${idx + 1}`);
                    const val = Number(row[numKey] || 0);
                    const maxVal = Math.max(...displayRows.map((r) => Number(r[numKey] || 0))) || 1;
                    const pct = Math.min(100, Math.max(5, (val / maxVal) * 100));

                    const isCurr =
                      numKey.toLowerCase().includes("amount") ||
                      numKey.toLowerCase().includes("value") ||
                      numKey.toLowerCase().includes("revenue") ||
                      numKey.toLowerCase().includes("profit") ||
                      numKey.toLowerCase().includes("billed") ||
                      numKey.toLowerCase().includes("collected") ||
                      numKey.toLowerCase().includes("outstanding");

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-200 truncate max-w-sm">
                            <span className="text-slate-500 font-mono mr-1.5">#{idx + 1}</span>
                            {label}
                          </span>
                          <span className="text-primary-300 font-mono font-bold">
                            {KEY_LABELS[numKey] || numKey}: {isCurr ? `₹${val.toLocaleString("en-IN")}` : val.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary-600 to-indigo-500 h-2.5 rounded-full transition-all duration-700"
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
