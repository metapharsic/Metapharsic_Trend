"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Modal, Field, inputClass, FormError } from "@/components/modal";

interface Hospital {
  id: string;
  name: string;
  address: string;
  departments: string | null;
  purchaseManager: string | null;
  medicalSuperintendent: string | null;
  bedStrength: number;
  type: string | null;
  territory: { id: string; name: string };
  _count: { tenders: number; formularyEntries: number };
}

interface Tender {
  id: string;
  tenderNo: string;
  status: string;
  contractRate: string;
  quantity: number;
  validTo: string;
  hospital: { id: string; name: string };
  product: { id: string; name: string; sku: string };
}

interface FormularyEntry {
  id: string;
  included: boolean;
  notes: string | null;
  hospital: { id: string; name: string };
  product: { id: string; name: string; sku: string; therapySegment: string | null };
}

const TENDER_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-50 text-gray-600",
  SUBMITTED: "bg-amber-50 text-amber-600",
  WON: "bg-primary-50 text-primary-700",
  LOST: "bg-red-50 text-red-600",
  EXPIRED: "bg-gray-100 text-gray-500",
};

function currency(value: string | number): string {
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

interface Product {
  id: string;
  name: string;
  sku: string;
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [formulary, setFormulary] = useState<FormularyEntry[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [hospitalModal, setHospitalModal] = useState(false);
  const [tenderModal, setTenderModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    address: "",
    territoryId: "",
    latitude: "",
    longitude: "",
    bedStrength: "",
    type: "",
    departments: "",
    purchaseManager: "",
  });

  const [tenderForm, setTenderForm] = useState({
    hospitalId: "",
    productId: "",
    tenderNo: "",
    contractRate: "",
    quantity: "",
    validFrom: "",
    validTo: "",
  });

  const fetchAll = async () => {
    try {
      const [h, t, f] = await Promise.all([
        apiClient.get("/api/hospitals"),
        apiClient.get("/api/hospitals/tenders"),
        apiClient.get("/api/hospitals/formulary"),
      ]);
      setHospitals(h.data.data.hospitals || []);
      setTenders(t.data.data.tenders || []);
      setFormulary(f.data.data.entries || []);
    } catch (err) {
      console.error("Failed to fetch institutional data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    apiClient
      .get("/api/manager/territories")
      .then((res) => setTerritories(res.data.data.territories || []))
      .catch(() => {});
    apiClient
      .get("/api/products?limit=200")
      .then((res) => setProducts(res.data.data.products || []))
      .catch(() => {});
  }, []);

  const submitHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/hospitals", {
        name: hospitalForm.name,
        address: hospitalForm.address,
        territoryId: hospitalForm.territoryId,
        latitude: hospitalForm.latitude ? Number(hospitalForm.latitude) : 0,
        longitude: hospitalForm.longitude ? Number(hospitalForm.longitude) : 0,
        bedStrength: hospitalForm.bedStrength ? Number(hospitalForm.bedStrength) : 0,
        type: hospitalForm.type || undefined,
        departments: hospitalForm.departments || undefined,
        purchaseManager: hospitalForm.purchaseManager || undefined,
      });
      setHospitalModal(false);
      await fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create hospital");
    } finally {
      setSaving(false);
    }
  };

  const submitTender = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/api/hospitals/tenders", {
        hospitalId: tenderForm.hospitalId,
        productId: tenderForm.productId,
        tenderNo: tenderForm.tenderNo,
        contractRate: Number(tenderForm.contractRate),
        quantity: tenderForm.quantity ? Number(tenderForm.quantity) : 0,
        validFrom: tenderForm.validFrom,
        validTo: tenderForm.validTo,
      });
      setTenderModal(false);
      await fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create tender");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Institutional Sales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hospital accounts, rate-contract tenders, and formulary inclusion status.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              setHospitalForm({
                name: "",
                address: "",
                territoryId: territories[0]?.id ?? "",
                latitude: "",
                longitude: "",
                bedStrength: "",
                type: "",
                departments: "",
                purchaseManager: "",
              });
              setError(null);
              setHospitalModal(true);
            }}
            disabled={territories.length === 0}
            className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={16} />
            Hospital
          </button>
          <button
            onClick={() => {
              setTenderForm({
                hospitalId: hospitals[0]?.id ?? "",
                productId: products[0]?.id ?? "",
                tenderNo: "",
                contractRate: "",
                quantity: "",
                validFrom: "",
                validTo: "",
              });
              setError(null);
              setTenderModal(true);
            }}
            disabled={hospitals.length === 0 || products.length === 0}
            className="bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={16} />
            Tender
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Hospitals</h2>
        {hospitals.length === 0 ? (
          <EmptyCard message="No hospitals on record." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hospitals.map((h) => (
              <div key={h.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{h.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{h.address}</p>
                  </div>
                  {h.type && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 shrink-0">
                      {h.type}
                    </span>
                  )}
                </div>

                <dl className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-y-2 text-xs">
                  <Detail label="Territory" value={h.territory.name} />
                  <Detail label="Beds" value={String(h.bedStrength)} />
                  <Detail label="Purchase Manager" value={h.purchaseManager} />
                  <Detail label="Med. Superintendent" value={h.medicalSuperintendent} />
                  <Detail label="Departments" value={h.departments} />
                  <Detail
                    label="Tenders / Formulary"
                    value={`${h._count.tenders} / ${h._count.formularyEntries}`}
                  />
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Rate Contract Tenders</h2>
        {tenders.length === 0 ? (
          <EmptyCard message="No tenders recorded." />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Tender No</th>
                  <th className="px-6 py-3">Hospital</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Rate</th>
                  <th className="px-6 py-3">Qty</th>
                  <th className="px-6 py-3">Contract Value</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-6 py-4 font-medium text-gray-800">{t.tenderNo}</td>
                    <td className="px-6 py-4 text-gray-600">{t.hospital.name}</td>
                    <td className="px-6 py-4 text-gray-600">{t.product.name}</td>
                    <td className="px-6 py-4 text-gray-600">{currency(t.contractRate)}</td>
                    <td className="px-6 py-4 text-gray-600">{t.quantity}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {currency(Number(t.contractRate) * t.quantity)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TENDER_STATUS_STYLES[t.status] ?? "bg-gray-50 text-gray-600"}`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Formulary Status</h2>
        {formulary.length === 0 ? (
          <EmptyCard message="No formulary entries logged." />
        ) : (
          <div className="space-y-2">
            {formulary.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex justify-between items-center gap-4"
              >
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {f.product.name} · {f.hospital.name}
                  </p>
                  {f.notes && <p className="text-xs text-gray-500 mt-0.5">{f.notes}</p>}
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    f.included ? "bg-primary-50 text-primary-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {f.included ? "Included" : "Not included"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={hospitalModal} title="Add Hospital" onClose={() => setHospitalModal(false)}>
        <form onSubmit={submitHospital} className="space-y-4">
          <FormError message={error} />
          <Field label="Name">
            <input
              required
              className={inputClass}
              value={hospitalForm.name}
              onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <input
              required
              className={inputClass}
              value={hospitalForm.address}
              onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
            />
          </Field>
          <Field label="Territory">
            <select
              required
              className={inputClass}
              value={hospitalForm.territoryId}
              onChange={(e) => setHospitalForm({ ...hospitalForm, territoryId: e.target.value })}
            >
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                className={inputClass}
                value={hospitalForm.latitude}
                onChange={(e) => setHospitalForm({ ...hospitalForm, latitude: e.target.value })}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                className={inputClass}
                value={hospitalForm.longitude}
                onChange={(e) => setHospitalForm({ ...hospitalForm, longitude: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bed strength">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={hospitalForm.bedStrength}
                onChange={(e) => setHospitalForm({ ...hospitalForm, bedStrength: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <input
                className={inputClass}
                placeholder="PRIVATE"
                value={hospitalForm.type}
                onChange={(e) => setHospitalForm({ ...hospitalForm, type: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Departments">
            <input
              className={inputClass}
              placeholder="Cardiology, Oncology"
              value={hospitalForm.departments}
              onChange={(e) => setHospitalForm({ ...hospitalForm, departments: e.target.value })}
            />
          </Field>
          <Field label="Purchase manager">
            <input
              className={inputClass}
              value={hospitalForm.purchaseManager}
              onChange={(e) =>
                setHospitalForm({ ...hospitalForm, purchaseManager: e.target.value })
              }
            />
          </Field>
          <ModalActions saving={saving} onCancel={() => setHospitalModal(false)} />
        </form>
      </Modal>

      <Modal open={tenderModal} title="Add Tender" onClose={() => setTenderModal(false)}>
        <form onSubmit={submitTender} className="space-y-4">
          <FormError message={error} />
          <Field label="Hospital">
            <select
              required
              className={inputClass}
              value={tenderForm.hospitalId}
              onChange={(e) => setTenderForm({ ...tenderForm, hospitalId: e.target.value })}
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product">
            <select
              required
              className={inputClass}
              value={tenderForm.productId}
              onChange={(e) => setTenderForm({ ...tenderForm, productId: e.target.value })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tender number">
            <input
              required
              className={inputClass}
              value={tenderForm.tenderNo}
              onChange={(e) => setTenderForm({ ...tenderForm, tenderNo: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contract rate">
              <input
                type="number"
                step="any"
                required
                className={inputClass}
                value={tenderForm.contractRate}
                onChange={(e) => setTenderForm({ ...tenderForm, contractRate: e.target.value })}
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={tenderForm.quantity}
                onChange={(e) => setTenderForm({ ...tenderForm, quantity: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valid from">
              <input
                type="date"
                required
                className={inputClass}
                value={tenderForm.validFrom}
                onChange={(e) => setTenderForm({ ...tenderForm, validFrom: e.target.value })}
              />
            </Field>
            <Field label="Valid to">
              <input
                type="date"
                required
                className={inputClass}
                value={tenderForm.validTo}
                onChange={(e) => setTenderForm({ ...tenderForm, validTo: e.target.value })}
              />
            </Field>
          </div>
          <ModalActions saving={saving} onCancel={() => setTenderModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
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
        onClick={onCancel}
        className="bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-gray-400 uppercase tracking-wider">{label}</dt>
      <dd className="text-gray-700 mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
