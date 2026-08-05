import { Role, TourPlanStatus } from "@prisma/client";
import {
  testDb,
  resetFixture,
  approveTourPlanForToday,
  tokenFor,
  jsonRequest,
  formRequest,
  readJson,
  noParams,
  pngBlob,
  TestFixture,
} from "./helpers/api";
import { POST as submitTourPlan } from "../app/api/sfa/tour-plan/submit/route";
import { POST as approveTourPlan } from "../app/api/sfa/tour-plan/approve/route";
import { POST as createVisit } from "../app/api/mr/visits/route";
import { POST as createOrder } from "../app/api/orders/secondary/route";
import { POST as uploadClaim } from "../app/api/expenses/claims/upload/route";
import { PUT as reviewLeave, POST as createLeave } from "../app/api/hrms/leave/route";
import { GET as adminKpis } from "../app/api/manager/dashboard/admin-kpis/route";
import { GET as getMrDashboard } from "../app/api/mr/dashboard/route";
import { startOfUtcDay, startOfUtcMonth } from "../lib/date";

describe("Tour plan approval gates DCR submission", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    await testDb.workflowSettings.upsert({
      where: { id: "singleton" },
      update: { enforceTourPlan: true },
      create: { id: "singleton", enforceTourPlan: true },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("blocks a doctor visit when no approved tour plan covers today", async () => {
    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Unplanned drop-in",
          latitude: "28.7041",
          longitude: "77.1025",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(res.status).toBe(400);
    expect((await readJson(res)).error.message).toMatch(/not on your approved Tour Plan/i);
  });

  it("allows the visit once the tour plan is approved", async () => {
    await approveTourPlanForToday(fx);

    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Planned detailing call",
          latitude: "28.7041",
          longitude: "77.1025",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(res.status).toBe(200);
    expect((await readJson(res)).data.success).toBe(true);
  });

  it("still enforces the geofence on an approved doctor", async () => {
    await approveTourPlanForToday(fx);

    const res = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Too far away",
          latitude: "28.9041", // ~22km from the clinic
          longitude: "77.3025",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    expect(res.status).toBe(400);
    expect((await readJson(res)).error.message).toMatch(/Geofence/i);
  });

  it("scores CQS when a duration is supplied", async () => {
    await approveTourPlanForToday(fx);

    await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Scored call",
          latitude: "28.7041",
          longitude: "77.1025",
          durationMinutes: "6",
          samples: JSON.stringify([{ productId: fx.productId, quantity: 2 }]),
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    const visit = await testDb.visit.findFirst({ where: { doctorId: fx.doctorId } });
    expect(visit?.durationMinutes).toBe(6);
    expect(visit?.cqsScore).toBeGreaterThan(0);
  });

  it("flags physically impossible travel between consecutive DCR submissions", async () => {
    await approveTourPlanForToday(fx);

    // 1. Submit first DCR visit
    const res1 = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "First visit",
          latitude: "28.7041",
          longitude: "77.1025",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(res1.status).toBe(200);

    // 2. Submit second DCR visit immediately to a distant chemist (~1.5km away)
    const res2 = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          chemistId: fx.chemistId,
          purpose: "Second visit immediate",
          latitude: "28.6900",
          longitude: "77.0950",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(res2.status).toBe(200);

    // 3. Query anomaly reviews for the second visit
    const lastVisit = await testDb.visit.findFirst({
      where: { chemistId: fx.chemistId },
      include: { anomalyReviews: true },
    });
    
    expect(lastVisit?.anomalyReviews).toHaveLength(1);
    expect(lastVisit?.anomalyReviews[0].status).toBe("PENDING");
    expect(lastVisit?.anomalyReviews[0].reviewNotes).toMatch(/Automated compliance alert/);
  });

  it("moves a submitted plan through PENDING_ASM to APPROVED", async () => {
    const submitRes = await submitTourPlan(
      jsonRequest("/api/sfa/tour-plan/submit", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          month: startOfUtcMonth().toISOString(),
          days: [
            {
              date: startOfUtcDay().toISOString(),
              territoryId: fx.territoryId,
              plannedDoctorId: fx.doctorId,
            },
          ],
        },
      }),
      noParams
    );
    expect(submitRes.status).toBe(200);
    const { tourPlanId, status } = (await readJson(submitRes)).data;
    expect(status).toBe(TourPlanStatus.PENDING_ASM);

    const approveRes = await approveTourPlan(
      jsonRequest("/api/sfa/tour-plan/approve", {
        method: "POST",
        token: tokenFor(fx.asmUserId, Role.ASM),
        body: { tourPlanId },
      }),
      noParams
    );
    expect(approveRes.status).toBe(200);
    expect((await readJson(approveRes)).data.status).toBe(TourPlanStatus.APPROVED);
  });

  it("refuses to approve a plan that is not pending", async () => {
    await approveTourPlanForToday(fx);
    const plan = await testDb.tourPlan.findFirst({ where: { employeeId: fx.mrEmployeeId } });

    const res = await approveTourPlan(
      jsonRequest("/api/sfa/tour-plan/approve", {
        method: "POST",
        token: tokenFor(fx.asmUserId, Role.ASM),
        body: { tourPlanId: plan!.id },
      }),
      noParams
    );
    expect(res.status).toBe(400);
  });
});

describe("Secondary orders apply discount schemes", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    await testDb.discountScheme.create({
      data: {
        name: "Bulk 50+",
        productId: fx.productId,
        minQuantity: 50,
        discountPct: 5,
        isActive: true,
        validFrom: startOfUtcMonth(),
        validTo: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)),
      },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  const placeOrder = (fx: TestFixture, quantity: number) =>
    createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity }],
        },
      }),
      noParams
    );

  it("charges full PTR below the quantity threshold", async () => {
    const res = await placeOrder(fx, 10);
    expect(res.status).toBe(201);
    const body = await readJson(res);
    expect(Number(body.data.order.items[0].price)).toBe(120);
    expect(body.data.appliedSchemes).toHaveLength(0);
  });

  it("applies the scheme discount at the threshold", async () => {
    const res = await placeOrder(fx, 100);
    const body = await readJson(res);
    expect(Number(body.data.order.items[0].price)).toBe(114); // 5% off 120
    expect(body.data.appliedSchemes[0].discountPct).toBe(5);
  });

  it("ignores an inactive scheme", async () => {
    await testDb.discountScheme.updateMany({ data: { isActive: false } });
    const res = await placeOrder(fx, 100);
    const body = await readJson(res);
    expect(Number(body.data.order.items[0].price)).toBe(120);
  });

  it("rejects an order referencing an unknown product", async () => {
    const res = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: "00000000-0000-4000-8000-000000000000", quantity: 1 }],
        },
      }),
      noParams
    );
    expect(res.status).toBe(400);
  });
});

describe("Expense claims reject duplicate receipts", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("accepts a first claim then rejects the identical receipt with 409", async () => {
    const receipt = () => new Blob(["identical-receipt-bytes"], { type: "image/png" });
    const token = tokenFor(fx.mrUserId, Role.MR);

    const first = await uploadClaim(
      formRequest(
        "/api/expenses/claims/upload",
        { amount: "350", category: "Mileage", receipt: receipt() },
        { token }
      ),
      noParams
    );
    expect(first.status).toBe(200);

    const second = await uploadClaim(
      formRequest(
        "/api/expenses/claims/upload",
        { amount: "350", category: "Mileage", receipt: receipt() },
        { token }
      ),
      noParams
    );
    expect(second.status).toBe(409);
    expect((await readJson(second)).error.message).toMatch(/duplicate/i);
  });

  it("accepts a different receipt from the same employee", async () => {
    const token = tokenFor(fx.mrUserId, Role.MR);

    await uploadClaim(
      formRequest(
        "/api/expenses/claims/upload",
        { amount: "100", category: "Mileage", receipt: new Blob(["receipt-one"], { type: "image/png" }) },
        { token }
      ),
      noParams
    );

    const second = await uploadClaim(
      formRequest(
        "/api/expenses/claims/upload",
        { amount: "200", category: "Meals", receipt: new Blob(["receipt-two"], { type: "image/png" }) },
        { token }
      ),
      noParams
    );
    expect(second.status).toBe(200);
  });
});

describe("Approved leave frees tour plan days", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    await approveTourPlanForToday(fx);
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("deletes tour plan days inside the approved leave range", async () => {
    expect(await testDb.tourPlanDay.count()).toBe(1);

    const today = startOfUtcDay();
    const createRes = await createLeave(
      jsonRequest("/api/hrms/leave", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { startDate: today.toISOString(), endDate: today.toISOString(), type: "CASUAL" },
      }),
      noParams
    );
    expect(createRes.status).toBe(201);
    const leaveRequestId = (await readJson(createRes)).data.leaveRequest.id;

    const reviewRes = await reviewLeave(
      jsonRequest("/api/hrms/leave", {
        method: "PUT",
        token: tokenFor(fx.asmUserId, Role.ASM),
        body: { leaveRequestId, status: "APPROVED" },
      }),
      noParams
    );
    expect(reviewRes.status).toBe(200);
    expect(await testDb.tourPlanDay.count()).toBe(0);
  });

  it("leaves the calendar intact when the leave is rejected", async () => {
    const today = startOfUtcDay();
    const createRes = await createLeave(
      jsonRequest("/api/hrms/leave", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { startDate: today.toISOString(), endDate: today.toISOString(), type: "CASUAL" },
      }),
      noParams
    );
    const leaveRequestId = (await readJson(createRes)).data.leaveRequest.id;

    await reviewLeave(
      jsonRequest("/api/hrms/leave", {
        method: "PUT",
        token: tokenFor(fx.asmUserId, Role.ASM),
        body: { leaveRequestId, status: "REJECTED" },
      }),
      noParams
    );

    expect(await testDb.tourPlanDay.count()).toBe(1);
  });
});

describe("MR daily dashboard", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
    await approveTourPlanForToday(fx);
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  const load = (token: string, employeeId?: string) =>
    getMrDashboard(
      jsonRequest(
        employeeId ? `/api/mr/dashboard?employeeId=${employeeId}` : "/api/mr/dashboard",
        { token }
      ),
      noParams
    );

  it("counts a planned call as pending until it is logged", async () => {
    const before = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(before.data.todaysVisits.planned).toBe(1);
    expect(before.data.pendingVisits.count).toBe(1);
    expect(before.data.completedVisits.total).toBe(0);

    await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Planned call",
          latitude: "28.7041",
          longitude: "77.1025",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    const after = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(after.data.pendingVisits.count).toBe(0);
    expect(after.data.completedVisits.planned).toBe(1);
  });

  it("attributes booked orders to the rep as Sales Today", async () => {
    await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity: 10 }],
        },
      }),
      noParams
    );

    const body = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(body.data.salesToday.amount).toBe(1200); // 10 x PTR 120
  });

  it("derives travel distance and GPS status from the day's fixes", async () => {
    const now = Date.now();
    await testDb.locationLog.createMany({
      data: [
        {
          employeeId: fx.mrEmployeeId,
          latitude: 28.7041,
          longitude: 77.1025,
          isMocked: false,
          recordedAt: new Date(now - 60 * 60 * 1000),
        },
        {
          employeeId: fx.mrEmployeeId,
          latitude: 28.7141,
          longitude: 77.1025,
          isMocked: false,
          recordedAt: new Date(now - 5 * 60 * 1000),
        },
      ],
    });

    const body = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(body.data.travelDistance.km).toBeGreaterThan(0);
    expect(body.data.travelDistance.fixes).toBe(2);
    expect(body.data.gpsStatus.status).toBe("ACTIVE");
  });

  it("reports NO_SIGNAL when no fix was recorded", async () => {
    const body = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(body.data.gpsStatus.status).toBe("NO_SIGNAL");
    expect(body.data.travelDistance.km).toBe(0);
  });

  it("lets a manager drill into a specific rep", async () => {
    const res = await load(tokenFor(fx.adminUserId, Role.ADMIN), fx.mrEmployeeId);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.employee.isSelf).toBe(false);
    expect(body.data.employee.name).toBe("Mr User");
  });

  it("forbids an MR from viewing another rep's dashboard", async () => {
    const res = await load(tokenFor(fx.mrUserId, Role.MR), fx.mrEmployeeId);
    expect(res.status).toBe(403);
  });

  it("surfaces a critical alert when a spoofed fix is recorded", async () => {
    await testDb.attendance.create({
      data: {
        employeeId: fx.mrEmployeeId,
        date: startOfUtcDay(),
        status: "PRESENT",
        checkIn: new Date(),
        latitude: 28.7041,
        longitude: 77.1025,
      },
    });
    await testDb.locationLog.create({
      data: {
        employeeId: fx.mrEmployeeId,
        latitude: 28.7041,
        longitude: 77.1025,
        isMocked: true,
        recordedAt: new Date(),
      },
    });

    const body = await readJson(await load(tokenFor(fx.mrUserId, Role.MR)));
    expect(body.data.gpsStatus.status).toBe("MOCKED");
    const critical = body.data.notifications.find((n: any) => n.severity === "CRITICAL");
    expect(critical.code).toBe("GPS_MOCKED");
  });
});

describe("Admin KPIs reflect logged activity", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await resetFixture();
    await approveTourPlanForToday(fx);
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("counts a hospital visit toward hospital coverage", async () => {
    const before = await adminKpis(
      jsonRequest("/api/manager/dashboard/admin-kpis", {
        token: tokenFor(fx.adminUserId, Role.ADMIN),
      }),
      noParams
    );
    expect((await readJson(before)).data.hospitalsCovered).toEqual({ visited: 0, total: 1 });

    await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          hospitalId: fx.hospitalId,
          purpose: "Institutional call",
          latitude: "28.7200",
          longitude: "77.1100",
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );

    const after = await adminKpis(
      jsonRequest("/api/manager/dashboard/admin-kpis", {
        token: tokenFor(fx.adminUserId, Role.ADMIN),
      }),
      noParams
    );
    expect((await readJson(after)).data.hospitalsCovered).toEqual({ visited: 1, total: 1 });
  });
});
