"use client";

import React, { useEffect, useState } from "react";
import { Building2, Save, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Settings {
  name: string;
  address: string;
  phone: string | null;
  panNo: string | null;
  dlNo1: string | null;
  dlNo2: string | null;
  gstin: string | null;
  bankName: string | null;
  bankBranch: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  upiId: string | null;
  terms: string | null;
}

const EMPTY: Settings = {
  name: "",
  address: "",
  phone: "",
  panNo: "",
  dlNo1: "",
  dlNo2: "",
  gstin: "",
  bankName: "",
  bankBranch: "",
  accountNo: "",
  ifscCode: "",
  upiId: "",
  terms: "",
};

export default function CompanySettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadSettings = () => {
    apiClient
      .get("/api/company-settings")
      .then((res) => {
        const s = res.data.data.settings;
        setLogoUrl(s.logoUrl ?? null);
        setForm({
          name: s.name ?? "",
          address: s.address ?? "",
          phone: s.phone ?? "",
          panNo: s.panNo ?? "",
          dlNo1: s.dlNo1 ?? "",
          dlNo2: s.dlNo2 ?? "",
          gstin: s.gstin ?? "",
          bankName: s.bankName ?? "",
          bankBranch: s.bankBranch ?? "",
          accountNo: s.accountNo ?? "",
          ifscCode: s.ifscCode ?? "",
          upiId: s.upiId ?? "",
          terms: s.terms ?? "",
        });
      })
      .catch((err) => console.error("Failed to load company settings:", err))
      .finally(() => setLoading(false));
  };

  useEffect(loadSettings, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      await apiClient.post("/api/company-settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      loadSettings();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to upload logo.";
      setError(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (!form.name.trim()) return setError("Company name is required.");
    if (!form.address.trim()) return setError("Address is required.");

    setSaving(true);
    try {
      await apiClient.put("/api/company-settings", form);
      setSaved(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to save settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
          <Building2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">Company Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seller and bank details printed on every invoice</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Logo</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 size={20} className="text-gray-300" />
              )}
            </div>
            <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-100">
              <Upload size={14} />
              {uploadingLogo ? "Uploading..." : "Upload logo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Seller</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Company Name *</label>
              <input value={form.name} onChange={set("name")} placeholder="Company Name" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address *</label>
              <textarea value={form.address} onChange={set("address")} rows={2} placeholder="Address" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone ?? ""} onChange={set("phone")} placeholder="Phone" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>GSTIN</label>
              <input value={form.gstin ?? ""} onChange={set("gstin")} placeholder="GSTIN" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PAN No.</label>
              <input value={form.panNo ?? ""} onChange={set("panNo")} placeholder="PAN No." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Drug License No. 1</label>
              <input value={form.dlNo1 ?? ""} onChange={set("dlNo1")} placeholder="Drug License No. 1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Drug License No. 2</label>
              <input value={form.dlNo2 ?? ""} onChange={set("dlNo2")} placeholder="Drug License No. 2" className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Bank Name</label>
              <input value={form.bankName ?? ""} onChange={set("bankName")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Branch</label>
              <input value={form.bankBranch ?? ""} onChange={set("bankBranch")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account No.</label>
              <input value={form.accountNo ?? ""} onChange={set("accountNo")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IFSC Code</label>
              <input value={form.ifscCode ?? ""} onChange={set("ifscCode")} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>UPI ID (for Scan &amp; Pay QR on invoice)</label>
              <input value={form.upiId ?? ""} onChange={set("upiId")} placeholder="e.g. yourname@sbipay" className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Terms & Conditions (printed on invoice)</label>
          <textarea value={form.terms ?? ""} onChange={set("terms")} rows={3} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-primary-600">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
