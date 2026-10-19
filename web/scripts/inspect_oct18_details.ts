import { db } from "../lib/db";

async function main() {
  const oct18 = await db.visit.findMany({
    where: {
      createdAt: {
        gte: new Date("2026-10-18T00:00:00Z"),
        lte: new Date("2026-10-18T23:59:59Z")
      }
    },
    include: { employee: true, doctor: true, chemist: true }
  });
  console.log("Oct 18 visits count:", oct18.length);
  for (const v of oct18) {
    const target = v.doctor?.fullName || v.chemist?.name;
    console.log(`${v.id} | ${v.createdAt.toISOString()} | ${v.employee.firstName} ${v.employee.lastName} | ${target} | remarks: ${v.remarks}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
