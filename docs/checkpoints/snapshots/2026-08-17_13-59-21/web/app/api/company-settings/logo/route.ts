import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { saveCompanyLogo } from "@/lib/upload";

async function uploadLogo(req: AuthedRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file || file.size === 0) return badRequest("A logo file is required");

    const uploadResult = await saveCompanyLogo(file);
    if (!uploadResult.ok) return badRequest(uploadResult.error.message);

    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: { logoPath: uploadResult.result.relativePath },
      create: { id: "singleton", logoPath: uploadResult.result.relativePath },
    });

    return ok({ settings });
  } catch (err) {
    console.error("[POST /api/company-settings/logo]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to upload logo", 500);
  }
}

export const POST = withAuth(uploadLogo, [Role.ADMIN]);
