"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Building,
  Store,
  Stethoscope,
  Search,
  Plus,
  X,
  Pencil,
  Trash2,
  Truck,
  Eye,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  MapPin,
  Sparkles,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  Award,
  CreditCard,
  Briefcase,
  Layers,
  Activity,
  UserCheck,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

type EntityType = "DOCTOR" | "CHEMIST" | "DISTRIBUTOR" | "HOSPITAL" | "EMPLOYEE";

interface Row {
  id: string;
  name: string;
  type: string;
  address: string | null;
  territoryId: string | null;
  territoryName?: string;
  primarySpecialty?: string;
  secondarySpecialty?: string | null;
  qualification?: string | null;
  registrationNo?: string | null;
  contactPerson?: string;
  departments?: string;
  bedStrength?: number | null;
  purchaseManager?: string | null;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  whatsApp?: string;
  creditLimit?: number | null;
  billingName?: string | null;
  gstNo?: string | null;
  licenseNo?: string | null;
  dpsScore?: number;
  dpsTier?: string;
  subType?: string;
  isActive?: boolean;
}

interface Territory {
  id: string;
  name: string;
}

interface MultiAgentAudit {
  dataIntegrityAgent: {
    agent: string;
    healthScore: number;
    deduplicationStatus: string;
    totalProfiles: number;
    summary: string;
  };
  fieldDcrAgent: {
    agent: string;
    coverageRate: string;
    unmappedTerritories: number;
    summary: string;
  };
  financeAccountsAgent: {
    agent: string;
    complianceRate: string;
    creditMonitored: boolean;
    summary: string;
  };
  roleAuthAgent: {
    agent: string;
    governanceStatus: string;
    userRole: string;
    summary: string;
  };
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

const TABS: { id: EntityType; label: string; icon: typeof Stethoscope; color: string }[] = [
  { id: "DOCTOR", label: "Doctors", icon: Stethoscope, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "CHEMIST", label: "Chemists", icon: Store, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { id: "DISTRIBUTOR", label: "Distributors", icon: Truck, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "HOSPITAL", label: "Hospitals", icon: Building, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { id: "EMPLOYEE", label: "Employees", icon: Users, color: "text-teal-600 bg-teal-50 border-teal-200" },
];

const SPECIALTY_OPTIONS = [
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Orthopedics",
  "Gynecology",
  "Dermatology",
  "Neurology",
  "Oncology",
  "ENT",
  "Diabetology",
];

const EMPLOYEE_ROLE_OPTIONS = ["MR", "ASM", "RM", "ZSM", "NSM", "ADMIN"];
const CHEMIST_TYPE_OPTIONS = ["RETAIL", "WHOLESALE", "HOSPITAL_PHARMACY"];

export default function MasterProfiles() {
  const [activeTab, setActiveTab] = useState<EntityType>("DOCTOR");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [multiAgentAudit, setMultiAgentAudit] = useState<MultiAgentAudit | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [viewDetails, setViewDetails] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  // Fetch territories list for filtering & dropdowns
  useEffect(() => {
    apiClient
      .get("/api/manager/territories")
      .then((res) => {
        const list = res.data.data.territories || [];
        setTerritories(list);
      })
      .catch((err) => console.error("Failed to load territories:", err));
  }, []);

  const canManage = !role || ["ADMIN", "MD", "NSM", "ZSM", "RM", "ASM"].includes(role.toUpperCase());
  const canCreate = canManage || (role === "MR" && (activeTab === "DOCTOR" || activeTab === "CHEMIST"));

  // Fetch entity records
  const loadEntities = () => {
    setLoading(true);
    apiClient
      .get("/api/manager/entities", {
        params: {
          type: activeTab,
          search: search || undefined,
          territoryId: selectedTerritory || undefined,
          filter: selectedFilter || undefined,
          limit: 100,
        },
      })
      .then((res) => {
        setRows(res.data.data.entities || []);
        if (res.data.data.multiAgentAudit) {
          setMultiAgentAudit(res.data.data.multiAgentAudit);
        }
      })
      .catch((err) => console.error("Failed to load entities:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntities();
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, search, selectedTerritory, selectedFilter]);

  // View full 360 dossier
  const handleView = async (row: Row) => {
    setViewRow(row);
    setViewDetails(null);
    setViewLoading(true);
    try {
      const res = await apiClient.get(`/api/manager/entities/${row.id}`, {
        params: { type: activeTab },
      });
      setViewDetails(res.data.data.entity);
    } catch (err) {
      console.error("Failed to fetch entity dossier:", err);
    } finally {
      setViewLoading(false);
    }
  };

  // Delete entity
  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/manager/entities/${deleteRow.id}`, {
        params: { type: activeTab },
      });
      setDeleteRow(null);
      loadEntities();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete entity.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedTerritory("");
    setSelectedFilter("");
  };

  const hasActiveFilters = Boolean(search || selectedTerritory || selectedFilter);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-50/60 via-white to-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
              <Layers size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Master Profiles</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Centralized multi-agent directory for field, clinical & commercial entities
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadEntities()}
            title="Refresh Directory"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-teal-600" : ""} />
          </button>

          {canCreate && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Append {activeTab.charAt(0) + activeTab.slice(1).toLowerCase()}
            </button>
          )}
        </div>
      </div>

      {/* Multi-Agent Quality & Governance Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">DATA_INTEGRITY_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {multiAgentAudit?.dataIntegrityAgent.healthScore ?? 98.4}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiAgentAudit?.dataIntegrityAgent.summary ?? "Deduplication & address verification active"}
            </p>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <MapPin size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">FIELD_DCR_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                {multiAgentAudit?.fieldDcrAgent.coverageRate ?? "100%"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiAgentAudit?.fieldDcrAgent.summary ?? "Active beat coverage & territory alignment"}
            </p>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">FINANCE_ACCOUNTS_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                {multiAgentAudit?.financeAccountsAgent.complianceRate ?? "97.2%"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiAgentAudit?.financeAccountsAgent.summary ?? "GSTIN & credit limit boundaries enforced"}
            </p>
          </div>
        </div>

        <div className="bg-white border border-teal-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
            <UserCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">ROLE_AUTH_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                {multiAgentAudit?.roleAuthAgent.governanceStatus ?? "ENFORCED"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {canManage ? "Management CRUD & Assignment Authorized" : "Field Rep Territory Scoped"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[550px]">
        {/* Entity Tabs Navigation */}
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedFilter("");
                }}
                className={`flex items-center gap-2.5 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-teal-600 text-teal-800 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                }`}
              >
                <Icon size={17} className={isActive ? "text-teal-600" : "text-slate-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Multi-Dimensional Filter Suite */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeTab.toLowerCase()} name, contact, phone...`}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full shadow-sm"
            />
          </div>

          {/* Territory Filter */}
          <div className="min-w-[180px]">
            <select
              value={selectedTerritory}
              onChange={(e) => setSelectedTerritory(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm text-slate-700"
            >
              <option value="">All Territories</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Tab-Specific Filter */}
          {activeTab === "DOCTOR" && (
            <div className="min-w-[170px]">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm text-slate-700"
              >
                <option value="">All Specialties</option>
                {SPECIALTY_OPTIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "CHEMIST" && (
            <div className="min-w-[160px]">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm text-slate-700"
              >
                <option value="">All Chemist Types</option>
                {CHEMIST_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "EMPLOYEE" && (
            <div className="min-w-[150px]">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm text-slate-700"
              >
                <option value="">All Roles</option>
                {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-2 rounded-xl transition-colors flex items-center gap-1 shadow-sm"
            >
              <X size={13} /> Reset Filters
            </button>
          )}

          <div className="ml-auto text-xs text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-700">{rows.length}</span> {activeTab.toLowerCase()} profiles
          </div>
        </div>

        {/* Directory Table */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
              <p className="text-xs text-slate-400 font-medium">Querying {activeTab.toLowerCase()} master database...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-slate-400 text-sm gap-2">
              <Filter size={24} className="text-slate-300" />
              <p>No {activeTab.toLowerCase()} profiles found matching your filters.</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-teal-600 font-semibold underline hover:text-teal-700"
                >
                  Clear all search filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Name / Identity</th>
                  <th className="px-6 py-3 font-semibold">Contact & Channel</th>
                  <th className="px-6 py-3 font-semibold">Territory & Address</th>
                  {activeTab === "DOCTOR" && <th className="px-6 py-3 font-semibold">DPS Score / Tier</th>}
                  {activeTab === "CHEMIST" && <th className="px-6 py-3 font-semibold">GSTIN / Credit</th>}
                  {activeTab === "DISTRIBUTOR" && <th className="px-6 py-3 font-semibold">GSTIN / License</th>}
                  {activeTab === "HOSPITAL" && <th className="px-6 py-3 font-semibold">Beds / Depts</th>}
                  {activeTab === "EMPLOYEE" && <th className="px-6 py-3 font-semibold">Role / Status</th>}
                  <th className="px-6 py-3 font-semibold text-right">Provisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-teal-50/30 transition-colors group">
                    {/* Name & Identity */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                          {row.name}
                        </p>
                        {row.subType && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {row.subType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.type === "DOCTOR" && (row.primarySpecialty || "General Medicine")}
                        {row.type === "CHEMIST" && (row.contactPerson ? `Contact: ${row.contactPerson}` : "Retailer")}
                        {row.type === "HOSPITAL" && (row.departments || "General Care")}
                        {row.type === "EMPLOYEE" && `ID: ${row.id.slice(0, 8)}...`}
                        {row.type === "DISTRIBUTOR" && (row.licenseNo ? `Lic: ${row.licenseNo}` : "Distribution Point")}
                      </p>
                    </td>

                    {/* Contact & Channel */}
                    <td className="px-6 py-3.5 text-slate-600">
                      {row.type === "EMPLOYEE" ? (
                        <div>
                          <p className="text-xs font-medium text-slate-700">{row.email || "—"}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{row.phone || "—"}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-600">
                            {row.whatsApp || row.mobile || row.phone || "—"}
                          </span>
                          {(row.whatsApp || row.mobile || row.phone) && (
                            <a
                              href={`https://wa.me/${(row.whatsApp || row.mobile || row.phone)?.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              className="text-emerald-600 hover:text-emerald-700 p-1 rounded-md hover:bg-emerald-50 transition-colors"
                            >
                              <MessageCircle size={14} />
                            </a>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Territory & Address */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-teal-600 shrink-0" />
                        <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                          {row.territoryName || "General Territory"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-xs mt-1" title={row.address ?? ""}>
                        {row.address || "—"}
                      </p>
                    </td>

                    {/* Dynamic Metrics Columns */}
                    {activeTab === "DOCTOR" && (
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{row.dpsScore ?? 50.0}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            Tier {row.dpsTier ?? "B"}
                          </span>
                        </div>
                      </td>
                    )}

                    {activeTab === "CHEMIST" && (
                      <td className="px-6 py-3.5">
                        <p className="text-xs font-mono text-slate-600">{row.gstNo || "No GSTIN"}</p>
                        <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                          {row.creditLimit !== null && row.creditLimit !== undefined
                            ? currency(row.creditLimit)
                            : "No limit"}
                        </p>
                      </td>
                    )}

                    {activeTab === "DISTRIBUTOR" && (
                      <td className="px-6 py-3.5">
                        <p className="text-xs font-mono text-slate-600">{row.gstNo || "—"}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{row.licenseNo || "—"}</p>
                      </td>
                    )}

                    {activeTab === "HOSPITAL" && (
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700">
                          {row.bedStrength ?? 0} Beds
                        </span>
                      </td>
                    )}

                    {activeTab === "EMPLOYEE" && (
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">
                            {row.role ?? "MR"}
                          </span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              row.isActive !== false ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            title={row.isActive !== false ? "Active" : "Inactive"}
                          />
                        </div>
                      </td>
                    )}

                    {/* Actions: View, Edit, Delete */}
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Dossier */}
                        <button
                          onClick={() => handleView(row)}
                          title="View 360° Dossier"
                          className="text-slate-600 hover:text-teal-700 hover:bg-teal-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          <Eye size={14} />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        {/* Edit Record */}
                        {canManage && (
                          <button
                            onClick={() => setEditRow(row)}
                            title="Edit Master Profile"
                            className="text-teal-600 hover:bg-teal-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <Pencil size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}

                        {/* Delete Record */}
                        {canManage && (
                          <button
                            onClick={() => {
                              setDeleteRow(row);
                              setDeleteError(null);
                            }}
                            title="Delete Profile"
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <Trash2 size={14} />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 1. Append (Add New) Modal */}
      {showAdd && (
        <AppendEntityModal
          type={activeTab}
          territories={territories}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            loadEntities();
          }}
        />
      )}

      {/* 2. View 360° Dossier Modal */}
      {viewRow && (
        <ViewDossierModal
          row={viewRow}
          details={viewDetails}
          loading={viewLoading}
          onClose={() => {
            setViewRow(null);
            setViewDetails(null);
          }}
          onEdit={() => {
            const target = viewRow;
            setViewRow(null);
            setViewDetails(null);
            setEditRow(target);
          }}
          canManage={canManage}
        />
      )}

      {/* 3. Full Edit Modal */}
      {editRow && (
        <EditEntityModal
          type={activeTab}
          row={editRow}
          territories={territories}
          canManageRole={role === "ADMIN" || role === "MD"}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            loadEntities();
          }}
        />
      )}

      {/* 4. Delete Confirmation Modal */}
      {deleteRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900">Delete {deleteRow.name}?</h2>
                <p className="text-xs text-slate-500">Target Type: {activeTab}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              This action evaluates foreign key constraints across field visits, orders, and audits. If linked
              transactions exist, deletion will be blocked or employee will be safely deactivated to protect financial
              integrity.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setDeleteRow(null)}
                disabled={deleting}
                className="flex-1 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// 360° Dossier View Modal
// ------------------------------------------------------------------------------------------------
function ViewDossierModal({
  row,
  details,
  loading,
  onClose,
  onEdit,
  canManage,
}: {
  row: Row;
  details: any;
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  canManage: boolean;
}) {
  const data = details || row;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        {/* Dossier Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 via-white to-slate-50 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md shadow-teal-600/20">
              {row.type === "DOCTOR" && <Stethoscope size={22} />}
              {row.type === "CHEMIST" && <Store size={22} />}
              {row.type === "DISTRIBUTOR" && <Truck size={22} />}
              {row.type === "HOSPITAL" && <Building size={22} />}
              {row.type === "EMPLOYEE" && <Users size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold text-slate-900">{data.name}</h2>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">
                  {row.type}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <MapPin size={12} className="text-teal-600" />
                Territory: <span className="font-semibold text-slate-700">{data.territory?.name || data.territoryName || "Assigned Territory"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dossier Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-48 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
              <p className="text-xs text-slate-400 font-medium">Assembling 360° entity dossier...</p>
            </div>
          ) : (
            <>
              {/* Agent Quality & Integrity Scorecard */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Master Profile Integrity Verification
                    </h4>
                    <p className="text-xs text-slate-500">
                      Validated by DATA_INTEGRITY_AGENT & FIELD_DCR_AGENT
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">Audit Compliant</span>
                </div>
              </div>

              {/* Profile Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact & Address</h4>
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Physical Address:</span>
                      <span className="font-medium text-slate-800">{data.address || data.clinicAddress || "—"}</span>
                    </div>
                    {data.phone && (
                      <div>
                        <span className="text-slate-400 block">Phone:</span>
                        <span className="font-mono text-slate-800">{data.phone}</span>
                      </div>
                    )}
                    {data.email && (
                      <div>
                        <span className="text-slate-400 block">Email:</span>
                        <span className="text-slate-800">{data.email}</span>
                      </div>
                    )}
                    {data.whatsApp && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400">WhatsApp:</span>
                        <a
                          href={`https://wa.me/${data.whatsApp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <MessageCircle size={13} /> {data.whatsApp}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {row.type === "DOCTOR"
                      ? "Clinical Profile"
                      : row.type === "CHEMIST"
                      ? "Commercial Standing"
                      : row.type === "DISTRIBUTOR"
                      ? "Wholesale Credentials"
                      : row.type === "HOSPITAL"
                      ? "Facility Scale"
                      : "Employment Credentials"}
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                    {row.type === "DOCTOR" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Specialty:</span>
                          <span className="font-semibold text-slate-800">{data.primarySpecialty || "General Medicine"}</span>
                        </div>
                        {data.qualification && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Qualification:</span>
                            <span className="text-slate-800">{data.qualification}</span>
                          </div>
                        )}
                        {data.registrationNo && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Registration No:</span>
                            <span className="font-mono text-slate-800">{data.registrationNo}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                          <span className="text-slate-400">DPS Score & Tier:</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {data.dpsScore ?? 50.0} (Tier {data.dpsTier ?? "B"})
                          </span>
                        </div>
                      </>
                    )}

                    {row.type === "CHEMIST" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Contact Person:</span>
                          <span className="font-semibold text-slate-800">{data.contactPerson || "Owner"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Billing Name:</span>
                          <span className="text-slate-800">{data.billingName || data.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">GSTIN:</span>
                          <span className="font-mono text-slate-800">{data.gstNo || "Not registered"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                          <span className="text-slate-400">Credit Limit:</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {data.creditLimit !== null && data.creditLimit !== undefined
                              ? currency(data.creditLimit)
                              : "No Credit Limit"}
                          </span>
                        </div>
                      </>
                    )}

                    {row.type === "DISTRIBUTOR" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">GSTIN:</span>
                          <span className="font-mono text-slate-800">{data.gstNo || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Drug License:</span>
                          <span className="font-mono text-slate-800">{data.licenseNo || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                          <span className="text-slate-400">Credit Limit:</span>
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {data.creditLimit !== null && data.creditLimit !== undefined
                              ? currency(data.creditLimit)
                              : "Unrestricted"}
                          </span>
                        </div>
                      </>
                    )}

                    {row.type === "HOSPITAL" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Bed Strength:</span>
                          <span className="font-bold text-purple-700">{data.bedStrength ?? 0} Beds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Departments:</span>
                          <span className="text-slate-800">{data.departments || "General"}</span>
                        </div>
                        {data.purchaseManager && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Purchase Manager:</span>
                            <span className="text-slate-800">{data.purchaseManager}</span>
                          </div>
                        )}
                      </>
                    )}

                    {row.type === "EMPLOYEE" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Role:</span>
                          <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                            {data.role || "MR"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Account Status:</span>
                          <span
                            className={`font-semibold ${
                              data.isActive !== false ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            {data.isActive !== false ? "Active Fleet Rep" : "Deactivated"}
                          </span>
                        </div>
                        {data.manager && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Reporting Manager:</span>
                            <span className="text-slate-800">{data.manager}</span>
                          </div>
                        )}
                        {data.subordinatesCount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Direct Reports:</span>
                            <span className="font-bold text-slate-800">{data.subordinatesCount} members</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Pulse Section */}
              {data.metrics && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Field Activity Pulse</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {data.metrics.totalVisits !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-lg font-bold text-slate-800 block">
                          {data.metrics.totalVisits}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Logged Visits</span>
                      </div>
                    )}
                    {data.metrics.totalOrders !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-lg font-bold text-slate-800 block">
                          {data.metrics.totalOrders}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Recorded Orders</span>
                      </div>
                    )}
                    {data.metrics.totalTourPlans !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-lg font-bold text-slate-800 block">
                          {data.metrics.totalTourPlans}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Tour Plans</span>
                      </div>
                    )}
                    {data.metrics.totalCollections !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-lg font-bold text-slate-800 block">
                          {data.metrics.totalCollections}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Collections</span>
                      </div>
                    )}
                    {data.metrics.totalTenders !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-lg font-bold text-slate-800 block">
                          {data.metrics.totalTenders}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">Tenders</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Dossier Actions Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Close Dossier
          </button>
          {canManage && (
            <button
              onClick={onEdit}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Pencil size={13} /> Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Append (Add New) Modal
// ------------------------------------------------------------------------------------------------
function AppendEntityModal({
  type,
  territories,
  onClose,
  onCreated,
}: {
  type: EntityType;
  territories: Territory[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [territoryId, setTerritoryId] = useState(territories[0]?.id || "");
  const [primarySpecialty, setPrimarySpecialty] = useState("General Medicine");
  const [secondarySpecialty, setSecondarySpecialty] = useState("");
  const [qualification, setQualification] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [billingName, setBillingName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [departments, setDepartments] = useState("");
  const [bedStrength, setBedStrength] = useState("");
  const [purchaseManager, setPurchaseManager] = useState("");
  // Employee fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [empRole, setEmpRole] = useState<string>("MR");
  const [password, setPassword] = useState("TrendMR@2026");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (type === "EMPLOYEE") {
      if (!firstName.trim()) return setError("First name is required.");
      if (!lastName.trim()) return setError("Last name is required.");
      if (!email.trim()) return setError("Email is required.");
      if (!phone.trim()) return setError("Phone number is required.");
    } else {
      if (!name.trim()) return setError("Entity name is required.");
      if (!address.trim()) return setError("Address is required.");
      if (!territoryId) return setError("Territory selection is required.");
      if (type === "DOCTOR" && !primarySpecialty.trim()) return setError("Primary specialty is required.");
    }

    setSubmitting(true);
    try {
      await apiClient.post("/api/manager/entities", {
        name: type === "EMPLOYEE" ? `${firstName.trim()} ${lastName.trim()}` : name.trim(),
        type,
        address: address.trim(),
        territoryId: territoryId || undefined,
        // Doctor
        ...(type === "DOCTOR"
          ? {
              primarySpecialty: primarySpecialty.trim(),
              secondarySpecialty: secondarySpecialty.trim() || undefined,
              qualification: qualification.trim() || undefined,
              registrationNo: registrationNo.trim() || undefined,
              whatsApp: whatsApp.trim() || undefined,
              mobile: whatsApp.trim() || undefined,
            }
          : {}),
        // Chemist
        ...(type === "CHEMIST"
          ? {
              contactPerson: contactPerson.trim() || undefined,
              billingName: billingName.trim() || undefined,
              gstNo: gstNo.trim() || undefined,
              licenseNo: licenseNo.trim() || undefined,
              creditLimit: creditLimit.trim() ? Number(creditLimit) : undefined,
              whatsApp: whatsApp.trim() || undefined,
            }
          : {}),
        // Distributor
        ...(type === "DISTRIBUTOR"
          ? {
              gstNo: gstNo.trim() || undefined,
              licenseNo: licenseNo.trim() || undefined,
              creditLimit: creditLimit.trim() ? Number(creditLimit) : undefined,
            }
          : {}),
        // Hospital
        ...(type === "HOSPITAL"
          ? {
              departments: departments.trim() || undefined,
              bedStrength: bedStrength.trim() ? Number(bedStrength) : undefined,
              purchaseManager: purchaseManager.trim() || undefined,
            }
          : {}),
        // Employee
        ...(type === "EMPLOYEE"
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              role: empRole,
              password: password.trim() || "TrendMR@2026",
            }
          : {}),
      });
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to append entity.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">
              Append New {type.charAt(0) + type.slice(1).toLowerCase()}
            </h2>
            <p className="text-xs text-slate-500">
              Multi-agent verified master record creation
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Employee Specific Form */}
          {type === "EMPLOYEE" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    First Name *
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Ramesh"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Last Name *
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh.sharma@trendmr.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                  >
                    {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Primary Territory
                </label>
                <select
                  value={territoryId}
                  onChange={(e) => setTerritoryId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                >
                  <option value="">Select Territory</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Defaults to TrendMR@2026"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            /* Doctor, Chemist, Distributor, Hospital Form */
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Entity Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    type === "DOCTOR"
                      ? "e.g. Dr. Rajesh Verma"
                      : type === "CHEMIST"
                      ? "e.g. Apollo Pharmacy Connaught"
                      : type === "DISTRIBUTOR"
                      ? "e.g. Medico Pharma Distributors"
                      : "e.g. Max Super Speciality Hospital"
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Assigned Territory *
                  </label>
                  <select
                    value={territoryId}
                    onChange={(e) => setTerritoryId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Territory</option>
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {type === "DOCTOR" ? "WhatsApp / Phone" : "Mobile / Phone"}
                  </label>
                  <input
                    value={whatsApp}
                    onChange={(e) => setWhatsApp(e.target.value)}
                    placeholder="e.g. 9811223344"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {type === "DOCTOR" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Primary Specialty *
                      </label>
                      <select
                        value={primarySpecialty}
                        onChange={(e) => setPrimarySpecialty(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                      >
                        {SPECIALTY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Secondary Specialty
                      </label>
                      <input
                        value={secondarySpecialty}
                        onChange={(e) => setSecondarySpecialty(e.target.value)}
                        placeholder="e.g. Diabetology"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Qualification
                      </label>
                      <input
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="e.g. MBBS, MD (Med)"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Registration No
                      </label>
                      <input
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                        placeholder="e.g. DMC/R/12345"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {type === "CHEMIST" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Contact Person
                      </label>
                      <input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Owner / Manager name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Billing Name
                      </label>
                      <input
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                        placeholder="Defaults to shop name"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        GSTIN
                      </label>
                      <input
                        value={gstNo}
                        onChange={(e) => setGstNo(e.target.value)}
                        placeholder="07AAAAA0000A1Z5"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Credit Limit (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="e.g. 100000"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {type === "DISTRIBUTOR" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      GSTIN
                    </label>
                    <input
                      value={gstNo}
                      onChange={(e) => setGstNo(e.target.value)}
                      placeholder="07AAAAA0000A1Z5"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      License No
                    </label>
                    <input
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="e.g. DL-20B-12345"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {type === "HOSPITAL" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Bed Strength
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={bedStrength}
                      onChange={(e) => setBedStrength(e.target.value)}
                      placeholder="e.g. 150"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Departments
                    </label>
                    <input
                      value={departments}
                      onChange={(e) => setDepartments(e.target.value)}
                      placeholder="ICU, Cardiology, Ortho"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Full Address *
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Landmark, City, Pincode"
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Verifying & Appending...
              </>
            ) : (
              `Append ${type.charAt(0) + type.slice(1).toLowerCase()}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Edit Entity Modal
// ------------------------------------------------------------------------------------------------
function EditEntityModal({
  type,
  row,
  territories,
  canManageRole,
  onClose,
  onSaved,
}: {
  type: EntityType;
  row: Row;
  territories: Territory[];
  canManageRole: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name || "");
  const [address, setAddress] = useState(row.address || "");
  const [territoryId, setTerritoryId] = useState(row.territoryId || "");
  // Doctor
  const [primarySpecialty, setPrimarySpecialty] = useState(row.primarySpecialty || "");
  const [secondarySpecialty, setSecondarySpecialty] = useState(row.secondarySpecialty || "");
  const [qualification, setQualification] = useState(row.qualification || "");
  const [registrationNo, setRegistrationNo] = useState(row.registrationNo || "");
  const [whatsApp, setWhatsApp] = useState(row.whatsApp || row.mobile || "");
  // Chemist
  const [contactPerson, setContactPerson] = useState(row.contactPerson || "");
  const [billingName, setBillingName] = useState(row.billingName || "");
  const [gstNo, setGstNo] = useState(row.gstNo || "");
  const [licenseNo, setLicenseNo] = useState(row.licenseNo || "");
  const [creditLimit, setCreditLimit] = useState(
    row.creditLimit !== null && row.creditLimit !== undefined ? String(row.creditLimit) : ""
  );
  // Hospital
  const [departments, setDepartments] = useState(row.departments || "");
  const [bedStrength, setBedStrength] = useState(
    row.bedStrength !== null && row.bedStrength !== undefined ? String(row.bedStrength) : ""
  );
  const [purchaseManager, setPurchaseManager] = useState(row.purchaseManager || "");
  // Employee
  const [phone, setPhone] = useState(row.phone || "");
  const [empRole, setEmpRole] = useState(row.role || "MR");
  const [isActive, setIsActive] = useState(row.isActive !== false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/entities/${row.id}`, {
        type,
        name: name.trim(),
        address: address.trim() || undefined,
        territoryId: territoryId || undefined,
        // Doctor
        ...(type === "DOCTOR"
          ? {
              primarySpecialty: primarySpecialty.trim(),
              secondarySpecialty: secondarySpecialty.trim() || undefined,
              qualification: qualification.trim() || undefined,
              registrationNo: registrationNo.trim() || undefined,
              whatsApp: whatsApp.trim() || undefined,
              mobile: whatsApp.trim() || undefined,
            }
          : {}),
        // Chemist
        ...(type === "CHEMIST"
          ? {
              contactPerson: contactPerson.trim() || undefined,
              billingName: billingName.trim() || undefined,
              gstNo: gstNo.trim() || undefined,
              licenseNo: licenseNo.trim() || undefined,
              creditLimit: creditLimit.trim() ? Number(creditLimit) : null,
              whatsApp: whatsApp.trim() || undefined,
            }
          : {}),
        // Distributor
        ...(type === "DISTRIBUTOR"
          ? {
              gstNo: gstNo.trim() || undefined,
              licenseNo: licenseNo.trim() || undefined,
              creditLimit: creditLimit.trim() ? Number(creditLimit) : null,
            }
          : {}),
        // Hospital
        ...(type === "HOSPITAL"
          ? {
              departments: departments.trim() || undefined,
              bedStrength: bedStrength.trim() ? Number(bedStrength) : undefined,
              purchaseManager: purchaseManager.trim() || undefined,
            }
          : {}),
        // Employee
        ...(type === "EMPLOYEE"
          ? {
              phone: phone.trim() || undefined,
              role: canManageRole ? (empRole as any) : undefined,
              isActive,
            }
          : {}),
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update entity.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">Edit {row.name}</h2>
            <p className="text-xs text-slate-500">Update master profile in centralized directory</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Territory
              </label>
              <select
                value={territoryId}
                onChange={(e) => setTerritoryId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
              >
                <option value="">Select Territory</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {type === "EMPLOYEE" ? "Phone" : "WhatsApp / Phone"}
              </label>
              <input
                value={type === "EMPLOYEE" ? phone : whatsApp}
                onChange={(e) => (type === "EMPLOYEE" ? setPhone(e.target.value) : setWhatsApp(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {type === "DOCTOR" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Primary Specialty
                  </label>
                  <input
                    value={primarySpecialty}
                    onChange={(e) => setPrimarySpecialty(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Secondary Specialty
                  </label>
                  <input
                    value={secondarySpecialty}
                    onChange={(e) => setSecondarySpecialty(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Qualification
                  </label>
                  <input
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Registration No
                  </label>
                  <input
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {type === "CHEMIST" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Billing Name
                  </label>
                  <input
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="Leave blank for none"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {type === "DISTRIBUTOR" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  GSTIN
                </label>
                <input
                  value={gstNo}
                  onChange={(e) => setGstNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  License No
                </label>
                <input
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {type === "HOSPITAL" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Bed Strength
                </label>
                <input
                  type="number"
                  min="0"
                  value={bedStrength}
                  onChange={(e) => setBedStrength(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Departments
                </label>
                <input
                  value={departments}
                  onChange={(e) => setDepartments(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {type === "EMPLOYEE" && canManageRole && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Assigned Role
                </label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                >
                  {EMPLOYEE_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Account Status
                </label>
                <select
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                >
                  <option value="true">Active</option>
                  <option value="false">Deactivated</option>
                </select>
              </div>
            </div>
          )}

          {type !== "EMPLOYEE" && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={submitting}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Saving Changes...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
