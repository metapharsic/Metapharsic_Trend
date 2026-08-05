"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Mail,
  Phone,
  ChevronDown,
  X,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Edit3,
  Trash2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

// ─── Role metadata ────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string; description: string; level: number }> = {
  MD: { label: "Managing Director", color: "text-violet-700", bg: "bg-violet-100", description: "Top-level executive. Full system access.", level: 1 },
  ASM: { label: "Area Sales Manager", color: "text-teal-700", bg: "bg-teal-100", description: "Directly manages Medical Representatives.", level: 2 },
  MR: { label: "Medical Representative", color: "text-emerald-700", bg: "bg-emerald-100", description: "Field force. Doctor/Chemist visits and DCR.", level: 3 },
  ADMIN: { label: "System Admin", color: "text-red-700", bg: "bg-red-100", description: "Full system administration. All permissions.", level: 0 },
};

interface UserRecord {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  lockedAt?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    manager?: { firstName: string; lastName: string } | null;
  } | null;
}

const ALL_ROLES = Object.keys(ROLE_META);

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      setMyRole(JSON.parse(atob(token.split(".")[1])).role ?? null);
    } catch {
      // ignore
    }
  }, []);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (search) params.set("search", search);
    apiClient.get(`/api/users?${params}`)
      .then((res) => setUsers(res.data.data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleActive = async (user: UserRecord) => {
    await apiClient.put(`/api/users/${user.id}`, { isActive: !user.isActive });
    fetchUsers();
  };

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const activeCount = users.filter((u) => u.isActive).length;
  const lockedCount = users.filter((u) => u.lockedAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-slate-400 text-sm mt-1">Manage all system users, roles, and access permissions</p>
            <div className="flex gap-6 mt-4 text-sm">
              <span className="text-slate-300"><span className="text-white font-bold text-lg">{users.length}</span> Total Users</span>
              <span className="text-slate-300"><span className="text-emerald-400 font-bold text-lg">{activeCount}</span> Active</span>
              <span className="text-slate-300"><span className="text-red-400 font-bold text-lg">{lockedCount}</span> Locked</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Role Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["ADMIN", "MD", "ASM", "MR"].map((role) => {
          const meta = ROLE_META[role];
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? "ALL" : role)}
              className={`rounded-2xl p-3 border text-left transition-all ${roleFilter === role ? `${meta.bg} border-current` : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className={`text-2xl font-bold ${meta.color}`}>{roleCounts[role] ?? 0}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 leading-tight">{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search and Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-2xl px-4 py-3 pr-10 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="ALL">All Roles</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role & Responsibilities</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Reports To</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const meta = ROLE_META[user.role] ?? { label: user.role, color: "text-slate-700", bg: "bg-slate-100", description: "" };
                const name = user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : "—";
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-sm font-bold ${meta.color}`}>
                            {name !== "—" ? name.charAt(0) : user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail size={10} /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{meta.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      {user.employee?.phone ? (
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Phone size={10} /> {user.employee.phone}
                        </span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {user.employee?.manager ? (
                        <span className="text-xs font-semibold text-slate-700">
                          {user.employee.manager.firstName} {user.employee.manager.lastName}
                        </span>
                      ) : <span className="text-xs text-slate-400">Top Level</span>}
                    </td>
                    <td className="px-6 py-4">
                      {user.lockedAt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          <Lock size={10} /> LOCKED
                        </span>
                      ) : user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={10} /> ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          <XCircle size={10} /> INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                          title="Edit User"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          className={`p-2 rounded-xl transition-colors ${user.isActive ? "bg-red-100 hover:bg-red-200 text-red-600" : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600"}`}
                          title={user.isActive ? "Deactivate" : "Activate"}
                        >
                          {user.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        {myRole === "ADMIN" && (
                          <button
                            onClick={() => setDeleteUser(user)}
                            className="p-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-700 transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-sm">
                    No users found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Role Responsibility Reference */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Shield className="text-slate-600" size={18} />
          <h2 className="text-base font-bold text-slate-800">Role Hierarchy & Responsibilities</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {Object.entries(ROLE_META)
            .sort((a, b) => a[1].level - b[1].level)
            .map(([role, meta]) => (
              <div key={role} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  {meta.level === 0 ? <ShieldAlert size={16} className={meta.color} /> :
                   meta.level <= 3 ? <ShieldCheck size={16} className={meta.color} /> :
                   <Shield size={16} className={meta.color} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${meta.bg} ${meta.color}`}>
                      {role}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{meta.label}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{meta.description}</p>
                </div>
                <span className="text-xs font-bold text-slate-400 flex-shrink-0">Level {meta.level}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editUser) && (
        <UserModal
          user={editUser}
          onClose={() => { setShowCreateModal(false); setEditUser(null); }}
          onSaved={() => { setShowCreateModal(false); setEditUser(null); fetchUsers(); }}
        />
      )}

      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={() => { setDeleteUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

// ─── Permanent Delete Modal ────────────────────────────────────────────────────
function DeleteUserModal({ user, onClose, onDeleted }: { user: UserRecord; onClose: () => void; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email;

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.delete(`/api/users/${user.id}?permanent=true`);
      onDeleted();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to permanently delete user.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-700" />
          </div>
          <h2 className="text-lg font-display font-bold text-slate-900">Delete Permanently</h2>
        </div>
        <p className="text-sm text-slate-600">
          This <strong>cannot be undone</strong>. It removes <strong>{name}</strong>&apos;s login and employee record
          entirely — not just deactivates it. Blocked automatically if they have any visits, orders, leads, or other
          recorded activity; deactivate instead in that case.
        </p>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Type DELETE to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={submitting || confirmText !== "DELETE"}
            className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
          >
            {submitting ? "Deleting..." : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function UserModal({ user, onClose, onSaved }: { user: UserRecord | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: user?.employee?.firstName ?? "",
    lastName: user?.employee?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.employee?.phone ?? "",
    role: user?.role ?? "MR",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (user) {
        await apiClient.put(`/api/users/${user.id}`, form);
      } else {
        await apiClient.post("/api/users", form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <h2 className="text-lg font-bold">{user ? "Edit User" : "Add New User"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <FormField label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
          </div>
          <FormField label="Email Address" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required disabled={!!user} />
          <FormField label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(ROLE_META).map(([r, m]) => (
                <option key={r} value={r}>{m.label} ({r})</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">{ROLE_META[form.role]?.description}</p>
          </div>
          <FormField label={user ? "New Password (leave blank to keep)" : "Password"} value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" required={!user} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : user ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}
