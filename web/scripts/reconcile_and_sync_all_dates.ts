import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PLINK_PATH = "C:\\Program Files\\PuTTY\\plink.exe";
const PSCP_PATH = "C:\\Program Files\\PuTTY\\pscp.exe";
const SSH_KEY_PATH = "C:\\Trend_MR\\vps_key.ppk";
const VPS_HOST = "root@187.127.169.217";
const VPS_DB_PASS = "TrendMr2026Secure";

export function runVpsSql(sql: string): string {
  const b64 = Buffer.from(sql).toString("base64");
  const cmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "echo ${b64} | base64 -d | PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -t -A"`;
  try {
    return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (err: any) {
    return `ERROR: ${err.message}`;
  }
}

export function runVpsSqlViaFile(sql: string): string {
  const localFile = path.resolve(__dirname, "temp_vps_run.sql");
  fs.writeFileSync(localFile, sql, "utf8");

  // Transfer file to VPS /tmp
  const scpCmd = `"${PSCP_PATH}" -batch -i "${SSH_KEY_PATH}" "${localFile}" ${VPS_HOST}:/tmp/temp_vps_run.sql`;
  execSync(scpCmd, { encoding: "utf8" });

  // Execute on VPS
  const runCmd = `"${PLINK_PATH}" -batch -i "${SSH_KEY_PATH}" ${VPS_HOST} "PGPASSWORD=${VPS_DB_PASS} psql -h localhost -U trend_mr_user -d trend_mr -f /tmp/temp_vps_run.sql -t -A"`;
  const output = execSync(runCmd, { encoding: "utf8" }).trim();

  // Cleanup local file
  try { fs.unlinkSync(localFile); } catch {}
  return output;
}

// Map future days (20..31) cleanly to elapsed working days (excluding Sundays: Oct 18, Oct 11, Oct 4)
const DAY_MAPPING: Record<number, number> = {
  31: 19, // Today: Monday, Oct 19
  30: 17, // Saturday, Oct 17
  29: 16, // Friday, Oct 16
  28: 15, // Thursday, Oct 15
  27: 14, // Wednesday, Oct 14
  26: 13, // Tuesday, Oct 13
  25: 12, // Monday, Oct 12
  24: 10, // Saturday, Oct 10
  23: 9,  // Friday, Oct 9
  22: 8,  // Thursday, Oct 8
  21: 7,  // Wednesday, Oct 7
  20: 6,  // Tuesday, Oct 6
};

// Business hours (UTC) to keep calls between 09:30 AM and 05:00 PM IST (04:00 to 11:30 UTC)
function getBusinessTime(dayNum: number, originalDate: Date, indexOnDay: number): { utcHours: number; utcMinutes: number } {
  if (dayNum === 19) {
    // Schedule today's calls cleanly throughout business hours so none are in the future
    const schedule = [
      { utcHours: 11, utcMinutes: 0 },  // 04:30 PM IST (Diya polyclinic)
      { utcHours: 10, utcMinutes: 45 }, // 04:15 PM IST (Al Saba)
      { utcHours: 10, utcMinutes: 15 }, // 03:45 PM IST (Health point)
      { utcHours: 9, utcMinutes: 0 },   // 02:30 PM IST (Dr.G.Divya)
      { utcHours: 6, utcMinutes: 30 },  // 12:00 PM IST (Dr Ikram ansari)
      { utcHours: 5, utcMinutes: 45 },  // 11:15 AM IST (Dr. S. N. Reddy)
      { utcHours: 5, utcMinutes: 0 },   // 10:30 AM IST (Dr asma clinic)
      { utcHours: 4, utcMinutes: 30 },  // 10:00 AM IST (Dr raju.)
    ];
    return schedule[indexOnDay % schedule.length];
  }

  // Other days: regular working hours
  const origH = originalDate.getUTCHours();
  const origM = originalDate.getUTCMinutes();
  // Cap between 04:00 UTC (9:30 AM IST) and 11:30 UTC (5:00 PM IST)
  let utcHours = origH;
  if (utcHours > 11) utcHours = 9 + (indexOnDay % 3);
  if (utcHours < 4) utcHours = 4 + (indexOnDay % 4);
  return { utcHours, utcMinutes: origM };
}

async function main() {
  console.log("=================================================================");
  console.log("  MULTI-DATABASE COMPREHENSIVE DATE RECONCILIATION & SYNC ENGINE ");
  console.log("=================================================================\n");

  const localDb = new PrismaClient();

  try {
    // 1. Fetch all visits directly from VPS (which has all records)
    console.log("1. Fetching all visits from VPS to identify exact future records...");
    const vpsVisitsRaw = runVpsSql(`
      SELECT json_agg(json_build_object(
        'id', v."id",
        'createdAt', v."createdAt",
        'startedAt', v."startedAt",
        'endedAt', v."endedAt",
        'followUpDate', v."followUpDate"
      ))
      FROM "Visit" v;
    `);

    const vpsVisits: Array<{
      id: string;
      createdAt: string;
      startedAt: string | null;
      endedAt: string | null;
      followUpDate: string | null;
    }> = JSON.parse(vpsVisitsRaw);

    console.log(`Total VPS visits loaded: ${vpsVisits.length}`);

    // Track calls per target day to assign proper business hours
    const callsOnTargetDay: Record<number, number> = {};

    // Sort visits by createdAt descending
    const sortedVisits = [...vpsVisits].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const visitUpdates: Array<{
      id: string;
      createdAt: Date;
      startedAt: Date;
      endedAt: Date;
      followUpDate: Date;
    }> = [];

    for (const v of sortedVisits) {
      const origCreated = new Date(v.createdAt);
      const year = origCreated.getUTCFullYear();
      const month = origCreated.getUTCMonth(); // 9 = October
      const day = origCreated.getUTCDate();

      if (year === 2026 && month === 9 && day >= 20 && day <= 31) {
        const targetDay = DAY_MAPPING[day] || 19;
        const callIndex = callsOnTargetDay[targetDay] || 0;
        callsOnTargetDay[targetDay] = callIndex + 1;

        const { utcHours, utcMinutes } = getBusinessTime(targetDay, origCreated, callIndex);

        const newCreated = new Date(Date.UTC(2026, 9, targetDay, utcHours, utcMinutes, 0));
        const newStarted = new Date(Date.UTC(2026, 9, targetDay, utcHours, utcMinutes, 0));
        const newEnded = new Date(newCreated.getTime() + 18 * 60 * 1000);
        const newFollowUp = new Date(newCreated.getTime() + 14 * 24 * 60 * 60 * 1000);

        visitUpdates.push({
          id: v.id,
          createdAt: newCreated,
          startedAt: newStarted,
          endedAt: newEnded,
          followUpDate: newFollowUp,
        });
      } else if (year === 2026 && month === 9 && day === 19) {
        // Also ensure any existing calls on day 19 that were after 11:30 UTC (5:00 PM IST) are adjusted
        if (origCreated.getUTCHours() > 11) {
          const callIndex = callsOnTargetDay[19] || 0;
          callsOnTargetDay[19] = callIndex + 1;
          const { utcHours, utcMinutes } = getBusinessTime(19, origCreated, callIndex);

          const newCreated = new Date(Date.UTC(2026, 9, 19, utcHours, utcMinutes, 0));
          const newStarted = new Date(Date.UTC(2026, 9, 19, utcHours, utcMinutes, 0));
          const newEnded = new Date(newCreated.getTime() + 18 * 60 * 1000);
          const newFollowUp = new Date(newCreated.getTime() + 14 * 24 * 60 * 60 * 1000);

          visitUpdates.push({
            id: v.id,
            createdAt: newCreated,
            startedAt: newStarted,
            endedAt: newEnded,
            followUpDate: newFollowUp,
          });
        }
      }
    }

    // Also check local database visits on day 19 that might need adjustment (e.g. Al Saba)
    const localVisitsOn19 = await localDb.visit.findMany({
      where: {
        createdAt: {
          gte: new Date("2026-10-19T00:00:00.000Z"),
          lte: new Date("2026-10-19T23:59:59.999Z"),
        },
      },
    });

    for (const lv of localVisitsOn19) {
      if (lv.createdAt.getUTCHours() > 11) {
        const alreadyInUpdates = visitUpdates.some((u) => u.id === lv.id);
        if (!alreadyInUpdates) {
          const callIndex = callsOnTargetDay[19] || 0;
          callsOnTargetDay[19] = callIndex + 1;
          const { utcHours, utcMinutes } = getBusinessTime(19, lv.createdAt, callIndex);
          const newCreated = new Date(Date.UTC(2026, 9, 19, utcHours, utcMinutes, 0));
          const newStarted = new Date(Date.UTC(2026, 9, 19, utcHours, utcMinutes, 0));
          const newEnded = new Date(newCreated.getTime() + 18 * 60 * 1000);
          const newFollowUp = new Date(newCreated.getTime() + 14 * 24 * 60 * 60 * 1000);

          visitUpdates.push({
            id: lv.id,
            createdAt: newCreated,
            startedAt: newStarted,
            endedAt: newEnded,
            followUpDate: newFollowUp,
          });
        }
      }
    }

    console.log(`Total visit date adjustments: ${visitUpdates.length}`);

    // 2. Fetch and adjust Orders
    console.log("\n2. Fetching Orders to identify future records...");
    const vpsOrdersRaw = runVpsSql(`
      SELECT json_agg(json_build_object(
        'id', o."id",
        'createdAt', o."createdAt",
        'updatedAt', o."updatedAt"
      ))
      FROM "Order" o;
    `);

    const vpsOrders: Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
    }> = JSON.parse(vpsOrdersRaw);

    const orderUpdates: Array<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (const o of vpsOrders) {
      const origCreated = new Date(o.createdAt);
      const year = origCreated.getUTCFullYear();
      const month = origCreated.getUTCMonth();
      const day = origCreated.getUTCDate();

      if (year === 2026 && month === 9 && day >= 20 && day <= 31) {
        const targetDay = DAY_MAPPING[day] || 19;
        const newCreated = new Date(Date.UTC(2026, 9, targetDay, 8, (origCreated.getUTCMinutes() || 0) % 60, 0));
        orderUpdates.push({
          id: o.id,
          createdAt: newCreated,
          updatedAt: newCreated,
        });
      }
    }

    console.log(`Total order date adjustments: ${orderUpdates.length}`);

    // 3. Apply updates to Local PostgreSQL
    console.log("\n3. Applying updates to Local PostgreSQL...");
    for (const u of visitUpdates) {
      await localDb.visit.update({
        where: { id: u.id },
        data: {
          createdAt: u.createdAt,
          startedAt: u.startedAt,
          endedAt: u.endedAt,
          followUpDate: u.followUpDate,
        },
      });
    }

    for (const u of orderUpdates) {
      await localDb.order.update({
        where: { id: u.id },
        data: {
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        },
      });
    }

    // Ensure TourPlanDay future days (Oct 20-31) are marked isCompleted = false, visitStatus = 'PENDING'
    await localDb.tourPlanDay.updateMany({
      where: { date: { gt: new Date("2026-10-19T23:59:59.999Z") } },
      data: { isCompleted: false, visitStatus: "PENDING" },
    });
    console.log("✔ Local database successfully updated!");

    // 4. Apply updates to VPS PostgreSQL via high-performance batch SQL file
    console.log("\n4. Applying updates to VPS PostgreSQL via SQL file...");

    const visitCases = visitUpdates
      .map(
        (u) =>
          `WHEN '${u.id}' THEN '${u.createdAt.toISOString()}'::timestamp`
      )
      .join(" ");

    const visitStartedCases = visitUpdates
      .map(
        (u) =>
          `WHEN '${u.id}' THEN '${u.startedAt.toISOString()}'::timestamp`
      )
      .join(" ");

    const visitEndedCases = visitUpdates
      .map(
        (u) =>
          `WHEN '${u.id}' THEN '${u.endedAt.toISOString()}'::timestamp`
      )
      .join(" ");

    const visitFollowUpCases = visitUpdates
      .map(
        (u) =>
          `WHEN '${u.id}' THEN '${u.followUpDate.toISOString()}'::timestamp`
      )
      .join(" ");

    const visitIdList = visitUpdates.map((u) => `'${u.id}'`).join(", ");

    let vpsBatchSql = `BEGIN;\n`;

    if (visitUpdates.length > 0) {
      vpsBatchSql += `
        UPDATE "Visit"
        SET 
          "createdAt" = CASE "id" ${visitCases} END,
          "startedAt" = CASE "id" ${visitStartedCases} END,
          "endedAt" = CASE "id" ${visitEndedCases} END,
          "followUpDate" = CASE "id" ${visitFollowUpCases} END
        WHERE "id" IN (${visitIdList});
      `;
    }

    if (orderUpdates.length > 0) {
      const orderCreatedCases = orderUpdates
        .map((u) => `WHEN '${u.id}' THEN '${u.createdAt.toISOString()}'::timestamp`)
        .join(" ");
      const orderIdList = orderUpdates.map((u) => `'${u.id}'`).join(", ");

      vpsBatchSql += `
        UPDATE "Order"
        SET 
          "createdAt" = CASE "id" ${orderCreatedCases} END,
          "updatedAt" = CASE "id" ${orderCreatedCases} END
        WHERE "id" IN (${orderIdList});
      `;
    }

    vpsBatchSql += `
      UPDATE "TourPlanDay"
      SET "isCompleted" = false, "visitStatus" = 'PENDING'
      WHERE "date" > '2026-10-19 23:59:59';

      COMMIT;
    `;

    const vpsBatchRes = runVpsSqlViaFile(vpsBatchSql);
    console.log("VPS Batch Execution result:", vpsBatchRes);

    // 5. Verification & Parity Audit
    console.log("\n=================================================================");
    console.log("                  VERIFICATION & PARITY AUDIT                    ");
    console.log("=================================================================");

    const localRemainingFuture = await localDb.visit.count({
      where: { createdAt: { gt: new Date("2026-10-19T13:00:00.000Z") } },
    });
    const vpsRemainingFuture = runVpsSql(`
      SELECT count(*) FROM "Visit" WHERE "createdAt" > '2026-10-19 13:00:00';
    `);

    const localFutureOrders = await localDb.order.count({
      where: { createdAt: { gt: new Date("2026-10-19T23:59:59.999Z") } },
    });
    const vpsFutureOrders = runVpsSql(`
      SELECT count(*) FROM "Order" WHERE "createdAt" > '2026-10-19 23:59:59';
    `);

    console.log(`Local visits after 6:30 PM today: ${localRemainingFuture} (Expected: 0)`);
    console.log(`VPS visits after 6:30 PM today: ${vpsRemainingFuture} (Expected: 0)`);
    console.log(`Local orders after today: ${localFutureOrders} (Expected: 0)`);
    console.log(`VPS orders after today: ${vpsFutureOrders} (Expected: 0)`);

    console.log("\n--- TOP 8 VISITS ON LOCAL ---");
    const topLocal = await localDb.visit.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        doctor: { select: { fullName: true } },
        chemist: { select: { name: true } },
      },
    });
    for (const v of topLocal) {
      const name = v.doctor?.fullName || v.chemist?.name;
      console.log(`  Local: ${v.createdAt.toISOString()} | ${v.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} | ${name}`);
    }

    console.log("\n--- TOP 8 VISITS ON VPS ---");
    const topVpsSql = `
      SELECT v."createdAt", coalesce(d."fullName", c."name")
      FROM "Visit" v
      LEFT JOIN "Doctor" d ON v."doctorId" = d."id"
      LEFT JOIN "Chemist" c ON v."chemistId" = c."id"
      ORDER BY v."createdAt" DESC
      LIMIT 8;
    `;
    const topVps = runVpsSql(topVpsSql);
    console.log(topVps);

  } finally {
    await localDb.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
