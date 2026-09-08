import { db } from "@/lib/db";
import { Role, DmsCategory, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, created } from "@/lib/api-response";
import { saveDmsFile } from "@/lib/upload";

function formatBytes(b: number): string {
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
  return b + " B";
}

async function getDocuments(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "All";
    const status = searchParams.get("status") ?? "All";

    const where: any = {
      status: { not: DmsStatus.Deleted },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category !== "All" && Object.values(DmsCategory).includes(category as DmsCategory)) {
      where.category = category as DmsCategory;
    }

    if (status !== "All" && Object.values(DmsStatus).includes(status as DmsStatus)) {
      where.status = status as DmsStatus;
    }

    const docs = await db.dmsDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const formatted = docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      type: doc.fileType,
      version: doc.currentVersion,
      status: doc.status,
      expiryDate: doc.expiryDate ? doc.expiryDate.toISOString().slice(0, 10) : undefined,
      author: doc.authorName || "System",
      uploadDate: doc.createdAt.toISOString().slice(0, 10),
      size: formatBytes(Number(doc.fileSize)),
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      notes: doc.notes,
    }));

    return ok(formatted);
  } catch (err: any) {
    console.error("[GET /api/dms]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch documents", 500);
  }
}

async function createDocument(req: AuthedRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const category = (formData.get("category") as string) || "SOP";
    const version = (formData.get("version") as string) || "1.0";
    const status = (formData.get("status") as string) || "Active";
    const expiryDateStr = formData.get("expiryDate") as string | null;
    const description = formData.get("description") as string | null;

    if (!title || !file) {
      return badRequest("Title and document file are required");
    }

    const uploadRes = await saveDmsFile(file);
    if (!uploadRes.ok) {
      return badRequest(uploadRes.error.message);
    }

    const count = await db.dmsDocument.count();
    const docId = `DOC-${String(count + 1).padStart(5, "0")}`;

    const validCategory = Object.values(DmsCategory).includes(category as DmsCategory)
      ? (category as DmsCategory)
      : DmsCategory.SOP;

    const validStatus = Object.values(DmsStatus).includes(status as DmsStatus)
      ? (status as DmsStatus)
      : DmsStatus.Active;

    const authorName = req.user.sub ? `User #${req.user.sub.slice(0, 8)}` : "System";
    const authorId = req.user.sub || null;

    const createdDoc = await db.$transaction(async (tx) => {
      const doc = await tx.dmsDocument.create({
        data: {
          id: docId,
          title,
          category: validCategory,
          fileType: uploadRes.result.fileType,
          currentVersion: version,
          status: validStatus,
          expiryDate: expiryDateStr ? new Date(expiryDateStr) : null,
          authorId,
          authorName,
          fileUrl: uploadRes.result.relativePath,
          fileName: uploadRes.result.fileName,
          fileSize: BigInt(uploadRes.result.fileSize),
          notes: description || null,
        },
      });

      await tx.dmsVersion.create({
        data: {
          documentId: docId,
          versionLabel: version,
          fileUrl: uploadRes.result.relativePath,
          fileSizeBytes: BigInt(uploadRes.result.fileSize),
          changeLog: "Initial document upload",
          uploadedBy: authorId,
          uploadedName: authorName,
        },
      });

      await tx.dmsAuditTrail.create({
        data: {
          documentId: docId,
          action: "Created",
          userId: authorId,
          userName: authorName,
          details: `Document "${title}" created and file uploaded (${uploadRes.result.fileName})`,
        },
      });

      return doc;
    });

    return created({
      ...createdDoc,
      fileSize: Number(createdDoc.fileSize),
    });
  } catch (err: any) {
    console.error("[POST /api/dms]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to create document", 500);
  }
}

export const GET = withAuth(getDocuments, [Role.ADMIN]);
export const POST = withAuth(createDocument, [Role.ADMIN]);

