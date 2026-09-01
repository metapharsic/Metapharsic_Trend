import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true, name: true } } },
    });
    if (!employee) return unauthorized("Employee record not found");

    return ok({ territories: employee.territories });
  } catch (err) {
    console.error("[GET /api/mr/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch territories", 500);
  }
}

export const GET = withAuth(handler, "MR");
