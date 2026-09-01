import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { CreateLedgerSchema, PaginationSchema } from "@/lib/validators";
import { ok, unauthorized, apiError, badRequest, notFound } from "@/lib/api-response";

async function getLedgers(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const url = new URL(req.url);
    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "50",
    };
    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) return badRequest("Invalid pagination parameters");
    const { page, limit } = parsed.data;

    const where = { employeeId: employee.id };

    const [ledgers, total] = await Promise.all([
      db.entityLedger.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { id: true, fullName: true, clinicAddress: true } },
          chemist: { select: { id: true, name: true, address: true } },
        },
      }),
      db.entityLedger.count({ where }),
    ]);

    return ok({ ledgers, total, page, limit });
  } catch (err) {
    console.error("[GET /api/mr/ledgers]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch ledgers", 500);
  }
}

async function createLedger(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
    if (!employee) return unauthorized("Employee record not found");

    const body = await req.json();
    const parsed = CreateLedgerSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { doctorId, chemistId, ...rest } = parsed.data;
    if (!doctorId && !chemistId) return badRequest("One of doctorId or chemistId must be provided");

    if (doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return notFound("Doctor not found");
    }
    if (chemistId) {
      const chemist = await db.chemist.findUnique({ where: { id: chemistId } });
      if (!chemist) return notFound("Chemist not found");
    }

    const ledger = await db.entityLedger.create({
      data: { employeeId: employee.id, doctorId, chemistId, ...rest },
    });

    return ok({ ledger });
  } catch (err) {
    console.error("[POST /api/mr/ledgers]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to create ledger entry", 500);
  }
}

export const GET = withAuth(getLedgers, [Role.MR]);
export const POST = withAuth(createLedger, [Role.MR]);
