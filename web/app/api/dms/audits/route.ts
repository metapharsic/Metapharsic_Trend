import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getDmsAudits(_req: AuthedRequest) {
  try {
    const audits = await db.dmsAuditTrail.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = audits.map((a) => ({
      id: a.id,
      documentId: a.documentId,
      action: a.action,
      userId: a.userId || "System",
      userName: a.userName || "System",
      timestamp: a.createdAt.toISOString(),
      ipAddress: a.ipAddress || "127.0.0.1",
      details: a.details || "",
    }));

    return ok(formatted);
  } catch (err: any) {
    console.error("[GET /api/dms/audits]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch audit trails", 500);
  }
}

export const GET = withAuth(getDmsAudits, [Role.ADMIN]);
