import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting date reconciliation for visits and orders...");

  const cutoff = new Date("2026-10-19T23:59:59.999Z");
  const shiftMs = 12 * 24 * 60 * 60 * 1000; // 12 days back so Oct 31 -> Oct 19 (today)

  // 1. Reconcile visits
  const futureVisits = await prisma.visit.findMany({
    where: {
      createdAt: { gt: cutoff },
    },
    select: {
      id: true,
      createdAt: true,
      startedAt: true,
      endedAt: true,
      followUpDate: true,
    },
  });

  console.log(`Found ${futureVisits.length} visits with future dates (Oct 20 - Oct 31).`);

  let updatedVisits = 0;
  for (const v of futureVisits) {
    const newCreatedAt = new Date(v.createdAt.getTime() - shiftMs);
    const newStartedAt = v.startedAt ? new Date(v.startedAt.getTime() - shiftMs) : newCreatedAt;
    const newEndedAt = v.endedAt ? new Date(v.endedAt.getTime() - shiftMs) : null;
    const newFollowUp = v.followUpDate ? new Date(v.followUpDate.getTime() - shiftMs) : null;

    await prisma.visit.update({
      where: { id: v.id },
      data: {
        createdAt: newCreatedAt,
        startedAt: newStartedAt,
        endedAt: newEndedAt,
        followUpDate: newFollowUp,
      },
    });
    updatedVisits++;
  }
  console.log(`Successfully updated ${updatedVisits} visits to actual elapsed dates (up to Oct 19, 2026).`);

  // 2. Reconcile orders
  const futureOrders = await prisma.order.findMany({
    where: {
      createdAt: { gt: cutoff },
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`Found ${futureOrders.length} orders with future dates.`);

  let updatedOrders = 0;
  for (const o of futureOrders) {
    const newCreatedAt = new Date(o.createdAt.getTime() - shiftMs);
    await prisma.order.update({
      where: { id: o.id },
      data: {
        createdAt: newCreatedAt,
        updatedAt: newCreatedAt,
      },
    });
    updatedOrders++;
  }
  console.log(`Successfully updated ${updatedOrders} orders to actual dates.`);

  // Verify no future visits remain
  const remainingFutureVisits = await prisma.visit.count({
    where: { createdAt: { gt: cutoff } },
  });
  const remainingFutureOrders = await prisma.order.count({
    where: { createdAt: { gt: cutoff } },
  });

  console.log(`Verification: Remaining future visits: ${remainingFutureVisits}, Remaining future orders: ${remainingFutureOrders}`);

  // Fetch the top 5 latest visits now
  const topVisits = await prisma.visit.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      purpose: true,
      doctor: { select: { fullName: true } },
      chemist: { select: { name: true } },
    },
  });

  console.log("Top 5 latest visits now in database:");
  topVisits.forEach((tv, idx) => {
    const entity = tv.doctor?.fullName || tv.chemist?.name || "Entity";
    console.log(` ${idx + 1}. ${entity} -> ${tv.createdAt.toISOString()} (${tv.createdAt.toLocaleString("en-IN")})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
