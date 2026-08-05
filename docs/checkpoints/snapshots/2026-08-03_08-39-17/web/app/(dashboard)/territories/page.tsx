"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  user: {
    role: string;
  };
}

interface Doctor {
  id: string;
  fullName: string;
}

interface Chemist {
  id: string;
  name: string;
}

interface Territory {
  id: string;
  name: string;
  region: string;
  zone: string;
  employeeId: string | null;
  employee: Employee | null;
  doctors: Doctor[];
  chemists: Chemist[];
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/api/manager/territories");
      setTerritories(res.data.data.territories || []);
      setEmployees(res.data.data.employees || []);
    } catch (err) {
      console.error("Failed to fetch territories data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (territoryId: string, employeeId: string | null) => {
    setUpdatingId(territoryId);
    try {
      await apiClient.put("/api/manager/territories", { territoryId, employeeId });
      await fetchData();
    } catch (err) {
      alert("Failed to assign employee. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTerritories = territories.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group territories by Zone -> Region
  const zones: Record<string, Record<string, Territory[]>> = {};
  filteredTerritories.forEach(t => {
    if (!zones[t.zone]) zones[t.zone] = {};
    if (!zones[t.zone][t.region]) zones[t.zone][t.region] = [];
    zones[t.zone][t.region].push(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Territory Tree & Assignment</h1>
          <p className="text-sm text-gray-500 mt-1">Manage corporate hierarchy and territory ownership grids.</p>
        </div>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search territories, regions, zones..."
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Territory Tree Structure */}
          <div className="lg:col-span-2 space-y-6">
            {Object.keys(zones).map(zoneName => (
              <div key={zoneName} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-primary-50 text-primary-600 font-semibold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Zone
                  </span>
                  <h2 className="text-lg font-bold text-gray-800">{zoneName}</h2>
                </div>

                <div className="pl-4 border-l border-gray-100 space-y-6">
                  {Object.keys(zones[zoneName]).map(regionName => (
                    <div key={regionName} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-50 text-purple-600 font-semibold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Region
                        </span>
                        <h3 className="font-semibold text-gray-700">{regionName}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                        {zones[zoneName][regionName].map(t => (
                          <div
                            key={t.id}
                            className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-gray-800">{t.name}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {t.doctors.length} Doctors • {t.chemists.length} Chemists
                                </p>
                              </div>
                              {updatingId === t.id && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200/60">
                              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                Assigned Employee
                              </label>
                              <select
                                className="w-full bg-white border border-gray-200 rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700"
                                value={t.employeeId || ""}
                                onChange={(e) => handleAssign(t.id, e.target.value || null)}
                                disabled={updatingId !== null}
                              >
                                <option value="">Unassigned</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.firstName} {emp.lastName} ({emp.user.role})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filteredTerritories.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No territories match the search term.</p>
              </div>
            )}
          </div>

          {/* Hierarchy Statistics & Quick Reference */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">Organizational Tree Overview</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center font-bold text-orange-600">
                    NSM
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">National Sales Manager</p>
                    <p className="text-xs text-gray-400">Head of National Operations</p>
                  </div>
                </div>
                <div className="pl-4 border-l-2 border-dashed border-gray-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center font-bold text-primary-600">
                      ZSM
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Zonal Sales Manager</p>
                      <p className="text-xs text-gray-400">Manages Zonal regions</p>
                    </div>
                  </div>
                  <div className="pl-4 border-l-2 border-dashed border-gray-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center font-bold text-purple-600">
                        RM
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Regional Manager</p>
                        <p className="text-xs text-gray-400">Controls specific sales states</p>
                      </div>
                    </div>
                    <div className="pl-4 border-l-2 border-dashed border-gray-100 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center font-bold text-emerald-600">
                          ASM
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Area Sales Manager</p>
                          <p className="text-xs text-gray-400">Manages local area target tracks</p>
                        </div>
                      </div>
                      <div className="pl-4 border-l-2 border-dashed border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center font-bold text-gray-600">
                            MR
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">Medical Representative</p>
                            <p className="text-xs text-gray-400">On-field customer check-ins</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
