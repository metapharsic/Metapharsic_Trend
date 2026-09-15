import { VisitDeduplicationAgentsService } from "../services/visit-deduplication-agents.service";

describe("Visit Deduplication & Protection Multi-Agent Suite", () => {
  describe("VisitHistoryPurifierAgent (purifyVisitList)", () => {
    it("should filter out duplicate doctor calls on the same date and retain the earliest original", () => {
      const mockVisits = [
        {
          id: "visit-original-1",
          createdAt: new Date("2026-08-25T10:15:00.000Z"),
          employeeId: "emp-1",
          doctor: { id: "doc-1" },
          chemist: null,
          hospital: null,
          purpose: "Original detailing",
        },
        {
          id: "visit-dupe-1",
          createdAt: new Date("2026-08-25T10:15:00.000Z"),
          employeeId: "emp-1",
          doctor: { id: "doc-1" },
          chemist: null,
          hospital: null,
          purpose: "Duplicate detailing 1",
        },
        {
          id: "visit-dupe-2",
          createdAt: new Date("2026-08-25T10:15:00.000Z"),
          employeeId: "emp-1",
          doctor: { id: "doc-1" },
          chemist: null,
          hospital: null,
          purpose: "Duplicate detailing 2",
        },
        {
          id: "visit-diff-day",
          createdAt: new Date("2026-08-26T10:15:00.000Z"),
          employeeId: "emp-1",
          doctor: { id: "doc-1" },
          chemist: null,
          hospital: null,
          purpose: "Next day visit",
        },
      ];

      const purified = VisitDeduplicationAgentsService.purifyVisitList(mockVisits);

      expect(purified.length).toBe(2);
      expect(purified[0].id).toBe("visit-original-1");
      expect(purified[1].id).toBe("visit-diff-day");
    });

    it("should handle chemist visits deduplication accurately", () => {
      const mockVisits = [
        {
          id: "chem-original",
          createdAt: "2026-08-25T11:45:00.000Z",
          employeeId: "emp-1",
          doctor: null,
          chemist: { id: "chem-1" },
          hospital: null,
        },
        {
          id: "chem-duplicate",
          createdAt: "2026-08-25T11:45:00.000Z",
          employeeId: "emp-1",
          doctor: null,
          chemist: { id: "chem-1" },
          hospital: null,
        },
      ];

      const purified = VisitDeduplicationAgentsService.purifyVisitList(mockVisits);

      expect(purified.length).toBe(1);
      expect(purified[0].id).toBe("chem-original");
    });
  });

  describe("VisitAuditAgent & Reconciliation Agent", () => {
    it("should report zero duplicates on an already purified ledger", async () => {
      const audit = await VisitDeduplicationAgentsService.auditDuplicates();
      expect(audit.totalDuplicateRecords).toBe(0);
      expect(audit.clustersFound).toBe(0);
    });
  });
});
