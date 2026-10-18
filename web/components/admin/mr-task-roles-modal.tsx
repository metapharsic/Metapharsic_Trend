"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Check,
  RotateCcw,
  UserCheck,
  MapPin,
  Briefcase,
  Layers,
  FileCheck,
  Stethoscope,
  ShoppingBag,
  Wallet,
  UserPlus,
  Boxes,
  Building2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  MR_TASK_ROLES_CATALOG,
  ALL_MR_TASK_CODES,
  MrTaskRoleDefinition,
  parseAssignedTasks,
} from "@/lib/mr-task-roles";

interface UserRecord {
  id: string;
  email: string;
  role: string;
  assignedTasks?: string | string[] | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    assignedTasks?: string | string[] | null;
    manager?: { id: string; firstName: string; lastName: string } | null;
    territories?: { id: string; name: string }[];
  } | null;
}

interface Props {
  user: UserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ICON_MAP: Record<string, any> = {
  FileCheck,
  Stethoscope,
  ShoppingBag,
  Wallet,
  UserPlus,
  Boxes,
  AlertTriangle,
  Building2,
};

export function MrTaskRolesModal({ user, isOpen, onClose, onSuccess }: Props) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      const existing = parseAssignedTasks(user.assignedTasks || user.employee?.assignedTasks);
      setSelectedTasks(existing);
      setSaveSuccess(false);
      setError(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const toggleTask = (code: string) => {
    setSelectedTasks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const applyPreset = (preset: "ALL" | "DETAILING" | "COMMERCIAL" | "STATUTORY") => {
    switch (preset) {
      case "ALL":
        setSelectedTasks([...ALL_MR_TASK_CODES]);
        break;
      case "DETAILING":
        setSelectedTasks(["TASK_DOCTOR_DETAILING", "TASK_NEW_CLIENT_ONBOARDING", "TASK_STOCK_AUDIT_SURVEY"]);
        break;
      case "COMMERCIAL":
        setSelectedTasks(["TASK_CHEMIST_POB_ORDERS", "TASK_PAYMENT_COLLECTION", "TASK_CLAIMS_EXPIRY_HANDLING"]);
        break;
      case "STATUTORY":
        setSelectedTasks(["TASK_DL_COLLECTION", "TASK_CLAIMS_EXPIRY_HANDLING", "TASK_STOCK_AUDIT_SURVEY"]);
        break;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/api/users/${user.id}`, {
        assignedTasks: selectedTasks,
      });

      setSaveSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update MR task roles");
    } finally {
      setSaving(false);
    }
  };

  const empName = user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email.split("@")[0];
  const territories = user.employee?.territories?.map((t) => t.name).join(", ") || "Active Territory Beat";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-purple-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-200 border border-white/10">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">MR Task Roles & Operational Capabilities</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Admin Delegation Matrix
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Assign specific operational capabilities and task responsibilities to this field representative.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Rep Profile Summary Bar */}
        <div className="px-6 py-3 bg-purple-50/70 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-900 font-bold flex items-center justify-center">
              {empName[0]}
            </div>
            <div>
              <p className="font-bold text-gray-900">{empName} ({user.role})</p>
              <p className="text-gray-500 text-[11px] flex items-center gap-1.5">
                <span>{user.email}</span>
                <span>•</span>
                <MapPin size={11} className="text-purple-600" />
                <span>{territories}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                selectedTasks.length === ALL_MR_TASK_CODES.length
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : selectedTasks.length > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              <CheckCircle2 size={13} />
              {selectedTasks.length} of {ALL_MR_TASK_CODES.length} Tasks Active
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset("ALL")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors"
            >
              Full Suite (All 8 Tasks)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("STATUTORY")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Regulatory &amp; DL Specialist
            </button>
            <button
              type="button"
              onClick={() => applyPreset("DETAILING")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Core Detailing
            </button>
            <button
              type="button"
              onClick={() => applyPreset("COMMERCIAL")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Orders &amp; Collections
            </button>
          </div>

          {/* Task Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {MR_TASK_ROLES_CATALOG.map((task) => {
              const isChecked = selectedTasks.includes(task.code);
              const IconComp = ICON_MAP[task.iconName] || Layers;

              return (
                <div
                  key={task.code}
                  onClick={() => toggleTask(task.code)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isChecked
                      ? "bg-purple-50/40 border-purple-500/80 shadow-xs ring-1 ring-purple-500/20"
                      : "bg-white border-gray-200/80 hover:border-gray-300 opacity-70"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isChecked ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <IconComp size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">{task.name}</p>
                          <span className="text-[10px] text-gray-400 font-semibold">{task.category}</span>
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <div
                        className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                          isChecked ? "bg-purple-600" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isChecked ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5">{task.mandate}</p>
                  </div>

                  <div className="pt-2 border-t border-purple-100/60 flex items-center justify-between text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.criticality === "CRITICAL"
                          ? "bg-purple-100 text-purple-800"
                          : task.criticality === "HIGH"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {task.criticality}
                    </span>

                    {task.statutoryBasis ? (
                      <span className="text-[10px] text-purple-700 font-medium truncate max-w-[180px]">
                        {task.statutoryBasis}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Standard Operational Duty</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all ${
              saveSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            }`}
          >
            {saving ? (
              <>
                <RotateCcw size={14} className="animate-spin" />
                Enforcing Roles...
              </>
            ) : saveSuccess ? (
              <>
                <Check size={14} />
                Roles Saved &amp; Enforced!
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                Save &amp; Enforce Task Roles
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
