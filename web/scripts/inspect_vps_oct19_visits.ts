import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== INSPECTING OCT 19 VISITS ON VPS ===");
  const vpsVisitsSql = `
    SELECT json_agg(t) FROM (
      SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text,
             e."firstName" || ' ' || e."lastName" as mr,
             coalesce(d."fullName", c."name") as target,
             v."purpose", v."latitude", v."longitude"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
      LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
      WHERE v."createdAt" >= '2026-10-19 00:00:00' AND v."createdAt" <= '2026-10-19 23:59:59'
      ORDER BY v."createdAt" ASC
    ) t;
  `;
  const vpsVisits = JSON.parse(runVpsSql(vpsVisitsSql));
  console.log(`Total VPS visits on Oct 19: ${vpsVisits.length}`);

  const localVisits = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-19T00:00:00Z"),
        lte: new Date("2026-10-19T23:59:59Z")
      }
    },
    select: { id: true }
  });
  const localSet = new Set(localVisits.map(v => v.id));

  console.log("\nVisits on VPS on Oct 19:");
  let inLocalCount = 0;
  let missingFromLocalCount = 0;
  for (const v of vpsVisits) {
    const inLocal = localSet.has(v.id);
    if (inLocal) inLocalCount++;
    else missingFromLocalCount++;
    console.log(`${inLocal ? '✔ LOCAL' : '❌ MISSING'} | ${v.id} | ${v.createdAt} | ${v.mr.padEnd(25)} | ${v.target}`);
  }
  console.log(`\nIn Local: ${inLocalCount}, Missing from Local: ${missingFromLocalCount}`);
}

main().then(() => process.exit(0)).catch(console.error);
