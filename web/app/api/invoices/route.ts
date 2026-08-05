import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, unauthorized } from "@/lib/api-response";

async function getInvoices(req: AuthedRequest) {
  try {
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;
    let whereClause = {};

    if (!isManager) {
      // Find MR employee record
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
      });
      if (!employee) return unauthorized("Employee record not found");
      whereClause = { order: { employeeId: employee.id } };
    }

    const invoices = await db.invoice.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            chemist: { select: { id: true, name: true } },
            distributor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ invoices });
  } catch (err) {
    console.error("[GET /api/invoices]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch invoices", 500);
  }
}

export const GET = withAuth(getInvoices, [Role.MR, Role.ASM, Role.ADMIN]);
