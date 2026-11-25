import { Role, TourPlanStatus } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  formRequest,
  jsonRequest,
  readJson,
  noParams,
  pngBlob,
  TestFixture,
} from "./helpers/api";
import { POST as createVisit } from "../app/api/mr/visits/route";
import { PUT as updateVisit } from "../app/api/mr/visits/[id]/route";
import { GET as getEntityById } from "../app/api/mr/entities/route";
import { GET as getPrescribedDoctors } from "../app/api/chemists/prescribed-doctors/route";
import { CallComplianceAgentsService } from "../services/call-compliance-agents.service";

describe("Complete Call Accuracy: Optional Phone, Real GPS Tracking, Photo Persistence & Tour Plan Isolation", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    await testDb.workflowSettings.upsert({
      where: { id: "singleton" },
      update: { enforceTourPlan: false, requirePhoto: false },
      create: { id: "singleton", enforceTourPlan: false, requirePhoto: false },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("allows completing a call WITHOUT phone number when doctor has no phone on file", async () => {
    const docNoPhone = await testDb.doctor.create({
      data: {
        fullName: "Dr. Optional Phone Doc",
        primarySpecialty: "General",
        clinicAddress: "10 Main St",
        latitude: 17.42,
        longitude: 78.44,
        territoryId: fx.territoryId,
        mobile: null,
        whatsApp: null,
      },
    });

    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: docNoPhone.id,
          purpose: "Product detailing",
          latitude: "17.4201",
          longitude: "78.4402",
          accuracy: "12",
          durationMinutes: "6",
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.success).toBe(true);
    expect(json.data.gpsTracking.captured).toBe(true);
    expect(json.data.gpsTracking.distanceFromEntityMeters).toBeLessThan(100);

    // LocationLog created automatically for real GPS fix
    const locCount = await testDb.locationLog.count({ where: { employeeId: fx.mrEmployeeId } });
    expect(locCount).toBe(1);
  });

  it("rejects dummy or short phone ONLY when a phone number is explicitly supplied", async () => {
    expect(CallComplianceAgentsService.verifyOptionalPhone("").isValid).toBe(true);
    expect(CallComplianceAgentsService.verifyOptionalPhone(null).isValid).toBe(true);
    expect(CallComplianceAgentsService.verifyOptionalPhone("0000000000").isValid).toBe(false);
    expect(CallComplianceAgentsService.verifyOptionalPhone("9848011223").isValid).toBe(false);

    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Product detailing",
          phone: "0000000000",
          latitude: "28.7041",
          longitude: "77.1025",
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(res.status).toBe(400);
  });

  it("records locationUnavailable=true (no fake 17.3616 fallback) and persists verification photoPath", async () => {
    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Detailing with photo",
          latitude: "0",
          longitude: "0",
          locationUnavailable: "true",
          durationMinutes: "5",
          receptiveness: "POSITIVE",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    const visit = await testDb.visit.findUnique({ where: { id: json.data.visitId } });
    expect(visit).not.toBeNull();
    expect(visit?.locationUnavailable).toBe(true);
    expect(visit?.latitude).toBe(0);
    expect(visit?.longitude).toBe(0);
    expect(visit?.photoPath).not.toBeNull();
    expect(visit?.receptiveness).toBe("POSITIVE");
    expect(json.data.visit.photoUrl).toContain("/uploads/visits/");
  });

  it("does NOT overwrite today's planned Chemist stop when completing an unplanned Doctor call with nearby chemist", async () => {
    const otherDoc = await testDb.doctor.create({
      data: {
        fullName: "Dr. Unplanned Specialist",
        primarySpecialty: "Ortho",
        clinicAddress: "Side Lane",
        latitude: 28.71,
        longitude: 77.11,
        territoryId: fx.territoryId,
      },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const chemMarker = `[Chemist Visit: Test Chemist]<!--PLANNED_CHEMIST:${JSON.stringify({
      id: fx.chemistId,
      name: "Test Chemist",
    })}-->`;

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
              plannedDoctorId: null,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: chemMarker,
            },
          ],
        },
      },
      include: { days: true },
    });

    const chemDayId = plan.days[0].id;

    // Complete unplanned Doctor call with nearby chemist tagged
    const visitRes = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: otherDoc.id,
          purpose: "New product launch",
          latitude: "28.71",
          longitude: "77.11",
          nearbyChemistType: "NEAREST_CHEMIST",
          nearbyChemistId: fx.chemistId,
          nearbyChemistName: "Test Chemist",
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(visitRes.status).toBe(200);
    const chemDayAfter = await testDb.tourPlanDay.findUnique({ where: { id: chemDayId } });
    // Planned Chemist row must stay PENDING and preserve its <!--PLANNED_CHEMIST--> tag!
    expect(chemDayAfter?.visitStatus).toBe("PENDING");
    expect(chemDayAfter?.isCompleted).toBe(false);
    expect(chemDayAfter?.completionNotes).toContain("<!--PLANNED_CHEMIST:");
  });

  it("returns doctor phone via /api/chemists/prescribed-doctors, hydrates single entity by id, and syncs Chemist TP stop", async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const chemMarker = `[Chemist Visit: Test Chemist]<!--PLANNED_CHEMIST:${JSON.stringify({
      id: fx.chemistId,
      name: "Test Chemist",
    })}-->`;

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
              plannedDoctorId: null,
              visitStatus: "PENDING",
              isCompleted: false,
              completionNotes: chemMarker,
            },
          ],
        },
      },
      include: { days: true },
    });
    const chemDayId = plan.days[0].id;

    // 1. Hydrate chemist by id
    const entRes = await getEntityById(
      jsonRequest(`/api/mr/entities?id=${fx.chemistId}&type=CHEMIST`, {
        token: tokenFor(fx.mrUserId, Role.MR),
      }),
      noParams
    );
    expect(entRes.status).toBe(200);
    const entJson = await readJson(entRes);
    expect(entJson.data.entity.name).toBe("Test Chemist");

    // 2. Fetch prescribed doctors and verify phone is included
    const docRes = await getPrescribedDoctors(
      jsonRequest(`/api/chemists/prescribed-doctors?chemistId=${fx.chemistId}`, {
        token: tokenFor(fx.mrUserId, Role.MR),
      }),
      noParams
    );
    expect(docRes.status).toBe(200);
    const docJson = await readJson(docRes);
    expect(docJson.data.doctors.length).toBeGreaterThanOrEqual(1);
    expect(docJson.data.doctors[0].phone).toBe("+919876543210");

    // 3a. Dummy prescribedDoctorPhone must be rejected (when provided)
    const badDocPhoneRes = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          chemistId: fx.chemistId,
          tourPlanDayId: chemDayId,
          prescribedDoctorId: fx.doctorId,
          prescribedDoctorPhone: "9848011223",
          purpose: "Order collection",
          latitude: "28.69",
          longitude: "77.095",
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(badDocPhoneRes.status).toBe(400);

    // 3b. Complete Chemist call WITHOUT chemist phone (optional), WITH prescribedDoctorId + valid prescribedDoctorPhone + tourPlanDayId
    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          chemistId: fx.chemistId,
          tourPlanDayId: chemDayId,
          prescribedDoctorId: fx.doctorId,
          prescribedDoctorPhone: "9123456789",
          purpose: "Order collection",
          latitude: "28.69",
          longitude: "77.095",
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.tourPlanSync.tourPlanSynced).toBe(true);

    const savedVisit = await testDb.visit.findUnique({ where: { id: json.data.visitId } });
    expect(savedVisit?.feedback).toContain("Prescribed Doctor: Dr. Test (9123456789)");

    const updatedDoc = await testDb.doctor.findUnique({ where: { id: fx.doctorId } });
    expect(updatedDoc?.mobile).toBe("9123456789");
    expect(updatedDoc?.whatsApp).toBe("9123456789");

    const updatedChemDay = await testDb.tourPlanDay.findUnique({ where: { id: chemDayId } });
    expect(updatedChemDay?.visitStatus).toBe("DONE");
    expect(updatedChemDay?.isCompleted).toBe(true);

    // 4. Edit visit without phone (optional) succeeds
    const editRes = await updateVisit(
      jsonRequest(`/api/mr/visits/${json.data.visitId}`, {
        method: "PUT",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { purpose: "Updated call purpose", durationMinutes: 10 },
      }),
      { params: { id: json.data.visitId } }
    );
    expect(editRes.status).toBe(200);
  });
});
