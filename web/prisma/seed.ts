import { PrismaClient, Role, TourPlanStatus, TenderStatus, LeadStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { startOfUtcDay, startOfUtcMonth } from "../lib/date";
import { calculateDps } from "../lib/dps";
import { DEFAULT_CHART_OF_ACCOUNTS, SYSTEM_ACCOUNT_CODES } from "../lib/ledger";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding production database with core users & call sheet records...");

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

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      firstName: "Admin",
      lastName: "Manager",
      phone: "+919999999999",
    },
  });
  console.log(`✅ Admin User created: ${adminUser.email}`);

  // Seed MD
  const mdPassword = await bcrypt.hash("md12345", 12);
  const mdUser = await prisma.user.upsert({
    where: { email: "md@mrtracker.com" },
    update: {},
    create: {
      email: "md@mrtracker.com",
      passwordHash: mdPassword,
      role: Role.MD,
      isActive: true,
    },
  });

  await prisma.employee.upsert({
    where: { userId: mdUser.id },
    update: {},
    create: {
      userId: mdUser.id,
      firstName: "Managing",
      lastName: "Director",
      phone: "+910000000000",
    },
  });
  console.log(`✅ Seeded role user: ${mdUser.email} (MD)`);

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

  const asmEmployee = await prisma.employee.upsert({
    where: { userId: asmUser.id },
    update: {},
    create: {
      userId: asmUser.id,
      firstName: "Amit",
      lastName: "Sharma",
      phone: "+918888888888",
    },
  });
  console.log(`✅ ASM (Manager) User created: ${asmUser.email}`);

  // 3. Create MR Users (reporting to ASM)
  const mrPassword = await bcrypt.hash("mr12345", 12);
  
  // Rajesh Kumar
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

  const mrEmployee = await prisma.employee.upsert({
    where: { userId: mrUser.id },
    update: {},
    create: {
      userId: mrUser.id,
      firstName: "Rajesh",
      lastName: "Kumar",
      phone: "+919876543210",
      managerId: asmEmployee.id,
    },
  });
  console.log(`✅ MR User created: ${mrUser.email}`);

  // Abdul Mannan
  const abdulUser = await prisma.user.upsert({
    where: { email: "abdulmannan@mrtracker.com" },
    update: {},
    create: {
      email: "abdulmannan@mrtracker.com",
      passwordHash: mrPassword,
      role: Role.MR,
      isActive: true,
      deviceUuid: null,
    },
  });

  const abdulEmployee = await prisma.employee.upsert({
    where: { userId: abdulUser.id },
    update: {},
    create: {
      userId: abdulUser.id,
      firstName: "Abdul",
      lastName: "Mannan",
      phone: "+919876543219",
      managerId: asmEmployee.id,
    },
  });
  console.log(`✅ MR User created: ${abdulUser.email}`);

  // Krishna Murthy
  const krishnaUser = await prisma.user.upsert({
    where: { email: "krishna@mrtracker.com" },
    update: {},
    create: {
      email: "krishna@mrtracker.com",
      passwordHash: mrPassword,
      role: Role.MR,
      isActive: true,
      deviceUuid: null,
    },
  });

  const krishnaEmployee = await prisma.employee.upsert({
    where: { userId: krishnaUser.id },
    update: {},
    create: {
      userId: krishnaUser.id,
      firstName: "Krishna",
      lastName: "Murthy",
      phone: "+919876543222",
      managerId: asmEmployee.id,
    },
  });
  console.log(`✅ MR User created: ${krishnaUser.email}`);

  // 4. Create Mapped Territories
  // Rajesh's Territory
  const territory = await prisma.territory.create({
    data: {
      name: "North Delhi Central",
      region: "North",
      zone: "Delhi",
      employeeId: mrEmployee.id,
    },
  });
  console.log(`✅ Rajesh Territory created: ${territory.name}`);

  // Abdul's Territory (updated as per call sheet: Santosh Nagar & Yakutpura)
  const abdulTerritory = await prisma.territory.create({
    data: {
      name: "Santosh Nagar & Yakutpura",
      region: "South",
      zone: "Hyderabad",
      employeeId: abdulEmployee.id,
    },
  });
  console.log(`✅ Abdul Territory created: ${abdulTerritory.name}`);

  // Krishna's Territory (updated as per call sheet: Shanti Nagar & Taranaka)
  const krishnaTerritory = await prisma.territory.create({
    data: {
      name: "Shanti Nagar & Taranaka",
      region: "South",
      zone: "Hyderabad",
      employeeId: krishnaEmployee.id,
    },
  });
  console.log(`✅ Krishna Territory created: ${krishnaTerritory.name}`);

  // 5. Create Products (updated according to inventory specs)
  const productsToSeed = [
    {
      name: "Metace-P",
      composition: "Aceclofenac 100mg + Paracetamol 325mg",
      sku: "MET-P-100",
      packSize: "10X10 Blister",
      stockQty: 500,
      price: 63.00,
      ptr: 63.00,
      mrp: 80.00,
      pts: 55.00,
      therapySegment: "Analgesics",
    },
    {
      name: "Metace-SP",
      composition: "Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg",
      sku: "MET-SP-100",
      packSize: "10X10 Alu Alu",
      stockQty: 300,
      price: 101.00,
      ptr: 101.00,
      mrp: 130.00,
      pts: 90.00,
      therapySegment: "Analgesics",
    },
    {
      name: "Pantometa-DSR",
      composition: "Pantoprazole 40mg + Domperidone 30mg (Cap)",
      sku: "PAN-DSR-100",
      packSize: "10X10 Alu Alu",
      stockQty: 300,
      price: 101.00,
      ptr: 101.00,
      mrp: 130.00,
      pts: 90.00,
      therapySegment: "Gastroenterology",
    },
    {
      name: "Rabemeta-DSR",
      composition: "Rabeprazole Sodium EC 20mg + Domperidone 30mg (Cap)",
      sku: "RAB-DSR-100",
      packSize: "10X10 Alu Alu",
      stockQty: 300,
      price: 92.00,
      ptr: 92.00,
      mrp: 120.00,
      pts: 80.00,
      therapySegment: "Gastroenterology",
    },
    {
      name: "Metaclav-CV",
      composition: "Amoxicillin 500mg + Clavulanic Acid 125mg (DPCO)",
      sku: "MET-CV-100",
      packSize: "10X10 Alu Alu",
      stockQty: 300,
      price: 474.00,
      ptr: 474.00,
      mrp: 590.00,
      pts: 420.00,
      therapySegment: "Anti-infectives",
    },
    {
      name: "Metacef-200",
      composition: "Cefixime 200mg (DPCO)",
      sku: "MET-CEF-200",
      packSize: "10X10 Alu Alu",
      stockQty: 300,
      price: 298.00,
      ptr: 298.00,
      mrp: 370.00,
      pts: 260.00,
      therapySegment: "Anti-infectives",
    },
    {
      name: "Metacol-650",
      composition: "Paracetamol 650mg",
      sku: "MET-COL-650",
      packSize: "10X15 Blister",
      stockQty: 300,
      price: 112.00,
      ptr: 112.00,
      mrp: 140.00,
      pts: 100.00,
      therapySegment: "Analgesics",
    },
  ];

  const products = [];
  for (const prodData of productsToSeed) {
    const prod = await prisma.product.create({ data: prodData });
    products.push(prod);
  }
  console.log("✅ Seeded products segment");

  // --- Seed Entities and Calls for Abdul Mannan (Santosh Nagar & Yakutpura) ---
  const abdulDocsData = [
    { name: "Dr. Shoaib", clinic: "Pure Health Care Polyclinic", area: "Santosh Nagar" },
    { name: "Dr. Fatima", clinic: "Fatima Clinic", area: "Santosh Nagar" },
    { name: "Dr. Abdul Sayeed", clinic: "Yakutpura Clinic", area: "Yakutpura" },
    { name: "Dr. Arbaz", clinic: "Dr. Arbaz Clinic", area: "Rein Bazar" },
    { name: "Dr. Owais", clinic: "Madina Clinic", area: "Santosh Nagar" },
    { name: "Dr. Haji Saheb", clinic: "People's Clinic", area: "Santosh Nagar" },
    { name: "Dr. Hashmi", clinic: "Shafi Clinic", area: "Yakutpura" },
    { name: "Dr. Salim", clinic: "Baba Nagar Clinic", area: "Baba Nagar" },
    { name: "Dr. Irfan", clinic: "Irfan Clinic", area: "Baba Nagar" },
    { name: "Dr. Zakariya", clinic: "Saba Medical Clinic", area: "Santosh Nagar" },
    { name: "Dr. Amaan", clinic: "Santosh Nagar Dental", area: "Santosh Nagar" },
    { name: "Dr. Al-Rauf", clinic: "Al-Rauf Clinic", area: "Santosh Nagar" }
  ];

  const abdulDocs: Record<string, any> = {};
  let latIdx = 0;
  for (const d of abdulDocsData) {
    const doc = await prisma.doctor.create({
      data: {
        fullName: d.name,
        primarySpecialty: "General Medicine",
        clinicAddress: `${d.clinic}, ${d.area}`,
        latitude: 17.3592 + (latIdx * 0.001),
        longitude: 78.5065 - (latIdx * 0.001),
        territoryId: abdulTerritory.id,
        patientFootfallDaily: 30,
        avgPrescriptionsDaily: 12,
      }
    });
    abdulDocs[d.name] = doc;
    latIdx++;
  }

  const abdulChemistsData = [
    { name: "Raza Medical Store", area: "Yakutpura", limit: 25000.0 },
    { name: "Orange Pharmacy", area: "Yakutpura" },
    { name: "Rahman Medical & General Store", area: "Yakutpura" },
    { name: "Shia Pharmacy", area: "Rein Bazar" },
    { name: "Al-Jaffer Medical Hall", area: "Santosh Nagar" },
    { name: "Raza Medical", area: "Santosh Nagar" },
    { name: "Good Health", area: "Santosh Nagar" },
    { name: "Madina Medical", area: "Santosh Nagar" },
    { name: "Noman Pharmacy", area: "Santosh Nagar" },
    { name: "Usman Medical", area: "Baba Nagar" },
    { name: "Azeem Pharmacy", area: "Baba Nagar" },
    { name: "Anas Pharmacy", area: "Santosh Nagar" },
    { name: "Al Saba", area: "Santosh Nagar" }
  ];

  const abdulChems: Record<string, any> = {};
  for (const c of abdulChemistsData) {
    const chem = await prisma.chemist.create({
      data: {
        name: c.name,
        contactPerson: "Chemist In-Charge",
        address: `${c.name}, ${c.area}`,
        latitude: 17.3592 + (latIdx * 0.0015),
        longitude: 78.5065 - (latIdx * 0.0015),
        territoryId: abdulTerritory.id,
        creditLimit: c.limit ?? 10000.0,
      }
    });
    abdulChems[c.name] = chem;
    latIdx++;
  }
  console.log("✅ Seeded Abdul Mannan's client entities");

  // Seed Calls/Visits for Abdul Mannan (Date: 07/27/2026)
  const callDate = new Date("2026-07-27T10:00:00Z");

  const abdulCalls = [
    { doc: "Dr. Shoaib", purpose: "Product Detailing", feedback: "Discussed new promotion strategy and portfolio expansion", boxes: 2, leadStatus: LeadStatus.NEW, leadDetails: "Interested in trailing Rabemeta-DSR", followUp: new Date("2026-08-03") },
    { doc: "Dr. Fatima", purpose: "Routine Visit", feedback: "Current: 10+7 -> Proposed: 10+7 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Abdul Sayeed", purpose: "Routine Visit", feedback: "Current: 10+8 (20%) -> Proposed: 0", followUp: new Date("2026-08-03") },
    { chem: "Raza Medical Store", purpose: "Stock Audit", feedback: "Current: 10+5 -> Proposed: 10+7 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Arbaz", purpose: "Routine Visit", feedback: "Current: 10+7 -> Proposed: 0", followUp: new Date("2026-08-03") },
    { doc: "Dr. Owais", purpose: "Routine Visit", feedback: "Current: 10+7 -> Proposed: 10+7 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Haji Saheb", purpose: "Routine Visit", feedback: "Current: 10+7 -> Proposed: 10+7 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Salim", purpose: "Routine Visit", feedback: "Current: 10+8 -> Proposed: 10+8 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Irfan", purpose: "Routine Visit", feedback: "Current: 10+5 -> Proposed: 10+5 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Zakariya", purpose: "Routine Visit", feedback: "Current: 10+5 -> Proposed: 10+5 (20% increase)", followUp: new Date("2026-08-03") },
    { doc: "Dr. Amaan", purpose: "Routine Visit", feedback: "Current: 0 Proposed", followUp: new Date("2026-08-03") },
    { chem: "Orange Pharmacy", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Rahman Medical & General Store", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Shia Pharmacy", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Al-Jaffer Medical Hall", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Raza Medical", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Good Health", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Madina Medical", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { doc: "Dr. Al-Rauf", purpose: "Routine Visit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Noman Pharmacy", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Usman Medical", purpose: "Stock Audit", feedback: "free strip promotion 10+5", followUp: new Date("2026-08-03") },
    { chem: "Azeem Pharmacy", purpose: "Stock Audit", feedback: "free strip promotion 10+5", followUp: new Date("2026-08-03") },
    { chem: "Anas Pharmacy", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") },
    { chem: "Al Saba", purpose: "Stock Audit", feedback: "free strip promotion", followUp: new Date("2026-08-03") }
  ];

  for (const call of abdulCalls) {
    const v = await prisma.visit.create({
      data: {
        employeeId: abdulEmployee.id,
        doctorId: call.doc ? abdulDocs[call.doc]?.id : null,
        chemistId: call.chem ? abdulChems[call.chem]?.id : null,
        purpose: call.purpose,
        feedback: call.feedback,
        boxesPlaced: call.boxes ?? 0,
        followUpDate: call.followUp,
        latitude: 17.3592,
        longitude: 78.5065,
        createdAt: callDate,
      }
    });

    if (call.leadStatus) {
      await prisma.lead.create({
        data: {
          visitId: v.id,
          employeeId: abdulEmployee.id,
          status: call.leadStatus,
          details: call.leadDetails,
        }
      });
    }
  }

  // --- Seed Entities and Calls for Krishna Murthy (Shanti Nagar & Taranaka) ---
  const krishnaDocsData = [
    { name: "Dr. S Krishna Yeadhar", clinic: "Jyothi Clinic", area: "Shanti Nagar" },
    { name: "Dr. Aliya Afreen", clinic: "Maxicare Clinic", area: "Taranaka" },
    { name: "Dr. Karthik", clinic: "Laxmi Multispecialty", area: "Taranaka" },
    { name: "Dr. Samir S Bachar", clinic: "Dr. Samir Clinic", area: "Shanti Nagar" },
    { name: "Dr. Anil Kumar", clinic: "First Day Clinic", area: "Taranaka" }
  ];

  const krishnaDocs: Record<string, any> = {};
  for (const d of krishnaDocsData) {
    const doc = await prisma.doctor.create({
      data: {
        fullName: d.name,
        primarySpecialty: "General Medicine",
        clinicAddress: `${d.clinic}, ${d.area}`,
        latitude: 17.4255 + (latIdx * 0.001),
        longitude: 78.5312 - (latIdx * 0.001),
        territoryId: krishnaTerritory.id,
        patientFootfallDaily: 35,
        avgPrescriptionsDaily: 14,
      }
    });
    krishnaDocs[d.name] = doc;
    latIdx++;
  }

  const krishnaChemistsData = [
    { name: "Srinivasa medical and general store", area: "Taranaka" },
    { name: "Meera Medical Hall", area: "Taranaka" }
  ];

  const krishnaChems: Record<string, any> = {};
  for (const c of krishnaChemistsData) {
    const chem = await prisma.chemist.create({
      data: {
        name: c.name,
        contactPerson: "Chemist In-Charge",
        address: `${c.name}, ${c.area}`,
        latitude: 17.4255 + (latIdx * 0.0015),
        longitude: 78.5312 - (latIdx * 0.0015),
        territoryId: krishnaTerritory.id,
        creditLimit: 15000.0,
      }
    });
    krishnaChems[c.name] = chem;
    latIdx++;
  }

  // Seed Calls/Visits for Krishna Murthy (Date: 07/27/2026)
  const krishnaCalls = [
    { doc: "Dr. S Krishna Yeadhar", purpose: "Product Detailing", feedback: "Need to Visit Tomorrow again in 28/7/2025", leadStatus: LeadStatus.NEW, leadDetails: "Will discuss about Rabemeta as per doctor suggestion", followUp: new Date("2026-07-28") },
    { doc: "Dr. Aliya Afreen", purpose: "Box Placement", feedback: "Need to place boxes tomorrow", leadStatus: LeadStatus.CONVERTED, leadDetails: "Doctor suggested Metaclav CV", followUp: new Date("2026-07-28") },
    { doc: "Dr. Karthik", purpose: "Follow-up", feedback: "Will be placing the box very soon", leadStatus: LeadStatus.IN_PROGRESS, leadDetails: "Explained doctor about the products", followUp: new Date("2026-07-30") },
    { chem: "Srinivasa medical and general store", purpose: "Box Placement", feedback: "Doctor suggested to place Metacol 650", leadStatus: LeadStatus.CONVERTED, followUp: new Date("2026-07-28") },
    { doc: "Dr. Samir S Bachar", purpose: "Box Placement", feedback: "Doctor suggested to place All Medicine", leadStatus: LeadStatus.CONVERTED, followUp: new Date("2026-07-28") },
    { doc: "Dr. Anil Kumar", purpose: "Box Placement", feedback: "Doctor suggested to place All Medicine", leadStatus: LeadStatus.CONVERTED, followUp: new Date("2026-07-28") },
    { chem: "Meera Medical Hall", purpose: "Box Placement", feedback: "Placed All boxes. Need to give receipt.", leadStatus: LeadStatus.CONVERTED, followUp: new Date("2026-07-30") }
  ];

  for (const call of krishnaCalls) {
    const v = await prisma.visit.create({
      data: {
        employeeId: krishnaEmployee.id,
        doctorId: call.doc ? krishnaDocs[call.doc]?.id : null,
        chemistId: call.chem ? krishnaChems[call.chem]?.id : null,
        purpose: call.purpose,
        feedback: call.feedback,
        boxesPlaced: 0,
        followUpDate: call.followUp,
        latitude: 17.4255,
        longitude: 78.5312,
        createdAt: callDate,
      }
    });

    if (call.leadStatus) {
      await prisma.lead.create({
        data: {
          visitId: v.id,
          employeeId: krishnaEmployee.id,
          status: call.leadStatus,
          details: call.leadDetails || "",
        }
      });
    }
  }
  const todayStart = startOfUtcDay();

  // Approved Tour Plan for Rajesh covering today
  const monthStart = startOfUtcMonth();
  const rajeshDoc = await prisma.doctor.create({
    data: {
      fullName: "Dr. Sandeep Sharma",
      primarySpecialty: "General Medicine",
      clinicAddress: "12 Model Town, North Delhi",
      latitude: 28.7041,
      longitude: 77.1025,
      territoryId: territory.id,
      patientFootfallDaily: 35,
      avgPrescriptionsDaily: 15,
    }
  });

  await prisma.tourPlan.create({
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
            plannedDoctorId: rajeshDoc.id,
          },
        ],
      },
    },
  });
  console.log("✅ Tour Plan configuration completed");

  console.log("🌱 Seeding default chart of accounts...");
  const systemCodes = new Set<string>(Object.values(SYSTEM_ACCOUNT_CODES));
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: {},
      create: { ...acc, isSystem: systemCodes.has(acc.code) },
    });
  }
  console.log(`✅ Chart of accounts seeded (${DEFAULT_CHART_OF_ACCOUNTS.length} accounts)`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Credentials:");
  console.log("  Admin        → email: admin@mrtracker.com        | password: admin123");
  console.log("  ASM          → email: asm@mrtracker.com          | password: asm123");
  console.log("  MR (Rajesh)  → email: mr@mrtracker.com           | password: mr12345");
  console.log("  MR (Abdul)   → email: abdulmannan@mrtracker.com  | password: mr12345");
  console.log("  MR (Krishna) → email: krishna@mrtracker.com      | password: mr12345");
  console.log("  MD           → email: md@mrtracker.com           | password: md12345");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
