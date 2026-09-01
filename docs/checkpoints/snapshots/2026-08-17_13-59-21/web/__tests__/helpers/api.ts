import { NextRequest } from "next/server";
import { PrismaClient, Role, TourPlanStatus } from "@prisma/client";
import jwt from "jsonwebtoken";
import { startOfUtcDay, startOfUtcMonth } from "../../lib/date";

export const testDb = new PrismaClient();

/** Signs a token the same way lib/auth does, so withAuth accepts it. */
export function tokenFor(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "15m" });
}

export function jsonRequest(
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  return new NextRequest(new URL(url, "http://localhost"), {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

export function formRequest(
  url: string,
  form: Record<string, string | Blob>,
  options: { token?: string } = {}
): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(form)) formData.append(key, value as any);

  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    headers,
    body: formData as any,
  });
}

export async function readJson(res: Response): Promise<any> {
  return res.json();
}

/** Route handlers that take no dynamic segment still receive a context object. */
export const noParams = { params: {} as Record<string, string | string[] | undefined> };

export interface TestFixture {
  adminUserId: string;
  asmUserId: string;
  mrUserId: string;
  mrEmployeeId: string;
  territoryId: string;
  doctorId: string;
  chemistId: string;
  hospitalId: string;
  distributorId: string;
  productId: string;
}

/**
 * Wipes and rebuilds a minimal dataset. Called per suite so tests never depend
 * on each other's writes.
 */
export async function resetFixture(): Promise<TestFixture> {
  await testDb.$executeRawUnsafe(`
    TRUNCATE TABLE "HospitalTender", "HospitalFormulary", "DiscountScheme",
      "LMSEnrollment", "LMSCourse", "TourPlanDay", "TourPlan", "OrderItem", "Order",
      "Expense", "Visit", "Sample", "SampleInventory", "Gift", "Attendance", "Collection", "Target", "LocationLog",
      "Distributor", "Product", "Hospital", "Chemist", "Doctor", "Territory",
      "Employee", refresh_tokens, "User" CASCADE
  `);

  const mk = async (email: string, role: Role, first: string, last: string, phone: string) => {
    const user = await testDb.user.create({
      data: { email, passwordHash: "$2b$12$notarealhash", role, isActive: true },
    });
    const employee = await testDb.employee.create({
      data: { userId: user.id, firstName: first, lastName: last, phone },
    });
    return { user, employee };
  };

  const admin = await mk("admin@test.local", Role.ADMIN, "Admin", "User", "+911111111111");
  const asm = await mk("asm@test.local", Role.ASM, "Asm", "User", "+912222222222");
  const mr = await mk("mr@test.local", Role.MR, "Mr", "User", "+913333333333");

  const territory = await testDb.territory.create({
    data: { name: "Test Territory", region: "R", zone: "Z", priority: 1, employeeId: mr.employee.id },
  });

  const doctor = await testDb.doctor.create({
    data: {
      fullName: "Dr. Test",
      primarySpecialty: "Cardiology",
      clinicAddress: "1 Test St",
      latitude: 28.7041,
      longitude: 77.1025,
      territoryId: territory.id,
      patientFootfallDaily: 35,
      avgPrescriptionsDaily: 15,
    },
  });

  const chemist = await testDb.chemist.create({
    data: {
      name: "Test Chemist",
      contactPerson: "Owner",
      address: "2 Test St",
      latitude: 28.69,
      longitude: 77.095,
      territoryId: territory.id,
    },
  });

  const hospital = await testDb.hospital.create({
    data: {
      name: "Test Hospital",
      address: "3 Test St",
      latitude: 28.72,
      longitude: 77.11,
      territoryId: territory.id,
      bedStrength: 100,
    },
  });

  const distributor = await testDb.distributor.create({
    data: { name: "Test Distributor", address: "4 Test St", territoryId: territory.id },
  });

  const product = await testDb.product.create({
    data: {
      name: "Test Product",
      sku: "TEST-001",
      price: 120,
      mrp: 150,
      ptr: 120,
      pts: 110,
      therapySegment: "Cardiology",
      stockQty: 500,
    },
  });

  await testDb.sampleInventory.create({
    data: {
      employeeId: mr.employee.id,
      productId: product.id,
      quantity: 50,
    },
  });

  return {
    adminUserId: admin.user.id,
    asmUserId: asm.user.id,
    mrUserId: mr.user.id,
    mrEmployeeId: mr.employee.id,
    territoryId: territory.id,
    doctorId: doctor.id,
    chemistId: chemist.id,
    hospitalId: hospital.id,
    distributorId: distributor.id,
    productId: product.id,
  };
}

/** Approves a tour plan covering today for the MR, so DCR submission is permitted. */
export async function approveTourPlanForToday(fx: TestFixture): Promise<void> {
  await testDb.tourPlan.create({
    data: {
      employeeId: fx.mrEmployeeId,
      month: startOfUtcMonth(),
      status: TourPlanStatus.APPROVED,
      days: {
        create: [
          { date: startOfUtcDay(), territoryId: fx.territoryId, plannedDoctorId: fx.doctorId },
        ],
      },
    },
  });
}

export function pngBlob(): Blob {
  // Minimal valid PNG header; upload only checks size and MIME type.
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
    type: "image/png",
  });
}
