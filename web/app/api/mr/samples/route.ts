import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, apiError } from "@/lib/api-response";

import { Role } from "@prisma/client";

const CANONICAL_MR_SAMPLES: Record<string, number> = {
  "Metace-P": 100,
  "Pantometa-DSR": 100,
  "Metace-SP": 90,
  "Rabemeta-DSR": 90,
  "Metacol-650": 90,
  "Metacef-200": 80,
  "Metamox-CV": 70,
};

async function handler(req: AuthedRequest) {
  try {
    const isManager =
      req.user.role === Role.ADMIN ||
      req.user.role === Role.ASM ||
      req.user.role === Role.RM ||
      req.user.role === Role.ZSM ||
      req.user.role === Role.NSM ||
      req.user.role === Role.MD;

    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });

    // For managers/admins testing or logging calls without dedicated MR stock, serve canonical catalog
    if (isManager && (!employee || req.user.role === Role.ADMIN)) {
      const allProducts = await db.product.findMany({
        select: { id: true, name: true, ptr: true, mrp: true, price: true },
        orderBy: { name: "asc" },
      });

      const withValue = allProducts.map((p) => {
        const unitValue = Number(p.ptr ?? 0);
        const qty = CANONICAL_MR_SAMPLES[p.name] ?? 50;
        return {
          productId: p.id,
          productName: p.name,
          quantity: qty,
          unitValue,
          estimatedValue: unitValue * qty,
          lastGivenAt: new Date(),
        };
      });

      return ok({
        samples: withValue,
        totalEstimatedValue: withValue.reduce((sum, s) => sum + s.estimatedValue, 0),
      });
    }

    if (!employee) return unauthorized("Employee record not found");

    let samples = await db.sampleInventory.findMany({
      where: { employeeId: employee.id, quantity: { gt: 0 } },
      include: { product: { select: { id: true, name: true, ptr: true, mrp: true, price: true } } },
      orderBy: { product: { name: "asc" } },
    });

    // If MR has no sample inventory, auto-provision canonical stock to match Abdul Malik
    if (samples.length === 0) {
      const allProducts = await db.product.findMany({
        select: { id: true, name: true, ptr: true, mrp: true, price: true },
      });

      for (const prod of allProducts) {
        const qty = CANONICAL_MR_SAMPLES[prod.name] ?? 50;
        await db.sampleInventory.upsert({
          where: {
            employeeId_productId: {
              employeeId: employee.id,
              productId: prod.id,
            },
          },
          update: { quantity: qty, allocatedQty: qty },
          create: {
            employeeId: employee.id,
            productId: prod.id,
            quantity: qty,
            allocatedQty: qty,
          },
        });
      }

      samples = await db.sampleInventory.findMany({
        where: { employeeId: employee.id, quantity: { gt: 0 } },
        include: { product: { select: { id: true, name: true, ptr: true, mrp: true, price: true } } },
        orderBy: { product: { name: "asc" } },
      });
    }

    const withValue = samples.map((s) => {
      const unitValue = Number(s.product.ptr ?? s.product.price ?? 0);
      return {
        productId: s.productId,
        productName: s.product.name,
        quantity: s.quantity,
        unitValue,
        estimatedValue: unitValue * s.quantity,
        lastGivenAt: s.updatedAt,
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

export const GET = withAuth(handler, [
  Role.MR,
  Role.ASM,
  Role.ADMIN,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
]);
