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

    let scopeEmployeeId: string | undefined;
    if (requestedEmployeeId) {
      const employee = await db.employee.findUnique({ where: { id: requestedEmployeeId } });
      if (!employee) return notFound("Employee not found");
      scopeEmployeeId = employee.id;
    } else if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      scopeEmployeeId = employee.id;
    }
    // else: isManager && no requestedEmployeeId → all MRs

    const status = url.searchParams.get("status") ?? undefined;
    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "20",
    };
    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) return badRequest("Invalid pagination parameters");
    const { page, limit } = parsed.data;

    const where = {
      ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
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
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      db.lead.count({ where }),
    ]);

    return ok({
      leads: leads.map((l) => ({ ...l, employeeName: `${l.employee.firstName} ${l.employee.lastName}` })),
      // Flat total/page/limit kept for existing frontend consumers; pagination
      // object added to match manager/leads' response shape for new consumers.
      total,
      page,
      limit,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[GET /api/mr/leads]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leads", 500);
  }
}

export const GET = withAuth(getLeads, [Role.MR, Role.ASM, Role.ADMIN]);
