const { runVpsSql } = require("./query_vps_recent");

async function main() {
  console.log("=== EXACT VISITS SHOWN IN SCREENSHOT ===");
  const res = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT v."id", v."createdAt"::text, v."startedAt"::text, v."endedAt"::text,
             e."firstName" || ' ' || e."lastName" as "mrName",
             d."fullName" as "docName",
             c."name" as "chemName"
      FROM "Visit" v
      JOIN "Employee" e ON v."employeeId" = e."id"
      LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
      LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
      WHERE d."fullName" ILIKE '%Diya%' OR c."name" ILIKE '%Diya%'
         OR d."fullName" ILIKE '%Health point%' OR c."name" ILIKE '%Health point%'
         OR d."fullName" ILIKE '%Divya%' OR c."name" ILIKE '%Divya%'
         OR d."fullName" ILIKE '%Ikram%' OR c."name" ILIKE '%Ikram%'
      ORDER BY v."createdAt" DESC
      LIMIT 10
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(res), null, 2));
}

main().catch(console.error);
