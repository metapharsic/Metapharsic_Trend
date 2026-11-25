import ExcelJS from "exceljs";
import { Role, TourPlanStatus } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { POST as submitTourPlan } from "../app/api/sfa/tour-plan/submit/route";
import { POST as pruneAuto } from "../app/api/sfa/tour-plan/prune-auto/route";
import { TourPlanAgentsService } from "../services/tour-plan-agents.service";
import { generateTourPlanExcelBuffer } from "../lib/tour-plan-excel";

describe("Tour Plan Progressive N+1 Scheduling, Multi-Chemist + Multi-Doctor Submit, and Formatted Print Excel", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("allows MR to submit multiple doctors AND multiple chemists on Day 1 -> Day N+1 and exports print-ready .xlsx", async () => {
    // Create a second doctor and second chemist in the same territory
    const doc2 = await testDb.doctor.create({
      data: {
        fullName: "Dr. Second Neuro Clinic",
        primarySpecialty: "Neurology",
        clinicAddress: "12 MG Road, Nampally",
        beatName: "Beat-A: Nampally Corridor",
        subArea: "Nampally",
        latitude: 28.7042,
        longitude: 77.1026,
        territoryId: fx.territoryId,
        patientFootfallDaily: 30,
        avgPrescriptionsDaily: 12,
        mobile: "+919876543219",
        dpsScore: 78,
        dpsTier: "TIER_1",
      },
    });

    const chem2 = await testDb.chemist.create({
      data: {
        name: "MedPlus Retail Pharmacy #2",
        contactPerson: "Pharmacist",
        address: "Opposite City Hospital, Nampally",
        beatName: "Beat-A: Nampally Corridor",
        subArea: "Nampally",
        latitude: 28.691,
        longitude: 77.096,
        territoryId: fx.territoryId,
        mobile: "+919876543218",
      },
    });

    const day1 = "2026-11-18";
    const day2 = "2026-11-19"; // N+1

    const submitRes = await submitTourPlan(
      jsonRequest("/api/sfa/tour-plan/submit", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          month: "2026-11-01",
          days: [
            { date: day1, territoryId: fx.territoryId, plannedDoctorId: fx.doctorId },
            { date: day1, territoryId: fx.territoryId, plannedDoctorId: doc2.id },
            { date: day1, territoryId: fx.territoryId, plannedChemistId: fx.chemistId },
            { date: day1, territoryId: fx.territoryId, plannedChemistId: chem2.id },
            { date: day2, territoryId: fx.territoryId, plannedDoctorId: doc2.id },
            { date: day2, territoryId: fx.territoryId, plannedChemistId: chem2.id },
          ],
        },
      }),
      noParams
    );

    expect(submitRes.status).toBe(200);
    const submitJson = await readJson(submitRes);
    expect(submitJson.success).toBe(true);
    const planId = submitJson.data.tourPlanId as string;

    const evaluation = await TourPlanAgentsService.evaluatePlan(planId);
    expect(evaluation).not.toBeNull();
    expect(evaluation!.summary.totalEntitiesPlanned).toBe(6);
    expect(evaluation!.summary.totalDoctorCalls).toBe(3);
    expect(evaluation!.summary.totalChemistCalls).toBe(3);
    expect(evaluation!.clubbedDays?.length).toBe(2);
    expect(new Set(evaluation!.days.map((d) => d.date)).size).toBe(2);
    expect(evaluation!.clubbedDays?.[0].doctors.length).toBe(2);
    expect(evaluation!.clubbedDays?.[0].chemists.length).toBe(2);

    // Generate print-ready Excel workbook buffer
    const buffer = await generateTourPlanExcelBuffer(evaluation!, { mode: "ALL" });
    expect(buffer.byteLength).toBeGreaterThan(2000);

    // Parse generated .xlsx with ExcelJS to verify print formatting, sheets, and rows
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Printable Field Schedule",
      "N+1 Day Summary",
    ]);

    const sheet = wb.getWorksheet("Printable Field Schedule")!;
    expect(sheet.pageSetup.paperSize).toBe(9); // A4
    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToPage).toBe(true);
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.printTitlesRow).toBe("7:7");

    // Verify all doctor and chemist names appear in the printable workbook
    const allCellTexts: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value != null) allCellTexts.push(String(cell.value));
      });
    });
    const combined = allCellTexts.join("\n");
    expect(combined).toContain("Dr. Second Neuro Clinic");
    expect(combined).toContain("MedPlus Retail Pharmacy #2");
    expect(combined).toContain("DAY 1");
    expect(combined).toContain("DAY 2");
    expect(combined).toContain("CHEMIST");
    expect(combined).toContain("DOCTOR");
    expect(combined).toContain("[   ]");
    expect(combined).toContain("MR Signature");
  });

  it("prunes unexecuted single-stop auto-provisioned days while preserving executed and multi-stop days", async () => {
    const plan = await testDb.tourPlan.create({
      data: {
        employeeId: fx.mrEmployeeId,
        month: new Date("2026-11-01T00:00:00.000Z"),
        status: TourPlanStatus.APPROVED,
        days: {
          create: [
            // Executed day (must be kept)
            {
              date: new Date("2026-11-11T00:00:00.000Z"),
              territoryId: fx.territoryId,
              plannedDoctorId: fx.doctorId,
              visitStatus: "DONE",
              isCompleted: true,
              completionNotes: "Completed call",
            },
            // Multi-stop custom day (2 stops on same date -> must be kept)
            {
              date: new Date("2026-11-17T00:00:00.000Z"),
              territoryId: fx.territoryId,
              plannedDoctorId: fx.doctorId,
              visitStatus: "PENDING",
              isCompleted: false,
            },
            {
              date: new Date("2026-11-17T00:00:00.000Z"),
              territoryId: fx.territoryId,
              plannedDoctorId: null,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: '[Chemist Visit: Apollo]<!--PLANNED_CHEMIST:{"id":"1","name":"Apollo"}-->',
            },
            // Untouched single-stop boilerplate dates (must be pruned)
            {
              date: new Date("2026-11-20T00:00:00.000Z"),
              territoryId: fx.territoryId,
              plannedDoctorId: fx.doctorId,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: null,
            },
            {
              date: new Date("2026-11-21T00:00:00.000Z"),
              territoryId: fx.territoryId,
              plannedDoctorId: fx.doctorId,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: null,
            },
          ],
        },
      },
    });

    const res = await pruneAuto(
      jsonRequest("/api/sfa/tour-plan/prune-auto", {
        method: "POST",
        token: tokenFor(fx.adminUserId, Role.ADMIN),
        body: { tourPlanId: plan.id },
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.prunedStops).toBe(2);
    expect(json.data.remainingStops).toBe(3);

    const remaining = await testDb.tourPlanDay.findMany({
      where: { tourPlanId: plan.id },
      orderBy: { date: "asc" },
    });
    expect(remaining.length).toBe(3);
    expect(remaining.map((r) => r.date.toISOString().slice(0, 10))).toEqual([
      "2026-11-11",
      "2026-11-17",
      "2026-11-17",
    ]);
  });
});
