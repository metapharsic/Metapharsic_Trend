import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError, created } from "@/lib/api-response";
import { z } from "zod";

const AssignTerritorySchema = z.object({
  territoryId: z.string().uuid(),
  employeeId: z.string().uuid().nullable(),
});

const CreateTerritorySchema = z.object({
  name: z.string().min(1, "Territory name is required"),
  region: z.string().min(1, "Region name is required"),
  zone: z.string().min(1, "Zone name is required"),
  employeeId: z.string().uuid().nullable().optional(),
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
            managerId: true,
            user: { select: { role: true } },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                managerId: true,
                user: { select: { role: true } },
                manager: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    managerId: true,
                    user: { select: { role: true } },
                    manager: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        user: { select: { role: true } },
                      }
                    }
                  }
                }
              }
            }
          },
        },
        doctors: { select: { id: true, fullName: true } },
        chemists: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Fetch all field employees (MR, ASM, RM, ZSM) to populate assignment lists
    const employees = await db.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { role: true } },
      },
      orderBy: { firstName: "asc" },
    });

    return ok({ territories, employees });
  } catch (err) {
    console.error("[GET /api/manager/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch territories", 500);
  }
}

async function createTerritory(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTerritorySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { name, region, zone, employeeId } = parsed.data;

    // Check if name is unique
    const existing = await db.territory.findUnique({ where: { name } });
    if (existing) {
      return badRequest("A territory with this name already exists");
    }

    const territory = await db.territory.create({
      data: {
        name,
        region,
        zone,
        employeeId: employeeId || null,
      },
    });

    return created({ territory, success: true });
  } catch (err) {
    console.error("[POST /api/manager/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create territory", 500);
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
    console.error("[PUT /api/manager/territories]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to assign territory", 500);
  }
}

export const GET = withAuth(getTerritories, [Role.ASM, Role.ADMIN, Role.MD]);
export const POST = withAuth(createTerritory, [Role.ASM, Role.ADMIN, Role.MD]);
export const PUT = withAuth(assignTerritory, [Role.ASM, Role.ADMIN, Role.MD]);
