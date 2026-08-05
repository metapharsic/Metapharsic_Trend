"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
interface MrRow {
  employeeName: string;
  sales: { target: number; achieved: number };
  callsCompleted: number;
}

interface Props {
  data: MrRow[];
}

export function MrLeaderboard({ data }: Props) {
  // Format data for Recharts
  const chartData = data.map((mr) => ({
    name: mr.employeeName.split(" ")[0], // First name for compact UI
    Target: mr.sales.target,
    Achieved: mr.sales.achieved,
    Calls: mr.callsCompleted,
  }));

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-96 transition-all duration-300 hover:shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">MR Performance Leaderboard</h3>
        <p className="text-sm text-gray-500 font-medium">Daily target vs. achievement across your team</p>
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
            tick={{ fill: "#6B7280", fontSize: 12, fontWeight: 500 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12, fontWeight: 500 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            cursor={{ fill: "#F3F4F6" }}
            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
            formatter={(value: number, name: string) => {
              if (name === "Calls") return [value, name];
              return [`₹${value.toLocaleString()}`, name];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Bar dataKey="Target" fill="#E5E7EB" radius={[6, 6, 0, 0]} maxBarSize={50} />
          <Bar dataKey="Achieved" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={50} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
