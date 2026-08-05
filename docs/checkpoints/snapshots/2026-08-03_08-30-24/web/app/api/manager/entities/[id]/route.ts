import { NextRequest } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, apiError } from "@/lib/api-response";
import { z } from "zod";

const db = new PrismaClient();

const UpdateEntityBodySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DOCTOR", "CHEMIST", "DISTRIBUTOR"]),
  address: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  territoryId: z.string().uuid().optional(),
  primarySpecialty: z.string().optional(),
  secondarySpecialty: z.string().optional(),
  whatsApp: z.string().optional(),
  contactPerson: z.string().optional(),
  licenseNo: z.string().optional(),
  gstNo: z.string().optional(),
});

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
      gstNo,
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
        },
      });
    } else {
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
        },
      });
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
    const type = searchParams.get("type"); // DOCTOR, CHEMIST, DISTRIBUTOR

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
    } else {
      return badRequest("Invalid type parameter");
    }
  } catch (err) {
    console.error("[DELETE /api/manager/entities/[id]]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete entity", 500);
  }
}

export const PUT = withAuth(updateEntity, [Role.ASM, Role.ADMIN]);
export const DELETE = withAuth(deactivateEntity, [Role.ASM, Role.ADMIN]);
