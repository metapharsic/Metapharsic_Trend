"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  Users,
  Calendar,
  Edit3,
  Save,
  X,
  CheckCircle2,
  Lock,
  ChevronRight,
  Building2,
  Star,
  Award,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

const ROLE_META: Record<string, { label: string; color: string; bg: string; description: string; permissions: string[] }> = {
  MD: {
    label: "Managing Director", color: "text-violet-700", bg: "bg-violet-100",
    description: "Top-level executive with full system visibility across all zones, regions, and performance metrics.",
    permissions: ["All Dashboards", "All Reports", "User Management", "Financial Controls", "System Config"],
  },
  NSM: {
    label: "National Sales Manager", color: "text-indigo-700", bg: "bg-indigo-100",
    description: "Oversees all Zonal Sales Managers and has access to nationwide sales data and KPIs.",
    permissions: ["National Dashboard", "All Zone Reports", "Team Performance", "Target Management", "BI Reports"],
  },
  ZSM: {
    label: "Zonal Sales Manager", color: "text-blue-700", bg: "bg-blue-100",
    description: "Manages multiple Regional Managers across a zone. Responsible for zone-level sales targets.",
    permissions: ["Zone Dashboard", "Regional Reports", "Tour Plan Approval", "Expense Review", "Doctor Potential"],
  },
  RM: {
    label: "Regional Manager", color: "text-cyan-700", bg: "bg-cyan-100",
    description: "Manages multiple ASMs across a region. Reviews DCRs and approves tour plans.",
    permissions: ["Regional Dashboard", "Area Reports", "Tour Plan Approval", "Expense Approval", "MR Performance"],
  },
  ASM: {
    label: "Area Sales Manager", color: "text-teal-700", bg: "bg-teal-100",
    description: "Directly manages Medical Representatives. Monitors daily field activities and approvals.",
    permissions: ["ASM Dashboard", "MR Monitoring", "DCR Review", "Tour Plan Approval", "Expense Approval"],
  },
  MR: {
    label: "Medical Representative", color: "text-emerald-700", bg: "bg-emerald-100",
    description: "Field sales executive. Responsible for doctor/chemist visits, DCR submission, and order booking.",
    permissions: ["My Dashboard", "Tour Plan Submission", "DCR Filing", "Expense Claims", "Order Booking"],
  },
  HR: {
    label: "Human Resources", color: "text-rose-700", bg: "bg-rose-100",
    description: "Manages employee lifecycle — leaves, payroll, onboarding, and performance records.",
    permissions: ["HRMS Dashboard", "Leave Management", "Payroll", "Employee Records", "Training Management"],
  },
  FINANCE: {
    label: "Finance Officer", color: "text-amber-700", bg: "bg-amber-100",
    description: "Responsible for expense approvals, collections oversight, and financial reporting.",
    permissions: ["Finance Dashboard", "Expense Approval", "Collections", "Outstanding Reports", "BI Reports"],
  },
  WAREHOUSE: {
    label: "Warehouse Manager", color: "text-orange-700", bg: "bg-orange-100",
    description: "Oversees inventory, dispatch, and stock movements across all warehouses.",
    permissions: ["Warehouse Dashboard", "Inventory Management", "Dispatch Orders", "Stock Reports"],
  },
  MARKETING: {
    label: "Marketing Lead", color: "text-pink-700", bg: "bg-pink-100",
    description: "Manages product campaigns, visual aids, e-detailing content, and brand strategy.",
    permissions: ["Marketing Dashboard", "Campaign Management", "Visual Aids", "Product Analytics"],
  },
  ADMIN: {
    label: "System Administrator", color: "text-red-700", bg: "bg-red-100",
    description: "Full system administration. Manages all users, roles, permissions, and system configuration.",
    permissions: ["All Modules", "User Management", "Role Assignment", "System Config", "Audit Logs", "Security Controls"],
  },
  DISTRIBUTOR: {
    label: "Distributor", color: "text-slate-700", bg: "bg-slate-100",
    description: "External distribution partner. Access to own orders, invoices, and claims.",
    permissions: ["Distributor Portal", "Order History", "Invoice Management", "Claims Submission"],
  },
  DOCTOR: {
    label: "Doctor", color: "text-green-700", bg: "bg-green-100",
    description: "External medical professional. Access to their personal prescription and visit history.",
    permissions: ["Doctor Portal", "Visit History", "Prescription Analytics"],
  },
};

interface UserProfile {
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
    manager?: { firstName: string; lastName: string; user?: { role: string } } | null;
    subordinates?: { id: string; firstName: string; lastName: string; user?: { role: string } }[];
    territories?: { id: string; name: string; region: string; zone: string }[];
  } | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    // Get the current user's ID from the JWT and fetch their profile
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub;
      apiClient.get(`/api/users/${userId}`)
        .then((res) => {
          const u = res.data.data.user;
          setProfile(u);
          setForm({
            firstName: u.employee?.firstName ?? "",
            lastName: u.employee?.lastName ?? "",
            phone: u.employee?.phone ?? "",
            password: "",
          });
        })
        .catch(() => setProfile(null))
        .finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/users/${profile.id}`, form);
      setSavedOk(true);
      setEditing(false);
      setTimeout(() => setSavedOk(false), 3000);
      // Refresh
      const res = await apiClient.get(`/api/users/${profile.id}`);
      setProfile(res.data.data.user);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <Lock size={32} className="mx-auto text-slate-400 mb-4" />
        <p className="text-slate-500 font-medium">Please log in to view your profile.</p>
      </div>
    );
  }

  const meta = ROLE_META[profile.role] ?? { label: profile.role, color: "text-slate-700", bg: "bg-slate-100", description: "", permissions: [] };
  const name = profile.employee ? `${profile.employee.firstName} ${profile.employee.lastName}` : profile.email;
  const initials = name !== profile.email ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : profile.email[0].toUpperCase();

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {savedOk && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={18} /> Profile updated successfully!
        </div>
      )}

      {/* Profile Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-2xl ${meta.bg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
            <span className={`text-3xl font-black ${meta.color}`}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${meta.bg} ${meta.color}`}>
                {meta.label}
              </span>
              {profile.isActive && !profile.lockedAt ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 size={10} /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                  <Lock size={10} /> {profile.lockedAt ? "Locked" : "Inactive"}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-2">{meta.description}</p>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors backdrop-blur border border-white/20"
          >
            <Edit3 size={15} /> {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Contact Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><User size={16} className="text-blue-600" /> Personal Information</h2>
            </div>
            <div className="p-5 space-y-4">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">First Name</label>
                      <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Last Name</label>
                      <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">New Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoRow icon={<Mail size={14} />} label="Email" value={profile.email} />
                  <InfoRow icon={<Phone size={14} />} label="Phone" value={profile.employee?.phone ?? "—"} />
                  <InfoRow icon={<Calendar size={14} />} label="Joined" value={new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
                  <InfoRow icon={<Shield size={14} />} label="Role" value={`${meta.label} (${profile.role})`} />
                </div>
              )}
            </div>
          </div>

          {/* Manager Info */}
          {profile.employee?.manager && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><Users size={16} className="text-blue-600" /> Reports To</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-700">
                      {profile.employee.manager.firstName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{profile.employee.manager.firstName} {profile.employee.manager.lastName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.employee.manager.user?.role ? ROLE_META[profile.employee.manager.user.role]?.label : "Manager"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Role Permissions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Award size={16} className="text-blue-600" /> Role & Module Access</h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meta.permissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">{perm}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Territories */}
          {profile.employee?.territories && profile.employee.territories.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={16} className="text-blue-600" /> Assigned Territories</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {profile.employee.territories.map((t) => (
                  <div key={t.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.zone} Zone · {t.region} Region</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Members */}
          {profile.employee?.subordinates && profile.employee.subordinates.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={16} className="text-blue-600" /> My Team ({profile.employee.subordinates.length})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {profile.employee.subordinates.map((sub) => {
                  const subMeta = ROLE_META[sub.user?.role ?? "MR"];
                  return (
                    <div key={sub.id} className="px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                      <div className={`w-8 h-8 rounded-xl ${subMeta?.bg ?? "bg-slate-100"} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xs font-bold ${subMeta?.color ?? "text-slate-600"}`}>{sub.firstName[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm">{sub.firstName} {sub.lastName}</p>
                        <p className="text-xs text-slate-500">{subMeta?.label ?? sub.user?.role}</p>
                      </div>
                      <Star size={14} className="text-amber-400 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
