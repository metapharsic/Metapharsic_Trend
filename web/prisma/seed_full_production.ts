import { PrismaClient, Role, OrderStatus, ExpenseStatus, AttendanceStatus, TourPlanStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Executing Complete Idempotent Seed for Production & Multi-Agent Council...");

  const standardPassword = await bcrypt.hash("Password@123", 10);
  const now = new Date();

  // 1. Ensure Workflow Settings
  await prisma.workflowSettings.upsert({
    where: { id: "singleton" },
    update: {
      geofenceRadiusMeters: 150,
      gpsAccuracyWarnMeters: 50,
      requirePhoto: false,
      enforceTourPlan: false,
    },
    create: {
      id: "singleton",
      geofenceRadiusMeters: 150,
      gpsAccuracyWarnMeters: 50,
      requirePhoto: false,
      enforceTourPlan: false,
    },
  });

  // 2. Core Users & Employees
  const usersToSeed = [
    { email: "admin@mrtracker.com", role: Role.ADMIN, firstName: "System", lastName: "Admin", phone: "+919999999999" },
    { email: "admin@trendmr.com", role: Role.ADMIN, firstName: "Executive", lastName: "Admin", phone: "+919999999998" },
    { email: "md@mrtracker.com", role: Role.MD, firstName: "Managing", lastName: "Director", phone: "+919999999997" },
    { email: "asm@mrtracker.com", role: Role.ASM, firstName: "Amit", lastName: "Sharma", phone: "+918888888888" },
    { email: "abdulmannan@mrtracker.com", role: Role.MR, firstName: "Abdul", lastName: "Mannan", phone: "+919876543219" },
    { email: "krishna@mrtracker.com", role: Role.MR, firstName: "Krishna", lastName: "Murthy", phone: "+919876543222" },
    { email: "mr@mrtracker.com", role: Role.MR, firstName: "Rajesh", lastName: "Kumar", phone: "+919876543210" },
    { email: "abdulmalik@metapharsic.com", role: Role.MR, firstName: "Abdul", lastName: "Malik", phone: "+919876543223" },
    { email: "abdulmubeen@mrtracker.com", role: Role.MR, firstName: "Abdul", lastName: "Mubeen", phone: "+919876543224" },
    { email: "finance@mrtracker.com", role: Role.FINANCE, firstName: "Finance", lastName: "Controller", phone: "+919999999996" },
    { email: "hr@mrtracker.com", role: Role.HR, firstName: "HR", lastName: "Head", phone: "+919999999995" },
  ];

  const employeeMap: Record<string, any> = {};

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: standardPassword,
        role: u.role,
        isActive: true,
      },
      create: {
        email: u.email,
        passwordHash: standardPassword,
        role: u.role,
        isActive: true,
      },
    });

    const emp = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
      },
      create: {
        userId: user.id,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
      },
    });

    employeeMap[u.email] = { user, employee: emp };
  }
  console.log(`✅ Created/Updated ${usersToSeed.length} core users & employees.`);

  // Link MR managers
  const asmEmp = employeeMap["asm@mrtracker.com"]?.employee;
  if (asmEmp) {
    for (const email of ["abdulmannan@mrtracker.com", "krishna@mrtracker.com", "mr@mrtracker.com", "abdulmalik@metapharsic.com", "abdulmubeen@mrtracker.com"]) {
      const emp = employeeMap[email]?.employee;
      if (emp) {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { managerId: asmEmp.id },
        });
      }
    }
  }

  // 3. Products
  const productsToSeed = [
    { name: "Metace-P", composition: "Aceclofenac 100mg + Paracetamol 325mg", sku: "MET-P-100", packSize: "10X10 Blister", price: 63.0, ptr: 63.0, pts: 55.0, mrp: 80.0, stockQty: 500, therapySegment: "Analgesics" },
    { name: "Metace-SP", composition: "Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg", sku: "MET-SP-100", packSize: "10X10 Alu Alu", price: 101.0, ptr: 101.0, pts: 90.0, mrp: 130.0, stockQty: 400, therapySegment: "Analgesics" },
    { name: "Pantometa-DSR", composition: "Pantoprazole 40mg + Domperidone 30mg (Cap)", sku: "PAN-DSR-100", packSize: "10X10 Alu Alu", price: 101.0, ptr: 101.0, pts: 90.0, mrp: 130.0, stockQty: 450, therapySegment: "Gastroenterology" },
    { name: "Rabemeta-DSR", composition: "Rabeprazole Sodium EC 20mg + Domperidone 30mg (Cap)", sku: "RAB-DSR-100", packSize: "10X10 Alu Alu", price: 92.0, ptr: 92.0, pts: 80.0, mrp: 120.0, stockQty: 350, therapySegment: "Gastroenterology" },
    { name: "Metaclav-CV", composition: "Amoxicillin 500mg + Clavulanic Acid 125mg", sku: "MET-CV-100", packSize: "10X10 Alu Alu", price: 474.0, ptr: 474.0, pts: 420.0, mrp: 590.0, stockQty: 300, therapySegment: "Anti-infectives" },
    { name: "Metaxime-200", composition: "Cefixime 200mg (Tab)", sku: "MET-XIM-200", packSize: "10X10 Alu Alu", price: 155.0, ptr: 155.0, pts: 135.0, mrp: 195.0, stockQty: 280, therapySegment: "Anti-infectives" },
  ];

  const productRecords = [];
  for (const p of productsToSeed) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { ...p },
      create: { ...p },
    });
    productRecords.push(prod);
  }
  console.log(`✅ Seeded ${productRecords.length} Pharmaceutical Products.`);

  // 4. Territories
  const territoryConfigs = [
    { name: "Santosh Nagar & Yakutpura", region: "South", zone: "Hyderabad", mrEmail: "abdulmannan@mrtracker.com" },
    { name: "Shanti Nagar & Taranaka", region: "South", zone: "Hyderabad", mrEmail: "krishna@mrtracker.com" },
    { name: "North Delhi Central", region: "North", zone: "Delhi", mrEmail: "mr@mrtracker.com" },
    { name: "Secunderabad Commercial", region: "South", zone: "Hyderabad", mrEmail: "abdulmalik@metapharsic.com" },
    { name: "Banjara Hills & Jubilee", region: "South", zone: "Hyderabad", mrEmail: "abdulmubeen@mrtracker.com" },
  ];

  const territoryMap: Record<string, any> = {};
  for (const t of territoryConfigs) {
    const mrEmp = employeeMap[t.mrEmail]?.employee;
    let terr = await prisma.territory.findFirst({ where: { name: t.name } });
    if (!terr) {
      terr = await prisma.territory.create({
        data: {
          name: t.name,
          region: t.region,
          zone: t.zone,
          employeeId: mrEmp?.id,
        },
      });
    } else if (mrEmp) {
      terr = await prisma.territory.update({
        where: { id: terr.id },
        data: { employeeId: mrEmp.id },
      });
    }
    territoryMap[t.mrEmail] = terr;
  }
  console.log(`✅ Seeded ${territoryConfigs.length} Territories.`);

  // 5. Doctors
  const doctorsToSeed = [
    { fullName: "Dr. K. Srinivas Rao", primarySpecialty: "Cardiology", hospitalName: "Apollo Hospitals", address: "Santosh Nagar, Hyderabad", latitude: 17.3524, longitude: 78.5023, terrKey: "abdulmannan@mrtracker.com" },
    { fullName: "Dr. Mohd Rizwan", primarySpecialty: "General Medicine", hospitalName: "Care Clinic", address: "Yakutpura, Hyderabad", latitude: 17.3621, longitude: 78.4912, terrKey: "abdulmannan@mrtracker.com" },
    { fullName: "Dr. Farhana Begum", primarySpecialty: "Gynecology", hospitalName: "Mother & Child Hospital", address: "Santosh Nagar, Hyderabad", latitude: 17.3562, longitude: 78.4988, terrKey: "abdulmannan@mrtracker.com" },
    { fullName: "Dr. A. K. Sharma", primarySpecialty: "Orthopedics", hospitalName: "Shanti Ortho Care", address: "Shanti Nagar, Hyderabad", latitude: 17.4011, longitude: 78.4623, terrKey: "krishna@mrtracker.com" },
    { fullName: "Dr. V. Ramesh", primarySpecialty: "Gastroenterology", hospitalName: "Taranaka Gastro Clinic", address: "Taranaka, Hyderabad", latitude: 17.4278, longitude: 78.5342, terrKey: "krishna@mrtracker.com" },
    { fullName: "Dr. S. N. Reddy", primarySpecialty: "Pulmonology", hospitalName: "City Chest Clinic", address: "North Delhi", latitude: 28.7041, longitude: 77.1025, terrKey: "mr@mrtracker.com" },
  ];

  const doctorMap: Record<string, any[]> = {};
  for (const d of doctorsToSeed) {
    const terr = territoryMap[d.terrKey];
    let doc = await prisma.doctor.findFirst({ where: { fullName: d.fullName } });
    if (!doc) {
      doc = await prisma.doctor.create({
        data: {
          fullName: d.fullName,
          primarySpecialty: d.primarySpecialty,
          clinicAddress: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          territoryId: terr?.id,
          dpsScore: 88.5,
        },
      });
    }
    if (!doctorMap[d.terrKey]) doctorMap[d.terrKey] = [];
    doctorMap[d.terrKey].push(doc);
  }
  console.log(`✅ Seeded ${doctorsToSeed.length} Doctors.`);

  // 6. Chemists & Distributors
  const chemistsToSeed = [
    { name: "MedPlus Pharmacy Santosh Nagar", contactPerson: "Ramesh Gupta", phone: "+919848011223", address: "Main Road, Santosh Nagar", latitude: 17.3530, longitude: 78.5030, terrKey: "abdulmannan@mrtracker.com" },
    { name: "Apollo Pharmacy Yakutpura", contactPerson: "Syed Imran", phone: "+919848011224", address: "Station Road, Yakutpura", latitude: 17.3615, longitude: 78.4920, terrKey: "abdulmannan@mrtracker.com" },
    { name: "Royal Medical & General Store", contactPerson: "Md. Shakeel", phone: "+919848011225", address: "Chanchalguda, Hyderabad", latitude: 17.3701, longitude: 78.4980, terrKey: "abdulmannan@mrtracker.com" },
    { name: "Shanti Medical Hall", contactPerson: "K. Suresh", phone: "+919848022334", address: "Shanti Nagar Cross Road", latitude: 17.4015, longitude: 78.4630, terrKey: "krishna@mrtracker.com" },
    { name: "Taranaka Pharma Hub", contactPerson: "B. Venkatesh", phone: "+919848022335", address: "Near Railway Gate, Taranaka", latitude: 17.4285, longitude: 78.5350, terrKey: "krishna@mrtracker.com" },
  ];

  const chemistMap: Record<string, any[]> = {};
  for (const c of chemistsToSeed) {
    const terr = territoryMap[c.terrKey];
    let chem = await prisma.chemist.findFirst({ where: { name: c.name } });
    if (!chem) {
      chem = await prisma.chemist.create({
        data: {
          name: c.name,
          contactPerson: c.contactPerson,
          mobile: c.phone,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          territoryId: terr?.id,
        },
      });
    }
    if (!chemistMap[c.terrKey]) chemistMap[c.terrKey] = [];
    chemistMap[c.terrKey].push(chem);
  }
  console.log(`✅ Seeded ${chemistsToSeed.length} Chemists.`);

  // 6b. Distributors
  const distributorMap: Record<string, any> = {};
  for (const t of territoryConfigs) {
    const terr = territoryMap[t.mrEmail];
    let dist = await prisma.distributor.findFirst({ where: { territoryId: terr?.id } });
    if (!dist && terr) {
      dist = await prisma.distributor.create({
        data: {
          name: `${t.name} Regional Pharma Distributors`,
          address: `Industrial Area, ${t.name}, ${t.zone}`,
          territoryId: terr.id,
          gstNo: "36AAAAA0000A1Z5",
          creditLimit: 500000.0,
        },
      });
    }
    distributorMap[t.mrEmail] = dist;
  }
  console.log(`✅ Seeded Distributors across territories.`);

  // 7. Seed Operational MR Work: Visits, Orders, Collections, Attendance, Expenses, Location Logs for Abdul Mannan and others
  for (const mrEmail of ["abdulmannan@mrtracker.com", "krishna@mrtracker.com", "mr@mrtracker.com"]) {
    const emp = employeeMap[mrEmail]?.employee;
    if (!emp) continue;

    const docs = doctorMap[mrEmail] || [];
    const chems = chemistMap[mrEmail] || [];
    const dist = distributorMap[mrEmail];

    // Attendance
    const today = new Date();
    today.setHours(9, 15, 0, 0);
    const checkOut = new Date();
    checkOut.setHours(18, 30, 0, 0);

    const existingAtt = await prisma.attendance.findFirst({
      where: { employeeId: emp.id },
    });
    if (!existingAtt) {
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date: today,
          checkIn: today,
          checkOut: checkOut,
          status: AttendanceStatus.PRESENT,
          latitude: 17.3524,
          longitude: 78.5023,
        },
      });
    }

    // Doctor Detailing Visits
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const visitTime = new Date();
      visitTime.setHours(10 + i * 2, 15, 0, 0);

      const visit = await prisma.visit.create({
        data: {
          employeeId: emp.id,
          doctorId: doc.id,
          purpose: "Detailed Metace-P & Pantometa-DSR with clinical trial reprints",
          durationMinutes: 18,
          cqsScore: 9.2,
          boxesPlaced: 10,
          latitude: doc.latitude || 17.3524,
          longitude: doc.longitude || 78.5023,
          createdAt: visitTime,
        },
      });

      // Samples placed
      if (productRecords.length > 0) {
        await prisma.sample.create({
          data: {
            visitId: visit.id,
            productId: productRecords[0].id,
            quantity: 5,
          },
        });
      }
    }

    // Chemist POB Orders & Secondary Sales
    for (let j = 0; j < chems.length; j++) {
      const chem = chems[j];
      const orderTime = new Date();
      orderTime.setHours(11 + j * 2, 45, 0, 0);

      const p1 = productRecords[0];
      const p2 = productRecords[1] || p1;

      if (dist) {
        await prisma.order.create({
          data: {
            employeeId: emp.id,
            chemistId: chem.id,
            distributorId: dist.id,
            status: OrderStatus.DELIVERED,
            createdAt: orderTime,
            items: {
              create: [
                { productId: p1.id, quantity: 50, price: p1.ptr || 63.0 },
                { productId: p2.id, quantity: 30, price: p2.ptr || 101.0 },
              ],
            },
          },
        });
      }

      // Chemist visit
      await prisma.visit.create({
        data: {
          employeeId: emp.id,
          chemistId: chem.id,
          purpose: "POB Booking and Stock Verification",
          durationMinutes: 15,
          cqsScore: 8.8,
          boxesPlaced: 15,
          latitude: chem.latitude || 17.3530,
          longitude: chem.longitude || 78.5030,
          createdAt: orderTime,
        },
      });

      // Collection
      await prisma.collection.create({
        data: {
          employeeId: emp.id,
          chemistId: chem.id,
          amount: 15000.0,
          refNumber: `REC-${chem.id.slice(0, 4)}-${Date.now().toString().slice(-4)}`,
          createdAt: orderTime,
        },
      });
    }

    // Field Expenses
    await prisma.expense.create({
      data: {
        employeeId: emp.id,
        category: "TRAVEL_DA",
        amount: 850.0,
        status: ExpenseStatus.APPROVED,
        description: "Field travel daily allowance (Santosh Nagar & Yakutpura route)",
        createdAt: now,
      },
    });
    await prisma.expense.create({
      data: {
        employeeId: emp.id,
        category: "DOCTOR_ENGAGEMENT",
        amount: 1200.0,
        status: ExpenseStatus.APPROVED,
        description: "Doctor CME Round Table Refreshments",
        createdAt: now,
      },
    });

    // Tour Plan (MTP)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    await prisma.tourPlan.upsert({
      where: {
        employeeId_month: {
          employeeId: emp.id,
          month: monthStart,
        },
      },
      update: {
        status: TourPlanStatus.APPROVED,
      },
      create: {
        employeeId: emp.id,
        month: monthStart,
        status: TourPlanStatus.APPROVED,
      },
    });

    // Location Logs
    await prisma.locationLog.create({
      data: {
        employeeId: emp.id,
        latitude: 17.3524,
        longitude: 78.5023,
        isMocked: false,
        recordedAt: now,
      },
    });
  }

  console.log("✅ Seeded Comprehensive Field Operational Work (Visits, Orders, POB, Collections, Expenses, Attendance, Telemetry) for all MRs.");
  console.log("=== SEEDING COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
