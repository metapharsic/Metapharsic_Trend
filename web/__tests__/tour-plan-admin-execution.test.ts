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
import { GET as getWhatsAppVote } from "../app/api/sfa/tour-plan/whatsapp-vote/route";
import { POST as toggleVisit } from "../app/api/sfa/tour-plan/toggle-visit/route";
import { DELETE as deleteTourPlanById } from "../app/api/sfa/tour-plan/[id]/route";
import { DELETE as deleteTourPlan } from "../app/api/sfa/tour-plan/route";
import { startOfUtcDay, startOfUtcMonth } from "../lib/date";

describe("Tour Plan Admin Exemption, Metapharsic-MR WhatsApp Group & Visit Execution", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("Admin Approval Exemption", () => {
    it("submits an MR tour plan in PENDING_ASM status", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const res = await submitTourPlan(
        jsonRequest("/api/sfa/tour-plan/submit", {
          method: "POST",
          token: tokenFor(fx.mrUserId, Role.MR),
          body: {
            month: month.toISOString(),
            days: [
              {
                date: today.toISOString(),
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        }),
        noParams
      );

      expect(res.status).toBe(200);
      const data = (await readJson(res)).data;
      expect(data.status).toBe(TourPlanStatus.PENDING_ASM);
    });

    it("automatically APPROVES an Admin-submitted tour plan without any approval barrier", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const res = await submitTourPlan(
        jsonRequest("/api/sfa/tour-plan/submit", {
          method: "POST",
          token: tokenFor(fx.adminUserId, Role.ADMIN),
          body: {
            month: month.toISOString(),
            days: [
              {
                date: today.toISOString(),
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        }),
        noParams
      );

      expect(res.status).toBe(200);
      const data = (await readJson(res)).data;
      expect(data.status).toBe(TourPlanStatus.APPROVED);
    });
  });

  describe("Metapharsic-MR Group WhatsApp Dispatch Guard", () => {
    it("refuses to generate WhatsApp group dispatch if the tour plan is not yet approved", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      // Create a pending tour plan for the MR
      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.PENDING_ASM,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        },
      });

      const res = await getWhatsAppVote(
        jsonRequest(`/api/sfa/tour-plan/whatsapp-vote?tourPlanId=${plan.id}`, {
          token: tokenFor(fx.adminUserId, Role.ADMIN),
        }),
        noParams
      );

      expect(res.status).toBe(400);
      const json = await readJson(res);
      expect(json.error.message).toMatch(/must be approved before dispatching to Metapharsic-MR Group/i);
    });

    it("allows Metapharsic-MR Group dispatch when approved and outputs Metapharsic-MR Group details", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.APPROVED,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        },
      });

      const res = await getWhatsAppVote(
        jsonRequest(`/api/sfa/tour-plan/whatsapp-vote?tourPlanId=${plan.id}`, {
          token: tokenFor(fx.adminUserId, Role.ADMIN),
        }),
        noParams
      );

      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.data.groupName).toBe("Metapharsic-MR Group");
      expect(json.data.message).toContain("METAPHARSIC-MR GROUP");
    });
  });

  describe("Interactive Visit Execution (Done / Not Done)", () => {
    it("allows toggling a visit between DONE, NOT_DONE, and PENDING with updated metrics", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.APPROVED,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
                visitStatus: "PENDING",
                isCompleted: false,
              },
            ],
          },
        },
        include: { days: true },
      });

      const dayId = plan.days[0].id;

      // 1. Mark as DONE
      const doneRes = await toggleVisit(
        jsonRequest("/api/sfa/tour-plan/toggle-visit", {
          method: "POST",
          token: tokenFor(fx.mrUserId, Role.MR),
          body: {
            dayId,
            status: "DONE",
            notes: "Doctor visited, detailed product catalog.",
          },
        }),
        noParams
      );

      expect(doneRes.status).toBe(200);
      const doneJson = await readJson(doneRes);
      expect(doneJson.data.day.visitStatus).toBe("DONE");
      expect(doneJson.data.day.isCompleted).toBe(true);
      expect(doneJson.data.day.completedAt).not.toBeNull();
      expect(doneJson.data.summary.completedVisitsCount).toBe(1);
      expect(doneJson.data.summary.executionRatePct).toBe(100);

      // 2. Mark as NOT_DONE
      const notDoneRes = await toggleVisit(
        jsonRequest("/api/sfa/tour-plan/toggle-visit", {
          method: "POST",
          token: tokenFor(fx.mrUserId, Role.MR),
          body: {
            dayId,
            status: "NOT_DONE",
            notes: "Doctor was in emergency surgery, call postponed.",
          },
        }),
        noParams
      );

      expect(notDoneRes.status).toBe(200);
      const notDoneJson = await readJson(notDoneRes);
      expect(notDoneJson.data.day.visitStatus).toBe("NOT_DONE");
      expect(notDoneJson.data.day.isCompleted).toBe(false);
      expect(notDoneJson.data.summary.completedVisitsCount).toBe(0);
      expect(notDoneJson.data.summary.notDoneVisitsCount).toBe(1);
      expect(notDoneJson.data.summary.executionRatePct).toBe(0);
    });
  });

  describe("Admin Tour Plan Deletion & Non-Admin RBAC", () => {
    it("allows Admin to delete an MR's APPROVED tour plan with cascading days deletion", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      // Create an approved plan for the MR
      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.APPROVED,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        },
        include: { days: true },
      });

      // Admin deletes the MR's approved tour plan
      const res = await deleteTourPlanById(
        jsonRequest(`/api/sfa/tour-plan/${plan.id}`, {
          method: "DELETE",
          token: tokenFor(fx.adminUserId, Role.ADMIN),
        }),
        { params: { id: plan.id } }
      );

      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.data.deleted).toBe(true);
      expect(json.data.tourPlanId).toBe(plan.id);
      expect(json.data.daysDeleted).toBe(1);

      // Verify deletion in database
      const inDb = await testDb.tourPlan.findUnique({ where: { id: plan.id } });
      expect(inDb).toBeNull();
      const daysInDb = await testDb.tourPlanDay.count({ where: { tourPlanId: plan.id } });
      expect(daysInDb).toBe(0);
    });

    it("blocks an MR from deleting their own APPROVED tour plan (403 Forbidden)", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.APPROVED,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        },
      });

      // MR attempts to delete approved plan
      const res = await deleteTourPlanById(
        jsonRequest(`/api/sfa/tour-plan/${plan.id}`, {
          method: "DELETE",
          token: tokenFor(fx.mrUserId, Role.MR),
        }),
        { params: { id: plan.id } }
      );

      expect(res.status).toBe(403);
      const json = await readJson(res);
      expect(json.error.message).toContain("forbidden after approval");

      // Cleanup
      await testDb.tourPlanDay.deleteMany({ where: { tourPlanId: plan.id } });
      await testDb.tourPlan.delete({ where: { id: plan.id } });
    });

    it("allows deletion via query param DELETE /api/sfa/tour-plan?id=...", async () => {
      const today = startOfUtcDay(new Date());
      const month = startOfUtcMonth(today);

      const plan = await testDb.tourPlan.create({
        data: {
          employeeId: fx.mrEmployeeId,
          month,
          status: TourPlanStatus.DRAFT,
          days: {
            create: [
              {
                date: today,
                territoryId: fx.territoryId,
                plannedDoctorId: fx.doctorId,
              },
            ],
          },
        },
      });

      const res = await deleteTourPlan(
        jsonRequest(`/api/sfa/tour-plan?id=${plan.id}`, {
          method: "DELETE",
          token: tokenFor(fx.adminUserId, Role.ADMIN),
        }),
        noParams
      );

      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.data.deleted).toBe(true);

      const inDb = await testDb.tourPlan.findUnique({ where: { id: plan.id } });
      expect(inDb).toBeNull();
    });
  });
});
