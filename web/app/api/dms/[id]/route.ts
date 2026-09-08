import { db } from "@/lib/db";
import { Role, DmsCategory, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, badRequest, apiError } from "@/lib/api-response";

type Context = { params: Record<string, string | string[] | undefined> };

async function getDocumentDetails(req: AuthedRequest, context: Context) {
  try {
    const id = context.params.id as string;
    if (!id) return badRequest("Document ID is required");

    const document = await db.dmsDocument.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        workflows: { orderBy: { createdAt: "desc" }, take: 1 },
        auditTrails: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!document || document.status === DmsStatus.Deleted) {
      return notFound("Document not found");
    }

    const formattedVersions = document.versions.map((v) => ({
      ...v,
      id: String(v.id),
      fileSizeBytes: Number(v.fileSizeBytes || BigInt(0)),
    }));

    return ok({
      ...document,
      fileSize: Number(document.fileSize),
      versions: formattedVersions,
      workflow: document.workflows[0] || null,
      audits: document.auditTrails,
    });
  } catch (err: any) {
    console.error("[GET /api/dms/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch document details", 500);
  }
}

async function updateDocument(req: AuthedRequest, context: Context) {
  try {
    const id = context.params.id as string;
    if (!id) return badRequest("Document ID is required");

    const body = await req.json();
    const { title, category, type, version, status, expiryDate, notes } = body;

    const existing = await db.dmsDocument.findUnique({ where: { id } });
    if (!existing || existing.status === DmsStatus.Deleted) {
      return notFound("Document not found");
    }

    const validCategory = category && Object.values(DmsCategory).includes(category as DmsCategory)
      ? (category as DmsCategory)
      : undefined;

    const validStatus = status && Object.values(DmsStatus).includes(status as DmsStatus)
      ? (status as DmsStatus)
      : undefined;

    const authorName = req.user.sub ? `User #${req.user.sub.slice(0, 8)}` : "System";
    const authorId = req.user.sub || null;

    const updated = await db.$transaction(async (tx) => {
      const doc = await tx.dmsDocument.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(validCategory ? { category: validCategory } : {}),
          ...(type ? { fileType: type } : {}),
          ...(version ? { currentVersion: version } : {}),
          ...(validStatus ? { status: validStatus } : {}),
          ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      await tx.dmsAuditTrail.create({
        data: {
          documentId: id,
          action: "Modified",
          userId: authorId,
          userName: authorName,
          details: `Document "${doc.title}" updated`,
        },
      });

      return doc;
    });

    return ok({
      ...updated,
      fileSize: Number(updated.fileSize),
    });
  } catch (err: any) {
    console.error("[PUT /api/dms/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to update document", 500);
  }
}

async function deleteDocument(req: AuthedRequest, context: Context) {
  try {
    const id = context.params.id as string;
    if (!id) return badRequest("Document ID is required");

    const existing = await db.dmsDocument.findUnique({ where: { id } });
    if (!existing || existing.status === DmsStatus.Deleted) {
      return notFound("Document not found");
    }

    const authorName = req.user.sub ? `User #${req.user.sub.slice(0, 8)}` : "System";
    const authorId = req.user.sub || null;

    await db.$transaction(async (tx) => {
      await tx.dmsDocument.update({
        where: { id },
        data: { status: DmsStatus.Deleted },
      });

      await tx.dmsAuditTrail.create({
        data: {
          documentId: id,
          action: "Deleted",
          userId: authorId,
          userName: authorName,
          details: `Document "${existing.title}" soft-deleted`,
        },
      });
    });

    return ok({ success: true, message: "Document deleted", id });
  } catch (err: any) {
    console.error("[DELETE /api/dms/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to delete document", 500);
  }
}

export const GET = withAuth(getDocumentDetails, [Role.ADMIN]);
export const PUT = withAuth(updateDocument, [Role.ADMIN]);
export const DELETE = withAuth(deleteDocument, [Role.ADMIN]);
