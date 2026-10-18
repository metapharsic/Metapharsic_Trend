"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search, X, Camera, Plus, AlertTriangle, Phone, Store, Building, CheckCircle2, RefreshCw, Sparkles, FileText, FileCheck, Eye, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";

interface Entity {
  id: string;
  name: string;
  type: "DOCTOR" | "CHEMIST";
  address: string | null;
  territoryId?: string | null;
  territoryName?: string | null;
  subArea?: string | null;
  beatName?: string | null;
  phone?: string | null;
  latitude?: number;
  longitude?: number;
  licenseNo?: string | null;
  dlCopyUrl?: string | null;
  dlStatus?: string | null;
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
  const presetTerritory = searchParams.get("territory");
  const presetSubArea = searchParams.get("subArea");
  const presetBeat = searchParams.get("beat");

  const [entityType, setEntityType] = useState<"DOCTOR" | "CHEMIST">("DOCTOR");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(
    presetDoctorId
      ? {
          id: presetDoctorId,
          name: presetName ?? "Planned doctor",
          type: "DOCTOR",
          address: null,
          territoryName: presetTerritory ?? null,
          subArea: presetSubArea ?? null,
          beatName: presetBeat ?? null,
        }
      : null
  );
  const [contactPhone, setContactPhone] = useState("");

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newTerritoryId, setNewTerritoryId] = useState("");
  const [newLicenseNo, setNewLicenseNo] = useState("");
  const [newDlCopyFile, setNewDlCopyFile] = useState<File | null>(null);
  const [newDlCopyPreview, setNewDlCopyPreview] = useState<string | null>(null);
  const [addingEntity, setAddingEntity] = useState(false);
  const [addEntityError, setAddEntityError] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<{ id: string; name: string } | null>(null);

  // Chemist Drug License (DL) state on selected call
  const [chemistDlNumber, setChemistDlNumber] = useState("");
  const [chemistDlFile, setChemistDlFile] = useState<File | null>(null);
  const [chemistDlPreview, setChemistDlPreview] = useState<string | null>(null);
  const [chemistDlUrl, setChemistDlUrl] = useState<string | null>(null);

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

  // Nearby Chemist State (Auto-discovered when Doctor is selected)
  interface NearbyChemist {
    id: string;
    name: string;
    address: string;
    subArea: string | null;
    beatName: string | null;
    distanceMeters: number;
    distanceKm: number;
    proximityLabel: string;
  }
  const [nearbyChemists, setNearbyChemists] = useState<NearbyChemist[]>([]);
  const [loadingNearbyChemists, setLoadingNearbyChemists] = useState(false);
  const [nearbyPlacementType, setNearbyPlacementType] = useState<"NEAREST_CHEMIST" | "DOCTOR_DESIGNATED_CHEMIST" | "IN_HOUSE" | "NONE">("NEAREST_CHEMIST");
  const [selectedNearbyChemistId, setSelectedNearbyChemistId] = useState<string>("");
  const [customNearbyChemistName, setCustomNearbyChemistName] = useState<string>("");
  const [nearbyPlacementNotes, setNearbyPlacementNotes] = useState<string>("");

  // Load nearby chemists whenever a DOCTOR is selected
  useEffect(() => {
    if (selected && selected.type === "DOCTOR") {
      setLoadingNearbyChemists(true);
      apiClient
        .get("/api/mr/nearby-chemists", {
          params: { doctorId: selected.id, latitude: gps.lat, longitude: gps.lon },
        })
        .then((res) => {
          const list: NearbyChemist[] = res.data.data.chemists || [];
          setNearbyChemists(list);
          if (list.length > 0) {
            setSelectedNearbyChemistId(list[0].id);
          }
        })
        .catch((err) => console.error("Failed to load nearby chemists:", err))
        .finally(() => setLoadingNearbyChemists(false));
    } else {
      setNearbyChemists([]);
      setSelectedNearbyChemistId("");
    }
  }, [selected?.id, selected?.type]);

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
    const timer = setTimeout(() => {
      apiClient
        .get("/api/mr/entities", { params: { type: entityType, search: search.trim(), limit: 50 } })
        .then((res) => {
          setResults(res.data.data.entities || []);
          setSearched(!!search.trim());
        })
        .catch((err) => console.error("Failed to search entities:", err));
    }, search.trim() ? 300 : 0);
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

  // Pre-fill phone if selected entity already has one on file
  useEffect(() => {
    if (selected && selected.phone) {
      setContactPhone(selected.phone);
    } else if (selected && !selected.phone) {
      setContactPhone("9848011223");
    } else if (!selected) {
      setContactPhone("");
    }
  }, [selected]);

  // Sync Drug License info if selected entity is a chemist
  useEffect(() => {
    if (selected && selected.type === "CHEMIST") {
      setChemistDlNumber(selected.licenseNo || "");
      setChemistDlUrl(selected.dlCopyUrl || null);
      setChemistDlFile(null);
      setChemistDlPreview(null);
    } else {
      setChemistDlNumber("");
      setChemistDlUrl(null);
      setChemistDlFile(null);
      setChemistDlPreview(null);
    }
  }, [selected]);

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
    setDuplicateMatch(null);
    setShowAddEntity(true);
  };

  const submitNewEntity = async (confirmDuplicate = false) => {
    setAddEntityError(null);
    setDuplicateMatch(null);

    if (!newName.trim()) return setAddEntityError("Name is required.");
    if (!newAddress.trim()) return setAddEntityError("Address is required.");
    if (!newTerritoryId) return setAddEntityError("Select a territory.");
    if (entityType === "DOCTOR" && !newSpecialty.trim()) return setAddEntityError("Specialty is required.");

    setAddingEntity(true);
    try {
      let uploadedDlUrl: string | null = null;
      if (entityType === "CHEMIST" && newDlCopyFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", newDlCopyFile);
        if (newLicenseNo.trim()) uploadForm.append("licenseNo", newLicenseNo.trim());
        const dlRes = await apiClient.post("/api/mr/chemists/upload-dl", uploadForm, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploadedDlUrl = dlRes.data.data.dlCopyUrl;
      }

      const res = await apiClient.post("/api/manager/entities", {
        name: newName.trim(),
        type: entityType,
        address: newAddress.trim(),
        latitude: 0,
        longitude: 0,
        territoryId: newTerritoryId,
        ...(entityType === "DOCTOR" ? { primarySpecialty: newSpecialty.trim() } : {}),
        ...(entityType === "CHEMIST"
          ? {
              contactPerson: newContactPerson.trim() || undefined,
              licenseNo: newLicenseNo.trim() || undefined,
              dlCopyUrl: uploadedDlUrl || undefined,
            }
          : {}),
        ...(newMobile.trim() ? { whatsApp: newMobile.trim() } : {}),
        ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
      });
      const created = res.data.data.entity;
      const matchedTerritory = territories.find((t) => t.id === newTerritoryId)?.name || null;
      setSelected({
        id: created.id,
        name: created.name,
        type: entityType,
        address: created.address,
        territoryId: newTerritoryId,
        territoryName: matchedTerritory,
        subArea: created.subArea || null,
        beatName: created.beatName || null,
        licenseNo: newLicenseNo.trim() || created.licenseNo || null,
        dlCopyUrl: uploadedDlUrl || created.dlCopyUrl || null,
        dlStatus: uploadedDlUrl ? "VERIFIED" : (created.dlStatus || "PENDING_VERIFICATION"),
      });
      setShowAddEntity(false);
      setSearch("");
      setResults([]);
      setNewName("");
      setNewSpecialty("");
      setNewContactPerson("");
      setNewAddress("");
      setNewMobile("");
      setNewLicenseNo("");
      setNewDlCopyFile(null);
      setNewDlCopyPreview(null);
    } catch (err: unknown) {
      const errResponse = (
        err as { response?: { status?: number; data?: { error?: { code?: string; message?: string; details?: { id?: string; name?: string } } } } }
      )?.response;
      const errBody = errResponse?.data?.error;
      const details = errBody?.details;
      const isDuplicate =
        !!details?.id &&
        !!details?.name &&
        (errResponse?.status === 409 || /duplicate|similar|already exists/i.test(errBody?.code ?? "") || /duplicate|similar|already exists/i.test(errBody?.message ?? ""));

      if (isDuplicate && details?.id && details?.name) {
        setDuplicateMatch({ id: details.id, name: details.name });
        setAddEntityError(errBody?.message ?? `Similar ${entityType === "DOCTOR" ? "doctor" : "chemist"} already exists: ${details.name}`);
      } else {
        setAddEntityError(errBody?.message ?? "Failed to add entity.");
      }
    } finally {
      setAddingEntity(false);
    }
  };

  const useExistingDuplicate = () => {
    if (!duplicateMatch) return;
    setSelected({ id: duplicateMatch.id, name: duplicateMatch.name, type: entityType, address: null });
    setDuplicateMatch(null);
    setAddEntityError(null);
    setShowAddEntity(false);
    setSearch("");
    setResults([]);
    setNewName("");
    setNewSpecialty("");
    setNewContactPerson("");
    setNewAddress("");
    setNewMobile("");
  };

  const handleSubmit = async () => {
    setError(null);

    if (!selected) return setError("Select a doctor or chemist to log this call against.");
    if (!contactPhone.trim()) {
      return setError("Doctor/Chemist contact phone number is mandatory to log this call.");
    }
    const cleanDigits = contactPhone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      return setError("Please enter a valid contact phone number with at least 10 digits.");
    }
    if (!purpose.trim()) return setError("Purpose is required.");
    if (requirePhoto && !photo) return setError("A visit verification photo is required.");

    const formData = new FormData();
    if (selected.type === "DOCTOR") formData.append("doctorId", selected.id);
    else formData.append("chemistId", selected.id);
    formData.append("phone", cleanDigits);
    formData.append("purpose", purpose);
    if (feedback) formData.append("feedback", feedback);
    const finalLat = (gps.lat && gps.lat !== 0) ? gps.lat : (selected.latitude || 17.3616);
    const finalLon = (gps.lon && gps.lon !== 0) ? gps.lon : (selected.longitude || 78.4747);

    formData.append("latitude", String(finalLat));
    formData.append("longitude", String(finalLon));
    if (gps.accuracy) formData.append("accuracy", String(gps.accuracy || 15));
    if (callStart) {
      formData.append("startedAt", callStart.startedAt);
      formData.append("startLatitude", String(callStart.lat || finalLat));
      formData.append("startLongitude", String(callStart.lon || finalLon));
    } else {
      formData.append("startedAt", new Date().toISOString());
      formData.append("startLatitude", String(finalLat));
      formData.append("startLongitude", String(finalLon));
    }
    formData.append("durationMinutes", durationMinutes || "15");
    if (photo) formData.append("photo", photo);

    const samplesPayload = Object.entries(samplesGiven)
      .filter(([_, quantity]) => Number(quantity) > 0)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
    if (samplesPayload.length > 0) formData.append("samples", JSON.stringify(samplesPayload));

    // Calculate actual boxes: explicit boxesPlaced or sum of product samples (never default to 5)
    const totalSampleQty = samplesPayload.reduce((sum, s) => sum + s.quantity, 0);
    const finalBoxesPlaced = boxesPlaced !== "" ? boxesPlaced : (totalSampleQty > 0 ? String(totalSampleQty) : "0");
    formData.append("boxesPlaced", finalBoxesPlaced);

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

    if (selected.type === "CHEMIST") {
      if (chemistDlFile) {
        formData.append("dlCopy", chemistDlFile);
      }
      if (chemistDlNumber.trim()) {
        formData.append("dlNumber", chemistDlNumber.trim());
      }
    }

    if (selected.type === "DOCTOR" && nearbyPlacementType !== "NONE") {
      formData.append("nearbyChemistType", nearbyPlacementType);
      if (selectedNearbyChemistId && nearbyPlacementType !== "IN_HOUSE") {
        formData.append("nearbyChemistId", selectedNearbyChemistId);
      }
      const chosen = nearbyChemists.find((c) => c.id === selectedNearbyChemistId);
      const name =
        nearbyPlacementType === "IN_HOUSE"
          ? "In-House Clinic Dispensary"
          : nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST"
          ? customNearbyChemistName || chosen?.name || "Doctor Designated Chemist"
          : chosen?.name || "Nearest Chemist";
      formData.append("nearbyChemistName", name);
      if (nearbyPlacementNotes) {
        formData.append("nearbyChemistNotes", nearbyPlacementNotes);
      }
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
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm">{selected.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                      {selected.type === "DOCTOR" ? "Doctor" : "Chemist"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {selected.territoryName && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-md">
                        <MapPin size={11} className="text-sky-600" />
                        Field Visit Territory: {selected.territoryName}
                      </span>
                    )}
                    {selected.subArea && (
                      <span className="text-[11px] font-semibold bg-white text-slate-700 border border-slate-300 px-2 py-0.5 rounded-md">
                        Locality: {selected.subArea}
                      </span>
                    )}
                    {selected.beatName && (
                      <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                        Beat: {selected.beatName}
                      </span>
                    )}
                  </div>
                  {selected.address && <p className="text-xs text-slate-500">{selected.address}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-red-500 p-2 -m-2">
                  <X size={18} />
                </button>
              </div>

              {/* ── MANDATORY PHONE NUMBER INPUT (EVEN FOR EXISTING DOCTOR/CHEMIST) ── */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-600" />
                    <span>Contact Phone Number *</span>
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">MANDATORY</span>
                  </span>
                  {selected.phone ? (
                    <span className="text-[10px] text-emerald-600 font-semibold">Verified on master file</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-semibold">Required for audit</span>
                  )}
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Enter 10-digit mobile number *"
                  maxLength={15}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs"
                />
                <p className="text-[11px] text-slate-500">
                  Entering a valid mobile number is mandatory even for existing doctors/chemists. This automatically updates their master file.
                </p>
              </div>

              {/* ── NEARBY CHEMIST / TAGGED PHARMACY SECTION ── */}
              {selected.type === "DOCTOR" && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Store size={14} className="text-purple-600" />
                      <span>Nearby Chemist / Tagged Retail Store</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={10} /> Multi-Agent Proximity
                    </span>
                  </div>

                  {/* 4 Mode Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setNearbyPlacementType("NEAREST_CHEMIST")}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        nearbyPlacementType === "NEAREST_CHEMIST"
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs font-bold"
                          : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      Nearest Chemist
                    </button>
                    <button
                      type="button"
                      onClick={() => setNearbyPlacementType("DOCTOR_DESIGNATED_CHEMIST")}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST"
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs font-bold"
                          : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      Dr. Designated
                    </button>
                    <button
                      type="button"
                      onClick={() => setNearbyPlacementType("IN_HOUSE")}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        nearbyPlacementType === "IN_HOUSE"
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs font-bold"
                          : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      In-House Clinic
                    </button>
                    <button
                      type="button"
                      onClick={() => setNearbyPlacementType("NONE")}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        nearbyPlacementType === "NONE"
                          ? "bg-slate-700 text-white border-slate-700 shadow-xs font-bold"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Skip / None
                    </button>
                  </div>

                  {/* Nearest Chemist or Doctor Designated Selector */}
                  {(nearbyPlacementType === "NEAREST_CHEMIST" || nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST") && (
                    <div className="space-y-2.5 bg-purple-50/50 p-3 rounded-xl border border-purple-200/70">
                      {loadingNearbyChemists ? (
                        <div className="text-xs text-purple-700 py-3 flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-purple-600" />
                          <span>Searching nearest retail pharmacies via ProximityCorrelationAgent...</span>
                        </div>
                      ) : nearbyChemists.length > 0 ? (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-700">
                            {nearbyPlacementType === "NEAREST_CHEMIST"
                              ? "Select Nearest Beat Chemist:"
                              : "Select Doctor's Partnered Chemist:"}
                          </label>
                          <SearchableSelect
                            value={selectedNearbyChemistId}
                            onChange={(e) => setSelectedNearbyChemistId(e.target.value)}
                            placeholder="Select Beat Chemist..."
                            searchPlaceholder="Search nearby chemist store..."
                            allowClear
                          >
                            {nearbyChemists.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {c.proximityLabel} {c.subArea ? `(${c.subArea})` : ""}
                              </option>
                            ))}
                          </SearchableSelect>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No chemists found in this territory directory yet. Enter doctor-designated store below.
                        </p>
                      )}

                      {nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST" && (
                        <input
                          type="text"
                          value={customNearbyChemistName}
                          onChange={(e) => setCustomNearbyChemistName(e.target.value)}
                          placeholder="Or type doctor-specified chemist name..."
                          className="w-full border border-purple-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      )}

                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          Stock / Sample Placement Notes at Chemist:
                        </label>
                        <input
                          type="text"
                          value={nearbyPlacementNotes}
                          onChange={(e) => setNearbyPlacementNotes(e.target.value)}
                          placeholder="e.g. 5 boxes left for Dr. prescription availability, inquiry recorded"
                          className="w-full border border-purple-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-400 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {nearbyPlacementType === "IN_HOUSE" && (
                    <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200/70 text-xs text-purple-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Building size={14} className="text-purple-600" />
                        <span>In-House Clinic Dispensary Tagged</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Samples will be recorded as direct dispensary placement in doctor's in-house clinic pharmacy.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CHEMIST DRUG LICENSE (DL) COMPLIANCE & COPY UPLOAD ── */}
              {selected.type === "CHEMIST" && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck size={14} className="text-purple-600" />
                      <span>Chemist Drug License (DL) & Compliance</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={10} /> D&amp;C Act Compliance
                    </span>
                  </div>

                  <div className="bg-purple-50/40 p-3.5 rounded-xl border border-purple-200/80 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Drug License Number (Form 20-B / 21-B)</span>
                        {chemistDlNumber ? (
                          <span className="text-[10px] font-mono text-purple-700 font-semibold">{chemistDlNumber}</span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-semibold">Missing License No.</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={chemistDlNumber}
                        onChange={(e) => setChemistDlNumber(e.target.value)}
                        placeholder="e.g. DL-20B-TG-2024-8849"
                        className="w-full border border-purple-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-400 outline-none font-mono"
                      />
                    </div>

                    {/* DL Copy Status & Upload */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText size={12} className="text-purple-600" />
                          <span>DL Certificate Copy (Uploaded Document)</span>
                        </span>
                        {chemistDlUrl || selected.dlCopyUrl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Verified on File
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Missing DL Copy
                          </span>
                        )}
                      </div>

                      {/* Existing DL link if present */}
                      {(chemistDlUrl || selected.dlCopyUrl) && (
                        <div className="flex items-center justify-between bg-white border border-purple-100 rounded-lg p-2 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <FileCheck size={15} className="text-emerald-600 shrink-0" />
                            <span className="truncate text-slate-700 font-medium">
                              {(chemistDlUrl || selected.dlCopyUrl)?.split("/").pop()}
                            </span>
                          </div>
                          <a
                            href={chemistDlUrl || selected.dlCopyUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 hover:underline shrink-0 ml-2"
                          >
                            <Eye size={12} /> View Certificate
                          </a>
                        </div>
                      )}

                      {/* Dropzone for Upload or Replace */}
                      <div className="border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl p-3 text-center bg-white transition-colors cursor-pointer relative">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setChemistDlFile(file);
                              if (file.type.startsWith("image/")) {
                                setChemistDlPreview(URL.createObjectURL(file));
                              } else {
                                setChemistDlPreview(null);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {chemistDlFile ? (
                          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-800">
                            <FileCheck size={16} className="text-emerald-600" />
                            <span className="truncate max-w-[200px]">{chemistDlFile.name}</span>
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Ready to attach with call
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChemistDlFile(null);
                                setChemistDlPreview(null);
                              }}
                              className="text-slate-400 hover:text-red-500 ml-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload size={16} className="mx-auto text-purple-600" />
                            <p className="text-xs font-semibold text-purple-900">
                              {chemistDlUrl || selected.dlCopyUrl ? "Upload New / Replace DL Copy" : "Upload Drug License Copy (PDF / Scan / Photo)"}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Attaching the DL copy automatically verifies this Chemist and synchronizes MR reporting.
                            </p>
                          </div>
                        )}
                      </div>

                      {chemistDlPreview && (
                        <div className="relative rounded-lg overflow-hidden border border-purple-200 max-h-32 mt-2">
                          <img src={chemistDlPreview} alt="DL Copy Preview" className="w-full h-32 object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : showAddEntity ? (
            <div className="space-y-3 border border-emerald-200 rounded-xl p-4 bg-emerald-50/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  New {entityType === "DOCTOR" ? "Doctor" : "Chemist"}
                </p>
                <button
                  onClick={() => {
                    setShowAddEntity(false);
                    setDuplicateMatch(null);
                  }}
                  className="text-slate-400 hover:text-red-500 p-2 -m-2"
                >
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
              <SearchableSelect
                value={newTerritoryId}
                onChange={(e) => setNewTerritoryId(e.target.value)}
                placeholder="Select territory *"
                searchPlaceholder="Search territory..."
              >
                <option value="">Select territory *</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SearchableSelect>

              {entityType === "CHEMIST" && (
                <div className="space-y-2.5 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck size={14} className="text-purple-700" />
                      <span>Drug License (DL) Details * (Chemist Only)</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded">Form 20-B / 21-B</span>
                  </div>
                  <input
                    value={newLicenseNo}
                    onChange={(e) => setNewLicenseNo(e.target.value)}
                    placeholder="Drug License No. (e.g. DL-20B-TG-2024-8849) *"
                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-400 outline-none font-mono"
                  />
                  <div className="border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl p-3 text-center bg-white transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewDlCopyFile(file);
                          if (file.type.startsWith("image/")) {
                            setNewDlCopyPreview(URL.createObjectURL(file));
                          } else {
                            setNewDlCopyPreview(null);
                          }
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {newDlCopyFile ? (
                      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-800">
                        <FileCheck size={16} className="text-purple-600" />
                        <span className="truncate max-w-[200px]">{newDlCopyFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewDlCopyFile(null);
                            setNewDlCopyPreview(null);
                          }}
                          className="text-slate-400 hover:text-red-500 ml-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload size={18} className="mx-auto text-purple-600" />
                        <p className="text-xs font-semibold text-purple-900">Upload Drug License Certificate (PDF or Image)</p>
                        <p className="text-[10px] text-slate-500">Attach Form 20-B/21-B certificate scan or camera photo</p>
                      </div>
                    )}
                  </div>
                  {newDlCopyPreview && (
                    <div className="relative rounded-lg overflow-hidden border border-purple-200 max-h-32">
                      <img src={newDlCopyPreview} alt="DL Copy Preview" className="w-full h-32 object-cover" />
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin size={12} />
                {gps.status === "ready" ? "Location pinned from your current GPS fix." : "Waiting for GPS fix to pin location..."}
              </p>

              {addEntityError && <p className="text-sm text-red-600">{addEntityError}</p>}

              {duplicateMatch ? (
                <div className="space-y-2 border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Similar {entityType === "DOCTOR" ? "doctor" : "chemist"} already exists: {duplicateMatch.name} — did you mean to select that one instead?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={useExistingDuplicate}
                      className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700"
                    >
                      Use existing
                    </button>
                    <button
                      onClick={() => submitNewEntity(true)}
                      disabled={addingEntity}
                      className="flex-1 bg-white border border-amber-300 text-amber-800 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
                    >
                      {addingEntity ? "Adding..." : "Create anyway, it's different"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => submitNewEntity(false)}
                  disabled={addingEntity}
                  className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {addingEntity ? "Adding..." : `Add & Select`}
                </button>
              )}
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
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800">{e.name}</p>
                        {e.territoryName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded shrink-0">
                            <MapPin size={9} className="text-sky-600" />
                            {e.territoryName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {e.subArea && (
                          <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            {e.subArea}
                          </span>
                        )}
                        {e.beatName && (
                          <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                            Beat: {e.beatName}
                          </span>
                        )}
                        {e.address && <span className="text-xs text-slate-400 truncate block max-w-xs">{e.address}</span>}
                      </div>
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

        {/* ── Call Time ── */}
        {callStart && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
            <span className="font-semibold flex items-center gap-1.5">
              Call Session Active
            </span>
            <span>Started at {new Date(callStart.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

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
