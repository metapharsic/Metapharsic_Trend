import { db } from "@/lib/db";
import { Role, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

function formatBytes(b: number): string {
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
  return b + " B";
}

async function getDmsStats(_req: AuthedRequest) {
  try {
    const fifteenDaysFromNow = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [total, active, expiring, expiring15Days, draft, pending, aggregate] = await Promise.all([
      db.dmsDocument.count({ where: { status: { not: DmsStatus.Deleted } } }),
      db.dmsDocument.count({ where: { status: DmsStatus.Active } }),
      db.dmsDocument.count({
        where: {
          status: { not: DmsStatus.Deleted },
          OR: [
            { status: DmsStatus.Expiring },
            { expiryDate: { lte: thirtyDaysFromNow } },
          ],
        },
      }),
      db.dmsDocument.count({
        where: {
          status: { not: DmsStatus.Deleted },
          expiryDate: { lte: fifteenDaysFromNow },
        },
      }),
      db.dmsDocument.count({ where: { status: DmsStatus.Draft } }),
      db.dmsDocument.count({ where: { status: DmsStatus.Pending } }),
      db.dmsDocument.aggregate({
        where: { status: { not: DmsStatus.Deleted } },
        _sum: { fileSize: true },
      }),
    ]);

    const storageBytes = Number(aggregate._sum.fileSize ?? BigInt(0));

    return ok({
      total,
      active,
      expiring,
      expiring15Days,
      draft,
      pending,
      storageBytes,
      storageUsed: formatBytes(storageBytes),
    });
  } catch (err: any) {
    console.error("[GET /api/dms/stats]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch stats", 500);
  }
}

export const GET = withAuth(getDmsStats, [Role.ADMIN]);
