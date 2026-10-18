import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const visits = await prisma.visit.findMany({
    include: {
      employee: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
      doctor: { select: { fullName: true, clinicAddress: true, territory: { select: { name: true } } } },
      chemist: { select: { name: true, address: true, territory: { select: { name: true } } } },
    },
  });

  const mrVisitsMap: Record<string, {
    mrName: string;
    email: string;
    totalVisits: number;
    doctorVisits: number;
    chemistVisits: number;
    locations: Map<string, number>;
  }> = {};

  for (const v of visits) {
    const mrEmail = v.employee?.user?.email || "unknown";
    const mrName = `${v.employee?.firstName || ""} ${v.employee?.lastName || ""}`.trim();
    if (!mrVisitsMap[mrEmail]) {
      mrVisitsMap[mrEmail] = {
        mrName,
        email: mrEmail,
        totalVisits: 0,
        doctorVisits: 0,
        chemistVisits: 0,
        locations: new Map(),
      };
    }

    const mrData = mrVisitsMap[mrEmail];
    mrData.totalVisits++;

    let loc = "Unknown";
    if (v.doctor) {
      mrData.doctorVisits++;
      loc = v.doctor.clinicAddress || "Doctor Clinic";
    } else if (v.chemist) {
      mrData.chemistVisits++;
      loc = v.chemist.address || "Chemist Shop";
    }

    const cleanLoc = loc.trim();
    mrData.locations.set(cleanLoc, (mrData.locations.get(cleanLoc) || 0) + 1);
  }

  console.log("=== MR VISITED ADDRESSES ANALYSIS ===");
  for (const [email, data] of Object.entries(mrVisitsMap)) {
    console.log(`\n========================================`);
    console.log(`MR: ${data.mrName} (${email}) | Total Calls: ${data.totalVisits} (Docs: ${data.doctorVisits}, Chemists: ${data.chemistVisits})`);
    console.log(`Distinct Address Strings: ${data.locations.size}`);
    const sortedLocs = Array.from(data.locations.entries()).sort((a, b) => b[1] - a[1]);
    sortedLocs.slice(0, 30).forEach(([loc, cnt]) => {
      console.log(`  - [${cnt.toString().padStart(3)}] ${loc}`);
    });
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
