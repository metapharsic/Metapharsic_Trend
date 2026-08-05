import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { UpdateLeadSchema } from "@/lib/validators";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";

async function updateLead(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const lead = await db.lead.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!lead) return notFound("Lead not found");
    if (lead.employee.userId !== req.user.sub) return forbidden();

    const body = await req.json();
    const parsed = UpdateLeadSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const updated = await db.lead.update({ where: { id }, data: parsed.data });
    return ok({ lead: updated });
  } catch (err) {
    console.error("[PUT /api/mr/leads/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update lead", 500);
  }
}

async function deleteLead(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const lead = await db.lead.findUnique({ where: { id }, include: { employee: { select: { userId: true } } } });
    if (!lead) return notFound("Lead not found");
    if (lead.employee.userId !== req.user.sub) return forbidden();

    await db.lead.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/mr/leads/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete lead", 500);
  }
}

export const PUT = withAuth(updateLead, [Role.MR]);
export const DELETE = withAuth(deleteLead, [Role.MR]);
