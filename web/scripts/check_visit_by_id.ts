import { db } from "../lib/db";

async function main() {
  const ids = [
    "b54e8e36-3f93-403e-944b-f6016e25b0cb",
    "98aa36b2-0793-459b-8131-2fccad1866c1",
    "88ecda38-41d8-4afe-97b5-2e1f04187581",
    "9bb02208-fd41-436f-9aac-2b1e58e115bb",
    "46a841eb-2de4-481f-92b8-52efbbcc3cdb",
  ];
  const found = await db.visit.findMany({
    where: { id: { in: ids } },
    select: { id: true, createdAt: true }
  });
  console.log("Found in local:", found);
}

main().then(() => process.exit(0)).catch(console.error);
