import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

const db = new PrismaClient();

async function getVisualAids(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") ?? undefined;

    const visualAids = await db.visualAid.findMany({
      where: { ...(productId ? { productId } : {}) },
      include: { product: { select: { id: true, name: true, sku: true, therapySegment: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok({ visualAids });
  } catch (err) {
    console.error("[GET /api/products/visual-aids]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visual aids", 500);
  }
}

export const GET = withAuth(getVisualAids, [Role.MR, Role.ASM, Role.ADMIN]);
