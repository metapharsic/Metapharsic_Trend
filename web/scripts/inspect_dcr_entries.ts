import { db } from "../lib/db";

async function main() {
  const dcrs = await db.dcrEntry.findMany({
    where: {
      date: {
        gte: new Date("2026-10-15T00:00:00Z"),
        lte: new Date("2026-10-20T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  console.log("DCR entries count (Oct 15-20):", dcrs.length);
  for (const d of dcrs) {
    console.log(`${d.date.toISOString().slice(0, 10)} | ${d.employee.firstName} ${d.employee.lastName} | status: ${d.status}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
