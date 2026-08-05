import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";
import { z } from "zod";

const db = new PrismaClient();

const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.coerce.number().min(0),
  composition: z.string().optional(),
  strength: z.string().optional(),
  packSize: z.string().optional(),
  mrp: z.coerce.number().min(0).optional(),
  ptr: z.coerce.number().min(0).optional(),
  pts: z.coerce.number().min(0).optional(),
  marginStructure: z.string().optional(),
  therapySegment: z.string().optional(),
  stockQty: z.coerce.number().int().min(0).optional().default(0),
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

    return ok({
      products,
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

    const product = await db.product.create({ data: parsed.data });
    return created({ product });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("Product with this name or SKU already exists");
    console.error("[POST /api/products]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create product", 500);
  }
}

export const GET = withAuth(getProducts, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createProduct, [Role.ASM, Role.ADMIN]);
