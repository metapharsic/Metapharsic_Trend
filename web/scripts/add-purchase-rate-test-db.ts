import { PrismaClient } from "@prisma/client";

const testDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5432/trend_mr_test?schema=public",
    },
  },
});

async function main() {
  await testDb.$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseRate" DECIMAL(10, 2);');
  console.log("Successfully added purchaseRate to trend_mr_test database.");
}

main().finally(() => testDb.$disconnect());
