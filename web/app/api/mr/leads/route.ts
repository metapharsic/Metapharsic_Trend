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
    const search = url.searchParams.get("search") ?? undefined;
    const beatName = url.searchParams.get("beatName") ?? undefined;

    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "50",
    };
    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) return badRequest("Invalid pagination parameters");
    const { page, limit } = parsed.data;

    const where: any = {
      ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
      ...(status ? { status: status as "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST" } : {}),
    };

    if (search) {
      where.OR = [
        { details: { contains: search, mode: "insensitive" } },
        { followUpAction: { contains: search, mode: "insensitive" } },
        { visit: { doctor: { fullName: { contains: search, mode: "insensitive" } } } },
        { visit: { chemist: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    if (beatName) {
      where.AND = [
        {
          OR: [
            { visit: { doctor: { beatName: { contains: beatName, mode: "insensitive" } } } },
            { visit: { chemist: { beatName: { contains: beatName, mode: "insensitive" } } } },
          ],
        },
      ];
    }

    const [leads, total, newCount, inProgressCount, convertedCount, lostCount] = await Promise.all([
      db.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          visit: {
            select: {
              id: true,
              purpose: true,
              feedback: true,
              receptiveness: true,
              cqsScore: true,
              boxesPlaced: true,
              createdAt: true,
              doctor: {
                select: {
                  id: true,
                  fullName: true,
                  primarySpecialty: true,
                  clinicAddress: true,
                  subArea: true,
                  beatName: true,
                  territory: { select: { name: true } },
                },
              },
              chemist: {
                select: {
                  id: true,
                  name: true,
                  contactPerson: true,
                  address: true,
                  subArea: true,
                  beatName: true,
                  territory: { select: { name: true } },
                },
              },
            },
          },
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      db.lead.count({ where }),
      db.lead.count({ where: { ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}), status: "NEW" } }),
      db.lead.count({ where: { ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}), status: "IN_PROGRESS" } }),
      db.lead.count({ where: { ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}), status: "CONVERTED" } }),
      db.lead.count({ where: { ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}), status: "LOST" } }),
    ]);

    const overallTotal = newCount + inProgressCount + convertedCount + lostCount;
    const conversionRate = overallTotal > 0 ? Math.round((convertedCount / overallTotal) * 100) : 0;

    const mappedLeads = leads.map((l) => {
      const targetName = l.visit.doctor?.fullName || l.visit.chemist?.name || "Customer";
      const targetType = l.visit.doctor ? "DOCTOR" : l.visit.chemist ? "CHEMIST" : "PROSPECT";
      const subArea = l.visit.doctor?.subArea || l.visit.chemist?.subArea || null;
      const beat = l.visit.doctor?.beatName || l.visit.chemist?.beatName || null;
      const territoryName = l.visit.doctor?.territory?.name || l.visit.chemist?.territory?.name || null;

      return {
        ...l,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        targetName,
        targetType,
        subArea,
        beatName: beat,
        territoryName,
        cqsScore: l.visit.cqsScore,
        boxesPlaced: l.visit.boxesPlaced,
      };
    });

    return ok({
      leads: mappedLeads,
      total,
      page,
      limit,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      summary: {
        total: overallTotal,
        new: newCount,
        inProgress: inProgressCount,
        converted: convertedCount,
        lost: lostCount,
        conversionRate,
      },
    });
  } catch (err) {
    console.error("[GET /api/mr/leads]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leads", 500);
  }
}

export const GET = withAuth(getLeads, [Role.MR, Role.ASM, Role.ADMIN]);
