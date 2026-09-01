import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      stockQty: true,
      _count: {
        select: {
          orderItems: true,
          claims: true,
          samples: true,
          sampleInventories: true,
          formularyEntries: true,
          prescriptionHistories: true,
          discountSchemes: true,
          movements: true,
        },
      },
    },
  });
  console.log("--- PRODUCTION PRODUCTS & COUNTS ---");
  for (const p of products) {
    console.log(
      `${p.name} (${p.sku}) [ID: ${p.id}]: orders=${p._count.orderItems}, claims=${p._count.claims}, samples=${p._count.samples}, sampleInv=${p._count.sampleInventories}, formulary=${p._count.formularyEntries}, presHist=${p._count.prescriptionHistories}, schemes=${p._count.discountSchemes}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
