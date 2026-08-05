import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { PaginationSchema } from "@/lib/validators";
import { ok, apiError, badRequest } from "@/lib/api-response";

async function getLeads(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const mrId = url.searchParams.get("mrId") ?? undefined; // User ID of MR
    const status = url.searchParams.get("status") ?? undefined;
    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "50",
    };
    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) return badRequest("Invalid pagination parameters");
    const { page, limit } = parsed.data;

    let employeeId: string | undefined;
    if (mrId) {
      const employee = await db.employee.findUnique({ where: { userId: mrId } });
      if (employee) employeeId = employee.id;
    }

    const where = {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status: status as "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST" } : {}),
    };

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          visit: {
            select: {
              purpose: true,
              createdAt: true,
              doctor: { select: { id: true, fullName: true } },
              chemist: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.lead.count({ where }),
    ]);

    return ok({
      leads: leads.map((l) => ({ ...l, mrName: `${l.employee.firstName} ${l.employee.lastName}` })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/manager/leads]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leads", 500);
  }
}

export const GET = withAuth(getLeads, [Role.ASM, Role.ADMIN]);
