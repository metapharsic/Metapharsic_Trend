import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, notFound } from "@/lib/api-response";
import { z } from "zod";

const PublishSchemeSchema = z.object({
  name: z.string().min(3).max(100),
  productId: z.string().uuid(),
  minQuantity: z.coerce.number().int().min(1).default(1),
  discountPct: z.coerce.number().min(0).max(100),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

const ToggleSchemeSchema = z.object({
  schemeId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * GET /api/simulator/scheme/publish
 * Retrieves all registered discount schemes with product info.
 */
async function getSchemes(req: AuthedRequest) {
  try {
    const schemes = await db.discountScheme.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            mrp: true,
            ptr: true,
            pts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      totalSchemes: schemes.length,
      schemes: schemes.map((s) => ({
        id: s.id,
        name: s.name,
        productId: s.productId,
        productName: s.product?.name ?? "General Portfolio",
        productSku: s.product?.sku ?? "N/A",
        mrp: Number(s.product?.mrp ?? 0),
        ptr: Number(s.product?.ptr ?? 0),
        pts: Number(s.product?.pts ?? 0),
        minQuantity: s.minQuantity,
        discountPct: Number(s.discountPct),
        isActive: s.isActive,
        validFrom: s.validFrom.toISOString().slice(0, 10),
        validTo: s.validTo.toISOString().slice(0, 10),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/simulator/scheme/publish]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch discount schemes", 500);
  }
}

/**
 * POST /api/simulator/scheme/publish
 * Creates a new active discount scheme directly into PostgreSQL DiscountScheme table.
 */
async function publishScheme(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = PublishSchemeSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { name, productId, minQuantity, discountPct, validFrom, validTo, isActive } = parsed.data;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return notFound("Selected product not found in database");

    const now = new Date();
    const fromDate = validFrom ? new Date(`${validFrom}T00:00:00.000Z`) : now;
    const toDate = validTo
      ? new Date(`${validTo}T23:59:59.999Z`)
      : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days default

    // Check if unique name exists, update if exists or create new
    const scheme = await db.discountScheme.upsert({
      where: { name },
      update: {
        productId,
        minQuantity,
        discountPct,
        isActive,
        validFrom: fromDate,
        validTo: toDate,
      },
      create: {
        name,
        productId,
        minQuantity,
        discountPct,
        isActive,
        validFrom: fromDate,
        validTo: toDate,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    return ok({
      message: `Commercial Discount Scheme '${scheme.name}' published successfully to live database!`,
      scheme: {
        id: scheme.id,
        name: scheme.name,
        productId: scheme.productId,
        productName: scheme.product?.name,
        minQuantity: scheme.minQuantity,
        discountPct: scheme.discountPct,
        isActive: scheme.isActive,
        validFrom: scheme.validFrom.toISOString().slice(0, 10),
        validTo: scheme.validTo.toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    console.error("[POST /api/simulator/scheme/publish]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to publish discount scheme", 500);
  }
}

/**
 * PATCH /api/simulator/scheme/publish
 * Toggles active state of an existing scheme.
 */
async function toggleScheme(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = ToggleSchemeSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { schemeId, isActive } = parsed.data;
    const updated = await db.discountScheme.update({
      where: { id: schemeId },
      data: { isActive },
      include: { product: { select: { name: true } } },
    });

    return ok({
      message: `Scheme '${updated.name}' is now ${isActive ? "ACTIVE" : "INACTIVE"}.`,
      scheme: updated,
    });
  } catch (err) {
    console.error("[PATCH /api/simulator/scheme/publish]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update scheme status", 500);
  }
}

export const GET = withAuth(getSchemes, [Role.ADMIN, Role.MD, Role.NSM, Role.FINANCE, Role.MARKETING]);
export const POST = withAuth(publishScheme, [Role.ADMIN, Role.MD, Role.NSM, Role.FINANCE, Role.MARKETING]);
export const PATCH = withAuth(toggleScheme, [Role.ADMIN, Role.MD, Role.NSM, Role.FINANCE, Role.MARKETING]);
