import { db } from "@/lib/db";
import cron from "node-cron";
import { calculateDps } from "@/lib/dps";


const CQS_LOOKBACK_VISITS = 10;

/**
 * Running CQS average over the doctor's most recent scored visits.
 * Returns null when no visit has a CQS yet, so the caller can fall back rather
 * than treating "no data" as a zero engagement score.
 */
async function runningCqsAverage(doctorId: string): Promise<number | null> {
  const scored = await db.visit.findMany({
    where: { doctorId, cqsScore: { not: null } },
    select: { cqsScore: true },
    orderBy: { createdAt: "desc" },
    take: CQS_LOOKBACK_VISITS,
  });

  if (scored.length === 0) return null;
  const sum = scored.reduce((total, v) => total + (v.cqsScore ?? 0), 0);
  return sum / scored.length;
}

/**
 * Recomputes DPS for every doctor and persists the score, tier, and derived
 * monthly visit requirement. Returns the number of doctors updated.
 */
export async function runDpsScoring(): Promise<number> {
  const doctors = await db.doctor.findMany({
    include: {
      territory: { select: { priority: true } },
      crmProfile: { select: { salesConversionRate: true } },
    },
  });

  let updated = 0;

  for (const doctor of doctors) {
    // EngagementScore is the running Call Quality Score average. Doctors with no
    // CQS-scored visits yet fall back to salesConversionRate as a coarse proxy.
    const cqsAverage = await runningCqsAverage(doctor.id);
    const engagementScore = cqsAverage ?? (doctor.crmProfile?.salesConversionRate ?? 0) * 100;

    const result = calculateDps({
      patientFootfallDaily: doctor.patientFootfallDaily,
      avgPrescriptionsDaily: doctor.avgPrescriptionsDaily,
      influencerLevel: doctor.influencerLevel,
      territoryPriority: doctor.territory.priority,
      engagementScore,
    });

    await db.doctor.update({
      where: { id: doctor.id },
      data: {
        dpsScore: result.score,
        dpsTier: result.tier,
        requiredMonthlyVisits: result.requiredMonthlyVisits,
        dpsCalculatedAt: new Date(),
        intelligenceScore: Math.round(result.score),
      },
    });
    updated++;
  }

  return updated;
}

export function startDpsScoringJob() {
  // Nightly at 01:00 — inputs change slowly (footfall, influencer tier, territory priority).
  cron.schedule("0 1 * * *", async () => {
    try {
      const updated = await runDpsScoring();
      console.log(`[DpsJob] Scored ${updated} doctor(s) at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("[DpsJob] Error:", err);
    }
  });
  console.log("[DpsJob] Scheduled — runs nightly at 01:00");
}
