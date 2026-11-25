/**
 * Print-Ready Formatted Excel (.xlsx) Export Builder for Tour Plans & N+1 Field Schedules
 * Powered by ExcelJS with A4 landscape page setup, repeating table headers,
 * explicit cell borders, Doctor + Chemist breakdown, printable [ ] checkboxes,
 * and MR / ASM verification signature footer.
 */

import ExcelJS from "exceljs";
import { ExcelDesignSystem } from "@/lib/excel-export";
import type { DailyTourPlanEntry, TourPlanEvaluation } from "@/services/tour-plan-agents.service";

export interface TourPlanExcelExportOptions {
  mode: "TODAY" | "ALL";
  targetDate?: string;
}

function cleanCompletionNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes.replace(/<!--.*?-->/g, "").trim();
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

interface DayGroup {
  date: string;
  dayOfWeek: string;
  entries: DailyTourPlanEntry[];
}

function groupEntriesByDate(entries: DailyTourPlanEntry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    if (!map.has(entry.date)) {
      map.set(entry.date, {
        date: entry.date,
        dayOfWeek: entry.dayOfWeek || "",
        entries: [],
      });
    }
    map.get(entry.date)!.entries.push(entry);
  }
  return Array.from(map.values());
}

/**
 * Generates an A4 print-ready Excel (.xlsx) ArrayBuffer for the given tour plan evaluation.
 * Usable both in browser download flows and in server/unit verification tests.
 */
export async function generateTourPlanExcelBuffer(
  evaluation: TourPlanEvaluation,
  options: TourPlanExcelExportOptions = { mode: "ALL" }
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Metapharsic Pharmaceuticals — Trend MR SFA";
  workbook.created = new Date();
  workbook.modified = new Date();

  const workingEntries = evaluation.days.filter((d) => !d.isSunday);
  const filteredEntries =
    options.mode === "TODAY" && options.targetDate
      ? workingEntries.filter((d) => d.date === options.targetDate)
      : workingEntries;

  const dayGroups = groupEntriesByDate(filteredEntries);
  const totalDays = dayGroups.length;
  const totalDoctors = filteredEntries.filter((d) => d.entityType !== "CHEMIST" && d.plannedDoctorId).length;
  const totalChemists = filteredEntries.filter((d) => d.entityType === "CHEMIST").length;
  const doneCount = filteredEntries.filter((d) => d.visitStatus === "DONE" || d.isCompleted).length;

  const scopeLabel =
    options.mode === "TODAY" && options.targetDate
      ? `Scheduled Date: ${formatDateLabel(options.targetDate)}`
      : `Progressive N+1 Schedule (${totalDays} Active Day${totalDays === 1 ? "" : "s"})`;

  // ============================================================================
  // SHEET 1: PRINTABLE FIELD CALL SHEET (A4 Landscape, Fit to 1 Page Wide)
  // ============================================================================
  const ws = workbook.addWorksheet("Printable Field Schedule", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 7 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "7:7",
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
    headerFooter: {
      oddFooter: `&LMetapharsic Pharmaceuticals — Trend MR Field Schedule&CMedicine & Rx Call Sheet&RPage &P of &N`,
    },
  });

  // Explicit Column Widths tuned cleanly for 1 Landscape A4 Page
  ws.columns = [
    { key: "dayCol", width: 10 },    // A: Day #
    { key: "dateCol", width: 16 },   // B: Date & Weekday
    { key: "typeCol", width: 12 },   // C: Type (DOCTOR / CHEMIST)
    { key: "nameCol", width: 28 },   // D: Doctor / Chemist Name
    { key: "detailCol", width: 32 }, // E: Specialty / Outlet Address
    { key: "locCol", width: 24 },    // F: Beat & Territory
    { key: "checkCol", width: 13 },  // G: Completed [ ]
    { key: "timeCol", width: 14 },   // H: In / Out Time
    { key: "notesCol", width: 28 },  // I: Rx / Order Notes & Sign
  ];

  // Row 1: Company Banner
  ws.mergeCells("A1:I1");
  const banner = ws.getCell("A1");
  banner.value = "METAPHARSIC PHARMACEUTICALS — PRINT-READY FIELD CALL SCHEDULE (N+1)";
  banner.font = { name: "Calibri", size: 15, bold: true, color: { argb: ExcelDesignSystem.palette.pureWhite } };
  banner.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.midnightNavy },
  };
  banner.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // Row 2: Subtitle Bar
  ws.mergeCells("A2:I2");
  const subBanner = ws.getCell("A2");
  subBanner.value = `Official MR Visit Roster (Doctors + Retail Chemists)  |  ${scopeLabel}  |  Plan Status: ${evaluation.status}`;
  subBanner.font = { name: "Calibri", size: 10, bold: true, color: { argb: "BAE6FD" } };
  subBanner.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelDesignSystem.palette.headerNavy },
  };
  subBanner.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // Row 3-4: Metadata Summary Strip
  const metaPairs: Array<{ range: string; label: string; value: string; bg: string }> = [
    { range: "A3:C3", label: "FIELD REPRESENTATIVE", value: evaluation.employeeName || "Medical Rep", bg: "F1F5F9" },
    { range: "D3:F3", label: "TERRITORY / HQ", value: evaluation.territories?.join(", ") || evaluation.territoryName || "Assigned Beat", bg: "F1F5F9" },
    { range: "G3:I3", label: "PRINTED / GENERATED ON", value: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), bg: "F1F5F9" },
    { range: "A4:C4", label: "SCHEDULED DAYS", value: `${totalDays} Day${totalDays === 1 ? "" : "s"} (${evaluation.month})`, bg: "EFF6FF" },
    { range: "D4:F4", label: "CALL BREAKDOWN", value: `${totalDoctors} Doctors  +  ${totalChemists} Chemists  (${filteredEntries.length} Total Stops)`, bg: "ECFDF5" },
    { range: "G4:I4", label: "EXECUTION PROGRESS", value: `${doneCount} / ${filteredEntries.length} Completed (${filteredEntries.length > 0 ? Math.round((doneCount / filteredEntries.length) * 100) : 0}%)`, bg: "FEFCE8" },
  ];

  ws.getRow(3).height = 22;
  ws.getRow(4).height = 22;
  for (const m of metaPairs) {
    ws.mergeCells(m.range);
    const cell = ws.getCell(m.range.split(":")[0]);
    cell.value = `${m.label}:  ${m.value}`;
    cell.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: ExcelDesignSystem.palette.textDark } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: m.bg } };
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    cell.border = ExcelDesignSystem.borders.thin;
  }

  // Row 5: Instruction Notice
  ws.mergeCells("A5:I5");
  const instr = ws.getCell("A5");
  instr.value = "INSTRUCTIONS FOR FIELD PRINT: Tick [✓] in Completed column, log Clinic/Shop In-Out Time, capture Chemist/Doctor initials, and sync completed calls in Trend MR before 8:00 PM.";
  instr.font = { name: "Calibri", size: 8.5, italic: true, color: { argb: ExcelDesignSystem.palette.textMuted } };
  instr.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(5).height = 17;

  ws.getRow(6).height = 6;

  // Row 7: Printable Table Column Headers (repeated on print pages)
  const headers = [
    "Day #",
    "Date & Day",
    "Visit Type",
    "Doctor / Chemist Name",
    "Specialty / Clinic / Outlet Address",
    "Beat & Territory",
    "Done [  ]",
    "In / Out Time",
    "Rx / Order Notes & Sign",
  ];
  const headerRow = ws.getRow(7);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: ExcelDesignSystem.palette.pureWhite } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelDesignSystem.palette.royalBlue },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "0F172A" } },
      left: { style: "thin", color: { argb: "0F172A" } },
      bottom: { style: "medium", color: { argb: "0F172A" } },
      right: { style: "thin", color: { argb: "0F172A" } },
    };
  });

  // Rows 8+: Day-by-Day Grouped Entries (Day 1..N)
  let currentRow = 8;

  if (dayGroups.length === 0) {
    ws.mergeCells(`A${currentRow}:I${currentRow}`);
    const emptyCell = ws.getCell(`A${currentRow}`);
    emptyCell.value = "No planned Doctor or Chemist visits found for the selected scope. Add a Day N+1 schedule first.";
    emptyCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: ExcelDesignSystem.palette.textMuted } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(currentRow).height = 28;
    currentRow++;
  } else {
    dayGroups.forEach((group, groupIdx) => {
      const dayNumber = groupIdx + 1;
      const docStops = group.entries.filter((e) => e.entityType !== "CHEMIST" && e.plannedDoctorId).length;
      const chemStops = group.entries.filter((e) => e.entityType === "CHEMIST").length;

      // Day Separator Header Row
      ws.mergeCells(`A${currentRow}:I${currentRow}`);
      const groupCell = ws.getCell(`A${currentRow}`);
      groupCell.value = `DAY ${dayNumber}  —  ${formatDateLabel(group.date)} (${group.dayOfWeek})    |    ${docStops} Doctor${docStops === 1 ? "" : "s"} + ${chemStops} Chemist${chemStops === 1 ? "" : "s"} Planned`;
      groupCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: ExcelDesignSystem.palette.midnightNavy } };
      groupCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "E2E8F0" },
      };
      groupCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      groupCell.border = {
        top: { style: "thin", color: { argb: "94A3B8" } },
        left: { style: "thin", color: { argb: "94A3B8" } },
        bottom: { style: "thin", color: { argb: "94A3B8" } },
        right: { style: "thin", color: { argb: "94A3B8" } },
      };
      ws.getRow(currentRow).height = 21;
      currentRow++;

      group.entries.forEach((entry, stopIdx) => {
        const isChemist = entry.entityType === "CHEMIST";
        const isDone = entry.visitStatus === "DONE" || entry.isCompleted;
        const isNotDone = entry.visitStatus === "NOT_DONE";
        const stopName = isChemist
          ? entry.plannedChemistName || "Retail Chemist Visit"
          : entry.plannedDoctorName || "Doctor Visit";
        const stopDetails = isChemist
          ? [entry.chemistAddress, entry.subArea, entry.chemistMobile ? `Ph: ${entry.chemistMobile}` : ""]
              .filter(Boolean)
              .join(" · ") || "Retail Chemist Outlet"
          : [entry.doctorSpecialty, entry.doctorDpsTier, entry.doctorClinicAddress]
              .filter(Boolean)
              .join(" · ") || "Clinic / Hospital";
        const locLabel = [entry.beatName, entry.territoryName, entry.subArea].filter(Boolean).join(" · ");
        const cleanedNotes = cleanCompletionNotes(entry.completionNotes) || cleanCompletionNotes(entry.notes);
        const placementNote = entry.medicinePlacement?.chemistName
          ? `Med: ${entry.medicinePlacement.chemistName}`
          : "";
        const notesOutput = [placementNote, cleanedNotes].filter(Boolean).join(" — ");

        const checkDisplay = isDone ? "[✓] DONE" : isNotDone ? "[X] MISSED" : "[   ]";

        const rowValues = [
          `D${dayNumber}.${stopIdx + 1}`,
          `${formatDateLabel(entry.date)}\n${entry.dayOfWeek}`,
          isChemist ? "CHEMIST" : "DOCTOR",
          stopName,
          stopDetails,
          locLabel,
          checkDisplay,
          "In: ___:___\nOut: ___:___",
          notesOutput || "",
        ];

        const row = ws.getRow(currentRow);
        row.values = rowValues;

        const maxTextLines = Math.max(
          2,
          Math.ceil(stopDetails.length / 32),
          Math.ceil(stopName.length / 26),
          Math.ceil((notesOutput || "").length / 28)
        );
        row.height = Math.max(28, maxTextLines * 14);

        const rowBg = isDone
          ? "F0FDF4"
          : isNotDone
          ? "FFF1F2"
          : stopIdx % 2 === 0
          ? ExcelDesignSystem.palette.pureWhite
          : ExcelDesignSystem.palette.zebraRow;

        row.eachCell((cell, colNumber) => {
          cell.font = {
            name: "Calibri",
            size: 9.5,
            bold: colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 7,
            color: { argb: ExcelDesignSystem.palette.textDark },
          };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          cell.alignment = {
            vertical: "middle",
            horizontal:
              colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 8
                ? "center"
                : "left",
            wrapText: true,
          };

          // Badge colors on Visit Type column (col 3) & Status column (col 7)
          if (colNumber === 3) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: isChemist ? "F3E8FF" : "E0F2FE" },
            };
            cell.font = {
              name: "Calibri",
              size: 9,
              bold: true,
              color: { argb: isChemist ? "6B21A8" : "0369A1" },
            };
          } else if (colNumber === 7) {
            cell.font = {
              name: "Calibri",
              size: 9.5,
              bold: true,
              color: {
                argb: isDone
                  ? ExcelDesignSystem.palette.deepEmerald
                  : isNotDone
                  ? ExcelDesignSystem.palette.crimsonRose
                  : ExcelDesignSystem.palette.textDark,
              },
            };
          }

          cell.border = {
            top: { style: "thin", color: { argb: "CBD5E1" } },
            left: { style: "thin", color: { argb: "CBD5E1" } },
            bottom: {
              style: stopIdx === group.entries.length - 1 ? "medium" : "thin",
              color: { argb: stopIdx === group.entries.length - 1 ? "94A3B8" : "CBD5E1" },
            },
            right: { style: "thin", color: { argb: "CBD5E1" } },
          };
        });

        currentRow++;
      });
    });
  }

  // Signature Footer Block
  currentRow += 1;
  ws.getRow(currentRow).height = 24;
  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  const mrSigLabel = ws.getCell(`A${currentRow}`);
  mrSigLabel.value = "MR Signature: ____________________________";
  mrSigLabel.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: ExcelDesignSystem.palette.textDark } };
  mrSigLabel.alignment = { vertical: "bottom", horizontal: "left" };

  ws.mergeCells(`D${currentRow}:F${currentRow}`);
  const asmSigLabel = ws.getCell(`D${currentRow}`);
  asmSigLabel.value = "ASM Verification Stamp & Sign: ________________________";
  asmSigLabel.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: ExcelDesignSystem.palette.textDark } };
  asmSigLabel.alignment = { vertical: "bottom", horizontal: "left" };

  ws.mergeCells(`G${currentRow}:I${currentRow}`);
  const formRef = ws.getCell(`G${currentRow}`);
  formRef.value = "Form Ref: SFA-TP-N1-PRINT  |  Submission Cut-off: 8:00 PM";
  formRef.font = { name: "Calibri", size: 8.5, italic: true, color: { argb: ExcelDesignSystem.palette.textMuted } };
  formRef.alignment = { vertical: "bottom", horizontal: "right" };

  // ============================================================================
  // SHEET 2: N+1 DAY-WISE SUMMARY
  // ============================================================================
  const sumSheet = workbook.addWorksheet("N+1 Day Summary", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  sumSheet.columns = [
    { width: 10 },
    { width: 16 },
    { width: 14 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  sumSheet.mergeCells("A1:I1");
  const sTitle = sumSheet.getCell("A1");
  sTitle.value = `N+1 DAY-WISE COVERAGE SUMMARY — ${evaluation.employeeName.toUpperCase()} (${evaluation.month})`;
  sTitle.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FFFFFF" } };
  sTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ExcelDesignSystem.palette.midnightNavy } };
  sTitle.alignment = { horizontal: "center", vertical: "middle" };
  sumSheet.getRow(1).height = 28;

  sumSheet.mergeCells("A2:I2");
  const sSub = sumSheet.getCell("A2");
  sSub.value = `Active N Days: ${totalDays}  |  Doctors: ${totalDoctors}  |  Chemists: ${totalChemists}  |  Completed: ${doneCount}/${filteredEntries.length}`;
  sSub.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: ExcelDesignSystem.palette.textDark } };
  sSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  sSub.alignment = { horizontal: "center", vertical: "middle" };
  sumSheet.getRow(2).height = 20;

  sumSheet.getRow(3).height = 8;

  const sHeaderRow = sumSheet.getRow(4);
  sHeaderRow.values = [
    "Day #",
    "Date",
    "Weekday",
    "Territories & Beats",
    "Doctors Planned",
    "Chemists Planned",
    "Total Stops",
    "Done",
    "Pending",
  ];
  sHeaderRow.height = 24;
  sHeaderRow.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ExcelDesignSystem.palette.royalBlue } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = ExcelDesignSystem.borders.thin;
  });

  dayGroups.forEach((grp, idx) => {
    const docs = grp.entries.filter((e) => e.entityType !== "CHEMIST" && e.plannedDoctorId).length;
    const chems = grp.entries.filter((e) => e.entityType === "CHEMIST").length;
    const done = grp.entries.filter((e) => e.visitStatus === "DONE" || e.isCompleted).length;
    const pending = grp.entries.length - done;
    const beats = Array.from(
      new Set(grp.entries.map((e) => [e.beatName, e.territoryName].filter(Boolean).join(" · ")).filter(Boolean))
    ).join("; ");

    const r = sumSheet.addRow([
      `Day ${idx + 1}`,
      formatDateLabel(grp.date),
      grp.dayOfWeek,
      beats || evaluation.territoryName || "Field Beat",
      docs,
      chems,
      grp.entries.length,
      done,
      pending,
    ]);
    r.height = 22;
    r.eachCell((cell, colNum) => {
      cell.font = { name: "Calibri", size: 9.5, bold: colNum === 1 || colNum === 7 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFF" : "F8FAFC" } };
      cell.alignment = { horizontal: colNum === 4 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border = ExcelDesignSystem.borders.thin;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Triggers browser download of the print-ready Tour Plan Excel (.xlsx) workbook.
 */
export async function downloadTourPlanExcelSchedule(
  evaluation: TourPlanEvaluation,
  options: TourPlanExcelExportOptions = { mode: "ALL" }
): Promise<void> {
  const buffer = await generateTourPlanExcelBuffer(evaluation, options);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeName = (evaluation.employeeName || "MR").replace(/\s+/g, "_");
  const dateSuffix = options.mode === "TODAY" && options.targetDate ? options.targetDate : evaluation.month;
  const filename = `Tour_Schedule_N1_${safeName}_${dateSuffix}.xlsx`;

  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
