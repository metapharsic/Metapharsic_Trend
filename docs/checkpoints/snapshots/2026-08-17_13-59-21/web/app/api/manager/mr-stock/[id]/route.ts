import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest, notFound } from "@/lib/api-response";
import { z } from "zod";

const UpdateSchema = z.object({
  quantity: z.coerce.number().int().min(0),
  allocatedQty: z.coerce.number().int().min(0).optional(),
});

// PATCH: admin/ASM/MD sets an absolute quantity on an MR's sample stock row.
// Logs the delta (new - old) as a SampleAllocationLog entry so the audit
// trail (see allocate/route.ts) stays intact even for direct corrections.
async function patchHandler(req: AuthedRequest, context: { params: Record<string, string | string[] | undefined> }) {
  try {
    const id = context.params.id as string;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());
    const { quantity, allocatedQty } = parsed.data;

    const existing = await db.sampleInventory.findUnique({ where: { id } });
    if (!existing) return notFound("Sample stock row not found");

    const adjustingManager = await db.employee.findUnique({ where: { userId: req.user.sub } });
    const delta = quantity - existing.quantity;

    const [inventory] = await db.$transaction([
      db.sampleInventory.update({
        where: { id },
        data: {
          quantity,
          ...(allocatedQty !== undefined ? { allocatedQty } : {}),
        },
      }),
      ...(delta !== 0
        ? [
            db.sampleAllocationLog.create({
              data: {
                employeeId: existing.employeeId,
                productId: existing.productId,
                quantity: delta,
                allocatedById: adjustingManager?.id ?? null,
              },
            }),
          ]
        : []),
    ]);

    return ok({ inventory });
  } catch (err) {
    console.error("[PATCH /api/manager/mr-stock/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update MR stock", 500);
  }
}

// DELETE: removes a product line entirely from an MR's carried stock.
// Logged as a full-removal SampleAllocationLog entry (negative quantity)
// rather than a silent delete, per the audit-trail pattern used elsewhere.
async function deleteHandler(req: AuthedRequest, context: { params: Record<string, string | string[] | undefined> }) {
  try {
    const id = context.params.id as string;

    const existing = await db.sampleInventory.findUnique({ where: { id } });
    if (!existing) return notFound("Sample stock row not found");

    const removingManager = await db.employee.findUnique({ where: { userId: req.user.sub } });

    await db.$transaction([
      db.sampleAllocationLog.create({
        data: {
          employeeId: existing.employeeId,
          productId: existing.productId,
          quantity: -existing.quantity,
          allocatedById: removingManager?.id ?? null,
        },
      }),
      db.sampleInventory.delete({ where: { id } }),
    ]);

    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/manager/mr-stock/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete MR stock row", 500);
  }
}

export const PATCH = withAuth(patchHandler, [Role.ASM, Role.ADMIN, Role.MD]);
export const DELETE = withAuth(deleteHandler, [Role.ASM, Role.ADMIN, Role.MD]);
