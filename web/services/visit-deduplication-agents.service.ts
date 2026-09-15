import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface DuplicateCluster {
  clusterKey: string;
  date: string;
  employeeId: string;
  employeeName: string;
  targetType: "DOCTOR" | "CHEMIST" | "HOSPITAL";
  targetId: string;
  targetName: string;
  totalCount: number;
  originalVisitId: string;
  duplicateVisitIds: string[];
  sampleCount: number;
}

export interface VisitAuditResult {
  totalVisitsScanned: number;
  clustersFound: number;
  totalDuplicateRecords: number;
  clusters: DuplicateCluster[];
  redundantVisitIds: string[];
}

export interface PurgeExecutionResult {
  success: boolean;
  purgedCount: number;
  preservedOriginalsCount: number;
  purgedVisitIds: string[];
  executedAt: string;
  durationMs: number;
}

/**
 * Multi-Agent Visit Deduplication & Data Integrity Suite
 *
 * Domain Agents:
 * 1. VisitDuplicationAuditAgent: Discovers all duplicate visit entries.
 * 2. VisitDeduplicationReconciliationAgent: Purges redundant duplicate entries while safely keeping originals.
 * 3. VisitIdempotencyGuardianAgent: Protects against double-click, network retry, or sync spamming.
 * 4. VisitHistoryPurifierAgent: Consolidates/filters history queries so admins see only original calls.
 */
export class VisitDeduplicationAgentsService {

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 1: VISIT DUPLICATION AUDIT AGENT
  // ───────────────────────────────────────────────────────────────────────────
  static async auditDuplicates(): Promise<VisitAuditResult> {
    const visits = await db.visit.findMany({
      orderBy: { createdAt: "asc" }, // Oldest first so index 0 is always the original
      include: {
        doctor: { select: { id: true, fullName: true } },
        chemist: { select: { id: true, name: true } },
        hospital: { select: { id: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        samples: { select: { id: true, quantity: true } },
      },
    });

    const clusterMap = new Map<string, typeof visits>();

    for (const v of visits) {
      const dateStr = v.createdAt.toISOString().slice(0, 10);
      const targetId = v.doctorId || v.chemistId || v.hospitalId || "none";
      const key = `${v.employeeId}_${targetId}_${dateStr}`;

      if (!clusterMap.has(key)) {
        clusterMap.set(key, []);
      }
      clusterMap.get(key)!.push(v);
    }

    const clusters: DuplicateCluster[] = [];
    const redundantVisitIds: string[] = [];

    for (const [key, group] of clusterMap.entries()) {
      if (group.length <= 1) continue;

      // Group has duplicates!
      // Index 0 is the original (earliest createdAt)
      const original = group[0];
      const dupes = group.slice(1);

      const targetType: DuplicateCluster["targetType"] = original.doctorId
        ? "DOCTOR"
        : original.chemistId
        ? "CHEMIST"
        : "HOSPITAL";

      const targetId = original.doctorId || original.chemistId || original.hospitalId || "";
      const targetName =
        original.doctor?.fullName ||
        original.chemist?.name ||
        original.hospital?.name ||
        "Unknown Target";

      const empName = original.employee
        ? `${original.employee.firstName} ${original.employee.lastName}`
        : "Unknown MR";

      const dupeIds = dupes.map((d) => d.id);
      redundantVisitIds.push(...dupeIds);

      const totalSamples = group.reduce((sum, v) => sum + v.samples.length, 0);

      clusters.push({
        clusterKey: key,
        date: original.createdAt.toISOString().slice(0, 10),
        employeeId: original.employeeId,
        employeeName: empName,
        targetType,
        targetId,
        targetName,
        totalCount: group.length,
        originalVisitId: original.id,
        duplicateVisitIds: dupeIds,
        sampleCount: totalSamples,
      });
    }

    return {
      totalVisitsScanned: visits.length,
      clustersFound: clusters.length,
      totalDuplicateRecords: redundantVisitIds.length,
      clusters,
      redundantVisitIds,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 2: VISIT DEDUPLICATION RECONCILIATION AGENT
  // ───────────────────────────────────────────────────────────────────────────
  static async reconcileAndPurgeDuplicates(): Promise<PurgeExecutionResult> {
    const startTime = Date.now();
    const audit = await this.auditDuplicates();

    if (audit.redundantVisitIds.length === 0) {
      return {
        success: true,
        purgedCount: 0,
        preservedOriginalsCount: audit.clustersFound,
        purgedVisitIds: [],
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }

    // Cascade deletes child Sample, Gift, Lead, CompetitorLog, AnomalyReview automatically via FK constraints
    const deleteResult = await db.visit.deleteMany({
      where: {
        id: { in: audit.redundantVisitIds },
      },
    });

    return {
      success: true,
      purgedCount: deleteResult.count,
      preservedOriginalsCount: audit.clustersFound,
      purgedVisitIds: audit.redundantVisitIds,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 3: VISIT IDEMPOTENCY GUARDIAN AGENT
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Prevents creating duplicate visit submissions.
   * If a visit by the same MR for the same target occurred within 5 minutes,
   * or within the same UTC day with matching purpose, returns the existing visit ID.
   */
  static async findExistingDuplicateVisit(params: {
    employeeId: string;
    doctorId?: string;
    chemistId?: string;
    hospitalId?: string;
    purpose: string;
  }): Promise<{ isDuplicate: boolean; existingVisitId?: string }> {
    const { employeeId, doctorId, chemistId, hospitalId, purpose } = params;

    // Check last 10 minutes window first
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const recentVisit = await db.visit.findFirst({
      where: {
        employeeId,
        ...(doctorId ? { doctorId } : {}),
        ...(chemistId ? { chemistId } : {}),
        ...(hospitalId ? { hospitalId } : {}),
        createdAt: { gte: tenMinutesAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentVisit) {
      return { isDuplicate: true, existingVisitId: recentVisit.id };
    }

    // Same day check with same purpose
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const sameDayVisit = await db.visit.findFirst({
      where: {
        employeeId,
        ...(doctorId ? { doctorId } : {}),
        ...(chemistId ? { chemistId } : {}),
        ...(hospitalId ? { hospitalId } : {}),
        createdAt: { gte: todayStart },
        purpose: { equals: purpose, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (sameDayVisit) {
      return { isDuplicate: true, existingVisitId: sameDayVisit.id };
    }

    return { isDuplicate: false };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 4: VISIT HISTORY PURIFIER AGENT
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Filters and deduplicates raw visit results in-memory so that if any legacy duplicates
   * remain or match query boundaries, only the primary (earliest) original visit per
   * target per day is exposed to the frontend/admin.
   */
  static purifyVisitList<T extends {
    id: string;
    createdAt: string | Date;
    employeeId: string;
    doctor?: { id: string } | null;
    chemist?: { id: string } | null;
    hospital?: { id: string } | null;
  }>(visits: T[]): T[] {
    const seen = new Set<string>();
    const filtered: T[] = [];

    for (const v of visits) {
      const dateStr = typeof v.createdAt === "string"
        ? v.createdAt.slice(0, 10)
        : v.createdAt.toISOString().slice(0, 10);

      const targetId = v.doctor?.id || v.chemist?.id || v.hospital?.id || "unknown";
      const key = `${v.employeeId}_${targetId}_${dateStr}`;

      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(v);
      }
    }

    return filtered;
  }
}
