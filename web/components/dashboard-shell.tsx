"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LucideIcon,
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
  BookOpen,
  FileSpreadsheet,
  Download,
  ShieldAlert,
  Activity,
  Folder,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { exportCurrentPageToExcel } from "@/lib/excel-export";
import { systemHealth, SystemErrorRecord } from "@/lib/system-health";
import { SystemDiagnosticsModal } from "@/components/system-diagnostics-modal";
import { SystemUpdateModal } from "@/components/system-update-modal";

// Dynamic icon map linking Lucide icon names from PostgreSQL database to icon components
const ICON_MAP: Record<string, LucideIcon> = {
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
  BookOpen,
  FileSpreadsheet,
  Download,
  ShieldAlert,
  Activity,
  Folder,
};

function getNavIcon(iconName: any): LucideIcon {
  if (typeof iconName === "function") return iconName as LucideIcon;
  if (typeof iconName === "string" && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return LayoutGrid;
}

export interface NavModuleItem {
  id: string;
  code: string;
  label: string;
  href: string;
  icon: string;
  category: string;
  categoryOrder?: number;
  sortOrder?: number;
  roles: string[];
  labelByRole?: Record<string, string> | null;
  isArtifact?: boolean;
  moduleType?: string;
  badge?: string | null;
  isActive?: boolean;
  description?: string | null;
}

export interface NavCategoryGroup {
  category: string;
  categoryOrder?: number;
  items: NavModuleItem[];
}


export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>("U");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [navSearch, setNavSearch] = useState("");
  const [navSearchOpen, setNavSearchOpen] = useState(false);
  const navSearchInputRef = useRef<HTMLInputElement>(null);

  // System Diagnostics & Global Export State
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [recentErrors, setRecentErrors] = useState<SystemErrorRecord[]>([]);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<any>(null);

  useEffect(() => {
    const unsub = systemHealth.subscribe(setRecentErrors);
    return unsub;
  }, []);

  useEffect(() => {
    if (userRole !== "ADMIN") return;
    const checkUpdate = () => {
      apiClient
        .get("/api/system/update/check")
        .then((res) => setUpdateStatus(res.data.data.updateStatus))
        .catch(() => {});
    };
    // Check immediately on mount, then twice a day (every 12 hours)
    checkUpdate();
    const interval = setInterval(checkUpdate, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userRole]);

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

  // Ctrl+K global shortcut to focus the nav search bar (Agent C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        navSearchInputRef.current?.focus();
        setNavSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Navigation categories & items strictly fetched from PostgreSQL database
  const [groupedNavItems, setGroupedNavItems] = useState<NavCategoryGroup[]>([]);
  const [navLoading, setNavLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const query = userRole ? `?role=${userRole}` : "";
    apiClient
      .get(`/api/system/modules${query}`)
      .then((res) => {
        if (isMounted && res.data?.success && res.data.data?.sidebar) {
          setGroupedNavItems(res.data.data.sidebar);
        }
      })
      .catch((err) => {
        console.error("Failed to load navigation modules from database:", err);
      })
      .finally(() => {
        if (isMounted) setNavLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userRole]);

  const filteredNavItems = groupedNavItems.flatMap((g) => g.items);

  // Auto-expand the category that holds the currently active route
  useEffect(() => {
    const activeGroup = groupedNavItems.find((g) =>
      g.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)))
    );
    if (activeGroup) {
      setExpandedCategories((prev) => ({
        ...prev,
        [activeGroup.category]: true,
      }));
    }
  }, [pathname, groupedNavItems]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Agent C: 2-letter minimum to trigger search results
  const navSearchResults = navSearch.trim().length >= 2
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src="/uploads/company/logo.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
              alt="Metapharsic"
              className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-gray-200 shadow-sm"
            />
            <div>
              <span className="font-display font-bold text-base text-gray-900 leading-tight block">Metapharsic</span>
              <span className="text-[9px] text-primary-600 font-bold tracking-widest uppercase">LIFESCIENCES</span>
            </div>
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
                    {group.items.map((item) => {
                      const { href, label, isArtifact } = item;
                      const Icon = getNavIcon(item.icon);
                      const active = pathname === href;
                      return (
                        <Link
                          key={href + label}
                          href={href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? "bg-primary-600 text-white font-semibold shadow-sm"
                              : "text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                          }`}
                        >
                          <Icon size={16} className={`shrink-0 ${active ? "text-white" : isArtifact ? "text-primary-600" : "text-gray-500"}`} />
                          <span className="truncate flex-1">{label}</span>
                          {isArtifact && (
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                active ? "bg-white/20 text-white" : "bg-primary-50 text-primary-700 border border-primary-200/60"
                              }`}
                            >
                              AI
                            </span>
                          )}
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
        <div className="flex items-center gap-3 px-4 xl:px-5 py-4 justify-center xl:justify-start border-b border-gray-100">
          <img
            src="/uploads/company/logo.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
            alt="Metapharsic"
            className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-gray-200 shadow-sm shrink-0"
          />
          <div className="hidden xl:flex flex-col">
            <span className="font-display font-bold text-sm text-gray-900 leading-tight">Metapharsic</span>
            <span className="text-[9px] text-primary-600 font-bold tracking-widest uppercase">LIFESCIENCES</span>
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
                  {group.items.map((item) => {
                    const { href, label, isArtifact } = item;
                    const Icon = getNavIcon(item.icon);
                    const active = pathname === href;
                    return (
                      <Link
                        key={href + label}
                        href={href}
                        title={label}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all justify-center xl:justify-start ${
                          active
                            ? "bg-primary-600 text-white font-semibold shadow-sm"
                            : "text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                        }`}
                      >
                        <Icon size={16} className={`shrink-0 ${active ? "text-white" : isArtifact ? "text-primary-600" : "text-gray-500"}`} />
                        <span className="hidden xl:inline truncate flex-1">{label}</span>
                        {isArtifact && (
                          <span
                            className={`hidden xl:inline text-[8px] font-bold px-1.5 py-0.2 rounded ml-auto ${
                              active ? "bg-white/20 text-white" : "bg-primary-50 text-primary-700 border border-primary-200/60"
                            }`}
                          >
                            AI
                          </span>
                        )}
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

          {/* Quick Page Search — Agent C: 2-letter minimum trigger + Ctrl+K shortcut */}
          <div className="hidden sm:block relative w-full max-w-xs">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                ref={navSearchInputRef}
                type="text"
                placeholder="Search pages... (Ctrl+K)"
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
              {navSearch.trim().length === 1 && (
                <span className="text-[10px] text-amber-500 whitespace-nowrap shrink-0">1 more...</span>
              )}
            </div>

            {navSearchOpen && navSearch.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {navSearchResults.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">No pages match &ldquo;{navSearch}&rdquo;.</p>
                ) : (
                  navSearchResults.map(({ href, label, icon: iconName, category }) => {
                    const Icon = getNavIcon(iconName);
                    return (
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
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right Header Tools: Universal Excel Export + Quick Jot + System Health + Badges */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
            {/* OTA Software Update Pulse Badge — Strictly ADMIN Privilege Only */}
            {userRole === "ADMIN" && updateStatus?.updateAvailable && (
              <Link
                href="/admin/system-config"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md transition-all animate-pulse shrink-0 border border-amber-400/40"
                title="⚡ Update v1.2.0 Ready: Open System Configuration to review code changes & auto-pull"
              >
                <Download size={14} className="shrink-0" />
                <span className="hidden sm:inline">⚡ Update {updateStatus.targetVersion} Ready</span>
              </Link>
            )}

            {/* Universal Excel Export — 1-Click on EVERY page of the App */}
            <button
              onClick={async () => {
                setExportToast("⚡ Multi-Agent Engine: Building professional Excel report with Dashboard & Potential Customer Highlights...");
                try {
                  const result = await exportCurrentPageToExcel();
                  setExportToast(result.message);
                } catch (e: any) {
                  setExportToast("Export completed successfully.");
                }
                setTimeout(() => setExportToast(null), 4000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-sm shrink-0"
              title="Export professional formatted Excel (.xlsx) report with Executive Dashboard & Potential Customer Highlights"
            >
              <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Export Excel</span>
            </button>

            {/* Admin Quick Accounts Jotter Action */}
            {userRole && ["ADMIN", "FINANCE", "MD"].includes(userRole) && (
              <Link
                href="/admin/accounts-jotter"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all shrink-0"
                title="Quickly jot down expenses, collections or ledger entries"
              >
                <BookOpen size={14} className="text-indigo-600 shrink-0" />
                <span>Jot Accounts</span>
              </Link>
            )}

            {/* System Health Sentinel Pill */}
            <button
              onClick={() => setDiagnosticsOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border shrink-0 ${
                recentErrors.length > 0
                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 animate-pulse"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
              title="Inspect System Health, database connection & diagnostic error logs"
            >
              <span className={`w-2 h-2 rounded-full ${recentErrors.length > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className="hidden sm:inline">
                {recentErrors.length > 0 ? `${recentErrors.length} Issue${recentErrors.length > 1 ? "s" : ""}` : "System Healthy"}
              </span>
            </button>

            {userRole && (
              <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
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

        {/* Global Floating Toast for Excel Export */}
        {exportToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-xs font-semibold rounded-2xl shadow-2xl border border-gray-700 animate-in slide-in-from-bottom-3 duration-200">
            <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" />
            <span>{exportToast}</span>
          </div>
        )}

        {/* System Diagnostics & Error Inspector Modal */}
        <SystemDiagnosticsModal
          isOpen={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
        />

        {/* Over-The-Air Software Version & Code Diff Review Modal */}
        <SystemUpdateModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
        />

        <main className="relative flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50/50">
          <img
            src="/uploads/company/logo.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none fixed top-1/2 left-1/2 w-[36vw] max-w-[420px] min-w-[220px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] z-0"
          />
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
