import { Role } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { GET as getTourPlans } from "../app/api/sfa/tour-plan/route";
import { GET as getReadiness } from "../app/api/sfa/tour-plan/readiness/route";
import { POST as createSingleDay } from "../app/api/sfa/tour-plan/single-day/route";
import { POST as toggleVisit } from "../app/api/sfa/tour-plan/toggle-visit/route";
import { TourPlanAgentsService } from "../services/tour-plan-agents.service";
import { startOfUtcDay } from "../lib/date";

describe("Tour Plan 1-Day Schedule, Doctors & Chemists Clubbing, and Field Readiness Reminder", () => {
  let fx: TestFixture;
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("does NOT auto-provision 27 default days when fetching tour plans on empty schedule", async () => {
    const today = new Date();
    const monthStr = today.toISOString().slice(0, 7);

    // Call GET /api/sfa/tour-plan without autoProvision=true
    const res = await getTourPlans(
      jsonRequest(`/api/sfa/tour-plan?month=${monthStr}`, {
        method: "GET",
        token: tokenFor(fx.mrUserId, Role.MR),
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    // Should be empty array, NOT automatically populated with 27 days
    expect(json.data.tourPlans.length).toBe(0);
    expect(json.data.evaluations.length).toBe(0);
  });

  it("returns isReady: false and pre-field reminder when MR has not scheduled for a working weekday", async () => {
    const weekdayStr = "2026-10-20"; // Tuesday

    const res = await getReadiness(
      jsonRequest(`/api/sfa/tour-plan/readiness?date=${weekdayStr}`, {
        method: "GET",
        token: tokenFor(fx.mrUserId, Role.MR),
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.data.isReady).toBe(false);
    expect(json.data.hasScheduleToday).toBe(false);
    expect(json.data.reminderTitle).toContain("Pre-Field Schedule Reminder");
    expect(json.data.actionUrl).toContain("/tour-plans?tab=DAILY_SCHEDULE");
  });

  it("creates a 1-day schedule clubbing doctors and chemists without generating 27 default days", async () => {
    const weekdayStr = "2026-10-20";

    const res = await createSingleDay(
      jsonRequest("/api/sfa/tour-plan/single-day", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          date: weekdayStr,
          territoryId: fx.territoryId,
          beatName: "Beat-1 Prime Clinic Hub",
          doctorIds: [fx.doctorId],
          chemistIds: [fx.chemistId],
          notes: "Focus on Cardio launch and retailer stock verification.",
        },
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.data.tourPlanId).toBeDefined();

    // Verify in database: exactly 1 tour plan created, containing 2 stops for that single day
    const plans = await testDb.tourPlan.findMany({
      where: { employeeId: fx.mrEmployeeId },
      include: { days: true },
    });
    expect(plans.length).toBe(1);
    // Exactly 2 stops (1 doctor + 1 chemist)
    expect(plans[0].days.length).toBe(2);
    // Ensure all days belong to weekdayStr
    const dates = plans[0].days.map((d) => toDateStr(d.date));
    expect(dates.every((d) => d === weekdayStr)).toBe(true);

    // Now verify multi-agent evaluation includes clubbedDays with both doctor & chemist
    const evaluation = await TourPlanAgentsService.evaluatePlan(plans[0].id);
    expect(evaluation.clubbedDays).toBeDefined();
    expect(evaluation.clubbedDays!.length).toBe(1);
    const clubbed = evaluation.clubbedDays![0];
    expect(clubbed.date).toBe(weekdayStr);
    expect(clubbed.doctors.length).toBe(1);
    expect(clubbed.doctors[0].plannedDoctorName).toBeDefined();
    expect(clubbed.chemists.length).toBe(1);
    expect(clubbed.chemists[0].plannedChemistName).toBeDefined();
  });

  it("returns isReady: true and reports planned stops once day schedule is created", async () => {
    const weekdayStr = "2026-10-20";

    // Create 1-day schedule
    await createSingleDay(
      jsonRequest("/api/sfa/tour-plan/single-day", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          date: weekdayStr,
          territoryId: fx.territoryId,
          doctorIds: [fx.doctorId],
          chemistIds: [fx.chemistId],
        },
      }),
      noParams
    );

    // Check readiness for that date
    const res = await getReadiness(
      jsonRequest(`/api/sfa/tour-plan/readiness?date=${weekdayStr}`, {
        method: "GET",
        token: tokenFor(fx.mrUserId, Role.MR),
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.success).toBe(true);
    expect(json.data.isReady).toBe(true);
    expect(json.data.hasScheduleToday).toBe(true);
    expect(json.data.plannedStopsCount).toBe(2);
    expect(json.data.doctorsCount).toBe(1);
    expect(json.data.chemistsCount).toBe(1);
  });

  it("allows appending a 2nd single day dynamically without resetting or auto-filling 27 days", async () => {
    const date1Str = "2026-10-20";
    const date2Str = "2026-10-21";

    // Day 1
    await createSingleDay(
      jsonRequest("/api/sfa/tour-plan/single-day", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          date: date1Str,
          territoryId: fx.territoryId,
          doctorIds: [fx.doctorId],
        },
      }),
      noParams
    );

    // Append Day 2
    await createSingleDay(
      jsonRequest("/api/sfa/tour-plan/single-day", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          date: date2Str,
          territoryId: fx.territoryId,
          doctorIds: [fx.doctorId],
          chemistIds: [fx.chemistId],
        },
      }),
      noParams
    );

    const plans = await testDb.tourPlan.findMany({
      where: { employeeId: fx.mrEmployeeId },
      include: { days: true },
    });

    expect(plans.length).toBe(1);
    // 1 stop on Day 1 + 2 stops on Day 2 = 3 stops total
    expect(plans[0].days.length).toBe(3);

    const uniqueDates = Array.from(new Set(plans[0].days.map((d) => toDateStr(d.date))));
    expect(uniqueDates.length).toBe(2);
    expect(uniqueDates).toContain(date1Str);
    expect(uniqueDates).toContain(date2Str);
  });

  it("supports checking off calls on the field (DONE / PENDING)", async () => {
    const weekdayStr = "2026-10-20";

    await createSingleDay(
      jsonRequest("/api/sfa/tour-plan/single-day", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          date: weekdayStr,
          territoryId: fx.territoryId,
          chemistIds: [fx.chemistId],
        },
      }),
      noParams
    );

    const dayEntry = await testDb.tourPlanDay.findFirst({
      where: { plannedDoctorId: null },
    });
    expect(dayEntry).not.toBeNull();
    expect(dayEntry?.visitStatus).toBe("PENDING");

    // Toggle to DONE on the field
    const res = await toggleVisit(
      jsonRequest("/api/sfa/tour-plan/toggle-visit", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          dayId: dayEntry!.id,
          status: "DONE",
        },
      }),
      noParams
    );

    expect(res.status).toBe(200);
    const updated = await testDb.tourPlanDay.findUnique({
      where: { id: dayEntry!.id },
    });
    expect(updated?.visitStatus).toBe("DONE");
    expect(updated?.isCompleted).toBe(true);
  });
});
