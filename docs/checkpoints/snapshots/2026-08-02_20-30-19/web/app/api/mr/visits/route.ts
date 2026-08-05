import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { CreateVisitSchema, PaginationSchema } from "@/lib/validators";
import { saveVisitPhoto, photoUrl } from "@/lib/upload";
import { checkVisitAnomaly, haversineDistanceKm } from "@/lib/gps";
import { ok, badRequest, unauthorized, apiError, notFound } from "@/lib/api-response";

const db = new PrismaClient();

interface AuthedRequest extends NextRequest {
  user: {
    sub: string;
    role: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user (extracted from header / cookie by middleware)
    const userId = req.headers.get("x-user-id");
    if (!userId) return unauthorized("Authentication required");

    const employee = await db.employee.findUnique({ where: { userId } });
    if (!employee) return unauthorized("Employee record not found");

    const url = new URL(req.url);
    const rawParams = {
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "20",
    };

    const parsed = PaginationSchema.safeParse(rawParams);
    if (!parsed.success) {
      return badRequest("Invalid pagination parameters");
    }

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = { employeeId: employee.id };

    const [visits, total] = await Promise.all([
      db.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { id: true, fullName: true, clinicAddress: true } },
          chemist: { select: { id: true, name: true, address: true } },
        },
      }),
      db.visit.count({ where }),
    ]);

    return ok({
      visits: visits.map((v) => ({
        ...v,
        photoUrl: v.photoPath ? photoUrl(v.photoPath) : null,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/mr/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visits", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return unauthorized("Authentication required");

    const employee = await db.employee.findUnique({ where: { userId } });
    if (!employee) return unauthorized("Employee record not found");

    const formData = await req.formData();
    const raw = {
      doctorId: formData.get("doctorId") || undefined,
      chemistId: formData.get("chemistId") || undefined,
      purpose: formData.get("purpose"),
      feedback: formData.get("feedback") || undefined,
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
    };

    const parsed = CreateVisitSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { doctorId, chemistId, purpose, feedback, latitude, longitude } = parsed.data;

    if (!doctorId && !chemistId) {
      return badRequest("Either doctorId or chemistId must be provided");
    }

    let targetLat = 0;
    let targetLon = 0;

    // 1. Verify Target and fetch coordinates for Geofence Audit
    if (doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return notFound("Doctor not found");
      targetLat = doctor.latitude;
      targetLon = doctor.longitude;
    } else if (chemistId) {
      const chemist = await db.chemist.findUnique({ where: { id: chemistId } });
      if (!chemist) return notFound("Chemist not found");
      targetLat = chemist.latitude;
      targetLon = chemist.longitude;
    }

    // 2. Perform Geofence calculation (100m threshold)
    const distanceMeters = haversineDistanceKm(latitude, longitude, targetLat, targetLon) * 1000;
    if (distanceMeters > 100) {
      return badRequest(`Geofence verification failed. You are ${Math.round(distanceMeters)}m away. Must be within 100m.`);
    }

    const visitId = randomUUID();

    // 3. Handle Photo upload
    const photoFile = formData.get("photo") as File | null;
    let photoPath: string | null = null;
    if (photoFile && photoFile.size > 0) {
      const uploadResult = await saveVisitPhoto(photoFile, employee.id, visitId);
      if (!uploadResult.ok) {
        return badRequest(uploadResult.error.message);
      }
      photoPath = uploadResult.result.relativePath;
    } else {
      return badRequest("A visit verification photo is required");
    }

    // 4. Create Visit record in Transaction
    const visit = await db.$transaction(async (tx) => {
      const createdVisit = await tx.visit.create({
        data: {
          id: visitId,
          employeeId: employee.id,
          doctorId,
          chemistId,
          purpose,
          feedback,
          latitude,
          longitude,
        },
      });

      // Handle samples distribution
      const samplesJson = formData.get("samples");
      if (samplesJson) {
        const samples = JSON.parse(samplesJson.toString()) as { productId: string; quantity: number }[];
        for (const sample of samples) {
          await tx.sample.create({
            data: {
              visitId,
              productId: sample.productId,
              quantity: sample.quantity,
            },
          });

          // Decrement from MR Sample Inventory
          await tx.sampleInventory.updateMany({
            where: { employeeId: employee.id, productId: sample.productId },
            data: { quantity: { decrement: sample.quantity } },
          });
        }
      }

      // Handle gifts distribution
      const giftsJson = formData.get("gifts");
      if (giftsJson) {
        const gifts = JSON.parse(giftsJson.toString()) as { giftCatalogId: string; quantity: number }[];
        for (const gift of gifts) {
          await tx.gift.create({
            data: {
              visitId,
              giftCatalogId: gift.giftCatalogId,
              quantity: gift.quantity,
            },
          });

          // Decrement from Gift Catalog Stock
          await tx.giftCatalog.update({
            where: { id: gift.giftCatalogId },
            data: { stockQty: { decrement: gift.quantity } },
          });
        }
      }

      return createdVisit;
    });

    return ok({ visitId: visit.id, success: true });
  } catch (err) {
    console.error("[POST /api/mr/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "DCR submission failed", 500);
  }
}
