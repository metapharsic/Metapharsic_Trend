import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, conflict, apiError } from "@/lib/api-response";
import { z } from "zod";


const CreateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

async function getCourses(req: AuthedRequest) {
  try {
    const courses = await db.lMSCourse.findMany({
      include: { _count: { select: { enrollments: true } } },
      orderBy: { title: "asc" },
    });
    return ok({ courses });
  } catch (err) {
    console.error("[GET /api/lms/courses]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch courses", 500);
  }
}

async function createCourse(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = CreateCourseSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const course = await db.lMSCourse.create({ data: parsed.data });
    return created({ course });
  } catch (err: any) {
    if (err?.code === "P2002") return conflict("A course with this title already exists");
    console.error("[POST /api/lms/courses]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create course", 500);
  }
}

export const GET = withAuth(getCourses, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createCourse, [Role.ASM, Role.ADMIN]);
