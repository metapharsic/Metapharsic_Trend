import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateCollectionSchema } from "@/lib/validators";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";

async function updateCollection(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const collection = await db.collection.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!collection) return notFound("Collection not found");
    if (collection.employee.userId !== req.user.sub) return forbidden();

    const body = await req.json();
    const parsed = UpdateCollectionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.collection.update({
      where: { id },
      data: parsed.data,
      include: { chemist: { select: { id: true, name: true } } },
    });
    return ok({ collection: updated });
  } catch (err) {
    console.error("[PUT /api/mr/collections/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update collection", 500);
  }
}

async function deleteCollection(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const collection = await db.collection.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!collection) return notFound("Collection not found");
    if (collection.employee.userId !== req.user.sub) return forbidden();

    await db.collection.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/mr/collections/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete collection", 500);
  }
}

export const PUT = withAuth(updateCollection, [Role.MR]);
export const DELETE = withAuth(deleteCollection, [Role.MR]);
