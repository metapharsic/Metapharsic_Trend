import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== ATTENDANCE RECORDS (ALL IN OCT 2026) ===");
  const attendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: new Date("2026-10-01T00:00:00.000Z"),
        lte: new Date("2026-10-31T23:59:59.999Z")
      }
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { email: true, role: true } }
        }
      }
    },
    orderBy: [{ date: "desc" }, { employeeId: "asc" }]
  });

  for (const a of attendances) {
    console.log(
      `${a.date.toISOString().slice(0, 10)} | ${a.employee.firstName} ${a.employee.lastName} | checkIn: ${a.checkIn.toISOString()} | checkOut: ${a.checkOut?.toISOString() || "NONE"} | status: ${a.status}`
    );
  }

  // Find attendance specifically on Friday, October 16, 2026
  console.log("\n=== FRIDAY OCT 16, 2026 ATTENDANCES ===");
  const fridayAtt = await prisma.attendance.findMany({
    where: {
      date: new Date("2026-10-16T00:00:00.000Z")
    },
    include: {
      employee: { select: { firstName: true, lastName: true } }
    }
  });
  for (const a of fridayAtt) {
    console.log(
      `Friday: ${a.employee.firstName} ${a.employee.lastName} | checkIn: ${a.checkIn.toISOString()} | checkOut: ${a.checkOut?.toISOString()}`
    );
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
