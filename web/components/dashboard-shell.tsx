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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

// Structured navigation categories
const NAV_CATEGORY_ORDER = [
  "Executive & Dashboards",
  "Field Force & CRM",
  "Commercial & Channels",
  "Finance, HR & People",
  "Analytics & Marketing",
  "Administration & Profile",
] as const;

const NAV_ITEMS = [
  // ── Executive & Dashboards ───────────────────────────────────
  { href: "/md", label: "MD Executive Dashboard", icon: LayoutGrid, roles: ["MD", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/nsm", label: "NSM National Dashboard", icon: LayoutGrid, roles: ["NSM", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/zsm", label: "ZSM Zonal Dashboard", icon: LayoutGrid, roles: ["ZSM", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/rm", label: "RM Regional Dashboard", icon: LayoutGrid, roles: ["RM", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/asm", label: "ASM Area Dashboard", icon: LayoutGrid, roles: ["ASM", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/mr", label: "MR Field Dashboard", icon: LayoutGrid, roles: ["MR", "ADMIN"], category: "Executive & Dashboards" },
  { href: "/mr/reports/council", label: "Multi-Agent AI Council", icon: Sparkles, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR"], category: "Executive & Dashboards" },
  { href: "/admin", label: "Admin Control Center", icon: ShieldCheck, roles: ["ADMIN"], category: "Executive & Dashboards" },

  // ── Field Force & CRM ────────────────────────────────────────
  { href: "/mr/calls", label: "My Calls & DCR", icon: ClipboardCheck, roles: ["MR", "ADMIN"], category: "Field Force & CRM" },
  { href: "/mr/reports", label: "My Call Reports", icon: BarChart3, roles: ["MR", "ADMIN"], category: "Field Force & CRM" },
  { href: "/mr/reports/council", label: "Multi-Agent Audit & WhatsApp", icon: Sparkles, roles: ["MR", "ADMIN", "ASM", "RM", "ZSM", "NSM", "MD"], category: "Field Force & CRM" },
  { href: "/tour-plans", label: "Tour Plans (MTP/TP)", icon: CalendarDays, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR"], category: "Field Force & CRM" },
  { href: "/territories", label: "Territory Tree", icon: MapPinned, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"], category: "Field Force & CRM" },
  { href: "/doctors", label: "Doctor CRM & Potential", icon: Stethoscope, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"], category: "Field Force & CRM" },
  { href: "/hospitals", label: "Hospital & Institutional", icon: Building2, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"], category: "Field Force & CRM" },
  { href: "/entities", label: "Master Entity Profiles", icon: Contact, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"], category: "Field Force & CRM" },
  { href: "/mr/leads", label: "Lead Pipeline", icon: Target, roles: ["MR", "ADMIN", "ASM"], category: "Field Force & CRM" },
  { href: "/admin/mr-activity", label: "Field Activity Monitor", icon: ClipboardCheck, roles: ["ADMIN", "ASM", "RM", "ZSM", "NSM"], category: "Field Force & CRM" },
  { href: "/mr/claims", label: "Expiry & Damage Claims", icon: AlertTriangle, roles: ["MR", "ADMIN", "ASM"], labelByRole: { ADMIN: "Claims Review", ASM: "Claims Review" }, category: "Field Force & CRM" },
  { href: "/mr/attendance", label: "Field Attendance", icon: Clock, roles: ["MR", "ADMIN", "ASM"], category: "Field Force & CRM" },

  // ── Commercial & Channels ────────────────────────────────────
  { href: "/orders", label: "Secondary Orders", icon: Package, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR", "DISTRIBUTOR"], labelByRole: { MR: "My Orders", DISTRIBUTOR: "Orders & Invoices" }, category: "Commercial & Channels" },
  { href: "/collections", label: "Credit & Collections", icon: Wallet, roles: ["MR", "ASM", "ADMIN", "FINANCE"], category: "Commercial & Channels" },
  { href: "/inventory", label: "Stock Inventory", icon: Package, roles: ["ADMIN", "WAREHOUSE", "ASM", "MR"], category: "Commercial & Channels" },
  { href: "/admin/financials", label: "Entity Credit & Balances", icon: IndianRupee, roles: ["ADMIN", "ASM", "FINANCE"], category: "Commercial & Channels" },
  { href: "/warehouse", label: "Warehouse Operations", icon: Package, roles: ["WAREHOUSE", "ADMIN"], category: "Commercial & Channels" },
  { href: "/distributor", label: "Distributor Portal", icon: Package, roles: ["DISTRIBUTOR", "ADMIN", "MD"], category: "Commercial & Channels" },
  { href: "/doctor", label: "Doctor Portal", icon: Stethoscope, roles: ["DOCTOR", "ADMIN"], category: "Commercial & Channels" },

  // ── Finance, HR & People ─────────────────────────────────────
  { href: "/finance", label: "Finance & General Ledger", icon: Calculator, roles: ["FINANCE", "ADMIN"], category: "Finance, HR & People" },
  { href: "/finance/accounts", label: "Chart of Accounts", icon: IndianRupee, roles: ["FINANCE", "ADMIN", "MD"], category: "Finance, HR & People" },
  { href: "/finance/journal", label: "Journal Entries", icon: IndianRupee, roles: ["FINANCE", "ADMIN"], category: "Finance, HR & People" },
  { href: "/finance/reports", label: "Financial Statements", icon: IndianRupee, roles: ["FINANCE", "ADMIN", "MD"], category: "Finance, HR & People" },
  { href: "/expenses", label: "Expense Claims & DA", icon: Receipt, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "MR", "FINANCE"], category: "Finance, HR & People" },
  { href: "/users", label: "User Management & Roles", icon: UserCog, roles: ["ADMIN", "HR", "MD"], category: "Finance, HR & People" },
  { href: "/hr", label: "HR Dashboard", icon: Users2, roles: ["HR", "ADMIN"], category: "Finance, HR & People" },
  { href: "/hrms", label: "HRMS & Payroll", icon: Users2, roles: ["ADMIN", "HR"], category: "Finance, HR & People" },
  { href: "/lms", label: "Training & Certifications", icon: GraduationCap, roles: ["ADMIN", "HR", "ASM", "RM", "ZSM", "NSM", "MD", "MR"], category: "Finance, HR & People" },

  // ── Analytics & Marketing ────────────────────────────────────
  { href: "/reports", label: "Executive BI Reports", icon: BarChart3, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"], category: "Analytics & Marketing" },
  { href: "/simulator", label: "Scheme Margin Simulator", icon: Calculator, roles: ["ADMIN", "MD", "NSM", "FINANCE", "MARKETING"], category: "Analytics & Marketing" },
  { href: "/marketing", label: "Marketing Campaigns", icon: BarChart3, roles: ["MARKETING", "ADMIN"], category: "Analytics & Marketing" },

  // ── Administration & Profile ─────────────────────────────────
  { href: "/admin/company-settings", label: "Company Settings", icon: Building2, roles: ["ADMIN"], category: "Administration & Profile" },
  { href: "/admin/workflow-settings", label: "Workflow Settings", icon: Settings2, roles: ["ADMIN"], category: "Administration & Profile" },
  { href: "/profile", label: "My Profile", icon: UserCircle2, roles: ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM", "HR", "FINANCE", "WAREHOUSE", "MARKETING", "MR", "DISTRIBUTOR", "DOCTOR"], category: "Administration & Profile" },
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

  // Track expanded accordion sections
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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

  const filteredNavItems = NAV_ITEMS.filter((item) => !userRole || item.roles.includes(userRole)).map((item) => {
    const override = userRole && "labelByRole" in item ? (item.labelByRole as unknown as Record<string, string>)[userRole] : undefined;
    return override ? { ...item, label: override } : item;
  });

  const groupedNavItems = NAV_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: filteredNavItems.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  // Auto-expand the category that holds the currently active route
  useEffect(() => {
    const activeGroup = groupedNavItems.find((g) => g.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))));
    if (activeGroup) {
      setExpandedCategories((prev) => ({
        ...prev,
        [activeGroup.category]: true,
      }));
    }
  }, [pathname, userRole]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const navSearchResults = navSearch.trim()
    ? filteredNavItems.filter((i) => i.label.toLowerCase().includes(navSearch.toLowerCase()))
    : [];

  const goToSearchResult = (href: string) => {
    setNavSearch("");
    setNavSearchOpen(false);
    router.push(href);
  };

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* ── Mobile Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar Drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-200 ease-in-out md:hidden flex flex-col border-r border-gray-100 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 flex items-center justify-center text-white font-display font-bold text-sm shadow-sm">
              TM
            </div>
            <span className="font-display font-bold text-lg text-gray-900 tracking-tight">Trend MR</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {groupedNavItems.map((group) => {
            const isExpanded = expandedCategories[group.category] ?? true;
            const hasActiveChild = group.items.some((i) => pathname === i.href);
            return (
              <div key={group.category} className="rounded-xl overflow-hidden bg-gray-50/60 border border-gray-100/80">
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100/70 transition-colors uppercase tracking-wider text-left"
                >
                  <span className="flex items-center gap-1.5">
                    {hasActiveChild && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                    {group.category}
                  </span>
                  {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="p-1.5 space-y-1 bg-white">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? "bg-primary-600 text-white font-semibold shadow-sm"
                              : "text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                          }`}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span className="truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-4 pb-6 mt-auto border-t border-gray-100 pt-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Tablet Rail (md) & Desktop Collapsible Sidebar (xl) ── */}
      <aside className="hidden md:flex md:w-16 xl:w-64 shrink-0 bg-white border-r border-gray-200/70 flex-col transition-all duration-200 select-none shadow-sm z-20">
        <div className="flex items-center gap-3 px-4 xl:px-5 py-5 justify-center xl:justify-start border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-sm">
            TM
          </div>
          <div className="hidden xl:flex flex-col">
            <span className="font-display font-bold text-base text-gray-900 leading-none">Trend MR</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">Pharma OS</span>
          </div>
        </div>

        <nav className="flex-1 px-2 xl:px-3 py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {groupedNavItems.map((group) => {
            const isExpanded = expandedCategories[group.category] ?? true;
            const hasActiveChild = group.items.some((i) => pathname === i.href);

            return (
              <div key={group.category} className="xl:bg-gray-50/50 xl:rounded-xl xl:border xl:border-gray-100 overflow-hidden">
                {/* Desktop Accordion Header */}
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="hidden xl:flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100/60 transition-colors uppercase tracking-wider text-left"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {hasActiveChild && <span className="w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0" />}
                    {group.category}
                  </span>
                  <span className="flex items-center gap-1 shrink-0 text-gray-400">
                    <span className="text-[10px] font-medium bg-gray-200/70 text-gray-600 px-1.5 py-0.2 rounded-full">
                      {group.items.length}
                    </span>
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                </button>

                {/* Desktop Accordion Body */}
                <div className={`space-y-0.5 xl:p-1 xl:bg-white ${isExpanded ? "block" : "hidden xl:hidden"}`}>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={label}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all justify-center xl:justify-start ${
                          active
                            ? "bg-primary-600 text-white font-semibold shadow-sm"
                            : "text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                        }`}
                      >
                        <Icon size={16} className={`shrink-0 ${active ? "text-white" : "text-gray-500"}`} />
                        <span className="hidden xl:inline truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-2 xl:px-3 pb-4 pt-2 border-t border-gray-100">
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors justify-center xl:justify-start"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="hidden xl:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200/70 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-primary-600 md:hidden shrink-0">
            <Menu size={22} />
          </button>

          {/* Quick Page Search */}
          <div className="hidden sm:block relative w-full max-w-xs">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Jump to page... (Ctrl+K)"
                value={navSearch}
                onChange={(e) => {
                  setNavSearch(e.target.value);
                  setNavSearchOpen(true);
                }}
                onFocus={() => setNavSearchOpen(true)}
                onBlur={() => setTimeout(() => setNavSearchOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && navSearchResults.length > 0) goToSearchResult(navSearchResults[0].href);
                  if (e.key === "Escape") {
                    setNavSearch("");
                    setNavSearchOpen(false);
                  }
                }}
                className="bg-transparent text-xs outline-none w-full placeholder:text-gray-400"
              />
            </div>

            {navSearchOpen && navSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {navSearchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">No matching pages found.</p>
                ) : (
                  navSearchResults.map(({ href, label, icon: Icon, category }) => (
                    <button
                      key={href}
                      onMouseDown={() => goToSearchResult(href)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 text-left transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon size={15} className="shrink-0 text-gray-400" />
                        <span className="font-medium">{label}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{category}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            {userRole && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                <Sparkles size={12} className="text-primary-500" />
                {userRole}
              </span>
            )}
            <button className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-500 hover:text-primary-600 transition-colors">
              <Bell size={15} />
            </button>
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-display font-semibold text-xs hover:bg-primary-700 transition-colors shadow-sm"
              title="My Profile"
            >
              {userInitial}
            </Link>
          </div>
        </header>

        <main className="relative flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50/50">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none fixed top-1/2 left-1/2 w-[36vw] max-w-[420px] min-w-[220px] -translate-x-1/2 -translate-y-1/2 opacity-[0.03] z-0"
            />
          )}
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
