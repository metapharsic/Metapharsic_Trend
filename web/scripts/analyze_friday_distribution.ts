import { db } from "../lib/db";

async function run() {
  const v = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-16T00:00:00Z"),
        lte: new Date("2026-10-16T23:59:59Z")
      }
    },
    include: { employee: true }
  });
  const counts: Record<string, number> = {};
  for (const x of v) {
    const name = x.employee.firstName + " " + x.employee.lastName;
    counts[name] = (counts[name] || 0) + 1;
  }
  console.log("Existing visits on Oct 16 per MR:", counts);

  const post16Visits = await db.visit.findMany({
    where: {
      createdAt: {
        gt: new Date("2026-10-16T23:59:59.999Z")
      }
    },
    include: { employee: true }
  });
  const postCounts: Record<string, number> = {};
  for (const x of post16Visits) {
    const name = x.employee.firstName + " " + x.employee.lastName;
    postCounts[name] = (postCounts[name] || 0) + 1;
  }
  console.log("Post-Oct 16 visits per MR (to be reconciled to Oct 16):", postCounts);
}

run().then(() => process.exit(0)).catch(console.error);
