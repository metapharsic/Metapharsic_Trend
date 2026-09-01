import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";

const UpdateTerritorySchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
});

async function updateTerritory(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.territory.findUnique({ where: { id } });
    if (!existing) return notFound("Territory not found");

    const body = await req.json();
    const parsed = UpdateTerritorySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const nameTaken = await db.territory.findUnique({ where: { name: parsed.data.name } });
      if (nameTaken) return badRequest("A territory with this name already exists");
    }

    const territory = await db.territory.update({ where: { id }, data: parsed.data });
    return ok({ territory });
  } catch (err) {
    console.error("[PUT /api/manager/territories/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update territory", 500);
  }
}

async function deleteTerritory(
  _req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const territory = await db.territory.findUnique({
      where: { id },
      include: {
        _count: { select: { doctors: true, chemists: true, hospitals: true, distributors: true, targets: true, tourPlanDays: true } },
      },
    });
    if (!territory) return notFound("Territory not found");

    const counts = territory._count;
    const total = counts.doctors + counts.chemists + counts.hospitals + counts.distributors + counts.targets + counts.tourPlanDays;
    if (total > 0) {
      return conflict(
        `Cannot delete — territory still has ${counts.doctors} doctor(s), ${counts.chemists} chemist(s), ${counts.hospitals} hospital(s), and other linked records. Reassign or remove them first.`
      );
    }

    await db.territory.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/manager/territories/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete territory", 500);
  }
}

export const PUT = withAuth(updateTerritory, [Role.ADMIN]);
export const DELETE = withAuth(deleteTerritory, [Role.ADMIN]);
