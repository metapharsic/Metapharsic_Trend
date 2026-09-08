import {
  FieldCoverageAgent,
  CallProductivityAgent,
  EngagementQualityAgent,
  SampleGiftDistributionAgent,
  OrderConversionAgent,
  GeographicComplianceAgent,
} from "../services/mr-daily-calls-agents.service";

describe("MR Daily Calls Multi-Agent Suite", () => {
  const sampleVisits = [
    {
      id: "visit-1",
      employeeId: "emp-1",
      doctorId: "doc-1",
      chemistId: null,
      hospitalId: null,
      purpose: "Product Detailing",
      startedAt: new Date("2026-09-08T09:00:00.000Z"),
      endedAt: new Date("2026-09-08T09:12:30.000Z"),
      durationMinutes: 12,
      boxesPlaced: 5,
      cqsScore: 4.5,
      doctor: { fullName: "Dr. A. Sharma", specialty: "Cardiology" },
      employee: { id: "emp-1", firstName: "Abdul", lastName: "Mubeen" },
    },
    {
      id: "visit-2",
      employeeId: "emp-1",
      doctorId: null,
      chemistId: "chem-1",
      hospitalId: null,
      purpose: "Stock Check & Order Closure",
      startedAt: new Date("2026-09-08T10:30:00.000Z"),
      endedAt: new Date("2026-09-08T10:40:00.000Z"),
      durationMinutes: 10,
      boxesPlaced: 2,
      cqsScore: 4.0,
      chemist: { name: "City Pharmacy" },
      employee: { id: "emp-1", firstName: "Abdul", lastName: "Mubeen" },
    },
    {
      id: "visit-3",
      employeeId: "emp-1",
      doctorId: null,
      chemistId: null,
      hospitalId: "hosp-1",
      purpose: "Formulary Submission",
      startedAt: new Date("2026-09-08T11:45:00.000Z"),
      endedAt: new Date("2026-09-08T12:00:00.000Z"),
      durationMinutes: 15,
      boxesPlaced: 0,
      cqsScore: 3.5,
      hospital: { name: "Apollo General Hospital" },
      employee: { id: "emp-1", firstName: "Abdul", lastName: "Mubeen" },
    },
  ];

  const sampleOrders = [
    {
      id: "ord-1",
      employeeId: "emp-1",
      createdAt: new Date("2026-09-08T10:35:00.000Z"),
      items: [
        {
          quantity: 20,
          price: 150,
          product: { ptr: 150, pts: 120, name: "CardioFix 50mg" },
        },
      ],
    },
  ];

  it("FieldCoverageAgent computes reach & specialty breakdown", async () => {
    const res = await FieldCoverageAgent.evaluate(sampleVisits);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.totalVisits).toBe(3);
    expect(res.metrics.doctorVisits).toBe(1);
    expect(res.metrics.chemistVisits).toBe(1);
    expect(res.metrics.hospitalVisits).toBe(1);
    expect(res.metrics.uniqueDoctors).toBe(1);
    expect(res.findings.length).toBeGreaterThan(0);
  });

  it("CallProductivityAgent computes duration in seconds and minutes", async () => {
    const res = await CallProductivityAgent.evaluate(sampleVisits);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.countWithDuration).toBe(3);
    expect(res.metrics.avgDurationMinutes).toBeGreaterThan(0);
    expect(res.metrics.totalDurationSeconds).toBeGreaterThan(0);
  });

  it("EngagementQualityAgent evaluates CQS ratings and quality tiers", async () => {
    const res = await EngagementQualityAgent.evaluate(sampleVisits);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.avgCqsScore).toBe(4.0);
    expect(res.metrics.excellentCallsCount).toBe(2); // 4.5 and 4.0
    expect(res.metrics.averageCallsCount).toBe(1); // 3.5
  });

  it("SampleGiftDistributionAgent tracks sample boxes placed", async () => {
    const res = await SampleGiftDistributionAgent.evaluate(sampleVisits);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.totalBoxesPlaced).toBe(7); // 5 + 2 + 0
    expect(res.metrics.visitsWithSamplesCount).toBe(2);
  });

  it("OrderConversionAgent measures chemist call conversion and secondary sales PTR", async () => {
    const res = await OrderConversionAgent.evaluate(sampleVisits, sampleOrders);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.totalOrders).toBe(1);
    expect(res.metrics.totalOrderValuePtr).toBe(3000); // 20 * 150
    expect(res.metrics.conversionRatePct).toBe(100); // 1 order / 1 chemist call = 100%
  });

  it("GeographicComplianceAgent verifies ISO timestamp integrity", async () => {
    const res = await GeographicComplianceAgent.evaluate(sampleVisits);
    expect(res.status).toBe("ONLINE_PASS");
    expect(res.metrics.exactStartedAtCount).toBe(3);
    expect(res.metrics.exactEndedAtCount).toBe(3);
    expect(res.metrics.integrityScorePct).toBe(100);
  });
});
