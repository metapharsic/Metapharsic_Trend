import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson } from "./helpers/api";
import { GET as getSamples } from "../app/api/mr/samples/route";
import { GET as getEntities } from "../app/api/mr/entities/route";
import { CallComplianceAgentsService } from "../services/call-compliance-agents.service";

describe("MR Complete Call Form & Samples Parity", () => {
  let fx: any;

  beforeEach(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("ensures canonical sample stock auto-provisions and returns for MR in /api/mr/samples", async () => {
    // Delete any existing sample inventory for the test MR to simulate an unallocated MR
    await testDb.sampleInventory.deleteMany({
      where: { employeeId: fx.mrEmployeeId },
    });

    const res = await getSamples(
      jsonRequest("/api/mr/samples", {
        method: "GET",
        token: tokenFor(fx.mrUserId, Role.MR),
      })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.samples).toBeDefined();
    expect(body.data.samples.length).toBeGreaterThanOrEqual(1);
    expect(body.data.totalEstimatedValue).toBeGreaterThan(0);

    const firstSample = body.data.samples[0];
    expect(firstSample.quantity).toBeGreaterThan(0);
    expect(firstSample.productName).toBeDefined();
  });

  it("allows searching doctor across territories with fallback when territory filter has no match", async () => {
    // Create a doctor in a DIFFERENT territory that is not assigned to this MR
    const otherTerritory = await testDb.territory.create({
      data: { name: "Other Zone", region: "Other", zone: "Other", priority: 1 },
    });
    await testDb.doctor.create({
      data: {
        fullName: "Dr. Srinivas Rao",
        primarySpecialty: "Neurology",
        clinicAddress: "99 Out Rd",
        latitude: 28.7041,
        longitude: 77.1025,
        territoryId: otherTerritory.id,
      },
    });

    const req = jsonRequest(`/api/mr/entities?type=DOCTOR&search=Srinivas`, {
      method: "GET",
      token: tokenFor(fx.mrUserId, Role.MR),
    });

    const res = await getEntities(req);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.data.entities).toBeDefined();
    expect(body.data.entities.length).toBeGreaterThanOrEqual(1);
    expect(body.data.entities[0].name).toContain("Srinivas");
  });

  it("does not return hardcoded dummy phone 9848011223 when entity has no phone on file", async () => {
    const docNoPhone = await testDb.doctor.create({
      data: {
        fullName: "Dr. Ananya Reddy",
        primarySpecialty: "Pediatrics",
        clinicAddress: "Banjara Hills Rd 12",
        latitude: 17.4156,
        longitude: 78.4357,
        territoryId: fx.territoryId,
      },
    });

    const docWithPhone = await testDb.doctor.create({
      data: {
        fullName: "Dr. Vikram Seth",
        primarySpecialty: "Cardiology",
        clinicAddress: "Jubilee Hills Rd 36",
        mobile: "9123456789",
        latitude: 17.4325,
        longitude: 78.4071,
        territoryId: fx.territoryId,
      },
    });

    const reqNoPhone = jsonRequest(`/api/mr/entities?type=DOCTOR&search=Ananya`, {
      method: "GET",
      token: tokenFor(fx.mrUserId, Role.MR),
    });
    const resNoPhone = await getEntities(reqNoPhone);
    const bodyNoPhone = await readJson(resNoPhone);
    expect(bodyNoPhone.data.entities[0].phone).toBeNull();

    const reqWithPhone = jsonRequest(`/api/mr/entities?type=DOCTOR&search=Vikram`, {
      method: "GET",
      token: tokenFor(fx.mrUserId, Role.MR),
    });
    const resWithPhone = await getEntities(reqWithPhone);
    const bodyWithPhone = await readJson(resWithPhone);
    expect(bodyWithPhone.data.entities[0].phone).toBe("9123456789");
  });

  it("validates phone input correctly and rejects dummy placeholder 9848011223", () => {
    // Rejects empty/missing
    expect(CallComplianceAgentsService.verifyMandatoryPhone("").isValid).toBe(false);
    expect(CallComplianceAgentsService.verifyMandatoryPhone(null).isValid).toBe(false);

    // Rejects under 10 digits
    expect(CallComplianceAgentsService.verifyMandatoryPhone("123456789").isValid).toBe(false);

    // Rejects placeholder 9848011223
    const placeholderCheck = CallComplianceAgentsService.verifyMandatoryPhone("9848011223");
    expect(placeholderCheck.isValid).toBe(false);
    expect(placeholderCheck.error).toContain("placeholder");

    // Accepts authentic 10-digit phone
    const validCheck = CallComplianceAgentsService.verifyMandatoryPhone("9876543210");
    expect(validCheck.isValid).toBe(true);
    expect(validCheck.cleanPhone).toBe("9876543210");

    // Accepts formatted with +91
    const countryCodeCheck = CallComplianceAgentsService.verifyMandatoryPhone("+91 98765 43210");
    expect(countryCodeCheck.isValid).toBe(true);
    expect(countryCodeCheck.cleanPhone).toBe("9876543210");
  });
});
