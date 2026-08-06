"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search, X, Camera, Plus, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Entity {
  id: string;
  name: string;
  type: "DOCTOR" | "CHEMIST";
  address: string | null;
}

interface Territory {
  id: string;
  name: string;
}

interface SampleOption {
  productId: string;
  productName: string;
  quantity: number;
}

type GpsState = {
  status: "idle" | "locating" | "ready" | "error";
  lat?: number;
  lon?: number;
  accuracy?: number;
  error?: string;
};

const PURPOSE_PRESETS = ["Product detailing", "Follow-up visit", "New product launch", "Order collection", "Relationship building"];

export default function NewCallPage() {
  return (
    <Suspense fallback={null}>
      <NewCallForm />
    </Suspense>
  );
}

function NewCallForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetDoctorId = searchParams.get("doctorId");
  const presetName = searchParams.get("name");

  const [entityType, setEntityType] = useState<"DOCTOR" | "CHEMIST">("DOCTOR");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(
    presetDoctorId ? { id: presetDoctorId, name: presetName ?? "Planned doctor", type: "DOCTOR", address: null } : null
  );

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newTerritoryId, setNewTerritoryId] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);
  const [addEntityError, setAddEntityError] = useState<string | null>(null);

  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [callStart, setCallStart] = useState<{ startedAt: string; lat: number; lon: number } | null>(null);
  const [purpose, setPurpose] = useState("");
  const [feedback, setFeedback] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [samplesAvailable, setSamplesAvailable] = useState<SampleOption[]>([]);
  const [samplesGiven, setSamplesGiven] = useState<Record<string, number>>({});
  const [boxesPlaced, setBoxesPlaced] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadGenerated, setLeadGenerated] = useState(false);
  const [leadStatus, setLeadStatus] = useState<"NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST">("NEW");
  const [leadDetails, setLeadDetails] = useState("");
  const [leadFollowUpAction, setLeadFollowUpAction] = useState("");
  const [leadFollowUpDate, setLeadFollowUpDate] = useState("");

  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(100);
  const [gpsAccuracyWarnMeters, setGpsAccuracyWarnMeters] = useState(50);
  const [requirePhoto, setRequirePhoto] = useState(false);

  useEffect(() => {
    apiClient
      .get("/api/mr/samples")
      .then((res) => setSamplesAvailable(res.data.data.samples))
      .catch((err) => console.error("Failed to load sample inventory:", err));
    apiClient
      .get("/api/mr/territories")
      .then((res) => {
        const list: Territory[] = res.data.data.territories;
        setTerritories(list);
        if (list.length === 1) setNewTerritoryId(list[0].id);
      })
      .catch((err) => console.error("Failed to load territories:", err));
    apiClient
      .get("/api/mr/workflow-settings")
      .then((res) => {
        setGeofenceRadiusMeters(res.data.data.geofenceRadiusMeters);
        setGpsAccuracyWarnMeters(res.data.data.gpsAccuracyWarnMeters);
        setRequirePhoto(res.data.data.requirePhoto);
      })
      .catch((err) => console.error("Failed to load workflow settings:", err));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      apiClient
        .get("/api/mr/entities", { params: { type: entityType, search } })
        .then((res) => {
          setResults(res.data.data.entities);
          setSearched(true);
        })
        .catch((err) => console.error("Failed to search entities:", err));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, entityType]);

  const captureGps = () => {
    setGps({ status: "locating" });
    if (!navigator.geolocation) {
      setGps({ status: "error", error: "Geolocation is not supported by your browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          status: "ready",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => setGps({ status: "error", error: err.message }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    captureGps();
  }, []);

  // Call "start" is the moment an entity is selected — auto-capture GPS + timestamp.
  useEffect(() => {
    if (!selected || callStart) return;
    if (!navigator.geolocation) {
      setCallStart({ startedAt: new Date().toISOString(), lat: NaN, lon: NaN });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCallStart({
        startedAt: new Date().toISOString(),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      }),
      () => setCallStart({ startedAt: new Date().toISOString(), lat: NaN, lon: NaN })
    );
  }, [selected, callStart]);

  const setSampleQty = (productId: string, quantity: number) => {
    setSamplesGiven((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  };

  const openAddEntity = () => {
    setNewName(search);
    setAddEntityError(null);
    setShowAddEntity(true);
  };

  const submitNewEntity = async () => {
    setAddEntityError(null);

    if (!newName.trim()) return setAddEntityError("Name is required.");
    if (!newAddress.trim()) return setAddEntityError("Address is required.");
    if (!newTerritoryId) return setAddEntityError("Select a territory.");
    if (entityType === "DOCTOR" && !newSpecialty.trim()) return setAddEntityError("Specialty is required.");
    if (gps.status !== "ready" || gps.lat === undefined || gps.lon === undefined) {
      return setAddEntityError("GPS location not captured yet — this pins the entity's location. Wait for capture or hit Recapture.");
    }

    setAddingEntity(true);
    try {
      const res = await apiClient.post("/api/manager/entities", {
        name: newName.trim(),
        type: entityType,
        address: newAddress.trim(),
        latitude: gps.lat,
        longitude: gps.lon,
        territoryId: newTerritoryId,
        ...(entityType === "DOCTOR" ? { primarySpecialty: newSpecialty.trim() } : {}),
        ...(entityType === "CHEMIST" ? { contactPerson: newContactPerson.trim() || undefined } : {}),
        ...(newMobile.trim() ? { whatsApp: newMobile.trim() } : {}),
      });
      const created = res.data.data.entity;
      setSelected({ id: created.id, name: created.name, type: entityType, address: created.address });
      setShowAddEntity(false);
      setSearch("");
      setResults([]);
      setNewName("");
      setNewSpecialty("");
      setNewContactPerson("");
      setNewAddress("");
      setNewMobile("");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to add entity.";
      setAddEntityError(message);
    } finally {
      setAddingEntity(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!selected) return setError("Select a doctor or chemist to log this call against.");
    if (!purpose.trim()) return setError("Purpose is required.");
    if (gps.status !== "ready" || gps.lat === undefined || gps.lon === undefined) {
      return setError("GPS location not captured. Allow location access and try again.");
    }
    if (requirePhoto && !photo) return setError("A visit verification photo is required.");

    const formData = new FormData();
    if (selected.type === "DOCTOR") formData.append("doctorId", selected.id);
    else formData.append("chemistId", selected.id);
    formData.append("purpose", purpose);
    if (feedback) formData.append("feedback", feedback);
    formData.append("latitude", String(gps.lat));
    formData.append("longitude", String(gps.lon));
    if (callStart) {
      formData.append("startedAt", callStart.startedAt);
      if (!Number.isNaN(callStart.lat)) formData.append("startLatitude", String(callStart.lat));
      if (!Number.isNaN(callStart.lon)) formData.append("startLongitude", String(callStart.lon));
    }
    if (durationMinutes) formData.append("durationMinutes", durationMinutes);
    if (boxesPlaced) formData.append("boxesPlaced", boxesPlaced);
    if (photo) formData.append("photo", photo);

    const samplesPayload = Object.entries(samplesGiven).map(([productId, quantity]) => ({ productId, quantity }));
    if (samplesPayload.length > 0) formData.append("samples", JSON.stringify(samplesPayload));

    if (leadGenerated) {
      formData.append(
        "lead",
        JSON.stringify({
          status: leadStatus,
          details: leadDetails || undefined,
          followUpAction: leadFollowUpAction || undefined,
          followUpDate: leadFollowUpDate || undefined,
        })
      );
    }

    setSubmitting(true);
    try {
      await apiClient.post("/api/mr/visits", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      router.push("/mr/calls");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to log call.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const gpsAccuracyPoor = gps.status === "ready" && gps.accuracy !== undefined && gps.accuracy > gpsAccuracyWarnMeters;

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Complete Call</h1>
        <p className="text-sm text-slate-500 mt-1">GPS-verified checkout — notes, samples, and precise capture.</p>
      </div>

      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
        {/* ── Entity selection ── */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Consulting *</label>
          {selected ? (
            <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 text-sm">{selected.name}</p>
                <p className="text-xs text-slate-500">{selected.type === "DOCTOR" ? "Doctor" : "Chemist"}{selected.address ? ` · ${selected.address}` : ""}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-red-500 p-2 -m-2">
                <X size={18} />
              </button>
            </div>
          ) : showAddEntity ? (
            <div className="space-y-3 border border-emerald-200 rounded-xl p-4 bg-emerald-50/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  New {entityType === "DOCTOR" ? "Doctor" : "Chemist"}
                </p>
                <button onClick={() => setShowAddEntity(false)} className="text-slate-400 hover:text-red-500 p-2 -m-2">
                  <X size={16} />
                </button>
              </div>

              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name *"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
              {entityType === "DOCTOR" ? (
                <input
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  placeholder="Primary specialty *"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                />
              ) : (
                <input
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  placeholder="Contact person"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                />
              )}
              <input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Address *"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
              <input
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="Mobile (optional)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
              <select
                value={newTerritoryId}
                onChange={(e) => setNewTerritoryId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              >
                <option value="">Select territory *</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin size={12} />
                {gps.status === "ready" ? "Location pinned from your current GPS fix." : "Waiting for GPS fix to pin location..."}
              </p>

              {addEntityError && <p className="text-sm text-red-600">{addEntityError}</p>}

              <button
                onClick={submitNewEntity}
                disabled={addingEntity}
                className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {addingEntity ? "Adding..." : `Add & Select`}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["DOCTOR", "CHEMIST"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEntityType(t)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border ${entityType === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    {t === "DOCTOR" ? "Doctor" : "Chemist"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${entityType === "DOCTOR" ? "doctors" : "chemists"}...`}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2.5 text-base sm:text-sm"
                />
              </div>
              {results.length > 0 && (
                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {results.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelected(e);
                        setResults([]);
                        setSearch("");
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <p className="font-semibold text-slate-800">{e.name}</p>
                      {e.address && <p className="text-xs text-slate-400">{e.address}</p>}
                    </button>
                  ))}
                </div>
              )}
              {searched && (
                <button
                  onClick={openAddEntity}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 border border-dashed border-emerald-300 rounded-lg py-2.5 hover:bg-emerald-50"
                >
                  <Plus size={15} /> Can't find them? Add new {entityType === "DOCTOR" ? "doctor" : "chemist"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── GPS ── */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GPS Location *</label>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${
                gps.status === "ready" && !gpsAccuracyPoor
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : gps.status === "error"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : gpsAccuracyPoor
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              <MapPin size={14} />
              {gps.status === "ready" &&
                `Captured (${gps.lat!.toFixed(5)}, ${gps.lon!.toFixed(5)})${gps.accuracy !== undefined ? ` · ±${Math.round(gps.accuracy)}m` : ""}`}
              {gps.status === "locating" && "Locating..."}
              {gps.status === "idle" && "Not captured"}
              {gps.status === "error" && (gps.error ?? "GPS error")}
            </div>
            <button onClick={captureGps} className="text-xs font-semibold text-emerald-600 hover:underline px-2 py-2 -mx-2">
              Recapture
            </button>
          </div>
          {gpsAccuracyPoor && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> GPS accuracy is low (±{Math.round(gps.accuracy!)}m). Move to open sky and recapture for a reliable fix.
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">You must be within {geofenceRadiusMeters}m of the consulted entity.</p>
          {callStart && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <MapPin size={12} /> Call started {new Date(callStart.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* ── Purpose / Notes ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Purpose *</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {PURPOSE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    purpose === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Product detailing"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Duration (minutes)</label>
            <input
              type="number"
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Feedback</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {/* ── Samples ── */}
        {samplesAvailable.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Samples Given</label>
            <div className="space-y-2 border border-slate-100 rounded-lg p-3">
              {samplesAvailable.map((s) => (
                <div key={s.productId} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.productName}</p>
                    <p className="text-xs text-slate-400">{s.quantity} in stock</p>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={s.quantity}
                    value={samplesGiven[s.productId] ?? ""}
                    onChange={(e) => setSampleQty(s.productId, Number(e.target.value))}
                    placeholder="0"
                    className="w-20 border border-slate-300 rounded-lg px-2 py-2 text-base sm:text-sm text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Box placement ── */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Boxes Placed (Qty)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={boxesPlaced}
            onChange={(e) => setBoxesPlaced(e.target.value)}
            placeholder="0"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
          />
        </div>

        {/* ── Lead capture ── */}
        <div className="border border-slate-100 rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={leadGenerated} onChange={(e) => setLeadGenerated(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Generated?</span>
          </label>
          {leadGenerated && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(["NEW", "IN_PROGRESS", "CONVERTED", "LOST"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLeadStatus(s)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      leadStatus === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
              <input
                value={leadDetails}
                onChange={(e) => setLeadDetails(e.target.value)}
                placeholder="Lead details / what they're interested in"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
              <input
                value={leadFollowUpAction}
                onChange={(e) => setLeadFollowUpAction(e.target.value)}
                placeholder="Follow-up action"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  value={leadFollowUpDate}
                  onChange={(e) => setLeadFollowUpDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Photo ── */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Camera size={13} /> Verification Photo {requirePhoto ? "*" : "(optional)"}
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm file:font-semibold"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* ── Actions: sticky on mobile ── */}
        <div className="hidden sm:flex justify-end gap-3 pt-2">
          <button onClick={() => router.push("/mr")} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Checkout & Log Call"}
          </button>
        </div>
      </div>

      {/* ── Mobile sticky action bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex gap-3 z-20">
        <button onClick={() => router.push("/mr")} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-[2] bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Checkout & Log Call"}
        </button>
      </div>
    </div>
  );
}
