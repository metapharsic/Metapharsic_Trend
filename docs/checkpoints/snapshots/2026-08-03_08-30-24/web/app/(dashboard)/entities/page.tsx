"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Modal, Field, inputClass, FormError } from "@/components/modal";

type EntityType = "DOCTOR" | "CHEMIST" | "DISTRIBUTOR";

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  address: string;
  territoryId: string;
  primarySpecialty?: string;
  whatsApp?: string;
  contactPerson?: string;
  licenseNo?: string;
  gstNo?: string;
}

interface Territory {
  id: string;
  name: string;
}

const TYPES: EntityType[] = ["DOCTOR", "CHEMIST", "DISTRIBUTOR"];

const TYPE_STYLES: Record<EntityType, string> = {
  DOCTOR: "bg-primary-50 text-primary-700",
  CHEMIST: "bg-amber-50 text-amber-600",
  DISTRIBUTOR: "bg-purple-50 text-purple-600",
};

export default function EntitiesPage() {
  const [activeType, setActiveType] = useState<EntityType>("DOCTOR");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    territoryId: "",
    latitude: "",
    longitude: "",
    primarySpecialty: "",
    whatsApp: "",
    contactPerson: "",
    licenseNo: "",
    gstNo: "",
  });

  const fetchEntities = async (type: EntityType) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/manager/entities?type=${type}&limit=100`);
      setEntities(res.data.data.entities || []);
    } catch (err) {
      console.error("Failed to fetch entities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient
      .get("/api/manager/territories")
      .then((res) => setTerritories(res.data.data.territories || []))
      .catch((err) => console.error("Failed to fetch territories:", err));
  }, []);

  useEffect(() => {
    fetchEntities(activeType);
  }, [activeType]);

  const openModal = () => {
    setForm({
      name: "",
      address: "",
      territoryId: territories[0]?.id ?? "",
      latitude: "",
      longitude: "",
      primarySpecialty: "",
      whatsApp: "",
      contactPerson: "",
      licenseNo: "",
      gstNo: "",
    });
    setError(null);
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/manager/entities", {
        type: activeType,
        name: form.name,
        address: form.address,
        territoryId: form.territoryId,
        ...(form.latitude ? { latitude: Number(form.latitude) } : {}),
        ...(form.longitude ? { longitude: Number(form.longitude) } : {}),
        ...(activeType === "DOCTOR"
          ? {
              primarySpecialty: form.primarySpecialty || undefined,
              whatsApp: form.whatsApp || undefined,
            }
          : {}),
        ...(activeType === "CHEMIST"
          ? { contactPerson: form.contactPerson || undefined, licenseNo: form.licenseNo || undefined }
          : {}),
        ...(activeType === "DISTRIBUTOR"
          ? { gstNo: form.gstNo || undefined, licenseNo: form.licenseNo || undefined }
          : {}),
      });
      setModalOpen(false);
      await fetchEntities(activeType);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create entity");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entity: Entity) => {
    if (!confirm(`Delete ${entity.name}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/manager/entities/${entity.id}?type=${entity.type}`);
      await fetchEntities(activeType);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? "Failed to delete entity");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Master Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Doctors, chemists, and distributors mapped to territories.
          </p>
        </div>
        <button
          onClick={openModal}
          disabled={territories.length === 0}
          className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          Add {activeType.toLowerCase()}
        </button>
      </div>

      <div className="flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeType === t
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-primary-50 hover:text-primary-700"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}s
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : entities.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No {activeType.toLowerCase()}s on record.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Address</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{e.name}</span>
                    <span
                      className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[e.type]}`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{e.address}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {[e.primarySpecialty, e.contactPerson, e.licenseNo, e.gstNo, e.whatsApp]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => remove(e)}
                      aria-label={`Delete ${e.name}`}
                      className="text-gray-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={`Add ${activeType.charAt(0) + activeType.slice(1).toLowerCase()}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />

          <Field label="Name">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Address">
            <input
              required
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <Field label="Territory">
            <select
              required
              className={inputClass}
              value={form.territoryId}
              onChange={(e) => setForm({ ...form, territoryId: e.target.value })}
            >
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>

          {activeType !== "DISTRIBUTOR" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitude">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </Field>
            </div>
          )}

          {activeType === "DOCTOR" && (
            <>
              <Field label="Primary specialty">
                <input
                  className={inputClass}
                  placeholder="Cardiology"
                  value={form.primarySpecialty}
                  onChange={(e) => setForm({ ...form, primarySpecialty: e.target.value })}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  className={inputClass}
                  value={form.whatsApp}
                  onChange={(e) => setForm({ ...form, whatsApp: e.target.value })}
                />
              </Field>
            </>
          )}

          {activeType === "CHEMIST" && (
            <>
              <Field label="Contact person">
                <input
                  className={inputClass}
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </Field>
              <Field label="Licence no.">
                <input
                  className={inputClass}
                  value={form.licenseNo}
                  onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                />
              </Field>
            </>
          )}

          {activeType === "DISTRIBUTOR" && (
            <>
              <Field label="GST no.">
                <input
                  className={inputClass}
                  value={form.gstNo}
                  onChange={(e) => setForm({ ...form, gstNo: e.target.value })}
                />
              </Field>
              <Field label="Licence no.">
                <input
                  className={inputClass}
                  value={form.licenseNo}
                  onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                />
              </Field>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
