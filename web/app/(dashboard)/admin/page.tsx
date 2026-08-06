"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { NotificationFeed } from "@/components/admin/notification-feed";

interface AdminKpis {
  totalEmployees: number;
  activeMRs: number;
  todaysAttendance: { present: number; total: number };
  liveLocation: { online: number; total: number };
  doctorsCovered: { visited: number; total: number };
  chemistsCovered: { visited: number; total: number };
  hospitalsCovered: { visited: number; total: number };
  orders: { count: number };
  sales: { amount: number };
  collections: { amount: number };
  pendingApprovals: { tourPlans: number; expenses: number; claims: number; total: number };
  topPerformers: { employeeId: string; name: string; visitCount: number }[];
  lowPerformers: { employeeId: string; name: string; visitCount: number }[];
  expenses: { amount: number };
  leaveRequests: { pending: number };
  gpsViolations: { anomalousVisits: number; mockedLocations: number };
  missedCalls: { count: number };
  newDoctorsAdded: { count: number };
  stockStatus: { lowStock: number; total: number };
  creditBreaches: { count: number };
  agedBilling: { count: number };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  );
}

function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-display font-bold text-gray-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/manager/dashboard/admin-kpis")
      .then((res) => setKpis(res.data.data))
      .catch((err) => console.error("Failed to fetch admin KPIs:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
        <p className="text-gray-400 text-sm">Unable to load admin KPIs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Workforce, coverage, commercial, and compliance KPIs.</p>
      </div>

      <NotificationFeed />

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Workforce</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Employees" value={kpis.totalEmployees} />
          <KpiCard label="Active MRs" value={kpis.activeMRs} />
          <KpiCard
            label="Today's Attendance"
            value={`${kpis.todaysAttendance.present}/${kpis.todaysAttendance.total}`}
          />
          <KpiCard
            label="Live Location"
            value={`${kpis.liveLocation.online}/${kpis.liveLocation.total}`}
            sub="Active in last 15 min"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Coverage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Doctors Covered"
            value={`${kpis.doctorsCovered.visited}/${kpis.doctorsCovered.total}`}
            sub="Unique visits this month"
          />
          <KpiCard
            label="Chemists Covered"
            value={`${kpis.chemistsCovered.visited}/${kpis.chemistsCovered.total}`}
            sub="Unique visits this month"
          />
          <KpiCard
            label="Hospitals Covered"
            value={`${kpis.hospitalsCovered.visited}/${kpis.hospitalsCovered.total}`}
            sub="Unique visits this month"
          />
          <KpiCard label="New Doctors Added" value={kpis.newDoctorsAdded.count} sub="This month" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Commercial</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Orders" value={kpis.orders.count} sub="This month" />
          <KpiCard label="Sales" value={formatCurrency(kpis.sales.amount)} sub="This month" />
          <KpiCard label="Collections" value={formatCurrency(kpis.collections.amount)} sub="This month" />
          <KpiCard label="Expenses" value={formatCurrency(kpis.expenses.amount)} sub="This month" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Approvals &amp; Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Pending Approvals"
            value={kpis.pendingApprovals.total}
            sub={`TP ${kpis.pendingApprovals.tourPlans} · Expense ${kpis.pendingApprovals.expenses} · Claims ${kpis.pendingApprovals.claims}`}
          />
          <KpiCard label="Leave Requests" value={kpis.leaveRequests.pending} sub="Pending" />
          <KpiCard
            label="GPS Violations"
            value={kpis.gpsViolations.anomalousVisits + kpis.gpsViolations.mockedLocations}
            sub={`Anomalous visits ${kpis.gpsViolations.anomalousVisits} · Mocked GPS ${kpis.gpsViolations.mockedLocations}`}
          />
          <KpiCard label="Missed Calls" value={kpis.missedCalls.count} sub="Planned but not visited" />
          <KpiCard label="Credit Breaches" value={kpis.creditBreaches.count} sub="Chemists over their limit" />
          <KpiCard label="Aged Billing" value={kpis.agedBilling.count} sub="Unpaid invoices over 30 days" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Inventory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Stock Status"
            value={`${kpis.stockStatus.lowStock} low`}
            sub={`of ${kpis.stockStatus.total} products`}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Top Performers</h3>
          {kpis.topPerformers.length === 0 ? (
            <p className="text-sm text-gray-400">No visit activity this month.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.topPerformers.map((p, i) => (
                <li key={p.employeeId} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-semibold text-primary-600">{p.visitCount} visits</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Low Performers</h3>
          {kpis.lowPerformers.length === 0 ? (
            <p className="text-sm text-gray-400">No visit activity this month.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.lowPerformers.map((p, i) => (
                <li key={p.employeeId} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-semibold text-red-500">{p.visitCount} visits</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
