import { db } from "@/lib/db";
import { OrderStatus, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { canTransitionOrder } from "@/lib/order-workflow";
import { z } from "zod";

const BulkStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, "Select at least one order").max(100),
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

/**
 * POST /api/orders/bulk-status
 * Transitions multiple orders forward in fulfilment state using the same
 * canTransitionOrder state machine as single-order updates.
 */
async function bulkUpdateStatus(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = BulkStatusSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { orderIds, status } = parsed.data;
    const targetStatus = status as OrderStatus;
    const isAdminOrMd = req.user.role === Role.ADMIN || req.user.role === Role.MD;

    const orders = await db.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true },
    });

    const eligibleIds: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const order of orders) {
      if (order.status === targetStatus) {
        skipped.push({ id: order.id, reason: `Already ${targetStatus}` });
        continue;
      }
      if (!isAdminOrMd) {
        const check = canTransitionOrder(order.status, targetStatus);
        if (!check.allowed) {
          skipped.push({ id: order.id, reason: check.reason || "Invalid status transition" });
          continue;
        }
      }
      eligibleIds.push(order.id);
    }

    if (eligibleIds.length > 0) {
      await db.order.updateMany({
        where: { id: { in: eligibleIds } },
        data: { status: targetStatus },
      });
    }

    return ok({
      updatedCount: eligibleIds.length,
      skippedCount: skipped.length,
      skipped,
      status: targetStatus,
      message:
        eligibleIds.length > 0
          ? `Updated ${eligibleIds.length} order${eligibleIds.length === 1 ? "" : "s"} to ${targetStatus}${
              skipped.length > 0 ? ` (${skipped.length} skipped)` : ""
            }.`
          : `No eligible orders could move to ${targetStatus}.`,
    });
  } catch (err) {
    console.error("[POST /api/orders/bulk-status]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to execute bulk status transition", 500);
  }
}

export const POST = withAuth(bulkUpdateStatus, [Role.ASM, Role.ADMIN, Role.MD, Role.WAREHOUSE]);
