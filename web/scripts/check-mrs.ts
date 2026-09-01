import { db } from "../lib/db";

async function main() {
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR" } },
    include: {
      user: true,
      territories: true,
      manager: true,
      visits: {
        include: {
          doctor: true,
          chemist: true,
        },
      },
      orders: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      expenses: true,
      tourPlans: true,
      attendances: true,
      collections: true,
      claims: true,
      sampleInventories: {
        include: {
          product: true,
        },
      },
    },
  });

  console.log(`Found ${mrs.length} MRs:`);
  for (const mr of mrs) {
    console.log(`- MR: ${mr.firstName} ${mr.lastName} (${mr.user.email}) | ID: ${mr.id} | Territories: ${mr.territories.map(t => t.name).join(", ") || "None"}`);
    console.log(`  Visits: ${mr.visits.length} | Orders: ${mr.orders.length} | Expenses: ${mr.expenses.length} | TourPlans: ${mr.tourPlans.length}`);
  }
}

main()
  .catch((e) => {
    console.error("DB Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
