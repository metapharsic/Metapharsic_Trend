import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";

async function getDoctorDashboard(req: AuthedRequest) {
  try {
    const doctor = await db.doctor.findUnique({ where: { userId: req.user.sub } });
    if (!doctor) return unauthorized("Doctor record not found for this login");

    const [visits, sampleAgg] = await Promise.all([
      db.visit.findMany({
        where: { doctorId: doctor.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          employee: { select: { firstName: true, lastName: true } },
          samples: { include: { product: { select: { name: true } } } },
        },
      }),
      db.sample.aggregate({
        where: { visit: { doctorId: doctor.id } },
        _sum: { quantity: true },
      }),
    ]);

    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentVisits = visits.filter((v) => v.createdAt >= last30);

    return ok({
      doctor: { id: doctor.id, fullName: doctor.fullName, primarySpecialty: doctor.primarySpecialty },
      visits: visits.map((v) => ({
        id: v.id,
        mrName: `${v.employee.firstName} ${v.employee.lastName}`,
        purpose: v.purpose,
        feedback: v.feedback,
        createdAt: v.createdAt,
        boxesPlaced: v.boxesPlaced,
        samples: v.samples.map((s) => ({ product: s.product.name, quantity: s.quantity })),
      })),
      visitsLast30Days: recentVisits.length,
      totalSamplesReceived: sampleAgg._sum.quantity ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/doctor/dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch doctor dashboard", 500);
  }
}

export const GET = withAuth(getDoctorDashboard, [Role.DOCTOR]);
