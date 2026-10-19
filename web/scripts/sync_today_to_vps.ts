import { PrismaClient } from "@prisma/client";
import { runVpsSqlViaFile, runVpsSql } from "./reconcile_and_sync_all_dates";

const prisma = new PrismaClient();

function escapeSql(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'::timestamp`;
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

function escapeDateOnly(val: any): string {
  if (!val) return "NULL";
  if (val instanceof Date) return `'${val.toISOString().slice(0, 10)}'::date`;
  return `'${String(val).slice(0, 10)}'::date`;
}

async function main() {
  console.log("================================================================================");
  console.log("  SYNCHRONIZING TODAY'S (OCT 20) & RECENT DATA TO VPS POSTGRESQL                ");
  console.log("================================================================================\n");

  const sqlStatements: string[] = [];

  // 1. TourPlan & TourPlanDay
  console.log("1. Exporting TourPlan & TourPlanDay...");
  const tourPlans = await prisma.tourPlan.findMany();
  for (const tp of tourPlans) {
    sqlStatements.push(`
      INSERT INTO "TourPlan" ("id", "employeeId", "month", "status", "createdAt", "updatedAt")
      VALUES (${escapeSql(tp.id)}, ${escapeSql(tp.employeeId)}, ${escapeDateOnly(tp.month)}, '${tp.status}', ${escapeSql(tp.createdAt)}, ${escapeSql(tp.updatedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  const tpDays = await prisma.tourPlanDay.findMany({
    where: { date: { gte: new Date("2026-10-19T00:00:00.000Z") } },
  });
  for (const d of tpDays) {
    sqlStatements.push(`
      INSERT INTO "TourPlanDay" ("id", "tourPlanId", "date", "territoryId", "beatName", "subArea", "plannedDoctorId", "isCompleted", "visitStatus", "completedAt", "completionNotes", "createdAt", "updatedAt")
      VALUES (${escapeSql(d.id)}, ${escapeSql(d.tourPlanId)}, ${escapeDateOnly(d.date)}, ${escapeSql(d.territoryId)}, ${escapeSql(d.beatName)}, ${escapeSql(d.subArea)}, ${escapeSql(d.plannedDoctorId)}, ${escapeSql(d.isCompleted)}, '${d.visitStatus}', ${escapeSql(d.completedAt)}, ${escapeSql(d.completionNotes)}, ${escapeSql(d.createdAt)}, ${escapeSql(d.updatedAt)})
      ON CONFLICT ("id") DO UPDATE SET "isCompleted" = EXCLUDED."isCompleted", "visitStatus" = EXCLUDED."visitStatus", "completedAt" = EXCLUDED."completedAt", "completionNotes" = EXCLUDED."completionNotes";
    `);
  }

  // 2. Attendance
  console.log("2. Exporting Attendance...");
  const attendances = await prisma.attendance.findMany({
    where: { date: { gte: new Date("2026-10-19T00:00:00.000Z") } },
  });
  for (const att of attendances) {
    sqlStatements.push(`
      INSERT INTO "Attendance" ("id", "employeeId", "date", "status", "checkIn", "checkOut", "latitude", "longitude", "createdAt", "updatedAt")
      VALUES (${escapeSql(att.id)}, ${escapeSql(att.employeeId)}, ${escapeDateOnly(att.date)}, '${att.status}', ${escapeSql(att.checkIn)}, ${escapeSql(att.checkOut)}, ${att.latitude}, ${att.longitude}, ${escapeSql(att.createdAt)}, ${escapeSql(att.updatedAt)})
      ON CONFLICT ("id") DO UPDATE SET "checkOut" = EXCLUDED."checkOut", "status" = EXCLUDED."status";
    `);
  }

  // 3. LocationLog
  console.log("3. Exporting LocationLogs...");
  const locationLogs = await prisma.locationLog.findMany({
    where: { recordedAt: { gte: new Date("2026-10-20T00:00:00.000Z") } },
  });
  for (const loc of locationLogs) {
    sqlStatements.push(`
      INSERT INTO "LocationLog" ("id", "employeeId", "latitude", "longitude", "isMocked", "recordedAt")
      VALUES (${escapeSql(loc.id)}, ${escapeSql(loc.employeeId)}, ${loc.latitude}, ${loc.longitude}, ${escapeSql(loc.isMocked)}, ${escapeSql(loc.recordedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  // 4. Visits & Samples
  console.log("4. Exporting Visits & Samples...");
  const visits = await prisma.visit.findMany({
    where: { createdAt: { gte: new Date("2026-10-19T00:00:00.000Z") } },
    include: { samples: true },
  });
  for (const v of visits) {
    sqlStatements.push(`
      INSERT INTO "Visit" ("id", "employeeId", "doctorId", "chemistId", "hospitalId", "purpose", "feedback", "latitude", "longitude", "startedAt", "startLatitude", "startLongitude", "endedAt", "durationMinutes", "cqsScore", "receptiveness", "createdAt", "updatedAt")
      VALUES (${escapeSql(v.id)}, ${escapeSql(v.employeeId)}, ${escapeSql(v.doctorId)}, ${escapeSql(v.chemistId)}, ${escapeSql(v.hospitalId)}, ${escapeSql(v.purpose)}, ${escapeSql(v.feedback)}, ${v.latitude}, ${v.longitude}, ${escapeSql(v.startedAt)}, ${escapeSql(v.startLatitude)}, ${escapeSql(v.startLongitude)}, ${escapeSql(v.endedAt)}, ${escapeSql(v.durationMinutes)}, ${escapeSql(v.cqsScore)}, ${escapeSql(v.receptiveness)}, ${escapeSql(v.createdAt)}, ${escapeSql(v.updatedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);

    for (const smp of v.samples) {
      sqlStatements.push(`
        INSERT INTO "Sample" ("id", "visitId", "productId", "quantity", "createdAt", "updatedAt")
        VALUES (${escapeSql(smp.id)}, ${escapeSql(smp.visitId)}, ${escapeSql(smp.productId)}, ${smp.quantity}, ${escapeSql(smp.createdAt)}, ${escapeSql(smp.updatedAt)})
        ON CONFLICT ("id") DO NOTHING;
      `);
    }
  }

  // 5. Orders & OrderItems
  console.log("5. Exporting Orders & OrderItems...");
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: new Date("2026-10-19T00:00:00.000Z") } },
    include: { items: true },
  });
  for (const o of orders) {
    sqlStatements.push(`
      INSERT INTO "Order" ("id", "status", "chemistId", "doctorId", "distributorId", "employeeId", "createdAt", "updatedAt")
      VALUES (${escapeSql(o.id)}, '${o.status}', ${escapeSql(o.chemistId)}, ${escapeSql(o.doctorId)}, ${escapeSql(o.distributorId)}, ${escapeSql(o.employeeId)}, ${escapeSql(o.createdAt)}, ${escapeSql(o.updatedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);

    for (const oi of o.items) {
      sqlStatements.push(`
        INSERT INTO "OrderItem" ("id", "orderId", "productId", "quantity", "price", "packSize", "batchNo", "mfgDate", "expDate", "createdAt", "updatedAt")
        VALUES (${escapeSql(oi.id)}, ${escapeSql(oi.orderId)}, ${escapeSql(oi.productId)}, ${oi.quantity}, ${oi.price}, ${escapeSql(oi.packSize)}, ${escapeSql(oi.batchNo)}, ${escapeDateOnly(oi.mfgDate)}, ${escapeDateOnly(oi.expDate)}, ${escapeSql(oi.createdAt)}, ${escapeSql(oi.updatedAt)})
        ON CONFLICT ("id") DO NOTHING;
      `);
    }
  }

  // 6. Invoices
  console.log("6. Exporting Invoices...");
  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: new Date("2026-10-19T00:00:00.000Z") } },
  });
  for (const inv of invoices) {
    sqlStatements.push(`
      INSERT INTO "Invoice" ("id", "orderId", "invoiceNo", "amount", "paid", "partyName", "partyAddress", "partyPhone", "totalItems", "totalQty", "grandTotal", "createdAt", "updatedAt")
      VALUES (${escapeSql(inv.id)}, ${escapeSql(inv.orderId)}, ${escapeSql(inv.invoiceNo)}, ${inv.amount}, ${inv.paid ? "TRUE" : "FALSE"}, ${escapeSql(inv.partyName)}, ${escapeSql(inv.partyAddress)}, ${escapeSql(inv.partyPhone)}, ${escapeSql(inv.totalItems)}, ${escapeSql(inv.totalQty)}, ${escapeSql(inv.grandTotal)}, ${escapeSql(inv.createdAt)}, ${escapeSql(inv.updatedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  // 7. Collections
  console.log("7. Exporting Collections...");
  const collections = await prisma.collection.findMany({
    where: { createdAt: { gte: new Date("2026-10-19T00:00:00.000Z") } },
  });
  for (const col of collections) {
    sqlStatements.push(`
      INSERT INTO "Collection" ("id", "employeeId", "chemistId", "amount", "refNumber", "createdAt", "updatedAt")
      VALUES (${escapeSql(col.id)}, ${escapeSql(col.employeeId)}, ${escapeSql(col.chemistId)}, ${col.amount}, ${escapeSql(col.refNumber)}, ${escapeSql(col.createdAt)}, ${escapeSql(col.updatedAt)})
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  console.log(`\nGenerated ${sqlStatements.length} SQL sync statements. Executing on VPS...`);
  const fullSql = "BEGIN;\n" + sqlStatements.join("\n") + "\nCOMMIT;\n";
  const output = runVpsSqlViaFile(fullSql);
  console.log("VPS Execution Output:", output);

  console.log("\n================================================================================");
  console.log("  VERIFYING PARITY ACROSS LOCAL AND VPS                                         ");
  console.log("================================================================================\n");

  const tables = [
    "Attendance",
    "LocationLog",
    "TourPlan",
    "TourPlanDay",
    "Visit",
    "Sample",
    "Order",
    "OrderItem",
    "Invoice",
    "Collection",
  ];

  for (const tbl of tables) {
    const localCount = await (prisma as any)[tbl.charAt(0).toLowerCase() + tbl.slice(1)].count();
    const vpsCount = runVpsSql(`SELECT count(*) FROM "${tbl}";`);
    const match = localCount === Number(vpsCount) ? "✔ PARITY" : "❌ MISMATCH";
    console.log(`${tbl.padEnd(16)} | Local: ${String(localCount).padEnd(6)} | VPS: ${String(vpsCount).padEnd(6)} | ${match}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
