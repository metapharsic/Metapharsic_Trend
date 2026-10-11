import { Role } from "@prisma/client";
import { testDb, resetFixture, tokenFor, jsonRequest, readJson } from "./helpers/api";
import { GET as getSamples } from "../app/api/mr/samples/route";
import { GET as getEntities } from "../app/api/mr/entities/route";

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
});
