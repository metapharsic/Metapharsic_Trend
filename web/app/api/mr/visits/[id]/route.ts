import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";
import { photoUrl } from "@/lib/upload";
import { UpdateVisitSchema } from "@/lib/validators";
import { CallComplianceAgentsService } from "@/services/call-compliance-agents.service";

const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.MD, Role.ASM, Role.RM, Role.ZSM, Role.NSM];

async function handler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, userId: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, fullName: true, clinicAddress: true, mobile: true, whatsApp: true, beatName: true, subArea: true } },
        chemist: { select: { id: true, name: true, address: true, mobile: true, licenseNo: true, dlStatus: true, beatName: true, subArea: true } },
        lead: true,
        samples: {
          include: {
            product: { select: { id: true, name: true, sku: true, packSize: true } },
          },
        },
        gifts: {
          include: {
            giftCatalog: { select: { id: true, name: true } },
          },
        },
        competitorLogs: true,
      },
    });

    if (!visit) return notFound("Visit not found");

    const isManager = MANAGER_ROLES.includes(req.user.role as Role);
    if (!isManager && visit.employee?.userId !== req.user.sub) return forbidden();

    return ok({
      visit: {
        ...visit,
        photoUrl: visit.photoPath ? photoUrl(visit.photoPath) : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/mr/visits/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visit", 500);
  }
}

async function updateHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({
      where: { id },
      include: {
        employee: { select: { userId: true } },
        doctor: { select: { id: true, mobile: true } },
        chemist: { select: { id: true, mobile: true } },
      },
    });
    if (!visit) return notFound("Visit not found");
    const isManager = MANAGER_ROLES.includes(req.user.role as Role);
    if (!isManager && visit.employee?.userId !== req.user.sub) return forbidden();

    const body = await req.json();
    const parsed = UpdateVisitSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { phone, latitude, longitude, ...visitFields } = parsed.data;

    // Optional phone validation — only validates and syncs when provided cleanly
    if (phone !== undefined) {
      const phoneValidation = CallComplianceAgentsService.verifyOptionalPhone(phone);
      if (!phoneValidation.isValid) {
        return badRequest(phoneValidation.error || "Invalid phone number");
      }
      if (!phoneValidation.isEmpty && phoneValidation.cleanPhone) {
        await CallComplianceAgentsService.syncEntityContactNumber({
          doctorId: visit.doctorId,
          chemistId: visit.chemistId,
          phone: phoneValidation.cleanPhone,
        });
      }
    }

    // Handle Silent Background GPS Telemetry accurately without clobbering existing fix when absent
    const gpsTelemetry = CallComplianceAgentsService.processSilentGpsTelemetry({
      latitude,
      longitude,
    });

    const updateData: any = {
      ...visitFields,
    };

    if (gpsTelemetry.hasGps) {
      updateData.latitude = gpsTelemetry.latitude;
      updateData.longitude = gpsTelemetry.longitude;
      updateData.locationUnavailable = false;
    }

    const updated = await db.visit.update({ where: { id }, data: updateData });
    return ok({ visit: updated });
  } catch (err) {
    console.error("[PUT /api/mr/visits/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update visit", 500);
  }
}

async function deleteHandler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({
      where: { id },
      include: { employee: { select: { userId: true } }, samples: true },
    });
    if (!visit) return notFound("Visit not found");
    const isManager = MANAGER_ROLES.includes(req.user.role as Role);
    if (!isManager && visit.employee?.userId !== req.user.sub) return forbidden();

    await db.$transaction(async (tx) => {
      // Restore sample stock consumed by this visit before removing it.
      for (const sample of visit.samples) {
        await tx.sampleInventory.updateMany({
          where: { employeeId: visit.employeeId, productId: sample.productId },
          data: { quantity: { increment: sample.quantity } },
        });
      }
      await tx.visit.delete({ where: { id } });
    });

    return ok({ success: true });
  } catch (err) {
    console.error("[DELETE /api/mr/visits/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete visit", 500);
  }
}

export const GET = withAuth(handler, [Role.MR, Role.ASM, Role.MD, Role.ADMIN]);
export const PUT = withAuth(updateHandler, [Role.MR, Role.ASM, Role.MD, Role.ADMIN]);
export const DELETE = withAuth(deleteHandler, [Role.MR, Role.ASM, Role.MD, Role.ADMIN]);
