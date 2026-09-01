import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {
      name: "Metapharsic Lifesciences",
      logoPath: "logo.png",
    },
    create: {
      id: "singleton",
      name: "Metapharsic Lifesciences",
      address: "Headquarters, Industrial Area, Hyderabad",
      phone: "+91 99999 99999",
      logoPath: "logo.png",
    },
  });

  console.log("✅ Company Settings Updated:", updated);
}

main()
  .catch((e) => {
    console.error("❌ Failed to update Company Settings:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
