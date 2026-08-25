import { db } from "@/lib/db";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

export interface IndividualMrEodData {
  mrId: string;
  mrName: string;
  mrPhone: string | null;
  mrEmail: string | null;
  territoryName: string;
  date: Date;
  attendance: {
    checkedIn: boolean;
    firstCheckIn: Date | null;
    lastCheckOut: Date | null;
    totalMinutes: number;
    stillCheckedIn: boolean;
    sessionsCount: number;
  };
  visits: {
    totalCalls: number;
    doctorCalls: number;
    chemistCalls: number;
    doctorList: Array<{ name: string; specialty?: string | null; cqsScore?: number | null }>;
    chemistList: Array<{ name: string }>;
    avgCqsScore: number | null;
    boxesPlaced: number;
  };
  sampling: {
    totalUnits: number;
    breakdown: Array<{ productName: string; quantity: number }>;
  };
  orders: {
    count: number;
    totalValue: number;
    itemsCount: number;
    topItems: Array<{ productName: string; quantity: number; amount: number }>;
  };
  collections: {
    totalAmount: number;
    count: number;
    receipts: Array<{ chemistName: string; amount: number; refNo?: string | null }>;
  };
  leadsCount: number;
  compliance: {
    geofenceAccuracyPct: number;
    anomalyCount: number;
    mockGpsDetected: boolean;
  };
  targets: {
    monthlyTarget: number;
    mtdAchieved: number;
    mtdPacePercent: number;
    daysRemainingInMonth: number;
  };
}

export interface AdminExecutiveDigestData {
  date: Date;
  totalMrCount: number;
  activeMrCount: number;
  onLeaveCount: number;
  absentCount: number;
  totalFleetSales: number;
  totalFleetCollections: number;
  totalDoctorCalls: number;
  totalChemistCalls: number;
  totalSamplesGiven: number;
  avgFleetCqs: number | null;
  topPerformer: { name: string; sales: number; calls: number } | null;
  anomalies: {
    mockGpsCount: number;
    unvisitedPlannedCount: number;
    zeroCallReps: string[];
  };
  repScorecards: Array<{
    name: string;
    territory: string;
    status: "ON_DUTY" | "CHECKED_OUT" | "ABSENT";
    calls: number;
    sales: number;
    collections: number;
    hours: string;
  }>;
}

function fmtCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Builds a rich, highly descriptive WhatsApp EOD Report for an individual Medical Representative.
 */
export function formatIndividualMrWhatsAppReport(data: IndividualMrEodData): string {
  const dStr = fmtDate(data.date);
  const hoursStr = data.attendance.checkedIn
    ? `${fmtMinutes(data.attendance.totalMinutes)}${data.attendance.stillCheckedIn ? " 🟢 (Active)" : ""}`
    : "🔴 Not Checked In";

  const sections: string[] = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 *TREND MR — EOD PROGRESS REPORT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Rep:* ${data.mrName}`,
    `📍 *Territory:* ${data.territoryName}`,
    `📅 *Date:* ${dStr}`,
    ``,
    `⏱️ *DUTY & ATTENDANCE*`,
    `• Status: ${hoursStr}`,
    `• In: ${fmtTime(data.attendance.firstCheckIn)} | Out: ${fmtTime(data.attendance.lastCheckOut)}`,
    `• Sessions: ${data.attendance.sessionsCount}`,
    ``,
    `🩺 *FIELD COVERAGE & DCR*`,
    `• Total Calls: *${data.visits.totalCalls}* (👨‍⚕️ ${data.visits.doctorCalls} Doctors | 💊 ${data.visits.chemistCalls} Chemists)`,
    data.visits.avgCqsScore !== null ? `• Avg Call Quality (CQS): *${data.visits.avgCqsScore.toFixed(1)}/100*` : `• CQS: —`,
    `• Display Boxes Placed: *${data.visits.boxesPlaced}*`,
  ];

  if (data.visits.doctorList.length > 0) {
    sections.push(`  _Doctors Visited:_`);
    data.visits.doctorList.slice(0, 5).forEach((doc) => {
      const spec = doc.specialty ? ` (${doc.specialty})` : "";
      sections.push(`   └ Dr. ${doc.name}${spec}`);
    });
    if (data.visits.doctorList.length > 5) {
      sections.push(`   └ _+ ${data.visits.doctorList.length - 5} more doctors_`);
    }
  }

  sections.push(
    ``,
    `📦 *PHYSICIAN SAMPLES DISBURSED*`,
    `• Total Sample Units: *${data.sampling.totalUnits}*`
  );
  if (data.sampling.breakdown.length > 0) {
    data.sampling.breakdown.slice(0, 4).forEach((s) => {
      sections.push(`   └ ${s.productName}: *${s.quantity} units*`);
    });
  }

  sections.push(
    ``,
    `💰 *COMMERCIAL PERFORMANCE*`,
    `• Secondary Orders Booked: *${fmtCurrency(data.orders.totalValue)}* (${data.orders.count} orders, ${data.orders.itemsCount} line items)`,
    `• Outstanding Collected: *${fmtCurrency(data.collections.totalAmount)}* (${data.collections.count} receipts)`,
    `• New Prospects / Leads: *${data.leadsCount}*`
  );

  if (data.targets.monthlyTarget > 0) {
    const paceEmoji = data.targets.mtdPacePercent >= 100 ? "🔥" : data.targets.mtdPacePercent >= 80 ? "⚡" : "⚠️";
    sections.push(
      ``,
      `🎯 *MONTHLY TARGET & RUN-RATE*`,
      `• Monthly Target: ${fmtCurrency(data.targets.monthlyTarget)}`,
      `• MTD Achieved: ${fmtCurrency(data.targets.mtdAchieved)} (*${data.targets.mtdPacePercent.toFixed(1)}%* ${paceEmoji})`,
      `• Days Remaining: ${data.targets.daysRemainingInMonth} days`
    );
  }

  sections.push(
    ``,
    `🛡️ *ROUTE & GEOFENCE COMPLIANCE*`,
    `• GPS Geofence Accuracy: *${data.compliance.geofenceAccuracyPct}%*`,
    data.compliance.mockGpsDetected ? `• ⚠️ *ALERT: Mock GPS Signal Detected!*` : `• Geofence Anomalies: *${data.compliance.anomalyCount}*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💡 _Trend MR Pharma OS — Multi-Agent Verified_`
  );

  return sections.join("\n");
}

/**
 * Builds a highly descriptive Executive Fleet WhatsApp Digest for Admins & Managing Directors.
 */
export function formatAdminExecutiveWhatsAppDigest(data: AdminExecutiveDigestData): string {
  const dStr = fmtDate(data.date);
  const activeRate = data.totalMrCount > 0 ? Math.round((data.activeMrCount / data.totalMrCount) * 100) : 0;

  const sections: string[] = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏛️ *TREND MR — EXECUTIVE FLEET EOD DIGEST*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 *Date:* ${dStr}`,
    `👥 *Field Strength:* *${data.activeMrCount}/${data.totalMrCount} Active* (${activeRate}%) | 🏖️ Leave: ${data.onLeaveCount} | ❌ Absent: ${data.absentCount}`,
    ``,
    `📈 *COMMERCIAL SUMMARY (TODAY)*`,
    `• Total Fleet Sales Booked: *${fmtCurrency(data.totalFleetSales)}*`,
    `• Total Payments Collected: *${fmtCurrency(data.totalFleetCollections)}*`,
  ];

  if (data.topPerformer) {
    sections.push(`• 🏆 Top Performer: *${data.topPerformer.name}* (${fmtCurrency(data.topPerformer.sales)} | ${data.topPerformer.calls} calls)`);
  }

  sections.push(
    ``,
    `🩺 *FIELD ACTIVITY FLEET TOTALS*`,
    `• Total Doctor Calls: *${data.totalDoctorCalls}*`,
    `• Total Chemist Calls: *${data.totalChemistCalls}*`,
    `• Total Field Calls: *${data.totalDoctorCalls + data.totalChemistCalls}*`,
    `• Physician Samples Given: *${data.totalSamplesGiven} units*`,
    data.avgFleetCqs !== null ? `• Fleet Avg Call Quality (CQS): *${data.avgFleetCqs.toFixed(1)}/100*` : `• Fleet Avg CQS: —`
  );

  if (data.anomalies.mockGpsCount > 0 || data.anomalies.zeroCallReps.length > 0) {
    sections.push(``, `⚠️ *COMPLIANCE & RISK ALERTS*`);
    if (data.anomalies.mockGpsCount > 0) {
      sections.push(`• 🚨 *Mock GPS Alerts:* ${data.anomalies.mockGpsCount} detected!`);
    }
    if (data.anomalies.zeroCallReps.length > 0) {
      sections.push(`• ⚠️ *Zero-Call Active Reps:* ${data.anomalies.zeroCallReps.join(", ")}`);
    }
  }

  sections.push(``, `📋 *INDIVIDUAL REP BREAKDOWN*`);
  data.repScorecards.forEach((rep, idx) => {
    const statusIcon = rep.status === "ON_DUTY" ? "🟢" : rep.status === "CHECKED_OUT" ? "⚪" : "🔴";
    sections.push(
      `${idx + 1}. ${statusIcon} *${rep.name}* (${rep.territory})`,
      `   └ 🩺 ${rep.calls} calls | 💰 Orders: ${fmtCurrency(rep.sales)} | 💵 Coll: ${fmtCurrency(rep.collections)} | ⏱️ ${rep.hours}`
    );
  });

  sections.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🤖 _Trend MR Multi-Agent Autonomous Council Engine_`
  );

  return sections.join("\n");
}

/**
 * Fetches all detailed metrics and compiles the IndividualMrEodData for a given employee & day.
 */
export async function compileIndividualMrEodData(employeeId: string, targetDate: Date = new Date()): Promise<IndividualMrEodData | null> {
  const dayStart = startOfUtcDay(targetDate);
  const dayEnd = addUtcDays(dayStart, 1);

  const mr = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: { select: { email: true } },
      territories: { select: { name: true } },
    },
  });
  if (!mr) return null;

  const territoryName = mr.territories.length > 0 ? mr.territories.map((t) => t.name).join(", ") : "General Territory";

  // Date range for current month targets
  const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
  const monthEnd = new Date(dayStart.getFullYear(), dayStart.getMonth() + 1, 0, 23, 59, 59);
  const daysInMonth = monthEnd.getDate();
  const daysRemainingInMonth = Math.max(0, daysInMonth - dayStart.getDate());

  const [
    attendanceSessions,
    visits,
    leadsCount,
    orderItems,
    collections,
    samples,
    targets,
    mtdOrderItems,
  ] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: mr.id, date: dayStart },
      orderBy: { checkIn: "asc" },
    }),
    db.visit.findMany({
      where: { employeeId: mr.id, createdAt: { gte: dayStart, lt: dayEnd } },
      include: {
        doctor: { select: { fullName: true, primarySpecialty: true } },
        chemist: { select: { name: true } },
      },
    }),
    db.lead.count({ where: { employeeId: mr.id, createdAt: { gte: dayStart, lt: dayEnd } } }),
    db.orderItem.findMany({
      where: { order: { employeeId: mr.id, createdAt: { gte: dayStart, lt: dayEnd } } },
      include: { product: { select: { name: true } } },
    }),
    db.collection.findMany({
      where: { employeeId: mr.id, createdAt: { gte: dayStart, lt: dayEnd } },
      include: { chemist: { select: { name: true } } },
    }),
    db.sample.findMany({
      where: { visit: { employeeId: mr.id, createdAt: { gte: dayStart, lt: dayEnd } } },
      include: { product: { select: { name: true } } },
    }),
    db.target.findFirst({
      where: { employeeId: mr.id, startDate: { lte: dayEnd }, endDate: { gte: dayStart } },
    }),
    db.orderItem.findMany({
      where: { order: { employeeId: mr.id, createdAt: { gte: monthStart, lt: dayEnd } } },
      select: { price: true, quantity: true },
    }),
  ]);

  // Attendance metrics
  const totalMinutes = attendanceSessions.reduce(
    (sum, a) => sum + Math.round(((a.checkOut ?? new Date()).getTime() - a.checkIn.getTime()) / 60000),
    0
  );
  const firstSession = attendanceSessions[0] ?? null;
  const lastSession = attendanceSessions[attendanceSessions.length - 1] ?? null;
  const stillCheckedIn = attendanceSessions.length > 0 && !lastSession.checkOut;

  // Visits & CQS
  const doctorCalls = visits.filter((v) => v.doctorId);
  const chemistCalls = visits.filter((v) => v.chemistId);
  const boxesPlaced = visits.reduce((s, v) => s + (v.boxesPlaced ?? 0), 0);
  const cqsScores = visits.filter((v) => v.cqsScore !== null).map((v) => Number(v.cqsScore));
  const avgCqsScore = cqsScores.length > 0 ? cqsScores.reduce((a, b) => a + b, 0) / cqsScores.length : null;

  // Sampling breakdown
  const sampleMap = new Map<string, number>();
  for (const s of samples) {
    const pName = s.product?.name ?? "Sample";
    sampleMap.set(pName, (sampleMap.get(pName) ?? 0) + s.quantity);
  }
  const samplingBreakdown = Array.from(sampleMap.entries()).map(([productName, quantity]) => ({ productName, quantity }));
  const totalSampleUnits = samples.reduce((sum, s) => sum + s.quantity, 0);

  // Orders
  const totalOrderValue = orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const uniqueOrderIds = new Set(orderItems.map((i) => i.orderId)).size;
  const productSalesMap = new Map<string, { quantity: number; amount: number }>();
  for (const it of orderItems) {
    const pName = it.product?.name ?? "Product";
    const prev = productSalesMap.get(pName) ?? { quantity: 0, amount: 0 };
    productSalesMap.set(pName, {
      quantity: prev.quantity + it.quantity,
      amount: prev.amount + Number(it.price) * it.quantity,
    });
  }
  const topItems = Array.from(productSalesMap.entries())
    .map(([productName, { quantity, amount }]) => ({ productName, quantity, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Collections
  const totalCollectionAmount = collections.reduce((s, c) => s + Number(c.amount), 0);
  const receipts = collections.map((c) => ({
    chemistName: c.chemist?.name ?? "Chemist",
    amount: Number(c.amount),
    refNo: c.refNumber,
  }));

  // Targets & MTD
  const monthlyTargetVal = Number(targets?.value ?? 0);
  const mtdAchieved = mtdOrderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const mtdPacePercent = monthlyTargetVal > 0 ? (mtdAchieved / monthlyTargetVal) * 100 : 0;

  // Compliance
  const anomalyCount = visits.filter((v) => v.anomalyFlag).length;
  const geofenceAccuracyPct = visits.length > 0 ? Math.round(((visits.length - anomalyCount) / visits.length) * 100) : 100;
  const mockGpsDetected = attendanceSessions.some((a) => a.faceToken === "MOCK_GPS_FLAG");

  return {
    mrId: mr.id,
    mrName: `${mr.firstName} ${mr.lastName}`.trim(),
    mrPhone: mr.phone,
    mrEmail: mr.user?.email ?? null,
    territoryName,
    date: targetDate,
    attendance: {
      checkedIn: attendanceSessions.length > 0,
      firstCheckIn: firstSession ? firstSession.checkIn : null,
      lastCheckOut: lastSession ? lastSession.checkOut : null,
      totalMinutes,
      stillCheckedIn,
      sessionsCount: attendanceSessions.length,
    },
    visits: {
      totalCalls: visits.length,
      doctorCalls: doctorCalls.length,
      chemistCalls: chemistCalls.length,
      doctorList: doctorCalls.map((v) => ({
        name: v.doctor?.fullName ?? "Doctor",
        specialty: v.doctor?.primarySpecialty,
        cqsScore: v.cqsScore !== null ? Number(v.cqsScore) : null,
      })),
      chemistList: chemistCalls.map((v) => ({
        name: v.chemist?.name ?? "Chemist",
      })),
      avgCqsScore,
      boxesPlaced,
    },
    sampling: {
      totalUnits: totalSampleUnits,
      breakdown: samplingBreakdown,
    },
    orders: {
      count: uniqueOrderIds,
      totalValue: totalOrderValue,
      itemsCount: orderItems.length,
      topItems,
    },
    collections: {
      totalAmount: totalCollectionAmount,
      count: collections.length,
      receipts,
    },
    leadsCount,
    compliance: {
      geofenceAccuracyPct,
      anomalyCount,
      mockGpsDetected,
    },
    targets: {
      monthlyTarget: monthlyTargetVal,
      mtdAchieved,
      mtdPacePercent,
      daysRemainingInMonth,
    },
  };
}

/**
 * Compiles the AdminExecutiveDigestData across all MRs for a given day.
 */
export async function compileAdminExecutiveDigestData(targetDate: Date = new Date()): Promise<AdminExecutiveDigestData> {
  const dayStart = startOfUtcDay(targetDate);
  const dayEnd = addUtcDays(dayStart, 1);

  const mrs = await db.employee.findMany({
    where: { user: { role: "MR", isActive: true } },
    include: {
      user: { select: { email: true } },
      territories: { select: { name: true } },
    },
  });

  const repSummaries = await Promise.all(mrs.map((mr) => compileIndividualMrEodData(mr.id, targetDate)));
  const validSummaries = repSummaries.filter((s): s is IndividualMrEodData => s !== null);

  let totalFleetSales = 0;
  let totalFleetCollections = 0;
  let totalDoctorCalls = 0;
  let totalChemistCalls = 0;
  let totalSamplesGiven = 0;
  let activeMrCount = 0;
  let mockGpsCount = 0;
  const zeroCallReps: string[] = [];
  const cqsScores: number[] = [];

  let topPerformer: { name: string; sales: number; calls: number } | null = null;
  let maxSales = -1;

  const repScorecards = validSummaries.map((s) => {
    totalFleetSales += s.orders.totalValue;
    totalFleetCollections += s.collections.totalAmount;
    totalDoctorCalls += s.visits.doctorCalls;
    totalChemistCalls += s.visits.chemistCalls;
    totalSamplesGiven += s.sampling.totalUnits;

    if (s.visits.avgCqsScore !== null) {
      cqsScores.push(s.visits.avgCqsScore);
    }
    if (s.compliance.mockGpsDetected) {
      mockGpsCount++;
    }

    const isOnDuty = s.attendance.checkedIn && s.attendance.stillCheckedIn;
    const isCheckedOut = s.attendance.checkedIn && !s.attendance.stillCheckedIn;
    const status: "ON_DUTY" | "CHECKED_OUT" | "ABSENT" = isOnDuty ? "ON_DUTY" : isCheckedOut ? "CHECKED_OUT" : "ABSENT";

    if (s.attendance.checkedIn) {
      activeMrCount++;
      if (s.visits.totalCalls === 0) {
        zeroCallReps.push(s.mrName);
      }
    }

    if (s.orders.totalValue > maxSales) {
      maxSales = s.orders.totalValue;
      topPerformer = { name: s.mrName, sales: s.orders.totalValue, calls: s.visits.totalCalls };
    }

    return {
      name: s.mrName,
      territory: s.territoryName,
      status,
      calls: s.visits.totalCalls,
      sales: s.orders.totalValue,
      collections: s.collections.totalAmount,
      hours: s.attendance.checkedIn ? fmtMinutes(s.attendance.totalMinutes) : "0m",
    };
  });

  const avgFleetCqs = cqsScores.length > 0 ? cqsScores.reduce((a, b) => a + b, 0) / cqsScores.length : null;

  return {
    date: targetDate,
    totalMrCount: mrs.length,
    activeMrCount,
    onLeaveCount: 0, // Placeholder if leave is tracked
    absentCount: Math.max(0, mrs.length - activeMrCount),
    totalFleetSales,
    totalFleetCollections,
    totalDoctorCalls,
    totalChemistCalls,
    totalSamplesGiven,
    avgFleetCqs,
    topPerformer,
    anomalies: {
      mockGpsCount,
      unvisitedPlannedCount: 0,
      zeroCallReps,
    },
    repScorecards,
  };
}

export interface MultiAgentSelectiveConfig {
  period?: "daily" | "weekly" | "monthly" | "custom" | "all";
  startDate?: string;
  endDate?: string;
  includeDoctorVisits?: boolean;
  includeChemistCalls?: boolean;
  includeSalesOrders?: boolean;
  includeCollections?: boolean;
  includeDutyTiming?: boolean;
  includeExpenses?: boolean;
  includeRoutingGeofence?: boolean;
  includeFinancePnl?: boolean;
  includeAgentScorecard?: boolean;
  includeRiskActionItems?: boolean;
}

/**
 * Builds a comprehensive, selective 8-Domain Multi-Agent Council WhatsApp Audit Report for an MR.
 */
export function formatMultiAgentCouncilWhatsAppReport(
  report: any,
  options?: MultiAgentSelectiveConfig
): string {
  const territories = report.territories?.map((t: any) => t.name).join(", ") || "General";
  const dateStr = new Date(report.generatedAt || new Date()).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const periodHeader = report.periodLabel || "Comprehensive Audit";

  const gradeEmoji =
    report.councilEvaluation?.overallGrade === "A+"
      ? "🏆"
      : report.councilEvaluation?.overallGrade === "A"
      ? "🌟"
      : report.councilEvaluation?.overallGrade === "B"
      ? "✅"
      : "⚠️";

  const sections: string[] = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `🤖 *MULTI-AGENT COUNCIL AUDIT REPORT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *MR:* ${report.fullName}`,
    `📍 *Territory:* ${territories}`,
    `⏱️ *Timeframe:* ${periodHeader}`,
    `📅 *Generated:* ${dateStr}`,
    `🌐 *Engine:* ${report.environment || "LOCAL"}`,
    ``,
    `🎖️ *COUNCIL VERDICT:* *Grade ${report.councilEvaluation?.overallGrade || "B"}* (${report.councilEvaluation?.councilScore || 0}/100) ${gradeEmoji}`,
    `📝 _${report.councilEvaluation?.executiveSummary || "Multi-Agent evaluation completed."}_`,
  ];

  // 1. 8-Domain Agent Evaluation Matrix
  if (options?.includeAgentScorecard !== false && report.councilEvaluation?.agentStatuses) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔍 *8-DOMAIN AGENT EVALUATION MATRIX*`,
      `━━━━━━━━━━━━━━━━━━━━`
    );
    for (const agent of report.councilEvaluation.agentStatuses) {
      const statusEmoji =
        agent.status === "ONLINE_PASS"
          ? "🟢 PASS"
          : agent.status === "ONLINE_WARNING"
          ? "🟡 WARN"
          : "🔴 ALERT";

      sections.push(`🔹 *${agent.agentName}* [${statusEmoji} • ${agent.score}%]`);
      if (agent.findings && agent.findings.length > 0) {
        agent.findings.slice(0, 2).forEach((f: string) => sections.push(`   └ ✔️ ${f}`));
      }
      if (agent.warnings && agent.warnings.length > 0) {
        agent.warnings.slice(0, 2).forEach((w: string) => sections.push(`   └ ⚠️ ${w}`));
      }
    }
  }

  // 2. Doctor-Wise Detailing & Visits
  if (options?.includeDoctorVisits !== false && (report.dcrSummary?.doctorVisits > 0 || (report.dcrSummary?.doctorWiseVisits && report.dcrSummary.doctorWiseVisits.length > 0))) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👨‍⚕️ *DOCTOR VISITS & DETAILING*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Total Doctor Calls: *${report.dcrSummary?.doctorVisits || 0}*`,
      `• Avg Call Quality Score (CQS): *${report.dcrSummary?.avgCqsScore ?? "—"}/10*`,
      `• Samples Disbursed: *${report.dcrSummary?.samplesDistributedQty || 0} units*`
    );

    const docList = report.dcrSummary?.doctorWiseVisits || [];
    if (docList.length > 0) {
      sections.push(`  _Doctors Detailed:_`);
      docList.slice(0, 6).forEach((d: any) => {
        const spec = d.specialty ? ` (${d.specialty})` : "";
        const cqs = d.cqsScore ? ` • CQS: ${d.cqsScore}` : "";
        const samples = d.samplesCount > 0 ? ` • ${d.samplesCount} samples` : "";
        sections.push(`   └ Dr. ${d.doctorName}${spec}${cqs}${samples}`);
      });
      if (docList.length > 6) {
        sections.push(`   └ _+ ${docList.length - 6} more doctors_`);
      }
    }
  }

  // 3. Chemist-Wise Calls & POB
  if (options?.includeChemistCalls !== false && (report.dcrSummary?.chemistVisits > 0 || (report.dcrSummary?.chemistWiseVisits && report.dcrSummary.chemistWiseVisits.length > 0))) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💊 *CHEMIST CALLS & POB BOOKINGS*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Total Chemist Visits: *${report.dcrSummary?.chemistVisits || 0}*`,
      `• Display Boxes Placed: *${report.dcrSummary?.totalBoxesPlaced || 0} boxes*`
    );

    const chemList = report.dcrSummary?.chemistWiseVisits || [];
    if (chemList.length > 0) {
      sections.push(`  _Chemist Coverage:_`);
      chemList.slice(0, 5).forEach((c: any) => {
        const pob = c.pobOrderValue > 0 ? ` • POB: ${fmtCurrency(c.pobOrderValue)}` : "";
        sections.push(`   └ ${c.chemistName}${pob}`);
      });
      if (chemList.length > 5) {
        sections.push(`   └ _+ ${chemList.length - 5} more chemists_`);
      }
    }
  }

  // 4. Secondary Sales Done
  if (options?.includeSalesOrders !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *SECONDARY SALES DONE*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Gross Sales (PTR): *${fmtCurrency(report.commercialSummary?.totalRevenuePtr || 0)}*`,
      `• Cost of Sales (PTS): *${fmtCurrency(report.commercialSummary?.totalRevenuePts || 0)}*`,
      `• Orders Booked: *${report.commercialSummary?.totalOrdersCount || 0}* (${report.commercialSummary?.deliveredOrdersCount || 0} Delivered | ${report.commercialSummary?.pendingOrdersCount || 0} Pending)`,
      `• Total Units Booked: *${report.commercialSummary?.totalUnitsBooked || 0} units*`
    );

    if (report.commercialSummary?.skuBreakdown && report.commercialSummary.skuBreakdown.length > 0) {
      sections.push(`  _Top Product SKUs:_`);
      report.commercialSummary.skuBreakdown.slice(0, 4).forEach((sku: any) => {
        sections.push(`   └ ${sku.productName}: *${sku.units} units* (${fmtCurrency(sku.revenuePtr)})`);
      });
    }
  }

  // 5. Collections Done
  if (options?.includeCollections !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💵 *COLLECTIONS & RECOVERIES*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Total Amount Collected: *${fmtCurrency(report.commercialSummary?.collections?.totalCollected || 0)}*`,
      `• Receipts Logged: *${report.commercialSummary?.collections?.recordsCount || 0}*`
    );

    const receipts = report.commercialSummary?.collections?.receipts || [];
    if (receipts.length > 0) {
      receipts.slice(0, 4).forEach((r: any) => {
        sections.push(`   └ ${r.chemistName}: *${fmtCurrency(r.amount)}*`);
      });
    }
  }

  // 6. Timing & Field Attendance
  if (options?.includeDutyTiming !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `⏱️ *DUTY TIMING & ATTENDANCE*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Attendance Days Logged: *${report.expenseHrmsSummary?.attendanceDaysLogged || 0} days*`,
      `• Total Field Visits (DCR): *${report.dcrSummary?.totalVisits || 0} calls*`,
      `• Avg Call Duration: *${report.dcrSummary?.avgDurationMinutes || 0} mins*`
    );

    const attList = report.expenseHrmsSummary?.attendanceDetails || [];
    if (attList.length > 0) {
      sections.push(`  _Recent Attendance Logs:_`);
      attList.slice(0, 3).forEach((a: any) => {
        const inTime = a.checkIn ? fmtTime(new Date(a.checkIn)) : "—";
        const outTime = a.checkOut ? fmtTime(new Date(a.checkOut)) : "—";
        const dur = a.durationMinutes ? ` (${fmtMinutes(a.durationMinutes)})` : "";
        sections.push(`   └ ${fmtDate(new Date(a.date))}: In ${inTime} | Out ${outTime}${dur}`);
      });
    }
  }

  // 7. Field Expenses & HRMS Claims
  if (options?.includeExpenses !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🧾 *FIELD EXPENSES & CLAIMS*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Total Approved Claims: *${fmtCurrency(report.expenseHrmsSummary?.totalExpensesApproved || 0)}*`,
      `• Pending ASM/Finance Review: *${fmtCurrency(report.expenseHrmsSummary?.totalExpensesPending || 0)}*`,
      `• Expense-to-Sales ROI: *${report.expenseHrmsSummary?.expenseToSalesRoiPercent || 0}%*`
    );

    const expList = report.expenseHrmsSummary?.expensesList || [];
    if (expList.length > 0) {
      sections.push(`  _Expense Breakdown:_`);
      expList.slice(0, 4).forEach((e: any) => {
        sections.push(`   └ ${e.category}: *${fmtCurrency(e.amount)}* [${e.status}]`);
      });
    }
  }

  // 8. Routing & Geofence Compliance
  if (options?.includeRoutingGeofence !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🛡️ *ROUTING & GEOFENCE TELEMETRY*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Geofence Accuracy Rate: *${report.routingSummary?.geofenceCompliancePercent || 0}%*`,
      `• Approved Tour Plans (MTP): *${report.routingSummary?.approvedTourPlansCount || 0} / ${report.routingSummary?.tourPlansCount || 0}*`,
      (report.routingSummary?.gpsMockFlagsCount || 0) > 0
        ? `• ⚠️ *Mock GPS Alerts:* *${report.routingSummary?.gpsMockFlagsCount} fake GPS signatures!*`
        : `• GPS Telemetry: *100% Verified Clean*`
    );
  }

  // 9. Financial Contribution P&L
  if (options?.includeFinancePnl !== false) {
    sections.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🏛️ *FINANCIAL P&L CONTRIBUTION*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• Gross Sales (PTR): *${fmtCurrency(report.financeSummary?.grossSalesRevenue || 0)}*`,
      `• Cost of Goods (PTS): *${fmtCurrency(report.financeSummary?.costOfGoodsSold || 0)}*`,
      `• Gross Profit: *${fmtCurrency(report.financeSummary?.grossProfit || 0)}*`,
      `• Field Expenses: *${fmtCurrency(report.financeSummary?.fieldExpenses || 0)}*`,
      `• *Net Territory Margin:* *${fmtCurrency(report.financeSummary?.netTerritoryContribution || 0)}* (*${report.financeSummary?.netMarginPercent || 0}%*)`
    );
  }

  // 10. Council Risk Warnings & Recommended Actions
  if (options?.includeRiskActionItems !== false) {
    if (report.councilEvaluation?.keyRiskFactors && report.councilEvaluation.keyRiskFactors.length > 0) {
      sections.push(
        ``,
        `⚠️ *COUNCIL RISK WARNINGS:*`,
        ...report.councilEvaluation.keyRiskFactors.map((r: string) => ` • 🚩 ${r}`)
      );
    }

    if (report.councilEvaluation?.actionItems && report.councilEvaluation.actionItems.length > 0) {
      sections.push(
        ``,
        `🎯 *COUNCIL RECOMMENDED ACTIONS:*`,
        ...report.councilEvaluation.actionItems.map((a: string) => ` • 📌 ${a}`)
      );
    }
  }

  sections.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💡 _Trend MR Pharma OS — Verified by 8 AI Domain Agents_`
  );

  return sections.join("\n");
}

/**
 * Builds a fleet-wide Multi-Agent Council Executive WhatsApp Digest for Admins & Managing Directors.
 */
export function formatMultiAgentCouncilExecutiveDigest(reports: any[]): string {
  const totalReps = reports.length;
  const avgCouncilScore =
    totalReps > 0
      ? Math.round(reports.reduce((acc, r) => acc + (r.councilEvaluation?.councilScore || 0), 0) / totalReps)
      : 0;

  const totalRevenue = reports.reduce((acc, r) => acc + (r.commercialSummary?.totalRevenuePtr || 0), 0);
  const totalNetMargin = reports.reduce((acc, r) => acc + (r.financeSummary?.netTerritoryContribution || 0), 0);
  const totalCalls = reports.reduce((acc, r) => acc + (r.dcrSummary?.totalVisits || 0), 0);
  const totalOrders = reports.reduce((acc, r) => acc + (r.commercialSummary?.totalOrdersCount || 0), 0);
  const totalGpsFlags = reports.reduce((acc, r) => acc + (r.routingSummary?.gpsMockFlagsCount || 0), 0);

  const topPerformer = [...reports].sort(
    (a, b) => (b.commercialSummary?.totalRevenuePtr || 0) - (a.commercialSummary?.totalRevenuePtr || 0)
  )[0];

  const sections: string[] = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏢 *EXECUTIVE MULTI-AGENT COUNCIL DIGEST*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 *Date:* ${new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`,
    `👥 *Fleet Coverage:* *${totalReps} MRs Evaluated*`,
    `🎖️ *Fleet Council Health:* *${avgCouncilScore}/100 Average Score*`,
    ``,
    `💰 *COMMERCIAL & FINANCIAL TOTALS*`,
    `• Fleet Secondary Sales: *${fmtCurrency(totalRevenue)}* (${totalOrders} orders)`,
    `• Net Territory Contribution: *${fmtCurrency(totalNetMargin)}*`,
    `• Total Field Visits (DCR): *${totalCalls} calls*`,
    totalGpsFlags > 0 ? `• ⚠️ *GPS Telemetry Flags:* *${totalGpsFlags} anomalies*` : `• Telemetry Integrity: *100% Clean*`,
    ``,
  ];

  if (topPerformer) {
    sections.push(
      `👑 *Top Performer:* *${topPerformer.fullName}* (${fmtCurrency(topPerformer.commercialSummary?.totalRevenuePtr || 0)} | Grade ${topPerformer.councilEvaluation?.overallGrade || "A"})`,
      ``
    );
  }

  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *INDIVIDUAL MR COUNCIL SCORECARDS*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );

  reports.forEach((r, idx) => {
    const gradeEmoji =
      r.councilEvaluation?.overallGrade === "A+"
        ? "🏆"
        : r.councilEvaluation?.overallGrade === "A"
        ? "🌟"
        : r.councilEvaluation?.overallGrade === "B"
        ? "✅"
        : "⚠️";
    const terr = r.territories?.map((t: any) => t.name).join(", ") || "General";
    sections.push(
      `${idx + 1}. *${r.fullName}* [${terr}]`,
      `   └ Grade: *${r.councilEvaluation?.overallGrade || "B"}* (${r.councilEvaluation?.councilScore || 0}/100) ${gradeEmoji} | Calls: ${r.dcrSummary?.totalVisits || 0} | Sales: ${fmtCurrency(r.commercialSummary?.totalRevenuePtr || 0)}`
    );
  });

  sections.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 _Trend MR Pharma OS — Executive Multi-Agent Intelligence_`
  );

  return sections.join("\n");
}

