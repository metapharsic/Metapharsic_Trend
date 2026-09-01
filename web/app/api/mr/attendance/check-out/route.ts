import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError, notFound } from "@/lib/api-response";
import { z } from "zod";
import { startOfUtcDay } from "@/lib/date";


const CheckOutBodySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

async function handler(req: AuthedRequest) {
  try {
    const userId = req.headers.get("x-user-id") || req.user.sub;
    if (!userId) return unauthorized("Authentication required");

    const employee = await db.employee.findUnique({ where: { userId } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json().catch(() => ({}));
    const parsed = CheckOutBodySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { latitude, longitude } = parsed.data;

    const today = startOfUtcDay();

    const existing = await db.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
        checkOut: null,
      },
      orderBy: { checkIn: "desc" },
    });

    if (!existing) {
      return badRequest("No active check-in found for today");
    }

    const attendance = await db.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: new Date(),
      },
    });

    return ok({ attendance, success: true });
  } catch (err) {
    console.error("[POST /api/mr/attendance/check-out]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Check-out failed", 500);
  }
}

export const POST = withAuth(handler, ["MR", "ASM", "ADMIN"]);
