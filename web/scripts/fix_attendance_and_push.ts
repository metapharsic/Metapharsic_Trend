import { db } from "../lib/db";

async function main() {
  console.log("Dropping Attendance constraint if present...");
  try {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_employeeId_date_key"'
    );
    console.log("Dropped Attendance_employeeId_date_key constraint if existed.");
  } catch (err) {
    console.warn("Notice dropping constraint:", err);
  }
  await db.$disconnect();
}

main().catch(console.error);
