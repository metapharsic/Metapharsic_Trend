import { db } from "../lib/db";

async function run() {
  const emp = await db.employee.findMany({
    where: { user: { role: "MR" } },
    include: { user: true, territories: true },
    orderBy: { firstName: "asc" }
  });
  console.log("=== MR EMPLOYEES ===");
  for (const e of emp) {
    console.log(`${e.id} | ${e.firstName} ${e.lastName} | user: ${e.userId} | ${e.user?.email}`);
  }

  console.log("\n=== ALL ATTENDANCES IN OCT 2026 ===");
  const atts = await db.attendance.findMany({
    where: {
      date: {
        gte: new Date("2026-10-01T00:00:00Z"),
        lte: new Date("2026-10-31T23:59:59Z")
      }
    },
    include: { employee: true },
    orderBy: [{ date: "desc" }, { employeeId: "asc" }]
  });
  for (const a of atts) {
    console.log(
      `${a.date.toISOString().slice(0, 10)} | ${a.employee.firstName} ${a.employee.lastName} | in: ${a.checkIn.toISOString()} | out: ${a.checkOut?.toISOString() || "NONE"}`
    );
  }

  console.log("\n=== VISITS ON OCT 16 (FRIDAY) ===");
  const oct16Visits = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-16T00:00:00Z"),
        lte: new Date("2026-10-16T23:59:59Z")
      }
    },
    include: { employee: true },
    orderBy: { createdAt: "asc" }
  });
  console.log(`Visits count on Oct 16: ${oct16Visits.length}`);
  for (const v of oct16Visits) {
    console.log(
      `${v.employee.firstName} ${v.employee.lastName} | createdAt: ${v.createdAt.toISOString()} | startedAt: ${v.startedAt?.toISOString()} | endedAt: ${v.endedAt?.toISOString()}`
    );
  }

  console.log("\n=== LATEST VISIT PER MR IN OCT 2026 ===");
  for (const e of emp) {
    const lastVisit = await db.visit.findFirst({
      where: { employeeId: e.id },
      orderBy: { createdAt: "desc" }
    });
    console.log(
      `${e.firstName} ${e.lastName}: last visit: ${lastVisit?.createdAt.toISOString() || "NONE"}`
    );
  }

  console.log("\n=== TOUR PLAN DAYS PER MR ===");
  const tourPlans = await db.tourPlan.findMany({
    include: {
      employee: true,
      days: {
        orderBy: { date: "desc" },
        take: 3
      }
    }
  });
  for (const tp of tourPlans) {
    const dates = tp.days.map(d => d.date.toISOString().slice(0, 10)).join(", ");
    console.log(`${tp.employee.firstName} ${tp.employee.lastName} | planId: ${tp.id} | latest days: ${dates}`);
  }
}

run().then(() => process.exit(0)).catch(console.error);
