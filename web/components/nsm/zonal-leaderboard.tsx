"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ZonalPerformanceDTO } from "@/types/performance.types";

interface Props {
  data: ZonalPerformanceDTO[];
}

export function ZonalLeaderboard({ data }: Props) {
  // Format data for Recharts
  const chartData = data.map((zone) => ({
    name: zone.zoneName,
    Target: zone.sales.target,
    Achieved: zone.sales.achieved,
    Compliance: zone.compliancePercentage,
  }));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Zonal Performance Leaderboard</h3>
        <p className="text-sm text-gray-500">Sales target vs. achievement across all zones</p>
      </div>
      
      <ResponsiveContainer width="100%" height="80%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
          />
          <Tooltip 
            cursor={{ fill: "#F3F4F6" }}
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            formatter={(value: number, name: string) => {
              if (name === "Compliance") return [`${value}%`, name];
              return [`₹${value.toLocaleString()}`, name];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Bar dataKey="Target" fill="#E5E7EB" radius={[4, 4, 0, 0]} maxBarSize={50} />
          <Bar dataKey="Achieved" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
