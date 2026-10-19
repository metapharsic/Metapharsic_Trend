import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  const vpsFutureVisits = runVpsSql(`SELECT count(*) FROM "Visit" WHERE "createdAt" > '2026-10-19 23:59:59';`);
  const vpsFutureOrders = runVpsSql(`SELECT count(*) FROM "Order" WHERE "createdAt" > '2026-10-19 23:59:59';`);
  const vpsVisitsByDay = runVpsSql(`
    SELECT substring("createdAt"::text from 1 for 10) as d, count(*)
    FROM "Visit"
    WHERE "createdAt" >= '2026-10-14'
    GROUP BY d
    ORDER BY d;
  `);

  console.log("Future visits on VPS (> 2026-10-19):", vpsFutureVisits);
  console.log("Future orders on VPS (> 2026-10-19):", vpsFutureOrders);
  console.log("VPS visits by day (>= Oct 14):\n", vpsVisitsByDay);
}

main().then(() => process.exit(0)).catch(console.error);
