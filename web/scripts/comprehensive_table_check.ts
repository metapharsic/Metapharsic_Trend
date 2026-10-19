import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  const tables = [
    "User", "Employee", "Territory", "Doctor", "Chemist", "Hospital",
    "Product", "Visit", "Order", "OrderItem", "Sample", "DcrEntry",
    "TourPlan", "TourPlanDay", "Attendance", "RefreshToken", "ExpenseClaim",
    "Collection", "LocationLog", "Notification"
  ];

  console.log("=== COMPREHENSIVE PARITY CHECK (VPS vs LOCAL) ===");
  for (const tbl of tables) {
    try {
      const vpsCountStr = runVpsSql(`SELECT count(*) FROM "${tbl}";`);
      const vpsCount = Number(vpsCountStr);

      const modelKey = tbl.charAt(0).toLowerCase() + tbl.slice(1);
      const localModel = (db as any)[modelKey];
      if (!localModel) {
        console.log(`${tbl.padEnd(16)} | Local model not found | VPS: ${vpsCount}`);
        continue;
      }
      const localCount = await localModel.count();

      const diff = vpsCount - localCount;
      const status = diff === 0 ? "✔ PARITY" : `❌ MISMATCH (VPS has ${diff > 0 ? '+' : ''}${diff})`;
      console.log(`${tbl.padEnd(16)} | Local: ${String(localCount).padEnd(6)} | VPS: ${String(vpsCount).padEnd(6)} | ${status}`);
    } catch (e: any) {
      console.log(`${tbl.padEnd(16)} | Error: ${e.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
