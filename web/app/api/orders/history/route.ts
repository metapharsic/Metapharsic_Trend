import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, unauthorized } from "@/lib/api-response";

async function getLedgerHistory(req: AuthedRequest) {
  try {
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN || req.user.role === Role.MD;
    let employeeId: string | undefined;

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      employeeId = employee.id;
    }

    // Fetch Orders, Invoices, and Collections in parallel
    const [orders, invoices, collections] = await Promise.all([
      db.order.findMany({
        where: employeeId ? { employeeId } : {},
        include: {
          chemist: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.invoice.findMany({
        where: employeeId ? { order: { employeeId } } : {},
        include: { order: { include: { chemist: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      db.collection.findMany({
        where: employeeId ? { employeeId } : {},
        include: { chemist: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Format into unified ledger transactions
    const transactions: any[] = [];

    orders.forEach((o) => {
      const orderValue = o.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
      transactions.push({
        id: `ord-${o.id}`,
        type: "ORDER",
        date: o.createdAt.toISOString(),
        referenceNo: o.id.slice(0, 8).toUpperCase(),
        partyName: o.chemist?.name || "Unknown Chemist",
        amount: orderValue,
        status: o.status,
        description: `Order Placed (${o.status})`,
      });
    });

    invoices.forEach((inv) => {
      transactions.push({
        id: `inv-${inv.id}`,
        orderId: inv.orderId,
        type: "INVOICE",
        date: inv.createdAt.toISOString(),
        referenceNo: inv.invoiceNo,
        partyName: inv.order?.chemist?.name || "Unknown Chemist",
        amount: Number(inv.amount),
        status: inv.paid ? "PAID" : "UNPAID",
        description: `Invoice Generated (${inv.paid ? "Paid" : "Unpaid"})`,
      });
    });

    collections.forEach((col) => {
      transactions.push({
        id: `col-${col.id}`,
        type: "COLLECTION",
        date: col.createdAt.toISOString(),
        referenceNo: col.refNumber || "RECEIPT",
        partyName: col.chemist?.name || "Unknown Chemist",
        amount: Number(col.amount),
        status: "RECEIVED",
        description: "Payment Collected / Banked",
      });
    });

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return ok({ transactions });
  } catch (err) {
    console.error("[GET /api/orders/history]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch transaction history", 500);
  }
}

export const GET = withAuth(getLedgerHistory, [Role.MR, Role.ASM, Role.ADMIN, Role.MD]);
