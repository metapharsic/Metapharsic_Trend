import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";


const UpdateMRBodySchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function updateMR(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? ""); // User ID
    const body = await req.json();
    const parsed = UpdateMRBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { firstName, lastName, phone, isActive } = parsed.data;

    const existing = await db.user.findFirst({ where: { id, role: Role.MR } });
    if (!existing) return notFound("MR not found");

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      const e = await tx.employee.update({
        where: { userId: id },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(phone ? { phone } : {}),
        },
      });

      return {
        id: u.id,
        email: u.email,
        firstName: e.firstName,
        lastName: e.lastName,
        phone: e.phone,
        isActive: u.isActive,
      };
    });

    return ok({ mr: updated });
  } catch (err) {
    console.error("[PUT /api/manager/mrs/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update MR", 500);
  }
}

async function deactivateMR(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const existing = await db.user.findFirst({ where: { id, role: Role.MR } });
    if (!existing) return notFound("MR not found");

    await db.user.update({ where: { id }, data: { isActive: false } });
    return ok({ message: "MR account deactivated" });
  } catch (err) {
    console.error("[DELETE /api/manager/mrs/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to deactivate MR", 500);
  }
}

export const PUT = withAuth(updateMR, [Role.ASM, Role.ADMIN]);
export const DELETE = withAuth(deactivateMR, [Role.ASM, Role.ADMIN]);
