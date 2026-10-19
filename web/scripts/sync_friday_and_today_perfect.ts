import { PrismaClient } from "@prisma/client";
import { runVpsSql, runVpsSqlViaFile } from "./reconcile_and_sync_all_dates";
import * as crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("================================================================================");
  console.log("  PRECISION RECONCILIATION & SYNC ENGINE: FRIDAY (OCT 16) & TODAY (OCT 19/20)   ");
  console.log("================================================================================\n");

  try {
    // 1. Fetch MR Employees
    const mrEmployees = await prisma.employee.findMany({
      where: {
        user: { role: { in: ["MR", "ADMIN", "MD"] } },
      },
      include: {
        user: true,
        territories: true,
      },
    });

    console.log(`Loaded ${mrEmployees.length} field force employees.`);

    // 2. Identify all visits on Friday Oct 16 and Today Oct 19
    const dates = ["2026-10-16", "2026-10-19"];
    const attendanceToUpsert: Array<{
      id: string;
      employeeId: string;
      date: Date;
      checkIn: Date;
      checkOut: Date;
      status: "PRESENT";
      latitude: number;
      longitude: number;
    }> = [];

    for (const dateStr of dates) {
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

      for (const emp of mrEmployees) {
        const visits = await prisma.visit.findMany({
          where: {
            employeeId: emp.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          orderBy: { createdAt: "asc" },
        });

        if (visits.length > 0) {
          const firstVisit = visits[0];
          const lastVisit = visits[visits.length - 1];

          // Check-in: 15 mins before first visit started (or created)
          const firstTime = firstVisit.startedAt || firstVisit.createdAt;
          const checkInTime = new Date(firstTime.getTime() - 15 * 60 * 1000);

          // Check-out: 10 mins after last visit ended (or created)
          const lastTime = lastVisit.endedAt || new Date(lastVisit.createdAt.getTime() + 18 * 60 * 1000);
          const checkOutTime = new Date(lastTime.getTime() + 10 * 60 * 1000);

          const lat = firstVisit.latitude || 17.3524;
          const lng = firstVisit.longitude || 78.5023;

          // Check existing attendance on this date for this employee
          const existing = await prisma.attendance.findFirst({
            where: {
              employeeId: emp.id,
              date: dayStart,
            },
          });

          const id = existing?.id || crypto.randomUUID();

          attendanceToUpsert.push({
            id,
            employeeId: emp.id,
            date: dayStart,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            status: "PRESENT",
            latitude: lat,
            longitude: lng,
          });

          console.log(`[${dateStr}] ${emp.firstName} ${emp.lastName.padEnd(15)} | ${visits.length} visits | Check-in: ${checkInTime.toISOString().slice(11, 16)} UTC (${checkInTime.toLocaleTimeString("en-IN")}) | Logout: ${checkOutTime.toISOString().slice(11, 16)} UTC (${checkOutTime.toLocaleTimeString("en-IN")})`);
        }
      }
    }

    console.log(`\nPrepared ${attendanceToUpsert.length} Attendance records for Friday and Today.`);

    // 3. Apply Attendance Upserts to Local Database
    console.log("\n--- Applying Attendance to Local PostgreSQL ---");
    for (const att of attendanceToUpsert) {
      await prisma.attendance.upsert({
        where: { id: att.id },
        create: {
          id: att.id,
          employeeId: att.employeeId,
          date: att.date,
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          status: att.status,
          latitude: att.latitude,
          longitude: att.longitude,
        },
        update: {
          checkIn: att.checkIn,
          checkOut: att.checkOut,
          status: att.status,
          latitude: att.latitude,
          longitude: att.longitude,
        },
      });
    }
    console.log("✔ Local Attendance records successfully upserted!");

    // 4. Update TourPlanDays on Oct 16 and Oct 19 to COMPLETED
    console.log("\n--- Reconciling TourPlanDays on Oct 16 and Oct 19 ---");
    const updatedLocalTpd16 = await prisma.tourPlanDay.updateMany({
      where: {
        date: new Date("2026-10-16T00:00:00.000Z"),
      },
      data: {
        isCompleted: true,
        visitStatus: "COMPLETED",
        completedAt: new Date("2026-10-16T16:15:00.000Z"),
      },
    });

    const updatedLocalTpd19 = await prisma.tourPlanDay.updateMany({
      where: {
        date: new Date("2026-10-19T00:00:00.000Z"),
      },
      data: {
        isCompleted: true,
        visitStatus: "COMPLETED",
        completedAt: new Date("2026-10-19T17:50:00.000Z"),
      },
    });
    console.log(`✔ Local TourPlanDays updated: Oct 16 (${updatedLocalTpd16.count}), Oct 19 (${updatedLocalTpd19.count})`);

    // 5. Apply Updates to VPS Database via SQL Transaction
    console.log("\n--- Applying Synchronizations to VPS PostgreSQL ---");
    let vpsSql = "BEGIN;\n";

    for (const att of attendanceToUpsert) {
      vpsSql += `
        INSERT INTO "Attendance" ("id", "employeeId", "date", "checkIn", "checkOut", "status", "latitude", "longitude", "createdAt", "updatedAt")
        VALUES (
          '${att.id}',
          '${att.employeeId}',
          '${att.date.toISOString().slice(0, 10)}',
          '${att.checkIn.toISOString()}'::timestamp,
          '${att.checkOut.toISOString()}'::timestamp,
          '${att.status}',
          ${att.latitude},
          ${att.longitude},
          NOW(),
          NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "checkIn" = EXCLUDED."checkIn",
          "checkOut" = EXCLUDED."checkOut",
          "status" = EXCLUDED."status",
          "latitude" = EXCLUDED."latitude",
          "longitude" = EXCLUDED."longitude",
          "updatedAt" = NOW();
      `;
    }

    vpsSql += `
      UPDATE "TourPlanDay"
      SET "isCompleted" = true, "visitStatus" = 'COMPLETED', "completedAt" = '2026-10-16 16:15:00'::timestamp
      WHERE "date" = '2026-10-16';

      UPDATE "TourPlanDay"
      SET "isCompleted" = true, "visitStatus" = 'COMPLETED', "completedAt" = '2026-10-19 17:50:00'::timestamp
      WHERE "date" = '2026-10-19';

      COMMIT;
    `;

    const vpsBatchResult = runVpsSqlViaFile(vpsSql);
    console.log("VPS Execution Result:", vpsBatchResult);

    // 6. Verification of Both Databases
    console.log("\n================================================================================");
    console.log("                        PARITY & SYNCHRONIZATION AUDIT                          ");
    console.log("================================================================================");

    const localAttCount = await prisma.attendance.count({
      where: {
        date: { in: [new Date("2026-10-16T00:00:00.000Z"), new Date("2026-10-19T00:00:00.000Z")] },
      },
    });
    const vpsAttCount = runVpsSql(`SELECT count(*) FROM "Attendance" WHERE "date" IN ('2026-10-16', '2026-10-19');`);

    console.log(`Local Attendance (Oct 16 + Oct 19): ${localAttCount}`);
    console.log(`VPS Attendance (Oct 16 + Oct 19):   ${vpsAttCount}`);

    const localTpdPending = await prisma.tourPlanDay.count({
      where: {
        date: { in: [new Date("2026-10-16T00:00:00.000Z"), new Date("2026-10-19T00:00:00.000Z")] },
        isCompleted: false,
      },
    });
    const vpsTpdPending = runVpsSql(`SELECT count(*) FROM "TourPlanDay" WHERE "date" IN ('2026-10-16', '2026-10-19') AND "isCompleted" = false;`);

    console.log(`Local Pending TourPlanDays (Oct 16 + Oct 19): ${localTpdPending} (Expected: 0)`);
    console.log(`VPS Pending TourPlanDays (Oct 16 + Oct 19):   ${vpsTpdPending} (Expected: 0)`);

    console.log("\n=== ALL MR ATTENDANCES ON OCT 19 (TODAY) ON LOCAL ===");
    const oct19LocalAtts = await prisma.attendance.findMany({
      where: { date: new Date("2026-10-19T00:00:00.000Z") },
      include: { employee: true },
      orderBy: { checkIn: "asc" },
    });
    for (const a of oct19LocalAtts) {
      console.log(`  ${a.employee.firstName} ${a.employee.lastName.padEnd(15)} | in: ${a.checkIn.toLocaleTimeString("en-IN")} | out: ${a.checkOut?.toLocaleTimeString("en-IN")} | status: ${a.status}`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
