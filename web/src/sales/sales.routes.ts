import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, apiError } from "@/lib/api-response";
import {
  CreateSalesOrderSchema,
  UpdateOrderStatusSchema,
  RecordCollectionSchema,
  GenerateInvoiceSchema,
  SalesOrderQuerySchema,
} from "./sales.schema";
import { SalesService } from "./sales.service";

/**
 * GET /api/sales/orders
 */
export async function getSalesOrdersHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = SalesOrderQuerySchema.safeParse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      status: searchParams.get("status") ?? undefined,
      chemistId: searchParams.get("chemistId") ?? undefined,
      distributorId: searchParams.get("distributorId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.flatten());
    }

    const isManager =
      req.user.role === Role.ASM ||
      req.user.role === Role.ADMIN ||
      req.user.role === Role.MD ||
      req.user.role === Role.NSM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.RM;

    let employeeIdFilter: string | undefined;
    if (!isManager) {
      const employee = await import("@/lib/db").then((m) =>
        m.db.employee.findUnique({ where: { userId: req.user.sub } })
      );
      if (!employee) return unauthorized("Employee record not found");
      employeeIdFilter = employee.id;
    }

    const result = await SalesService.listOrders(parsed.data, employeeIdFilter);
    return ok(result);
  } catch (err) {
    console.error("[GET /api/sales/orders]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch sales orders", 500);
  }
}

/**
 * POST /api/sales/orders
 */
export async function createSalesOrderHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateSalesOrderSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const order = await SalesService.createOrder(parsed.data, employee?.id);
    return created({ order });
  } catch (err: any) {
    console.error("[POST /api/sales/orders]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to create sales order", 400);
  }
}

/**
 * PATCH /api/sales/orders/[id]/status
 */
export async function updateOrderStatusHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );

    const order = await SalesService.updateOrderStatus(id, parsed.data, employee?.id);
    if (!order) return notFound("Order not found");

    return ok({ order });
  } catch (err: any) {
    console.error("[PATCH /api/sales/orders/[id]/status]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to update order status", 400);
  }
}

/**
 * POST /api/sales/invoices/generate
 */
export async function generateInvoiceHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = GenerateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const invoice = await SalesService.generateInvoice(parsed.data);
    return created({ invoice });
  } catch (err: any) {
    console.error("[POST /api/sales/invoices/generate]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to generate invoice", 400);
  }
}

/**
 * GET /api/sales/invoices
 */
export async function getInvoicesHandler(req: AuthedRequest) {
  try {
    const isManager =
      req.user.role === Role.ASM ||
      req.user.role === Role.ADMIN ||
      req.user.role === Role.MD ||
      req.user.role === Role.NSM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.RM;

    let employeeIdFilter: string | undefined;
    if (!isManager) {
      const employee = await import("@/lib/db").then((m) =>
        m.db.employee.findUnique({ where: { userId: req.user.sub } })
      );
      if (!employee) return unauthorized("Employee record not found");
      employeeIdFilter = employee.id;
    }

    const invoices = await SalesService.listInvoices(employeeIdFilter);
    return ok({ invoices });
  } catch (err) {
    console.error("[GET /api/sales/invoices]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch invoices", 500);
  }
}

/**
 * POST /api/sales/collections
 */
export async function recordCollectionHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = RecordCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const employee = await import("@/lib/db").then((m) =>
      m.db.employee.findUnique({ where: { userId: req.user.sub } })
    );
    if (!employee) return unauthorized("Employee record not found");

    const collection = await SalesService.recordCollection(parsed.data, employee.id);
    return created({ collection });
  } catch (err: any) {
    console.error("[POST /api/sales/collections]", err);
    return apiError("BAD_REQUEST", err.message || "Failed to record collection", 400);
  }
}

// Protected Route Exports
export const getSalesOrdersRoute = withAuth(getSalesOrdersHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
]);
export const createSalesOrderRoute = withAuth(createSalesOrderHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
]);
export const updateOrderStatusRoute = withAuth(updateOrderStatusHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const generateInvoiceRoute = withAuth(generateInvoiceHandler, [
  Role.ADMIN,
  Role.MD,
  Role.ASM,
  Role.WAREHOUSE,
]);
export const getInvoicesRoute = withAuth(getInvoicesHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
]);
export const recordCollectionRoute = withAuth(recordCollectionHandler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.MD,
]);
