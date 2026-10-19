import { runVpsSqlViaFile, runVpsSql } from "./reconcile_and_sync_all_dates";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("================================================================================");
  console.log("  RESTORING ORIGINAL MR ORDERS & COLLECTIONS TO VPS POSTGRESQL                  ");
  console.log("================================================================================\n");

  const sqlFile = path.resolve(__dirname, "../../scratch/restore_orders_and_collections.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");

  console.log("1. Executing restore script on VPS via SSH...");
  const res = runVpsSqlViaFile(sql);
  console.log("VPS Execution Output:\n", res);

  console.log("\n2. Verifying Table Counts on VPS...");
  const vpsOrderCount = runVpsSql('SELECT count(*) FROM "Order";');
  const vpsOrderItemCount = runVpsSql('SELECT count(*) FROM "OrderItem";');
  const vpsInvoiceCount = runVpsSql('SELECT count(*) FROM "Invoice";');
  const vpsCollectionCount = runVpsSql('SELECT count(*) FROM "Collection";');
  const vpsLedgerTxCount = runVpsSql('SELECT count(*) FROM "LedgerTransaction";');
  const vpsLedgerEntryCount = runVpsSql('SELECT count(*) FROM "LedgerEntry";');

  console.log(`VPS Order Count:           ${vpsOrderCount} (Expected: 63)`);
  console.log(`VPS OrderItem Count:       ${vpsOrderItemCount} (Expected: 124)`);
  console.log(`VPS Invoice Count:         ${vpsInvoiceCount} (Expected: 63)`);
  console.log(`VPS Collection Count:      ${vpsCollectionCount} (Expected: 14)`);
  console.log(`VPS LedgerTransaction:     ${vpsLedgerTxCount} (Expected: 56)`);
  console.log(`VPS LedgerEntry Count:     ${vpsLedgerEntryCount} (Expected: 165)`);

  console.log("\n3. Verifying MR Orders on VPS...");
  const vpsMrOrdersSql = `
    SELECT coalesce(e."firstName" || ' ' || e."lastName", 'Unknown') as mr, 
           count(o."id") as order_count,
           coalesce(sum(oi."price" * oi."quantity"), 0) as total
    FROM "Order" o 
    LEFT JOIN "Employee" e ON o."employeeId" = e."id" 
    LEFT JOIN "OrderItem" oi ON o."id" = oi."orderId" 
    GROUP BY e."firstName", e."lastName" 
    ORDER BY mr ASC;
  `;
  console.log(runVpsSql(vpsMrOrdersSql));

  console.log("\n4. Verifying MR Collections on VPS...");
  const vpsMrCollsSql = `
    SELECT coalesce(e."firstName" || ' ' || e."lastName", 'Unknown') as mr, 
           count(c."id") as collection_count,
           coalesce(sum(c."amount"), 0) as total
    FROM "Collection" c 
    LEFT JOIN "Employee" e ON c."employeeId" = e."id" 
    GROUP BY e."firstName", e."lastName" 
    ORDER BY mr ASC;
  `;
  console.log(runVpsSql(vpsMrCollsSql));
}

main().catch(console.error);
