import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

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
  const mrPassword = await bcrypt.hash("mr123", 12);
  const mrUser = await prisma.user.upsert({
    where: { email: "mr@mrtracker.com" },
    update: {},
    create: {
      email: "mr@mrtracker.com",
      passwordHash: mrPassword,
      role: Role.MR,
      isActive: true,
      deviceUuid: "mock-device-uuid-12345",
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

  console.log("\n🎉 Seed complete!\n");
  console.log("Credentials:");
  console.log("  Admin  → email: admin@mrtracker.com | password: admin123");
  console.log("  ASM    → email: asm@mrtracker.com   | password: asm123");
  console.log("  MR     → email: mr@mrtracker.com    | password: mr123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
