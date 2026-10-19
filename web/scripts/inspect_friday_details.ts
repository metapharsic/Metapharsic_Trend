import { db } from "../lib/db";

async function run() {
  console.log("=== REFRESH TOKENS AROUND OCT 16 ===");
  const refreshTokens = await db.refreshToken.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-15T00:00:00Z"),
        lte: new Date("2026-10-17T23:59:59Z")
      }
    },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Refresh tokens count: ${refreshTokens.length}`);
  for (const rt of refreshTokens) {
    console.log(`${rt.userId} | created: ${rt.createdAt.toISOString()} | revoked: ${rt.revoked}`);
  }

  console.log("\n=== DCR ENTRIES AROUND OCT 16 ===");
  const dcr = await db.dcrEntry.findMany({
    where: {
      date: {
        gte: new Date("2026-10-15T00:00:00Z"),
        lte: new Date("2026-10-17T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  console.log(`DCR count: ${dcr.length}`);
  for (const d of dcr) {
    console.log(`${d.date.toISOString().slice(0, 10)} | ${d.employee.firstName} ${d.employee.lastName} | status: ${d.status}`);
  }

  console.log("\n=== ORDERS AROUND OCT 16 ===");
  const orders = await db.order.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-15T00:00:00Z"),
        lte: new Date("2026-10-17T23:59:59Z")
      }
    },
    include: { employee: true },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Orders count: ${orders.length}`);
  for (const o of orders) {
    console.log(`${o.createdAt.toISOString()} | ${o.employee.firstName} ${o.employee.lastName} | ₹${o.totalAmount} | ${o.orderNumber}`);
  }

  console.log("\n=== EXPENSES AROUND OCT 16 ===");
  const expenses = await db.expenseClaim.findMany({
    where: {
      date: {
        gte: new Date("2026-10-15T00:00:00Z"),
        lte: new Date("2026-10-17T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  console.log(`Expenses count: ${expenses.length}`);
  for (const exp of expenses) {
    console.log(`${exp.date.toISOString().slice(0, 10)} | ${exp.employee.firstName} ${exp.employee.lastName} | ₹${exp.amount}`);
  }
}

run().then(() => process.exit(0)).catch(console.error);
