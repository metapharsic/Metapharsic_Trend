"use client";

import React, { useState, useEffect } from "react";
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
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

type EntityType = "DOCTOR" | "CHEMIST" | "HOSPITAL" | "EMPLOYEE" | "DISTRIBUTOR";

interface Row {
  id: string;
  name: string;
  type: string;
  address: string | null;
  territoryId: string | null;
  primarySpecialty?: string;
  contactPerson?: string;
  departments?: string;
  role?: string;
  email?: string;
  phone?: string;
  whatsApp?: string;
  creditLimit?: number | null;
  billingName?: string | null;
  gstNo?: string | null;
  licenseNo?: string | null;
  bedStrength?: number | null;
  secondarySpecialty?: string | null;
}

function currency(value: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

interface Territory {
  id: string;
  name: string;
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

const TABS: { id: EntityType; label: string; icon: typeof Stethoscope }[] = [
  { id: "DOCTOR", label: "Doctors", icon: Stethoscope },
  { id: "CHEMIST", label: "Chemists", icon: Store },
  { id: "DISTRIBUTOR", label: "Distributors", icon: Truck },
  { id: "HOSPITAL", label: "Hospitals", icon: Building },
  { id: "EMPLOYEE", label: "Employees", icon: Users },
];

export default function MasterProfiles() {
  const [activeTab, setActiveTab] = useState<EntityType>("DOCTOR");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editCreditRow, setEditCreditRow] = useState<Row | null>(null);
  const [editDistributorRow, setEditDistributorRow] = useState<Row | null>(null);
  const [editDoctorRow, setEditDoctorRow] = useState<Row | null>(null);
  const [editHospitalRow, setEditHospitalRow] = useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRole(decodeRole());
  }, []);

  const canManage = role === "ASM" || role === "ADMIN";
  // MR is the first point of contact — they can add doctors/chemists they
  // encounter in the field, but not hospitals or employees (backend also enforces this).
  const canCreate = canManage || ((role === "MR") && (activeTab === "DOCTOR" || activeTab === "CHEMIST"));

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      apiClient
        .get("/api/manager/entities", { params: { type: activeTab, search: search || undefined, limit: 50 } })
        .then((res) => setRows(res.data.data.entities))
        .catch((err) => console.error("Failed to load entities:", err))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  const reload = () => {
    apiClient
      .get("/api/manager/entities", { params: { type: activeTab, search: search || undefined, limit: 50 } })
      .then((res) => setRows(res.data.data.entities))
      .catch((err) => console.error("Failed to load entities:", err));
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/manager/entities/${deleteRow.id}`, { params: { type: activeTab } });
      setDeleteRow(null);
      reload();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to delete entity.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100 flex justify-between items-center bg-gradient-to-r from-teal-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Master Profiles</h1>
          <p className="text-sm text-slate-500 mt-1">Centralized directory for all business entities</p>
        </div>
        {canCreate && activeTab !== "EMPLOYEE" && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Add New
          </button>
        )}
        {canManage && activeTab === "EMPLOYEE" && (
          <Link
            href="/users"
            className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 shadow-sm transition-colors flex items-center gap-2"
          >
            Manage in Users <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id ? "border-teal-600 text-teal-700 bg-teal-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeTab.toLowerCase()}s...`}
              className="pl-9 pr-4 py-2 text-base sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-full"
            />
          </div>
        </div>

        {activeTab === "EMPLOYEE" && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
            Read-only here — synced live from Users. Add, edit, deactivate, or delete employees in{" "}
            <Link href="/users" className="font-semibold underline">Users</Link>.
          </div>
        )}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-slate-400 text-sm">
              No {activeTab.toLowerCase()}s found.
            </div>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-white text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Name / Type</th>
                  <th className="px-6 py-3 font-semibold">Details</th>
                  <th className="px-6 py-3 font-semibold">Territory / Address</th>
                  {activeTab === "CHEMIST" && <th className="px-6 py-3 font-semibold">GSTIN</th>}
                  {activeTab === "CHEMIST" && <th className="px-6 py-3 font-semibold">Credit Limit</th>}
                  {activeTab === "DISTRIBUTOR" && <th className="px-6 py-3 font-semibold">GSTIN</th>}
                  {activeTab === "DISTRIBUTOR" && <th className="px-6 py-3 font-semibold">License No</th>}
                  {activeTab !== "EMPLOYEE" && canManage && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.type === "DOCTOR" && row.primarySpecialty}
                        {row.type === "CHEMIST" && row.contactPerson}
                        {row.type === "HOSPITAL" && row.departments}
                        {row.type === "EMPLOYEE" && row.role}
                        {row.type === "DISTRIBUTOR" && row.licenseNo}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.type === "EMPLOYEE" ? (
                        <>
                          <p>{row.email}</p>
                          <p className="text-xs text-slate-400">{row.phone}</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">{row.whatsApp ?? "—"}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{row.address ?? "—"}</td>
                    {activeTab === "CHEMIST" && (
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{row.gstNo || "—"}</td>
                    )}
                    {activeTab === "CHEMIST" && (
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {row.creditLimit !== null && row.creditLimit !== undefined ? currency(row.creditLimit) : "—"}
                      </td>
                    )}
                    {activeTab === "DISTRIBUTOR" && (
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{row.gstNo || "—"}</td>
                    )}
                    {activeTab === "DISTRIBUTOR" && (
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{row.licenseNo || "—"}</td>
                    )}
                    {activeTab !== "EMPLOYEE" && canManage && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (activeTab === "CHEMIST") setEditCreditRow(row);
                            else if (activeTab === "DISTRIBUTOR") setEditDistributorRow(row);
                            else if (activeTab === "DOCTOR") setEditDoctorRow(row);
                            else if (activeTab === "HOSPITAL") setEditHospitalRow(row);
                          }}
                          className="text-teal-600 hover:bg-teal-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => { setDeleteRow(row); setDeleteError(null); }}
                          className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && (
        <AddEntityModal
          type={activeTab as "DOCTOR" | "CHEMIST" | "HOSPITAL" | "DISTRIBUTOR"}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            reload();
          }}
        />
      )}

      {editCreditRow && (
        <EditCreditLimitModal
          row={editCreditRow}
          onClose={() => setEditCreditRow(null)}
          onSaved={() => {
            setEditCreditRow(null);
            reload();
          }}
        />
      )}

      {editDistributorRow && (
        <EditDistributorModal
          row={editDistributorRow}
          onClose={() => setEditDistributorRow(null)}
          onSaved={() => {
            setEditDistributorRow(null);
            reload();
          }}
        />
      )}

      {editDoctorRow && (
        <EditDoctorModal
          row={editDoctorRow}
          onClose={() => setEditDoctorRow(null)}
          onSaved={() => {
            setEditDoctorRow(null);
            reload();
          }}
        />
      )}

      {editHospitalRow && (
        <EditHospitalModal
          row={editHospitalRow}
          onClose={() => setEditHospitalRow(null)}
          onSaved={() => {
            setEditHospitalRow(null);
            reload();
          }}
        />
      )}

      {deleteRow && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">Delete {deleteRow.name}?</h2>
              <button onClick={() => setDeleteRow(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              This permanently removes the record. If it has linked visits, orders, or invoices, deletion will be blocked — reassign or remove those first.
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteRow(null)}
                className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditCreditLimitModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [creditValue, setCreditValue] = useState(row.creditLimit !== null && row.creditLimit !== undefined ? String(row.creditLimit) : "");
  const [billingName, setBillingName] = useState(row.billingName ?? "");
  const [gstNo, setGstNo] = useState(row.gstNo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = creditValue.trim();
    const newLimit = trimmed === "" ? null : Number(trimmed);
    if (newLimit !== null && (Number.isNaN(newLimit) || newLimit < 0)) {
      return setError("Enter a valid non-negative credit limit, or leave blank for no limit.");
    }

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/entities/${row.id}`, {
        type: "CHEMIST",
        creditLimit: newLimit,
        billingName: billingName.trim() || null,
        gstNo: gstNo.trim() || null,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update party details.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Party Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500">{row.name}</p>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Billing Name</label>
          <input
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            placeholder="Legal/billing name — defaults to shop name"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GSTIN</label>
          <input
            value={gstNo}
            onChange={(e) => setGstNo(e.target.value)}
            placeholder="e.g. 07AAACX1234F1Z5"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Credit Limit</label>
          <input
            type="number"
            min={0}
            value={creditValue}
            onChange={(e) => setCreditValue(e.target.value)}
            placeholder="₹ — leave blank for no limit"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Billing name + GSTIN are captured on every invoice generated for this party. Orders past the credit limit are blocked automatically.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function EditDistributorModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [address, setAddress] = useState(row.address ?? "");
  const [gstNo, setGstNo] = useState(row.gstNo ?? "");
  const [licenseNo, setLicenseNo] = useState(row.licenseNo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!address.trim()) return setError("Address is required.");

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/entities/${row.id}`, {
        type: "DISTRIBUTOR",
        name: name.trim(),
        address: address.trim(),
        gstNo: gstNo.trim() || null,
        licenseNo: licenseNo.trim() || null,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update distributor.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Distributor Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Distributor name"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GSTIN</label>
          <input
            value={gstNo}
            onChange={(e) => setGstNo(e.target.value)}
            placeholder="e.g. 07AAACX1234F1Z5"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">License No</label>
          <input
            value={licenseNo}
            onChange={(e) => setLicenseNo(e.target.value)}
            placeholder="License number"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function EditDoctorModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [address, setAddress] = useState(row.address ?? "");
  const [primarySpecialty, setPrimarySpecialty] = useState(row.primarySpecialty ?? "");
  const [secondarySpecialty, setSecondarySpecialty] = useState(row.secondarySpecialty ?? "");
  const [whatsApp, setWhatsApp] = useState(row.whatsApp ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!primarySpecialty.trim()) return setError("Primary specialty is required.");

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/entities/${row.id}`, {
        type: "DOCTOR",
        name: name.trim(),
        address: address.trim(),
        primarySpecialty: primarySpecialty.trim(),
        secondarySpecialty: secondarySpecialty.trim() || undefined,
        whatsApp: whatsApp.trim() || undefined,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update doctor.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Doctor Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Primary Specialty</label>
          <input
            value={primarySpecialty}
            onChange={(e) => setPrimarySpecialty(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Secondary Specialty</label>
          <input
            value={secondarySpecialty}
            onChange={(e) => setSecondarySpecialty(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp</label>
          <input
            value={whatsApp}
            onChange={(e) => setWhatsApp(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function EditHospitalModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [address, setAddress] = useState(row.address ?? "");
  const [departments, setDepartments] = useState(row.departments ?? "");
  const [bedStrength, setBedStrength] = useState(
    row.bedStrength !== null && row.bedStrength !== undefined ? String(row.bedStrength) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!address.trim()) return setError("Address is required.");
    const bedVal = bedStrength.trim() === "" ? undefined : Number(bedStrength);
    if (bedVal !== undefined && (Number.isNaN(bedVal) || bedVal < 0)) {
      return setError("Bed strength must be a non-negative number.");
    }

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/entities/${row.id}`, {
        type: "HOSPITAL",
        name: name.trim(),
        address: address.trim(),
        departments: departments.trim() || undefined,
        bedStrength: bedVal,
      });
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to update hospital.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">Hospital Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Departments</label>
          <input
            value={departments}
            onChange={(e) => setDepartments(e.target.value)}
            placeholder="Comma separated"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bed Strength</label>
          <input
            type="number"
            min={0}
            value={bedStrength}
            onChange={(e) => setBedStrength(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function AddEntityModal({
  type,
  onClose,
  onCreated,
}: {
  type: "DOCTOR" | "CHEMIST" | "HOSPITAL" | "DISTRIBUTOR";
  onClose: () => void;
  onCreated: () => void;
}) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [primarySpecialty, setPrimarySpecialty] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [billingName, setBillingName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [departments, setDepartments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/manager/territories")
      .then((res) => {
        const list = res.data.data.territories || [];
        setTerritories(list);
        if (list.length === 1) setTerritoryId(list[0].id);
      })
      .catch((err) => console.error("Failed to load territories:", err));
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!territoryId) return setError("Select a territory.");
    if (type === "DOCTOR" && !primarySpecialty.trim()) return setError("Primary specialty is required.");

    setSubmitting(true);
    try {
      await apiClient.post("/api/manager/entities", {
        name: name.trim(),
        type,
        address: address.trim(),
        territoryId,
        ...(type === "DOCTOR" ? { primarySpecialty: primarySpecialty.trim() } : {}),
        ...(type === "CHEMIST"
          ? {
              contactPerson: contactPerson.trim() || undefined,
              billingName: billingName.trim() || undefined,
              gstNo: gstNo.trim() || undefined,
            }
          : {}),
        ...(type === "HOSPITAL" ? { departments: departments.trim() || undefined } : {}),
        ...(type === "DISTRIBUTOR"
          ? { licenseNo: licenseNo.trim() || undefined, gstNo: gstNo.trim() || undefined }
          : {}),
      });
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to add entity.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const label =
    type === "DOCTOR" ? "Doctor" : type === "CHEMIST" ? "Chemist" : type === "DISTRIBUTOR" ? "Distributor" : "Hospital";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900">New {label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
        />
        {type === "DOCTOR" && (
          <input
            value={primarySpecialty}
            onChange={(e) => setPrimarySpecialty(e.target.value)}
            placeholder="Primary specialty *"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        )}
        {type === "CHEMIST" && (
          <>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Contact person"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
            <input
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              placeholder="Billing name (optional — defaults to shop name)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
            <input
              value={gstNo}
              onChange={(e) => setGstNo(e.target.value)}
              placeholder="GSTIN (optional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
          </>
        )}
        {type === "HOSPITAL" && (
          <input
            value={departments}
            onChange={(e) => setDepartments(e.target.value)}
            placeholder="Departments (comma separated)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        )}
        {type === "DISTRIBUTOR" && (
          <>
            <input
              value={licenseNo}
              onChange={(e) => setLicenseNo(e.target.value)}
              placeholder="License No (optional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
            <input
              value={gstNo}
              onChange={(e) => setGstNo(e.target.value)}
              placeholder="GSTIN (optional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
          </>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address *"
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
        />
        <select
          value={territoryId}
          onChange={(e) => setTerritoryId(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
        >
          <option value="">Select territory *</option>
          {territories.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? "Adding..." : `Add ${label}`}
        </button>
      </div>
    </div>
  );
}
