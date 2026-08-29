import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { z } from "zod";

const CompanySettingsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().default(""),
  phone: z.string().nullable().optional(),
  panNo: z.string().nullable().optional(),
  dlNo1: z.string().nullable().optional(),
  dlNo2: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankBranch: z.string().nullable().optional(),
  accountNo: z.string().nullable().optional(),
  ifscCode: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  logoPath: z.string().nullable().optional(),
});

async function getCompanySettings(req: AuthedRequest) {
  try {
    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: {
        id: "singleton",
        name: "Trend MR",
        address: "",
      },
    });
    return ok({ settings });
  } catch (err) {
    console.error("[GET /api/admin/company-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch company settings", 500);
  }
}

async function updateCompanySettings(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CompanySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: {
        id: "singleton",
        ...parsed.data,
      },
    });

    return ok({ settings, message: "Company settings saved successfully" });
  } catch (err) {
    console.error("[PUT /api/admin/company-settings]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update company settings", 500);
  }
}

export const GET = withAuth(getCompanySettings, [Role.ADMIN, Role.MD]);
export const PUT = withAuth(updateCompanySettings, [Role.ADMIN, Role.MD]);
