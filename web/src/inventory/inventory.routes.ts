import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import {
  StockAdjustmentSchema,
  RestockSchema,
  SampleAllocationSchema,
  BatchSampleAllocationSchema,
  InventoryMovementQuerySchema,
} from "./inventory.schema";
import { InventoryService } from "./inventory.service";

/**
 * POST /api/inventory/adjust
 */
export async function adjustStockHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = StockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await InventoryService.adjustStock(parsed.data, employee?.id);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/inventory/adjust]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to adjust stock", 400);
  }
}

/**
 * POST /api/inventory/restock
 */
export async function restockHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = RestockSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await InventoryService.restock(parsed.data, employee?.id);
    return ok(result);
  } catch (err: any) {
    console.error("[POST /api/inventory/restock]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to restock product", 400);
  }
}

/**
 * POST /api/inventory/samples/allocate
 */
export async function allocateSampleHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = SampleAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const allocator = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await InventoryService.allocateSampleToMr(parsed.data, allocator?.id);
    return created(result);
  } catch (err: any) {
    console.error("[POST /api/inventory/samples/allocate]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to allocate samples", 400);
  }
}

/**
 * POST /api/inventory/samples/batch-allocate
 */
export async function batchAllocateSamplesHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = BatchSampleAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const allocator = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const result = await InventoryService.batchAllocateSamples(parsed.data, allocator?.id);
    return created({ allocations: result });
  } catch (err: any) {
    console.error("[POST /api/inventory/samples/batch-allocate]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to batch allocate samples", 400);
  }
}

/**
 * GET /api/inventory/samples/my
 */
export async function getMySampleInventoryHandler(req: AuthedRequest) {
  try {
    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );
    if (!employee) return unauthorized("Employee record not found");

    const result = await InventoryService.getMrSamples(employee.id);
    return ok(result);
  } catch (err) {
    console.error("[GET /api/inventory/samples/my]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch sample inventory", 500);
  }
}

/**
 * GET /api/inventory/movements
 */
export async function listInventoryMovementsHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = InventoryMovementQuerySchema.safeParse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      productId: searchParams.get("productId") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const result = await InventoryService.listMovements(parsed.data);
    return ok(result);
  } catch (err) {
    console.error("[GET /api/inventory/movements]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch movements", 500);
  }
}

/**
 * GET /api/inventory/warehouse-dashboard
 */
export async function getWarehouseDashboardHandler(_req: AuthedRequest) {
  try {
    const result = await InventoryService.getWarehouseDashboard();
    return ok(result);
  } catch (err) {
    console.error("[GET /api/inventory/warehouse-dashboard]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch warehouse dashboard", 500);
  }
}

// Protected Route Exports
export const adjustStockRoute = withAuth(adjustStockHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const restockRoute = withAuth(restockHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const allocateSampleRoute = withAuth(allocateSampleHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const batchAllocateSamplesRoute = withAuth(batchAllocateSamplesHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const getMySampleInventoryRoute = withAuth(getMySampleInventoryHandler, Role.MR);
export const listInventoryMovementsRoute = withAuth(listInventoryMovementsHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.WAREHOUSE,
]);
export const getWarehouseDashboardRoute = withAuth(getWarehouseDashboardHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
