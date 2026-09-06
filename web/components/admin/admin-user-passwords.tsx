"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  KeyRound,
  Search,
  UserCheck,
  UserX,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface UserItem {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
}

export function AdminUserPasswords() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modal State
  const [targetUser, setTargetUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    apiClient
      .get("/api/users")
      .then((res) => {
        setUsers(res.data.data.users ?? []);
      })
      .catch((err) => console.error("Failed to load users for admin:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        u.email.toLowerCase().includes(term) ||
        (u.employee?.firstName && u.employee.firstName.toLowerCase().includes(term)) ||
        (u.employee?.lastName && u.employee.lastName.toLowerCase().includes(term)) ||
        u.role.toLowerCase().includes(term);
      return matchRole && matchSearch;
    });
  }, [users, search, roleFilter]);

  const handleOpenModal = (u: UserItem) => {
    setTargetUser(u);
    setNewPassword("");
    setShowPassword(false);
    setStatusMessage(null);
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(`Trend@${pwd.slice(0, 6)}`);
    setShowPassword(true);
  };

  const handleSetStandardPassword = () => {
    setNewPassword("Password@123");
    setShowPassword(true);
  };

  const handleSubmitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    if (newPassword.length < 6) {
      setStatusMessage({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.post("/api/admin/users/change-password", {
        userId: targetUser.id,
        newPassword,
      });
      setStatusMessage({
        type: "success",
        text: res.data.data.message || `Password for ${targetUser.email} updated successfully!`,
      });
      setTimeout(() => {
        setTargetUser(null);
      }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "Failed to update password.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
            <Shield size={13} className="text-slate-700" />
            ADMIN CREDENTIAL CONTROL
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Staff &amp; Password Management
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Reset or change credentials for any user account across the enterprise (MD, ASM, MR, Finance, HR).
            All passwords are cryptographically hashed with bcrypt and session tokens are cleanly invalidated upon update.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
        >
          <RefreshCw size={13} /> Refresh List
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
          />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
        >
          <option value="ALL">All Roles ({users.length})</option>
          <option value="MR">MR (Field Reps)</option>
          <option value="ASM">ASM (Area Managers)</option>
          <option value="MD">MD (Managing Director)</option>
          <option value="FINANCE">Finance</option>
          <option value="HR">HR</option>
          <option value="ADMIN">Admin</option>
          <option value="DISTRIBUTOR">Distributor</option>
          <option value="DOCTOR">Doctor</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-semibold text-slate-600">No users found.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or role filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-5 py-3.5">Employee / User</th>
                  <th className="px-5 py-3.5">Email Address</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const fullName = u.employee?.firstName
                    ? `${u.employee.firstName} ${u.employee.lastName || ""}`.trim()
                    : "Corporate User";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{fullName}</div>
                        {u.employee?.phone && (
                          <div className="text-xs text-slate-400">{u.employee.phone}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-600 text-xs">
                        {u.email}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          u.role === "ADMIN" ? "bg-slate-900 text-white" :
                          u.role === "MD" ? "bg-blue-100 text-blue-800" :
                          u.role === "ASM" ? "bg-emerald-100 text-emerald-800" :
                          u.role === "MR" ? "bg-purple-100 text-purple-800" :
                          u.role === "FINANCE" ? "bg-amber-100 text-amber-800" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {u.isActive ? <UserCheck size={11} /> : <UserX size={11} />}
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-semibold transition"
                        >
                          <KeyRound size={13} /> Change Password
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {targetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                  <p className="text-xs text-slate-500">Update credential for {targetUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setTargetUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitChange} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Role:</span>
                  <span className="font-bold text-slate-800">{targetUser.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-700">{targetUser.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)…"
                    required
                    minLength={6}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Quick Helper Presets */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetStandardPassword}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition text-center"
                >
                  Use &quot;Password@123&quot;
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition text-center flex items-center justify-center gap-1"
                >
                  <Sparkles size={11} /> Generate Random
                </button>
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {statusMessage.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTargetUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                >
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
