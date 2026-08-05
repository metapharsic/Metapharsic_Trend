import { PrismaClient, Role, TourPlanStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";
import { optimizeRoute, RouteStop } from "@/lib/route-optimizer";
import { startOfUtcDay, addUtcDays } from "@/lib/date";

const db = new PrismaClient();

async function getOptimizedRoute(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? startOfUtcDay(new Date(dateParam)) : startOfUtcDay();
    if (Number.isNaN(targetDate.getTime())) return badRequest("Invalid date parameter");

    const startLat = Number(searchParams.get("latitude"));
    const startLon = Number(searchParams.get("longitude"));

    // Planned doctors for the target day, from the MR's approved tour plan.
    const plannedDays = await db.tourPlanDay.findMany({
      where: {
        date: { gte: targetDate, lt: addUtcDays(targetDate, 1) },
        tourPlan: { employeeId: employee.id, status: TourPlanStatus.APPROVED },
        plannedDoctorId: { not: null },
      },
      include: {
        plannedDoctor: {
          select: { id: true, fullName: true, latitude: true, longitude: true, dpsTier: true },
        },
      },
    });

    const stops: RouteStop[] = plannedDays
      .filter((d) => d.plannedDoctor)
      .map((d) => ({
        id: d.plannedDoctor!.id,
        name: d.plannedDoctor!.fullName,
        type: "DOCTOR" as const,
        latitude: d.plannedDoctor!.latitude,
        longitude: d.plannedDoctor!.longitude,
      }));

    if (stops.length === 0) {
      return ok({
        date: targetDate,
        stops: [],
        totalDistanceKm: 0,
        message: "No approved tour plan stops for this date",
      });
    }

    // Start from the supplied position, else the first stop itself.
    const start =
      Number.isFinite(startLat) && Number.isFinite(startLon)
        ? { latitude: startLat, longitude: startLon }
        : { latitude: stops[0].latitude, longitude: stops[0].longitude };

    const optimized = optimizeRoute(stops, start);

    return ok({ date: targetDate, ...optimized });
  } catch (err) {
    console.error("[GET /api/sfa/route-plan]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to build optimized route", 500);
  }
}

export const GET = withAuth(getOptimizedRoute, [Role.MR, Role.ASM, Role.ADMIN]);
