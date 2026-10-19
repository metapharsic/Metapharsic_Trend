const { runVpsSql } = require("./query_vps_recent");

const res = runVpsSql(`
  SELECT json_agg(t) FROM (
    SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text,
           e."firstName" || ' ' || e."lastName" as "mrName",
           COALESCE(d."fullName", c."name") as "customerName",
           v."purpose"
    FROM "Visit" v
    JOIN "Employee" e ON v."employeeId" = e."id"
    LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
    LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
    WHERE v."createdAt" >= '2026-10-16 00:00:00'
    ORDER BY v."createdAt" DESC
  ) t;
`);
const visits = JSON.parse(res);
console.log(`Total visits from Oct 16 onwards: ${visits.length}`);
console.log(JSON.stringify(visits.slice(0, 35), null, 2));

const byDateMr = {};
for (const v of visits) {
  const d = v.createdAt.slice(0, 10);
  const k = `${d} | ${v.mrName}`;
  byDateMr[k] = (byDateMr[k] || 0) + 1;
}
console.log("\nVisits by Date and MR:", byDateMr);
