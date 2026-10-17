import { db } from "../lib/db";

async function main() {
  console.log("Testing MR query...");
  const employees = await db.employee.findMany({
    where: {
      user: {
        role: "MR",
      },
    },
    include: {
      user: { select: { id: true, email: true, isActive: true, createdAt: true } },
      territories: { select: { id: true, name: true } },
    },
    orderBy: { firstName: "asc" },
  });
  console.log("MR Employees count:", employees.length);

  console.log("Testing Visits summary query...");
  const month = "2026-10";
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const visits = await db.visit.findMany({
    where: {
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      createdAt: true,
      employeeId: true,
      purpose: true,
      feedback: true,
      receptiveness: true,
      durationMinutes: true,
      employee: { select: { firstName: true, lastName: true } },
      doctor: { select: { fullName: true } },
      chemist: { select: { name: true } },
      hospital: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("Visits in 2026-10 count:", visits.length);

  let nullEmployeeCount = 0;
  for (const v of visits) {
    if (!v.employee) {
      nullEmployeeCount++;
    } else {
      const name = `${v.employee.firstName} ${v.employee.lastName}`;
    }
  }
  console.log("Visits with null employee:", nullEmployeeCount);

  const allVisits = await db.visit.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const monthsSet = new Set(allVisits.map(v => v.createdAt.toISOString().slice(0, 7)));
  console.log("Months with visits in DB:", Array.from(monthsSet));

  const rawMonths = await db.$queryRaw<Array<{ month: string; count: number }>>`
    SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS count
    FROM "Visit"
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12;
  `;
  console.log("Raw months summary:", rawMonths);

  await db.$disconnect();
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
