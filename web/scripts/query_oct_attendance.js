const { execSync } = require("child_process");

const PLINK_PATH = "C:\\Program Files\\PuTTY\\plink.exe";
const SSH_KEY_PATH = "C:\\Trend_MR\\vps_key.ppk";
const VPS_HOST = "root@187.127.169.217";
const VPS_DB_PASS = "TrendMr2026Secure";

function runVpsSql(sql) {
  const b64 = Buffer.from(sql).toString("base64");
  const cmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "echo ${b64} | base64 -d | PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -t -A"`;
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  console.log("=== OCT 2026 ATTENDANCE ===");
  const attRes = runVpsSql(`
    SELECT json_agg(t) FROM (
      SELECT a."id", a."date"::text, a."checkIn"::text, a."checkOut"::text, a."createdAt"::text, a."updatedAt"::text, e."firstName", e."lastName"
      FROM "Attendance" a
      JOIN "Employee" e ON a."employeeId" = e."id"
      WHERE a."date" >= '2026-10-01'
      ORDER BY a."date" DESC, a."checkIn" DESC
    ) t;
  `);
  console.log(JSON.stringify(JSON.parse(attRes), null, 2));
}

main().catch(console.error);
