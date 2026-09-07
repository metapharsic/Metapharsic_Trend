import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { z } from "zod";
import { costBasis, type CostBasisSource } from "@/lib/pricing";
import { ProductPricingAgentsService } from "@/services/product-pricing-agents.service";


const emptyToNull = (val: unknown) => (val === "" || val === null || val === undefined ? null : val);

const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.coerce.number().min(0),
  composition: z.preprocess(emptyToNull, z.string().nullable().optional()),
  strength: z.preprocess(emptyToNull, z.string().nullable().optional()),
  packSize: z.preprocess(emptyToNull, z.string().nullable().optional()),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  purchaseRate: z.coerce.number().min(0).optional(),
  marginStructure: z.preprocess(emptyToNull, z.string().nullable().optional()),
  therapySegment: z.preprocess(emptyToNull, z.string().nullable().optional()),
  hsnCode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  manufacturer: z.preprocess(emptyToNull, z.string().nullable().optional()),
  gstPct: z.coerce.number().min(0).max(100).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).optional().default(0),
  currentBatchNo: z.preprocess(emptyToNull, z.string().nullable().optional()),
  currentMfgDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  currentExpDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
});

async function getProducts(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const therapySegment = searchParams.get("therapySegment") ?? undefined;
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(therapySegment ? { therapySegment } : {}),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      db.product.count({ where }),
    ]);

    // Forecast: burn rate from the last 30 days of actual order deductions,
    // projected forward against current stock. Also surface each product's
    // most recent stock movement so "leftover quantity" has a visible
    // as-of timestamp instead of looking like a static number.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const productIds = products.map((p) => p.id);
    const [recentDeductions, lastMovements] = await Promise.all([
      db.inventoryMovement.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, type: "ORDER_DEDUCTION", createdAt: { gte: thirtyDaysAgo } },
        _sum: { delta: true },
      }),
      db.inventoryMovement.findMany({
        where: { productId: { in: productIds } },
        orderBy: { createdAt: "desc" },
        distinct: ["productId"],
        select: { productId: true, createdAt: true },
      }),
    ]);
    const burnByProduct = new Map(recentDeductions.map((r) => [r.productId, Math.abs(r._sum.delta ?? 0) / 30]));
    const lastMovementByProduct = new Map(lastMovements.map((m) => [m.productId, m.createdAt]));

    const enriched = products.map((p) => {
      const rate = burnByProduct.get(p.id) ?? 0;
      const unitValue = Number(p.ptr ?? p.price);
      const marginSettings = ProductPricingAgentsService.parseMarginStructure(p.marginStructure);
      const pts = Number(p.pts ?? p.ptr ?? p.price);
      const dbPurchaseRate = (p as any).purchaseRate != null ? Number((p as any).purchaseRate) : null;
      // companyMarginPct is a MARKUP ON COST: pts = cost * (1 + m/100).
      // Reversing it is a DIVISION, not a subtraction - the old
      // `pts * (1 - m/100)` understated cost badly (140 read as 84, not 100).
      const companyMarkupPct = marginSettings?.companyMarginPct ?? ProductPricingAgentsService.DEFAULT_COMPANY_MARGIN_PCT;
      const derivedFromPts = Math.round((pts / Math.max(0.01, 1 + companyMarkupPct / 100)) * 100) / 100;
      const purchaseRate =
        dbPurchaseRate != null && dbPurchaseRate > 0
          ? dbPurchaseRate
          : marginSettings?.purchaseRate || derivedFromPts;
      // Whether the number above is a real paid cost or a derivation, so the
      // UI can label an estimate instead of presenting a guess as fact.
      const costBasisExact = dbPurchaseRate != null && dbPurchaseRate > 0;
      const costBasisSource: CostBasisSource = costBasisExact ? "purchaseRate" : costBasis(p).source;
      const grossMarginPct = unitValue > 0 ? Math.round(((unitValue - purchaseRate) / unitValue) * 1000) / 10 : 0;

      const full = {
        ...p,
        purchaseRate,
        marginSettings,
        grossMarginPct,
        costBasisExact,
        costBasisSource,
        stockValue: Math.round(p.stockQty * unitValue * 100) / 100,
        stockValueAtCost: Math.round(p.stockQty * purchaseRate * 100) / 100,
        lastMovementAt: lastMovementByProduct.get(p.id) ?? p.updatedAt,
        forecast: {
          burnRatePerDay: Math.round(rate * 100) / 100,
          daysRemaining: rate > 0 ? Math.floor(p.stockQty / rate) : null,
        },
      };

      // Purchase rate, margins, stock value/level, movement history, forecast and
      // batch/audit data are commercially confidential -- ADMIN only. Stripped here
      // (not just hidden in the UI) so it never reaches a non-admin browser's network
      // tab in the first place.
      if (req.user.role !== Role.ADMIN) {
        const {
          purchaseRate: _purchaseRate,
          marginSettings: _marginSettings,
          grossMarginPct: _grossMarginPct,
          costBasisExact: _costBasisExact,
          costBasisSource: _costBasisSource,
          stockValue: _stockValue,
          stockValueAtCost: _stockValueAtCost,
          lastMovementAt: _lastMovementAt,
          forecast: _forecast,
          currentBatchNo: _currentBatchNo,
          currentMfgDate: _currentMfgDate,
          currentExpDate: _currentExpDate,
          ...restricted
        } = full;
        return restricted;
      }

      return full;
    });

    return ok({
      products: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch products", 500);
  }
}

async function createProduct(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });

    const product = await db.$transaction(async (tx) => {
      const createdRecord = await tx.product.create({ data: parsed.data });

      if (parsed.data.stockQty && parsed.data.stockQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: createdRecord.id,
            type: "RESTOCK",
            delta: parsed.data.stockQty,
            quantityAfter: parsed.data.stockQty,
            employeeId: employee?.id ?? null,
            note: "Initial stock intake",
          },
        });
      }

      return createdRecord;
    });

    return created({ product });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("Product with this name or SKU already exists");
    console.error("[POST /api/products]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create product", 500);
  }
}

export const GET = withAuth(getProducts, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.WAREHOUSE,
  Role.FINANCE,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.DISTRIBUTOR,
]);
export const POST = withAuth(createProduct, [Role.ADMIN, Role.MD, Role.ASM, Role.WAREHOUSE]);
