import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, unauthorized, forbidden, apiError } from "@/lib/api-response";

async function getInvoices(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedId = searchParams.get("distributorId");
    const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;

    if (requestedId && !isManager) return forbidden("You may only view your own invoices");

    const distributor = requestedId
      ? await db.distributor.findUnique({ where: { id: requestedId } })
      : (isManager
          ? await db.distributor.findFirst()
          : await db.distributor.findUnique({ where: { userId: req.user.sub } }));

    if (!distributor) {
      return requestedId
        ? notFound("Distributor not found")
        : notFound("No distributor account is linked to this login");
    }

    const invoices = await db.invoice.findMany({
      where: { order: { distributorId: distributor.id } },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            chemist: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ invoices });
  } catch (err) {
    console.error("[GET /api/distributor/invoices]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch invoices", 500);
  }
}

export const GET = withAuth(getInvoices, [Role.DISTRIBUTOR, Role.ADMIN, Role.MD]);
