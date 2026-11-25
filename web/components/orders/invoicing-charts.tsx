"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface InvoicingChartsProps {
  cadenceBreakdowns: Array<{
    bucketLabel: string;
    paidAmount: number;
    unpaidAmount: number;
    invoicedAmount: number;
  }>;
  areaBreakdowns: Array<{
    territoryName: string;
    subArea?: string | null;
    paidAmount: number;
    unpaidAmount: number;
  }>;
}

function fmtAxis(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${value}`;
}

export function InvoicingCharts({ cadenceBreakdowns, areaBreakdowns }: InvoicingChartsProps) {
  const timelineData = [...cadenceBreakdowns]
    .slice(0, 8)
    .reverse()
    .map((b) => ({
      name: b.bucketLabel.replace(" (Quarterly)", "").slice(0, 14),
      Paid: Math.round(Number(b.paidAmount) || 0),
      Unpaid: Math.round(Number(b.unpaidAmount) || 0),
    }));

  const areaData = areaBreakdowns.slice(0, 7).map((a) => ({
    name: a.subArea ? `${a.territoryName.slice(0, 10)} (${a.subArea.slice(0, 8)})` : a.territoryName.slice(0, 16),
    Paid: Math.round(Number(a.paidAmount) || 0),
    Unpaid: Math.round(Number(a.unpaidAmount) || 0),
  }));

  if (timelineData.length === 0 && areaData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 h-72 flex flex-col">
        <div className="mb-3">
          <h3 className="text-sm font-display font-bold text-slate-900">Settlement Trend by Cadence</h3>
          <p className="text-[11px] text-slate-500">Paid collections vs open receivables across periods</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={fmtAxis} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                formatter={(val: number, name: string) => [`₹${Number(val).toLocaleString("en-IN")}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Paid" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} maxBarSize={36} />
              <Bar dataKey="Unpaid" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 h-72 flex flex-col">
        <div className="mb-3">
          <h3 className="text-sm font-display font-bold text-slate-900">Top Territories Settlement Mix</h3>
          <p className="text-[11px] text-slate-500">Realized revenue vs outstanding dues by area</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={areaData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={fmtAxis} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                formatter={(val: number, name: string) => [`₹${Number(val).toLocaleString("en-IN")}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Paid" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Unpaid" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
