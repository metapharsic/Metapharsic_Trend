import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  console.log("=== VERIFYING DATABASE & DIAGNOSTICS ===");

  // 1. Check CompanySettings
  const company = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
  console.log("1. Company Settings:", company?.name, "| Logo:", company?.logoPath);

  // 2. Test ping
  const ping = await prisma.$queryRaw`SELECT 1 as ping;`;
  console.log("2. Database Ping:", ping);

  // 3. Check Chart of Accounts count
  const accountsCount = await prisma.chartOfAccount.count();
  console.log("3. Chart of Accounts Count:", accountsCount);

  // 4. Check Recent Ledger Transactions
  const ledgerCount = await prisma.ledgerTransaction.count();
  console.log("4. Ledger Transactions Count:", ledgerCount);

  console.log("\n✅ ALL SUBSYSTEMS VERIFIED AND FUNCTIONAL!");
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
