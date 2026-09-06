import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { DashboardService } from "@/services/dashboard.service";

/**
 * Area Sales Manager (ASM) field team dashboard.
 * Direct calculations for daily & MTD performance, planned vs completed calls, and collections.
 */
async function getAsmDashboard(req: AuthedRequest) {
  try {
    let managerId: string | undefined;
    if (req.user.role === Role.ASM) {
      const asmEmployee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!asmEmployee) return unauthorized("Employee record not found");
      managerId = asmEmployee.id;
    }

    const data = await DashboardService.calculateAsmDashboard(managerId);
    return ok(data);
  } catch (err) {
    console.error("[GET /api/asm/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch ASM dashboard", 500);
  }
}

export const GET = withAuth(getAsmDashboard, [Role.ASM, Role.ADMIN, Role.MD]);
