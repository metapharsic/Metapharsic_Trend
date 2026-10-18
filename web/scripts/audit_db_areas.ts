import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const docCount = await prisma.doctor.count();
  const chemCount = await prisma.chemist.count();
  const docsWithSubArea = await prisma.doctor.count({ where: { subArea: { not: null } } });
  const chemsWithSubArea = await prisma.chemist.count({ where: { subArea: { not: null } } });
  const docsWithBeat = await prisma.doctor.count({ where: { beatName: { not: null } } });
  const chemsWithBeat = await prisma.chemist.count({ where: { beatName: { not: null } } });

  console.log("DOCTOR & CHEMIST AREA STATS:", {
    docCount,
    chemCount,
    docsWithSubArea,
    chemsWithSubArea,
    docsWithBeat,
    chemsWithBeat,
  });

  const sampleDocs = await prisma.doctor.findMany({
    take: 10,
    select: { fullName: true, clinicAddress: true, subArea: true, beatName: true, territory: { select: { name: true } } },
  });
  console.log("Sample Docs:", JSON.stringify(sampleDocs, null, 2));

  const sampleChems = await prisma.chemist.findMany({
    take: 10,
    select: { name: true, address: true, subArea: true, beatName: true, territory: { select: { name: true } } },
  });
  console.log("Sample Chems:", JSON.stringify(sampleChems, null, 2));

  // Check TourPlanDay subArea and beatName
  const tourDaysWithArea = await prisma.tourPlanDay.count({
    where: { OR: [{ subArea: { not: null } }, { beatName: { not: null } }] },
  });
  const totalTourDays = await prisma.tourPlanDay.count();
  console.log({ totalTourDays, tourDaysWithArea });

  const sampleTourDays = await prisma.tourPlanDay.findMany({
    take: 5,
    select: {
      date: true,
      subArea: true,
      beatName: true,
      territory: { select: { name: true } },
      plannedDoctor: { select: { fullName: true } },
    },
  });
  console.log("Sample Tour Days:", JSON.stringify(sampleTourDays, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
