"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Users,
  Sparkles,
  MapPin,
  Stethoscope,
  Edit3,
  Plus,
  Bot,
  Activity,
  AlertTriangle,
  ChevronRight,
  Save,
  X,
  RefreshCw,
  MessageSquare,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Share2,
  Lock,
  Trash2,
  Store,
  Building,
  Download,
  Printer,
  FileText,
  CheckSquare,
  Square,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SearchableSelect } from "@/components/searchable-select";
import {
  AgentTelemetry,
  DailyTourPlanEntry,
  TourPlanEvaluation,
} from "@/services/tour-plan-agents.service";

interface Territory {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
  primarySpecialty?: string;
  clinicAddress?: string;
  dpsScore?: number;
  dpsTier?: string;
  beatName?: string;
  subArea?: string;
}

interface Chemist {
  id: string;
  name: string;
  address?: string;
  subArea?: string;
  beatName?: string;
}

function decodeRole(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

export default function TourPlansDashboard() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<TourPlanEvaluation[]>([]);
  const [telemetry, setTelemetry] = useState<AgentTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Active view: 'OVERVIEW' | 'DAILY_SCHEDULE'
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "DAILY_SCHEDULE">("OVERVIEW");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Visit Filter: 'ALL' | 'DONE' | 'NOT_DONE' | 'PENDING'
  const [visitFilter, setVisitFilter] = useState<"ALL" | "DONE" | "NOT_DONE" | "PENDING">("ALL");
  const [updatingVisitId, setUpdatingVisitId] = useState<string | null>(null);

  // Daily Edit Modal state
  const [editingDay, setEditingDay] = useState<DailyTourPlanEntry | null>(null);
  const [editTerritoryId, setEditTerritoryId] = useState<string>("");
  const [editDoctorId, setEditDoctorId] = useState<string>("");
  const [editEntityType, setEditEntityType] = useState<"DOCTOR" | "CHEMIST">("DOCTOR");
  const [editChemistId, setEditChemistId] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  // Territory & Doctor Master Lists for Editing
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctorsByTerritory, setDoctorsByTerritory] = useState<Record<string, Doctor[]>>({});
  const [chemistsByTerritory, setChemistsByTerritory] = useState<Record<string, Chemist[]>>({});

  // Medicine Placement Modal state (triggered on Doctor call completed)
  const [medicineModalDay, setMedicineModalDay] = useState<DailyTourPlanEntry | null>(null);
  const [placementType, setPlacementType] = useState<"NEAREST_CHEMIST" | "DOCTOR_DESIGNATED_CHEMIST" | "IN_HOUSE">("NEAREST_CHEMIST");
  const [selectedChemistId, setSelectedChemistId] = useState<string>("");
  const [customChemistName, setCustomChemistName] = useState<string>("");
  const [placementNotes, setPlacementNotes] = useState<string>("");
  const [placementSaving, setPlacementSaving] = useState(false);

  // Add / Append Tour Day Modal state
  const [addingDay, setAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState<string>("");
  const [newDayTerritoryId, setNewDayTerritoryId] = useState<string>("");
  const [newDayDoctorId, setNewDayDoctorId] = useState<string>("");
  const [newDayEntityType, setNewDayEntityType] = useState<"DOCTOR" | "CHEMIST">("DOCTOR");
  const [newDayChemistId, setNewDayChemistId] = useState<string>("");
  const [newDaySaving, setNewDaySaving] = useState(false);

  // Delete Individual Tour Day state
  const [deletingDay, setDeletingDay] = useState<DailyTourPlanEntry | null>(null);
  const [deletingDaySaving, setDeletingDaySaving] = useState(false);

  // WhatsApp Vote Modal state
  const [whatsAppModalPlan, setWhatsAppModalPlan] = useState<any | null>(null);
  const [whatsAppVoteText, setWhatsAppVoteText] = useState<string>("");
  const [whatsAppShareUrl, setWhatsAppShareUrl] = useState<string>("");
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [copiedVote, setCopiedVote] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  // MR Fleet and Selection state
  interface MREmployee {
    id: string;
    name: string;
    email: string;
    territoryName: string;
  }
  const [mrEmployees, setMrEmployees] = useState<MREmployee[]>([]);
  const [selectedMrId, setSelectedMrId] = useState<string>("ALL");

  // Dynamic Working Days Calculator (Calendar days in selected month minus Sundays) - 0 Hardcoding
  const dynamicWorkingDays = React.useMemo(() => {
    try {
      const [y, m] = selectedMonth.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      let workingDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (new Date(y, m - 1, day).getDay() !== 0) {
          workingDays++;
        }
      }
      return workingDays; // e.g. 27 for October 2026
    } catch {
      return 27;
    }
  }, [selectedMonth]);

  // Delete Plan Modal state
  const [deletingPlan, setDeletingPlan] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1-Day Plan Modal state (with Doctor & Chemist Clubbing)
  const [showSingleDayModal, setShowSingleDayModal] = useState(false);
  const [singleDayDate, setSingleDayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [singleDayTerritoryId, setSingleDayTerritoryId] = useState<string>("");
  const [singleDayBeatName, setSingleDayBeatName] = useState<string>("");
  const [singleDayDoctorIds, setSingleDayDoctorIds] = useState<string[]>([]);
  const [singleDayChemistIds, setSingleDayChemistIds] = useState<string[]>([]);
  const [singleDayNotes, setSingleDayNotes] = useState<string>("");
  const [singleDaySaving, setSingleDaySaving] = useState(false);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");
  const [chemistSearchTerm, setChemistSearchTerm] = useState("");

  // Download & Print Modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"TODAY" | "ALL">("TODAY");
  const [targetPrintDate, setTargetPrintDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Field Readiness state
  const [fieldReadiness, setFieldReadiness] = useState<any | null>(null);

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/sfa/tour-plan/${deletingPlan.id}`);
      if (selectedPlanId === deletingPlan.id) {
        setSelectedPlanId(null);
        setActiveTab("OVERVIEW");
      }
      setDeletingPlan(null);
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete tour plan");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadData = (monthStr = selectedMonth, autoProv = false, mrFilter = selectedMrId) => {
    setLoading(true);
    apiClient
      .get("/api/sfa/tour-plan", {
        params: {
          month: monthStr,
          autoProvision: autoProv,
          employeeId: mrFilter !== "ALL" ? mrFilter : undefined,
        },
      })
      .then((res) => {
        const fetchedPlans = res.data.data.tourPlans || [];
        setPlans(fetchedPlans);
        const evals: TourPlanEvaluation[] = res.data.data.evaluations || [];
        setEvaluations(evals);
        setTelemetry(res.data.data.agentTelemetry || []);
        if (res.data.data.mrEmployees) {
          setMrEmployees(res.data.data.mrEmployees);
        }

        if (evals.length > 0) {
          if (!selectedPlanId || !evals.some((e) => e.id === selectedPlanId)) {
            setSelectedPlanId(evals[0].id);
          }
        } else {
          setSelectedPlanId(null);
        }
      })
      .catch((err) => console.error("Failed to load tour plans:", err))
      .finally(() => setLoading(false));
  };

  const handleProvision27DayPlan = async (targetEmpId?: string) => {
    setProvisioning(true);
    try {
      if (!targetEmpId || targetEmpId === "ALL") {
        await apiClient.post("/api/sfa/tour-plan/provision", {
          month: selectedMonth,
          provisionAll: true,
          overwrite: true,
        });
      } else {
        await apiClient.post("/api/sfa/tour-plan/provision", {
          employeeId: targetEmpId,
          month: selectedMonth,
          overwrite: true,
        });
      }
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      console.error("Failed to provision 27-day tour plan:", err);
      alert(err?.response?.data?.error?.message || err?.message || "Failed to provision tour plan");
    } finally {
      setProvisioning(false);
    }
  };

  const handleCreateSingleDayPlan = async () => {
    if (!singleDayDate || !singleDayTerritoryId) {
      alert("Please select a date and territory.");
      return;
    }
    setSingleDaySaving(true);
    try {
      const targetEmpId = selectedMrId !== "ALL" ? selectedMrId : (selectedEvaluation?.employeeId || undefined);
      await apiClient.post("/api/sfa/tour-plan/single-day", {
        employeeId: targetEmpId,
        date: singleDayDate,
        territoryId: singleDayTerritoryId,
        beatName: singleDayBeatName || null,
        doctorIds: singleDayDoctorIds,
        chemistIds: singleDayChemistIds,
        notes: singleDayNotes || null,
      });
      setShowSingleDayModal(false);
      setSingleDayDoctorIds([]);
      setSingleDayChemistIds([]);
      setSingleDayNotes("");
      loadData(selectedMonth, false, selectedMrId);
      setActiveTab("DAILY_SCHEDULE");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to create single day schedule");
    } finally {
      setSingleDaySaving(false);
    }
  };

  const openAppendDayModal = () => {
    let nextDateStr = new Date().toISOString().slice(0, 10);
    if (selectedEvaluation && selectedEvaluation.days.length > 0) {
      const dates = selectedEvaluation.days.map((d) => d.date).sort();
      const lastDate = new Date(dates[dates.length - 1]);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 1);
      if (nextDate.getDay() === 0) {
        // Skip Sunday
        nextDate.setDate(nextDate.getDate() + 1);
      }
      nextDateStr = nextDate.toISOString().slice(0, 10);
    }
    setSingleDayDate(nextDateStr);
    const terrId = selectedEvaluation?.territoryId || territories[0]?.id || "";
    setSingleDayTerritoryId(terrId);
    setSingleDayDoctorIds([]);
    setSingleDayChemistIds([]);
    setSingleDayNotes("");
    if (terrId) {
      loadDoctorsForTerritory(terrId);
      loadChemistsForTerritory(terrId);
    }
    setShowSingleDayModal(true);
  };

  const handlePrintSchedule = () => {
    window.print();
  };

  const handleDownloadHtmlSchedule = () => {
    if (!selectedEvaluation) return;
    const targetDate = downloadMode === "TODAY" ? targetPrintDate : null;
    const daysToInclude = targetDate
      ? selectedEvaluation.days.filter((d) => d.date === targetDate)
      : selectedEvaluation.days.filter((d) => !d.isSunday);

    const docCount = daysToInclude.filter((d) => d.entityType !== "CHEMIST" && d.plannedDoctorId).length;
    const chemCount = daysToInclude.filter((d) => d.entityType === "CHEMIST").length;
    const doneCount = daysToInclude.filter((d) => d.visitStatus === "DONE" || d.isCompleted).length;

    const rows = daysToInclude
      .map((d, i) => {
        const isChem = d.entityType === "CHEMIST";
        const name = isChem
          ? d.plannedChemistName || "Retail Chemist"
          : d.plannedDoctorName || "Doctor Visit";
        const details = isChem
          ? d.chemistAddress || d.subArea || "Chemist Outlet"
          : [d.doctorSpecialty, d.doctorDpsTier].filter(Boolean).join(" • ") || "Practitioner";
        const loc = [d.beatName, d.territoryName].filter(Boolean).join(" · ");
        const isDone = d.visitStatus === "DONE" || d.isCompleted;

        return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${isDone ? "background-color: #f0fdf4;" : ""}">
          <td style="padding: 10px 8px; text-align: center; font-weight: bold; width: 40px;">${i + 1}</td>
          <td style="padding: 10px 8px; text-align: center; width: 70px;">
            <span style="display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; ${
              isChem
                ? "background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe;"
                : "background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc;"
            }">
              ${isChem ? "CHEMIST" : "DOCTOR"}
            </span>
          </td>
          <td style="padding: 10px 8px;">
            <div style="font-weight: bold; color: #0f172a;">${name}</div>
            <div style="font-size: 11px; color: #64748b;">${details}</div>
          </td>
          <td style="padding: 10px 8px; font-size: 12px; color: #334155;">${loc}</td>
          <td style="padding: 10px 8px; text-align: center; width: 90px;">
            <div style="width: 22px; height: 22px; border: 2px solid #334155; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto; ${
              isDone ? "background: #059669; color: white; border-color: #059669;" : "background: white;"
            }">
              ${isDone ? "✓" : ""}
            </div>
            <div style="font-size: 9px; font-weight: bold; color: ${
              isDone ? "#059669" : "#64748b"
            }; margin-top: 2px;">
              ${isDone ? "COMPLETED" : "CALL DONE [ ]"}
            </div>
          </td>
          <td style="padding: 10px 8px; font-size: 11px; color: #64748b; width: 100px; text-align: center;">
            ___ : ___ In<br>___ : ___ Out
          </td>
          <td style="padding: 10px 8px; font-size: 11px; color: #475569; width: 140px;">
            ${
              d.completionNotes
                ? d.completionNotes.replace(/<!--.*?-->/g, "").trim()
                : '<span style="color: #cbd5e1;">[ Rx / Sample / Stock Notes ]</span>'
            }
          </td>
          <td style="padding: 10px 8px; width: 100px; text-align: center; border-left: 1px dashed #cbd5e1;">
            <span style="font-size: 9px; color: #94a3b8;">Stamp / Sign</span>
          </td>
        </tr>
      `;
      })
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MR Field Schedule - ${selectedEvaluation.employeeName} - ${targetDate || selectedEvaluation.month}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #0f172a; font-size: 13px; line-height: 1.4; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none !important; }
      @page { size: A4 portrait; margin: 10mm; }
    }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px; border-bottom: 2px solid #cbd5e1; }
  </style>
</head>
<body>
  <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">METAPHARSIC PHARMACEUTICALS</h1>
        <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #0284c7; text-transform: uppercase; letter-spacing: 1px;">
          Trend MR SFA — Official Field Call Schedule & Execution Sheet
        </p>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 9999px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
          APPROVED FIELD ROSTER
        </span>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${targetDate || selectedEvaluation.month}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-top: 14px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
      <div><span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Field Representative</span><strong>${selectedEvaluation.employeeName}</strong></div>
      <div><span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">HQ / Corridor</span><strong>${selectedEvaluation.territoryName || "General Area"}</strong></div>
      <div><span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Planned Calls</span><strong>${docCount} Doctors + ${chemCount} Chemists (${docCount + chemCount} Total)</strong></div>
      <div><span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block;">Execution Progress</span><strong style="color: #047857;">${doneCount}/${daysToInclude.length} Completed</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th style="width: 70px;">Type</th>
        <th>Doctor / Chemist Visit Details</th>
        <th>Beat & Location</th>
        <th style="width: 90px; text-align: center;">Completed</th>
        <th style="width: 100px; text-align: center;">Time Log</th>
        <th style="width: 140px;">Clinical Rx / Order Notes</th>
        <th style="width: 100px; text-align: center;">Chemist / Dr Sign</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px;">
    <div>
      <p style="margin: 0; color: #64748b;">Notice: Check off calls upon completion. Submit signed sheet or sync online before 8:00 PM.</p>
      <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 10px;">Generated via Metapharsic Trend MR Multi-Agent SFA Engine · Print-Ready Checkbox Form</p>
    </div>
    <div style="display: flex; gap: 40px; text-align: center;">
      <div>
        <div style="width: 140px; border-bottom: 1px solid #334155; margin-bottom: 4px; height: 30px;"></div>
        <span style="font-weight: bold; color: #334155;">MR Field Signature</span>
      </div>
      <div>
        <div style="width: 140px; border-bottom: 1px solid #334155; margin-bottom: 4px; height: 30px;"></div>
        <span style="font-weight: bold; color: #334155;">ASM Verification Stamp</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MR_Field_Schedule_${selectedEvaluation.employeeName.replace(/\s+/g, "_")}_${
      targetDate || selectedEvaluation.month
    }.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setRole(decodeRole());
    loadData(selectedMonth, false, selectedMrId);

    // Fetch master territories for editing
    apiClient
      .get("/api/mr/territories")
      .then((res) => {
        const list = res.data.data.territories || [];
        setTerritories(list);
        if (list.length > 0 && !singleDayTerritoryId) {
          setSingleDayTerritoryId(list[0].id);
          loadDoctorsForTerritory(list[0].id);
          loadChemistsForTerritory(list[0].id);
        }
      })
      .catch((err) => console.error("Failed to load territories:", err));

    // Check field readiness for today
    apiClient
      .get("/api/sfa/tour-plan/readiness")
      .then((res) => {
        if (res.data?.success) setFieldReadiness(res.data.data);
      })
      .catch(() => {});

    // Inspect URL query params for ?tab=DAILY_SCHEDULE&date=YYYY-MM-DD
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "DAILY_SCHEDULE") {
        setActiveTab("DAILY_SCHEDULE");
      }
      const dateParam = params.get("date");
      if (dateParam) {
        setSingleDayDate(dateParam);
        setTargetPrintDate(dateParam);
        if (params.get("action") === "create_day") {
          setShowSingleDayModal(true);
        }
      }
    }
  }, [selectedMonth]);

  const loadDoctorsForTerritory = async (territoryId: string) => {
    if (!territoryId || doctorsByTerritory[territoryId]) return;
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "DOCTOR", territoryId, limit: 100 },
      });
      const docs = (res.data.data.entities || []).map((e: any) => ({
        id: e.id,
        fullName: e.name || e.fullName,
        primarySpecialty: e.primarySpecialty,
        clinicAddress: e.clinicAddress,
        dpsTier: e.dpsTier,
        beatName: e.beatName,
        subArea: e.subArea,
      }));
      setDoctorsByTerritory((prev) => ({ ...prev, [territoryId]: docs }));
    } catch (err) {
      console.error("Failed to load doctors for territory:", err);
    }
  };

  const loadChemistsForTerritory = async (territoryId: string) => {
    if (!territoryId || chemistsByTerritory[territoryId]) return;
    try {
      const res = await apiClient.get("/api/mr/entities", {
        params: { type: "CHEMIST", territoryId, limit: 100 },
      });
      const chems = (res.data.data.entities || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        address: e.address,
        subArea: e.subArea,
        beatName: e.beatName,
      }));
      setChemistsByTerritory((prev) => ({ ...prev, [territoryId]: chems }));
    } catch (err) {
      console.error("Failed to load chemists for territory:", err);
    }
  };

  const handleProvisionDB = async () => {
    setProvisioning(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/provision", {
        month: selectedMonth,
        overwrite: true,
      });
      loadData(selectedMonth, false);
    } catch (err) {
      console.error("Failed to provision tour plan:", err);
    } finally {
      setProvisioning(false);
    }
  };

  const decide = async (planId: string, action: "approve" | "reject") => {
    setBusyId(planId);
    try {
      await apiClient.post(`/api/sfa/tour-plan/${action}`, { tourPlanId: planId });
      loadData(selectedMonth, false);
    } catch (err) {
      console.error(`Failed to ${action} tour plan:`, err);
    } finally {
      setBusyId(null);
    }
  };

  const openDayEditor = (day: DailyTourPlanEntry) => {
    setEditingDay(day);
    setEditTerritoryId(day.territoryId);
    if (day.entityType === "CHEMIST") {
      setEditEntityType("CHEMIST");
      setEditChemistId(day.plannedChemistId || "");
      setEditDoctorId("");
    } else {
      setEditEntityType("DOCTOR");
      setEditDoctorId(day.plannedDoctorId || "");
      setEditChemistId("");
    }
    if (day.territoryId) {
      loadDoctorsForTerritory(day.territoryId);
      loadChemistsForTerritory(day.territoryId);
    }
  };

  const saveDayEdit = async () => {
    if (!editingDay || !selectedPlanId || !editTerritoryId) return;
    setEditSaving(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/update-day", {
        tourPlanId: selectedPlanId,
        dayId: editingDay.id,
        territoryId: editTerritoryId,
        entityType: editEntityType,
        plannedDoctorId: editEntityType === "DOCTOR" ? (editDoctorId || null) : null,
        plannedChemistId: editEntityType === "CHEMIST" ? (editChemistId || null) : null,
      });
      setEditingDay(null);
      loadData(selectedMonth, false, selectedMrId);
    } catch (err) {
      console.error("Failed to update daily tour plan entry:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleVisitStatus = async (
    day: DailyTourPlanEntry,
    targetStatus: "DONE" | "NOT_DONE" | "PENDING"
  ) => {
    // If marking as DONE and day is a doctor visit, prompt the Medicine Placement dialog!
    if (targetStatus === "DONE" && day.entityType !== "CHEMIST" && (day.plannedDoctorId || day.plannedDoctorName)) {
      setMedicineModalDay(day);
      setPlacementType("NEAREST_CHEMIST");
      setSelectedChemistId("");
      setCustomChemistName("");
      setPlacementNotes(day.completionNotes || "");
      if (day.territoryId) {
        loadChemistsForTerritory(day.territoryId);
      }
      return;
    }

    setUpdatingVisitId(day.id);
    try {
      await apiClient.post("/api/sfa/tour-plan/toggle-visit", {
        dayId: day.id,
        status: targetStatus,
      });
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to update visit status");
    } finally {
      setUpdatingVisitId(null);
    }
  };

  const handleConfirmMedicinePlacement = async () => {
    if (!medicineModalDay) return;
    setPlacementSaving(true);
    try {
      const territoryChemists = chemistsByTerritory[medicineModalDay.territoryId] || [];
      const chosenChemist = territoryChemists.find((c) => c.id === selectedChemistId) || territoryChemists[0];

      let chemistName = "";
      if (placementType === "IN_HOUSE") {
        chemistName = "In-House Clinic / Dispensing Pharmacy";
      } else if (placementType === "DOCTOR_DESIGNATED_CHEMIST") {
        chemistName = customChemistName || chosenChemist?.name || "Doctor Designated Chemist";
      } else {
        chemistName = chosenChemist?.name || "Nearest Territory Chemist";
      }

      await apiClient.post("/api/sfa/tour-plan/toggle-visit", {
        dayId: medicineModalDay.id,
        status: "DONE",
        notes: placementNotes,
        medicinePlacement: {
          type: placementType,
          chemistId: placementType === "IN_HOUSE" ? null : (selectedChemistId || chosenChemist?.id || null),
          chemistName,
          notes: placementNotes,
        },
      });
      setMedicineModalDay(null);
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to complete visit with medicine placement");
    } finally {
      setPlacementSaving(false);
    }
  };

  const handleAddDay = async () => {
    if (!selectedPlanId || !newDayDate || !newDayTerritoryId) return;
    setNewDaySaving(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/update-day", {
        action: "add",
        tourPlanId: selectedPlanId,
        date: newDayDate,
        territoryId: newDayTerritoryId,
        entityType: newDayEntityType,
        plannedDoctorId: newDayEntityType === "DOCTOR" ? (newDayDoctorId || null) : null,
        plannedChemistId: newDayEntityType === "CHEMIST" ? (newDayChemistId || null) : null,
      });
      setAddingDay(false);
      setNewDayDate("");
      setNewDayDoctorId("");
      setNewDayChemistId("");
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to add tour day");
    } finally {
      setNewDaySaving(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!deletingDay || !selectedPlanId) return;
    setDeletingDaySaving(true);
    try {
      await apiClient.post("/api/sfa/tour-plan/update-day", {
        action: "delete",
        tourPlanId: selectedPlanId,
        dayId: deletingDay.id,
      });
      setDeletingDay(null);
      loadData(selectedMonth, false, selectedMrId);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete day entry");
    } finally {
      setDeletingDaySaving(false);
    }
  };

  const openWhatsAppModal = async (plan: any) => {
    setWhatsAppModalPlan(plan);
    setWhatsAppLoading(true);
    setCopiedVote(false);
    setDispatchStatus(null);
    try {
      const res = await apiClient.get("/api/sfa/tour-plan/whatsapp-vote", {
        params: { tourPlanId: plan.id },
      });
      setWhatsAppVoteText(res.data.data.message);
      setWhatsAppShareUrl(res.data.data.shareUrl);
    } catch (err) {
      console.error("Failed to load Metapharsic-MR Group message:", err);
      setWhatsAppVoteText("Error generating Metapharsic-MR Group roadmap. Please try again.");
    } finally {
      setWhatsAppLoading(false);
    }
  };

  const handleCopyVoteText = () => {
    if (!whatsAppVoteText) return;
    navigator.clipboard.writeText(whatsAppVoteText);
    setCopiedVote(true);
    setTimeout(() => setCopiedVote(false), 2500);
  };

  const handleDispatchWhatsAppNotifications = async () => {
    if (!whatsAppModalPlan) return;
    setDispatchStatus("Dispatching to Metapharsic-MR Group and notifying MR...");
    try {
      const res = await apiClient.post("/api/sfa/tour-plan/whatsapp-vote", {
        tourPlanId: whatsAppModalPlan.id,
      });
      setDispatchStatus(`Successfully logged dispatch to Metapharsic-MR Group & notified fleet!`);
    } catch (err) {
      console.error("Failed to dispatch to Metapharsic-MR Group:", err);
      setDispatchStatus("Error dispatching to Metapharsic-MR Group.");
    }
  };

  const isManager = role === "ASM" || role === "ADMIN" || role === "MD";
  const isAdmin = role === "ADMIN" || role === "MD";
  const isMR = role === "MR";

  const selectedEvaluation = evaluations.find((e) => e.id === selectedPlanId) || evaluations[0];

  const pendingCount = plans.filter((p) => p.status === "PENDING_ASM").length;
  const approvedCount = plans.filter((p) => p.status === "APPROVED").length;
  const totalCalls = evaluations.reduce((sum, e) => sum + e.summary.totalDoctorCalls, 0);
  const avgEfficiency = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.summary.averageRouteEfficiency, 0) / evaluations.length)
    : 88;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-sky-50 via-white to-blue-50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-slate-900">
              Tour Plans & Multi-Agent Daily Scheduler
            </h1>
            <span className="bg-sky-100 text-sky-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-sky-200">
              Live DB Synced
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Provision, optimize, and edit daily tour schedules backed by multi-agent route and CRM targeting models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Representative Fleet Filter */}
          {isManager && mrEmployees.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2 py-1 shadow-sm">
              <Users size={15} className="text-sky-600 shrink-0 ml-1" />
              <SearchableSelect
                value={selectedMrId}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  setSelectedMrId(newFilter);
                  loadData(selectedMonth, false, newFilter);
                }}
                searchPlaceholder="Search MR name or territory..."
                buttonClassName="border-0 shadow-none px-2 py-1 text-xs font-bold text-slate-800"
              >
                <option value="ALL">All MRs Fleet ({mrEmployees.length})</option>
                {mrEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.territoryName}
                  </option>
                ))}
              </SearchableSelect>
            </div>
          )}

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white shadow-sm"
          />

          {isManager && (
            <button
              onClick={() => handleProvision27DayPlan(selectedMrId)}
              disabled={provisioning}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
              title="Auto-provision complete 27-day monthly tour plan (excluding Sundays)"
            >
              <Sparkles size={15} className={provisioning ? "animate-spin" : ""} />
              <span>
                {provisioning
                  ? "Provisioning..."
                  : selectedMrId === "ALL"
                  ? "Provision 27 Days (All MRs)"
                  : "Provision 27 Days (Selected MR)"}
              </span>
            </button>
          )}

          {isMR && (
            <button
              onClick={() => router.push("/tour-plans/new")}
              className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
            >
              <Plus size={16} />
              Create Plan
            </button>
          )}
        </div>
      </div>

      {/* Multi-Agent Telemetry Status Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="text-sky-600" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Multi-Agent Tour Intelligence Status
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Agents Active: 4/4 | Model: Real-Time DB Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {telemetry.length > 0 ? (
            telemetry.map((agent, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-sky-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 truncate">{agent.name}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{agent.role}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600">
                  <span>Latency: {agent.latencyMs}ms</span>
                  <span>Conf: {Math.round(agent.confidence * 100)}%</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-4 bg-white p-4 rounded-xl text-center text-xs text-slate-400 border border-slate-200">
              Loading multi-agent execution status...
            </div>
          )}
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile icon={Clock} label="Pending Approvals" value={String(pendingCount)} tone="warn" />
        <KpiTile icon={CheckCircle2} label="Approved Plans" value={String(approvedCount)} tone="good" />
        <KpiTile icon={CalendarDays} label="Planned Calls" value={String(totalCalls)} tone="sky" />
        <KpiTile icon={Activity} label="Avg Route Efficiency" value={`${avgEfficiency}%`} tone="emerald" />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "OVERVIEW"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>Monthly Tour Plans ({plans.length})</span>
            {plans.length === 1 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Option Available
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("DAILY_SCHEDULE")}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "DAILY_SCHEDULE"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>Daily Schedule Editor</span>
            <span className="bg-sky-100 text-sky-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {selectedEvaluation ? `${new Set(selectedEvaluation.days.map((d) => d.date)).size} Days Active` : `1-Day / On-Demand`}
            </span>
          </button>
        </div>

        {/* Quick Options Bar for Tour Plans & Daily Schedules */}
        <div className="pb-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-semibold">Quick Options:</span>
          <button
            onClick={openAppendDayModal}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-xl font-bold text-xs shadow-2xs transition-colors"
            title="Create or append a 1-day field schedule clubbing doctors and chemists"
          >
            <Plus size={13} />
            <span>Plan 1-Day Schedule</span>
          </button>
          {selectedEvaluation && (
            <button
              onClick={() => setShowDownloadModal(true)}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-3 py-1 rounded-xl font-bold text-xs shadow-2xs transition-colors"
              title="Download or print field-ready schedule with checkboxes for offline/on-field check-off"
            >
              <Printer size={13} className="text-slate-600" />
              <span>Download / Print Schedule</span>
            </button>
          )}
          {activeTab === "OVERVIEW" && isManager && (
            <button
              onClick={() => handleProvision27DayPlan("ALL")}
              disabled={provisioning}
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl font-bold text-xs shadow-2xs transition-colors disabled:opacity-50"
              title={`Optional: Auto-provision full month (${dynamicWorkingDays} days) working schedule for all fleet representatives`}
            >
              <Sparkles size={13} className="text-emerald-600" />
              <span>Auto-Provision Full Month ({dynamicWorkingDays}d)</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: OVERVIEW TABLE */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-4">
          {/* Fleet Unscheduled Notice Banner */}
          {isManager && mrEmployees.length > 0 && (() => {
            const planEmpIds = new Set(plans.map((p) => p.employee?.id || p.employeeId));
            const unprovisioned = mrEmployees.filter((emp) => !planEmpIds.has(emp.id));
            if (unprovisioned.length === 0) return null;

            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 font-bold">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Fleet Tour Schedule Notice ({unprovisioned.length} MRs Unscheduled)
                    </h3>
                    <p className="text-xs text-amber-800">
                      {unprovisioned.map((u) => u.name).join(", ")} do not have an active 27-day working tour schedule for {new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.
                    </p>
                  </div>
                </div>

                <button
                  disabled={provisioning}
                  onClick={() => handleProvision27DayPlan("ALL")}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  <span>Auto-Provision 27 Days for All ({unprovisioned.length})</span>
                </button>
              </div>
            );
          })()}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold">Employee</th>
                  <th className="px-6 py-3 font-semibold">Territory</th>
                  <th className="px-6 py-3 font-semibold">Month</th>
                  <th className="px-6 py-3 font-semibold">Doctor Calls / Days</th>
                  <th className="px-6 py-3 font-semibold">Route Score</th>
                  <th className="px-6 py-3 font-semibold">Compliance</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p className="text-slate-500 font-medium">No tour plans found for this month.</p>
                      <button
                        onClick={() => handleProvision27DayPlan(selectedMrId)}
                        className="mt-3 inline-flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-2 rounded-lg border border-emerald-200 hover:bg-emerald-100"
                      >
                        <Sparkles size={14} /> Provision 27-Day Plan from Database
                      </button>
                    </td>
                  </tr>
                )}
                {plans.map((plan) => {
                  const evalData = evaluations.find((e) => e.id === plan.id);
                  const planTerritories: string[] = Array.from(
                    new Set(
                      (evalData?.territories?.length ? evalData.territories : plan.days?.map((d: any) => d.territory?.name).filter(Boolean)) ?? []
                    )
                  );
                  const displayTerritories = planTerritories.length > 0 ? planTerritories : [
                    evalData?.territoryName || plan.employee?.territories?.map((t: any) => t.name).join(", ") || plan.days?.[0]?.territory?.name || "General Territory"
                  ];
                  const workingDaysCount = evalData?.days.length ?? plan.days.length;

                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">
                          {plan.employee.firstName} {plan.employee.lastName}
                        </p>
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                          <CalendarDays size={11} /> {workingDaysCount} Days MR
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {displayTerritories.slice(0, 2).map((t) => (
                              <span key={t} className="inline-flex items-center gap-1 font-semibold text-slate-800 text-xs bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-md">
                                <MapPin size={11} className="text-sky-500 shrink-0" />
                                {t}
                              </span>
                            ))}
                            {displayTerritories.length > 2 && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title={displayTerritories.slice(2).join(", ")}>
                                +{displayTerritories.length - 2} more
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Field Visit Territories</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {new Date(plan.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <Users size={14} className="text-slate-400" />
                            {evalData?.summary.totalDoctorCalls ?? plan.days.filter((d: any) => d.plannedDoctor).length} Calls
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            across {workingDaysCount} working days
                          </span>
                        </div>
                      </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">
                      {evalData?.summary.averageRouteEfficiency ?? 85}%
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {evalData?.summary.complianceScore ?? 90}%
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase
                        ${
                          plan.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : plan.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isAdmin && plan.status === "APPROVED"
                          ? "EXECUTIVE AUTHORIZED"
                          : plan.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {plan.status === "APPROVED" ? (
                        <button
                          onClick={() => openWhatsAppModal(plan)}
                          className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg transition-colors font-bold text-xs shadow-xs"
                          title="Send Approved Roadmap to Metapharsic-MR Group"
                        >
                          <Share2 size={13} className="text-emerald-600" />
                          Metapharsic-MR Group
                        </button>
                      ) : (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-xs opacity-60 cursor-not-allowed"
                          title="Tour Plan must be approved before sending to Metapharsic-MR Group"
                        >
                          <Share2 size={13} />
                          Group (Pending Approval)
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          setActiveTab("DAILY_SCHEDULE");
                        }}
                        className="inline-flex items-center gap-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-3 py-1.5 rounded-lg transition-colors font-bold text-xs shadow-xs"
                        title="Open Daily Schedule Editor for this representative"
                      >
                        <CalendarDays size={13} className="text-sky-600" />
                        <span>Daily Schedule ({evalData?.days.length ?? plan.days.length}d MR)</span>
                      </button>

                      {isManager && plan.status === "PENDING_ASM" && (
                        <>
                          <button
                            disabled={busyId === plan.id}
                            onClick={() => decide(plan.id, "approve")}
                            className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-emerald-200 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === plan.id}
                            onClick={() => decide(plan.id, "reject")}
                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold text-xs border border-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Delete Plan Action: Admin/MD can delete ANY plan (even for MRs); MR can delete DRAFT */}
                      {(isAdmin || (role === "MR" && plan.status === "DRAFT")) && (
                        <button
                          disabled={busyId === plan.id}
                          onClick={() => setDeletingPlan(plan)}
                          className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors font-semibold text-xs shadow-xs"
                          title={isAdmin ? "Admin Override: Delete Tour Plan" : "Delete Draft Tour Plan"}
                        >
                          <Trash2 size={13} className="text-red-600" />
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY SCHEDULE & EDITABLE MATRIX */}
      {activeTab === "DAILY_SCHEDULE" && !selectedEvaluation && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl mx-auto flex items-center justify-center">
            <CalendarDays size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Daily Schedule Editor — Start with 1 Day & Append
            </h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
              Create a focused 1-day field schedule clubbing target doctors and retail chemists for complete beat coverage. You can append days one by one as your field visits progress, or optionally auto-provision an entire month.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={openAppendDayModal}
              className="inline-flex items-center gap-2 bg-sky-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-700 shadow-sm transition-colors"
            >
              <Plus size={14} />
              <span>Create 1-Day Schedule (Clubbed Doctors & Chemists)</span>
            </button>

            {isManager && mrEmployees.length > 0 && (
              <SearchableSelect
                value={selectedMrId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMrId(val);
                  loadData(selectedMonth, false, val);
                }}
                className="w-auto min-w-[220px]"
                searchPlaceholder="Search MR name or territory..."
              >
                <option value="ALL">All MRs Fleet ({mrEmployees.length})</option>
                {mrEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.territoryName}
                  </option>
                ))}
              </SearchableSelect>
            )}

            {isManager && (
              <button
                onClick={() => handleProvision27DayPlan(selectedMrId !== "ALL" ? selectedMrId : undefined)}
                disabled={provisioning}
                className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition-colors disabled:opacity-50"
                title={`Auto-provision entire ${dynamicWorkingDays}-day working schedule`}
              >
                <Sparkles size={14} className={provisioning ? "animate-spin text-emerald-600" : "text-emerald-600"} />
                <span>
                  {provisioning
                    ? "Provisioning..."
                    : `Auto-Provision ${dynamicWorkingDays} Days (Optional)`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "DAILY_SCHEDULE" && selectedEvaluation && (
        <div className="space-y-5">
          {/* Plan Summary Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  Daily Schedule Editor — {selectedEvaluation.employeeName} ({selectedEvaluation.month})
                </h2>

                <span className="bg-sky-600 text-white text-xs px-2.5 py-1 rounded-lg font-bold shadow-xs">
                  {selectedEvaluation.days.length} Days MR Working Schedule
                </span>

                {/* Direct Representative Switcher in Daily Schedule Editor */}
                {isManager && mrEmployees.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 rounded-xl px-2 py-1 shadow-xs">
                    <Users size={13} className="text-sky-600 shrink-0 ml-1" />
                    <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">MR:</span>
                    <SearchableSelect
                      value={selectedEvaluation.id}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith("NEW:")) {
                          const empId = val.replace("NEW:", "");
                          handleProvision27DayPlan(empId);
                        } else {
                          setSelectedPlanId(val);
                        }
                      }}
                      searchPlaceholder="Search MR schedule..."
                      buttonClassName="border-0 bg-transparent shadow-none px-2 py-0.5 text-xs font-bold text-slate-900"
                    >
                      {evaluations.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.employeeName} — {ev.days.length} Days MR ({ev.status})
                        </option>
                      ))}
                      {mrEmployees
                        .filter((m) => !evaluations.some((e) => e.employeeName?.includes(m.name)))
                        .map((m) => (
                          <option key={m.id} value={`NEW:${m.id}`}>
                            + {m.name} (Auto-Provision 27 Days MR)
                          </option>
                        ))}
                    </SearchableSelect>
                  </div>
                )}

                {selectedEvaluation.territories && selectedEvaluation.territories.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedEvaluation.territories.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-xs px-2.5 py-1 rounded-lg font-bold border border-sky-200">
                        <MapPin size={13} className="text-sky-600" /> {t}
                      </span>
                    ))}
                  </div>
                ) : selectedEvaluation.territoryName ? (
                  <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-xs px-2.5 py-1 rounded-lg font-bold border border-sky-200">
                    <MapPin size={13} className="text-sky-600" /> {selectedEvaluation.territoryName}
                  </span>
                ) : null}
                {/* Real-time Visit Execution Badge */}
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded-lg font-bold border border-emerald-200">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Execution: {selectedEvaluation.summary.completedVisitsCount ?? selectedEvaluation.days.filter((d) => !d.isSunday && (d.visitStatus === "DONE" || d.isCompleted)).length} / {selectedEvaluation.summary.totalEntitiesPlanned || selectedEvaluation.summary.totalDoctorCalls || selectedEvaluation.days.filter((d) => !d.isSunday && (d.plannedDoctorId || d.plannedChemistId)).length || selectedEvaluation.days.filter((d) => !d.isSunday).length} Done ({selectedEvaluation.summary.executionRatePct ?? 0}%)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 mt-1">
                <span>Field Visit Territories: <strong className="text-slate-800">{selectedEvaluation.territories?.join(", ") || selectedEvaluation.territoryName || "General"}</strong></span>
                <span>Days Scheduled: <strong>{new Set(selectedEvaluation.days.map((d) => d.date)).size}</strong></span>
                <span>Doctor Calls: <strong>{selectedEvaluation.summary.totalDoctorCalls}</strong></span>
                <span>Chemist Calls: <strong className="text-purple-700">{selectedEvaluation.summary.totalChemistCalls || 0}</strong></span>
                <span>Total Planned Entities: <strong>{selectedEvaluation.summary.totalEntitiesPlanned || selectedEvaluation.days.length}</strong></span>
                <span>Route Score: <strong className="text-emerald-600">{selectedEvaluation.summary.averageRouteEfficiency}%</strong></span>
                <span>Compliance: <strong className="text-sky-600">{selectedEvaluation.summary.complianceScore}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={selectedEvaluation.status !== "APPROVED"}
                onClick={() => openWhatsAppModal(selectedEvaluation)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors shadow-xs ${
                  selectedEvaluation.status === "APPROVED"
                    ? "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 cursor-pointer"
                    : "text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60"
                }`}
                title={
                  selectedEvaluation.status === "APPROVED"
                    ? "Send approved tour roadmap to Metapharsic-MR Group"
                    : "Plan must be APPROVED before sending to Metapharsic-MR Group"
                }
              >
                <MessageSquare size={13} className={selectedEvaluation.status === "APPROVED" ? "text-emerald-600" : "text-slate-400"} />
                {selectedEvaluation.status === "APPROVED" ? "Send to Metapharsic-MR Group" : "Metapharsic-MR Group (Approval Required)"}
              </button>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedEvaluation.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : selectedEvaluation.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {isAdmin && selectedEvaluation.status === "APPROVED"
                  ? "EXECUTIVE AUTHORIZED"
                  : selectedEvaluation.status}
              </span>

              {/* Admin/MD Delete Button in Daily Schedule view */}
              {isAdmin && (
                <button
                  onClick={() => {
                    const currentPlan = plans.find((p) => p.id === selectedEvaluation.id) || selectedEvaluation;
                    setDeletingPlan(currentPlan);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shadow-xs"
                  title="Admin Override: Permanently delete this Tour Plan"
                >
                  <Trash2 size={13} className="text-red-600" />
                  <span>Delete Plan</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Recommendations Banner */}
          {selectedEvaluation.recommendations.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 text-sky-800 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} /> Multi-Agent AI Tour Optimization Insights
              </div>
              <ul className="text-xs text-sky-900 space-y-1 pl-5 list-disc">
                {selectedEvaluation.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Daily Schedule List Matrix */}
          {(() => {
            const allDays = selectedEvaluation.days;
            const doneCount = allDays.filter((d) => !d.isSunday && (d.visitStatus === "DONE" || d.isCompleted)).length;
            const notDoneCount = allDays.filter((d) => !d.isSunday && d.visitStatus === "NOT_DONE").length;
            const pendingCount = allDays.filter((d) => !d.isSunday && (!d.visitStatus || d.visitStatus === "PENDING") && !d.isCompleted).length;

            const displayedDays = allDays.filter((d) => {
              if (visitFilter === "ALL") return true;
              if (d.isSunday) return false;
              const st = d.visitStatus || (d.isCompleted ? "DONE" : "PENDING");
              return st === visitFilter;
            });

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">Day-by-Day Field Coverage & Execution Matrix</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                        MR Day Controls Enabled
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Modify, append, edit, or delete any tour day. Completed doctor visits can be recorded with Nearest Chemist, Doctor-Designated Chemist, or In-House dispensing.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Plan 1-Day Schedule / Append Button */}
                    <button
                      onClick={openAppendDayModal}
                      className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0"
                      title="Plan 1-day schedule clubbing doctors and chemists"
                    >
                      <Plus size={14} />
                      <span>Plan 1-Day Schedule</span>
                    </button>

                    {/* Download & Print Field Schedule with Checkboxes */}
                    <button
                      onClick={() => setShowDownloadModal(true)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-colors shrink-0"
                      title="Download or print field-ready schedule with checkboxes for on-field execution"
                    >
                      <Printer size={14} className="text-slate-600" />
                      <span>Download / Print Schedule</span>
                    </button>

                    {/* Quick Add Stop Button */}
                    <button
                      onClick={() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        setNewDayDate(todayStr);
                        const terrId = selectedEvaluation.territoryId || territories[0]?.id || "";
                        setNewDayTerritoryId(terrId);
                        setNewDayDoctorId("");
                        if (terrId) {
                          loadDoctorsForTerritory(terrId);
                        }
                        setAddingDay(true);
                      }}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-colors shrink-0"
                      title="Quickly add an extra doctor or chemist stop"
                    >
                      <span>+ Stop</span>
                    </button>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setVisitFilter("ALL")}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          visitFilter === "ALL"
                            ? "bg-white text-slate-900 shadow-xs font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All ({allDays.length})
                      </button>
                      <button
                        onClick={() => setVisitFilter("DONE")}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                          visitFilter === "DONE"
                            ? "bg-emerald-600 text-white shadow-xs font-bold"
                            : "text-emerald-700 hover:bg-white/60"
                        }`}
                      >
                        <CheckCircle size={12} /> Done ({doneCount})
                      </button>
                      <button
                        onClick={() => setVisitFilter("NOT_DONE")}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                          visitFilter === "NOT_DONE"
                            ? "bg-red-600 text-white shadow-xs font-bold"
                            : "text-red-700 hover:bg-white/60"
                        }`}
                      >
                        <XCircle size={12} /> Not Done ({notDoneCount})
                      </button>
                      <button
                        onClick={() => setVisitFilter("PENDING")}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                          visitFilter === "PENDING"
                            ? "bg-amber-500 text-white shadow-xs font-bold"
                            : "text-amber-800 hover:bg-white/60"
                        }`}
                      >
                        <Clock size={12} /> Pending ({pendingCount})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {displayedDays.map((day) => {
                    const isDone = day.visitStatus === "DONE" || day.isCompleted;
                    const isNotDone = day.visitStatus === "NOT_DONE";
                    const isUpdating = updatingVisitId === day.id;

                    return (
                      <div
                        key={day.id}
                        className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          day.isSunday
                            ? "bg-slate-50/60 opacity-60"
                            : isDone
                            ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                            : isNotDone
                            ? "bg-red-50/20 hover:bg-red-50/40"
                            : "hover:bg-sky-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-[220px]">
                          {/* On-Field Interactive Checkbox */}
                          {!day.isSunday && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleVisitStatus(day, isDone ? "PENDING" : "DONE")}
                              className="p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors shrink-0 text-slate-400 hover:text-emerald-600"
                              title={isDone ? "Call Completed! Click to uncheck" : "Click to mark Call Done"}
                            >
                              {isDone ? (
                                <CheckSquare size={22} className="text-emerald-600" />
                              ) : (
                                <Square size={22} className="text-slate-400 hover:text-slate-600" />
                              )}
                            </button>
                          )}

                          <div
                            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center border shrink-0 ${
                              day.isSunday
                                ? "bg-slate-100 border-slate-200"
                                : isDone
                                ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                                : isNotDone
                                ? "bg-red-100 border-red-200 text-red-800"
                                : "bg-slate-100 border-slate-200"
                            }`}
                          >
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {day.dayOfWeek.slice(0, 3)}
                            </span>
                            <span className="text-base font-bold text-slate-800">
                              {day.date.split("-")[2]}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{day.date}</p>
                              {day.isSunday ? (
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Weekly Off
                                </span>
                              ) : isDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                  <CheckCircle size={10} className="text-emerald-600" /> Done
                                </span>
                              ) : isNotDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                                  <XCircle size={10} className="text-red-600" /> Not Done
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                  <Clock size={10} className="text-amber-600" /> Pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{day.dayOfWeek}</p>
                          </div>
                        </div>

                        {/* Territory & Beat Details */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-sky-500 shrink-0" />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] uppercase font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300">
                                  Field Visit Territory
                                </span>
                                {day.beatName && (
                                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                    {day.beatName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-bold text-slate-900">{day.territoryName}</span>
                                {day.subArea && (
                                  <span className="text-slate-600 text-[11px] font-semibold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    {day.subArea}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {day.entityType === "CHEMIST" ? (
                              <>
                                <Store size={15} className="text-purple-600 shrink-0" />
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] uppercase font-bold text-purple-600">Planned Chemist</span>
                                    <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded text-[10px] border border-purple-200">
                                      Retail Chemist
                                    </span>
                                  </div>
                                  <div className="mt-0.5">
                                    <span className="font-semibold text-slate-900 block">{day.plannedChemistName || "Retail Chemist Visit"}</span>
                                    {day.chemistAddress && (
                                      <p className="text-[11px] text-slate-500 truncate max-w-xs">{day.chemistAddress}</p>
                                    )}
                                    {day.chemistMobile && (
                                      <span className="text-[10px] text-purple-700 font-mono">Ph: {day.chemistMobile}</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <Stethoscope size={15} className="text-sky-600 shrink-0" />
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] uppercase font-bold text-sky-700">Planned Doctor</span>
                                    {day.doctorDpsTier && (
                                      <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                        {day.doctorDpsTier}
                                      </span>
                                    )}
                                  </div>
                                  {day.plannedDoctorName ? (
                                    <div className="space-y-0.5 mt-0.5">
                                      <span className="font-semibold text-slate-900 block">{day.plannedDoctorName}</span>
                                      {day.doctorSpecialty && (
                                        <span className="text-[11px] text-slate-600 font-medium block">{day.doctorSpecialty}</span>
                                      )}
                                      {day.doctorClinicAddress && (
                                        <p className="text-[11px] text-slate-500 truncate max-w-xs">{day.doctorClinicAddress}</p>
                                      )}

                                      {/* Medicine Placement Badge when call is done */}
                                      {day.medicinePlacement && (
                                        <div className="pt-0.5">
                                          {day.medicinePlacement.type === "NEAREST_CHEMIST" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                                              <Store size={10} className="text-emerald-600" />
                                              <span>Nearest Chemist: {day.medicinePlacement.chemistName || "Territory Chemist"}</span>
                                            </span>
                                          )}
                                          {day.medicinePlacement.type === "DOCTOR_DESIGNATED_CHEMIST" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-md shadow-2xs">
                                              <Store size={10} className="text-sky-600" />
                                              <span>Dr. Designated: {day.medicinePlacement.chemistName || "Designated Chemist"}</span>
                                            </span>
                                          )}
                                          {day.medicinePlacement.type === "IN_HOUSE" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-md shadow-2xs">
                                              <Building size={10} className="text-purple-600" />
                                              <span>In-House Clinic / Pharmacy</span>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">No doctor planned</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Badges, Execution Toggles & MR Day Actions */}
                        <div className="flex items-center gap-3 justify-between lg:justify-end flex-wrap">
                          {!day.isSunday && (
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <button
                                disabled={isUpdating}
                                onClick={() => handleToggleVisitStatus(day, isDone ? "PENDING" : "DONE")}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                                  isDone
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200"
                                } disabled:opacity-50`}
                                title={isDone ? "Click to revert back to Pending" : "Mark visit as Done"}
                              >
                                <CheckCircle size={12} className={isDone ? "text-white" : "text-emerald-600"} />
                                <span>Done</span>
                              </button>

                              <button
                                disabled={isUpdating}
                                onClick={() => handleToggleVisitStatus(day, isNotDone ? "PENDING" : "NOT_DONE")}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                                  isNotDone
                                    ? "bg-red-600 text-white shadow-xs"
                                    : "bg-white text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200"
                                } disabled:opacity-50`}
                                title={isNotDone ? "Click to revert back to Pending" : "Mark visit as Not Done"}
                              >
                                <XCircle size={12} className={isNotDone ? "text-white" : "text-red-600"} />
                                <span>Not Done</span>
                              </button>
                            </div>
                          )}

                          <div className="text-right text-xs">
                            <span className="font-mono text-emerald-600 font-bold block">
                              {day.routeEfficiencyScore}% Route
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                day.complianceStatus === "OPTIMAL"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : day.complianceStatus === "COMPLIANT"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {day.complianceStatus}
                            </span>
                          </div>

                          {/* MR Day Actions: Add Stop to Day, Edit Day & Delete Day */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setNewDayDate(day.date);
                                setNewDayTerritoryId(day.territoryId);
                                setNewDayEntityType("DOCTOR");
                                setNewDayDoctorId("");
                                setNewDayChemistId("");
                                if (day.territoryId) {
                                  loadDoctorsForTerritory(day.territoryId);
                                  loadChemistsForTerritory(day.territoryId);
                                }
                                setSingleDayBeatName(day.beatName || "");
                                setAddingDay(true);
                              }}
                              className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors shadow-xs"
                              title="Add another doctor or chemist to this day"
                            >
                              <Plus size={13} /> Add Stop
                            </button>
                            <button
                              onClick={() => openDayEditor(day)}
                              className="flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-300 font-bold px-2.5 py-1.5 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition-colors shadow-xs"
                              title="Edit stop details (territory, doctor/chemist entity, notes)"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => setDeletingDay(day)}
                              className="flex items-center gap-1 text-xs bg-white text-red-600 border border-red-200 font-bold px-2 py-1.5 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-xs"
                              title="Delete this visit entry from schedule"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {displayedDays.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                      No visits match the current "{visitFilter}" filter.
                    </div>
                  )}
                </div>

                {/* Day Matrix Bottom Actions Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-sky-600" />
                    <span className="text-xs font-semibold text-slate-700">
                      Multi-Agent Field Schedule Controls ({new Set(selectedEvaluation.days.map((d) => d.date)).size} days active)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={openAppendDayModal}
                      className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors"
                    >
                      <Plus size={14} />
                      <span>Append Next Day (Doctors & Chemists)</span>
                    </button>
                    <button
                      onClick={() => setShowDownloadModal(true)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-colors"
                    >
                      <Printer size={14} className="text-slate-600" />
                      <span>Download / Print Field Sheet</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* EDIT DAY MODAL */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Tour Plan Entry</h3>
                <p className="text-xs text-slate-500">{editingDay.date} ({editingDay.dayOfWeek})</p>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Entity Type Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Entity Stop Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditEntityType("DOCTOR");
                      setEditChemistId("");
                      if (editTerritoryId) loadDoctorsForTerritory(editTerritoryId);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                      editEntityType === "DOCTOR"
                        ? "bg-sky-50 text-sky-700 border-sky-400 ring-2 ring-sky-100"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Stethoscope size={14} className={editEntityType === "DOCTOR" ? "text-sky-600" : "text-slate-400"} />
                    <span>Doctor Visit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditEntityType("CHEMIST");
                      setEditDoctorId("");
                      if (editTerritoryId) loadChemistsForTerritory(editTerritoryId);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                      editEntityType === "CHEMIST"
                        ? "bg-purple-50 text-purple-700 border-purple-400 ring-2 ring-purple-100"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Store size={14} className={editEntityType === "CHEMIST" ? "text-purple-600" : "text-slate-400"} />
                    <span>Chemist Visit</span>
                  </button>
                </div>
              </div>

              {/* Territory Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Territory Location
                </label>
                <SearchableSelect
                  value={editTerritoryId}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setEditTerritoryId(tid);
                    setEditDoctorId("");
                    setEditChemistId("");
                    if (tid) {
                      loadDoctorsForTerritory(tid);
                      loadChemistsForTerritory(tid);
                    }
                  }}
                  placeholder="Select Territory"
                  searchPlaceholder="Search territory..."
                >
                  <option value="">Select Territory</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SearchableSelect>
              </div>

              {/* Doctor or Chemist Selection */}
              {editEntityType === "DOCTOR" ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Planned Doctor Visit
                  </label>
                  <SearchableSelect
                    value={editDoctorId}
                    onChange={(e) => setEditDoctorId(e.target.value)}
                    disabled={!editTerritoryId}
                    placeholder="-- No Specific Doctor (Territory Working Only) --"
                    searchPlaceholder="Search doctor name..."
                    allowClear
                  >
                    <option value="">-- No Specific Doctor (Territory Working Only) --</option>
                    {(doctorsByTerritory[editTerritoryId] || []).map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.fullName}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Planned Chemist Visit
                  </label>
                  <SearchableSelect
                    value={editChemistId}
                    onChange={(e) => setEditChemistId(e.target.value)}
                    disabled={!editTerritoryId}
                    placeholder="-- Select Retail Chemist / Medical Store --"
                    searchPlaceholder="Search chemist store..."
                    allowClear
                  >
                    <option value="">-- Select Retail Chemist / Medical Store --</option>
                    {(chemistsByTerritory[editTerritoryId] || []).map((chem) => (
                      <option key={chem.id} value={chem.id}>
                        {chem.name} {chem.subArea ? `(${chem.subArea})` : ""}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              )}

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Bot size={14} className="text-sky-600" /> Multi-Agent AI Recommendation
                </div>
                <p>
                  {editEntityType === "DOCTOR"
                    ? "DoctorTargetingAgent suggests picking a Class A doctor to optimize prescription conversion for this territory cluster."
                    : "ProximityCorrelationAgent recommends retail chemists within the doctor dispensing corridor for stock & sample placement."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingDay(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={saveDayEdit}
                disabled={editSaving || !editTerritoryId}
                className="flex items-center gap-1.5 bg-sky-600 text-white px-5 py-2 text-xs font-bold rounded-xl hover:bg-sky-700 disabled:opacity-50 shadow-sm"
              >
                <Save size={14} />
                {editSaving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDICINE PLACEMENT MODAL (Triggered when Doctor Call is Done) */}
      {medicineModalDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                  <Store size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Doctor Call Completed: Medicine Placement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Keep medicine/samples with nearest chemist, designated chemist, or in-house clinic.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMedicineModalDay(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-500">Doctor:</span>{" "}
                  <span className="font-bold text-slate-900">{medicineModalDay.plannedDoctorName || "Doctor Visit"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Day:</span>{" "}
                  <span className="font-bold text-indigo-700">#{medicineModalDay.date.split("-")[2] || medicineModalDay.date}</span>
                </div>
              </div>

              {/* 3 Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  Select Medicine Handover / Placement Location:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* Option 1: Nearest Chemist */}
                  <div
                    onClick={() => setPlacementType("NEAREST_CHEMIST")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      placementType === "NEAREST_CHEMIST"
                        ? "bg-purple-50/60 border-purple-500 ring-2 ring-purple-100"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="placementType"
                      checked={placementType === "NEAREST_CHEMIST"}
                      onChange={() => setPlacementType("NEAREST_CHEMIST")}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <Store size={14} className="text-purple-600" /> Nearest Chemist in Beat
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Leave stock/samples with the closest licensed retail chemist in this territory.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Doctor Designated Chemist */}
                  <div
                    onClick={() => setPlacementType("DOCTOR_DESIGNATED_CHEMIST")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      placementType === "DOCTOR_DESIGNATED_CHEMIST"
                        ? "bg-purple-50/60 border-purple-500 ring-2 ring-purple-100"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="placementType"
                      checked={placementType === "DOCTOR_DESIGNATED_CHEMIST"}
                      onChange={() => setPlacementType("DOCTOR_DESIGNATED_CHEMIST")}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <Stethoscope size={14} className="text-purple-600" /> Designated Chemist Suggested by Doctor
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Doctor specifies their preferred partnered retail medical store.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: In-House Clinic Pharmacy */}
                  <div
                    onClick={() => setPlacementType("IN_HOUSE")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      placementType === "IN_HOUSE"
                        ? "bg-purple-50/60 border-purple-500 ring-2 ring-purple-100"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="placementType"
                      checked={placementType === "IN_HOUSE"}
                      onChange={() => setPlacementType("IN_HOUSE")}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <Building size={14} className="text-purple-600" /> In-House Dispensary / Clinic
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Direct placement in doctor's own in-house clinic pharmacy or dispensing room.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chemist Selector for Nearest or Designated */}
              {(placementType === "NEAREST_CHEMIST" || placementType === "DOCTOR_DESIGNATED_CHEMIST") && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700">
                    {placementType === "NEAREST_CHEMIST"
                      ? "Select Nearest Chemist:"
                      : "Doctor's Preferred Chemist:"}
                  </label>
                  <SearchableSelect
                    value={selectedChemistId}
                    onChange={(e) => setSelectedChemistId(e.target.value)}
                    placeholder="-- Choose from Directory --"
                    searchPlaceholder="Search chemist store..."
                    allowClear
                  >
                    <option value="">-- Choose from Directory --</option>
                    {(chemistsByTerritory[medicineModalDay.territoryId] || []).map((chem) => (
                      <option key={chem.id} value={chem.id}>
                        {chem.name} {chem.subArea ? `(${chem.subArea})` : ""}
                      </option>
                    ))}
                  </SearchableSelect>

                  {placementType === "DOCTOR_DESIGNATED_CHEMIST" && (
                    <input
                      type="text"
                      placeholder="Or enter doctor-specified chemist name..."
                      value={customChemistName}
                      onChange={(e) => setCustomChemistName(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white mt-1"
                    />
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Placement Notes / Sample Details:</label>
                <textarea
                  rows={2}
                  value={placementNotes}
                  onChange={(e) => setPlacementNotes(e.target.value)}
                  placeholder="e.g., 5 packs left for prescription support..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setMedicineModalDay(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMedicinePlacement}
                disabled={placementSaving}
                className="flex items-center gap-1.5 bg-purple-600 text-white px-5 py-2 text-xs font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 shadow-sm"
              >
                <CheckCircle2 size={14} />
                {placementSaving ? "Recording..." : "Confirm & Save Visit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / APPEND TOUR DAY MODAL */}
      {addingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Append Tour Day / Stop</h3>
                  <p className="text-xs text-slate-500">
                    Add a doctor or chemist stop to your monthly schedule
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddingDay(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <CalendarDays size={13} className="text-emerald-600" /> Tour Date:
                </label>
                <input
                  type="date"
                  value={newDayDate}
                  onChange={(e) => setNewDayDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white"
                />
              </div>

              {/* Entity Type Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Entity Stop Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewDayEntityType("DOCTOR");
                      setNewDayChemistId("");
                      if (newDayTerritoryId) loadDoctorsForTerritory(newDayTerritoryId);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                      newDayEntityType === "DOCTOR"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-100"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Stethoscope size={14} className={newDayEntityType === "DOCTOR" ? "text-emerald-600" : "text-slate-400"} />
                    <span>Doctor Visit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewDayEntityType("CHEMIST");
                      setNewDayDoctorId("");
                      if (newDayTerritoryId) loadChemistsForTerritory(newDayTerritoryId);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                      newDayEntityType === "CHEMIST"
                        ? "bg-purple-50 text-purple-700 border-purple-400 ring-2 ring-purple-100"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Store size={14} className={newDayEntityType === "CHEMIST" ? "text-purple-600" : "text-slate-400"} />
                    <span>Chemist Visit</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin size={13} className="text-emerald-600" /> Target Territory:
                </label>
                <SearchableSelect
                  value={newDayTerritoryId}
                  onChange={(e) => {
                    const tid = e.target.value;
                    setNewDayTerritoryId(tid);
                    setNewDayDoctorId("");
                    setNewDayChemistId("");
                    if (tid) {
                      loadDoctorsForTerritory(tid);
                      loadChemistsForTerritory(tid);
                    }
                  }}
                  placeholder="-- Select Territory --"
                  searchPlaceholder="Search territory..."
                >
                  <option value="">-- Select Territory --</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SearchableSelect>
              </div>

              {newDayEntityType === "DOCTOR" ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-emerald-600" /> Planned Doctor Call:
                  </label>
                  <SearchableSelect
                    value={newDayDoctorId}
                    onChange={(e) => setNewDayDoctorId(e.target.value)}
                    disabled={!newDayTerritoryId}
                    placeholder="-- No Specific Doctor (Territory Working) --"
                    searchPlaceholder="Search doctor..."
                    allowClear
                  >
                    <option value="">-- No Specific Doctor (Territory Working) --</option>
                    {(doctorsByTerritory[newDayTerritoryId] || []).map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.fullName}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Store size={13} className="text-purple-600" /> Planned Chemist Visit:
                  </label>
                  <SearchableSelect
                    value={newDayChemistId}
                    onChange={(e) => setNewDayChemistId(e.target.value)}
                    disabled={!newDayTerritoryId}
                    placeholder="-- Select Retail Chemist / Medical Store --"
                    searchPlaceholder="Search chemist store..."
                    allowClear
                  >
                    <option value="">-- Select Retail Chemist / Medical Store --</option>
                    {(chemistsByTerritory[newDayTerritoryId] || []).map((chem) => (
                      <option key={chem.id} value={chem.id}>
                        {chem.name} {chem.subArea ? `(${chem.subArea})` : ""}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Bot size={14} className="text-emerald-600" /> Multi-Agent AI Auto-Wiring
                </div>
                <p>
                  Multiple doctors and chemists can be scheduled on any single date. The routing engine automatically optimizes stops, doctor/chemist priorities, and telemetry.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAddingDay(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDay}
                disabled={newDaySaving || !newDayDate || !newDayTerritoryId}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-2 text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
              >
                <Plus size={14} />
                {newDaySaving ? "Adding..." : "Add Tour Day"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TOUR DAY MODAL */}
      {deletingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Tour Day</h3>
                <p className="text-xs text-slate-500">Remove day from monthly schedule</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p>
                Are you sure you want to delete <span className="font-bold text-slate-900">Day {deletingDay.date.split("-")[2]}</span> ({deletingDay.date})?
              </p>
              {deletingDay.plannedDoctorName && (
                <p className="text-slate-500">
                  Doctor: <span className="font-semibold text-slate-700">{deletingDay.plannedDoctorName}</span>
                </p>
              )}
              <p className="text-rose-600 font-medium">
                This day will be removed and monthly route coverage will be re-evaluated.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingDay(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDay}
                disabled={deletingDaySaving}
                className="flex items-center gap-1.5 bg-rose-600 text-white px-5 py-2 text-xs font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                <Trash2 size={14} />
                {deletingDaySaving ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP VOTE POLL MODAL */}
      {whatsAppModalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Dispatch to Metapharsic-MR Group</h3>
                  <p className="text-xs text-slate-500">
                    Official approved tour roadmap and visit execution roster for Metapharsic-MR Group on WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModalPlan(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X size={20} />
              </button>
            </div>

            {whatsAppLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw size={24} className="animate-spin text-emerald-600" />
                <span className="text-xs font-semibold">Generating Metapharsic-MR Group roadmap...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <pre className="w-full bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-800 leading-relaxed shadow-inner">
                    {whatsAppVoteText}
                  </pre>
                </div>

                {dispatchStatus && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>{dispatchStatus}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={handleDispatchWhatsAppNotifications}
                    className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors"
                  >
                    Re-dispatch to Metapharsic-MR Group & MR
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyVoteText}
                      className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors text-slate-700"
                    >
                      {copiedVote ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedVote ? "Copied!" : "Copy Metapharsic Message"}
                    </button>

                    <a
                      href={whatsAppShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                    >
                      <Share2 size={14} />
                      Open in Metapharsic-MR Group
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE PLAN CONFIRMATION MODAL */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isAdmin ? "Admin Override: Delete Tour Plan" : "Delete Tour Plan"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? "Permanent administrative deletion for representative itinerary"
                    : "Permanently delete this draft tour plan"}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Representative:</span>
                <span className="font-bold text-slate-900">
                  {deletingPlan.employee?.firstName} {deletingPlan.employee?.lastName || deletingPlan.employeeName || "Field MR"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Month:</span>
                <span className="font-bold text-slate-900">
                  {deletingPlan.month ? new Date(deletingPlan.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Current Month"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Status:</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  deletingPlan.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : deletingPlan.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {isAdmin && deletingPlan.status === "APPROVED" ? "EXECUTIVE AUTHORIZED" : deletingPlan.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Days / Planned Calls:</span>
                <span className="font-bold text-slate-900">
                  {deletingPlan.days?.length ?? "All scheduled calls"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                <span>Irreversible Administrative Action</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Deleting this tour plan will permanently wipe all scheduled daily itineraries, assigned doctors, and visit records for this month. The MR can re-plan or provision anew once deleted.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingPlan(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeletePlan}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? "Deleting..." : "Yes, Delete Plan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-DAY SCHEDULE CREATOR & APPEND MODAL (CLUBBING DOCTORS & CHEMISTS) */}
      {showSingleDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Plan 1-Day Schedule (Doctors & Chemists Clubbed)
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Daily Schedule Multi-Agent
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up or append a single day field itinerary for {selectedEvaluation?.employeeName || "Representative"}. Doctors and chemists are clubbed together for comprehensive beat coverage.
                </p>
              </div>
              <button
                onClick={() => setShowSingleDayModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Date & Territory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Itinerary Date *
                  </label>
                  <input
                    type="date"
                    value={singleDayDate}
                    onChange={(e) => setSingleDayDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:outline-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Field Territory *
                  </label>
                  <SearchableSelect
                    value={singleDayTerritoryId}
                    onChange={(e) => {
                      const tid = e.target.value;
                      setSingleDayTerritoryId(tid);
                      setSingleDayDoctorIds([]);
                      setSingleDayChemistIds([]);
                      if (tid) {
                        loadDoctorsForTerritory(tid);
                        loadChemistsForTerritory(tid);
                      }
                    }}
                    placeholder="Select Territory"
                    searchPlaceholder="Search territory..."
                  >
                    <option value="">Select Territory</option>
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>

              {/* Beat Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Beat / Route Zone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Beat-A Central Clinic & Chemist Hub"
                  value={singleDayBeatName}
                  onChange={(e) => setSingleDayBeatName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-sky-500"
                />
              </div>

              {/* Clubbed Doctors Selection */}
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Stethoscope size={16} className="text-sky-600 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Target Doctors ({singleDayDoctorIds.length} Selected)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter doctors..."
                      value={doctorSearchTerm}
                      onChange={(e) => setDoctorSearchTerm(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-lg px-2 py-1 w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const docs = (doctorsByTerritory[singleDayTerritoryId] || []).filter((d) =>
                          d.fullName.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                          (d.primarySpecialty && d.primarySpecialty.toLowerCase().includes(doctorSearchTerm.toLowerCase()))
                        );
                        setSingleDayDoctorIds(Array.from(new Set([...singleDayDoctorIds, ...docs.map((d) => d.id)])));
                      }}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100 px-2 py-1 rounded"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleDayDoctorIds([])}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-200 px-2 py-1 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 p-1">
                  {(doctorsByTerritory[singleDayTerritoryId] || [])
                    .filter((d) =>
                      d.fullName.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                      (d.primarySpecialty && d.primarySpecialty.toLowerCase().includes(doctorSearchTerm.toLowerCase()))
                    )
                    .map((doc) => {
                      const isChecked = singleDayDoctorIds.includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? "bg-sky-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSingleDayDoctorIds([...singleDayDoctorIds, doc.id]);
                              } else {
                                setSingleDayDoctorIds(singleDayDoctorIds.filter((id) => id !== doc.id));
                              }
                            }}
                            className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                          />
                          <div className="text-xs flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800">{doc.fullName}</span>
                              {doc.dpsTier && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded">
                                  {doc.dpsTier}
                                </span>
                              )}
                              {doc.primarySpecialty && (
                                <span className="text-[10px] text-slate-500 font-medium">({doc.primarySpecialty})</span>
                              )}
                            </div>
                            {doc.clinicAddress && (
                              <p className="text-[11px] text-slate-500 truncate max-w-md">{doc.clinicAddress}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}

                  {(!doctorsByTerritory[singleDayTerritoryId] ||
                    doctorsByTerritory[singleDayTerritoryId].length === 0) && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      {singleDayTerritoryId ? "No doctors found in territory." : "Select a territory first."}
                    </div>
                  )}
                </div>
              </div>

              {/* Clubbed Chemists Selection */}
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Store size={16} className="text-purple-600 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Target Retail Chemists ({singleDayChemistIds.length} Selected)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter chemists..."
                      value={chemistSearchTerm}
                      onChange={(e) => setChemistSearchTerm(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-lg px-2 py-1 w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const chems = (chemistsByTerritory[singleDayTerritoryId] || []).filter((c) =>
                          c.name.toLowerCase().includes(chemistSearchTerm.toLowerCase()) ||
                          (c.address && c.address.toLowerCase().includes(chemistSearchTerm.toLowerCase()))
                        );
                        setSingleDayChemistIds(Array.from(new Set([...singleDayChemistIds, ...chems.map((c) => c.id)])));
                      }}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100 px-2 py-1 rounded"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleDayChemistIds([])}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-200 px-2 py-1 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 p-1">
                  {(chemistsByTerritory[singleDayTerritoryId] || [])
                    .filter((c) =>
                      c.name.toLowerCase().includes(chemistSearchTerm.toLowerCase()) ||
                      (c.address && c.address.toLowerCase().includes(chemistSearchTerm.toLowerCase()))
                    )
                    .map((chem) => {
                      const isChecked = singleDayChemistIds.includes(chem.id);
                      return (
                        <label
                          key={chem.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? "bg-purple-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSingleDayChemistIds([...singleDayChemistIds, chem.id]);
                              } else {
                                setSingleDayChemistIds(singleDayChemistIds.filter((id) => id !== chem.id));
                              }
                            }}
                            className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <div className="text-xs flex-1">
                            <span className="font-bold text-slate-800 block">{chem.name}</span>
                            {chem.address && (
                              <p className="text-[11px] text-slate-500 truncate max-w-md">{chem.address}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}

                  {(!chemistsByTerritory[singleDayTerritoryId] ||
                    chemistsByTerritory[singleDayTerritoryId].length === 0) && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      {singleDayTerritoryId ? "No chemists found in territory." : "Select a territory first."}
                    </div>
                  )}
                </div>
              </div>

              {/* Day Objective / Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Field Call Objective & Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on Metapharsic Cardio launch and stock order checks at key chemist outlets."
                  value={singleDayNotes}
                  onChange={(e) => setSingleDayNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white focus:outline-sky-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>DailyScheduleClubbingAgent:</strong> {singleDayDoctorIds.length} Doctor(s) and {singleDayChemistIds.length} Chemist(s) will be clubbed together on {singleDayDate}.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                disabled={singleDaySaving}
                onClick={() => setShowSingleDayModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={singleDaySaving || !singleDayDate || !singleDayTerritoryId}
                onClick={handleCreateSingleDayPlan}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {singleDaySaving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={14} />}
                <span>{singleDaySaving ? "Saving Itinerary..." : "Save 1-Day Schedule"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD & PRINT FIELD SCHEDULE MODAL */}
      {showDownloadModal && selectedEvaluation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-sky-600" />
                  <h3 className="text-lg font-bold text-slate-900">
                    Field-Ready Schedule Export & Printable Sheet
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Export formatted field call sheet equipped with physical verification checkboxes ([ ]) for on-field call completion.
                </p>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scope Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Export Scope:</span>
                <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDownloadMode("TODAY")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      downloadMode === "TODAY"
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Target Date ({targetPrintDate})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadMode("ALL")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      downloadMode === "ALL"
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Days ({new Set(selectedEvaluation.days.map((d) => d.date)).size} Days)
                  </button>
                </div>
              </div>

              {downloadMode === "TODAY" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Select Date:</span>
                  <input
                    type="date"
                    value={targetPrintDate}
                    onChange={(e) => setTargetPrintDate(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-white font-bold"
                  />
                </div>
              )}
            </div>

            {/* Live Sheet Preview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                <div>
                  <span className="font-bold text-slate-900">{selectedEvaluation.employeeName}</span>
                  <span className="text-slate-500 ml-2">Territory: {selectedEvaluation.territoryName || "Field Beat"}</span>
                </div>
                <span className="bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  Print-Ready Format with Checkboxes [ ]
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs">
                {(downloadMode === "TODAY"
                  ? selectedEvaluation.days.filter((d) => d.date === targetPrintDate)
                  : selectedEvaluation.days.filter((d) => !d.isSunday)
                ).map((entry, idx) => (
                  <div key={entry.id || idx} className="p-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-5 h-5 rounded border-2 border-slate-400 text-center text-[10px] font-bold text-emerald-700 bg-white leading-4">
                        {entry.visitStatus === "DONE" || entry.isCompleted ? "✓" : ""}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            entry.entityType === "CHEMIST" ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"
                          }`}>
                            {entry.entityType || "DOCTOR"}
                          </span>
                          <span className="font-bold text-slate-800">
                            {entry.entityType === "CHEMIST" ? entry.plannedChemistName || "Chemist Visit" : entry.plannedDoctorName || "Doctor Visit"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {entry.entityType === "CHEMIST" ? entry.chemistAddress || entry.subArea || "Local Chemist" : entry.doctorClinicAddress || entry.doctorSpecialty || "Clinic / Hospital"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      [____:____ AM/PM]
                    </div>
                  </div>
                ))}

                {(downloadMode === "TODAY"
                  ? selectedEvaluation.days.filter((d) => d.date === targetPrintDate)
                  : selectedEvaluation.days.filter((d) => !d.isSunday)
                ).length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    No scheduled visits found for this selection. Use "Plan 1-Day Schedule" to add calls.
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1">
                <span>Field signature blocks and verification rows included in exported sheet.</span>
                <span className="text-slate-400 font-mono">Form Template: SFA-TP-CHK-V2</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadHtmlSchedule}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors"
                  title="Download standalone HTML file that works offline and can be saved or opened on phone/laptop"
                >
                  <Download size={14} />
                  <span>Download HTML Sheet</span>
                </button>
                <button
                  onClick={handlePrintSchedule}
                  className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors"
                  title="Directly trigger browser print dialog to print or save as PDF"
                >
                  <Printer size={14} />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "warn" | "good" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-100 text-amber-600"
      : tone === "good"
      ? "bg-emerald-100 text-emerald-600"
      : tone === "sky"
      ? "bg-sky-100 text-sky-600"
      : "bg-teal-100 text-teal-600";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-display font-bold text-slate-900">{value}</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
}
