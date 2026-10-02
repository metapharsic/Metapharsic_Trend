import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, forbidden, notFound, apiError, badRequest } from "@/lib/api-response";
import { photoUrl } from "@/lib/upload";
import { UpdateVisitSchema } from "@/lib/validators";
import { CallComplianceAgentsService } from "@/services/call-compliance-agents.service";


async function handler(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const visit = await db.visit.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, userId: true } },
        doctor: { select: { id: true, fullName: true, clinicAddress: true, mobile: true, whatsApp: true } },
        chemist: { select: { id: true, name: true, address: true, mobile: true } },
        lead: true,
      },
    });

    if (!visit) return notFound("Visit not found");

    // MRs can only view their own visits
    if (visit.employee?.userId !== req.user.sub) return forbidden();

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
    if (visit.employee?.userId !== req.user.sub) return forbidden();

    const body = await req.json();
    const parsed = UpdateVisitSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { phone, latitude, longitude, ...visitFields } = parsed.data;

    // Handle Phone verification & sync if provided during update
    if (phone) {
      const phoneValidation = CallComplianceAgentsService.verifyMandatoryPhone(phone);
      if (phoneValidation.isValid) {
        CallComplianceAgentsService.syncEntityContactNumber({
          doctorId: visit.doctorId,
          chemistId: visit.chemistId,
          phone: phoneValidation.cleanPhone,
        }).catch((e) => console.error("[CallCompliance] Update phone sync error:", e));
      }
    }

    // Handle Silent Background GPS Telemetry
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
    if (visit.employee?.userId !== req.user.sub) return forbidden();

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

export const GET = withAuth(handler, "MR");
export const PUT = withAuth(updateHandler, "MR");
export const DELETE = withAuth(deleteHandler, "MR");
