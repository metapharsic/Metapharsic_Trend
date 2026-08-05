import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { LoginSchema } from "@/lib/validators";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { email, password, role, deviceUuid } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user) {
      return unauthorized("Invalid credentials");
    }

    // Strict role check
    if (user.role !== role) {
      return unauthorized(`Role mismatch. You must log in as ${role}.`);
    }

    if (!user.isActive) {
      return apiError("FORBIDDEN", "Account is inactive", 403);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return unauthorized("Invalid credentials");
    }

    // MR specific device UUID binding validation
    if (role === Role.MR) {
      if (!deviceUuid) {
        return badRequest("Device UUID is required for MR login");
      }

      if (!user.deviceUuid) {
        // First-time bind
        await db.user.update({
          where: { id: user.id },
          data: { deviceUuid },
        });
      } else if (user.deviceUuid !== deviceUuid) {
        return badRequest("Device UUID mismatch. Please contact administrator to reset device binding.");
      }
    }

    const tokenPayload = { sub: user.id, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Save refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const response = ok({
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

    response.cookies.set("mr_access_token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Login failed", 500);
  }
}
