const { runVpsSql } = require("./query_vps_recent");

const res = runVpsSql(`
  SELECT json_agg(t) FROM (
    SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text,
           COALESCE(d."fullName", c."name") as "customerName",
           v."purpose"
    FROM "Visit" v
    JOIN "Employee" e ON v."employeeId" = e."id"
    LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
    LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
    WHERE e."firstName" = 'Abdul' AND e."lastName" = 'Mubeen'
      AND v."createdAt"::text LIKE '2026-10-17%'
    ORDER BY v."createdAt" DESC
  ) t;
`);
console.log(res);
