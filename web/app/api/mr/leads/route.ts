import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { PaginationSchema } from "@/lib/validators";
import { ok, unauthorized, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";

async function getLeads(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const requestedEmployeeId = url.searchParams.get("employeeId");
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;
    if (requestedEmployeeId && !isManager) return forbidden("You may only view your own leads");

    const employee = requestedEmployeeId
      ? await db.employee.findUnique({ where: { id: requestedEmployeeId } })
      : await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return requestedEmployeeId ? notFound("Employee not found") : unauthorized("Employee record not found");

    const status = url.searchParams.get("status") ?? undefined;
    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "20",
    };
    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) return badRequest("Invalid pagination parameters");
    const { page, limit } = parsed.data;

    const where = {
      employeeId: employee.id,
      ...(status ? { status: status as "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST" } : {}),
    };

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
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

    return ok({ leads, total, page, limit });
  } catch (err) {
    console.error("[GET /api/mr/leads]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leads", 500);
  }
}

export const GET = withAuth(getLeads, [Role.MR, Role.ASM, Role.ADMIN]);
