import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import bcrypt from "bcrypt";
import { z } from "zod";


const CreateMRBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(10),
});

async function getMRs(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeParam = searchParams.get("active");
    const isActive = activeParam !== null ? activeParam === "true" : undefined;

    const employees = await db.employee.findMany({
      where: {
        user: {
          role: Role.MR,
          ...(isActive !== undefined ? { isActive } : {}),
        },
      },
      include: {
        user: { select: { id: true, email: true, isActive: true, createdAt: true } },
        territories: { select: { id: true, name: true } },
      },
      orderBy: { firstName: "asc" },
    });

    const mrs = employees.map((emp) => ({
      id: emp.user.id,
      employeeId: emp.id,
      email: emp.user.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone,
      isActive: emp.user.isActive,
      territories: emp.territories.map((t) => t.name),
      createdAt: emp.user.createdAt,
    }));

    return ok({ mrs });
  } catch (err) {
    console.error("[GET /api/manager/mrs]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch MRs", 500);
  }
}

async function createMR(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateMRBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { email, password, firstName, lastName, phone } = parsed.data;

    const userExists = await db.user.findUnique({ where: { email } });
    if (userExists) return conflict("Email already in use");

    const employeeExists = await db.employee.findFirst({ where: { phone } });
    if (employeeExists) return conflict("Phone number already in use");

    const hashedPassword = await bcrypt.hash(password, 12);

    const mr = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          role: Role.MR,
          isActive: true,
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone,
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
      };
    });

    return created({ mr });
  } catch (err) {
    console.error("[POST /api/manager/mrs]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create MR", 500);
  }
}

export const GET = withAuth(getMRs, ["ASM", "ADMIN", "MD"]);
export const POST = withAuth(createMR, ["ASM", "ADMIN", "MD"]);
