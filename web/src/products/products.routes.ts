import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, conflict, apiError } from "@/lib/api-response";
import { CreateProductSchema, UpdateProductSchema, ProductQuerySchema } from "./products.schema";
import { ProductsService } from "./products.service";

/**
 * GET /api/products
 */
export async function getProductsHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = ProductQuerySchema.safeParse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      search: searchParams.get("search") ?? undefined,
      therapySegment: searchParams.get("therapySegment") ?? undefined,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const result = await ProductsService.listProducts(parsed.data);
    return ok(result);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch products", 500);
  }
}

/**
 * POST /api/products
 */
export async function createProductHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const product = await ProductsService.createProduct(parsed.data, employee?.id);
    return created({ product });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return conflict("A product with this SKU or name already exists");
    }
    console.error("[POST /api/products]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create product", 500);
  }
}

/**
 * GET /api/products/[id]
 */
export async function getProductByIdHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const product = await ProductsService.getProductById(id);
    if (!product) return notFound("Product not found");
    return ok({ product });
  } catch (err) {
    console.error("[GET /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch product", 500);
  }
}

/**
 * PUT /api/products/[id]
 */
export async function updateProductHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const product = await ProductsService.updateProduct(id, parsed.data, req.user.sub);
    if (!product) return notFound("Product not found");

    return ok({ product });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return badRequest("A product with this name already exists");
    }
    console.error("[PUT /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update product", 500);
  }
}

/**
 * DELETE /api/products/[id]
 */
export async function deleteProductHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const success = await ProductsService.deleteProduct(id);
    if (!success) return notFound("Product not found");

    return ok({ message: "Product and associated records deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/products/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete product", 500);
  }
}

/**
 * GET /api/products/[id]/movements
 */
export async function getProductMovementsHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const result = await ProductsService.getProductMovements(id);
    if (!result) return notFound("Product not found");

    return ok(result);
  } catch (err) {
    console.error("[GET /api/products/[id]/movements]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch movement history", 500);
  }
}

// Protected Route Exports with RBAC
export const getProductsRoute = withAuth(getProductsHandler);
export const createProductRoute = withAuth(createProductHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const getProductByIdRoute = withAuth(getProductByIdHandler);
export const updateProductRoute = withAuth(updateProductHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const deleteProductRoute = withAuth(deleteProductHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const getProductMovementsRoute = withAuth(getProductMovementsHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.WAREHOUSE,
]);
