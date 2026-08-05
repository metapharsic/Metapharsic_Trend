"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  MapPinned,
  Bell,
  Search,
  LogOut,
  ShieldCheck,
  CalendarDays,
  Package,
  Receipt,
  Stethoscope,
  BarChart3,
  Users2,
  Calculator,
  Building2,
  GraduationCap,
  Contact,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/territories", label: "Territories", icon: MapPinned },
  { href: "/entities", label: "Master Profiles", icon: Contact },
  { href: "/doctors", label: "Doctor Potential", icon: Stethoscope },
  { href: "/tour-plans", label: "Tour Plans", icon: CalendarDays },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/hospitals", label: "Institutional", icon: Building2 },
  { href: "/expenses", label: "Expense Claims", icon: Receipt },
  { href: "/lms", label: "Training", icon: GraduationCap },
  { href: "/hrms", label: "HRMS", icon: Users2 },
  { href: "/reports", label: "BI Reports", icon: BarChart3 },
  { href: "/simulator", label: "Scheme Simulator", icon: Calculator },
  { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white font-display font-bold text-sm">
            TM
          </div>
          <span className="font-display font-bold text-lg text-gray-900">Trend MR</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Menu
          </p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-600 text-white"
                    : "text-gray-500 hover:bg-primary-50 hover:text-primary-700"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-6">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 w-80">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary-600">
              <Bell size={16} />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-display font-semibold text-sm">
              U
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
