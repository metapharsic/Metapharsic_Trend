import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, unauthorized, notFound, apiError } from "@/lib/api-response";
import { saveDrugLicenseFile } from "@/lib/upload";

async function uploadDrugLicense(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const formData = await req.formData();
    const chemistId = formData.get("chemistId") ? String(formData.get("chemistId")) : null;
    const licenseNo = formData.get("licenseNo") ? String(formData.get("licenseNo")).trim() : null;
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return badRequest("Drug License copy file is required");
    }

    const tempId = chemistId || `temp_${Date.now()}`;
    const uploadResult = await saveDrugLicenseFile(file, tempId);
    if (!uploadResult.ok) {
      return badRequest(uploadResult.error.message);
    }

    const dlCopyUrl = uploadResult.result.relativePath;

    // If chemistId is provided, update the chemist record immediately
    let updatedChemist = null;
    if (chemistId) {
      const existing = await db.chemist.findUnique({ where: { id: chemistId } });
      if (!existing) return notFound("Chemist not found");

      updatedChemist = await db.chemist.update({
        where: { id: chemistId },
        data: {
          dlCopyUrl,
          dlStatus: "VERIFIED",
          ...(licenseNo ? { licenseNo } : {}),
        },
        select: {
          id: true,
          name: true,
          licenseNo: true,
          dlCopyUrl: true,
          dlStatus: true,
          subArea: true,
          beatName: true,
        },
      });
    }

    return ok({
      success: true,
      dlCopyUrl,
      licenseNo,
      chemist: updatedChemist,
      message: "Drug License copy uploaded and verified successfully",
    });
  } catch (err: any) {
    console.error("[POST /api/mr/chemists/upload-dl]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to upload drug license copy", 500);
  }
}

export const POST = withAuth(uploadDrugLicense, [
  Role.MR,
  Role.ASM,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
  Role.ADMIN,
]);
