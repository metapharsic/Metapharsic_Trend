import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { receiptUrl } from "@/lib/upload";


async function getClaims(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;

    let where: Record<string, unknown> = { ...(status ? { status } : {}) };
    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      where = { ...where, employeeId: employee.id };
    }

    const [claims, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.expense.count({ where }),
    ]);

    return ok({
      claims: claims.map((c) => ({ ...c, receiptUrl: c.receiptUrl ? receiptUrl(c.receiptUrl) : null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/expenses/claims]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch expense claims", 500);
  }
}

export const GET = withAuth(getClaims, [Role.MR, Role.ASM, Role.ADMIN]);
