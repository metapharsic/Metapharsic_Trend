import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest, notFound } from "@/lib/api-response";
import { z } from "zod";

const AllocateSchema = z.object({
  employeeId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
});

async function handler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = AllocateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());
    const { employeeId, productId, quantity } = parsed.data;

    const [employee, product] = await Promise.all([
      db.employee.findUnique({ where: { id: employeeId } }),
      db.product.findUnique({ where: { id: productId } }),
    ]);
    if (!employee) return notFound("MR not found");
    if (!product) return notFound("Product not found");

    const allocatingManager = await db.employee.findUnique({ where: { userId: req.user.sub } });

    const [inventory] = await db.$transaction([
      db.sampleInventory.upsert({
        where: { employeeId_productId: { employeeId, productId } },
        create: { employeeId, productId, quantity, allocatedQty: quantity },
        update: { quantity: { increment: quantity }, allocatedQty: { increment: quantity } },
      }),
      db.sampleAllocationLog.create({
        data: { employeeId, productId, quantity, allocatedById: allocatingManager?.id ?? null },
      }),
    ]);

    return ok({ inventory });
  } catch (err) {
    console.error("[POST /api/manager/mr-stock/allocate]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to allocate stock", 500);
  }
}

export const POST = withAuth(handler, [Role.ASM, Role.ADMIN, Role.MD]);
