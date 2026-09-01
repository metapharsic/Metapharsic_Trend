import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { logoUrl } from "@/lib/upload";
import { z } from "zod";

const UpdateCompanySettingsSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  panNo: z.string().optional(),
  dlNo1: z.string().optional(),
  dlNo2: z.string().optional(),
  gstin: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  accountNo: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  terms: z.string().optional(),
});

/**
 * The seller/bank block printed on every invoice. A single row — read by
 * anyone who can view an invoice, written by Admin only.
 */
async function getSettings(req: AuthedRequest) {
  try {
    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return ok({ settings: { ...settings, logoUrl: settings.logoPath ? logoUrl(settings.logoPath) : null } });
  } catch (err) {
    console.error("[GET /api/company-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch company settings", 500);
  }
}

async function updateSettings(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = UpdateCompanySettingsSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    return ok({ settings: { ...settings, logoUrl: settings.logoPath ? logoUrl(settings.logoPath) : null } });
  } catch (err) {
    console.error("[PUT /api/company-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update company settings", 500);
  }
}

export const GET = withAuth(getSettings, [
  Role.MR,
  Role.ASM,
  Role.RM,
  Role.ZSM,
  Role.NSM,
  Role.MD,
  Role.ADMIN,
  Role.DISTRIBUTOR,
  Role.FINANCE,
]);
export const PUT = withAuth(updateSettings, [Role.ADMIN]);
