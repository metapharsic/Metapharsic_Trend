import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import { CreateOrderSchema, PaginationSchema } from "@/lib/validators";
import { bestSchemeFor, round2 } from "@/lib/scheme";

const db = new PrismaClient();

async function getOrders(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;

    let chemistFilter: Record<string, unknown> | undefined;
    if (!isManager) {
      const employee = await db.employee.findUnique({
        where: { userId: req.user.sub },
        include: { territories: true },
      });
      if (!employee) return unauthorized("Employee record not found");
      const territoryIds = employee.territories.map((t) => t.id);
      chemistFilter = { territoryId: { in: territoryIds } };
    }

    const where = {
      ...(status ? { status: status as any } : {}),
      ...(chemistFilter ? { chemist: chemistFilter } : {}),
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          chemist: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      }),
      db.order.count({ where }),
    ]);

    return ok({ orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[GET /api/orders/secondary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch orders", 500);
  }
}

async function createOrder(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { chemistId, distributorId, items } = parsed.data;

    const [chemist, distributor] = await Promise.all([
      db.chemist.findUnique({ where: { id: chemistId } }),
      db.distributor.findUnique({ where: { id: distributorId } }),
    ]);
    if (!chemist) return notFound("Chemist not found");
    if (!distributor) return notFound("Distributor not found");

    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== items.length) {
      return badRequest("One or more products could not be found");
    }
    const priceMap = new Map(products.map((p) => [p.id, Number(p.ptr ?? p.price)]));

    // Auto-apply the best qualifying discount scheme per line (Phase 2 Week 8 spec).
    const now = new Date();
    const schemes = await db.discountScheme.findMany({
      where: { isActive: true, productId: { in: productIds }, validFrom: { lte: now }, validTo: { gte: now } },
    });

    const appliedSchemes: { productId: string; scheme: string; discountPct: number }[] = [];

    const lineItems = items.map((item) => {
      const listPrice = priceMap.get(item.productId)!;
      const candidates = schemes
        .filter((s) => s.productId === item.productId)
        .map((s) => ({
          id: s.id,
          name: s.name,
          minQuantity: s.minQuantity,
          discountPct: s.discountPct,
          isActive: s.isActive,
          validFrom: s.validFrom,
          validTo: s.validTo,
        }));

      const scheme = bestSchemeFor(candidates, item.quantity, now);
      const price = scheme ? round2(listPrice * (1 - scheme.discountPct / 100)) : listPrice;

      if (scheme) {
        appliedSchemes.push({
          productId: item.productId,
          scheme: scheme.name,
          discountPct: scheme.discountPct,
        });
      }

      return { productId: item.productId, quantity: item.quantity, price };
    });

    const order = await db.order.create({
      data: { chemistId, distributorId, items: { create: lineItems } },
      include: { items: true },
    });

    return created({ order, appliedSchemes });
  } catch (err) {
    console.error("[POST /api/orders/secondary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create order", 500);
  }
}

export const GET = withAuth(getOrders, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createOrder, [Role.MR, Role.ASM, Role.ADMIN]);
