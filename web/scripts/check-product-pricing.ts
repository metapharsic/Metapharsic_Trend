import { db } from "../lib/db";

async function main() {
  const products = await db.product.findMany({
    select: { id: true, name: true, sku: true, mrp: true, ptr: true, pts: true, marginStructure: true }
  });
  console.log("Current Products:", products);
}

main().finally(() => process.exit(0));
