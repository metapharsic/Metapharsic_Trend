"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileUp,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ExtractedLicenseData } from "@/services/license-parser.service";

interface LicenseAutoFillProps {
  customerType: "CHEMIST" | "DOCTOR" | "DISTRIBUTOR" | "HOSPITAL" | "EMPLOYEE";
  onExtracted: (data: ExtractedLicenseData) => void;
}

export function LicenseAutoFill({ customerType, onExtracted }: LicenseAutoFillProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [useMultiThread, setUseMultiThread] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedLicenseData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (customerType === "EMPLOYEE") {
    return null;
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customerTypeHint", customerType);
      formData.append("multiThread", String(useMultiThread));

      const res = await apiClient.post("/api/entities/license-extract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const extracted: ExtractedLicenseData = res.data.data.extracted;
      setResult(extracted);
      onExtracted(extracted);
    } catch (err: any) {
      console.error("[LicenseAutoFill] Extraction error:", err);
      const msg = err.response?.data?.error?.message || err.message || "Failed to parse license document";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleFill = async (sampleType: "CHEMIST" | "DOCTOR" | "DISTRIBUTOR") => {
    setError(null);
    setLoading(true);
    setFileName(`Sample_${sampleType}_License.txt`);

    let sampleText = "";
    if (sampleType === "CHEMIST") {
      sampleText = `GOVERNMENT OF TELANGANA\nDRUGS CONTROL ADMINISTRATION\nFORM 20 & 21\nLicence No: TS/HYD/2024/9912\nFirm Name: M/s Apollo Pharmacy Yakutpura\nProprietor: Mohammed Zubair, D.Pharm\nPremises: Shop 4, Station Road, Yakutpura, Hyderabad 500023\nGSTIN: 36AABCA1234F1Z5\nContact: 9849012345\nValid Up to: 31/12/2029`;
    } else if (sampleType === "DOCTOR") {
      sampleText = `DELHI MEDICAL COUNCIL REGISTRATION CERTIFICATE\nRegistration No: DMC/R/54321\nFull Name: Dr. Rajesh Verma\nQualification: MBBS, MD (General Medicine)\nClinic Address: Verma Health Clinic, B-42, Vikas Marg, Preet Vihar, New Delhi - 110092\nMobile: 9811223344\nValid Up to: 11/04/2031`;
    } else {
      sampleText = `FOOD AND DRUG ADMINISTRATION\nFORM 20B & 21B WHOLESALE DRUG LICENCE\nLicence No: MH-TZ4-246810\nTrade Name: M/s Medico Pharma Stockists\nPartner: Rajesh K. Patel\nAddress: Gala No. 12, Shreeji Commercial Complex, Thane West, Mumbai - 400601\nGSTIN: 27AABCM9876K1Z9\nValid Up to: 15/08/2028\nPhone: 9820011223`;
    }

    try {
      const res = await apiClient.post("/api/entities/license-extract", {
        text: sampleText,
        customerTypeHint: sampleType,
        multiThread: useMultiThread,
      });

      const extracted: ExtractedLicenseData = res.data.data.extracted;
      setResult(extracted);
      onExtracted(extracted);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to extract sample license");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-teal-50/80 via-white to-blue-50/60 border border-teal-200/80 rounded-2xl p-4 shadow-sm mb-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-600 text-white rounded-xl shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                License OCR & Auto-Fill
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                <Cpu size={10} /> Multi-Thread Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Upload customer Drug License (Form 20/21) or Medical Reg certificate to automatically populate form fields
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-teal-100 space-y-3">
          {/* Multi-thread toggle option */}
          <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-teal-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useMultiThread}
                onChange={(e) => setUseMultiThread(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 border-slate-300"
              />
              <span className="flex items-center gap-1.5">
                <Cpu size={13} className="text-teal-600" />
                Enable Multi-Threaded Worker Thread
              </span>
            </label>
            <span className="text-[10px] font-mono text-slate-400">
              {useMultiThread ? "Isolated OS Thread" : "Main Loop"}
            </span>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-teal-300 hover:border-teal-500 hover:bg-teal-50/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-white/60 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center gap-1.5">
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl group-hover:scale-105 transition-transform">
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <FileUp size={18} />}
              </div>
              <p className="text-xs font-bold text-slate-800">
                {loading ? "Processing License on Worker Thread..." : "Click or Drag & Drop License Document"}
              </p>
              <p className="text-[10px] text-slate-400">
                Supports Drug License image (JPEG, PNG, WebP), PDF, or scan certificate
              </p>
            </div>
          </div>

          {/* Quick sample fillers for fast field testing */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Fill:</span>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSampleFill("CHEMIST")}
              className="text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <FileCheck size={12} /> Chemist Form 20/21
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSampleFill("DOCTOR")}
              className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <FileCheck size={12} /> Doctor Medical Reg
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSampleFill("DISTRIBUTOR")}
              className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <FileCheck size={12} /> Wholesale Form 20B
            </button>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Extraction success banner */}
          {result && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Auto-filled from {fileName || "License"}
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                  {result.confidenceScore}% confidence · {result.processingTimeMs}ms (Thread #{result.workerThreadId})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-emerald-900 pt-1 border-t border-emerald-200/60 font-mono">
                {result.licenseNo && <div>DL: {result.licenseNo}</div>}
                {result.gstNo && <div>GST: {result.gstNo}</div>}
                {result.entityName && <div className="truncate">Name: {result.entityName}</div>}
                {result.contactPerson && <div className="truncate">Contact: {result.contactPerson}</div>}
                {result.validTill && <div>Valid Till: {result.validTill}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
