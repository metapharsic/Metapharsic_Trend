import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcrypt";

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(10),
  managerId: z.string().uuid().optional(),
});

async function getUsers(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") as Role | null;
    const search = searchParams.get("search") ?? "";

    const users = await db.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                {
                  employee: {
                    OR: [
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            manager: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });

    return ok({ users });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch users", 500);
  }
}

async function createUser(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { email, password, role, firstName, lastName, phone, managerId } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role,
        isActive: true,
        ...(role !== Role.DOCTOR && role !== Role.DISTRIBUTOR
          ? {
              employee: {
                create: { firstName, lastName, phone, ...(managerId ? { managerId } : {}) },
              },
            }
          : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    return ok({ user });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("A user with this email already exists");
    console.error("[POST /api/users]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create user", 500);
  }
}

export const GET = withAuth(getUsers, [Role.ADMIN, Role.MD]);
export const POST = withAuth(createUser, [Role.ADMIN]);
