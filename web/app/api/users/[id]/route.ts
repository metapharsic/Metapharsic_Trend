import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcrypt";

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  managerId: z.string().uuid().nullable().optional(),
  territoryIds: z.array(z.string().uuid()).optional(),
});

async function getUser(req: AuthedRequest, context: { params: Record<string, string | string[] | undefined> }) {
  try {
    const id = context.params.id as string;
    const user = await db.user.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            managerId: true,
            manager: {
              select: {
                firstName: true,
                lastName: true,
                user: { select: { role: true } },
              },
            },
            subordinates: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { role: true } },
              },
            },
            territories: { select: { id: true, name: true, region: true, zone: true } },
          },
        },
      },
    });
    if (!user) return notFound("User not found");
    return ok({ user });
  } catch (err) {
    console.error("[GET /api/users/:id]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch user", 500);
  }
}

async function updateUser(req: AuthedRequest, context: { params: Record<string, string | string[] | undefined> }) {
  try {
    const id = context.params.id as string;

    // Allow users to update their own profile; only ADMIN/HR can update others
    const isSelf = req.user.sub === id;
    if (!isSelf && req.user.role !== Role.ADMIN && req.user.role !== Role.HR) {
      return badRequest("Insufficient permissions");
    }

    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { firstName, lastName, phone, role, isActive, password, managerId, territoryIds } = parsed.data;

    const userUpdates: Record<string, unknown> = {};
    if (role !== undefined && (req.user.role === Role.ADMIN)) userUpdates.role = role;
    if (isActive !== undefined && req.user.role === Role.ADMIN) userUpdates.isActive = isActive;
    if (password) userUpdates.passwordHash = await bcrypt.hash(password, 12);

    // territoryIds is only meaningful for ADMIN — same gate as role/isActive above.
    const canSetTerritories = territoryIds !== undefined && req.user.role === Role.ADMIN;
    const hasEmployeeUpdate = firstName || lastName || phone || managerId !== undefined || canSetTerritories;

    const user = await db.user.update({
      where: { id },
      data: {
        ...userUpdates,
        ...(hasEmployeeUpdate
          ? {
              employee: {
                update: {
                  ...(firstName ? { firstName } : {}),
                  ...(lastName ? { lastName } : {}),
                  ...(phone ? { phone } : {}),
                  ...(managerId !== undefined ? { managerId } : {}),
                  ...(canSetTerritories ? { territories: { set: territoryIds.map((tid) => ({ id: tid })) } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, phone: true, territories: { select: { id: true, name: true } } } },
      },
    });

    return ok({ user });
  } catch (err) {
    console.error("[PUT /api/users/:id]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update user", 500);
  }
}

async function deleteUser(req: AuthedRequest, context: { params: Record<string, string | string[] | undefined> }) {
  try {
    const id = context.params.id as string;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    if (!permanent) {
      await db.user.update({ where: { id }, data: { isActive: false } });
      return ok({ message: "User deactivated" });
    }

    // Permanent delete — ADMIN only (enforced below via export), and only
    // when the linked employee has no real history. Cascading through live
    // visits/orders/leads would silently gut financial and field records,
    // so we block and point the admin at deactivation instead.
    const user = await db.user.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            _count: {
              select: {
                visits: true,
                leads: true,
                orders: true,
                expenses: true,
                attendances: true,
                targets: true,
                collections: true,
                tourPlans: true,
                locationLogs: true,
                claims: true,
                enrollments: true,
                sampleInventories: true,
                leaveRequests: true,
                payrolls: true,
                entityLedgers: true,
                subordinates: true,
              },
            },
          },
        },
      },
    });
    if (!user) return notFound("User not found");

    if (user.employee) {
      const c = user.employee._count;
      const total = Object.values(c).reduce((sum, n) => sum + n, 0);
      if (total > 0) {
        return conflict(
          `Cannot permanently delete — this user has recorded activity (${Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ")}). Deactivate instead, or reassign/clear the linked records first.`
        );
      }
    }

    await db.user.delete({ where: { id } });
    return ok({ message: "User permanently deleted" });
  } catch (err: any) {
    if (err?.code === "P2003" || err?.code === "23503") {
      return conflict("Cannot permanently delete — this user still has linked records elsewhere in the system.");
    }
    console.error("[DELETE /api/users/:id]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete user", 500);
  }
}

const ALL_ROLES = [Role.ADMIN, Role.MR, Role.ASM, Role.MD];

export const GET = withAuth(getUser, ALL_ROLES);
export const PUT = withAuth(updateUser, ALL_ROLES);
export const DELETE = withAuth(deleteUser, [Role.ADMIN]);
