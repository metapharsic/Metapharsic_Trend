"use client";

import React, { useEffect, useState } from "react";
import { Settings2, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Settings {
  requirePhoto: boolean;
  enforceTourPlan: boolean;
  geofenceRadiusMeters: number;
  gpsAccuracyWarnMeters: number;
  updatedAt: string;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${checked ? "bg-primary-600" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function WorkflowSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .get("/api/manager/workflow-settings")
      .then((res) => setSettings(res.data.data.settings))
      .catch((err) => console.error("Failed to load workflow settings:", err))
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiClient.put("/api/manager/workflow-settings", patch);
      setSettings(res.data.data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error("Failed to save workflow settings:", err);
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

  if (!settings) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
        <p className="text-gray-400 text-sm">Unable to load workflow settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
          <Settings2 size={22} /> Workflow Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          One place to change business rules — every screen and API that enforces these reads the current value here, live. No code changes needed.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">Require Verification Photo</p>
            <p className="text-xs text-gray-500 mt-0.5">MR must attach a photo to check out of every call.</p>
          </div>
          <Toggle checked={settings.requirePhoto} onChange={(v) => save({ requirePhoto: v })} />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">Enforce Tour Plan</p>
            <p className="text-xs text-gray-500 mt-0.5">Doctor calls must match today's approved Tour Plan calendar.</p>
          </div>
          <Toggle checked={settings.enforceTourPlan} onChange={(v) => save({ enforceTourPlan: v })} />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">Geofence Radius</p>
            <p className="text-xs text-gray-500 mt-0.5">Max distance (metres) from the entity's pinned location to allow checkout.</p>
          </div>
          <input
            type="number"
            min={10}
            max={5000}
            value={settings.geofenceRadiusMeters}
            onChange={(e) => setSettings({ ...settings, geofenceRadiusMeters: Number(e.target.value) })}
            onBlur={(e) => save({ geofenceRadiusMeters: Number(e.target.value) })}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right"
          />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">GPS Accuracy Warning</p>
            <p className="text-xs text-gray-500 mt-0.5">Warn MR to recapture if GPS accuracy is worse than this (metres).</p>
          </div>
          <input
            type="number"
            min={5}
            max={1000}
            value={settings.gpsAccuracyWarnMeters}
            onChange={(e) => setSettings({ ...settings, gpsAccuracyWarnMeters: Number(e.target.value) })}
            onBlur={(e) => save({ gpsAccuracyWarnMeters: Number(e.target.value) })}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        {saving && <span>Saving…</span>}
        {saved && (
          <span className="flex items-center gap-1 text-primary-600 font-semibold">
            <Check size={13} /> Saved — live everywhere now
          </span>
        )}
      </div>
    </div>
  );
}
