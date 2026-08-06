import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";

async function handler(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const samples = await db.sampleInventory.findMany({
      where: { employeeId: employee.id, quantity: { gt: 0 } },
      include: { product: { select: { id: true, name: true, ptr: true, mrp: true, price: true } } },
      orderBy: { product: { name: "asc" } },
    });

    const withValue = samples.map((s) => {
      const unitValue = Number(s.product.ptr ?? s.product.price ?? 0);
      return {
        productId: s.productId,
        productName: s.product.name,
        quantity: s.quantity,
        unitValue,
        estimatedValue: unitValue * s.quantity,
      };
    });

    return ok({
      samples: withValue,
      totalEstimatedValue: withValue.reduce((sum, s) => sum + s.estimatedValue, 0),
    });
  } catch (err) {
    console.error("[GET /api/mr/samples]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch sample inventory", 500);
  }
}

export const GET = withAuth(handler, "MR");
