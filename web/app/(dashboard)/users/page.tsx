"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  MapPin,
  UserCheck,
  Briefcase,
  Layers,
  Sparkles,
  Smartphone,
  RotateCcw,
  Target,
  Award,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Role } from "@prisma/client";
import {
  ROLES_RESPONSIBILITIES_CATALOG,
  RoleDefinition,
  getEligibleManagerRoles,
} from "@/lib/roles-responsibilities";

interface Territory {
  id: string;
  name: string;
  region?: string;
  zone?: string;
}

interface UserRecord {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  lockedAt?: string | null;
  deviceUuid?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    managerId?: string | null;
    manager?: { id: string; firstName: string; lastName: string; user?: { role: Role } } | null;
    territories?: Territory[];
  } | null;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"directory" | "roles_catalog">("directory");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<RoleDefinition | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  // Form states for create / edit
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: Role.MR as Role,
    managerId: "" as string,
    selectedTerritoryIds: [] as string[],
    isActive: true,
    resetDeviceUuid: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    apiClient
      .get(`/api/users?${params}`)
      .then((res) => setUsers(res.data.data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    apiClient
      .get("/api/territories")
      .then((res) => setTerritories(res.data.data.territories ?? []))
      .catch(() => {});
  }, []);

  const toggleActive = async (user: UserRecord) => {
    try {
      await apiClient.put(`/api/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to update status");
    }
  };

  const resetDeviceBinding = async (user: UserRecord) => {
    if (!confirm(`Reset device binding for ${user.employee?.firstName || user.email}?\n\nThis will allow them to log in from a new device.`)) return;
    try {
      await apiClient.put(`/api/users/${user.id}`, { resetDeviceUuid: true });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to reset device binding");
    }
  };

  const openCreateModal = () => {
    setFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: Role.MR,
      managerId: "",
      selectedTerritoryIds: [],
      isActive: true,
      resetDeviceUuid: false,
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (user: UserRecord) => {
    setEditUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.employee?.firstName || "",
      lastName: user.employee?.lastName || "",
      phone: user.employee?.phone || "",
      role: user.role,
      managerId: user.employee?.managerId || "",
      selectedTerritoryIds: user.employee?.territories?.map((t) => t.id) || [],
      isActive: user.isActive,
      resetDeviceUuid: false,
    });
    setFormError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (editUser) {
        // Update user
        const payload: any = {
          role: formData.role,
          isActive: formData.isActive,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          managerId: formData.managerId || null,
          territoryIds: formData.selectedTerritoryIds,
          resetDeviceUuid: formData.resetDeviceUuid,
        };
        if (formData.password.trim()) payload.password = formData.password.trim();

        await apiClient.put(`/api/users/${editUser.id}`, payload);
        setEditUser(null);
      } else {
        // Create user
        if (!formData.password.trim() || formData.password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        await apiClient.post("/api/users", {
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim(),
          managerId: formData.managerId || undefined,
          territoryIds: formData.selectedTerritoryIds,
        });
        setShowCreateModal(false);
      }
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  // Potential managers for the currently chosen role in modal
  const eligibleManagers = useMemo(() => {
    const validRoles = getEligibleManagerRoles(formData.role);
    if (validRoles.length === 0) return [];
    return users.filter(
      (u) =>
        validRoles.includes(u.role) &&
        u.employee &&
        (!editUser || u.id !== editUser.id)
    );
  }, [formData.role, users, editUser]);

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl text-gray-900">User Management & Organization</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800">
              {users.length} Users
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Assign functional roles, duties, reporting lines, and territories across the enterprise.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab(activeTab === "directory" ? "roles_catalog" : "directory")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Briefcase size={16} className="text-primary-600" />
            {activeTab === "directory" ? "Roles & Duties Catalog" : "Back to Directory"}
          </button>

          {myRole === Role.ADMIN && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-primary-200"
            >
              <UserPlus size={16} />
              Add New User
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Overview Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Active Accounts</p>
            <p className="text-lg font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Deactivated</p>
            <p className="text-lg font-bold text-gray-900">{inactiveCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">Field Force (MR/ASM)</p>
            <p className="text-lg font-bold text-gray-900">
              {users.filter((u) => u.role === Role.MR || u.role === Role.ASM).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400">System Roles</p>
            <p className="text-lg font-bold text-gray-900">{Object.keys(ROLES_RESPONSIBILITIES_CATALOG).length}</p>
          </div>
        </div>
      </div>

      {activeTab === "roles_catalog" ? (
        /* ── Tab: Roles & Responsibilities Catalog ── */
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-200">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Master Roles & Responsibilities Matrix</h2>
                <p className="text-xs text-primary-200 mt-0.5">
                  Standard job definitions, KPIs, approval authority, and reporting tiers across Trend MR Pharma OS.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(ROLES_RESPONSIBILITIES_CATALOG).map((def) => (
              <div
                key={def.code}
                className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${def.badgeBg} ${def.badgeColor}`}>
                        {def.code}
                      </span>
                      <h3 className="font-bold text-gray-900 text-base mt-2">{def.title}</h3>
                      <p className="text-xs font-medium text-gray-400">{def.department}</p>
                    </div>
                    <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Tier {def.level}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed mb-4">{def.mandate}</p>

                  <div className="space-y-2 mb-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Key Duties</p>
                    <ul className="space-y-1.5">
                      {def.primaryResponsibilities.slice(0, 3).map((resp, i) => (
                        <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                          <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Target KPIs</p>
                    <div className="flex flex-wrap gap-1.5">
                      {def.keyKPIs.map((kpi, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] text-gray-700 font-medium">
                          {kpi}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="font-medium">Reports To: {def.reportingLine}</span>
                  <button
                    onClick={() => {
                      setRoleFilter(def.code);
                      setActiveTab("directory");
                    }}
                    className="text-primary-600 hover:text-primary-800 font-semibold"
                  >
                    View Reps →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Tab: User Directory & Management ── */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setRoleFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  roleFilter === "ALL"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                All ({users.length})
              </button>
              {Object.keys(ROLES_RESPONSIBILITIES_CATALOG).map((roleKey) => {
                const count = users.filter((u) => u.role === roleKey).length;
                if (count === 0 && roleFilter !== roleKey) return null;
                return (
                  <button
                    key={roleKey}
                    onClick={() => setRoleFilter(roleKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      roleFilter === roleKey
                        ? "bg-primary-600 text-white"
                        : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {roleKey} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Employee / User</th>
                    <th className="py-3.5 px-4">Role & Duties</th>
                    <th className="py-3.5 px-4">Reporting Manager</th>
                    <th className="py-3.5 px-4">Territory</th>
                    <th className="py-3.5 px-4">Status & Device</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        Loading users directory...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        No users found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const def = ROLES_RESPONSIBILITIES_CATALOG[u.role] || {
                        title: u.role,
                        badgeColor: "text-gray-700",
                        badgeBg: "bg-gray-100",
                        department: "General",
                      };
                      return (
                        <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Name & Email */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {u.employee
                                  ? `${u.employee.firstName[0]}${u.employee.lastName[0] || ""}`
                                  : u.email[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">
                                  {u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email.split("@")[0]}
                                </p>
                                <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                                  <Mail size={12} />
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <div>
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${def.badgeBg} ${def.badgeColor}`}>
                                {def.title}
                              </span>
                              <p className="text-[11px] text-gray-400 mt-0.5">{def.department}</p>
                            </div>
                          </td>

                          {/* Reporting Manager */}
                          <td className="py-3.5 px-4">
                            {u.employee?.manager ? (
                              <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                                <span>
                                  {u.employee.manager.firstName} {u.employee.manager.lastName}
                                </span>
                                {u.employee.manager.user?.role && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                                    {u.employee.manager.user.role}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">—</span>
                            )}
                          </td>

                          {/* Territories */}
                          <td className="py-3.5 px-4">
                            {u.employee?.territories && u.employee.territories.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.employee.territories.map((t) => (
                                  <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[11px] font-medium border border-sky-100">
                                    <MapPin size={10} />
                                    {t.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Unassigned</span>
                            )}
                          </td>

                          {/* Status & Device */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  u.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {u.isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                {u.isActive ? "Active" : "Inactive"}
                              </span>

                              {u.deviceUuid && (
                                <p className="text-[10px] text-gray-400 flex items-center gap-1" title={u.deviceUuid}>
                                  <Smartphone size={11} className="text-gray-400" />
                                  Bound Device
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {myRole === Role.ADMIN && (
                                <>
                                  <button
                                    onClick={() => openEditModal(u)}
                                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                    title="Edit Role & Assignments"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  {u.deviceUuid && (
                                    <button
                                      onClick={() => resetDeviceBinding(u)}
                                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                      title="Reset Device UUID Binding"
                                    >
                                      <RotateCcw size={15} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleActive(u)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      u.isActive
                                        ? "text-gray-500 hover:text-red-600 hover:bg-red-50"
                                        : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50"
                                    }`}
                                    title={u.isActive ? "Deactivate User" : "Activate User"}
                                  >
                                    {u.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit User Assignment Modal ── */}
      {(showCreateModal || editUser) && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-display font-bold text-lg text-gray-900">
                  {editUser ? "Edit User & Role Assignment" : "Provision New User & Role"}
                </h3>
                <p className="text-xs text-gray-500">
                  Configure access levels, job responsibilities, reporting hierarchy, and territories.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditUser(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="e.g. Rajesh"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="e.g. Kumar"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editUser}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ${
                      editUser ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder="user@mrtracker.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {editUser ? "New Password (leave empty to keep current)" : "Password (min 6 characters) *"}
                </label>
                <input
                  type="password"
                  required={!editUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  placeholder="••••••••"
                />
              </div>

              {/* Role Selection with Responsibility Preview */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Functional System Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as Role;
                    setFormData({ ...formData, role: newRole, managerId: "" });
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>
                      {r} — {ROLES_RESPONSIBILITIES_CATALOG[r]?.title || r} ({ROLES_RESPONSIBILITIES_CATALOG[r]?.department || "General"})
                    </option>
                  ))}
                </select>

                {/* Live Role Responsibility Card Preview */}
                {ROLES_RESPONSIBILITIES_CATALOG[formData.role] && (
                  <div className="mt-2.5 p-3 rounded-xl bg-primary-50/50 border border-primary-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-primary-800 font-semibold">
                      <span>{ROLES_RESPONSIBILITIES_CATALOG[formData.role].title}</span>
                      <span className="text-[10px] bg-primary-200/60 px-1.5 py-0.2 rounded font-bold">
                        Tier {ROLES_RESPONSIBILITIES_CATALOG[formData.role].level}
                      </span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      {ROLES_RESPONSIBILITIES_CATALOG[formData.role].mandate}
                    </p>
                  </div>
                )}
              </div>

              {/* Reporting Manager Assignment */}
              {eligibleManagers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reporting Manager ({ROLES_RESPONSIBILITIES_CATALOG[formData.role]?.reportingLine})
                  </label>
                  <select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="">Select Reporting Manager...</option>
                    {eligibleManagers.map((m) => (
                      <option key={m.employee!.id} value={m.employee!.id}>
                        {m.employee!.firstName} {m.employee!.lastName} ({m.role}) — {m.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Territory Assignment (for MR / ASM / RM) */}
              {(formData.role === Role.MR || formData.role === Role.ASM || formData.role === Role.RM) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Territories</label>
                  <div className="max-h-36 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                    {territories.length === 0 ? (
                      <p className="text-xs text-gray-400 p-1">No territories registered in system.</p>
                    ) : (
                      territories.map((t) => {
                        const isChecked = formData.selectedTerritoryIds.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    selectedTerritoryIds: [...formData.selectedTerritoryIds, t.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    selectedTerritoryIds: formData.selectedTerritoryIds.filter((id) => id !== t.id),
                                  });
                                }
                              }}
                              className="rounded text-primary-600 focus:ring-primary-500"
                            />
                            <span className="font-medium text-gray-800">{t.name}</span>
                            {t.region && <span className="text-[10px] text-gray-400">({t.region})</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Device Reset & Status */}
              {editUser && (
                <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    Account is Active
                  </label>

                  {editUser.deviceUuid && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-amber-700 cursor-pointer bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                      <input
                        type="checkbox"
                        checked={formData.resetDeviceUuid}
                        onChange={(e) => setFormData({ ...formData, resetDeviceUuid: e.target.checked })}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <RotateCcw size={12} />
                      Unbind Hardware Device UUID
                    </label>
                  )}
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editUser ? "Save User Changes" : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
