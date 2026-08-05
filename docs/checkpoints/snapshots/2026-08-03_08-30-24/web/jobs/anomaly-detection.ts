import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { checkVisitAnomaly } from "@/lib/gps";

const db = new PrismaClient();

async function runAnomalyScan() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const employeeIds = await db.visit.findMany({
    where: { createdAt: { gte: since } },
    distinct: ["employeeId"],
    select: { employeeId: true },
  });

  let flagged = 0;

  for (const { employeeId } of employeeIds) {
    const visits = await db.visit.findMany({
      where: { employeeId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    });

    for (let i = 1; i < visits.length; i++) {
      const prev = visits[i - 1];
      const curr = visits[i];

      if (curr.anomalyFlag) continue;

      const result = checkVisitAnomaly(
        prev.latitude,
        prev.longitude,
        prev.createdAt,
        curr.latitude,
        curr.longitude,
        curr.createdAt
      );

      if (result.isAnomalous) {
        await db.visit.update({
          where: { id: curr.id },
          data: {
            anomalyFlag: true,
            anomalyDetails: JSON.stringify({
              reason: result.reason,
              calculatedSpeed: result.calculatedSpeed,
              thresholdKmh: Number(process.env.ANOMALY_MAX_SPEED_KMH ?? 60),
              distanceKm: result.distanceKm,
              timeDiffMinutes: result.timeDiffMinutes,
              previousVisitId: prev.id,
              detectedBy: "scheduled_job",
            }),
          },
        });
        flagged++;
      }
    }
  }

  if (flagged > 0) {
    console.log(`[AnomalyJob] Flagged ${flagged} visit(s) at ${new Date().toISOString()}`);
  }
}

export function startAnomalyDetectionJob() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      await runAnomalyScan();
    } catch (err) {
      console.error("[AnomalyJob] Error:", err);
    }
  });
  console.log("[AnomalyJob] Scheduled — runs every 10 minutes");
}
