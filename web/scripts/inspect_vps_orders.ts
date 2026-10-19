import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  const vpsOrdersSql = `
    SELECT json_agg(t) FROM (
      SELECT o."id", o."createdAt"::text, o."totalAmount",
             e."firstName" || ' ' || e."lastName" as mr,
             coalesce(c."name", 'Unknown') as chemist
      FROM "Order" o
      JOIN "Employee" e ON o."employeeId" = e."id"
      LEFT JOIN "Chemist" c ON o."chemistId" = c."id"
      ORDER BY o."createdAt" DESC
      LIMIT 10
    ) t;
  `;
  const vpsOrders = JSON.parse(runVpsSql(vpsOrdersSql));
  console.log("Top 10 VPS Orders:");
  for (const o of vpsOrders) {
    const local = await db.order.findUnique({ where: { id: o.id } });
    console.log(`${local ? '✔ LOCAL' : '❌ MISSING'} | ${o.id} | ${o.orderNumber} | ${o.createdAt} | ${o.mr} | ${o.chemist} | ₹${o.totalAmount}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
