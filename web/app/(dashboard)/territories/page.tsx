"use client";

import React, { useEffect, useState } from "react";
import {
  Map as MapIcon,
  Users,
  Building2,
  MapPin,
  ChevronRight,
  MoreVertical,
  Plus,
  X,
  UserCheck,
  Edit2,
  Trash2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  user: { role: string };
}

interface Territory {
  id: string;
  name: string;
  region: string;
  zone: string;
  employeeId: string | null;
  employee?: any;
}

interface Node {
  id: string;
  name: string;
  type: "ZONE" | "REGION" | "TERRITORY";
  manager?: string;
  children?: Node[];
}

export default function TerritoriesDashboard() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNewNodeModal, setShowNewNodeModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTerritory, setActiveTerritory] = useState<Territory | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        setRole(JSON.parse(atob(token.split(".")[1])).role);
      } catch (e) {
        console.error("Failed to decode token");
      }
    }
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    apiClient
      .get("/api/manager/territories")
      .then((res) => {
        setTerritories(res.data.data.territories || []);
        setEmployees(res.data.data.employees || []);
      })
      .catch((err) => console.error("Failed to load territories:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNode = async () => {
    setError(null);
    if (!newName) return setError("Territory name is required");
    if (!newRegion) return setError("Region name is required");
    if (!newZone) return setError("Zone name is required");

    setSubmitting(true);
    try {
      await apiClient.post("/api/manager/territories", {
        name: newName,
        region: newRegion,
        zone: newZone,
        employeeId: newEmployeeId || null,
      });
      setShowNewNodeModal(false);
      setNewName("");
      setNewRegion("");
      setNewZone("");
      setNewEmployeeId("");
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to create territory");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignMR = async () => {
    if (!activeTerritory) return;
    setSubmitting(true);
    try {
      await apiClient.put("/api/manager/territories", {
        territoryId: activeTerritory.id,
        employeeId: assignEmployeeId || null,
      });
      setShowAssignModal(false);
      setActiveTerritory(null);
      setAssignEmployeeId("");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to assign representative");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (t: Territory) => {
    setActiveTerritory(t);
    setEditName(t.name);
    setEditRegion(t.region);
    setEditZone(t.zone);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!activeTerritory) return;
    setEditError(null);
    if (!editName.trim()) return setEditError("Territory name is required");
    if (!editRegion.trim()) return setEditError("Region name is required");
    if (!editZone.trim()) return setEditError("Zone name is required");

    setSubmitting(true);
    try {
      await apiClient.put(`/api/manager/territories/${activeTerritory.id}`, {
        name: editName.trim(),
        region: editRegion.trim(),
        zone: editZone.trim(),
      });
      setShowEditModal(false);
      setActiveTerritory(null);
      loadData();
    } catch (err: any) {
      setEditError(err?.response?.data?.error?.message || "Failed to update territory");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: Territory) => {
    if (!confirm(`Delete territory "${t.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/manager/territories/${t.id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to delete territory");
    }
  };

  const mrEmployees = employees.filter((e) => e.user.role === "MR");

  // Count unique zones/regions
  const uniqueZones = new Set(territories.map((t) => t.zone)).size;
  const uniqueRegions = new Set(territories.map((t) => t.region)).size;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Territories Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage geographical hierarchy and assignments</p>
        </div>
        <button
          onClick={() => setShowNewNodeModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> New Node
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={MapIcon} label="Total Zones" value={uniqueZones} />
        <StatCard icon={Building2} label="Total Regions" value={uniqueRegions} />
        <StatCard icon={MapPin} label="Active Territories" value={territories.length} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Hierarchy Explorer</h2>
        <div className="space-y-3">
          {territories.length === 0 ? (
            <p className="text-slate-400 text-center py-10 text-sm">No territories configured in the database.</p>
          ) : (
            territories.map((t) => {
              let mgrLabel = "Vacant";
              if (t.employee) {
                mgrLabel = `${t.employee.firstName} ${t.employee.lastName} (MR)`;
                if (t.employee.manager) {
                  mgrLabel += ` | ASM: ${t.employee.manager.firstName} ${t.employee.manager.lastName}`;
                }
              }
              return (
                <div key={t.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50/50 p-4 flex items-center justify-between hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <MapPin size={18} className="text-blue-500" />
                      <div>
                        <span className="font-semibold text-slate-900 text-sm">{t.name}</span>
                        <p className="text-xs text-slate-500 mt-0.5">Zone: {t.zone} | Region: {t.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className={`text-xs font-semibold ${mgrLabel.includes("Vacant") ? "text-red-500" : "text-slate-600"}`}>
                        {mgrLabel}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setActiveTerritory(t);
                            setAssignEmployeeId(t.employeeId || "");
                            setShowAssignModal(true);
                          }}
                          title="Assign Representative"
                          className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <UserCheck size={16} />
                        </button>
                        {role === "ADMIN" && (
                          <>
                            <button
                              onClick={() => openEdit(t)}
                              title="Edit Territory"
                              className="text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              title="Delete Territory"
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: New Territory Node */}
      {showNewNodeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">Add New Territory</h2>
              <button onClick={() => setShowNewNodeModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Territory Name *</label>
              <input
                type="text"
                placeholder="e.g. South Delhi Central"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Region *</label>
              <input
                type="text"
                placeholder="e.g. South Region"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Zone *</label>
              <input
                type="text"
                placeholder="e.g. Delhi Zone"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Assign Representative (Optional)</label>
              <select
                value={newEmployeeId}
                onChange={(e) => setNewEmployeeId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Vacant (Unassigned)</option>
                {mrEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

            <button
              onClick={handleCreateNode}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? "Saving..." : "Create Node"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Edit Territory */}
      {showEditModal && activeTerritory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">Edit Territory</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Territory Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Region *</label>
              <input
                type="text"
                value={editRegion}
                onChange={(e) => setEditRegion(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Zone *</label>
              <input
                type="text"
                value={editZone}
                onChange={(e) => setEditZone(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {editError && <p className="text-xs text-red-600 font-semibold">{editError}</p>}

            <button
              onClick={handleEditSave}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Assign MR */}
      {showAssignModal && activeTerritory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">Assign Representative</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Assign a Medical Representative to manage <strong className="text-slate-800">{activeTerritory.name}</strong>.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose Representative</label>
              <select
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Vacant (Unassigned)</option>
                {mrEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAssignMR}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
        <Icon size={24} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
