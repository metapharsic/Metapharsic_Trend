import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const doctors = await prisma.doctor.findMany({
    select: { id: true, fullName: true, clinicAddress: true, subArea: true, beatName: true, territory: { select: { id: true, name: true } } },
  });

  const chemists = await prisma.chemist.findMany({
    select: { id: true, name: true, address: true, subArea: true, beatName: true, territory: { select: { id: true, name: true } } },
  });

  console.log(`Total Doctors: ${doctors.length}, Total Chemists: ${chemists.length}`);

  const docAddresses = new Map<string, number>();
  doctors.forEach((d) => {
    const addr = (d.clinicAddress || "").trim();
    docAddresses.set(addr, (docAddresses.get(addr) || 0) + 1);
  });

  const chemAddresses = new Map<string, number>();
  chemists.forEach((c) => {
    const addr = (c.address || "").trim();
    chemAddresses.set(addr, (chemAddresses.get(addr) || 0) + 1);
  });

  console.log(`Distinct Doctor Addresses: ${docAddresses.size}`);
  console.log(`Distinct Chemist Addresses: ${chemAddresses.size}`);

  console.log("\nTop 40 Doctor Addresses:");
  Array.from(docAddresses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([addr, count]) => {
      console.log(`  [${count.toString().padStart(3)}] "${addr}"`);
    });

  console.log("\nTop 40 Chemist Addresses:");
  Array.from(chemAddresses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([addr, count]) => {
      console.log(`  [${count.toString().padStart(3)}] "${addr}"`);
    });
}

run().catch(console.error).finally(() => prisma.$disconnect());
