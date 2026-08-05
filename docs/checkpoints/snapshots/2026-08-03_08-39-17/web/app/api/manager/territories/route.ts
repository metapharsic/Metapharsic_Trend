import { NextRequest } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { z } from "zod";

const db = new PrismaClient();

const AssignTerritorySchema = z.object({
  territoryId: z.string().uuid(),
  employeeId: z.string().uuid().nullable(),
});

async function getTerritories(req: AuthedRequest) {
  try {
    const territories = await db.territory.findMany({
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { role: true } },
          },
        },
        doctors: { select: { id: true, fullName: true } },
        chemists: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Also fetch all employees to allow re-assignment in the UI
    const employees = await db.employee.findMany({
      include: {
        user: { select: { role: true } },
      },
    });

    return ok({ territories, employees });
  } catch (err) {
    console.error("[GET /api/manager/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch territories", 500);
  }
}

async function assignTerritory(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = AssignTerritorySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { territoryId, employeeId } = parsed.data;

    const updated = await db.territory.update({
      where: { id: territoryId },
      data: {
        employeeId: employeeId,
      },
      include: {
        employee: true,
      },
    });

    return ok({ territory: updated, success: true });
  } catch (err) {
    console.error("[POST /api/manager/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to assign territory", 500);
  }
}

export const GET = withAuth(getTerritories, [Role.ASM, Role.ADMIN]);
export const POST = withAuth(assignTerritory, [Role.ASM, Role.ADMIN]);
export const PUT = withAuth(assignTerritory, [Role.ASM, Role.ADMIN]);
