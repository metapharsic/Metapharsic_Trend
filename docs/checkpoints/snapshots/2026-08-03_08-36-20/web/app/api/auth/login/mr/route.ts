import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { MRLoginSchema } from "@/lib/validators";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";

const db = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MRLoginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { email, password, deviceUuid } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user || user.role !== Role.MR) {
      return unauthorized("Invalid credentials");
    }
    if (!user.isActive) {
      return apiError("FORBIDDEN", "Account is inactive", 403);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return unauthorized("Invalid credentials");
    }

    // Device binding validation
    if (!user.deviceUuid) {
      // First-time bind
      await db.user.update({
        where: { id: user.id },
        data: { deviceUuid },
      });
    } else if (user.deviceUuid !== deviceUuid) {
      return badRequest("Device UUID mismatch. Please contact administrator to reset device binding.");
    }

    const tokenPayload = { sub: user.id, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Store refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.employee?.firstName || "",
        lastName: user.employee?.lastName || "",
        phone: user.employee?.phone || "",
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("[POST /api/auth/login/mr]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Login failed", 500);
  }
}
