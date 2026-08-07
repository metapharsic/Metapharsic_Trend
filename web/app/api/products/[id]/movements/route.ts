import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, apiError } from "@/lib/api-response";

// Full stock movement history for one product — the audit trail behind
// "leftover quantity". Read-only for everyone who can see Inventory at all
// (MR included), since transparency here doesn't need to be admin-gated.
async function getMovements(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const product = await db.product.findUnique({ where: { id }, select: { id: true, name: true, stockQty: true } });
    if (!product) return notFound("Product not found");

    const movements = await db.inventoryMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    return ok({ product, movements });
  } catch (err) {
    console.error("[GET /api/products/[id]/movements]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch movement history", 500);
  }
}

export const GET = withAuth(getMovements, [Role.MR, Role.ASM, Role.ADMIN, Role.WAREHOUSE]);
