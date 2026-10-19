const { execSync } = require("child_process");
const PLINK = "C:\\Program Files\\PuTTY\\plink.exe";
const KEY = "C:\\Trend_MR\\vps_key.ppk";
const HOST = "root@187.127.169.217";

function runRemote(sh) {
  const b64 = Buffer.from(sh).toString("base64");
  const cmd = `"${PLINK}" -batch -i "${KEY}" ${HOST} "echo ${b64} | base64 -d | bash"`;
  return execSync(cmd, { encoding: "utf8" });
}

console.log("=== PM2 LOGS FOR LOGOUT / ATTENDANCE / MR ===");
try {
  console.log(runRemote("grep -i -E 'logout|check-out|attendance|visit' /root/.pm2/logs/* | tail -n 40"));
} catch (e) {
  console.log(e.message);
}

console.log("=== OCT 16 LOGOUT OR CHECKOUT ===");
try {
  console.log(runRemote("zgrep -i -E 'logout|checkout|check-out' /var/log/nginx/* 2>/dev/null | grep '16/Oct/2026'"));
} catch (e) {
  console.log(e.message);
}

console.log("=== ALL POST REQUESTS FROM 106.77.163.61 ON OCT 16 ===");
try {
  console.log(runRemote("zgrep -i '106.77.163.61' /var/log/nginx/* 2>/dev/null | grep 'POST'"));
} catch (e) {
  console.log(e.message);
}
