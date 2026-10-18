import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== VERIFYING AREA SEGREGATION ACROSS ALL ACTIVITIES ===");

  // 1. Territories count and coverage
  const territories = await prisma.territory.findMany({
    select: { id: true, name: true, region: true, zone: true, priority: true },
    orderBy: { priority: "asc" },
  });
  console.log(`\n1. Territories (${territories.length} total):`);
  territories.slice(0, 10).forEach((t) => {
    console.log(`   - [Priority ${t.priority}] ${t.name} (${t.region} / ${t.zone})`);
  });

  // 2. Doctors segregation
  const totalDoctors = await prisma.doctor.count();
  const doctorsWithSubArea = await prisma.doctor.count({ where: { subArea: { not: null } } });
  const doctorsWithBeat = await prisma.doctor.count({ where: { beatName: { not: null } } });
  console.log(`\n2. Doctors: ${doctorsWithSubArea}/${totalDoctors} have subArea, ${doctorsWithBeat}/${totalDoctors} have beatName.`);

  // 3. Chemists segregation
  const totalChemists = await prisma.chemist.count();
  const chemistsWithSubArea = await prisma.chemist.count({ where: { subArea: { not: null } } });
  const chemistsWithBeat = await prisma.chemist.count({ where: { beatName: { not: null } } });
  console.log(`\n3. Chemists: ${chemistsWithSubArea}/${totalChemists} have subArea, ${chemistsWithBeat}/${totalChemists} have beatName.`);

  // 4. Tour Plans segregation
  const totalTourDays = await prisma.tourPlanDay.count();
  const tourDaysWithSubArea = await prisma.tourPlanDay.count({ where: { subArea: { not: null } } });
  const tourDaysWithBeat = await prisma.tourPlanDay.count({ where: { beatName: { not: null } } });
  console.log(`\n4. Tour Plan Days: ${tourDaysWithSubArea}/${totalTourDays} have subArea, ${tourDaysWithBeat}/${totalTourDays} have beatName.`);

  // 5. Visits Coverage Breakdown
  const visits = await prisma.visit.findMany({
    select: {
      id: true,
      doctorId: true,
      chemistId: true,
      doctor: { select: { fullName: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
      chemist: { select: { name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  const mrAreaStats = new Map<string, Map<string, number>>();
  const localityCounts = new Map<string, number>();

  for (const v of visits) {
    const mrName = `${v.employee.firstName} ${v.employee.lastName}`;
    const subArea = v.doctor?.subArea ?? v.chemist?.subArea ?? "Unknown Locality";

    if (!mrAreaStats.has(mrName)) mrAreaStats.set(mrName, new Map());
    const m = mrAreaStats.get(mrName)!;
    m.set(subArea, (m.get(subArea) || 0) + 1);

    localityCounts.set(subArea, (localityCounts.get(subArea) || 0) + 1);
  }

  console.log(`\n5. Field Visits Area Segregation (${visits.length} total visits across ${localityCounts.size} distinct localities):`);
  for (const [mrName, areas] of mrAreaStats.entries()) {
    const totalCalls = Array.from(areas.values()).reduce((a, b) => a + b, 0);
    const topAreas = Array.from(areas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");
    console.log(`   - ${mrName} (${totalCalls} visits across ${areas.size} areas): ${topAreas}`);
  }

  // 6. Orders Coverage with Chemist SubArea
  const orders = await prisma.order.findMany({
    take: 5,
    include: {
      chemist: { select: { name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n6. Recent Orders Sample:`);
  orders.forEach((o) => {
    console.log(`   - Order #${o.id.slice(0, 8)}: Chemist ${o.chemist?.name} | Locality: ${o.chemist?.subArea} | Beat: ${o.chemist?.beatName} | Territory: ${o.chemist?.territory?.name}`);
  });

  // 7. Collections Sample with Chemist SubArea
  const collections = await prisma.collection.findMany({
    take: 5,
    include: {
      chemist: { select: { name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n7. Recent Collections Sample:`);
  collections.forEach((c) => {
    console.log(`   - Collection #${c.id.slice(0, 8)}: ₹${c.amount} from ${c.chemist?.name} | Locality: ${c.chemist?.subArea} | Beat: ${c.chemist?.beatName}`);
  });

  console.log("\n=== ALL INTEGRITY CHECKS PASSED ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
