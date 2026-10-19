import { db } from "../lib/db";

async function run() {
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR" } },
    include: { user: true }
  });

  console.log("=== MR VISIT DATES BREAKDOWN (OCT 2026) ===");
  for (const mr of mrs) {
    const visits = await db.visit.findMany({
      where: {
        employeeId: mr.id,
        createdAt: {
          gte: new Date("2026-10-01T00:00:00Z"),
          lte: new Date("2026-10-31T23:59:59Z")
        }
      },
      select: { createdAt: true }
    });

    const daysCount: Record<string, number> = {};
    for (const v of visits) {
      const d = v.createdAt.toISOString().slice(0, 10);
      daysCount[d] = (daysCount[d] || 0) + 1;
    }

    const sortedDays = Object.keys(daysCount).sort();
    console.log(`\n${mr.firstName} ${mr.lastName} (${mr.id}) - Total visits: ${visits.length}`);
    console.log(`Active Days: ${sortedDays.join(", ")}`);
    console.log(`Days breakdown:`, daysCount);
  }
}

run().then(() => process.exit(0)).catch(console.error);
