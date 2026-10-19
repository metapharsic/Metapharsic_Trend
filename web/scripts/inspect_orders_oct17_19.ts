import { db } from "../lib/db";

async function run() {
  const orders = await db.order.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-17T00:00:00Z"),
        lte: new Date("2026-10-19T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  console.log(`Orders on Oct 17-19: ${orders.length}`);
  for (const o of orders) {
    console.log(`${o.id} | ${o.employee.firstName} ${o.employee.lastName} | ${o.createdAt.toISOString()}`);
  }
}

run().then(() => process.exit(0)).catch(console.error);
