import { db } from "@/lib/db";
import { Role, OrderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, unauthorized, forbidden, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { canTransitionOrder } from "@/lib/order-workflow";
import { z } from "zod";

const UpdateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.nativeEnum(OrderStatus),
});

async function resolveDistributor(req: AuthedRequest, requestedId: string | null) {
  const isManager = req.user.role === Role.ADMIN || req.user.role === Role.MD;
  if (requestedId && !isManager) return { error: forbidden("You may only manage your own orders") };

  const distributor = requestedId
    ? await db.distributor.findUnique({ where: { id: requestedId } })
    : (isManager
        ? await db.distributor.findFirst()
        : await db.distributor.findUnique({ where: { userId: req.user.sub } }));

  if (!distributor) {
    return {
      error: requestedId
        ? notFound("Distributor not found")
        : notFound("No distributor account is linked to this login"),
    };
  }
  return { distributor };
}

async function getOrders(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resolved = await resolveDistributor(req, searchParams.get("distributorId"));
    if (resolved.error) return resolved.error;

    const status = searchParams.get("status") as OrderStatus | null;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const where = { distributorId: resolved.distributor!.id, ...(status ? { status } : {}) };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          chemist: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          invoice: { select: { invoiceNo: true, amount: true, paid: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return ok({ orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/distributor/orders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch orders", 500);
  }
}

/**
 * Advances an order's fulfilment status. Restricted to the order's own distributor
 * (or ADMIN) and to the forward-only transitions in lib/order-workflow.ts.
 */
async function updateOrderStatus(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const isAdmin = req.user.role === Role.ADMIN;
    const distributor = isAdmin
      ? null
      : await db.distributor.findUnique({ where: { userId: req.user.sub } });

    if (!isAdmin && !distributor) {
      return notFound("No distributor account is linked to this login");
    }

    const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return notFound("Order not found");
    if (!isAdmin && order.distributorId !== distributor!.id) {
      return forbidden("This order does not belong to your account");
    }

    const transition = canTransitionOrder(order.status, parsed.data.status);
    if (!transition.allowed) return badRequest(transition.reason ?? "Invalid status transition");

    const updated = await db.order.update({
      where: { id: order.id },
      data: { status: parsed.data.status },
      include: { items: true, chemist: true },
    });

    return ok({ order: updated });
  } catch (err) {
    console.error("[PUT /api/distributor/orders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update order", 500);
  }
}

export const GET = withAuth(getOrders, [Role.DISTRIBUTOR, Role.ADMIN, Role.MD]);
export const PUT = withAuth(updateOrderStatus, [Role.DISTRIBUTOR, Role.ADMIN, Role.MD]);
