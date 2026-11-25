import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, unauthorized } from "@/lib/api-response";
import { PaginationSchema } from "@/lib/validators";

async function getLedgerHistory(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hasExplicitPagination =
      searchParams.has("page") || searchParams.has("limit");
    const { page, limit } = PaginationSchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 30,
    });
    const typeFilter = (searchParams.get("type")?.toUpperCase() || "ALL") as
      | "ALL"
      | "ORDER"
      | "INVOICE"
      | "COLLECTION";
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const from = searchParams.get("from")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || undefined;

    const isManager =
      req.user.role === Role.ADMIN ||
      req.user.role === Role.MD ||
      req.user.role === Role.NSM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.RM ||
      req.user.role === Role.ASM ||
      req.user.role === Role.FINANCE ||
      req.user.role === Role.WAREHOUSE ||
      req.user.role === Role.MARKETING ||
      req.user.role === Role.HR;
    let employeeId: string | undefined;

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      employeeId = employee.id;
    }

    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(`${from}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) createdAtFilter.gte = d;
    }
    if (to) {
      const d = new Date(`${to}T23:59:59.999Z`);
      if (!Number.isNaN(d.getTime())) createdAtFilter.lte = d;
    }
    const dateWhere = createdAtFilter.gte || createdAtFilter.lte ? { createdAt: createdAtFilter } : {};

    const fetchOrders = typeFilter === "ALL" || typeFilter === "ORDER";
    const fetchInvoices = typeFilter === "ALL" || typeFilter === "INVOICE";
    const fetchCollections = typeFilter === "ALL" || typeFilter === "COLLECTION";

    const [orders, invoices, collections] = await Promise.all([
      fetchOrders
        ? db.order.findMany({
            where: {
              ...(employeeId ? { employeeId } : {}),
              ...dateWhere,
            },
            include: {
              chemist: { select: { name: true } },
              items: { select: { price: true, quantity: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      fetchInvoices
        ? db.invoice.findMany({
            where: {
              ...(employeeId ? { order: { employeeId } } : {}),
              ...dateWhere,
            },
            include: { order: { include: { chemist: { select: { name: true } } } } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      fetchCollections
        ? db.collection.findMany({
            where: {
              ...(employeeId ? { employeeId } : {}),
              ...dateWhere,
            },
            include: { chemist: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const allTransactions: Array<{
      id: string;
      orderId?: string;
      type: "ORDER" | "INVOICE" | "COLLECTION";
      date: string;
      referenceNo: string;
      partyName: string;
      amount: number;
      status: string;
      description: string;
    }> = [];

    let ordersAmt = 0;
    let invoicedAmt = 0;
    let collectedAmt = 0;

    for (const o of orders) {
      const val = o.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
      ordersAmt += val;
      allTransactions.push({
        id: `ord-${o.id}`,
        orderId: o.id,
        type: "ORDER",
        date: o.createdAt.toISOString(),
        referenceNo: o.id.slice(0, 8).toUpperCase(),
        partyName: o.chemist?.name || "Unknown Chemist",
        amount: val,
        status: o.status,
        description: `Order Placed (${o.status})`,
      });
    }

    for (const inv of invoices) {
      const amt = Number(inv.amount);
      invoicedAmt += amt;
      allTransactions.push({
        id: `inv-${inv.id}`,
        orderId: inv.orderId,
        type: "INVOICE",
        date: inv.createdAt.toISOString(),
        referenceNo: inv.invoiceNo,
        partyName: inv.order?.chemist?.name || "Unknown Chemist",
        amount: amt,
        status: inv.paid ? "PAID" : "UNPAID",
        description: `Invoice Generated (${inv.paid ? "Paid" : "Unpaid"})`,
      });
    }

    for (const col of collections) {
      const amt = Number(col.amount);
      collectedAmt += amt;
      allTransactions.push({
        id: `col-${col.id}`,
        type: "COLLECTION",
        date: col.createdAt.toISOString(),
        referenceNo: col.refNumber || "RECEIPT",
        partyName: col.chemist?.name || "Unknown Chemist",
        amount: amt,
        status: "RECEIVED",
        description: "Payment Collected / Banked",
      });
    }

    const filtered = q
      ? allTransactions.filter(
          (tx) =>
            tx.referenceNo.toLowerCase().includes(q) ||
            tx.partyName.toLowerCase().includes(q) ||
            tx.description.toLowerCase().includes(q)
        )
      : allTransactions;

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedTransactions = hasExplicitPagination
      ? filtered.slice((page - 1) * limit, page * limit)
      : filtered.slice(0, 100);

    return ok({
      transactions: pagedTransactions,
      pagination: { page, limit, total, totalPages },
      totals: {
        ordersAmt: Math.round(ordersAmt * 100) / 100,
        invoicedAmt: Math.round(invoicedAmt * 100) / 100,
        collectedAmt: Math.round(collectedAmt * 100) / 100,
        ordersCount: orders.length,
        invoicesCount: invoices.length,
        collectionsCount: collections.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/orders/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch transaction history", 500);
  }
}

export const GET = withAuth(getLedgerHistory, [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.MR,
  Role.FINANCE,
  Role.WAREHOUSE,
  Role.MARKETING,
  Role.HR,
]);
