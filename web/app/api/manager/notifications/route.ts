import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError, badRequest } from "@/lib/api-response";
import { z } from "zod";

async function getHandler(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const notifications = await db.notification.findMany({
      where: unreadOnly ? { read: false } : undefined,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return ok({
      notifications: notifications.map((n) => ({
        id: n.id,
        code: n.code,
        severity: n.severity,
        message: n.message,
        action: n.action,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        employee: { id: n.employee.id, name: `${n.employee.firstName} ${n.employee.lastName}` },
      })),
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (err) {
    console.error("[GET /api/manager/notifications]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch notifications", 500);
  }
}

const MarkReadSchema = z.object({ id: z.string().uuid() });

async function patchHandler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = MarkReadSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    await db.notification.update({ where: { id: parsed.data.id }, data: { read: true } });
    return ok({ success: true });
  } catch (err) {
    console.error("[PATCH /api/manager/notifications]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update notification", 500);
  }
}

export const GET = withAuth(getHandler, [Role.ASM, Role.ADMIN]);
export const PATCH = withAuth(patchHandler, [Role.ASM, Role.ADMIN]);
