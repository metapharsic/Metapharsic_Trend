import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateLeadSchema } from "@/lib/validators";
import { ok, notFound, apiError, badRequest } from "@/lib/api-response";

async function updateLead(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return notFound("Lead not found");

    const body = await req.json();
    const parsed = UpdateLeadSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.lead.update({ where: { id }, data: parsed.data });
    return ok({ lead: updated });
  } catch (err) {
    console.error("[PUT /api/manager/leads/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update lead", 500);
  }
}

async function deleteLead(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return notFound("Lead not found");

    await db.lead.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/manager/leads/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete lead", 500);
  }
}

export const PUT = withAuth(updateLead, [Role.ASM, Role.ADMIN]);
export const DELETE = withAuth(deleteLead, [Role.ADMIN]);
