import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import bcrypt from "bcrypt";
import { z } from "zod";

const ChangePasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

async function handler(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { userId, newPassword } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user) {
      return notFound("User not found");
    }

    // Cryptographically hash the new password using bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the stored password hash
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate any active refresh tokens to force re-authentication with new credential
    await db.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    return ok({
      message: `Password updated successfully for ${user.employee?.firstName ? `${user.employee.firstName} (${user.email})` : user.email}`,
      userId: user.id,
      email: user.email,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/users/change-password]", err);
    return apiError("INTERNAL_SERVER_ERROR", err?.message || "Failed to update password", 500);
  }
}

export const POST = withAuth(handler, [Role.ADMIN]);
