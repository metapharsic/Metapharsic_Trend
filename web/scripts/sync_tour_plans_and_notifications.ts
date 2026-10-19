import { PrismaClient } from "@prisma/client";
import { runVpsSql, runVpsSqlViaFile } from "./reconcile_and_sync_all_dates";

const localDb = new PrismaClient();

async function main() {
  console.log("=================================================================");
  console.log("     SYNCHRONIZING TOUR PLANS, TOUR PLAN DAYS & NOTIFICATIONS    ");
  console.log("=================================================================\n");

  // 1. Sync TourPlans
  console.log("1. Synchronizing TourPlan table...");
  const localPlans = await localDb.tourPlan.findMany();
  const vpsPlansRaw = runVpsSql(`SELECT json_agg(t) FROM "TourPlan" t;`);
  const vpsPlans: any[] = JSON.parse(vpsPlansRaw) || [];

  const localPlanIds = new Set(localPlans.map(p => p.id));
  const vpsPlanIds = new Set(vpsPlans.map(p => p.id));

  // Push missing local plans to VPS
  const missingInVpsPlans = localPlans.filter(p => !vpsPlanIds.has(p.id));
  if (missingInVpsPlans.length > 0) {
    console.log(`Pushing ${missingInVpsPlans.length} TourPlans to VPS...`);
    const insertSql = `
      INSERT INTO "TourPlan" ("id", "employeeId", "month", "status", "createdAt", "updatedAt")
      VALUES ${missingInVpsPlans.map(p => `('${p.id}', '${p.employeeId}', '${p.month.toISOString()}'::timestamp, '${p.status}', '${p.createdAt.toISOString()}'::timestamp, '${p.updatedAt.toISOString()}'::timestamp)`).join(", ")}
      ON CONFLICT ("id") DO NOTHING;
    `;
    const res = runVpsSqlViaFile(insertSql);
    console.log("VPS TourPlan insert result:", res);
  }

  // Push missing VPS plans to Local
  const missingInLocalPlans = vpsPlans.filter(p => !localPlanIds.has(p.id));
  if (missingInLocalPlans.length > 0) {
    console.log(`Pulling ${missingInLocalPlans.length} TourPlans to Local...`);
    for (const p of missingInLocalPlans) {
      await localDb.tourPlan.create({
        data: {
          id: p.id,
          employeeId: p.employeeId,
          month: new Date(p.month),
          status: p.status,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }
      });
    }
  }

  // Update statuses to match APPROVED
  const updateStatusSql = `
    UPDATE "TourPlan"
    SET "status" = 'APPROVED'
    WHERE "id" IN ('2bf1d9b9-0e24-44e2-96b0-e69126ec81d5', 'e949d21c-f6b6-4018-bdc8-5e0f53d9b643');
  `;
  runVpsSql(updateStatusSql);

  // 2. Sync TourPlanDay
  console.log("\n2. Synchronizing TourPlanDay table...");
  const localDays = await localDb.tourPlanDay.findMany();
  const vpsDaysRaw = runVpsSql(`SELECT json_agg(t) FROM "TourPlanDay" t;`);
  const vpsDays: any[] = JSON.parse(vpsDaysRaw) || [];

  const localDayIds = new Set(localDays.map(d => d.id));
  const vpsDayIds = new Set(vpsDays.map(d => d.id));

  // Push missing local days to VPS
  const missingInVpsDays = localDays.filter(d => !vpsDayIds.has(d.id));
  if (missingInVpsDays.length > 0) {
    console.log(`Pushing ${missingInVpsDays.length} TourPlanDays to VPS...`);
    const values = missingInVpsDays.map(d => {
      const doc = d.plannedDoctorId ? `'${d.plannedDoctorId}'` : "NULL";
      const beat = d.beatName ? `'${d.beatName.replace(/'/g, "''")}'` : "NULL";
      const sub = d.subArea ? `'${d.subArea.replace(/'/g, "''")}'` : "NULL";
      return `('${d.id}', '${d.tourPlanId}', '${d.territoryId}', '${d.date.toISOString()}'::timestamp, ${doc}, ${beat}, ${sub}, '${d.visitStatus}', ${d.isCompleted}, '${d.createdAt.toISOString()}'::timestamp, '${d.updatedAt.toISOString()}'::timestamp)`;
    }).join(", ");

    const insertDaysSql = `
      INSERT INTO "TourPlanDay" ("id", "tourPlanId", "territoryId", "date", "plannedDoctorId", "beatName", "subArea", "visitStatus", "isCompleted", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("id") DO NOTHING;
    `;
    const res = runVpsSqlViaFile(insertDaysSql);
    console.log("VPS TourPlanDay insert result:", res);
  }

  // Push missing VPS days to Local
  const missingInLocalDays = vpsDays.filter(d => !localDayIds.has(d.id));
  if (missingInLocalDays.length > 0) {
    console.log(`Pulling ${missingInLocalDays.length} TourPlanDays to Local...`);
    for (const d of missingInLocalDays) {
      await localDb.tourPlanDay.create({
        data: {
          id: d.id,
          tourPlanId: d.tourPlanId,
          territoryId: d.territoryId,
          date: new Date(d.date),
          plannedDoctorId: d.plannedDoctorId || null,
          beatName: d.beatName || null,
          subArea: d.subArea || null,
          visitStatus: d.visitStatus || "PENDING",
          isCompleted: d.isCompleted || false,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        }
      });
    }
  }

  // 3. Sync Notification table
  console.log("\n3. Synchronizing Notification table...");
  const localNotifs = await localDb.notification.findMany();
  const vpsNotifsRaw = runVpsSql(`SELECT json_agg(t) FROM "Notification" t;`);
  const vpsNotifs: any[] = JSON.parse(vpsNotifsRaw) || [];

  const localNotifIds = new Set(localNotifs.map(n => n.id));
  const missingInLocalNotifs = vpsNotifs.filter(n => !localNotifIds.has(n.id));

  if (missingInLocalNotifs.length > 0) {
    console.log(`Pulling ${missingInLocalNotifs.length} Notifications to Local...`);
    const jsonStr = JSON.stringify(missingInLocalNotifs);
    await localDb.$executeRawUnsafe(`
      INSERT INTO "Notification"
      SELECT * FROM json_populate_recordset(null::"Notification", $JSON$${jsonStr}$JSON$::json)
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  // 4. Sync WhatsApp Dispatch Logs
  const vpsLogsRaw = runVpsSql(`SELECT json_agg(t) FROM "whatsapp_dispatch_logs" t;`);
  if (vpsLogsRaw && vpsLogsRaw !== "null" && !vpsLogsRaw.startsWith("ERROR")) {
    await localDb.$executeRawUnsafe(`
      INSERT INTO "whatsapp_dispatch_logs"
      SELECT * FROM json_populate_recordset(null::"whatsapp_dispatch_logs", $JSON$${vpsLogsRaw}$JSON$::json)
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  // 5. Verify Final Counts
  console.log("\n=================================================================");
  console.log("                     FINAL VERIFICATION                          ");
  console.log("=================================================================");
  const finalLocalPlans = await localDb.tourPlan.count();
  const finalVpsPlans = parseInt(runVpsSql(`SELECT count(*) FROM "TourPlan";`), 10);
  console.log(`TourPlan: Local = ${finalLocalPlans}, VPS = ${finalVpsPlans} -> ${finalLocalPlans === finalVpsPlans ? "✅ MATCH" : "❌ DIFF"}`);

  const finalLocalDays = await localDb.tourPlanDay.count();
  const finalVpsDays = parseInt(runVpsSql(`SELECT count(*) FROM "TourPlanDay";`), 10);
  console.log(`TourPlanDay: Local = ${finalLocalDays}, VPS = ${finalVpsDays} -> ${finalLocalDays === finalVpsDays ? "✅ MATCH" : "❌ DIFF"}`);

  const finalLocalNotifs = await localDb.notification.count();
  const finalVpsNotifs = parseInt(runVpsSql(`SELECT count(*) FROM "Notification";`), 10);
  console.log(`Notification: Local = ${finalLocalNotifs}, VPS = ${finalVpsNotifs} -> ${finalLocalNotifs === finalVpsNotifs ? "✅ MATCH" : "❌ DIFF"}`);

  const finalLocalLogs = await localDb.whatsAppDispatchLog.count();
  const finalVpsLogs = parseInt(runVpsSql(`SELECT count(*) FROM "whatsapp_dispatch_logs";`), 10);
  console.log(`WhatsAppDispatchLog: Local = ${finalLocalLogs}, VPS = ${finalVpsLogs} -> ${finalLocalLogs === finalVpsLogs ? "✅ MATCH" : "❌ DIFF"}`);
}

main().finally(async () => {
  await localDb.$disconnect();
});
