import { db } from "../lib/db";

async function run() {
  console.log("=== FRIDAY OCT 16, 2026 DATA ACROSS TABLES ===");

  const visits = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-16T00:00:00Z"),
        lte: new Date("2026-10-16T23:59:59Z")
      }
    },
    include: { employee: true },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Visits on Oct 16: ${visits.length}`);
  if (visits.length > 0) {
    console.log(`Latest visit on Oct 16: ${visits[0].createdAt.toISOString()} | MR: ${visits[0].employee.firstName} ${visits[0].employee.lastName}`);
    console.log(`First visit on Oct 16: ${visits[visits.length - 1].createdAt.toISOString()} | MR: ${visits[visits.length - 1].employee.firstName} ${visits[visits.length - 1].employee.lastName}`);
  }

  const tokens = await db.refreshToken.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-16T00:00:00Z"),
        lte: new Date("2026-10-16T23:59:59Z")
      }
    },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Refresh tokens on Oct 16: ${tokens.length}`);
  for (const t of tokens) {
    const user = await db.user.findUnique({ where: { id: t.userId }, include: { employee: true } });
    console.log(`Token on Oct 16: ${t.createdAt.toISOString()} | User: ${user?.email} (${user?.employee?.firstName} ${user?.employee?.lastName})`);
  }

  const orders = await db.order.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-16T00:00:00Z"),
        lte: new Date("2026-10-16T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  console.log(`Orders on Oct 16: ${orders.length}`);

  const attendances = await db.attendance.findMany({
    where: {
      date: new Date("2026-10-16T00:00:00Z")
    },
    include: { employee: true }
  });
  console.log(`Attendance on Oct 16: ${attendances.length}`);
}

run().then(() => process.exit(0)).catch(console.error);
