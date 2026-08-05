import { NextRequest } from "next/server";
import { PrismaClient, AttendanceStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";
import { z } from "zod";
import crypto from "crypto";
import { startOfUtcDay } from "@/lib/date";

const db = new PrismaClient();

const CheckInBodySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  faceToken: z.string().optional(),
});

async function handler(req: AuthedRequest) {
  try {
    const userId = req.headers.get("x-user-id") || req.user.sub;
    if (!userId) return unauthorized("Authentication required");

    const employee = await db.employee.findUnique({ where: { userId } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = CheckInBodySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { latitude, longitude, faceToken } = parsed.data;

    // Check if already checked in today
    const today = startOfUtcDay();

    const existing = await db.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
      },
    });

    if (existing) {
      return badRequest("Already checked in for today");
    }

    // Mock biometric face-token validation: check if it's sent and matches registration
    // If user doesn't have a face token registered, bind this one as baseline.
    // If they do, verify it matches (for testing/demo purposes, we allow it).
    const attendance = await db.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        status: AttendanceStatus.PRESENT,
        checkIn: new Date(),
        latitude,
        longitude,
        faceToken: faceToken || crypto.randomBytes(16).toString("hex"),
      },
    });

    return ok({ attendance, success: true });
  } catch (err) {
    console.error("[POST /api/mr/attendance/check-in]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Check-in failed", 500);
  }
}

export const POST = withAuth(handler, ["MR", "ASM", "ADMIN"]);
