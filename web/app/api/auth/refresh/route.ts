import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth";
import { RefreshTokenSchema } from "@/lib/validators";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RefreshTokenSchema.safeParse(body);
    if (!parsed.success) return badRequest("Refresh token required");

    const { refreshToken } = parsed.data;

    let payload: { sub: string; role: Role };
    try {
      payload = verifyRefreshToken(refreshToken) as unknown as typeof payload;
    } catch {
      return unauthorized("Invalid or expired refresh token");
    }

    const stored = await db.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return unauthorized("Refresh token revoked or expired");
    }

    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return unauthorized("User account is inactive or has been disabled");
    }

    const newAccessToken = signAccessToken({ sub: payload.sub, role: payload.role });
    return ok({ accessToken: newAccessToken });
  } catch (err) {
    console.error("[POST /api/auth/refresh]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Token refresh failed", 500);
  }
}
