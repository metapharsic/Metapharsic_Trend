import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";

// Full "give stock to MR" event log. ASM/ADMIN see everyone (optionally
// filtered to one MR); an MR hitting this only ever sees their own —
// same data both sides just need, tracked at last.
async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let employeeId = searchParams.get("employeeId") ?? undefined;

    if (req.user.role === Role.MR) {
      const self = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!self) return unauthorized("Employee record not found");
      employeeId = self.id;
    }

    const logs = await db.sampleAllocationLog.findMany({
      where: employeeId ? { employeeId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        product: { select: { name: true } },
        allocatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return ok({ logs });
  } catch (err) {
    console.error("[GET /api/manager/mr-stock/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch allocation history", 500);
  }
}

export const GET = withAuth(handler, [Role.MR, Role.ASM, Role.ADMIN]);
