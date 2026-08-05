import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { runComplianceScan } from "@/jobs/compliance-alerts";
import { z } from "zod";
import { startOfUtcMonth } from "@/lib/date";

const db = new PrismaClient();

const UnlockSchema = z.object({
  userId: z.string().uuid(),
});

async function getComplianceStatus(req: AuthedRequest) {
  try {
    const monthStart = startOfUtcMonth();

    const [lockedUsers, mockedLogs, anomalousVisits] = await Promise.all([
      db.user.findMany({
        where: { lockedAt: { not: null } },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lockedAt: true,
          lockedReason: true,
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { lockedAt: "desc" },
      }),
      db.locationLog.count({ where: { isMocked: true, recordedAt: { gte: monthStart } } }),
      db.visit.count({ where: { anomalyFlag: true, createdAt: { gte: monthStart } } }),
    ]);

    return ok({
      lockedUsers,
      mockedLocationLogsThisMonth: mockedLogs,
      anomalousVisitsThisMonth: anomalousVisits,
    });
  } catch (err) {
    console.error("[GET /api/manager/compliance]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch compliance status", 500);
  }
}

async function runScanOrUnlock(req: AuthedRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // With a userId this is an unlock; without one it triggers an on-demand scan.
    if (body && typeof body === "object" && "userId" in body) {
      const parsed = UnlockSchema.safeParse(body);
      if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

      const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
      if (!user) return notFound("User not found");

      const unlocked = await db.user.update({
        where: { id: parsed.data.userId },
        data: { isActive: true, lockedAt: null, lockedReason: null },
        select: { id: true, email: true, isActive: true },
      });
      return ok({ unlocked });
    }

    const result = await runComplianceScan();
    return ok(result);
  } catch (err) {
    console.error("[POST /api/manager/compliance]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Compliance action failed", 500);
  }
}

export const GET = withAuth(getComplianceStatus, [Role.ASM, Role.ADMIN]);
export const POST = withAuth(runScanOrUnlock, [Role.ADMIN]);
