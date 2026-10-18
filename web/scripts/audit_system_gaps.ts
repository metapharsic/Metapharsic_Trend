import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function checkGaps() {
  console.log("=================================================================");
  console.log("            COMPREHENSIVE SFA & FIELD GAP AUDIT                  ");
  console.log("=================================================================\n");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  // 1. DOCTOR POTENTIAL & INTELLIGENCE GAPS
  const totalDoctors = await db.doctor.count();
  const unassignedDoctors = await db.doctor.count({ where: { beatName: null } });
  const zeroVisitDoctors = await db.doctor.count({ where: { visits: { none: {} } } });
  
  const doctorsWithGaps = await db.doctor.count({
    where: {
      OR: [
        { visits: { none: {} } },
        { visits: { none: { createdAt: { gte: thirtyDaysAgo } } } }
      ]
    }
  });

  const tierADoctors = await db.doctor.findMany({
    where: { dpsTier: "A" },
    select: {
      id: true,
      fullName: true,
      beatName: true,
      subArea: true,
      visits: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true }
      }
    }
  });

  const tierAGaps = tierADoctors.filter(d => {
    if (!d.visits.length) return true;
    const diff = (now.getTime() - new Date(d.visits[0].createdAt).getTime()) / (1000 * 3600 * 24);
    return diff > 15;
  });

  console.log("--- 1. DOCTOR POTENTIAL & INTELLIGENCE GAPS ---");
  console.log(`• Total Prescribers: ${totalDoctors}`);
  console.log(`• Prescribers Missing Beat Territory Assignment: ${unassignedDoctors}`);
  console.log(`• Prescribers with ZERO Visits Ever: ${zeroVisitDoctors}`);
  console.log(`• Prescribers with Visit Gap > 30 Days: ${doctorsWithGaps} (${Math.round((doctorsWithGaps / totalDoctors) * 100)}%)`);
  console.log(`• High-Potential Tier A Prescribers: ${tierADoctors.length}`);
  console.log(`• Tier A Prescribers with Visit Gap > 15 Days (High Priority Gaps): ${tierAGaps.length}`);

  // 2. MASTER PROFILES GAPS
  const totalChemists = await db.chemist.count();
  const chemistsWithoutBeat = await db.chemist.count({ where: { beatName: null } });
  const zeroVisitChemists = await db.chemist.count({ where: { visits: { none: {} } } });
  const zeroOrderChemists = await db.chemist.count({ where: { orders: { none: {} } } });

  console.log("\n--- 2. MASTER PROFILES GAPS (CHEMISTS & DOCTORS) ---");
  console.log(`• Total Retail Chemists: ${totalChemists}`);
  console.log(`• Chemists Missing Beat Assignment: ${chemistsWithoutBeat}`);
  console.log(`• Chemists Never Visited by Field Rep: ${zeroVisitChemists}`);
  console.log(`• Chemists with Zero Orders Booked: ${zeroOrderChemists}`);

  // 3. BEAT TERRITORY COVERAGE GAPS
  const officialBeats = [
    "HYD-BEAT-1", "HYD-BEAT-2", "HYD-BEAT-3", "HYD-BEAT-4", "HYD-BEAT-5",
    "HYD-BEAT-6", "HYD-BEAT-7", "HYD-BEAT-8", "HYD-BEAT-9", "HYD-BEAT-10"
  ];

  console.log("\n--- 3. BEAT TERRITORY COVERAGE GAPS ---");
  for (const b of officialBeats) {
    const docCount = await db.doctor.count({ where: { beatName: { contains: b } } });
    const chemCount = await db.chemist.count({ where: { beatName: { contains: b } } });
    const visitCount = await db.visit.count({
      where: {
        OR: [
          { doctor: { beatName: { contains: b } } },
          { chemist: { beatName: { contains: b } } }
        ]
      }
    });
    console.log(`• ${b}: ${visitCount} visits | ${docCount} doctors | ${chemCount} chemists`);
  }

  // 4. MR FIELD ACTIVITY GAPS
  const mrs = await db.employee.findMany({
    where: { user: { role: "MR" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      user: { select: { email: true } },
      _count: { select: { visits: true } }
    }
  });

  console.log("\n--- 4. MR FIELD ACTIVITY GAPS ---");
  console.log(`• Total Field Representatives (MRs): ${mrs.length}`);
  for (const mr of mrs) {
    const visitsLast30d = await db.visit.count({
      where: { employeeId: mr.id, createdAt: { gte: thirtyDaysAgo } }
    });
    console.log(`• ${mr.firstName} ${mr.lastName} (${mr.user?.email}): ${mr._count.visits} total visits (${visitsLast30d} in last 30d)`);
  }

  // 5. LEAD PIPELINE GAPS
  const totalLeads = await db.lead.count();
  const leadsWithoutAction = await db.lead.count({ where: { followUpAction: null } });
  const leadsWithoutDate = await db.lead.count({ where: { followUpDate: null } });
  const overdueLeads = await db.lead.count({
    where: {
      status: { in: ["NEW", "IN_PROGRESS"] },
      followUpDate: { lt: now }
    }
  });
  const uncontactedLeads = await db.lead.count({ where: { status: "NEW" } });

  console.log("\n--- 5. LEAD OPPORTUNITY PIPELINE GAPS ---");
  console.log(`• Total Pipeline Leads: ${totalLeads}`);
  console.log(`• Uncontacted New Leads: ${uncontactedLeads}`);
  console.log(`• Leads Missing Follow-up Action Plan: ${leadsWithoutAction}`);
  console.log(`• Leads Missing Target Follow-up Date: ${leadsWithoutDate}`);
  console.log(`• Overdue Follow-up Leads: ${overdueLeads}`);

  // 6. TOUR PLAN VS FIELD VISIT GAPS
  const totalTourDays = await db.tourPlanDay.count();
  const incompleteTourDays = await db.tourPlanDay.count({ where: { isCompleted: false } });
  const completedTourDays = await db.tourPlanDay.count({ where: { isCompleted: true } });

  console.log("\n--- 6. TOUR PLAN VS ACTUAL VISIT GAPS ---");
  console.log(`• Total Tour Plan Days Planned: ${totalTourDays}`);
  console.log(`• Completed Field Plan Days: ${completedTourDays}`);
  console.log(`• Incomplete / Missed Planned Days: ${incompleteTourDays}`);

  console.log("\n=================================================================");
  console.log("                      AUDIT COMPLETED                            ");
  console.log("=================================================================");
  process.exit(0);
}

checkGaps().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
