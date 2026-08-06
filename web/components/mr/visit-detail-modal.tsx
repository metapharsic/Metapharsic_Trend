"use client";

import React, { useEffect, useState } from "react";
import { X, MapPin, Stethoscope, Store, Clock, Camera, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface VisitDetail {
  id: string;
  createdAt: string;
  purpose: string;
  feedback: string | null;
  latitude: number;
  longitude: number;
  locationUnavailable: boolean;
  startedAt: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endedAt: string | null;
  durationMinutes: number | null;
  boxesPlaced: number | null;
  photoUrl: string | null;
  doctor: { id: string; fullName: string; clinicAddress: string | null } | null;
  chemist: { id: string; name: string; address: string | null } | null;
  lead: unknown | null;
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function VisitDetailModal({ visitId, onClose }: { visitId: string; onClose: () => void }) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient.get(`/api/mr/visits/${visitId}`)
      .then((res) => { if (!cancelled) setVisit(res.data.data.visit); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error?.message ?? "Failed to load call details."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visitId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-sm font-bold text-slate-900">Call Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && <p className="text-sm text-slate-400 text-center py-8">Loading...</p>}
          {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

          {visit && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  {visit.doctor ? <Stethoscope size={18} className="text-emerald-600" /> : <Store size={18} className="text-emerald-600" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{visit.doctor?.fullName ?? visit.chemist?.name ?? "Unknown"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{visit.doctor?.clinicAddress ?? visit.chemist?.address ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={13} />
                <span>{timeStr(visit.createdAt)}</span>
                {visit.durationMinutes !== null && <span>· {visit.durationMinutes} min</span>}
              </div>

              {(visit.startedAt || visit.endedAt) && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3">
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Call Started</p>
                    <p className="text-slate-700 mt-0.5">{visit.startedAt ? timeStr(visit.startedAt) : "—"}</p>
                    {visit.startLatitude !== null && visit.startLongitude !== null && (
                      <p className="text-slate-400 mt-0.5">{visit.startLatitude.toFixed(5)}, {visit.startLongitude.toFixed(5)}</p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Call Ended</p>
                    <p className="text-slate-700 mt-0.5">{visit.endedAt ? timeStr(visit.endedAt) : "—"}</p>
                    {!visit.locationUnavailable && (
                      <p className="text-slate-400 mt-0.5">{visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}</p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600"><span className="font-bold">Purpose:</span> {visit.purpose}</p>
              {visit.boxesPlaced !== null && (
                <p className="text-xs text-slate-600"><span className="font-bold">Boxes placed:</span> {visit.boxesPlaced}</p>
              )}

              {!visit.locationUnavailable && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin size={13} />
                  <span>{visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}</span>
                  <a
                    href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline font-semibold"
                  >
                    View on map
                  </a>
                </div>
              )}

              {visit.feedback && (
                <div className="flex gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
                  <FileText size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
                  <span>{visit.feedback}</span>
                </div>
              )}

              {visit.photoUrl && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Camera size={12} /> Photo
                  </p>
                  <img src={visit.photoUrl} alt="Visit proof" className="rounded-xl border border-slate-200 w-full max-h-64 object-cover" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
