import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { UpdateOrderStatusSchema } from "@/lib/validators";

const db = new PrismaClient();

async function updateOrderStatus(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateOrderStatusSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) return notFound("Order not found");

    const order = await db.order.update({
      where: { id },
      data: { status: parsed.data.status },
      include: { items: true, chemist: true, distributor: true },
    });

    return ok({ order });
  } catch (err) {
    console.error("[PUT /api/orders/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update order", 500);
  }
}

export const PUT = withAuth(updateOrderStatus, [Role.ASM, Role.ADMIN]);
