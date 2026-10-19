import { db } from "../lib/db";

async function run() {
  const visits = await db.visit.findMany({
    where: {
      OR: [
        { doctor: { fullName: { in: ["Diya polyclinic", "Dr.G.Divya", "Dr Ikram ansari"] } } },
        { chemist: { name: { in: ["Health point", "Diya polyclinic"] } } }
      ]
    },
    include: {
      doctor: true,
      chemist: true,
      employee: true
    },
    orderBy: { createdAt: "desc" }
  });

  console.log(`Found ${visits.length} matching visits:`);
  for (const v of visits) {
    const target = v.doctor?.fullName || v.chemist?.name;
    console.log(
      `${v.id} | ${target} | MR: ${v.employee.firstName} ${v.employee.lastName} | createdAt: ${v.createdAt.toISOString()} | local: ${new Date(v.createdAt).toLocaleString("en-IN")}`
    );
  }
}

run().then(() => process.exit(0)).catch(console.error);
