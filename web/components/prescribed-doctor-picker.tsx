"use client";

import React, { useEffect, useState } from "react";
import { Stethoscope, RefreshCw, CheckCircle2, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ScrollSearchBar } from "@/components/ui/scroll-search-bar";

function formatDoctorName(fullName: string): string {
  const trimmed = fullName.trim();
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export interface PrescribedDoctorOption {
  id: string;
  fullName: string;
  primarySpecialty?: string | null;
  clinicAddress?: string | null;
  subArea?: string | null;
  matchReason?: string;
}

interface PrescribedDoctorPickerProps {
  chemistId: string | null | undefined;
  doctorId: string;
  onChange: (doctorId: string) => void;
  initialDoctor?: PrescribedDoctorOption | null;
}

export function PrescribedDoctorPicker({
  chemistId,
  doctorId,
  onChange,
  initialDoctor = null,
}: PrescribedDoctorPickerProps) {
  const [doctors, setDoctors] = useState<PrescribedDoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<PrescribedDoctorOption | null>(initialDoctor);
  const [wasAutoSelected, setWasAutoSelected] = useState(false);
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");

  useEffect(() => {
    setSelectedDoctor(initialDoctor);
  }, [initialDoctor]);

  useEffect(() => {
    setDoctorSearch("");
    if (!chemistId) {
      setDoctors([]);
      setSelectedDoctor(null);
      setWasAutoSelected(false);
      setIsOptionOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/api/chemists/prescribed-doctors?chemistId=${chemistId}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (!data) return;

        const docs: PrescribedDoctorOption[] = data.doctors || [];
        setDoctors(docs);

        if (initialDoctor) {
          setSelectedDoctor(initialDoctor);
          setWasAutoSelected(false);
          setIsOptionOpen(false);
          return;
        }

        if (data.autoSelect && data.defaultDoctor) {
          setSelectedDoctor(data.defaultDoctor);
          setWasAutoSelected(true);
          setIsOptionOpen(false);
          onChange(data.defaultDoctor.id);
        } else if (data.multiple) {
          setSelectedDoctor(null);
          setWasAutoSelected(false);
          setIsOptionOpen(true);
        } else {
          setSelectedDoctor(null);
          setWasAutoSelected(false);
          setIsOptionOpen(docs.length > 0);
        }
      })
      .catch((err) => console.error("Failed to load prescribed doctors for chemist:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemistId]);

  if (!chemistId) return null;

  return (
    <div className="space-y-2" data-testid="prescribed-doctor-picker">
      {loading ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-700">
          <RefreshCw size={13} className="animate-spin text-purple-600" />
          <span>Finding tagged prescribing doctors for selected chemist...</span>
        </div>
      ) : selectedDoctor && !isOptionOpen ? (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Stethoscope size={16} />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 truncate">{formatDoctorName(selectedDoctor.fullName)}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-800 uppercase tracking-wider flex items-center gap-0.5">
                  <CheckCircle2 size={9} /> {wasAutoSelected ? "Auto-Populated" : "Prescribed Doctor"}
                </span>
              </div>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {selectedDoctor.primarySpecialty || "General Medicine"}
                {selectedDoctor.clinicAddress ? ` • ${selectedDoctor.clinicAddress}` : ""}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                ✓ Prescribing doctor tagged to this chemist in {selectedDoctor.subArea || "beat area"}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOptionOpen(true)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline shrink-0 ml-2"
          >
            Change Option
          </button>
        </div>
      ) : (
        <div className="border border-purple-200 bg-purple-50/50 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope size={14} className="text-purple-700" />
              <span>Prescribed Doctor {doctors.length > 1 ? `(${doctors.length} Tagged)` : ""}</span>
            </label>
            {selectedDoctor && (
              <button
                type="button"
                onClick={() => {
                  onChange(selectedDoctor.id);
                  setIsOptionOpen(false);
                }}
                className="text-[11px] text-purple-700 hover:underline font-semibold"
              >
                Keep {formatDoctorName(selectedDoctor.fullName)}
              </button>
            )}
          </div>

          {doctors.length > 1 ? (
            <p className="text-xs text-purple-800">
              This chemist is tagged with multiple doctors in their beat. Please select who prescribed these items:
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Select a prescribing doctor for this chemist order (or choose counter sale):
            </p>
          )}

          {doctors.length > 0 && (
            <ScrollSearchBar
              value={doctorSearch}
              onChange={setDoctorSearch}
              placeholder="Search doctor name, specialty, clinic or area…"
              matchedCount={
                doctors.filter((doc) => {
                  const q = doctorSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    doc.fullName.toLowerCase().includes(q) ||
                    (doc.primarySpecialty || "").toLowerCase().includes(q) ||
                    (doc.clinicAddress || "").toLowerCase().includes(q) ||
                    (doc.subArea || "").toLowerCase().includes(q)
                  );
                }).length
              }
              totalCount={doctors.length}
              accent="purple"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {(() => {
              const q = doctorSearch.trim().toLowerCase();
              const filteredDoctors = q
                ? doctors.filter(
                    (doc) =>
                      doc.fullName.toLowerCase().includes(q) ||
                      (doc.primarySpecialty || "").toLowerCase().includes(q) ||
                      (doc.clinicAddress || "").toLowerCase().includes(q) ||
                      (doc.subArea || "").toLowerCase().includes(q)
                  )
                : doctors;

              if (filteredDoctors.length === 0 && doctors.length > 0) {
                return (
                  <p className="col-span-full text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3 text-center">
                    No doctors matching &ldquo;{doctorSearch}&rdquo;
                  </p>
                );
              }

              return filteredDoctors.map((doc) => {
                const isSelected = doc.id === doctorId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      onChange(doc.id);
                      setSelectedDoctor(doc);
                      setWasAutoSelected(false);
                      setIsOptionOpen(false);
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer border text-left transition flex items-start justify-between gap-2 ${
                      isSelected
                        ? "bg-purple-100/90 border-purple-400 text-purple-950 shadow-xs ring-1 ring-purple-400 font-bold"
                        : "bg-white hover:bg-purple-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{formatDoctorName(doc.fullName)}</p>
                      <p className="text-[11px] text-slate-500 truncate">{doc.primarySpecialty || "General"}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{doc.clinicAddress || doc.subArea || "Local Clinic"}</p>
                    </div>
                    {isSelected ? (
                      <span className="p-1 rounded-full bg-purple-200 text-purple-900 shrink-0">
                        <Check size={12} />
                      </span>
                    ) : (
                      <span className="text-[10px] text-purple-600 font-semibold px-2 py-0.5 rounded-md hover:bg-purple-100 shrink-0">
                        Select
                      </span>
                    )}
                  </div>
                );
              });
            })()}

            <div
              onClick={() => {
                onChange("");
                setSelectedDoctor(null);
                setWasAutoSelected(false);
                setIsOptionOpen(false);
              }}
              className={`p-2.5 rounded-xl cursor-pointer border text-left transition flex items-center justify-between ${
                !doctorId ? "bg-slate-100 border-slate-300 font-bold text-slate-800" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              <span className="text-xs">Counter Sale (No Prescribing Doctor)</span>
              {!doctorId && <Check size={14} className="text-slate-600" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
