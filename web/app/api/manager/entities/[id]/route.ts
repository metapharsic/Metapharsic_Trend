import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";

const UpdateEntityBodySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DOCTOR", "CHEMIST", "DISTRIBUTOR", "HOSPITAL", "EMPLOYEE"]),
  address: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  territoryId: z.string().uuid().nullable().optional(),
  primarySpecialty: z.string().optional(),
  secondarySpecialty: z.string().optional(),
  whatsApp: z.string().optional(),
  contactPerson: z.string().optional(),
  licenseNo: z.string().optional(),
  billingName: z.string().nullable().optional(),
  gstNo: z.string().nullable().optional(),
  creditLimit: z.number().min(0).nullable().optional(),
  departments: z.string().optional(),
  bedStrength: z.number().int().min(0).optional(),
  // Extended profile fields
  qualification: z.string().optional(),
  registrationNo: z.string().optional(),
  experienceYears: z.number().int().min(0).optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
  purchaseManager: z.string().optional(),
  bankDetails: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

async function getEntityDetails(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // DOCTOR, CHEMIST, DISTRIBUTOR, HOSPITAL, EMPLOYEE

    if (type === "DOCTOR") {
      const doctor = await db.doctor.findUnique({
        where: { id },
        include: {
          territory: { select: { id: true, name: true, region: true, zone: true } },
          crmProfile: true,
          visits: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { employee: { select: { firstName: true, lastName: true } } },
          },
          prescriptionHistories: {
            take: 5,
            orderBy: { month: "desc" },
            include: { product: { select: { name: true } } },
          },
          _count: {
            select: { visits: true, orders: true, ledgers: true },
          },
        },
      });
      if (!doctor) return notFound("Doctor not found");

      return ok({
        entity: {
          id: doctor.id,
          name: doctor.fullName,
          fullName: doctor.fullName,
          type: "DOCTOR",
          address: doctor.clinicAddress,
          clinicAddress: doctor.clinicAddress,
          territoryId: doctor.territoryId,
          territory: doctor.territory,
          primarySpecialty: doctor.primarySpecialty,
          secondarySpecialty: doctor.secondarySpecialty,
          qualification: doctor.qualification,
          registrationNo: doctor.registrationNo,
          experienceYears: doctor.experienceYears,
          whatsApp: doctor.whatsApp,
          mobile: doctor.mobile,
          email: doctor.email,
          dpsScore: doctor.dpsScore,
          dpsTier: doctor.dpsTier,
          requiredMonthlyVisits: doctor.requiredMonthlyVisits,
          crmProfile: doctor.crmProfile,
          recentVisits: doctor.visits,
          recentPrescriptions: doctor.prescriptionHistories,
          metrics: {
            totalVisits: doctor._count.visits,
            totalOrders: doctor._count.orders,
            totalLedgers: doctor._count.ledgers,
          },
        },
      });
    } else if (type === "CHEMIST") {
      const chemist = await db.chemist.findUnique({
        where: { id },
        include: {
          territory: { select: { id: true, name: true, region: true, zone: true } },
          orders: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, createdAt: true },
          },
          visits: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { employee: { select: { firstName: true, lastName: true } } },
          },
          _count: {
            select: { visits: true, orders: true, collections: true, claims: true },
          },
        },
      });
      if (!chemist) return notFound("Chemist not found");

      return ok({
        entity: {
          id: chemist.id,
          name: chemist.name,
          type: "CHEMIST",
          address: chemist.address,
          territoryId: chemist.territoryId,
          territory: chemist.territory,
          contactPerson: chemist.contactPerson,
          licenseNo: chemist.licenseNo,
          billingName: chemist.billingName,
          gstNo: chemist.gstNo,
          creditLimit: chemist.creditLimit !== null ? Number(chemist.creditLimit) : null,
          mobile: chemist.mobile,
          email: chemist.email,
          recentOrders: chemist.orders,
          recentVisits: chemist.visits,
          metrics: {
            totalVisits: chemist._count.visits,
            totalOrders: chemist._count.orders,
            totalCollections: chemist._count.collections,
          },
        },
      });
    } else if (type === "DISTRIBUTOR") {
      const distributor = await db.distributor.findUnique({
        where: { id },
        include: {
          territory: { select: { id: true, name: true, region: true, zone: true } },
          orders: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, createdAt: true },
          },
          _count: {
            select: { orders: true, claims: true },
          },
        },
      });
      if (!distributor) return notFound("Distributor not found");

      return ok({
        entity: {
          id: distributor.id,
          name: distributor.name,
          type: "DISTRIBUTOR",
          address: distributor.address,
          territoryId: distributor.territoryId,
          territory: distributor.territory,
          gstNo: distributor.gstNo,
          licenseNo: distributor.licenseNo,
          creditLimit: distributor.creditLimit !== null ? Number(distributor.creditLimit) : null,
          bankDetails: distributor.bankDetails,
          recentOrders: distributor.orders,
          metrics: {
            totalOrders: distributor._count.orders,
            totalClaims: distributor._count.claims,
          },
        },
      });
    } else if (type === "HOSPITAL") {
      const hospital = await db.hospital.findUnique({
        where: { id },
        include: {
          territory: { select: { id: true, name: true, region: true, zone: true } },
          tenders: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { product: { select: { name: true } } },
          },
          visits: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { employee: { select: { firstName: true, lastName: true } } },
          },
          _count: {
            select: { visits: true, tenders: true, formularyEntries: true },
          },
        },
      });
      if (!hospital) return notFound("Hospital not found");

      return ok({
        entity: {
          id: hospital.id,
          name: hospital.name,
          type: "HOSPITAL",
          address: hospital.address,
          territoryId: hospital.territoryId,
          territory: hospital.territory,
          departments: hospital.departments,
          bedStrength: hospital.bedStrength,
          purchaseManager: hospital.purchaseManager,
          recentTenders: hospital.tenders,
          recentVisits: hospital.visits,
          metrics: {
            totalVisits: hospital._count.visits,
            totalTenders: hospital._count.tenders,
          },
        },
      });
    } else if (type === "EMPLOYEE") {
      const employee = await db.employee.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, role: true, isActive: true, createdAt: true } },
          territories: { select: { id: true, name: true, region: true, zone: true } },
          manager: { select: { id: true, firstName: true, lastName: true, user: { select: { role: true } } } },
          subordinates: { select: { id: true, firstName: true, lastName: true, user: { select: { role: true } } } },
          _count: {
            select: { visits: true, orders: true, tourPlans: true, attendances: true },
          },
        },
      });
      if (!employee) return notFound("Employee not found");

      return ok({
        entity: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          firstName: employee.firstName,
          lastName: employee.lastName,
          type: "EMPLOYEE",
          address: employee.territories.map((t) => t.name).join(", ") || "No territory assigned",
          territoryId: employee.territories[0]?.id ?? null,
          territories: employee.territories,
          role: employee.user.role,
          email: employee.user.email,
          phone: employee.phone,
          isActive: employee.user.isActive,
          manager: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : null,
          subordinatesCount: employee.subordinates.length,
          metrics: {
            totalVisits: employee._count.visits,
            totalOrders: employee._count.orders,
            totalTourPlans: employee._count.tourPlans,
            totalAttendances: employee._count.attendances,
          },
        },
      });
    } else {
      return badRequest("Invalid type parameter");
    }
  } catch (err) {
    console.error("[GET /api/manager/entities/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch entity details", 500);
  }
}

async function updateEntity(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const body = await req.json();
    const parsed = UpdateEntityBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const {
      type,
      name,
      address,
      latitude,
      longitude,
      territoryId,
      primarySpecialty,
      secondarySpecialty,
      whatsApp,
      contactPerson,
      licenseNo,
      billingName,
      gstNo,
      creditLimit,
      departments,
      bedStrength,
      qualification,
      registrationNo,
      experienceYears,
      mobile,
      email,
      purchaseManager,
      bankDetails,
      firstName,
      lastName,
      phone,
      role,
      isActive,
    } = parsed.data;

    if (type === "DOCTOR") {
      const doctor = await db.doctor.findUnique({ where: { id } });
      if (!doctor) return notFound("Doctor not found");

      const updated = await db.doctor.update({
        where: { id },
        data: {
          ...(name ? { fullName: name } : {}),
          ...(address ? { clinicAddress: address } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
          ...(territoryId ? { territoryId } : {}),
          ...(primarySpecialty ? { primarySpecialty } : {}),
          ...(secondarySpecialty ? { secondarySpecialty } : {}),
          ...(whatsApp ? { whatsApp } : {}),
          ...(qualification ? { qualification } : {}),
          ...(registrationNo ? { registrationNo } : {}),
          ...(experienceYears !== undefined ? { experienceYears } : {}),
          ...(mobile ? { mobile } : {}),
          ...(email ? { email } : {}),
        },
      });
      return ok({
        entity: {
          id: updated.id,
          name: updated.fullName,
          type: "DOCTOR",
          address: updated.clinicAddress,
          territoryId: updated.territoryId,
          primarySpecialty: updated.primarySpecialty,
          secondarySpecialty: updated.secondarySpecialty,
          whatsApp: updated.whatsApp,
          mobile: updated.mobile,
          email: updated.email,
        },
      });
    } else if (type === "CHEMIST") {
      const chemist = await db.chemist.findUnique({ where: { id } });
      if (!chemist) return notFound("Chemist not found");

      const updated = await db.chemist.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
          ...(territoryId ? { territoryId } : {}),
          ...(contactPerson ? { contactPerson } : {}),
          ...(licenseNo ? { licenseNo } : {}),
          ...(billingName !== undefined ? { billingName } : {}),
          ...(gstNo !== undefined ? { gstNo } : {}),
          ...(creditLimit !== undefined ? { creditLimit } : {}),
          ...(mobile ? { mobile } : {}),
          ...(email ? { email } : {}),
        },
      });
      return ok({
        entity: {
          id: updated.id,
          name: updated.name,
          type: "CHEMIST",
          address: updated.address,
          territoryId: updated.territoryId,
          contactPerson: updated.contactPerson,
          licenseNo: updated.licenseNo,
          billingName: updated.billingName,
          gstNo: updated.gstNo,
          creditLimit: updated.creditLimit !== null ? Number(updated.creditLimit) : null,
          mobile: updated.mobile,
          email: updated.email,
        },
      });
    } else if (type === "DISTRIBUTOR") {
      const distributor = await db.distributor.findUnique({ where: { id } });
      if (!distributor) return notFound("Distributor not found");

      const updated = await db.distributor.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
          ...(territoryId ? { territoryId } : {}),
          ...(gstNo ? { gstNo } : {}),
          ...(licenseNo ? { licenseNo } : {}),
          ...(creditLimit !== undefined ? { creditLimit } : {}),
          ...(bankDetails ? { bankDetails } : {}),
        },
      });
      return ok({
        entity: {
          id: updated.id,
          name: updated.name,
          type: "DISTRIBUTOR",
          address: updated.address,
          territoryId: updated.territoryId,
          gstNo: updated.gstNo,
          licenseNo: updated.licenseNo,
          creditLimit: updated.creditLimit !== null ? Number(updated.creditLimit) : null,
          bankDetails: updated.bankDetails,
        },
      });
    } else if (type === "HOSPITAL") {
      const hospital = await db.hospital.findUnique({ where: { id } });
      if (!hospital) return notFound("Hospital not found");

      const updated = await db.hospital.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
          ...(territoryId ? { territoryId } : {}),
          ...(departments !== undefined ? { departments } : {}),
          ...(bedStrength !== undefined ? { bedStrength } : {}),
          ...(purchaseManager ? { purchaseManager } : {}),
        },
      });
      return ok({
        entity: {
          id: updated.id,
          name: updated.name,
          type: "HOSPITAL",
          address: updated.address,
          territoryId: updated.territoryId,
          departments: updated.departments,
          bedStrength: updated.bedStrength,
          purchaseManager: updated.purchaseManager,
        },
      });
    } else if (type === "EMPLOYEE") {
      const employee = await db.employee.findUnique({
        where: { id },
        include: { user: true, territories: true },
      });
      if (!employee) return notFound("Employee not found");

      const [fn, ...rest] = (name || "").trim().split(" ");
      const inferredFirst = firstName || (name ? fn : undefined);
      const inferredLast = lastName || (name ? (rest.join(" ") || "") : undefined);

      if (territoryId) {
        await db.employee.update({
          where: { id },
          data: {
            territories: { set: [{ id: territoryId }] },
          },
        });
        await db.territory.update({
          where: { id: territoryId },
          data: { employeeId: id },
        });
      }

      const updatedEmployee = await db.employee.update({
        where: { id },
        data: {
          ...(inferredFirst ? { firstName: inferredFirst } : {}),
          ...(inferredLast !== undefined ? { lastName: inferredLast } : {}),
          ...(phone || mobile ? { phone: (phone || mobile)! } : {}),
        },
        include: {
          user: { select: { email: true, role: true, isActive: true } },
          territories: { select: { id: true, name: true } },
        },
      });

      if (role && (req.user.role === Role.ADMIN || req.user.role === Role.MD)) {
        await db.user.update({
          where: { id: employee.userId },
          data: {
            role,
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });
      } else if (isActive !== undefined) {
        await db.user.update({
          where: { id: employee.userId },
          data: { isActive },
        });
      }

      return ok({
        entity: {
          id: updatedEmployee.id,
          name: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
          type: "EMPLOYEE",
          address: updatedEmployee.territories.map((t) => t.name).join(", ") || null,
          territoryId: updatedEmployee.territories[0]?.id ?? null,
          role: role || updatedEmployee.user.role,
          email: updatedEmployee.user.email,
          phone: updatedEmployee.phone,
          isActive: isActive !== undefined ? isActive : updatedEmployee.user.isActive,
        },
      });
    } else {
      return badRequest("Invalid type parameter");
    }
  } catch (err) {
    console.error("[PUT /api/manager/entities/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to update entity", 500);
  }
}

async function deactivateEntity(
  req: AuthedRequest,
  { params }: { params: Record<string, string | string[] | undefined> }
) {
  try {
    const id = String(params.id ?? "");
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // DOCTOR, CHEMIST, DISTRIBUTOR, HOSPITAL, EMPLOYEE

    if (type === "DOCTOR") {
      const doctor = await db.doctor.findUnique({ where: { id } });
      if (!doctor) return notFound("Doctor not found");
      await db.doctor.delete({ where: { id } });
      return ok({ message: "Doctor deleted" });
    } else if (type === "CHEMIST") {
      const chemist = await db.chemist.findUnique({ where: { id } });
      if (!chemist) return notFound("Chemist not found");
      await db.chemist.delete({ where: { id } });
      return ok({ message: "Chemist deleted" });
    } else if (type === "DISTRIBUTOR") {
      const distributor = await db.distributor.findUnique({ where: { id } });
      if (!distributor) return notFound("Distributor not found");
      await db.distributor.delete({ where: { id } });
      return ok({ message: "Distributor deleted" });
    } else if (type === "HOSPITAL") {
      const hospital = await db.hospital.findUnique({ where: { id } });
      if (!hospital) return notFound("Hospital not found");
      await db.hospital.delete({ where: { id } });
      return ok({ message: "Hospital deleted" });
    } else if (type === "EMPLOYEE") {
      const employee = await db.employee.findUnique({
        where: { id },
        include: {
          user: true,
          _count: {
            select: { visits: true, orders: true, attendances: true, tourPlans: true },
          },
        },
      });
      if (!employee) return notFound("Employee not found");

      const totalHistory =
        employee._count.visits +
        employee._count.orders +
        employee._count.attendances +
        employee._count.tourPlans;

      if (totalHistory > 0) {
        await db.user.update({
          where: { id: employee.userId },
          data: { isActive: false },
        });
        return ok({ message: "Employee deactivated (preserved field & order history)" });
      }

      await db.employee.delete({ where: { id } });
      await db.user.delete({ where: { id: employee.userId } });
      return ok({ message: "Employee permanently deleted" });
    } else {
      return badRequest("Invalid type parameter");
    }
  } catch (err: any) {
    if (err?.code === "P2003") {
      return badRequest("Cannot delete: this record has linked visits, orders, or invoices. Remove or reassign those first.");
    }
    console.error("[DELETE /api/manager/entities/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete entity", 500);
  }
}

const ALL_MANAGERS = [Role.ADMIN, Role.MD, Role.NSM, Role.ZSM, Role.RM, Role.ASM];

export const GET = withAuth(getEntityDetails, [...ALL_MANAGERS, Role.MR]);
export const PUT = withAuth(updateEntity, ALL_MANAGERS);
export const DELETE = withAuth(deactivateEntity, ALL_MANAGERS);
