import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { CreateVisitSchema, PaginationSchema } from "@/lib/validators";
import { saveVisitPhoto, photoUrl } from "@/lib/upload";
import { checkVisitAnomaly, haversineDistanceKm } from "@/lib/gps";
import { calculateCqs } from "@/lib/cqs";
import { ok, badRequest, unauthorized, apiError, notFound } from "@/lib/api-response";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { startOfUtcDay, addUtcDays } from "@/lib/date";


async function getVisits(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
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
    const territoryId = url.searchParams.get("territoryId") ?? undefined;

    const where = {
      employeeId: employee.id,
      ...(territoryId
        ? {
            OR: [
              { doctor: { territoryId } },
              { chemist: { territoryId } },
            ],
          }
        : {}),
    };

    const [visits, total, areaCounts] = await Promise.all([
      db.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { id: true, fullName: true, clinicAddress: true, territory: { select: { id: true, name: true } } } },
          chemist: { select: { id: true, name: true, address: true, territory: { select: { id: true, name: true } } } },
          lead: true,
        },
      }),
      db.visit.count({ where }),
      db.visit.findMany({
        where: { employeeId: employee.id },
        select: {
          doctor: { select: { territory: { select: { id: true, name: true } } } },
          chemist: { select: { territory: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    const areaCountMap: Record<string, { id: string; name: string; count: number }> = {};
    for (const v of areaCounts) {
      const territory = v.doctor?.territory ?? v.chemist?.territory;
      if (!territory) continue;
      if (!areaCountMap[territory.id]) areaCountMap[territory.id] = { id: territory.id, name: territory.name, count: 0 };
      areaCountMap[territory.id].count += 1;
    }

    return ok({
      visits: visits.map((v) => ({
        ...v,
        photoUrl: v.photoPath ? photoUrl(v.photoPath) : null,
      })),
      total,
      page,
      limit,
      areaCounts: Object.values(areaCountMap).sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    console.error("[GET /api/mr/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visits", 500);
  }
}

async function createVisit(req: AuthedRequest) {
  try {
    const employee = await db.employee.findUnique({
      where: { userId: req.user.sub },
      include: {
        manager: {
          select: {
            userId: true,
          },
        },
      },
    });
    if (!employee) return unauthorized("Employee record not found");

    const formData = await req.formData();
    const raw = {
      doctorId: formData.get("doctorId") || undefined,
      chemistId: formData.get("chemistId") || undefined,
      hospitalId: formData.get("hospitalId") || undefined,
      purpose: formData.get("purpose"),
      feedback: formData.get("feedback") || undefined,
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      startedAt: formData.get("startedAt") || undefined,
      startLatitude: formData.get("startLatitude") || undefined,
      startLongitude: formData.get("startLongitude") || undefined,
      durationMinutes: formData.get("durationMinutes") || undefined,
      boxesPlaced: formData.get("boxesPlaced") || undefined,
    };

    const parsed = CreateVisitSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const { doctorId, chemistId, hospitalId, purpose, feedback, latitude, longitude, startedAt, startLatitude, startLongitude, durationMinutes, boxesPlaced } =
      parsed.data;

    const leadJson = formData.get("lead");
    const leadInput = leadJson
      ? (JSON.parse(leadJson.toString()) as { status?: string; details?: string; followUpAction?: string; followUpDate?: string })
      : null;

    if (!doctorId && !chemistId && !hospitalId) {
      return badRequest("One of doctorId, chemistId, or hospitalId must be provided");
    }

    const settings = await getWorkflowSettings();

    let targetLat = 0;
    let targetLon = 0;
    let doctorTier: string | null = null;
    let doctorSpecialty: string | null = null;

    // 1. Verify Target and fetch coordinates for Geofence Audit
    if (doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return notFound("Doctor not found");
      targetLat = doctor.latitude;
      targetLon = doctor.longitude;
      doctorTier = doctor.dpsTier;
      doctorSpecialty = doctor.primarySpecialty;

      // Tour Plan enforcement: doctor must be on today's approved TP calendar day.
      // Off by default — toggle in Admin > Workflow Settings.
      if (settings.enforceTourPlan) {
        const todayStart = startOfUtcDay();
        const todayEnd = addUtcDays(todayStart, 1);
        const plannedToday = await db.tourPlanDay.findFirst({
          where: {
            plannedDoctorId: doctorId,
            date: { gte: todayStart, lt: todayEnd },
            tourPlan: { employeeId: employee.id, status: "APPROVED" },
          },
        });
        if (!plannedToday) {
          return badRequest(
            "This doctor is not on your approved Tour Plan for today. Visits must match the approved TP calendar."
          );
        }
      }
    } else if (chemistId) {
      const chemist = await db.chemist.findUnique({ where: { id: chemistId } });
      if (!chemist) return notFound("Chemist not found");
      targetLat = chemist.latitude;
      targetLon = chemist.longitude;
    } else if (hospitalId) {
      const hospital = await db.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital) return notFound("Hospital not found");
      targetLat = hospital.latitude;
      targetLon = hospital.longitude;
    }

    // 2. Perform Geofence calculation
    const distanceMeters = haversineDistanceKm(latitude, longitude, targetLat, targetLon) * 1000;
    if (distanceMeters > settings.geofenceRadiusMeters) {
      return badRequest(
        `Geofence verification failed. You are ${Math.round(distanceMeters)}m away. Must be within ${settings.geofenceRadiusMeters}m.`
      );
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
    } else if (settings.requirePhoto) {
      return badRequest("A visit verification photo is required");
    }

    // 4. Score call quality (doctor visits only — CQS is defined against detailing calls)
    const samplesJson = formData.get("samples");
    const samples = samplesJson
      ? (JSON.parse(samplesJson.toString()) as { productId: string; quantity: number }[])
      : [];

    let cqsScore: number | null = null;
    if (doctorId && durationMinutes !== undefined) {
      const sampledProducts = samples.length
        ? await db.product.findMany({
            where: { id: { in: samples.map((s) => s.productId) } },
            select: { therapySegment: true },
          })
        : [];
      const matchingProducts = sampledProducts.filter(
        (p) => p.therapySegment && doctorSpecialty && p.therapySegment === doctorSpecialty
      ).length;

      cqsScore = calculateCqs({
        durationMinutes,
        matchingProducts,
        totalProducts: sampledProducts.length,
        samplesGiven: samples.reduce((sum, s) => sum + s.quantity, 0),
        doctorTier,
      });
    }

    // Fetch last visit for DCR travel anomaly detection
    const lastVisit = await db.visit.findFirst({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });

    let anomalyResult: { isAnomalous: boolean; reason: string | null; calculatedSpeed: number } | null = null;
    if (lastVisit) {
      anomalyResult = checkVisitAnomaly(
        lastVisit.latitude,
        lastVisit.longitude,
        lastVisit.createdAt,
        latitude,
        longitude,
        new Date()
      );
    }

    // 5. Create Visit record in Transaction
    const visit = await db.$transaction(async (tx) => {
      const createdVisit = await tx.visit.create({
        data: {
          id: visitId,
          employeeId: employee.id,
          doctorId,
          chemistId,
          hospitalId,
          purpose,
          feedback,
          latitude,
          longitude,
          startedAt,
          startLatitude,
          startLongitude,
          endedAt: new Date(),
          durationMinutes,
          boxesPlaced,
          cqsScore,
        },
      });

      // Handle anomaly review logging if anomalous
      if (anomalyResult?.isAnomalous) {
        let reviewerId = employee.manager?.userId || null;
        if (!reviewerId) {
          const adminUser = await tx.user.findFirst({
            where: { role: Role.ADMIN },
            select: { id: true },
          });
          reviewerId = adminUser?.id || null;
        }

        if (reviewerId) {
          await tx.anomalyReview.create({
            data: {
              visitId: createdVisit.id,
              reviewerId,
              status: "PENDING",
              reviewNotes: `Automated compliance alert: travel speed of ${Math.round(anomalyResult.calculatedSpeed)} km/h detected between consecutive check-ins, which is physically implausible.`,
            },
          });
        }
      }

      // Handle lead capture
      if (leadInput) {
        await tx.lead.create({
          data: {
            visitId,
            employeeId: employee.id,
            status: (leadInput.status as "NEW" | "IN_PROGRESS" | "CONVERTED" | "LOST") ?? "NEW",
            details: leadInput.details,
            followUpAction: leadInput.followUpAction,
            followUpDate: leadInput.followUpDate ? new Date(leadInput.followUpDate) : undefined,
          },
        });
      }

      // Handle samples distribution
      if (samples.length > 0) {
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

export const GET = withAuth(getVisits, [Role.MR, Role.ASM, Role.ADMIN]);
export const POST = withAuth(createVisit, [Role.MR]);
