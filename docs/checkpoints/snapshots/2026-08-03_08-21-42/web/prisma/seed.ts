import { PrismaClient, Role, TourPlanStatus, TenderStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { startOfUtcDay, startOfUtcMonth } from "../lib/date";
import { calculateDps } from "../lib/dps";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding production database...");

  // 1. Create Admin User & Employee
  const adminPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@mrtracker.com" },
    update: {},
    create: {
      email: "admin@mrtracker.com",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const adminEmployee = await prisma.employee.create({
    data: {
      userId: adminUser.id,
      firstName: "Admin",
      lastName: "Manager",
      phone: "+919999999999",
    },
  });
  console.log(`✅ Admin User created: ${adminUser.email}`);

  // 2. Create ASM (Manager) User & Employee
  const asmPassword = await bcrypt.hash("asm123", 12);
  const asmUser = await prisma.user.upsert({
    where: { email: "asm@mrtracker.com" },
    update: {},
    create: {
      email: "asm@mrtracker.com",
      passwordHash: asmPassword,
      role: Role.ASM,
      isActive: true,
    },
  });

  const asmEmployee = await prisma.employee.create({
    data: {
      userId: asmUser.id,
      firstName: "Amit",
      lastName: "Sharma",
      phone: "+918888888888",
    },
  });
  console.log(`✅ ASM (Manager) User created: ${asmUser.email}`);

  // 3. Create MR User & Employee (reporting to ASM)
  const mrPassword = await bcrypt.hash("mr12345", 12);
  const mrUser = await prisma.user.upsert({
    where: { email: "mr@mrtracker.com" },
    update: {},
    create: {
      email: "mr@mrtracker.com",
      passwordHash: mrPassword,
      role: Role.MR,
      isActive: true,
      deviceUuid: null,
    },
  });

  const mrEmployee = await prisma.employee.create({
    data: {
      userId: mrUser.id,
      firstName: "Rajesh",
      lastName: "Kumar",
      phone: "+919876543210",
      managerId: asmEmployee.id,
    },
  });
  console.log(`✅ MR User created: ${mrUser.email}`);

  // 4. Create Mapped Territory
  const territory = await prisma.territory.create({
    data: {
      name: "North Delhi Central",
      region: "North",
      zone: "Delhi",
      employeeId: mrEmployee.id,
    },
  });
  console.log(`✅ Territory created: ${territory.name}`);

  // 5. Create Doctor
  const doctor = await prisma.doctor.create({
    data: {
      fullName: "Dr. Sandeep Sharma",
      primarySpecialty: "Cardiology",
      clinicAddress: "12 Model Town, North Delhi",
      latitude: 28.7041,
      longitude: 77.1025,
      territoryId: territory.id,
      patientFootfallDaily: 35,
      avgPrescriptionsDaily: 15,
      whatsApp: "+919876543211",
      prefCommMode: "WhatsApp",
    },
  });
  console.log(`✅ Doctor created: ${doctor.fullName}`);

  // 6. Create Chemist
  const chemist = await prisma.chemist.create({
    data: {
      name: "MedPlus Pharmacy",
      contactPerson: "Vijay Gupta",
      address: "88 Main Bazaar, North Delhi",
      latitude: 28.6900,
      longitude: 77.0950,
      territoryId: territory.id,
      licenseNo: "CHEM-DEL-2026-993",
      type: "RETAIL",
      mobile: "+919876543212",
    },
  });
  console.log(`✅ Chemist created: ${chemist.name}`);

  // 7. Create Hospital
  const hospital = await prisma.hospital.create({
    data: {
      name: "City General Hospital",
      address: "45 Ring Road, North Delhi",
      latitude: 28.7200,
      longitude: 77.1100,
      territoryId: territory.id,
      departments: "Cardiology, Oncology, Pediatrics",
      purchaseManager: "Sanjay Mehta",
      bedStrength: 150,
      type: "PRIVATE",
    },
  });
  console.log(`✅ Hospital created: ${hospital.name}`);

  // 8. Create Distributor
  const distributor = await prisma.distributor.create({
    data: {
      name: "North Delhi Pharma Distributors",
      address: "5 Industrial Area, North Delhi",
      territoryId: territory.id,
      gstNo: "07AAACD1234E1Z5",
      licenseNo: "DIST-DEL-2026-441",
    },
  });
  console.log(`✅ Distributor created: ${distributor.name}`);

  // 9. Create Product
  const product = await prisma.product.create({
    data: {
      name: "Cardiace 5mg",
      sku: "CRD-5MG-10",
      price: 120.0,
      composition: "Ramipril",
      strength: "5mg",
      packSize: "10 tablets",
      mrp: 150.0,
      ptr: 120.0,
      pts: 110.0,
      therapySegment: "Cardiology",
      stockQty: 500,
    },
  });
  console.log(`✅ Product created: ${product.name}`);

  // 10. Create an approved Tour Plan for the MR covering today,
  // so the DCR geofence check-in demo flow keeps working now that
  // visits require the doctor to be on an approved TP calendar day.
  const monthStart = startOfUtcMonth();
  const todayStart = startOfUtcDay();

  const tourPlan = await prisma.tourPlan.create({
    data: {
      employeeId: mrEmployee.id,
      month: monthStart,
      status: TourPlanStatus.APPROVED,
      approvedById: asmEmployee.id,
      days: {
        create: [
          {
            date: todayStart,
            territoryId: territory.id,
            plannedDoctorId: doctor.id,
          },
        ],
      },
    },
  });
  console.log(`✅ Approved Tour Plan created for today, covering ${doctor.fullName}`);

  // 11. Sales target for the MR, so payroll incentive calculations have a denominator.
  await prisma.target.create({
    data: {
      employeeId: mrEmployee.id,
      territoryId: territory.id,
      value: 200000.0,
      startDate: monthStart,
      endDate: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)),
    },
  });
  console.log("✅ Sales target created for MR");

  // 12. Hospital tender + formulary entry (Phase 4 institutional sales)
  await prisma.hospitalTender.create({
    data: {
      hospitalId: hospital.id,
      productId: product.id,
      tenderNo: "TND-2026-0001",
      contractRate: 105.0,
      quantity: 2000,
      status: TenderStatus.SUBMITTED,
      validFrom: monthStart,
      validTo: new Date(Date.UTC(monthStart.getUTCFullYear() + 1, monthStart.getUTCMonth(), 1)),
    },
  });
  await prisma.hospitalFormulary.create({
    data: {
      hospitalId: hospital.id,
      productId: product.id,
      included: true,
      notes: "Approved by Pharmacy & Therapeutics committee",
      reviewedAt: new Date(),
    },
  });
  console.log("✅ Hospital tender + formulary entry created");

  // 13. LMS course
  const course = await prisma.lMSCourse.create({
    data: {
      title: "Cardiology Detailing Fundamentals",
      description: "Product knowledge and detailing technique for the cardiology portfolio.",
    },
  });
  console.log(`✅ LMS course created: ${course.title}`);

  await prisma.lMSEnrollment.create({
    data: {
      employeeId: mrEmployee.id,
      courseId: course.id,
      progressPercent: 60,
      quizScore: null,
      completed: false,
    },
  });
  console.log("✅ MR enrolled in course (60% progress)");

  // Discount scheme, auto-applied by /api/orders/secondary at qualifying quantities.
  await prisma.discountScheme.create({
    data: {
      name: "Cardiace Bulk 50+",
      productId: product.id,
      minQuantity: 50,
      discountPct: 5,
      isActive: true,
      validFrom: monthStart,
      validTo: new Date(Date.UTC(monthStart.getUTCFullYear() + 1, monthStart.getUTCMonth(), 1)),
    },
  });
  console.log("✅ Discount scheme created: 5% at 50+ units");

  // 14. DPS scoring for seeded doctors
  const dps = calculateDps({
    patientFootfallDaily: doctor.patientFootfallDaily,
    avgPrescriptionsDaily: doctor.avgPrescriptionsDaily,
    influencerLevel: doctor.influencerLevel,
    territoryPriority: territory.priority,
    engagementScore: 0,
  });
  await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      dpsScore: dps.score,
      dpsTier: dps.tier,
      requiredMonthlyVisits: dps.requiredMonthlyVisits,
      dpsCalculatedAt: new Date(),
      intelligenceScore: Math.round(dps.score),
    },
  });
  console.log(`✅ DPS scored: ${doctor.fullName} → ${dps.score} (tier ${dps.tier})`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Credentials:");
  console.log("  Admin  → email: admin@mrtracker.com | password: admin123");
  console.log("  ASM    → email: asm@mrtracker.com   | password: asm123");
  console.log("  MR     → email: mr@mrtracker.com    | password: mr12345");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
