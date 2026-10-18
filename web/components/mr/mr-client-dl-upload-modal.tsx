"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Bot,
  Building2,
  MapPin,
  Calendar,
  Check,
  RotateCcw,
  Eye,
  Download,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";

interface ChemistOption {
  id: string;
  name: string;
  address?: string | null;
  licenseNo?: string | null;
  dlCopyUrl?: string | null;
  dlExpiryDate?: string | null;
  dlStatus?: string | null;
  beatName?: string | null;
}

interface AgentStep {
  agentCode: string;
  agentName: string;
  role: string;
  status: "VERIFIED" | "WARNING" | "FLAGGED" | "PASSED";
  confidenceScore: number;
  remarks: string;
  findings: Record<string, any>;
  timestamp: string;
}

interface MultiAgentResult {
  success: boolean;
  councilDecision: "APPROVED_AND_CERTIFIED" | "PROVISIONALLY_ACCEPTED" | "REJECTED";
  overallConfidenceScore: number;
  chemistId: string;
  chemistName: string;
  licenseNo: string;
  dlCopyUrl: string;
  expiryDate: string;
  statutoryForm: string;
  auditTrail: AgentStep[];
  governanceRemarks: string;
  verifiedAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedChemistId?: string;
  onSuccess?: () => void;
}

export function MrClientDlUploadModal({ isOpen, onClose, preselectedChemistId, onSuccess }: Props) {
  const [chemists, setChemists] = useState<ChemistOption[]>([]);
  const [loadingChemists, setLoadingChemists] = useState(false);
  const [selectedChemistId, setSelectedChemistId] = useState<string>(preselectedChemistId || "");

  const [licenseNo, setLicenseNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("2029-12-31");
  const [notes, setNotes] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [verificationResult, setVerificationResult] = useState<MultiAgentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load chemists when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingChemists(true);
      apiClient
        .get("/api/mr/entities?type=CHEMIST&limit=100")
        .then((res: any) => {
          const list =
            res?.data?.data?.entities ||
            res?.data?.entities ||
            res?.data?.chemists ||
            res?.entities ||
            [];
          setChemists(list);
          if (preselectedChemistId) {
            const found = list.find((c: any) => c.id === preselectedChemistId);
            if (found) {
              setSelectedChemistId(found.id);
              if (found.licenseNo) setLicenseNo(found.licenseNo);
              if (found.dlCopyUrl) setFilePreviewUrl(found.dlCopyUrl);
            }
          } else if (list.length > 0) {
            setSelectedChemistId(list[0].id);
            if (list[0].licenseNo) setLicenseNo(list[0].licenseNo);
            if (list[0].dlCopyUrl) setFilePreviewUrl(list[0].dlCopyUrl);
          }
        })
        .catch((err) => console.error("Failed to load chemists:", err))
        .finally(() => setLoadingChemists(false));
    } else {
      // Reset state
      setSelectedFile(null);
      setVerificationResult(null);
      setErrorMessage(null);
      setIsVerifying(false);
      setActiveAgentIndex(-1);
    }
  }, [isOpen, preselectedChemistId]);

  // When selected chemist changes, update prefilled data
  useEffect(() => {
    if (selectedChemistId) {
      const chem = chemists.find((c) => c.id === selectedChemistId);
      if (chem) {
        if (chem.licenseNo && !licenseNo) setLicenseNo(chem.licenseNo);
        if (chem.dlCopyUrl && !filePreviewUrl) setFilePreviewUrl(chem.dlCopyUrl);
      }
    }
  }, [selectedChemistId, chemists]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    }
  };

  const handleRunMultiAgentCouncil = async () => {
    if (!selectedChemistId) {
      setErrorMessage("Please select a Chemist client to upload the DL copy for.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setVerificationResult(null);

    // Simulate multi-agent deliberation stream animation
    setActiveAgentIndex(0);
    const timer1 = setTimeout(() => setActiveAgentIndex(1), 500);
    const timer2 = setTimeout(() => setActiveAgentIndex(2), 1000);
    const timer3 = setTimeout(() => setActiveAgentIndex(3), 1500);

    try {
      const formData = new FormData();
      formData.append("chemistId", selectedChemistId);
      if (licenseNo) formData.append("licenseNo", licenseNo);
      if (expiryDate) formData.append("expiryDate", expiryDate);
      if (notes) formData.append("notes", notes);
      if (selectedFile) formData.append("file", selectedFile);

      const authToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken") || localStorage.getItem("token") || ""
          : "";

      const res = await fetch("/api/mr/chemists/verify-dl-multiagent", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Multi-Agent verification failed");
      }

      setVerificationResult(data.data || data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during multi-agent verification");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsVerifying(false);
      setActiveAgentIndex(4);
    }
  };

  if (!isOpen) return null;

  const currentChemist = chemists.find((c) => c.id === selectedChemistId);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-purple-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-200 border border-white/10">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">MR Client Drug License (DL) Upload</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Multi-Agent Council
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Upload physical or digital DL copy received from client for autonomous statutory certification.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Verification Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Step 1: Select Chemist Client */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-purple-600" />
              1. Select Chemist Client *
            </label>
            <SearchableSelect
              options={chemists.map((c) => ({
                value: c.id,
                label: c.name,
                sublabel: c.address || c.beatName || "Retail Pharmacy",
                badge: c.licenseNo || "Form 20-B",
              }))}
              value={selectedChemistId}
              onValueChange={setSelectedChemistId}
              placeholder={loadingChemists ? "Loading chemists..." : "Search chemist pharmacy name..."}
              disabled={isVerifying || Boolean(preselectedChemistId)}
              dropdownClassName="z-[100] max-h-60 overflow-y-auto shadow-2xl"
            />

            {/* Quick Chemist Selection Pills */}
            {chemists.length > 0 && !preselectedChemistId && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-gray-400 font-semibold mr-1">Quick Pick:</span>
                {chemists.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedChemistId(c.id);
                      if (c.licenseNo) setLicenseNo(c.licenseNo);
                      if (c.dlCopyUrl) setFilePreviewUrl(c.dlCopyUrl);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      selectedChemistId === c.id
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {currentChemist && (
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-start justify-between text-xs">
                <div>
                  <p className="font-bold text-purple-950">{currentChemist.name}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="text-purple-500" />
                    {currentChemist.address || "Territory Beat Pharmacy"}
                  </p>
                </div>
                {currentChemist.licenseNo && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[11px] font-semibold shrink-0">
                    {currentChemist.licenseNo}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Upload DL File & Enter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-purple-600" />
                2. Drug License Number (Form 20-B/21-B)
              </label>
              <input
                type="text"
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value.toUpperCase())}
                placeholder="e.g. DL-20B-TG-2024-8100"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              <p className="text-[10px] text-gray-400">If left blank, Multi-Agent OCR extracts or generates canonical license code.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-purple-600" />
                Valid Upto (Expiry Date)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>

          {/* File Dropzone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Upload size={13} className="text-purple-600" />
              3. Upload DL Copy Received from Client
            </label>
            <div className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-2xl p-4 transition-colors">
              <input
                type="file"
                id="dl-file-input"
                accept="image/*,.pdf,.svg"
                onChange={handleFileChange}
                className="hidden"
                disabled={isVerifying}
              />
              <label htmlFor="dl-file-input" className="cursor-pointer flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
                  <Upload size={20} />
                </div>
                <p className="text-xs font-bold text-gray-800">
                  {selectedFile ? selectedFile.name : "Click to select or drag & drop DL Certificate Copy"}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Supports PNG, JPG, PDF or SVG (Max 10MB)</p>
              </label>
            </div>

            {filePreviewUrl && (
              <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs mt-2">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={15} className="text-purple-600 shrink-0" />
                  <span className="font-semibold text-gray-700 truncate">
                    {selectedFile ? selectedFile.name : "Existing DL Certificate on file"}
                  </span>
                </div>
                <a
                  href={filePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-semibold text-[11px] flex items-center gap-1 shrink-0"
                >
                  <Eye size={12} />
                  Preview
                </a>
              </div>
            )}
          </div>

          {/* Multi-Agent Deliberation Council Display */}
          {(isVerifying || verificationResult) && (
            <div className="p-4 bg-gradient-to-br from-purple-50 via-slate-50 to-indigo-50 border border-purple-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                    Multi-Agent Verification Council
                  </span>
                </div>
                {verificationResult ? (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {verificationResult.overallConfidenceScore}% Confidence • Certified
                  </span>
                ) : (
                  <span className="text-[11px] text-purple-600 font-semibold animate-pulse flex items-center gap-1">
                    <Sparkles size={12} />
                    Autonomous Agents Deliberating...
                  </span>
                )}
              </div>

              {/* Agent Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    code: "AGENT-DL-OCR",
                    name: "OCR & Document Authenticity Agent",
                    desc: "Parses Form 20-B/21-B headers, watermark, & registration",
                  },
                  {
                    code: "AGENT-DL-STATUTORY",
                    name: "Statutory Expiry & Regulatory Audit",
                    desc: "Checks Drugs & Cosmetics Act validity & Schedule C/C1 rules",
                  },
                  {
                    code: "AGENT-DL-TERRITORY",
                    name: "Client & Territory Consistency",
                    desc: "Validates beat jurisdiction & duplicate license prevention",
                  },
                  {
                    code: "AGENT-DL-GOVERNOR",
                    name: "Governance Council Governor",
                    desc: "Aggregates findings & issues official verification seal",
                  },
                ].map((agent, idx) => {
                  const stepData = verificationResult?.auditTrail.find((s) => s.agentCode === agent.code);
                  const isDone = Boolean(stepData);
                  const isProcessing = isVerifying && activeAgentIndex === idx;

                  return (
                    <div
                      key={agent.code}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isDone
                          ? "bg-white border-emerald-200 shadow-sm"
                          : isProcessing
                          ? "bg-purple-100/70 border-purple-300 ring-2 ring-purple-400/30 animate-pulse"
                          : "bg-gray-50/70 border-gray-200/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 truncate">{agent.name}</span>
                        {isDone ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Check size={10} />
                            {stepData?.confidenceScore}%
                          </span>
                        ) : isProcessing ? (
                          <span className="text-[10px] text-purple-700 font-bold">Scanning...</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        {stepData?.remarks || agent.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {verificationResult && (
                <div className="pt-2 text-xs text-purple-950 font-medium bg-white/80 p-3 rounded-xl border border-purple-200/60">
                  <p className="font-bold text-purple-900 mb-0.5">Council Verdict & Audit Seal:</p>
                  <p className="text-gray-700">{verificationResult.governanceRemarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {verificationResult ? "Close" : "Cancel"}
          </button>

          <div className="flex items-center gap-2">
            {verificationResult?.dlCopyUrl && (
              <a
                href={verificationResult.dlCopyUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download size={14} />
                Download Certificate
              </a>
            )}

            <button
              type="button"
              onClick={handleRunMultiAgentCouncil}
              disabled={isVerifying || !selectedChemistId}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              {isVerifying ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  Verifying with Council...
                </>
              ) : verificationResult ? (
                <>
                  <CheckCircle2 size={14} />
                  Re-Verify with Council
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Run Multi-Agent Verification
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
