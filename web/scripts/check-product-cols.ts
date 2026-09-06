import { db } from "../lib/db";

async function main() {
  const cols = await db.$queryRawUnsafe<any[]>(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Product'"
  );
  console.log("Product columns:", cols.map(c => c.column_name));
}

main().finally(() => process.exit(0));
