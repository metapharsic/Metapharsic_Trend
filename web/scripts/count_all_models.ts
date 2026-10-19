import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  const models = [
    "User", "Employee", "Territory", "Doctor", "Chemist", "Hospital",
    "Product", "Visit", "Order", "OrderItem", "Sample", "DcrEntry",
    "TourPlan", "TourPlanDay", "Attendance", "RefreshToken", "ExpenseClaim"
  ];

  console.log("=== TABLE ROW COUNTS: LOCAL vs VPS ===");
  for (const m of models) {
    const localCount = await (db as any)[m.charAt(0).toLowerCase() + m.slice(1)].count();
    const vpsCount = runVpsSql(`SELECT count(*) FROM "${m}";`);
    const diff = Number(vpsCount) - localCount;
    const flag = diff !== 0 ? `❌ MISMATCH (diff: ${diff > 0 ? '+' : ''}${diff})` : "✔ MATCH";
    console.log(`${m.padEnd(16)} | Local: ${String(localCount).padEnd(6)} | VPS: ${String(vpsCount).padEnd(6)} | ${flag}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
