const { runVpsSql } = require("./query_vps_recent");

const res = runVpsSql(`
  SELECT json_agg(t) FROM (
    SELECT v."id", v."createdAt"::text, v."purpose", d."fullName", c."name"
    FROM "Visit" v
    LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
    LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
    WHERE v."id" = '28196736-80c4-48ec-aed7-802dcc67757d'
  ) t;
`);
console.log(res);
