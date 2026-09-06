import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";


async function getStats(req: AuthedRequest) {
  try {
    const [territories, doctors, chemists, distributors, products] = await Promise.all([
      db.territory.count(),
      db.doctor.count(),
      db.chemist.count(),
      db.distributor.count(),
      db.product.count(),
    ]);

    return ok({ territories, doctors, chemists, distributors, products });
  } catch (err) {
    console.error("[GET /api/manager/dashboard/stats]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch dashboard stats", 500);
  }
}

export const GET = withAuth(getStats);
