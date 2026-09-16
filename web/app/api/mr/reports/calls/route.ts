import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError, badRequest, forbidden, notFound } from "@/lib/api-response";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

type Period = "daily" | "weekly" | "monthly" | "custom" | "all";

function periodRange(period: Period, anchor: Date, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  if (period === "custom" && customStart && customEnd) {
    const start = new Date(`${customStart}T00:00:00.000Z`);
    const end = new Date(`${customEnd}T23:59:59.999Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { start, end };
    }
  }
  if (period === "all") {
    return { start: new Date("2020-01-01T00:00:00.000Z"), end: addUtcDays(new Date(), 1) };
  }
  if (period === "daily") {
    const start = startOfUtcDay(anchor);
    return { start, end: addUtcDays(start, 1) };
  }
  if (period === "weekly") {
    const day = startOfUtcDay(anchor);
    const dow = day.getUTCDay(); // 0=Sun
    const diffToMonday = (dow + 6) % 7;
    const start = addUtcDays(day, -diffToMonday);
    return { start, end: addUtcDays(start, 7) };
  }
  // monthly
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { start, end };
}

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") ?? "daily") as Period;
    if (!["daily", "weekly", "monthly", "custom", "all"].includes(period)) {
      return badRequest("period must be daily, weekly, monthly, custom, or all");
    }
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const targetTypeFilter = searchParams.get("targetType"); // DOCTOR, CHEMIST, ALL

    const anchor = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(anchor.getTime())) return badRequest("Invalid date");

    const requestedEmployeeId = searchParams.get("employeeId");
    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    if (requestedEmployeeId && !isManager) {
      return forbidden("You may only view your own report");
    }

    let scopeEmployeeId: string | undefined;
    let employeeLabel = "All MRs Fleet Combined";
    if (requestedEmployeeId) {
      const employee = await db.employee.findUnique({
        where: { id: requestedEmployeeId },
        include: { territories: { select: { name: true } } },
      });
      if (!employee) return notFound("Employee not found");
      scopeEmployeeId = employee.id;
      const territorySuffix = employee.territories?.length ? ` (${employee.territories[0].name})` : "";
      employeeLabel = `${employee.firstName} ${employee.lastName}${territorySuffix}`;
    } else if (!isManager) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: { select: { name: true } } },
      });
      if (!employee) return unauthorized("Employee record not found");
      scopeEmployeeId = employee.id;
      employeeLabel = `${employee.firstName} ${employee.lastName}`;
    }

    const { start, end } = periodRange(period, anchor, startDateParam ?? undefined, endDateParam ?? undefined);

    const visits = await db.visit.findMany({
      where: {
        ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
        createdAt: { gte: start, lt: end },
        ...(targetTypeFilter === "DOCTOR" ? { doctorId: { not: null } } : {}),
        ...(targetTypeFilter === "CHEMIST" ? { chemistId: { not: null } } : {}),
      },
      include: {
        doctor: {
          select: {
            fullName: true,
            primarySpecialty: true,
            territory: { select: { name: true } },
          },
        },
        chemist: {
          select: {
            name: true,
            type: true,
            territory: { select: { name: true } },
          },
        },
        hospital: {
          select: {
            name: true,
            type: true,
            territory: { select: { name: true } },
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            territories: { select: { name: true } },
          },
        },
        samples: {
          select: {
            quantity: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Secondary POB Orders during this period for commercial metrics
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
      },
      select: {
        employeeId: true,
        items: {
          select: {
            quantity: true,
            price: true,
            discountPct: true,
          },
        },
      },
    });

    const getOrderTotal = (o: { items: Array<{ quantity: number; price: any; discountPct?: any }> }) => {
      return o.items.reduce((sum, item) => {
        const val = Number(item.price || 0) * (item.quantity || 0);
        const disc = Number(item.discountPct || 0);
        return sum + (disc > 0 ? val * (1 - disc / 100) : val);
      }, 0);
    };

    const totalPobValue = orders.reduce((acc, o) => acc + getOrderTotal(o), 0);

    const byDay: Record<string, number> = {};
    for (const v of visits) {
      const day = v.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const doctorCalls = visits.filter((v) => v.doctorId).length;
    const chemistCalls = visits.filter((v) => v.chemistId).length;
    const hospitalCalls = visits.filter((v) => v.hospitalId).length;
    const totalBoxesPlaced = visits.reduce((sum, v) => sum + (v.boxesPlaced ?? 0), 0);
    const totalSamplesDistributed = visits.reduce(
      (sum, v) => sum + v.samples.reduce((sAcc, s) => sAcc + (s.quantity || 0), 0),
      0
    );
    const anomalyCount = visits.filter((v) => v.anomalyFlag).length;

    const avgDuration = visits.length
      ? Math.round(visits.reduce((sum, v) => sum + (v.durationMinutes ?? 0), 0) / visits.length)
      : 0;
    const cqsScores = visits.map((v) => v.cqsScore).filter((s): s is number => s !== null && s !== undefined);
    const avgCqs = cqsScores.length
      ? Math.round((cqsScores.reduce((a, b) => a + b, 0) / cqsScores.length) * 10) / 10
      : null;

    // ─────────────────────────────────────────────────────────────
    // MULTI-AGENT COUNCIL CALL EVALUATION SYNTHESIS
    // ─────────────────────────────────────────────────────────────
    // 1. FIELD_DCR_AGENT: Evaluates call volume, Dr:Chemist ratio, duration, and sampling
    const dcrCallScore = Math.min(
      100,
      Math.round(
        (Math.min(visits.length, 12) / 12) * 40 +
          (doctorCalls > 0 ? Math.min(doctorCalls / 8, 1) * 30 : 0) +
          (avgDuration >= 12 ? 20 : (avgDuration / 12) * 20) +
          (totalBoxesPlaced > 0 ? 10 : 0)
      )
    );
    const dcrStatus = dcrCallScore >= 80 ? "ONLINE_PASS" : dcrCallScore >= 55 ? "ONLINE_WARNING" : "ONLINE_ALERT";

    // 2. ROUTING_COMPLIANCE_AGENT: Evaluates route anomalies and geofence integrity
    const routingScore = Math.max(0, 100 - anomalyCount * 15);
    const routingStatus = routingScore >= 85 ? "ONLINE_PASS" : routingScore >= 60 ? "ONLINE_WARNING" : "ONLINE_ALERT";

    // 3. COMMERCIAL_AGENT: Evaluates chemist POB orders & secondary bookings
    const commercialScore = Math.min(100, Math.round(Math.min(totalPobValue / 25000, 1) * 70 + (chemistCalls > 0 ? 30 : 0)));
    const commercialStatus = commercialScore >= 70 ? "ONLINE_PASS" : "ONLINE_WARNING";

    // 4. DATA_INTEGRITY_AGENT: Validates logged parameters and overall compliance
    const integrityScore = Math.round(
      dcrCallScore * 0.45 + routingScore * 0.3 + commercialScore * 0.25
    );
    const overallGrade: "A+" | "A" | "B" | "C" =
      integrityScore >= 90 ? "A+" : integrityScore >= 80 ? "A" : integrityScore >= 65 ? "B" : "C";

    const agentStatuses = [
      {
        agentCode: "FIELD_DCR_AGENT",
        agentName: "Field DCR & Detailing Agent",
        domain: "Doctor & Chemist Interactions",
        status: dcrStatus,
        score: dcrCallScore,
        summary: `${doctorCalls} Doctor calls (${avgDuration}m avg), ${chemistCalls} Chemist calls, ${totalBoxesPlaced} boxes placed.`,
      },
      {
        agentCode: "ROUTING_COMPLIANCE_AGENT",
        agentName: "Routing & Geofence Agent",
        domain: "GPS & Telemetry Audit",
        status: routingStatus,
        score: routingScore,
        summary: anomalyCount === 0 ? "100% geofence verified; zero transit anomalies." : `${anomalyCount} route or timing anomalies detected.`,
      },
      {
        agentCode: "COMMERCIAL_AGENT",
        agentName: "Commercial Secondary Orders Agent",
        domain: "POB Bookings & Revenue",
        status: commercialStatus,
        score: commercialScore,
        summary: `₹${totalPobValue.toLocaleString("en-IN")} total secondary POB value generated in period.`,
      },
      {
        agentCode: "DATA_INTEGRITY_AGENT",
        agentName: "Data Integrity & Council Auditor",
        domain: "Audit Verdict",
        status: integrityScore >= 75 ? "ONLINE_PASS" : "ONLINE_WARNING",
        score: integrityScore,
        summary: `Overall Call Quality Council Rating: Grade ${overallGrade} (${integrityScore}/100).`,
      },
    ];

    // ─────────────────────────────────────────────────────────────
    // FLEET MR PERFORMANCE BREAKDOWN (WHEN VIEWING ALL MRS)
    // ─────────────────────────────────────────────────────────────
    const mrMap = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        phone: string | null;
        territory: string;
        totalCalls: number;
        doctorCalls: number;
        chemistCalls: number;
        hospitalCalls: number;
        totalBoxesPlaced: number;
        totalSamples: number;
        totalDurationMinutes: number;
        cqsScores: number[];
        anomalyCount: number;
        pobValue: number;
      }
    >();

    // Seed from active employees if manager
    if (!scopeEmployeeId) {
      const allActiveMrs = await db.employee.findMany({
        where: { user: { isActive: true, role: Role.MR } },
        include: { territories: { select: { name: true } } },
      });
      for (const mr of allActiveMrs) {
        mrMap.set(mr.id, {
          employeeId: mr.id,
          employeeName: `${mr.firstName} ${mr.lastName}`,
          phone: mr.phone,
          territory: mr.territories?.[0]?.name || "General Territory",
          totalCalls: 0,
          doctorCalls: 0,
          chemistCalls: 0,
          hospitalCalls: 0,
          totalBoxesPlaced: 0,
          totalSamples: 0,
          totalDurationMinutes: 0,
          cqsScores: [],
          anomalyCount: 0,
          pobValue: 0,
        });
      }
    }

    // Populate from visits
    for (const v of visits) {
      const empId = v.employeeId;
      const empName = `${v.employee.firstName} ${v.employee.lastName}`;
      const terrName = v.employee.territories?.[0]?.name || "General Territory";
      const curr = mrMap.get(empId) || {
        employeeId: empId,
        employeeName: empName,
        phone: v.employee.phone,
        territory: terrName,
        totalCalls: 0,
        doctorCalls: 0,
        chemistCalls: 0,
        hospitalCalls: 0,
        totalBoxesPlaced: 0,
        totalSamples: 0,
        totalDurationMinutes: 0,
        cqsScores: [],
        anomalyCount: 0,
        pobValue: 0,
      };

      curr.totalCalls += 1;
      if (v.doctorId) curr.doctorCalls += 1;
      if (v.chemistId) curr.chemistCalls += 1;
      if (v.hospitalId) curr.hospitalCalls += 1;
      curr.totalBoxesPlaced += v.boxesPlaced || 0;
      curr.totalSamples += v.samples.reduce((sAcc, s) => sAcc + (s.quantity || 0), 0);
      curr.totalDurationMinutes += v.durationMinutes || 0;
      if (v.cqsScore !== null && v.cqsScore !== undefined) curr.cqsScores.push(v.cqsScore);
      if (v.anomalyFlag) curr.anomalyCount += 1;

      mrMap.set(empId, curr);
    }

    // Populate POB value per MR
    for (const o of orders) {
      if (o.employeeId && mrMap.has(o.employeeId)) {
        mrMap.get(o.employeeId)!.pobValue += getOrderTotal(o);
      }
    }

    const mrBreakdown = Array.from(mrMap.values())
      .map((mr) => {
        const avgDur = mr.totalCalls ? Math.round(mr.totalDurationMinutes / mr.totalCalls) : 0;
        const avgScore = mr.cqsScores.length
          ? Math.round((mr.cqsScores.reduce((a, b) => a + b, 0) / mr.cqsScores.length) * 10) / 10
          : null;
        const indScore = Math.min(
          100,
          Math.round(
            (Math.min(mr.totalCalls, 10) / 10) * 50 +
              (mr.doctorCalls >= 6 ? 25 : (mr.doctorCalls / 6) * 25) +
              (mr.anomalyCount === 0 ? 25 : 10)
          )
        );
        const grade = indScore >= 85 ? "A" : indScore >= 70 ? "B" : "C";

        return {
          employeeId: mr.employeeId,
          employeeName: mr.employeeName,
          phone: mr.phone,
          territory: mr.territory,
          totalCalls: mr.totalCalls,
          doctorCalls: mr.doctorCalls,
          chemistCalls: mr.chemistCalls,
          hospitalCalls: mr.hospitalCalls,
          totalBoxesPlaced: mr.totalBoxesPlaced,
          totalSamples: mr.totalSamples,
          avgDurationMinutes: avgDur,
          avgCqsScore: avgScore,
          anomalyCount: mr.anomalyCount,
          pobValue: mr.pobValue,
          councilScore: indScore,
          grade,
        };
      })
      .sort((a, b) => b.totalCalls - a.totalCalls);

    return ok({
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      employee: { id: scopeEmployeeId ?? null, name: employeeLabel },
      totals: {
        totalCalls: visits.length,
        doctorCalls,
        chemistCalls,
        hospitalCalls,
        totalBoxesPlaced,
        totalSamplesDistributed,
        avgDurationMinutes: avgDuration,
        avgCqsScore: avgCqs,
        anomalyCount,
        totalPobValue,
      },
      multiAgentEvaluation: {
        councilScore: integrityScore,
        overallGrade,
        agentStatuses,
        findings: [
          `Audited ${visits.length} customer interactions across ${mrBreakdown.length || 1} representative(s).`,
          doctorCalls > 0 ? `Doctor detailing coverage: ${doctorCalls} healthcare providers visited.` : "Notice: Zero doctor detailing visits logged in this timeframe.",
          chemistCalls > 0 ? `Chemist network engagement: ${chemistCalls} chemist counters visited.` : "Chemist interactions pending.",
        ],
        recommendations: [
          doctorCalls < 8 ? "Ensure target ratio of at least 8 to 10 doctor visits daily for adequate prescribing reach." : "Maintain doctor detailing rhythm with regular sampling followup.",
          anomalyCount > 0 ? "Review geofence and timestamp deviations with field representatives." : "Routing compliance is 100% verified.",
        ],
      },
      mrBreakdown,
      byDay,
      calls: visits.map((v) => {
        const targetType = v.doctorId ? "DOCTOR" : v.chemistId ? "CHEMIST" : v.hospitalId ? "HOSPITAL" : "OTHER";
        const targetName = v.doctor?.fullName ?? v.chemist?.name ?? v.hospital?.name ?? "Unknown Entity";
        const specialty = v.doctor?.primarySpecialty ?? v.chemist?.type ?? null;
        const territory =
          v.doctor?.territory?.name ??
          v.chemist?.territory?.name ??
          v.hospital?.territory?.name ??
          v.employee.territories?.[0]?.name ??
          "General";

        const sampleNames = v.samples.map((s) => `${s.product?.name || "Sample"} (${s.quantity})`).join(", ");

        return {
          id: v.id,
          name: targetName,
          targetType,
          specialty,
          purpose: v.purpose,
          createdAt: v.createdAt.toISOString(),
          durationMinutes: v.durationMinutes,
          boxesPlaced: v.boxesPlaced,
          cqsScore: v.cqsScore,
          anomalyFlag: v.anomalyFlag,
          anomalyDetails: v.anomalyDetails,
          receptiveness: v.receptiveness,
          samplesCount: v.samples.reduce((acc, s) => acc + (s.quantity || 0), 0),
          samplesSummary: sampleNames || null,
          employeeId: v.employee.id,
          employeeName: `${v.employee.firstName} ${v.employee.lastName}`,
          employeePhone: v.employee.phone,
          territory,
        };
      }),
    });
  } catch (err) {
    console.error("[GET /api/mr/reports/calls]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate call report", 500);
  }
}

export const GET = withAuth(handler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
]);
