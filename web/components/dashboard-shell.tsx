"use client";

import React, { useState, useEffect } from "react";
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
  UserCog,
  UserCircle2,
  ClipboardCheck,
  Menu,
  X,
  Wallet,
  Target,
  IndianRupee,
  Clock,
  Settings2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

const NAV_ITEMS = [
  { href: "/md", label: "MD Dashboard", icon: LayoutGrid, roles: ["MD", "ADMIN"] },
  { href: "/asm", label: "ASM Dashboard", icon: LayoutGrid, roles: ["ASM", "ADMIN"] },
  { href: "/mr", label: "MR Dashboard", icon: LayoutGrid, roles: ["MR", "ADMIN"] },
  { href: "/mr/calls", label: "My Calls", icon: ClipboardCheck, roles: ["MR", "ADMIN"] },
  { href: "/mr/reports", label: "My Call Reports", icon: BarChart3, roles: ["MR", "ADMIN"] },
  { href: "/mr/leads", label: "My Leads", icon: Target, roles: ["MR", "ADMIN"] },
  { href: "/mr/attendance", label: "My Attendance", icon: Clock, roles: ["MR", "ADMIN"] },
  { href: "/collections", label: "Credit & Collections", icon: Wallet, roles: ["MR", "ASM", "ADMIN", "FINANCE"] },
  { href: "/distributor", label: "Distributor Portal", icon: Package, roles: ["DISTRIBUTOR", "ADMIN", "MD"] },
  { href: "/doctor", label: "Doctor Portal", icon: Stethoscope, roles: ["DOCTOR", "ADMIN"] },
  { href: "/hr", label: "HR Dashboard", icon: Users2, roles: ["HR", "ADMIN"] },
  { href: "/finance", label: "Finance Dashboard", icon: Calculator, roles: ["FINANCE", "ADMIN"] },
  { href: "/warehouse", label: "Warehouse Dashboard", icon: Package, roles: ["WAREHOUSE", "ADMIN"] },
  { href: "/marketing", label: "Marketing Dashboard", icon: BarChart3, roles: ["MARKETING", "ADMIN"] },
  { href: "/territories", label: "Territories", icon: MapPinned, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/entities", label: "Master Profiles", icon: Contact, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/doctors", label: "Doctor Potential", icon: Stethoscope, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/tour-plans", label: "Tour Plans", icon: CalendarDays, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/orders", label: "Orders", icon: Package, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR", "DISTRIBUTOR"], labelByRole: { MR: "My Sales" } },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["ADMIN", "WAREHOUSE", "ASM", "MR"] },
  { href: "/admin/mr-activity", label: "MR Activity", icon: ClipboardCheck, roles: ["ADMIN", "ASM"] },
  { href: "/admin/leads", label: "Leads Pipeline", icon: Target, roles: ["ADMIN", "ASM"] },
  { href: "/admin/financials", label: "Entity Financials", icon: IndianRupee, roles: ["ADMIN", "ASM", "FINANCE"] },
  { href: "/hospitals", label: "Institutional", icon: Building2, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/expenses", label: "Expense Claims", icon: Receipt, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR", "FINANCE"] },
  { href: "/lms", label: "Training", icon: GraduationCap, roles: ["ADMIN", "HR", "ASM", "RM", "ZSM", "NSM", "MD"] },
  { href: "/hrms", label: "HRMS", icon: Users2, roles: ["ADMIN", "HR"] },
  { href: "/reports", label: "BI Reports", icon: BarChart3, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"] },
  { href: "/simulator", label: "Scheme Simulator", icon: Calculator, roles: ["ADMIN", "MD", "NSM", "FINANCE", "MARKETING"] },
  { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck, roles: ["ADMIN"] },
  { href: "/admin/company-settings", label: "Company Settings", icon: Building2, roles: ["ADMIN"] },
  { href: "/admin/workflow-settings", label: "Workflow Settings", icon: Settings2, roles: ["ADMIN"] },
  { href: "/users", label: "User Management", icon: UserCog, roles: ["ADMIN", "HR"] },
  { href: "/profile", label: "My Profile", icon: UserCircle2, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "HR", "FINANCE", "WAREHOUSE", "MARKETING"] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>("U");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [navSearch, setNavSearch] = useState("");
  const [navSearchOpen, setNavSearchOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    apiClient
      .get("/api/company-settings")
      .then((res) => setLogoUrl(res.data.data.settings?.logoUrl ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role);
        if (payload.email) setUserInitial(payload.email[0].toUpperCase());
      } catch (e) {
        console.error("Failed to decode token");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  const filteredNavItems = NAV_ITEMS.filter(item => !userRole || item.roles.includes(userRole)).map((item) => {
    const override = userRole && "labelByRole" in item ? (item.labelByRole as Record<string, string>)[userRole] : undefined;
    return { ...item, label: override ?? item.label };
  });

  const navSearchResults =
    navSearch.trim().length === 0
      ? []
      : filteredNavItems.filter((item) => item.label.toLowerCase().includes(navSearch.trim().toLowerCase()));

  const goToSearchResult = (href: string) => {
    router.push(href);
    setNavSearch("");
    setNavSearchOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* ── Phone drawer (below md) ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}
      <aside
        className={`w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white font-display font-bold text-sm">
              TM
            </div>
            <span className="font-display font-bold text-lg text-gray-900">Trend MR</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Menu
          </p>
          {filteredNavItems.map(({ href, label, icon: Icon }) => {
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

        <div className="px-4 pb-6 mt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Tablet rail (md) / full desktop sidebar (xl) ── */}
      <aside className="hidden md:flex md:w-16 xl:w-60 shrink-0 bg-white border-r border-gray-100 flex-col transition-all duration-200">
        <div className="flex items-center gap-2 px-4 xl:px-6 py-6 justify-center xl:justify-start">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            TM
          </div>
          <span className="hidden xl:inline font-display font-bold text-lg text-gray-900">Trend MR</span>
        </div>

        <nav className="flex-1 px-2 xl:px-4 space-y-1 overflow-y-auto">
          <p className="hidden xl:block px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Menu
          </p>
          {filteredNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors justify-center xl:justify-start ${
                  active
                    ? "bg-primary-600 text-white"
                    : "text-gray-500 hover:bg-primary-50 hover:text-primary-700"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="hidden xl:inline truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 xl:px-4 pb-6 mt-4">
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors justify-center xl:justify-start"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="hidden xl:inline">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-primary-600 md:hidden shrink-0">
            <Menu size={22} />
          </button>
          <div className="hidden sm:block relative w-full max-w-80">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search pages..."
                value={navSearch}
                onChange={(e) => { setNavSearch(e.target.value); setNavSearchOpen(true); }}
                onFocus={() => setNavSearchOpen(true)}
                onBlur={() => setTimeout(() => setNavSearchOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && navSearchResults.length > 0) goToSearchResult(navSearchResults[0].href);
                  if (e.key === "Escape") { setNavSearch(""); setNavSearchOpen(false); }
                }}
                className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
              />
            </div>
            {navSearchOpen && navSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
                {navSearchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No matching pages.</p>
                ) : (
                  navSearchResults.map(({ href, label, icon: Icon }) => (
                    <button
                      key={href}
                      onMouseDown={() => goToSearchResult(href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 text-left"
                    >
                      <Icon size={16} className="shrink-0 text-gray-400" />
                      {label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            <button className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary-600">
              <Bell size={16} />
            </button>
            <Link href="/profile" className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-display font-semibold text-sm hover:bg-primary-200 transition-colors" title="My Profile">
              {userInitial}
            </Link>
          </div>
        </header>

        <main className="relative flex-1 p-4 sm:p-6 overflow-y-auto">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none fixed top-1/2 left-1/2 w-[36vw] max-w-[420px] min-w-[220px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] z-0"
            />
          )}
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
