import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const territories = await prisma.territory.findMany({
    include: { employee: true },
  });
  console.log("=== TERRITORIES IN DB ===");
  territories.forEach((t) => {
    console.log(
      `${t.id} | ${t.name} | Region: ${t.region} | Zone: ${t.zone} | MR: ${
        t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : "UNASSIGNED"
      }`
    );
  });

  const mrs = await prisma.employee.findMany({
    where: { user: { role: "MR" } },
    include: {
      territories: true,
      visits: {
        include: {
          doctor: {
            select: {
              fullName: true,
              subArea: true,
              beatName: true,
              clinicAddress: true,
              territory: { select: { name: true } },
            },
          },
          chemist: {
            select: {
              name: true,
              subArea: true,
              beatName: true,
              address: true,
              territory: { select: { name: true } },
            },
          },
          hospital: {
            select: {
              name: true,
              address: true,
              territory: { select: { name: true } },
            },
          },
        },
      },
      orders: {
        include: {
          chemist: { select: { name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
          doctor: { select: { fullName: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
        },
      },
      collections: {
        include: {
          chemist: { select: { name: true, subArea: true, beatName: true, territory: { select: { name: true } } } },
        },
      },
      tourPlans: {
        include: {
          days: {
            include: {
              territory: { select: { name: true } },
              plannedDoctor: { select: { fullName: true, subArea: true, beatName: true } },
            },
          },
        },
      },
    },
  });

  console.log("\n=== MR VISITS & ACTIVITIES AUDIT ===");
  for (const mr of mrs) {
    const visitedSubAreas = new Set<string>();
    const visitedBeats = new Set<string>();
    const visitedTerritories = new Set<string>();
    let docCount = 0;
    let chemCount = 0;
    let hospCount = 0;
    let unlinkedCount = 0;

    mr.visits.forEach((v) => {
      if (v.doctor) {
        docCount++;
        if (v.doctor.subArea) visitedSubAreas.add(v.doctor.subArea);
        if (v.doctor.beatName) visitedBeats.add(v.doctor.beatName);
        if (v.doctor.territory?.name) visitedTerritories.add(v.doctor.territory.name);
      } else if (v.chemist) {
        chemCount++;
        if (v.chemist.subArea) visitedSubAreas.add(v.chemist.subArea);
        if (v.chemist.beatName) visitedBeats.add(v.chemist.beatName);
        if (v.chemist.territory?.name) visitedTerritories.add(v.chemist.territory.name);
      } else if (v.hospital) {
        hospCount++;
        if (v.hospital.territory?.name) visitedTerritories.add(v.hospital.territory.name);
      } else {
        unlinkedCount++;
      }
    });

    // Orders areas
    const orderSubAreas = new Set<string>();
    mr.orders.forEach((o) => {
      if (o.chemist?.subArea) orderSubAreas.add(o.chemist.subArea);
      if (o.doctor?.subArea) orderSubAreas.add(o.doctor.subArea);
    });

    // Collections areas
    const collectionSubAreas = new Set<string>();
    mr.collections.forEach((c) => {
      if (c.chemist?.subArea) collectionSubAreas.add(c.chemist.subArea);
    });

    console.log(`\n--------------------------------------------------`);
    console.log(`MR: ${mr.firstName} ${mr.lastName} (${mr.id})`);
    console.log(`Assigned Territories: ${mr.territories.map((t) => t.name).join(", ") || "None"}`);
    console.log(
      `Visits (${mr.visits.length}): Docs: ${docCount}, Chemists: ${chemCount}, Hospital: ${hospCount}, Unlinked: ${unlinkedCount}`
    );
    console.log(`Visited Territories:`, Array.from(visitedTerritories));
    console.log(`Visited Beats:`, Array.from(visitedBeats));
    console.log(`Visited SubAreas (${visitedSubAreas.size}):`, Array.from(visitedSubAreas));
    console.log(`Orders (${mr.orders.length}) SubAreas:`, Array.from(orderSubAreas));
    console.log(`Collections (${mr.collections.length}) SubAreas:`, Array.from(collectionSubAreas));
    console.log(`TourPlans (${mr.tourPlans.length}): Days total: ${mr.tourPlans.reduce((acc, tp) => acc + tp.days.length, 0)}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
