"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ReportMeta {
  id: string;
  category: string;
  title: string;
  description: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiClient
      .get("/api/reports")
      .then((res) => setReports(res.data.data.reports || []))
      .catch((err) => console.error("Failed to fetch report catalogue:", err))
      .finally(() => setLoading(false));
  }, []);

  const runReport = async (id: string) => {
    setActiveId(id);
    setRunning(true);
    try {
      const res = await apiClient.get(`/api/reports?report=${id}`);
      setRows(res.data.data.rows || []);
    } catch (err) {
      console.error("Failed to run report:", err);
      setRows([]);
    } finally {
      setRunning(false);
    }
  };

  const categories = Array.from(new Set(reports.map((r) => r.category)));
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">BI Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sales, field activity, financial, compliance, and institutional reporting.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-1">
                  {reports
                    .filter((r) => r.category === category)
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => runReport(r.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeId === r.id
                            ? "bg-primary-600 text-white"
                            : "text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                        }`}
                      >
                        {r.title}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!activeId ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">Select a report to run it.</p>
              </div>
            ) : running ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No data for this report yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      {columns.map((c) => (
                        <th key={c} className="px-4 py-3 whitespace-nowrap">
                          {c.replace(/([A-Z])/g, " $1").trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        {columns.map((c) => (
                          <td key={c} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {formatCell(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string" && ISO_DATE.test(value)) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return String(value);
}
