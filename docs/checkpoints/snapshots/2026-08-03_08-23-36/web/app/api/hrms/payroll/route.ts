import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { calculatePayroll } from "@/lib/payroll";
import { startOfUtcMonth } from "@/lib/date";
import { z } from "zod";

const db = new PrismaClient();

const GeneratePayrollSchema = z.object({
  employeeId: z.string().uuid(),
  month: z.coerce.date(),
  basicSalary: z.coerce.number().min(0),
});

async function getPayrolls(req: AuthedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") ?? undefined;

    const payrolls = await db.payroll.findMany({
      where: { ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { month: "desc" },
    });

    return ok({ payrolls });
  } catch (err) {
    console.error("[GET /api/hrms/payroll]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch payroll records", 500);
  }
}

/**
 * Generates (or regenerates) a month's payroll for one employee.
 * Achievement is measured as collections banked in the month against the sum of
 * the employee's targets overlapping that month.
 */
async function generatePayroll(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = GeneratePayrollSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const { employeeId, basicSalary } = parsed.data;
    const month = startOfUtcMonth(parsed.data.month);
    const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return notFound("Employee not found");

    const [targets, collections] = await Promise.all([
      db.target.findMany({
        where: { employeeId, startDate: { lt: nextMonth }, endDate: { gte: month } },
        select: { value: true },
      }),
      db.collection.aggregate({
        where: { employeeId, createdAt: { gte: month, lt: nextMonth } },
        _sum: { amount: true },
      }),
    ]);

    const targetValue = targets.reduce((sum, t) => sum + Number(t.value), 0);
    const achievedValue = Number(collections._sum.amount ?? 0);

    const breakdown = calculatePayroll({ basicSalary, targetValue, achievedValue });

    const payroll = await db.payroll.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: {
        basicSalary: breakdown.basicSalary,
        incentives: breakdown.incentives,
        pf: breakdown.pf,
        esic: breakdown.esic,
        tax: breakdown.tax,
        netPayable: breakdown.netPayable,
      },
      create: {
        employeeId,
        month,
        basicSalary: breakdown.basicSalary,
        incentives: breakdown.incentives,
        pf: breakdown.pf,
        esic: breakdown.esic,
        tax: breakdown.tax,
        netPayable: breakdown.netPayable,
      },
    });

    return ok({ payroll, breakdown: { ...breakdown, targetValue, achievedValue } });
  } catch (err) {
    console.error("[POST /api/hrms/payroll]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to generate payroll", 500);
  }
}

export const GET = withAuth(getPayrolls, [Role.ASM, Role.ADMIN]);
export const POST = withAuth(generatePayroll, [Role.ADMIN]);
