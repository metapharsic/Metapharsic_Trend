import { db } from "../lib/db";
import { runVpsSql } from "./reconcile_and_sync_all_dates";

async function main() {
  console.log("=== TOUR PLAN DAYS (OCT 16 & OCT 19) ON LOCAL ===");
  const localTpd = await db.tourPlanDay.findMany({
    where: {
      date: {
        in: [new Date("2026-10-16T00:00:00Z"), new Date("2026-10-19T00:00:00Z")]
      }
    },
    include: { tourPlan: { include: { employee: true } } }
  });
  for (const t of localTpd) {
    console.log(`Local: ${t.date.toISOString().slice(0, 10)} | ${t.tourPlan.employee.firstName} ${t.tourPlan.employee.lastName} | completed: ${t.isCompleted} | status: ${t.visitStatus}`);
  }

  console.log("\n=== TOUR PLAN DAYS (OCT 16 & OCT 19) ON VPS ===");
  const vpsTpdSql = `
    SELECT tpd."date"::text, e."firstName" || ' ' || e."lastName" as mr, tpd."isCompleted"::text, tpd."visitStatus"
    FROM "TourPlanDay" tpd
    JOIN "TourPlan" tp ON tpd."tourPlanId" = tp."id"
    JOIN "Employee" e ON tp."employeeId" = e."id"
    WHERE tpd."date" = '2026-10-16' OR tpd."date" = '2026-10-19'
    ORDER BY tpd."date", mr;
  `;
  console.log(runVpsSql(vpsTpdSql));
}

main().then(() => process.exit(0)).catch(console.error);
