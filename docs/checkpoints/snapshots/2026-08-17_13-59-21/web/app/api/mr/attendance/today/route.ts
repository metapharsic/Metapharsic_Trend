import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { startOfUtcDay } from "@/lib/date";


async function handler(req: AuthedRequest) {
  try {
    const userId = req.headers.get("x-user-id") || req.user.sub;
    if (!userId) return unauthorized("Authentication required");

    const employee = await db.employee.findUnique({ where: { userId } });
    if (!employee) return unauthorized("Employee record not found");

    const today = startOfUtcDay();

    const existing = await db.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
      },
      orderBy: { checkIn: "desc" },
    });

    if (!existing) {
      return ok({ checkedIn: false, checkedOut: false });
    }

    return ok({
      checkedIn: !existing.checkOut,
      checkedOut: !!existing.checkOut,
      checkInTime: existing.checkIn,
      checkOutTime: existing.checkOut,
    });
  } catch (err) {
    console.error("[GET /api/mr/attendance/today]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch attendance status", 500);
  }
}

export const GET = withAuth(handler, ["MR", "ASM", "ADMIN"]);
