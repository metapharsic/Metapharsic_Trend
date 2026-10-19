const { runVpsSql } = require("./query_vps_recent");

async function main() {
  console.log("=== ALL FRIDAY ATTENDANCES (EXTRACT DOW = 5) ===");
  const res = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT a."id", a."date"::text, a."checkIn"::text, a."checkOut"::text,
             EXTRACT(DOW FROM a."date") as "dow",
             e."firstName" || ' ' || e."lastName" as "mrName"
      FROM "Attendance" a
      JOIN "Employee" e ON a."employeeId" = e."id"
      WHERE EXTRACT(DOW FROM a."date") = 5
      ORDER BY a."date" DESC
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(res), null, 2));

  console.log("=== ALL FRIDAY VISITS (EXTRACT DOW = 5) IN OCT 2026 ===");
  const vres = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text,
             e."firstName" || ' ' || e."lastName" as "mrName"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      WHERE EXTRACT(DOW FROM v."createdAt") = 5 AND v."createdAt" >= '2026-10-01'
      ORDER BY v."createdAt" DESC
      LIMIT 20
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(vres), null, 2));
}

main().catch(console.error);
