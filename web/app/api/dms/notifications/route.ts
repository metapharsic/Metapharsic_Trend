import { db } from "@/lib/db";
import { Role, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getExpiringNotifications(_req: AuthedRequest) {
  try {
    const now = new Date();
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const expiringDocs = await db.dmsDocument.findMany({
      where: {
        status: { not: DmsStatus.Deleted },
        expiryDate: {
          gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // include recently expired / expiring
          lte: fifteenDaysFromNow,
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    const notifications = expiringDocs.map((doc) => {
      const exp = doc.expiryDate ? new Date(doc.expiryDate) : now;
      const diffMs = exp.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isExpired = daysRemaining <= 0;

      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        currentVersion: doc.currentVersion,
        expiryDate: exp.toISOString().slice(0, 10),
        daysRemaining,
        isExpired,
        isUrgent: daysRemaining <= 7,
        fileUrl: doc.fileUrl,
        authorName: doc.authorName || "Compliance Desk",
      };
    });

    return ok({
      count: notifications.length,
      urgentCount: notifications.filter((n) => n.isUrgent).length,
      notifications,
    });
  } catch (err: any) {
    console.error("[GET /api/dms/notifications]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch notifications", 500);
  }
}

export const GET = withAuth(getExpiringNotifications, Object.values(Role));
