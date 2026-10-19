import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== COMPARING LOCAL VS VPS VISITS FOR OCT 16, 17, 18, 19, 20 ===");

  // Local visits by date
  const localVisits = await db.visit.findMany({
    where: {
      createdAt: { gte: new Date("2026-10-15T00:00:00Z") }
    },
    select: {
      id: true,
      createdAt: true,
      employee: { select: { firstName: true, lastName: true } },
      doctor: { select: { fullName: true } },
      chemist: { select: { name: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  const localByDate: Record<string, number> = {};
  for (const v of localVisits) {
    const d = v.createdAt.toISOString().slice(0, 10);
    localByDate[d] = (localByDate[d] || 0) + 1;
  }
  console.log("Local visits count per day:", localByDate);

  // VPS visits by date
  const vpsSql = `
    SELECT substring(v."createdAt"::text from 1 for 10) as day, count(*)
    FROM "Visit" v
    WHERE v."createdAt" >= '2026-10-15'
    GROUP BY day
    ORDER BY day;
  `;
  const vpsRes = runVpsSql(vpsSql);
  console.log("VPS visits count per day:\n", vpsRes);

  // Check top 10 recent local vs VPS
  console.log("\n--- Top 5 Local Visits ---");
  for (const v of localVisits.slice(-5)) {
    const target = v.doctor?.fullName || v.chemist?.name;
    console.log(`Local: ${v.id} | ${v.createdAt.toISOString()} | ${v.employee.firstName} ${v.employee.lastName} | ${target}`);
  }

  const vpsRecentSql = `
    SELECT v."id", v."createdAt"::text, e."firstName" || ' ' || e."lastName" as mr, coalesce(d."fullName", c."name") as target
    FROM "Visit" v
    JOIN "Employee" e ON v."employeeId" = e."id"
    LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
    LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
    ORDER BY v."createdAt" DESC
    LIMIT 5;
  `;
  console.log("\n--- Top 5 VPS Visits ---");
  console.log(runVpsSql(vpsRecentSql));
}

main().then(() => process.exit(0)).catch(console.error);
