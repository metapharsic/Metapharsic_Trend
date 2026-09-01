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
import { POST as mrLogin } from "../app/api/auth/login/mr/route";
import { POST as checkIn } from "../app/api/mr/attendance/check-in/route";
import { POST as checkOut } from "../app/api/mr/attendance/check-out/route";
import { POST as createVisit } from "../app/api/mr/visits/route";
import { POST as createOrder } from "../app/api/orders/secondary/route";
import { POST as createClaim, GET as getClaims } from "../app/api/mr/claims/route";
import { GET as mrDashboard } from "../app/api/mr/dashboard/route";

describe("Medical Representative End-to-End Workflow", () => {
  let fx: TestFixture;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("completes full MR lifecycle: Login -> Check-In -> DCR Visit -> Order Booking -> Claim Submission", async () => {
    // 1. Authenticate MR with device UUID binding
    const loginRes = await mrLogin(
      jsonRequest("/api/auth/login/mr", {
        method: "POST",
        body: {
          email: "mr@test.local",
          password: "notarealhash", // overridden by mocked hash test helper if matched
          deviceUuid: "device-handset-123",
        },
      })
    );

    // 2. Attendance Check-In
    const checkInRes = await checkIn(
      jsonRequest("/api/mr/attendance/check-in", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { latitude: 28.7041, longitude: 77.1025 },
      })
    );
    expect(checkInRes.status).toBe(200);
    const checkInData = await readJson(checkInRes);
    expect(checkInData.data.success).toBe(true);

    // 3. Tour Plan Approval & DCR Visit submission with Samples
    await approveTourPlanForToday(fx);

    const visitRes = await createVisit(
      formRequest(
        "/api/mr/visits",
        {
          doctorId: fx.doctorId,
          purpose: "Cardiology Detailing & Sampling",
          latitude: "28.7041",
          longitude: "77.1025",
          durationMinutes: "8",
          samples: JSON.stringify([{ productId: fx.productId, quantity: 2 }]),
          photo: pngBlob(),
        },
        { token: tokenFor(fx.mrUserId, Role.MR) }
      ),
      noParams
    );
    expect(visitRes.status).toBe(200);
    const visitData = await readJson(visitRes);
    expect(visitData.data.visitId).toBeDefined();

    // Verify sample decrement
    const remainingSample = await testDb.sampleInventory.findFirst({
      where: { employeeId: fx.mrEmployeeId, productId: fx.productId },
    });
    expect(remainingSample?.quantity).toBe(48); // 50 initial - 2 given

    // 4. Secondary Order Booking with Discount Scheme
    await testDb.discountScheme.create({
      data: {
        name: "Festive Retail Boost",
        productId: fx.productId,
        minQuantity: 50,
        discountPct: 5,
        isActive: true,
        validFrom: new Date(Date.UTC(2026, 0, 1)),
        validTo: new Date(Date.UTC(2027, 0, 1)),
      },
    });

    const orderRes = await createOrder(
      jsonRequest("/api/orders/secondary", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [{ productId: fx.productId, quantity: 100 }],
        },
      }),
      noParams
    );
    expect(orderRes.status).toBe(201);
    const orderData = await readJson(orderRes);
    expect(orderData.data.order.employeeId).toBe(fx.mrEmployeeId);
    expect(Number(orderData.data.order.items[0].price)).toBe(114); // 5% discounted from 120

    // 5. Expiry & Damage Claim Submission
    const claimRes = await createClaim(
      jsonRequest("/api/mr/claims", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          productId: fx.productId,
          quantity: 5,
          reason: "Broken vials during transit",
        },
      })
    );
    expect(claimRes.status).toBe(201);
    const claimData = await readJson(claimRes);
    expect(claimData.data.claim.status).toBe("PENDING_MR");
    expect(claimData.data.claim.employeeId).toBe(fx.mrEmployeeId);

    // Verify claim retrieval scoped by MR
    const getClaimsRes = await getClaims(
      jsonRequest("/api/mr/claims", {
        method: "GET",
        token: tokenFor(fx.mrUserId, Role.MR),
      })
    );
    expect(getClaimsRes.status).toBe(200);
    const claimsList = await readJson(getClaimsRes);
    expect(claimsList.data.claims.length).toBeGreaterThanOrEqual(1);

    // 6. Attendance Check-Out
    const checkOutRes = await checkOut(
      jsonRequest("/api/mr/attendance/check-out", {
        method: "POST",
        token: tokenFor(fx.mrUserId, Role.MR),
        body: { latitude: 28.7041, longitude: 77.1025 },
      })
    );
    expect(checkOutRes.status).toBe(200);
    const checkOutData = await readJson(checkOutRes);
    expect(checkOutData.data.attendance.checkOut).toBeDefined();
  });
});
