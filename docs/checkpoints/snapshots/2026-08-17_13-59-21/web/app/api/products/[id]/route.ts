import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";


const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  composition: z.string().optional(),
  strength: z.string().optional(),
  packSize: z.string().optional(),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  marginStructure: z.string().optional(),
  therapySegment: z.string().optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
  currentBatchNo: z.string().nullable().optional(),
  currentMfgDate: z.coerce.date().nullable().optional(),
  currentExpDate: z.coerce.date().nullable().optional(),
});

async function updateProduct(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return notFound("Product not found");

    // Log manual stock corrections/restocks — same audit trail as order
    // deductions, so every change to "leftover quantity" is explained.
    // Wrapped together with the product write so a crash between the two
    // can never leave a stock change with no movement record.
    const stockChanged = parsed.data.stockQty !== undefined && parsed.data.stockQty !== existing.stockQty;
    const employee = stockChanged ? await db.employee.findUnique({ where: { userId: req.user.sub } }) : null;

    const product = await db.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: parsed.data });

      if (stockChanged) {
        await tx.inventoryMovement.create({
          data: {
            productId: id,
            type: "MANUAL_ADJUSTMENT",
            delta: parsed.data.stockQty! - existing.stockQty,
            quantityAfter: parsed.data.stockQty!,
            employeeId: employee?.id ?? null,
            note: "Manual stock edit via Inventory",
          },
        });
      }

      return updated;
    });

    return ok({ product });
  } catch (err) {
    console.error("[PUT /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update product", 500);
  }
}

async function deleteProduct(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return notFound("Product not found");

    await db.product.delete({ where: { id } });
    return ok({ message: "Product deleted" });
  } catch (err: any) {
    if (err?.code === "P2003") {
      return badRequest("Cannot delete product because it has associated orders, sample distributions, or hospital contracts.");
    }
    console.error("[DELETE /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete product", 500);
  }
}

export const PUT = withAuth(updateProduct, [Role.ASM, Role.ADMIN]);
export const DELETE = withAuth(deleteProduct, [Role.ASM, Role.ADMIN]);
