import { PrismaClient } from "@prisma/client";
import { DEFAULT_CHART_OF_ACCOUNTS, SYSTEM_ACCOUNT_CODES } from "../lib/ledger";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default chart of accounts...");
  const systemCodes = new Set<string>(Object.values(SYSTEM_ACCOUNT_CODES));

  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: {},
      create: { ...acc, isSystem: systemCodes.has(acc.code) },
    });
  }

  console.log(`Seeded ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
