import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";


const emptyToNull = (val: unknown) => (val === "" || val === null ? null : val);

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  composition: z.preprocess(emptyToNull, z.string().nullable().optional()),
  strength: z.preprocess(emptyToNull, z.string().nullable().optional()),
  packSize: z.preprocess(emptyToNull, z.string().nullable().optional()),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  marginStructure: z.preprocess(emptyToNull, z.string().nullable().optional()),
  therapySegment: z.preprocess(emptyToNull, z.string().nullable().optional()),
  hsnCode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  manufacturer: z.preprocess(emptyToNull, z.string().nullable().optional()),
  gstPct: z.coerce.number().min(0).max(100).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).optional(),
  currentBatchNo: z.preprocess(emptyToNull, z.string().nullable().optional()),
  currentMfgDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  currentExpDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
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
  } catch (err: any) {
    if (err?.code === "P2002") return badRequest("A product with this name already exists");
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

    // Check if the product has associated commercial orders or customer claims
    const [orderItemCount, claimCount] = await Promise.all([
      db.orderItem.count({ where: { productId: id } }),
      db.claim.count({ where: { productId: id } }),
    ]);

    if (orderItemCount > 0 || claimCount > 0) {
      return badRequest("Cannot delete product because it has associated commercial orders, sales history, or customer claims.");
    }

    // Clean up dependent catalog, sample, and audit associations before deleting the product
    await db.$transaction([
      db.hospitalFormulary.deleteMany({ where: { productId: id } }),
      db.discountScheme.deleteMany({ where: { productId: id } }),
      db.hospitalTender.deleteMany({ where: { productId: id } }),
      db.prescriptionHistory.deleteMany({ where: { productId: id } }),
      db.sample.deleteMany({ where: { productId: id } }),
      db.sampleInventory.deleteMany({ where: { productId: id } }),
      db.sampleAllocationLog.deleteMany({ where: { productId: id } }),
      db.visualAid.deleteMany({ where: { productId: id } }),
      db.inventoryMovement.deleteMany({ where: { productId: id } }),
      db.product.delete({ where: { id } }),
    ]);

    return ok({ message: "Product deleted" });
  } catch (err: any) {
    if (err?.code === "P2003") {
      return badRequest("Cannot delete product because it has associated orders, sample distributions, or hospital contracts.");
    }
    console.error("[DELETE /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete product", 500);
  }
}

export const PUT = withAuth(updateProduct, [Role.ADMIN, Role.MD, Role.ASM, Role.WAREHOUSE]);
export const DELETE = withAuth(deleteProduct, [Role.ADMIN, Role.MD, Role.ASM, Role.WAREHOUSE]);
