import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { projectSchemeMargin } from "@/lib/scheme";
import { z } from "zod";

const db = new PrismaClient();

const SimulateSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  /** Stockist discount off PTR, as a percentage. */
  discountPercent: z.coerce.number().min(0).max(100),
});

/**
 * Scheme Margin Simulator — docs Phase 4 Week 16.
 * Projects the margin impact of a proposed stockist discount before it is published,
 * using the product's real MRP/PTR/PTS pricing ladder.
 */
async function simulateScheme(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = SimulateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { productId, quantity, discountPercent } = parsed.data;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return notFound("Product not found");

    const mrp = Number(product.mrp ?? product.price);
    const ptr = Number(product.ptr ?? product.price);
    const pts = Number(product.pts ?? product.price);

    if (pts <= 0) {
      return badRequest("Product has no PTS (price-to-stockist) set; margin cannot be projected");
    }

    const projection = projectSchemeMargin({ mrp, ptr, pts }, quantity, discountPercent);

    return ok({
      product: { id: product.id, name: product.name, sku: product.sku, mrp, ptr, pts },
      input: { quantity, discountPercent },
      projection,
    });
  } catch (err) {
    console.error("[POST /api/simulator/scheme]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to simulate scheme", 500);
  }
}

export const POST = withAuth(simulateScheme, [Role.ASM, Role.ADMIN]);
