import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { runDailySummary } from "@/jobs/daily-summary";
import { ok, apiError } from "@/lib/api-response";

async function handler(_req: AuthedRequest) {
  try {
    await runDailySummary();
    return ok({ triggered: true });
  } catch (err) {
    console.error("[POST /api/manager/attendance/send-summary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to send daily summary", 500);
  }
}

export const POST = withAuth(handler, [Role.ADMIN]);
