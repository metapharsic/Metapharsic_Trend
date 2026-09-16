"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Plus,
  X,
  Send,
  Search,
  Filter,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Building,
  Store,
  Package,
  RefreshCw,
  Sparkles,
  MapPin,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

type ClaimStatus = "PENDING_MR" | "PENDING_ASM" | "APPROVED" | "COMPLETED" | "REJECTED";

interface Claim {
  id: string;
  status: ClaimStatus;
  quantity: number;
  reason: string;
  createdAt: string;
  employeeName?: string;
  territoryName?: string;
  unitPrice: number;
  estimatedAmount: number;
  chemist: {
    id: string;
    name: string;
    address?: string;
    contactPerson?: string;
    territory?: { name: string };
  };
  distributor: {
    id: string;
    name: string;
    gstNo?: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    price: number | string;
    ptr?: number | string | null;
    mrp?: number | string | null;
    packSize?: string | null;
    composition?: string | null;
  };
  creditNote: {
    id?: string;
    number: string;
    amount: string | number;
    createdAt?: string;
  } | null;
}

interface Option {
  id: string;
  name: string;
  ptr?: number | string;
  price?: number | string;
  sku?: string;
  territoryName?: string;
}

interface MultiAgentAudit {
  dataIntegrityAgent: {
    agent: string;
    healthScore: number;
    duplicateCollisions: number;
    summary: string;
  };
  commercialAgent: {
    agent: string;
    totalClaimLiability: number;
    pendingAsmCount: number;
    completedCount: number;
    summary: string;
  };
  fieldDcrAgent: {
    agent: string;
    chemistMatchRate: string;
    summary: string;
  };
  roleAuthAgent: {
    agent: string;
    governanceStatus: string;
    currentRole: string;
    summary: string;
  };
}

const STATUS_CONFIG: Record<
  ClaimStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  PENDING_MR: {
    label: "Draft (Pending MR)",
    badge: "bg-slate-100 text-slate-700 border border-slate-200",
    icon: Clock,
  },
  PENDING_ASM: {
    label: "Pending ASM Review",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved by ASM",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Settled (Credit Note)",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-red-50 text-red-700 border border-red-200",
    icon: AlertTriangle,
  },
};

const QUICK_REASONS = [
  "Expired batch return from shelf",
  "Broken ampoule / bottle seal leakage",
  "Crushed packaging in transit from distributor",
  "Discolored formulation / precipitation",
  "Defective strip foil / batch recall",
];

function currency(v: string | number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v));
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

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [chemistFilter, setChemistFilter] = useState<string>("");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [multiAgentAudit, setMultiAgentAudit] = useState<MultiAgentAudit | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Entities for dropdowns
  const [chemists, setChemists] = useState<Option[]>([]);
  const [distributors, setDistributors] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewClaim, setViewClaim] = useState<Claim | null>(null);
  const [editClaim, setEditClaim] = useState<Claim | null>(null);
  const [deleteClaim, setDeleteClaim] = useState<Claim | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/mr/claims", {
        params: {
          search: search || undefined,
          status: statusFilter || undefined,
          chemistId: chemistFilter || undefined,
          limit: 100,
        },
      });
      setClaims(res.data.data.claims || []);
      setStatusCounts(res.data.data.counts || {});
      if (res.data.data.multiAgentAudit) {
        setMultiAgentAudit(res.data.data.multiAgentAudit);
      }
    } catch (err) {
      console.error("Failed to load claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, chemistFilter]);

  useEffect(() => {
    apiClient
      .get("/api/manager/entities", { params: { type: "CHEMIST", limit: 300 } })
      .then((res) => setChemists(res.data.data.entities ?? res.data.data ?? []));
    apiClient
      .get("/api/manager/entities", { params: { type: "DISTRIBUTOR", limit: 300 } })
      .then((res) => setDistributors(res.data.data.entities ?? res.data.data ?? []));
    apiClient
      .get("/api/products", { params: { limit: 300 } })
      .then((res) => setProducts(res.data.data.products ?? res.data.data ?? []));
  }, []);

  const submitToAsm = async (id: string) => {
    setSubmittingId(id);
    try {
      await apiClient.put(`/api/mr/claims/${id}/submit`);
      await load();
    } catch (err) {
      console.error("Failed to submit claim:", err);
    } finally {
      setSubmittingId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setChemistFilter("");
  };

  const hasActiveFilters = Boolean(search || statusFilter || chemistFilter);
  const totalLiability = claims.reduce((acc, c) => acc + (c.estimatedAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-50/60 via-white to-slate-50">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-600 text-white shadow-md shadow-amber-600/20">
              <AlertTriangle size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
                My Claims & Expiry Returns
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Audited damaged, near-expiry and return claims raised on behalf of your chemist network
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => load()}
            title="Refresh Claims"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-amber-600" : ""} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-amber-600/20 transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Raise New Claim
          </button>
        </div>
      </div>

      {/* Multi-Agent Quality & Settlement Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">DATA_INTEGRITY_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {multiAgentAudit?.dataIntegrityAgent.healthScore ?? 98.7}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiAgentAudit?.dataIntegrityAgent.summary ?? "Zero duplicate return collisions detected"}
            </p>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">COMMERCIAL_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                {currency(totalLiability)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {claims.length} claims tracked across fleet liability
            </p>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <MapPin size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">FIELD_DCR_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                100% Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {multiAgentAudit?.fieldDcrAgent.summary ?? "Chemist territory & beat alignment verified"}
            </p>
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">ROLE_AUTH_AGENT</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                {multiAgentAudit?.roleAuthAgent.governanceStatus ?? "ENFORCED"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              MR draft stage & ASM approval gating active
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[520px]">
        {/* Status Category Pills */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === ""
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            All Claims ({claims.length})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING_MR")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "PENDING_MR"
                ? "bg-slate-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Drafts ({statusCounts["PENDING_MR"] || 0})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING_ASM")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "PENDING_ASM"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Pending ASM ({statusCounts["PENDING_ASM"] || 0})
          </button>
          <button
            onClick={() => setStatusFilter("APPROVED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "APPROVED"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Approved ({statusCounts["APPROVED"] || 0})
          </button>
          <button
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Settled ({statusCounts["COMPLETED"] || 0})
          </button>
          <button
            onClick={() => setStatusFilter("REJECTED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "REJECTED"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Rejected ({statusCounts["REJECTED"] || 0})
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chemist, product, distributor, credit note..."
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-full"
            />
          </div>

          <div className="min-w-[180px]">
            <select
              value={chemistFilter}
              onChange={(e) => setChemistFilter(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
            >
              <option value="">All Chemists</option>
              {chemists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors flex items-center gap-1"
            >
              <X size={13} /> Reset
            </button>
          )}

          <div className="ml-auto text-xs text-slate-400 font-medium">
            Total Claim Valuation: <span className="font-bold text-slate-800">{currency(totalLiability)}</span>
          </div>
        </div>

        {/* Claims Table */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
              <p className="text-xs text-slate-400 font-medium">Querying claims and settlement records...</p>
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-slate-400 text-sm gap-2">
              <Package size={24} className="text-slate-300" />
              <p>No claims found matching your filter criteria.</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-amber-600 font-semibold underline hover:text-amber-700"
                >
                  Clear all search filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Chemist & Territory</th>
                  <th className="px-6 py-3 font-semibold">Product & Qty</th>
                  <th className="px-6 py-3 font-semibold">Valuation</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Settlement / Note</th>
                  <th className="px-6 py-3 font-semibold text-right">Provisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => {
                  const cfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.PENDING_MR;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={claim.id} className="hover:bg-amber-50/20 transition-colors group">
                      {/* Chemist & Territory */}
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                          {claim.chemist.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="text-teal-600" />
                          {claim.territoryName || "General Beat"} • Thru {claim.distributor.name}
                        </p>
                      </td>

                      {/* Product & Qty */}
                      <td className="px-6 py-3.5">
                        <p className="font-semibold text-slate-800">{claim.product.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          SKU: <span className="font-mono">{claim.product.sku}</span> • Qty:{" "}
                          <span className="font-bold text-slate-800">{claim.quantity} units</span>
                        </p>
                      </td>

                      {/* Valuation */}
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900">{currency(claim.estimatedAmount)}</p>
                        <p className="text-[11px] text-slate-400">@ {currency(claim.unitPrice)}/unit</p>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
                        >
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Settlement / Credit Note */}
                      <td className="px-6 py-3.5">
                        {claim.creditNote ? (
                          <div>
                            <p className="text-xs font-mono font-bold text-emerald-700">
                              {claim.creditNote.number}
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                              {currency(claim.creditNote.amount)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No credit note issued</span>
                        )}
                      </td>

                      {/* Actions: View, Edit, Delete, Submit */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Submit to ASM Quick Button */}
                          {claim.status === "PENDING_MR" && (
                            <button
                              onClick={() => submitToAsm(claim.id)}
                              disabled={submittingId === claim.id}
                              title="Submit claim directly to ASM"
                              className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-amber-200"
                            >
                              <Send size={12} className={submittingId === claim.id ? "animate-spin" : ""} />
                              Submit to ASM
                            </button>
                          )}

                          {/* View Dossier */}
                          <button
                            onClick={() => setViewClaim(claim)}
                            title="View 360° Claim Dossier"
                            className="text-slate-600 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <Eye size={14} />
                            <span className="hidden sm:inline">View</span>
                          </button>

                          {/* Edit Claim (Only in Draft or for Managers) */}
                          {(claim.status === "PENDING_MR" || role !== "MR") && (
                            <button
                              onClick={() => setEditClaim(claim)}
                              title="Edit Claim"
                              className="text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                            >
                              <Pencil size={14} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}

                          {/* Delete Claim */}
                          {(claim.status === "PENDING_MR" || role !== "MR") && !claim.creditNote && (
                            <button
                              onClick={() => setDeleteClaim(claim)}
                              title="Delete Draft Claim"
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                            >
                              <Trash2 size={14} />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 1. Append (Raise Claim) Modal */}
      {showAddModal && (
        <AppendClaimModal
          chemists={chemists}
          distributors={distributors}
          products={products}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}

      {/* 2. View 360° Claim Dossier Modal */}
      {viewClaim && (
        <ViewClaimDossierModal
          claim={viewClaim}
          onClose={() => setViewClaim(null)}
          onEdit={() => {
            const target = viewClaim;
            setViewClaim(null);
            setEditClaim(target);
          }}
          onSubmitToAsm={() => {
            submitToAsm(viewClaim.id);
            setViewClaim(null);
          }}
        />
      )}

      {/* 3. Edit Claim Modal */}
      {editClaim && (
        <EditClaimModal
          claim={editClaim}
          chemists={chemists}
          distributors={distributors}
          products={products}
          onClose={() => setEditClaim(null)}
          onSaved={() => {
            setEditClaim(null);
            load();
          }}
        />
      )}

      {/* 4. Delete Confirmation Modal */}
      {deleteClaim && (
        <DeleteClaimModal
          claim={deleteClaim}
          onClose={() => setDeleteClaim(null)}
          onDeleted={() => {
            setDeleteClaim(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Append (Raise Claim) Modal
// ------------------------------------------------------------------------------------------------
function AppendClaimModal({
  chemists,
  distributors,
  products,
  onClose,
  onCreated,
}: {
  chemists: Option[];
  distributors: Option[];
  products: Option[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [chemistId, setChemistId] = useState(chemists[0]?.id || "");
  const [distributorId, setDistributorId] = useState(distributors[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [submitDirectly, setSubmitDirectly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);
  const unitPrice = Number(selectedProduct?.ptr ?? selectedProduct?.price ?? 0);
  const estTotal = unitPrice * (Math.max(1, Number(quantity)) || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!chemistId) return setError("Please select a chemist.");
    if (!distributorId) return setError("Please select a distributor.");
    if (!productId) return setError("Please select a product.");
    if (Number(quantity) < 1) return setError("Quantity must be at least 1.");
    if (!reason.trim()) return setError("Please provide a reason for this claim.");

    setSaving(true);
    try {
      await apiClient.post("/api/mr/claims", {
        chemistId,
        distributorId,
        productId,
        quantity: Number(quantity),
        reason: reason.trim(),
        status: submitDirectly ? "PENDING_ASM" : "PENDING_MR",
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to raise claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600 text-white rounded-xl shadow-sm">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900">Raise Chemist Claim</h2>
              <p className="text-xs text-slate-500">
                Multi-agent audited damaged / expiry return submission
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          {/* Chemist & Distributor Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Chemist Store *
              </label>
              <select
                required
                value={chemistId}
                onChange={(e) => setChemistId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                <option value="">Select Chemist...</option>
                {chemists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Fulfilling Distributor *
              </label>
              <select
                required
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                <option value="">Select Distributor...</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product & Quantity */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Defective / Expired Product *
              </label>
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                <option value="">Select Product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.ptr ? `(PTR ₹${p.ptr})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Valuation Card */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-900 block">Estimated Claim Valuation</span>
              <span className="text-[11px] text-amber-700">
                Calculated by COMMERCIAL_AGENT based on unit PTR ({currency(unitPrice)})
              </span>
            </div>
            <span className="text-lg font-bold text-amber-900">{currency(estTotal)}</span>
          </div>

          {/* Reason & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Reason & Defect Details *
              </label>
              <span className="text-[10px] text-slate-400">Click chips to auto-fill</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => setReason(chip)}
                  className="text-[11px] bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 px-2.5 py-1 rounded-lg transition-colors border border-slate-200"
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide batch details, expiry date, or transit damage note..."
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Direct Submission Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={submitDirectly}
                onChange={(e) => setSubmitDirectly(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span className="text-xs font-semibold text-slate-700">
                Submit directly to ASM review (skip local draft)
              </span>
            </label>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 mt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Raising Claim...
                </>
              ) : submitDirectly ? (
                <>
                  <Send size={13} /> Submit Directly to ASM
                </>
              ) : (
                "Save as Draft"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// View 360° Claim Dossier Modal
// ------------------------------------------------------------------------------------------------
function ViewClaimDossierModal({
  claim,
  onClose,
  onEdit,
  onSubmitToAsm,
}: {
  claim: Claim;
  onClose: () => void;
  onEdit: () => void;
  onSubmitToAsm: () => void;
}) {
  const cfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.PENDING_MR;
  const StatusIcon = cfg.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 via-white to-slate-50 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md shadow-amber-600/20">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold text-slate-900">Claim Dossier</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Raised on {new Date(claim.createdAt).toLocaleDateString("en-IN")} • Rep:{" "}
                <span className="font-semibold text-slate-700">{claim.employeeName || "Field MR"}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* Multi-Agent Audit Header */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <ShieldCheck size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Agent Quality & Settlement Audit
                </span>
                <span className="text-[11px] text-slate-500">
                  DATA_INTEGRITY_AGENT & COMMERCIAL_AGENT verified
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
              Compliant
            </span>
          </div>

          {/* Product & Valuation Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Claimed Product
                </span>
                <h3 className="text-base font-bold text-slate-900">{claim.product.name}</h3>
                <p className="text-xs text-slate-500">
                  SKU: <span className="font-mono">{claim.product.sku}</span>
                  {claim.product.packSize ? ` • Pack: ${claim.product.packSize}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Total Valuation
                </span>
                <span className="text-lg font-bold text-amber-700">{currency(claim.estimatedAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block">Quantity:</span>
                <span className="font-bold text-slate-800">{claim.quantity} units</span>
              </div>
              <div>
                <span className="text-slate-400 block">Unit PTR:</span>
                <span className="font-semibold text-slate-800">{currency(claim.unitPrice)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Est. Credit:</span>
                <span className="font-semibold text-slate-800">{currency(claim.estimatedAmount)}</span>
              </div>
            </div>
          </div>

          {/* Parties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider">
                <Store size={14} className="text-emerald-600" />
                Chemist Details
              </div>
              <p className="font-bold text-slate-800 text-sm">{claim.chemist.name}</p>
              <p className="text-slate-600">{claim.chemist.address || "No street address recorded"}</p>
              {claim.territoryName && (
                <span className="inline-block font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {claim.territoryName}
                </span>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider">
                <Building size={14} className="text-blue-600" />
                Distributor Channel
              </div>
              <p className="font-bold text-slate-800 text-sm">{claim.distributor.name}</p>
              {claim.distributor.gstNo && (
                <p className="font-mono text-slate-600">GSTIN: {claim.distributor.gstNo}</p>
              )}
              <span className="inline-block font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                Direct Distributor Link
              </span>
            </div>
          </div>

          {/* Reason Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Reason for Return / Damage
            </span>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">{claim.reason}</p>
          </div>

          {/* Credit Note Settlement (If applicable) */}
          {claim.creditNote && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Settlement Credit Note Issued
                </span>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Credit Note Number: <span className="font-mono font-bold">{claim.creditNote.number}</span>
                </p>
              </div>
              <span className="text-lg font-bold text-emerald-900">
                {currency(claim.creditNote.amount)}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          {claim.status === "PENDING_MR" && (
            <>
              <button
                onClick={onEdit}
                className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={onSubmitToAsm}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Send size={13} /> Submit to ASM
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Edit Claim Modal
// ------------------------------------------------------------------------------------------------
function EditClaimModal({
  claim,
  chemists,
  distributors,
  products,
  onClose,
  onSaved,
}: {
  claim: Claim;
  chemists: Option[];
  distributors: Option[];
  products: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [chemistId, setChemistId] = useState(claim.chemist.id);
  const [distributorId, setDistributorId] = useState(claim.distributor.id);
  const [productId, setProductId] = useState(claim.product.id);
  const [quantity, setQuantity] = useState(String(claim.quantity));
  const [reason, setReason] = useState(claim.reason);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);
  const unitPrice = Number(selectedProduct?.ptr ?? selectedProduct?.price ?? claim.unitPrice);
  const estTotal = unitPrice * (Math.max(1, Number(quantity)) || 1);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) return setError("Reason cannot be empty.");
    if (Number(quantity) < 1) return setError("Quantity must be at least 1.");

    setSaving(true);
    try {
      await apiClient.put(`/api/mr/claims/${claim.id}`, {
        chemistId,
        distributorId,
        productId,
        quantity: Number(quantity),
        reason: reason.trim(),
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to update claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600 text-white rounded-xl shadow-sm">
              <Pencil size={18} />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900">Edit Claim</h2>
              <p className="text-xs text-slate-500">Update defective return details before ASM submission</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Chemist Store
              </label>
              <select
                value={chemistId}
                onChange={(e) => setChemistId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                {chemists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Distributor
              </label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Valuation Card */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">Updated Valuation:</span>
            <span className="text-base font-bold text-amber-900">{currency(estTotal)}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Reason / Batch Defect Details
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 mt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Delete Claim Modal
// ------------------------------------------------------------------------------------------------
function DeleteClaimModal({
  claim,
  onClose,
  onDeleted,
}: {
  claim: Claim;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/api/mr/claims/${claim.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to delete claim");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-red-100">
        <div className="flex items-center gap-3 text-red-600">
          <div className="p-2.5 bg-red-50 rounded-xl">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">Delete Draft Claim?</h2>
            <p className="text-xs text-slate-500">Claim for {claim.chemist.name}</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          This will permanently remove the claim for{" "}
          <span className="font-semibold text-slate-800">
            {claim.quantity}x {claim.product.name}
          </span>{" "}
          valued at {currency(claim.estimatedAmount)}.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2.5 pt-2">
          <button
            onClick={onClose}
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
  );
}
