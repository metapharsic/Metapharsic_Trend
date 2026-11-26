"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  Search,
  X,
  Camera,
  Plus,
  AlertTriangle,
  Phone,
  Store,
  Building,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  FileText,
  FileCheck,
  Eye,
  Upload,
  Stethoscope,
  Check,
  Lock,
  Navigation,
  Clock,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import { ScrollSearchBar } from "@/components/ui/scroll-search-bar";

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
  primarySpecialty?: string | null;
  dpsTier?: string | null;
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

interface NearbyChemist {
  id: string;
  name: string;
  address: string;
  subArea: string | null;
  beatName: string | null;
  mobile: string | null;
  licenseNo?: string | null;
  dlStatus?: string | null;
  distanceMeters: number;
  distanceKm: number;
  proximityLabel: string;
}

interface PrescribedDocOption {
  id: string;
  fullName: string;
  primarySpecialty?: string | null;
  clinicAddress?: string | null;
  subArea?: string | null;
  beatName?: string | null;
  mobile?: string | null;
  whatsApp?: string | null;
  phone?: string | null;
  registrationNo?: string | null;
  matchReason?: string;
  isHistoricalPrescriber?: boolean;
}

type GpsState = {
  status: "idle" | "locating" | "ready" | "error";
  lat?: number;
  lon?: number;
  accuracy?: number;
  updatedAt?: number;
  error?: string;
};

interface CompletedReceipt {
  visitId: string;
  entityName: string;
  entityType: "DOCTOR" | "CHEMIST";
  entityId: string;
  purpose: string;
  durationMinutes: number | null;
  cqsScore: number | null;
  boxesPlaced: number | null;
  gpsCaptured: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceFromEntityMeters: number | null;
  photoUrl: string | null;
  tourPlanSynced: boolean;
  prescribedDoctorName?: string | null;
  taggedChemistName?: string | null;
}

const PURPOSE_PRESETS = [
  "Product detailing",
  "Follow-up visit",
  "New product launch",
  "Order collection",
  "Relationship building",
];

function calcDistanceMeters(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

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
  const presetChemistId = searchParams.get("chemistId");
  const presetTourPlanDayId = searchParams.get("tourPlanDayId");
  const presetName = searchParams.get("name");
  const presetTerritory = searchParams.get("territory");
  const presetSubArea = searchParams.get("subArea");
  const presetBeat = searchParams.get("beat");

  const [entityType, setEntityType] = useState<"DOCTOR" | "CHEMIST">(
    presetChemistId && !presetDoctorId ? "CHEMIST" : "DOCTOR"
  );
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [searched, setSearched] = useState(false);
  const [hydratingEntity, setHydratingEntity] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(
    presetDoctorId
      ? {
          id: presetDoctorId,
          name: presetName ?? "Planned Doctor",
          type: "DOCTOR",
          address: null,
          territoryName: presetTerritory ?? null,
          subArea: presetSubArea ?? null,
          beatName: presetBeat ?? null,
        }
      : presetChemistId
      ? {
          id: presetChemistId,
          name: presetName ?? "Planned Chemist",
          type: "CHEMIST",
          address: null,
          territoryName: presetTerritory ?? null,
          subArea: presetSubArea ?? null,
          beatName: presetBeat ?? null,
        }
      : null
  );
  const [contactPhone, setContactPhone] = useState("");

  // Quick Add Entity Modal State
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

  // Chemist Drug License (DL) state
  const [chemistDlNumber, setChemistDlNumber] = useState("");
  const [chemistDlFile, setChemistDlFile] = useState<File | null>(null);
  const [chemistDlPreview, setChemistDlPreview] = useState<string | null>(null);
  const [chemistDlUrl, setChemistDlUrl] = useState<string | null>(null);

  // Real-time GPS Tracking & Call Timer
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [callStart, setCallStart] = useState<{ startedAt: string; lat?: number; lon?: number } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Call Inputs
  const [purpose, setPurpose] = useState("");
  const [feedback, setFeedback] = useState("");
  const [receptiveness, setReceptiveness] = useState<"POSITIVE" | "NEUTRAL" | "NEGATIVE" | "">("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [samplesAvailable, setSamplesAvailable] = useState<SampleOption[]>([]);
  const [samplesGiven, setSamplesGiven] = useState<Record<string, number>>({});
  const [boxesPlaced, setBoxesPlaced] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CompletedReceipt | null>(null);
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  // Lead Capture
  const [leadGenerated, setLeadGenerated] = useState(false);
  const [leadStatus, setLeadStatus] = useState<"NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST">("NEW");
  const [leadDetails, setLeadDetails] = useState("");
  const [leadFollowUpAction, setLeadFollowUpAction] = useState("");
  const [leadFollowUpDate, setLeadFollowUpDate] = useState("");

  // Workflow Settings
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(100);
  const [gpsAccuracyWarnMeters, setGpsAccuracyWarnMeters] = useState(50);
  const [requirePhoto, setRequirePhoto] = useState(false);

  // Nearby Chemist State (When Doctor is selected)
  const [nearbyChemists, setNearbyChemists] = useState<NearbyChemist[]>([]);
  const [loadingNearbyChemists, setLoadingNearbyChemists] = useState(false);
  const [nearbyPlacementType, setNearbyPlacementType] = useState<
    "NEAREST_CHEMIST" | "DOCTOR_DESIGNATED_CHEMIST" | "IN_HOUSE" | "NONE"
  >("NEAREST_CHEMIST");
  const [selectedNearbyChemistId, setSelectedNearbyChemistId] = useState<string>("");
  const [customNearbyChemistName, setCustomNearbyChemistName] = useState<string>("");
  const [nearbyPlacementNotes, setNearbyPlacementNotes] = useState<string>("");

  // Prescribed Doctors State (When Chemist is selected — fix & lock after doctor chosen)
  const [chemistDoctors, setChemistDoctors] = useState<PrescribedDocOption[]>([]);
  const [loadingChemistDoctors, setLoadingChemistDoctors] = useState(false);
  const [selectedChemistDoctor, setSelectedChemistDoctor] = useState<PrescribedDocOption | null>(null);
  const [prescribedDoctorPhone, setPrescribedDoctorPhone] = useState("");
  const [isChemistDoctorOptionOpen, setIsChemistDoctorOptionOpen] = useState(false);
  const [doctorLockedFixed, setDoctorLockedFixed] = useState(false);
  const [chemistDoctorSearch, setChemistDoctorSearch] = useState("");

  // Hydrate presetDoctorId / presetChemistId from API on mount
  useEffect(() => {
    const idToLoad = presetDoctorId || presetChemistId;
    const typeToLoad = presetDoctorId ? "DOCTOR" : presetChemistId ? "CHEMIST" : null;
    if (!idToLoad || !typeToLoad) return;

    setHydratingEntity(true);
    apiClient
      .get("/api/mr/entities", { params: { id: idToLoad, type: typeToLoad } })
      .then((res) => {
        const fetched = res.data?.data?.entity;
        if (fetched) {
          setSelected(fetched);
        }
      })
      .catch((err) => console.error("Failed to hydrate preset entity:", err))
      .finally(() => setHydratingEntity(false));
  }, [presetDoctorId, presetChemistId]);

  // Live continuous GPS tracking (watchPosition + manual refresh)
  const captureGps = () => {
    setGps((prev) => ({ ...prev, status: "locating", error: undefined }));
    if (typeof navigator === "undefined" || !navigator.geolocation) {
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
          updatedAt: Date.now(),
        }),
      (err) => setGps({ status: "error", error: err.message }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    captureGps();
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setGps({
          status: "ready",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updatedAt: Date.now(),
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Load Nearby Chemists (when Doctor selected) or Prescribed Doctors (when Chemist selected)
  useEffect(() => {
    const extractCleanPhone = (raw?: string | null) => {
      const val = (raw || "").trim();
      const digits = val.replace(/\D/g, "");
      if (!digits || digits === "9848011223" || /^(\d)\1{9}$/.test(digits.slice(-10))) return "";
      return val;
    };

    if (!selected) {
      setNearbyChemists([]);
      setSelectedNearbyChemistId("");
      setChemistDoctors([]);
      setSelectedChemistDoctor(null);
      setPrescribedDoctorPhone("");
      setIsChemistDoctorOptionOpen(false);
      setDoctorLockedFixed(false);
      return;
    }

    if (selected.type === "DOCTOR") {
      setLoadingNearbyChemists(true);
      setChemistDoctors([]);
      setSelectedChemistDoctor(null);
      setPrescribedDoctorPhone("");
      setIsChemistDoctorOptionOpen(false);
      setDoctorLockedFixed(false);
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
    } else if (selected.type === "CHEMIST") {
      setNearbyChemists([]);
      setSelectedNearbyChemistId("");
      setLoadingChemistDoctors(true);
      setChemistDoctors([]);
      setSelectedChemistDoctor(null);
      setPrescribedDoctorPhone("");
      setIsChemistDoctorOptionOpen(false);
      setDoctorLockedFixed(false);
      apiClient
        .get(`/api/chemists/prescribed-doctors`, { params: { chemistId: selected.id } })
        .then((res) => {
          const d = res.data?.data;
          if (d) {
            const docs: PrescribedDocOption[] = d.doctors || [];
            setChemistDoctors(docs);
            if (d.autoSelect && d.defaultDoctor) {
              setSelectedChemistDoctor(d.defaultDoctor);
              setPrescribedDoctorPhone(
                extractCleanPhone(d.defaultDoctor.phone || d.defaultDoctor.mobile || d.defaultDoctor.whatsApp)
              );
              setDoctorLockedFixed(true);
              setIsChemistDoctorOptionOpen(false);
            } else if (docs.length > 1) {
              setIsChemistDoctorOptionOpen(true);
            } else if (docs.length === 1) {
              setSelectedChemistDoctor(docs[0]);
              setPrescribedDoctorPhone(extractCleanPhone(docs[0].phone || docs[0].mobile || docs[0].whatsApp));
              setDoctorLockedFixed(true);
            }
          }
        })
        .catch((err) => console.error("Failed to load prescribed doctors:", err))
        .finally(() => setLoadingChemistDoctors(false));
    }
  }, [selected?.id, selected?.type]);

  // Initial samples, territories, settings
  useEffect(() => {
    apiClient
      .get("/api/mr/samples")
      .then((res) => setSamplesAvailable(res.data.data.samples || []))
      .catch((err) => console.error("Failed to load sample inventory:", err));
    apiClient
      .get("/api/mr/territories")
      .then((res) => {
        const list: Territory[] = res.data.data.territories || [];
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

  // Entity Search
  useEffect(() => {
    const timer = setTimeout(
      () => {
        apiClient
          .get("/api/mr/entities", { params: { type: entityType, search: search.trim(), limit: 50 } })
          .then((res) => {
            setResults(res.data.data.entities || []);
            setSearched(!!search.trim());
          })
          .catch((err) => console.error("Failed to search entities:", err));
      },
      search.trim() ? 250 : 0
    );
    return () => clearTimeout(timer);
  }, [search, entityType]);

  // Sync Phone + Chemist DL fields cleanly when entity changes
  useEffect(() => {
    const rawPhone = selected?.phone?.trim() || "";
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const isPlaceholder =
      !cleanDigits || cleanDigits === "9848011223" || /^(\d)\1{9}$/.test(cleanDigits.slice(-10));

    if (selected && !isPlaceholder) {
      setContactPhone(rawPhone);
    } else {
      setContactPhone("");
    }

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
  }, [selected?.id, selected?.phone, selected?.licenseNo, selected?.dlCopyUrl]);

  // Start call session & live timer cleanly when an entity is selected; reset when entity changes
  useEffect(() => {
    if (!selected) {
      setCallStart(null);
      setElapsedMs(0);
      return;
    }

    setCallStart({
      startedAt: new Date().toISOString(),
      lat: gps.status === "ready" ? gps.lat : undefined,
      lon: gps.status === "ready" ? gps.lon : undefined,
    });
    setElapsedMs(0);
  }, [selected?.id]);

  // Live timer tick
  useEffect(() => {
    if (!callStart) return;
    const startTs = new Date(callStart.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTs);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStart]);

  const setSampleQty = (productId: string, rawQty: number, maxQty: number) => {
    const clamped = Number.isNaN(rawQty) ? 0 : Math.max(0, Math.min(maxQty, Math.floor(rawQty)));
    setSamplesGiven((prev) => {
      const next = { ...prev };
      if (clamped <= 0) delete next[productId];
      else next[productId] = clamped;
      return next;
    });
  };

  const totalSamplesSelected = useMemo(
    () => Object.values(samplesGiven).reduce((sum, q) => sum + (Number(q) || 0), 0),
    [samplesGiven]
  );

  const liveDistanceMeters = useMemo(() => {
    if (gps.status !== "ready" || !selected) return null;
    return calcDistanceMeters(gps.lat, gps.lon, selected.latitude, selected.longitude);
  }, [gps.status, gps.lat, gps.lon, selected?.latitude, selected?.longitude]);

  const activeNearbyChemist = useMemo(
    () => nearbyChemists.find((c) => c.id === selectedNearbyChemistId) || null,
    [nearbyChemists, selectedNearbyChemistId]
  );

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
    if (entityType === "DOCTOR" && !newSpecialty.trim()) return setAddEntityError("Primary specialty is required.");
    if (newMobile.trim()) {
      const digits = newMobile.replace(/\D/g, "");
      if (digits.length < 10 || digits === "9848011223" || /^(\d)\1{9}$/.test(digits.slice(-10))) {
        return setAddEntityError("If provided, phone number must be at least 10 valid digits.");
      }
    }

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
        latitude: gps.status === "ready" && gps.lat ? gps.lat : 0,
        longitude: gps.status === "ready" && gps.lon ? gps.lon : 0,
        territoryId: newTerritoryId,
        ...(entityType === "DOCTOR" ? { primarySpecialty: newSpecialty.trim() } : {}),
        ...(entityType === "CHEMIST"
          ? {
              contactPerson: newContactPerson.trim() || undefined,
              licenseNo: newLicenseNo.trim() || undefined,
              dlCopyUrl: uploadedDlUrl || undefined,
            }
          : {}),
        ...(newMobile.trim() ? { whatsApp: newMobile.trim(), mobile: newMobile.trim() } : {}),
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
        phone: newMobile.trim() || created.mobile || null,
        latitude: created.latitude ?? 0,
        longitude: created.longitude ?? 0,
        licenseNo: newLicenseNo.trim() || created.licenseNo || null,
        dlCopyUrl: uploadedDlUrl || created.dlCopyUrl || null,
        dlStatus: uploadedDlUrl ? "VERIFIED" : created.dlStatus || "PENDING_VERIFICATION",
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
        err as {
          response?: {
            status?: number;
            data?: { error?: { code?: string; message?: string; details?: { id?: string; name?: string } } };
          };
        }
      )?.response;
      const errBody = errResponse?.data?.error;
      const details = errBody?.details;
      const isDuplicate =
        !!details?.id &&
        !!details?.name &&
        (errResponse?.status === 409 ||
          /duplicate|similar|already exists/i.test(errBody?.code ?? "") ||
          /duplicate|similar|already exists/i.test(errBody?.message ?? ""));

      if (isDuplicate && details?.id && details?.name) {
        setDuplicateMatch({ id: details.id, name: details.name });
        setAddEntityError(
          errBody?.message ?? `Similar ${entityType === "DOCTOR" ? "doctor" : "chemist"} already exists: ${details.name}`
        );
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
    apiClient
      .get("/api/mr/entities", { params: { id: duplicateMatch.id, type: entityType } })
      .then((res) => {
        if (res.data?.data?.entity) setSelected(res.data.data.entity);
      })
      .catch(() => {});
    setDuplicateMatch(null);
    setAddEntityError(null);
    setShowAddEntity(false);
    setSearch("");
    setResults([]);
  };

  const handlePhotoChange = (file: File | null) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    if (!file) {
      setPhoto(null);
      setPhotoPreviewUrl(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photo must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Photo must be under 10 MB.");
      return;
    }
    setError(null);
    setPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSelectPrescribedDoctor = (doc: PrescribedDocOption) => {
    setSelectedChemistDoctor(doc);
    const rawDocPhone = (doc.phone || doc.mobile || doc.whatsApp || "").trim();
    const docDigits = rawDocPhone.replace(/\D/g, "");
    const isDummyDoc = !docDigits || docDigits === "9848011223" || /^(\d)\1{9}$/.test(docDigits.slice(-10));
    setPrescribedDoctorPhone(isDummyDoc ? "" : rawDocPhone);
    setDoctorLockedFixed(true);
    setIsChemistDoctorOptionOpen(false);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!selected) return setError("Select a Doctor or Chemist to log this call against.");

    // Phone is OPTIONAL — validate strictly only when entered
    const rawPhoneInput = contactPhone.trim();
    const cleanDigits = rawPhoneInput.replace(/\D/g, "");
    if (rawPhoneInput) {
      if (cleanDigits.length < 10) {
        return setError("Entered phone number must have at least 10 digits.");
      }
      if (cleanDigits === "9848011223" || /^(\d)\1{9}$/.test(cleanDigits.slice(-10))) {
        return setError("Please enter a valid contact phone number (placeholder or dummy digits are not allowed).");
      }
    }

    // Prescribed Doctor Phone (when Chemist selected) is also OPTIONAL — validate strictly only when entered
    const rawDocPhoneInput =
      selected.type === "CHEMIST" && selectedChemistDoctor ? prescribedDoctorPhone.trim() : "";
    const cleanDocDigits = rawDocPhoneInput.replace(/\D/g, "");
    if (rawDocPhoneInput) {
      if (cleanDocDigits.length < 10) {
        return setError("Entered prescribed doctor phone number must have at least 10 digits.");
      }
      if (cleanDocDigits === "9848011223" || /^(\d)\1{9}$/.test(cleanDocDigits.slice(-10))) {
        return setError(
          "Please enter a valid prescribed doctor phone number (placeholder or dummy digits are not allowed)."
        );
      }
    }

    if (!purpose.trim()) return setError("Call purpose is required.");

    if (durationMinutes !== "") {
      const dur = Number(durationMinutes);
      if (!Number.isInteger(dur) || dur < 0 || dur > 600) {
        return setError("Duration must be a whole number between 0 and 600 minutes.");
      }
    }

    if (boxesPlaced !== "") {
      const b = Number(boxesPlaced);
      if (!Number.isInteger(b) || b < 0 || b > 10000) {
        return setError("Boxes placed must be a non-negative whole number.");
      }
    }

    // Validate samples against available stock
    for (const [productId, qty] of Object.entries(samplesGiven)) {
      const num = Number(qty);
      if (!num) continue;
      if (!Number.isInteger(num) || num < 0) {
        return setError("Sample quantities must be non-negative whole numbers.");
      }
      const stockItem = samplesAvailable.find((s) => s.productId === productId);
      if (stockItem && num > stockItem.quantity) {
        return setError(`Sample quantity for ${stockItem.productName} cannot exceed available stock (${stockItem.quantity}).`);
      }
    }

    if (leadGenerated && !leadDetails.trim()) {
      return setError("Please enter Lead Details when 'Lead Generated' is checked.");
    }

    if (requirePhoto && !photo) {
      return setError("A visit verification photo is required by workflow settings.");
    }

    const formData = new FormData();
    if (selected.type === "DOCTOR") formData.append("doctorId", selected.id);
    else formData.append("chemistId", selected.id);

    if (presetTourPlanDayId) {
      formData.append("tourPlanDayId", presetTourPlanDayId);
    }

    if (rawPhoneInput && cleanDigits) {
      formData.append("phone", cleanDigits);
    }
    formData.append("purpose", purpose.trim());
    if (feedback.trim()) formData.append("feedback", feedback.trim());
    if (receptiveness) formData.append("receptiveness", receptiveness);
    if (followUpDate) formData.append("followUpDate", followUpDate);

    // Honest GPS coordinates (0 & locationUnavailable=true if GPS unavailable; real coords when captured)
    const hasGpsFix = gps.status === "ready" && gps.lat !== undefined && gps.lon !== undefined && (gps.lat !== 0 || gps.lon !== 0);
    formData.append("latitude", hasGpsFix ? String(gps.lat) : "0");
    formData.append("longitude", hasGpsFix ? String(gps.lon) : "0");
    formData.append("locationUnavailable", hasGpsFix ? "false" : "true");
    if (hasGpsFix && gps.accuracy !== undefined) {
      formData.append("accuracy", String(Math.round(gps.accuracy)));
    }

    if (callStart) {
      formData.append("startedAt", callStart.startedAt);
      if (callStart.lat !== undefined && callStart.lon !== undefined) {
        formData.append("startLatitude", String(callStart.lat));
        formData.append("startLongitude", String(callStart.lon));
      }
    } else {
      formData.append("startedAt", new Date().toISOString());
    }

    const autoElapsedMin = callStart
      ? Math.max(1, Math.min(600, Math.round((Date.now() - new Date(callStart.startedAt).getTime()) / 60000)))
      : 5;
    formData.append("durationMinutes", durationMinutes !== "" ? durationMinutes : String(autoElapsedMin));
    formData.append("idempotencyKey", idempotencyKeyRef.current);

    if (photo) formData.append("photo", photo);

    const samplesPayload = Object.entries(samplesGiven)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
    if (samplesPayload.length > 0) {
      formData.append("samples", JSON.stringify(samplesPayload));
    }

    if (boxesPlaced !== "") {
      formData.append("boxesPlaced", boxesPlaced);
    } else if (totalSamplesSelected > 0) {
      formData.append("boxesPlaced", String(totalSamplesSelected));
    }

    if (leadGenerated) {
      formData.append(
        "lead",
        JSON.stringify({
          status: leadStatus,
          details: leadDetails.trim(),
          followUpAction: leadFollowUpAction.trim() || undefined,
          followUpDate: leadFollowUpDate || undefined,
        })
      );
    }

    if (selected.type === "CHEMIST") {
      if (selectedChemistDoctor) {
        formData.append("prescribedDoctorId", selectedChemistDoctor.id);
        formData.append("prescribedDoctorName", selectedChemistDoctor.fullName);
        if (rawDocPhoneInput && cleanDocDigits) {
          formData.append("prescribedDoctorPhone", cleanDocDigits);
        }
      }
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
      const resolvedChemistName =
        nearbyPlacementType === "IN_HOUSE"
          ? "In-House Clinic Dispensary"
          : nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST"
          ? customNearbyChemistName.trim() || activeNearbyChemist?.name || "Doctor Designated Chemist"
          : activeNearbyChemist?.name || "Nearest Chemist";
      formData.append("nearbyChemistName", resolvedChemistName);
      if (nearbyPlacementNotes.trim()) {
        formData.append("nearbyChemistNotes", nearbyPlacementNotes.trim());
      }
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/api/mr/visits", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data?.data;
      const chosenChemistName =
        selected.type === "DOCTOR" && nearbyPlacementType !== "NONE"
          ? nearbyPlacementType === "IN_HOUSE"
            ? "In-House Clinic Dispensary"
            : customNearbyChemistName.trim() || activeNearbyChemist?.name || null
          : null;

      setReceipt({
        visitId: data?.visitId || data?.visit?.id || "",
        entityName: selected.name,
        entityType: selected.type,
        entityId: selected.id,
        purpose: purpose.trim(),
        durationMinutes: data?.visit?.durationMinutes ?? Number(durationMinutes || autoElapsedMin),
        cqsScore: data?.visit?.cqsScore ?? null,
        boxesPlaced: data?.visit?.boxesPlaced ?? null,
        gpsCaptured: Boolean(data?.gpsTracking?.captured),
        latitude: data?.gpsTracking?.latitude ?? 0,
        longitude: data?.gpsTracking?.longitude ?? 0,
        accuracyMeters: data?.gpsTracking?.accuracyMeters ?? null,
        distanceFromEntityMeters: data?.gpsTracking?.distanceFromEntityMeters ?? null,
        photoUrl: data?.visit?.photoUrl ?? null,
        tourPlanSynced: Boolean(data?.tourPlanSync?.tourPlanSynced),
        prescribedDoctorName: selectedChemistDoctor?.fullName ?? null,
        taggedChemistName: chosenChemistName,
      });

      // Reset idempotency key for future call
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to log call.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForNextCall = () => {
    setReceipt(null);
    setSelected(null);
    setPurpose("");
    setFeedback("");
    setReceptiveness("");
    setFollowUpDate("");
    setDurationMinutes("");
    setSamplesGiven({});
    setBoxesPlaced("");
    setContactPhone("");
    setPhoto(null);
    setPhotoPreviewUrl(null);
    setLeadGenerated(false);
    setLeadDetails("");
    setLeadFollowUpAction("");
    setLeadFollowUpDate("");
    setSelectedChemistDoctor(null);
    setPrescribedDoctorPhone("");
    setDoctorLockedFixed(false);
    setNearbyPlacementNotes("");
    setCustomNearbyChemistName("");
    setError(null);
    router.replace("/mr/calls/new");
  };

  const gpsAccuracyPoor = gps.status === "ready" && gps.accuracy !== undefined && gps.accuracy > gpsAccuracyWarnMeters;

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      {/* Header Banner with Live GPS Status Bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Complete Call</h1>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              GPS Tracked &amp; Validated
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            GPS-tracked call checkout with optional contact phone, doctor/chemist linkage, sample balance guard, and N+1 tour plan sync.
          </p>
        </div>

        {/* Live GPS Telemetry Pill */}
        <div className="flex flex-col sm:items-end gap-1.5 w-full md:w-auto">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              gps.status === "ready"
                ? gpsAccuracyPoor
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
                : gps.status === "locating"
                ? "bg-sky-50 text-sky-800 border-sky-200"
                : "bg-amber-50 text-amber-800 border-amber-300"
            }`}
          >
            <Navigation size={13} className={gps.status === "locating" ? "animate-pulse" : ""} />
            {gps.status === "ready" && gps.lat !== undefined && gps.lon !== undefined ? (
              <span>
                GPS Locked: {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
                {gps.accuracy !== undefined ? ` (±${Math.round(gps.accuracy)}m)` : ""}
              </span>
            ) : gps.status === "locating" ? (
              <span>Acquiring GPS location...</span>
            ) : (
              <span>GPS Unavailable — Manual Checkout</span>
            )}
            <button
              type="button"
              onClick={captureGps}
              className="ml-1 underline font-semibold hover:opacity-80"
              title="Refresh live GPS coordinates"
            >
              Refresh
            </button>
          </div>

          {liveDistanceMeters !== null && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                liveDistanceMeters <= geofenceRadiusMeters
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Distance from pinned location: {formatDistance(liveDistanceMeters)} (Geofence ref: {geofenceRadiusMeters}m)
            </span>
          )}
        </div>
      </div>

      {/* ── POST-CHECKOUT VERIFIED RECEIPT ── */}
      {receipt ? (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-emerald-300 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Call Completed &amp; Recorded</h2>
                <p className="text-xs text-slate-500">
                  {receipt.entityName} ({receipt.entityType}) · {receipt.purpose}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {receipt.tourPlanSynced && (
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full">
                  ✓ Synced with N+1 Tour Plan
                </span>
              )}
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  receipt.gpsCaptured
                    ? "bg-sky-50 text-sky-800 border-sky-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {receipt.gpsCaptured ? "GPS Verified" : "Manual Checkout (No GPS)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration Logged</span>
              <span className="text-base font-bold text-slate-900">{receipt.durationMinutes ?? "—"} min</span>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Call Quality (CQS)</span>
              <span className="text-base font-bold text-emerald-900">
                {receipt.cqsScore !== null ? `${receipt.cqsScore.toFixed(1)} / 100` : "Chemist Call"}
              </span>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
              <span className="text-[10px] uppercase font-bold text-purple-600 block">Boxes / Samples</span>
              <span className="text-base font-bold text-purple-900">{receipt.boxesPlaced ?? 0}</span>
            </div>
            <div className="bg-sky-50 rounded-xl p-3 border border-sky-200">
              <span className="text-[10px] uppercase font-bold text-sky-600 block">GPS Coordinates</span>
              <span className="text-xs font-mono font-bold text-sky-900">
                {receipt.gpsCaptured
                  ? `${receipt.latitude.toFixed(4)}, ${receipt.longitude.toFixed(4)}`
                  : "Not Captured"}
              </span>
              {receipt.distanceFromEntityMeters !== null && (
                <span className="text-[10px] text-sky-700 block mt-0.5">
                  Distance: {formatDistance(receipt.distanceFromEntityMeters)}
                </span>
              )}
            </div>
          </div>

          {(receipt.prescribedDoctorName || receipt.taggedChemistName) && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-700 flex flex-wrap gap-3">
              {receipt.prescribedDoctorName && (
                <span>
                  <strong>Prescribed Doctor:</strong> Dr. {receipt.prescribedDoctorName}
                </span>
              )}
              {receipt.taggedChemistName && (
                <span>
                  <strong>Tagged Chemist:</strong> {receipt.taggedChemistName}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForNextCall}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs"
            >
              <Plus size={14} /> Complete Another Call
            </button>
            <div className="flex flex-wrap gap-2">
              {receipt.entityType === "CHEMIST" && (
                <button
                  type="button"
                  onClick={() => router.push(`/orders?chemistId=${receipt.entityId}`)}
                  className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold"
                >
                  <ShoppingCart size={14} /> Book Order for Chemist
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push("/tour-plans?tab=DAILY_SCHEDULE")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100"
              >
                Open N+1 Tour Schedule
              </button>
              <button
                type="button"
                onClick={() => router.push("/mr/calls")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <span>Call History</span> <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
            {/* ── Entity selection ── */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Consulting Doctor / Retail Chemist *
              </label>
              {hydratingEntity ? (
                <div className="p-4 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw size={14} className="animate-spin text-emerald-600" />
                  <span>Loading master profile, phone &amp; beat details...</span>
                </div>
              ) : selected ? (
                <div className="space-y-4">
                  {/* Fixed Selected Entity Card */}
                  <div className="flex items-start justify-between border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-sm">{selected.name}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                          {selected.type === "DOCTOR" ? "Doctor" : "Chemist"}
                        </span>
                        {selected.dpsTier && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                            {selected.dpsTier}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {selected.territoryName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-md">
                            <MapPin size={11} className="text-sky-600" />
                            Territory: {selected.territoryName}
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
                        {selected.primarySpecialty && (
                          <span className="text-[11px] font-semibold bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {selected.primarySpecialty}
                          </span>
                        )}
                      </div>
                      {selected.address && <p className="text-xs text-slate-600">{selected.address}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setCallStart(null);
                      }}
                      className="text-slate-400 hover:text-red-500 p-2 -m-2"
                      title="Change Doctor / Chemist"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* ── OPTIONAL PHONE NUMBER INPUT ── */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone size={13} className="text-emerald-600" />
                        <span>{selected.type === "CHEMIST" ? "Chemist Contact Phone" : "Doctor Contact Phone"}</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          OPTIONAL
                        </span>
                      </span>
                      {selected.phone ? (
                        <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled from master record</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Leave blank if unavailable</span>
                      )}
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Optional 10-digit mobile number"
                      maxLength={15}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Optional: enter or edit a 10-digit number to update their master profile.
                    </p>
                  </div>

                  {/* ── WHEN CHEMIST SELECTED: PRESCRIBED DOCTOR SELECT & FIX WITH FULL DETAILS + PHONE ── */}
                  {selected.type === "CHEMIST" && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Stethoscope size={14} className="text-emerald-600" />
                          <span>
                            Prescribed Doctor{" "}
                            {chemistDoctors.length > 1 ? `(${chemistDoctors.length} Tagged)` : ""}
                          </span>
                        </label>
                        {selectedChemistDoctor && doctorLockedFixed && chemistDoctors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsChemistDoctorOptionOpen(true);
                              setDoctorLockedFixed(false);
                            }}
                            className="text-xs font-bold text-emerald-700 hover:underline"
                          >
                            Change Doctor
                          </button>
                        )}
                      </div>

                      {loadingChemistDoctors ? (
                        <div className="text-xs text-emerald-700 py-2.5 flex items-center gap-2 bg-emerald-50/60 px-3 rounded-xl border border-emerald-100">
                          <RefreshCw size={13} className="animate-spin text-emerald-600" />
                          <span>Loading prescribed doctors linked to this chemist...</span>
                        </div>
                      ) : selectedChemistDoctor && !isChemistDoctorOptionOpen ? (
                        /* Fixed Prescribed Doctor Card with Phone & Full Rest Fields */
                        <div className="bg-emerald-50/80 border-2 border-emerald-300 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-900">
                                  {/^dr\.?\s+/i.test(selectedChemistDoctor.fullName)
                                    ? selectedChemistDoctor.fullName
                                    : `Dr. ${selectedChemistDoctor.fullName}`}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase">
                                  <Lock size={10} /> Fixed Doctor
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                                {selectedChemistDoctor.primarySpecialty && (
                                  <span className="font-semibold text-emerald-900">
                                    {selectedChemistDoctor.primarySpecialty}
                                  </span>
                                )}
                                {selectedChemistDoctor.beatName && (
                                  <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                                    Beat: {selectedChemistDoctor.beatName}
                                  </span>
                                )}
                                {selectedChemistDoctor.subArea && (
                                  <span className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                                    {selectedChemistDoctor.subArea}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/70 text-xs">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1">
                                  <Phone size={11} className="text-emerald-700" />
                                  <span>Doctor Phone</span>
                                  <span className="text-[9px] font-bold text-slate-600 bg-white border border-emerald-200 px-1 py-0.2 rounded">
                                    OPTIONAL
                                  </span>
                                </span>
                                {(selectedChemistDoctor.phone ||
                                  selectedChemistDoctor.mobile ||
                                  selectedChemistDoctor.whatsApp) && (
                                  <span className="text-[10px] text-emerald-700 font-semibold">Auto-filled</span>
                                )}
                              </label>
                              <input
                                type="tel"
                                value={prescribedDoctorPhone}
                                onChange={(e) => setPrescribedDoctorPhone(e.target.value)}
                                placeholder="Optional 10-digit doctor mobile"
                                maxLength={15}
                                className="w-full border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                <MapPin size={11} className="text-emerald-700 shrink-0" />
                                <span>Clinic / Practice Location</span>
                              </span>
                              <p className="text-xs text-slate-700 bg-white/80 border border-emerald-200 rounded-lg px-2.5 py-1.5 truncate">
                                {selectedChemistDoctor.clinicAddress || "Clinic address on file"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : chemistDoctors.length > 0 ? (
                        <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs text-purple-900 font-semibold">
                            Select the prescribing doctor to fix with this chemist call:
                          </p>
                          {(() => {
                            const q = chemistDoctorSearch.trim().toLowerCase();
                            const filteredChemistDoctors = q
                              ? chemistDoctors.filter((doc) => {
                                  const docPhone = doc.phone || doc.mobile || doc.whatsApp || "";
                                  return (
                                    doc.fullName.toLowerCase().includes(q) ||
                                    (doc.primarySpecialty || "").toLowerCase().includes(q) ||
                                    (doc.subArea || "").toLowerCase().includes(q) ||
                                    (doc.clinicAddress || "").toLowerCase().includes(q) ||
                                    docPhone.toLowerCase().includes(q)
                                  );
                                })
                              : chemistDoctors;

                            return (
                              <>
                                <ScrollSearchBar
                                  value={chemistDoctorSearch}
                                  onChange={setChemistDoctorSearch}
                                  placeholder="Search doctor name, specialty, area or phone…"
                                  matchedCount={filteredChemistDoctors.length}
                                  totalCount={chemistDoctors.length}
                                  accent="purple"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                  {filteredChemistDoctors.length === 0 ? (
                                    <p className="col-span-full text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3 text-center">
                                      No doctors matching &ldquo;{chemistDoctorSearch}&rdquo;
                                    </p>
                                  ) : (
                                    filteredChemistDoctors.map((doc) => {
                                      const active = selectedChemistDoctor?.id === doc.id;
                                      const docPhone = doc.phone || doc.mobile || doc.whatsApp;
                                      return (
                                        <button
                                          key={doc.id}
                                          type="button"
                                          onClick={() => handleSelectPrescribedDoctor(doc)}
                                          className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                                            active
                                              ? "bg-emerald-100 border-emerald-400 text-emerald-950 font-bold"
                                              : "bg-white hover:bg-purple-50 border-slate-200 text-slate-800"
                                          }`}
                                        >
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="text-xs font-bold truncate">
                                              {/^dr\.?\s+/i.test(doc.fullName) ? doc.fullName : `Dr. ${doc.fullName}`}
                                            </p>
                                            <p className="text-[11px] text-slate-600 truncate">
                                              {doc.primarySpecialty || "Specialist"}
                                              {doc.subArea ? ` · ${doc.subArea}` : ""}
                                            </p>
                                            {docPhone && (
                                              <p className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                                                <Phone size={10} /> {docPhone}
                                              </p>
                                            )}
                                          </div>
                                          {active && <Check size={14} className="text-emerald-700 shrink-0 mt-0.5" />}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No prescribed doctors mapped to this chemist&apos;s beat yet.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── WHEN DOCTOR SELECTED: NEARBY CHEMIST SELECTION & FIXED SUMMARY CARD ── */}
                  {selected.type === "DOCTOR" && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Store size={14} className="text-purple-600" />
                          <span>Nearby Chemist / Medicine Placement</span>
                        </label>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles size={10} /> Territory Proximity
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-semibold">
                        {(
                          [
                            ["NEAREST_CHEMIST", "Nearest Chemist"],
                            ["DOCTOR_DESIGNATED_CHEMIST", "Dr. Designated"],
                            ["IN_HOUSE", "In-House Clinic"],
                            ["NONE", "Skip / None"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setNearbyPlacementType(mode)}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              nearbyPlacementType === mode
                                ? mode === "NONE"
                                  ? "bg-slate-700 text-white border-slate-700 font-bold"
                                  : "bg-purple-600 text-white border-purple-600 font-bold"
                                : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {(nearbyPlacementType === "NEAREST_CHEMIST" ||
                        nearbyPlacementType === "DOCTOR_DESIGNATED_CHEMIST") && (
                        <div className="space-y-2.5 bg-purple-50/50 p-3.5 rounded-xl border border-purple-200/70">
                          {loadingNearbyChemists ? (
                            <div className="text-xs text-purple-700 py-2 flex items-center justify-center gap-2">
                              <RefreshCw size={14} className="animate-spin text-purple-600" />
                              <span>Searching nearby chemists...</span>
                            </div>
                          ) : nearbyChemists.length > 0 ? (
                            <div className="space-y-2">
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

                              {/* Fixed Tagged Chemist Card with Phone & Rest of Fields */}
                              {activeNearbyChemist && (
                                <div className="bg-white border-2 border-purple-300 rounded-xl p-3 text-xs space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{activeNearbyChemist.name}</span>
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-600 text-white uppercase">
                                        <Lock size={9} /> Fixed Chemist
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                      {activeNearbyChemist.proximityLabel}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-slate-600">
                                    <span className="flex items-center gap-1">
                                      <Phone size={11} className="text-purple-600" />
                                      <strong className="font-mono">
                                        {activeNearbyChemist.mobile || "Optional — Not on file"}
                                      </strong>
                                    </span>
                                    {activeNearbyChemist.licenseNo && (
                                      <span>DL: {activeNearbyChemist.licenseNo}</span>
                                    )}
                                  </div>
                                  {activeNearbyChemist.address && (
                                    <p className="text-[11px] text-slate-500">{activeNearbyChemist.address}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              No chemists found in this territory directory yet.
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

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700">
                              Stock / Placement Notes at Chemist:
                            </label>
                            <input
                              type="text"
                              value={nearbyPlacementNotes}
                              onChange={(e) => setNearbyPlacementNotes(e.target.value)}
                              placeholder="e.g. 5 boxes placed for Doctor prescriptions"
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
                            Recorded as direct dispensary placement inside the clinic pharmacy.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CHEMIST DRUG LICENSE (DL) COMPLIANCE ── */}
                  {selected.type === "CHEMIST" && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck size={14} className="text-purple-600" />
                          <span>Chemist Drug License (DL) &amp; Compliance</span>
                        </label>
                      </div>

                      <div className="bg-purple-50/40 p-3.5 rounded-xl border border-purple-200/80 space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Drug License Number (Form 20-B / 21-B)</span>
                            {chemistDlNumber ? (
                              <span className="text-[10px] font-mono text-purple-700 font-semibold">
                                {chemistDlNumber}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-semibold">Optional / Missing</span>
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

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <FileText size={12} className="text-purple-600" />
                              <span>DL Certificate Copy</span>
                            </span>
                            {chemistDlUrl || selected.dlCopyUrl ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={10} /> Verified on File
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Optional Upload
                              </span>
                            )}
                          </div>

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
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:underline shrink-0 ml-2"
                              >
                                <Eye size={12} /> View
                              </a>
                            </div>
                          )}

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
                              <div className="space-y-0.5">
                                <Upload size={16} className="mx-auto text-purple-600" />
                                <p className="text-xs font-semibold text-purple-900">
                                  {chemistDlUrl || selected.dlCopyUrl ? "Replace DL Copy" : "Upload DL Copy (PDF / Image)"}
                                </p>
                              </div>
                            )}
                          </div>

                          {chemistDlPreview && (
                            <div className="relative rounded-lg overflow-hidden border border-purple-200 max-h-32 mt-2">
                              <img src={chemistDlPreview} alt="DL Preview" className="w-full h-32 object-cover" />
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
                    <div className="space-y-2 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                      <input
                        value={newLicenseNo}
                        onChange={(e) => setNewLicenseNo(e.target.value)}
                        placeholder="Drug License No. (optional)"
                        className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm bg-white font-mono"
                      />
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewDlCopyFile(file);
                            setNewDlCopyPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
                          }
                        }}
                        className="w-full text-xs"
                      />
                      {newDlCopyPreview && (
                        <img src={newDlCopyPreview} alt="DL preview" className="h-24 rounded-lg object-cover" />
                      )}
                    </div>
                  )}

                  {addEntityError && <p className="text-sm text-red-600">{addEntityError}</p>}

                  {duplicateMatch ? (
                    <div className="space-y-2 border border-amber-200 bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Similar record already exists: {duplicateMatch.name}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={useExistingDuplicate}
                          className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                        >
                          Use existing
                        </button>
                        <button
                          onClick={() => submitNewEntity(true)}
                          disabled={addingEntity}
                          className="flex-1 bg-white border border-amber-300 text-amber-800 px-3 py-2 rounded-lg text-xs font-semibold"
                        >
                          Create anyway
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => submitNewEntity(false)}
                      disabled={addingEntity}
                      className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {addingEntity ? "Adding..." : "Add & Select"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(["DOCTOR", "CHEMIST"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEntityType(t)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                          entityType === t
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-200"
                        }`}
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
                      placeholder={`Search ${entityType === "DOCTOR" ? "doctors" : "chemists"} by name...`}
                      className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2.5 text-base sm:text-sm"
                    />
                  </div>
                  {results.length > 0 && (
                    <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {results.map((e) => (
                        <button
                          key={e.id}
                          type="button"
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
                            {e.phone && (
                              <span className="text-[10px] font-mono text-emerald-700">
                                Ph: {e.phone}
                              </span>
                            )}
                            {e.address && (
                              <span className="text-xs text-slate-400 truncate block max-w-xs">{e.address}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searched && (
                    <button
                      type="button"
                      onClick={openAddEntity}
                      className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 border border-dashed border-emerald-300 rounded-lg py-2.5 hover:bg-emerald-50"
                    >
                      <Plus size={15} /> Can&apos;t find them? Add new {entityType === "DOCTOR" ? "doctor" : "chemist"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Active Call Timer & GPS Session ── */}
            {callStart && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                <span className="font-bold flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-600" />
                  Call Timer: {formatElapsed(elapsedMs)}
                </span>
                <span>
                  Started {new Date(callStart.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {callStart.lat !== undefined && callStart.lon !== undefined
                    ? ` · Start GPS ${callStart.lat.toFixed(4)}, ${callStart.lon.toFixed(4)}`
                    : ""}
                </span>
              </div>
            )}

            {/* ── Purpose, Duration, Receptiveness & Follow-Up ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Purpose *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {PURPOSE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        purpose === p
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
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

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Duration (minutes — auto from timer if blank)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder={`Auto (~${Math.max(1, Math.round(elapsedMs / 60000))} min)`}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Receptiveness
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["POSITIVE", "NEUTRAL", "NEGATIVE"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReceptiveness(receptiveness === r ? "" : r)}
                        className={`py-1.5 rounded-lg text-xs font-bold border ${
                          receptiveness === r
                            ? r === "POSITIVE"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : r === "NEUTRAL"
                              ? "bg-sky-600 text-white border-sky-600"
                              : "bg-rose-600 text-white border-rose-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Notes / Feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="Clinical feedback, product response, stock notes..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* ── Samples ── */}
            {samplesAvailable.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Samples Given
                  </label>
                  {totalSamplesSelected > 0 && (
                    <span className="text-xs font-bold text-emerald-700">
                      Total selected: {totalSamplesSelected} unit(s)
                    </span>
                  )}
                </div>
                <div className="space-y-2 border border-slate-100 rounded-lg p-3 max-h-56 overflow-y-auto">
                  {samplesAvailable.map((s) => (
                    <div key={s.productId} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.productName}</p>
                        <p className="text-xs text-slate-400">{s.quantity} remaining in stock</p>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={s.quantity}
                        value={samplesGiven[s.productId] ?? ""}
                        onChange={(e) => setSampleQty(s.productId, Number(e.target.value), s.quantity)}
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Boxes Placed (Qty)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={10000}
                value={boxesPlaced}
                onChange={(e) => setBoxesPlaced(e.target.value)}
                placeholder={totalSamplesSelected > 0 ? `Auto (${totalSamplesSelected})` : "0"}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
              />
            </div>

            {/* ── Lead capture ── */}
            <div className="border border-slate-100 rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leadGenerated}
                  onChange={(e) => setLeadGenerated(e.target.checked)}
                  className="w-4 h-4"
                />
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
                          leadStatus === s
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <input
                    value={leadDetails}
                    onChange={(e) => setLeadDetails(e.target.value)}
                    placeholder="Lead details / what they are interested in *"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                  />
                  <input
                    value={leadFollowUpAction}
                    onChange={(e) => setLeadFollowUpAction(e.target.value)}
                    placeholder="Follow-up action"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm"
                  />
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Lead Follow-up Date
                    </label>
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

            {/* ── Verification Photo ── */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Camera size={13} /> Verification Photo {requirePhoto ? "*" : "(optional)"}
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm file:font-semibold"
              />
              {photoPreviewUrl && (
                <div className="relative inline-block">
                  <img
                    src={photoPreviewUrl}
                    alt="Verification preview"
                    className="h-32 rounded-xl border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handlePhotoChange(null)}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow"
                    title="Remove photo"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Desktop Actions ── */}
            <div className="hidden sm:flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/mr")}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Checkout & Complete Call"}
              </button>
            </div>
          </div>

          {/* ── Mobile sticky action bar ── */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex gap-3 z-20">
            <button
              type="button"
              onClick={() => router.push("/mr")}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2] bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Complete Call"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
