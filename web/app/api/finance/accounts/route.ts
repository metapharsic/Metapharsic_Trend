import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";

const CreateAccountSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  type: z.enum(["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"]),
  parentId: z.string().uuid().optional(),
});

async function listAccounts(req: AuthedRequest) {
  try {
    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });
    return ok({ accounts });
  } catch (err) {
    console.error("[GET /api/finance/accounts]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch accounts", 500);
  }
}

async function createAccount(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const existing = await db.chartOfAccount.findUnique({ where: { code: parsed.data.code } });
    if (existing) return conflict("Account code already exists");

    const account = await db.chartOfAccount.create({ data: parsed.data });
    return created({ account });
  } catch (err) {
    console.error("[POST /api/finance/accounts]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create account", 500);
  }
}

export const GET = withAuth(listAccounts, [Role.FINANCE, Role.ADMIN, Role.MD]);
export const POST = withAuth(createAccount, [Role.FINANCE, Role.ADMIN]);
