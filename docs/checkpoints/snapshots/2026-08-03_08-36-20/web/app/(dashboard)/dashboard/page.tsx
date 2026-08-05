"use client";

import React, { useEffect, useState } from "react";
import { Users, Building2, Truck, Package, MapPinned } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Stats {
  territories: number;
  doctors: number;
  chemists: number;
  distributors: number;
  products: number;
}

const CARDS = [
  { key: "territories" as const, label: "Territories", icon: MapPinned },
  { key: "doctors" as const, label: "Doctors", icon: Users },
  { key: "chemists" as const, label: "Chemists", icon: Building2 },
  { key: "distributors" as const, label: "Distributors", icon: Truck },
  { key: "products" as const, label: "Products", icon: Package },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/manager/dashboard/stats")
      .then((res) => setStats(res.data.data))
      .catch((err) => console.error("Failed to fetch dashboard stats:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of territories, entities, and catalog.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {CARDS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-gray-900">
                {loading ? "—" : stats?.[key] ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
