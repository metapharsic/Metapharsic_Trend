import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, apiError } from "@/lib/api-response";


async function handler(req: AuthedRequest) {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            managerId: true,
          },
        },
      },
    });
    if (!user) return notFound("User not found");
    return ok({ user });
  } catch (err) {
    console.error("[GET /api/mr/profile]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch profile", 500);
  }
}

export const GET = withAuth(handler, "MR");
