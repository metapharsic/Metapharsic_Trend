import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, notFound, unauthorized, forbidden, apiError } from "@/lib/api-response";
import { z } from "zod";

const CreateClaimSchema = z.object({
  chemistId: z.string().uuid(),
  distributorId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().min(1),
});

/**
 * MR raises a damaged/expiry claim on behalf of a chemist they visit — the
 * "Submitted by Chemist, audited by MR" step per docs/02_database/schema_design.md.
 * Created as PENDING_MR (schema default); the MR must then explicitly submit
 * it via PUT .../[id]/submit to advance to PENDING_ASM, so a half-filled draft
 * never accidentally lands in front of an ASM.
 */
async function createClaim(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: { territories: { select: { id: true } } },
    });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = CreateClaimSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const chemist = await db.chemist.findUnique({ where: { id: parsed.data.chemistId } });
    if (!chemist) return notFound("Chemist not found");

    const ownTerritoryIds = employee.territories.map((t) => t.id);
    if (!ownTerritoryIds.includes(chemist.territoryId)) {
      return badRequest("You may only raise claims for chemists in your own territories");
    }

    const claim = await db.claim.create({
      data: {
        chemistId: parsed.data.chemistId,
        distributorId: parsed.data.distributorId,
        employeeId: employee.id,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
      },
    });

    return created({ claim });
  } catch (err) {
    console.error("[POST /api/mr/claims]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to raise claim", 500);
  }
}

async function getClaims(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const requestedEmployeeId = url.searchParams.get("employeeId");
    const isManager = req.user.role === Role.ASM || req.user.role === Role.ADMIN;
    if (requestedEmployeeId && !isManager) return forbidden("You may only view your own claims");

    let scopeEmployeeId: string | undefined;
    if (requestedEmployeeId) {
      scopeEmployeeId = requestedEmployeeId;
    } else if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      scopeEmployeeId = employee.id;
    }
    // else: isManager && no requestedEmployeeId -> all MRs' claims

    const { searchParams } = url;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = 25;

    const where = { ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}) };

    const [claims, total] = await Promise.all([
      db.claim.findMany({
        where,
        include: {
          chemist: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, sku: true } },
          employee: { select: { firstName: true, lastName: true } },
          creditNote: { select: { number: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.claim.count({ where }),
    ]);

    return ok({
      claims: claims.map((c) => ({ ...c, employeeName: `${c.employee.firstName} ${c.employee.lastName}` })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    console.error("[GET /api/mr/claims]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch claims", 500);
  }
}

export const POST = withAuth(createClaim, [Role.MR]);
export const GET = withAuth(getClaims, [Role.MR, Role.ASM, Role.ADMIN]);
