"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BarChart3, KeyRound, Calculator, Zap } from "lucide-react";
import { ExecutiveKpiDashboard } from "@/components/executive-kpi-dashboard";
import { AdminUserPasswords } from "@/components/admin/admin-user-passwords";
import { AdminPtrCalculator } from "@/components/admin/admin-ptr-calculator";

type AdminTab = "kpis" | "ptr-calculator" | "passwords";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("ptr-calculator");

  return (
    <div className="space-y-6 pb-12">
      {/* Top Admin Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setActiveTab("kpis")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "kpis"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <BarChart3 size={15} />
          <span>Executive Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("ptr-calculator")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "ptr-calculator"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Calculator size={15} />
          <span>PTR Profit &amp; Commercial Strategy Calculator</span>
        </button>

        <button
          onClick={() => setActiveTab("passwords")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "passwords"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <KeyRound size={15} />
          <span>Staff &amp; Passwords</span>
        </button>

        <Link
          href="/admin/system-config"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm sm:ml-auto"
          title="Open System Configuration & OTA Update Center"
        >
          <Zap size={14} className="fill-amber-300 text-amber-200" />
          <span>⚡ Update v1.2.0 &amp; System Config</span>
        </Link>
      </div>

      {/* Tab Contents */}
      {activeTab === "kpis" && (
        <ExecutiveKpiDashboard
          title="Admin Executive Dashboard"
          subtitle="Enterprise workforce, field coverage, commercial order volume, and compliance KPIs."
        />
      )}

      {activeTab === "ptr-calculator" && <AdminPtrCalculator />}

      {activeTab === "passwords" && <AdminUserPasswords />}
    </div>
  );
}
