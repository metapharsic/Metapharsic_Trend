import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") ?? undefined;

    const inventory = await db.sampleInventory.findMany({
      where: { quantity: { gt: 0 }, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true, ptr: true, mrp: true, price: true } },
      },
      orderBy: [{ employee: { firstName: "asc" } }, { product: { name: "asc" } }],
    });

    const byEmployee = new Map<
      string,
      { employeeId: string; employeeName: string; items: { productId: string; productName: string; quantity: number; unitValue: number; estimatedValue: number }[]; totalEstimatedValue: number }
    >();

    for (const row of inventory) {
      const unitValue = Number(row.product.ptr ?? row.product.price ?? 0);
      const estimatedValue = unitValue * row.quantity;
      const key = row.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: row.employeeId,
          employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
          items: [],
          totalEstimatedValue: 0,
        });
      }
      const bucket = byEmployee.get(key)!;
      bucket.items.push({
        productId: row.productId,
        productName: row.product.name,
        quantity: row.quantity,
        unitValue,
        estimatedValue,
      });
      bucket.totalEstimatedValue += estimatedValue;
    }

    const reps = Array.from(byEmployee.values());

    return ok({
      reps,
      grandTotalEstimatedValue: reps.reduce((sum, r) => sum + r.totalEstimatedValue, 0),
    });
  } catch (err) {
    console.error("[GET /api/manager/mr-stock]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch MR stock", 500);
  }
}

export const GET = withAuth(handler, [Role.ASM, Role.ADMIN]);
