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
    WHERE v."createdAt"::text LIKE '2026-10-16%'
    ORDER BY v."createdAt" DESC
  ) t;
`);
const visits = JSON.parse(res);
console.log(`Total visits on Friday Oct 16: ${visits.length}`);
console.log(JSON.stringify(visits, null, 2));
