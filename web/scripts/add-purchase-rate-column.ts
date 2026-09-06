import { db } from "../lib/db";

async function main() {
  await db.$executeRawUnsafe('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseRate" DECIMAL(10, 2);');
  console.log('Successfully added purchaseRate column to Product table in PostgreSQL.');
}

main().finally(() => process.exit(0));
