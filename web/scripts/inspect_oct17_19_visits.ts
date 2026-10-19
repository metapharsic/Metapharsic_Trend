import { db } from "../lib/db";

async function run() {
  const visits = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-17T00:00:00Z"),
        lte: new Date("2026-10-19T23:59:59Z")
      }
    },
    include: {
      employee: true,
      doctor: true,
      chemist: true
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Visits on Oct 17-19 count: ${visits.length}`);
  const byDay: Record<string, number> = {};
  const byEmp: Record<string, number> = {};
  for (const v of visits) {
    const d = v.createdAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
    const empName = `${v.employee.firstName} ${v.employee.lastName}`;
    byEmp[empName] = (byEmp[empName] || 0) + 1;
  }
  console.log("By Day:", byDay);
  console.log("By Employee:", byEmp);

  console.log("\nVisits on Oct 19 (today):");
  for (const v of visits.filter(x => x.createdAt.toISOString().startsWith("2026-10-19"))) {
    const target = v.doctor?.fullName || v.chemist?.name;
    console.log(`${v.id} | ${v.employee.firstName} ${v.employee.lastName} | ${target} | ${v.createdAt.toISOString()} | local: ${new Date(v.createdAt).toLocaleString("en-IN")}`);
  }
}

run().then(() => process.exit(0)).catch(console.error);
