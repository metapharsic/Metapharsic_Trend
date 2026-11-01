import { db } from "../lib/db";
import { CreditAgentsService } from "../services/credit-agents.service";

async function main() {
  const chemists = await db.chemist.findMany({ select: { id: true, name: true } });
  let totalUpdated = 0;
  for (const c of chemists) {
    const res = await CreditAgentsService.reconcileChemistInvoicePaidStatus(db, c.id);
    if (res.updatedCount > 0) {
      console.log(`Reconciled ${c.name}: updated ${res.updatedCount} invoices`);
      totalUpdated += res.updatedCount;
    }
  }
  console.log(`Finished reconciliation across all chemists. Total invoices updated: ${totalUpdated}`);

  const paidCount = await db.invoice.count({ where: { paid: true } });
  const unpaidCount = await db.invoice.count({ where: { paid: false } });
  console.log({ paidCount, unpaidCount, total: paidCount + unpaidCount });

  process.exit(0);
}

main().catch(console.error);
