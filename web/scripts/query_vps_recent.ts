const { runVpsSql } = require("./reconcile_and_sync_all_dates");

async function main() {
  console.log("=== VPS RECENT ATTENDANCE ===");
  const attRes = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT a."id", a."date"::text, a."checkIn"::text, a."checkOut"::text, a."createdAt"::text, a."updatedAt"::text, e."firstName", e."lastName"
      FROM "Attendance" a
      JOIN "Employee" e ON a."employeeId" = e."id"
      ORDER BY a."createdAt" DESC
      LIMIT 25
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(attRes), null, 2));

  console.log("=== VPS RECENT VISITS ===");
  const visitRes = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text, e."firstName", e."lastName"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      ORDER BY v."createdAt" DESC
      LIMIT 20
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(visitRes), null, 2));
}

main().catch(console.error);
