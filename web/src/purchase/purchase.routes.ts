import { Role, TenderStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, conflict, apiError } from "@/lib/api-response";
import {
  CreatePurchaseOrderSchema,
  InwardStockReceiptSchema,
  CreateHospitalTenderSchema,
  UpdateTenderStatusSchema,
  CreateHospitalFormularySchema,
  CreateDiscountSchemeSchema,
  PurchaseQuerySchema,
} from "./purchase.schema";
import { PurchaseService } from "./purchase.service";

/**
 * POST /api/purchase/inward
 */
export async function inwardStockHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = InwardStockReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await PurchaseService.processInwardStock(parsed.data, employee?.id);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/purchase/inward]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to process inward stock", 400);
  }
}

/**
 * POST /api/purchase/orders
 */
export async function createPurchaseOrderHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await PurchaseService.processPurchaseOrder(parsed.data, employee?.id);
    return created(result);
  } catch (err: any) {
    console.error("[POST /api/purchase/orders]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to process purchase order", 400);
  }
}

/**
 * GET /api/purchase/tenders
 */
export async function listTendersHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = PurchaseQuerySchema.safeParse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      hospitalId: searchParams.get("hospitalId") ?? undefined,
      productId: searchParams.get("productId") ?? undefined,
      status: (searchParams.get("status") as TenderStatus) ?? undefined,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const result = await PurchaseService.listTenders(parsed.data);
    return ok(result);
  } catch (err) {
    console.error("[GET /api/purchase/tenders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch tenders", 500);
  }
}

/**
 * POST /api/purchase/tenders
 */
export async function createTenderHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateHospitalTenderSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const tender = await PurchaseService.createHospitalTender(parsed.data);
    return created({ tender });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return conflict("A tender with this tender number already exists");
    }
    console.error("[POST /api/purchase/tenders]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to create tender", 400);
  }
}

/**
 * PATCH /api/purchase/tenders/[id]/status
 */
export async function updateTenderStatusHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateTenderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const tender = await PurchaseService.updateTenderStatus(id, parsed.data);
    if (!tender) return notFound("Tender not found");

    return ok({ tender });
  } catch (err) {
    console.error("[PATCH /api/purchase/tenders/[id]/status]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update tender status", 500);
  }
}

/**
 * POST /api/purchase/formulary
 */
export async function setFormularyHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateHospitalFormularySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const formulary = await PurchaseService.setHospitalFormulary(parsed.data);
    return ok({ formulary });
  } catch (err) {
    console.error("[POST /api/purchase/formulary]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to set formulary", 500);
  }
}

/**
 * POST /api/purchase/schemes
 */
export async function createSchemeHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateDiscountSchemeSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const scheme = await PurchaseService.createDiscountScheme(parsed.data);
    return created({ scheme });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return conflict("A scheme with this name already exists");
    }
    console.error("[POST /api/purchase/schemes]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to create scheme", 400);
  }
}

// Protected Route Exports
export const inwardStockRoute = withAuth(inwardStockHandler, [
  Role.ADMIN,
  Role.MD,
  Role.WAREHOUSE,
]);
export const createPurchaseOrderRoute = withAuth(createPurchaseOrderHandler, [
  Role.ADMIN,
  Role.MD,
  Role.WAREHOUSE,
]);
export const listTendersRoute = withAuth(listTendersHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.MR,
]);
export const createTenderRoute = withAuth(createTenderHandler, [Role.ADMIN, Role.MD, Role.ASM]);
export const updateTenderStatusRoute = withAuth(updateTenderStatusHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
]);
export const setFormularyRoute = withAuth(setFormularyHandler, [Role.ADMIN, Role.MD, Role.ASM]);
export const createSchemeRoute = withAuth(createSchemeHandler, [Role.ADMIN, Role.MD, Role.MARKETING]);
