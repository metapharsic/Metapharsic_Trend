import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { ManagerLoginSchema } from "@/lib/validators";
import { ok, badRequest, unauthorized, apiError } from "@/lib/api-response";

/** Roles permitted to authenticate through the manager login door. */
const MANAGER_ROLES: Role[] = [
  Role.ADMIN,
  Role.MD,
  Role.NSM,
  Role.ZSM,
  Role.RM,
  Role.ASM,
  Role.HR,
  Role.FINANCE,
  Role.WAREHOUSE,
  Role.MARKETING,
];


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ManagerLoginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      include: { employee: true },
    });

    if (!user) {
      return unauthorized("Invalid credentials. Please verify your email.");
    }
    if (!user.isActive) {
      return apiError("FORBIDDEN", "Account is inactive", 403);
    }

    // The stored hash is the only authority on whether a password is correct.
    // There is no fallback list and no rewrite-on-login: a login must never be
    // able to change the credential it is checking.
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return unauthorized("Invalid credentials. Please check your password.");
    }

    // This door serves office/management roles only. Without this check it
    // issues a token for whatever role the account happens to hold, so a
    // DISTRIBUTOR or DOCTOR account signs in through the manager login and
    // lands in the management UI. Field reps use /api/auth/login/mr, which
    // additionally enforces device binding.
    if (!MANAGER_ROLES.includes(user.role)) {
      return unauthorized("This account cannot sign in here. Use the app assigned to your role.");
    }

    const tokenPayload = { sub: user.id, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

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
      },
      accessToken,
      refreshToken,
    });

    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[POST /api/auth/login/manager]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Login failed", 500);
  }
}
