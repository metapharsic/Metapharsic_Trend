import { db } from "@/lib/db";
import { Role, ClaimStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, apiError, unauthorized } from "@/lib/api-response";
import { z } from "zod";

const UpdateClaimSchema = z.object({
  chemistId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  reason: z.string().min(1).optional(),
  status: z.nativeEnum(ClaimStatus).optional(),
});

async function getClaimDetails(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        chemist: {
          select: {
            id: true,
            name: true,
            address: true,
            contactPerson: true,
            mobile: true,
            territory: { select: { id: true, name: true, region: true, zone: true } },
          },
        },
        distributor: {
          select: {
            id: true,
            name: true,
            gstNo: true,
            licenseNo: true,
            address: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            ptr: true,
            mrp: true,
            packSize: true,
            composition: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true, role: true } },
          },
        },
        creditNote: {
          select: {
            id: true,
            number: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!claim) return notFound("Claim not found");

    function getClaimUnitPrice(p: { ptr?: any; price: any }): number {
      if (p.ptr !== null && p.ptr !== undefined) {
        return Number(p.ptr);
      }
      return Number(p.price);
    }
    const unitPrice = getClaimUnitPrice(claim.product);
    const estimatedAmount = unitPrice * claim.quantity;

    return ok({
      claim: {
        ...claim,
        unitPrice,
        estimatedAmount,
        employeeName: `${claim.employee.firstName} ${claim.employee.lastName}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/mr/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch claim details", 500);
  }
}

async function updateClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateClaimSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) return notFound("Claim not found");

    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee || claim.employeeId !== employee.id) {
        return forbidden("You may only edit your own claims");
      }
      if (claim.status !== ClaimStatus.PENDING_MR) {
        return badRequest(`Claim is ${claim.status.toLowerCase()} — only draft (PENDING_MR) claims can be edited by MR`);
      }
    }

    const { chemistId, distributorId, productId, quantity, reason, status } = parsed.data;

    const updated = await db.claim.update({
      where: { id },
      data: {
        ...(chemistId ? { chemistId } : {}),
        ...(distributorId ? { distributorId } : {}),
        ...(productId ? { productId } : {}),
        ...(quantity !== undefined ? { quantity } : {}),
        ...(reason ? { reason } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        chemist: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, ptr: true, price: true } },
        creditNote: { select: { number: true, amount: true } },
      },
    });

    return ok({ claim: updated });
  } catch (err) {
    console.error("[PUT /api/mr/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update claim", 500);
  }
}

async function deleteClaim(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const claim = await db.claim.findUnique({
      where: { id },
      include: { creditNote: true },
    });
    if (!claim) return notFound("Claim not found");

    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);

    if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee || claim.employeeId !== employee.id) {
        return forbidden("You may only delete your own claims");
      }
      if (claim.status !== ClaimStatus.PENDING_MR) {
        return badRequest(`Claim is ${claim.status.toLowerCase()} — only draft (PENDING_MR) claims can be deleted by MR`);
      }
    }

    if (claim.creditNote) {
      return badRequest("Cannot delete claim: a Credit Note has already been issued for this claim. Void credit note first.");
    }

    await db.claim.delete({ where: { id } });
    return ok({ message: "Claim deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/mr/claims/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete claim", 500);
  }
}

const ALL_ROLES = [
  Role.MR,
  Role.ASM,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
  Role.ADMIN,
];

export const GET = withAuth(getClaimDetails, ALL_ROLES);
export const PUT = withAuth(updateClaim, ALL_ROLES);
export const DELETE = withAuth(deleteClaim, ALL_ROLES);
