import { db } from "@/lib/db";
import { Role, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getDmsVersions(_req: AuthedRequest) {
  try {
    const versions = await db.dmsVersion.findMany({
      where: {
        document: {
          status: { not: DmsStatus.Deleted },
        },
      },
      include: {
        document: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = versions.map((v) => ({
      id: String(v.id),
      documentId: v.documentId,
      title: v.document.title,
      version: v.versionLabel,
      fileUrl: v.fileUrl,
      fileSize: Number(v.fileSizeBytes || BigInt(0)),

      uploadedBy: v.uploadedName || "System",
      uploadDate: v.createdAt.toISOString().slice(0, 10),
      changeLog: v.changeLog || "",
      approvedBy: v.approvedBy || "",
      approvalDate: v.approvalDate ? v.approvalDate.toISOString().slice(0, 10) : "",
      status: "Current",
    }));

    return ok(formatted);
  } catch (err: any) {
    console.error("[GET /api/dms/versions]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch versions", 500);
  }
}

export const GET = withAuth(getDmsVersions, [Role.ADMIN]);
