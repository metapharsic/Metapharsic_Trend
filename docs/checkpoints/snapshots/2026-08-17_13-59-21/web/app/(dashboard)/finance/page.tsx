"use client";

import React, { useEffect, useState } from "react";
import {
  Banknote,
  AlertTriangle,
  Receipt,
  FileCheck2,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  ChevronRight,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface PendingPayrollEmployee {
  employeeId: string;
  name: string;
}

interface PendingExpense {
  id: string;
  employeeName: string;
  role: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl: string;
  status: string;
}

interface FraudAlert {
  id: string;
  employeeName: string;
  reason: string;
  severity: "high" | "medium";
  amount: number;
  date: string;
}

interface FinanceDashboardData {
  kpis: {
    pendingApprovals: number;
    disbursedMtd: number;
    fraudAlerts: number;
    payrollReadiness: number; // percentage
  };
  expenses: PendingExpense[];
  alerts: FraudAlert[];
  pendingPayrollEmployees: PendingPayrollEmployee[];
  payrollMonth: string;
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function FinanceDashboard() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/api/finance/dashboard")
      .then((res) => setData(res.data.data))
      .catch((err) => {
        console.error("Failed to load finance dashboard:", err);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          "Could not load finance data. Check your connection and try again.";
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const generateReport = () => {
    if (!data) return;
    const lines = [
      ["Finance Report", data.payrollMonth].join(","),
      [],
      ["Pending Expense Claims"],
      ["Employee", "Role", "Category", "Amount", "Date"],
      ...data.expenses.map((e) => [e.employeeName, e.role, e.category, e.amount, new Date(e.date).toLocaleDateString()]),
      [],
      ["Fraud / Anomaly Alerts"],
      ["Employee", "Reason", "Severity", "Amount", "Date"],
      ...data.alerts.map((a) => [a.employeeName, a.reason, a.severity, a.amount, new Date(a.date).toLocaleDateString()]),
      [],
      ["Summary"],
      ["Pending Approvals", data.kpis.pendingApprovals],
      ["Disbursed (MTD)", data.kpis.disbursedMtd],
      ["Fraud Alerts", data.kpis.fraudAlerts],
      ["Payroll Readiness %", data.kpis.payrollReadiness],
    ];
    const csv = lines.map((row) => (Array.isArray(row) ? row.join(",") : row)).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-report-${data.payrollMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="bg-rose-50 rounded-2xl p-12 text-center border border-rose-200">
        <p className="text-rose-700 text-sm font-semibold">{loadError ?? "No data."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Finance & Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage expense claims, payroll, and fraud anomalies</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateReport}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Generate Report
          </button>
          <button
            onClick={() => setPayrollModalOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"
          >
            Process Payroll
          </button>
        </div>
      </div>

      {payrollModalOpen && (
        <ProcessPayrollModal
          employees={data.pendingPayrollEmployees}
          month={data.payrollMonth}
          onClose={() => setPayrollModalOpen(false)}
          onDone={() => {
            setPayrollModalOpen(false);
            load();
          }}
        />
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          icon={Receipt}
          label="Pending Approvals"
          value={data.kpis.pendingApprovals.toString()}
          tone="neutral"
        />
        <KpiTile
          icon={Banknote}
          label="Disbursed (MTD)"
          value={currency(data.kpis.disbursedMtd)}
          tone="good"
        />
        <KpiTile
          icon={ShieldAlert}
          label="Fraud Alerts"
          value={data.kpis.fraudAlerts.toString()}
          tone={data.kpis.fraudAlerts > 0 ? "warn" : "good"}
        />
        <KpiTile
          icon={FileCheck2}
          label="Payroll Readiness"
          value={`${data.kpis.payrollReadiness}%`}
          tone={data.kpis.payrollReadiness < 100 ? "neutral" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Approvals Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Expense Approvals Queue</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search claims..."
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Employee</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Receipt</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No claims pending finance approval.
                    </td>
                  </tr>
                )}
                {data.expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{expense.employeeName}</p>
                      <p className="text-xs text-slate-500">{expense.role} • {new Date(expense.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{currency(expense.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium text-xs">
                        <FileText size={14} /> View
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                          <XCircle size={18} />
                        </button>
                        <button className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve">
                          <CheckCircle2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">Showing {data.expenses.length} of {data.kpis.pendingApprovals} pending</span>
              <button className="text-xs font-semibold text-emerald-600 flex items-center hover:text-emerald-700">
                View All <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            OCR & Fraud Anomalies
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            {data.alerts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No anomalies detected.</p>
            )}
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-amber-200 transition-colors relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${alert.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div className="flex justify-between items-start pl-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{alert.employeeName}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {alert.reason}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      {new Date(alert.date).toLocaleDateString()} • {currency(alert.amount)}
                    </p>
                  </div>
                  <button className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm hover:text-emerald-600 transition-colors">
                    Review
                  </button>
                </div>
              </div>
            ))}

            <button className="w-full py-2.5 mt-2 border border-dashed border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
              View All Anomalies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-red-50 text-red-600"
      : tone === "good"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-slate-50 text-slate-600";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-emerald-100 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function ProcessPayrollModal({
  employees,
  month,
  onClose,
  onDone,
}: {
  employees: PendingPayrollEmployee[];
  month: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setError(null);
    const missing = employees.filter((e) => !amounts[e.employeeId] || Number(amounts[e.employeeId]) <= 0);
    if (missing.length > 0) {
      return setError(`Enter a basic salary for ${missing.map((e) => e.name).join(", ")}.`);
    }
    setSubmitting(true);
    try {
      for (const emp of employees) {
        await apiClient.post("/api/hrms/payroll", {
          employeeId: emp.employeeId,
          month,
          basicSalary: Number(amounts[emp.employeeId]),
        });
      }
      onDone();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to process payroll for one or more employees.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Process Payroll — {month}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">Every eligible employee already has payroll generated for this month.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Incentive and deductions (PF, ESIC, tax) are computed automatically off target achievement — enter basic salary only.
            </p>
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.employeeId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-semibold text-slate-800">{emp.name}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Basic salary ₹"
                    value={amounts[emp.employeeId] ?? ""}
                    onChange={(e) => setAmounts({ ...amounts, [emp.employeeId]: e.target.value })}
                    className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {employees.length > 0 && (
          <button
            onClick={handleProcess}
            disabled={submitting}
            className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Processing..." : `Process Payroll for ${employees.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
