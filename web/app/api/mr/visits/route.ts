import { CacheService } from "@/services/cache.service";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
import path from "path";
import { unlink } from "fs/promises";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { CreateVisitSchema, PaginationSchema } from "@/lib/validators";
import { saveVisitPhoto, photoUrl, saveDrugLicenseFile } from "@/lib/upload";
import { haversineDistanceKm } from "@/lib/gps";
import { calculateCqs } from "@/lib/cqs";
import { ok, badRequest, unauthorized, forbidden, notFound, apiError } from "@/lib/api-response";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { startOfUtcDay, addUtcDays } from "@/lib/date";
import { VisitDeduplicationAgentsService } from "@/services/visit-deduplication-agents.service";
import { CallComplianceAgentsService } from "@/services/call-compliance-agents.service";
import { NearbyChemistAgentsService } from "@/services/nearby-chemist-agents.service";


async function getVisits(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const requestedEmployeeId = url.searchParams.get("employeeId");
    const isManager = ([
      Role.ADMIN,
      Role.MD,
      Role.NSM,
      Role.ZSM,
      Role.RM,
      Role.ASM,
    ] as Role[]).includes(req.user.role as Role);
    if (requestedEmployeeId && !isManager) return forbidden("You may only view your own calls");

    // Managers with no employeeId filter see every MR's calls, not just their own.
    let scopeEmployeeId: string | undefined;
    if (requestedEmployeeId) {
      const employee = await db.employee.findUnique({ where: { id: requestedEmployeeId } });
      if (!employee) return notFound("Employee not found");
      scopeEmployeeId = employee.id;
    } else if (!isManager) {
      const employee = await db.employee.findUnique({ where: { userId: req.user.sub } });
      if (!employee) return unauthorized("Employee record not found");
      scopeEmployeeId = employee.id;
    }
    // else: isManager && no requestedEmployeeId → scopeEmployeeId stays undefined (all MRs)

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
    const subAreaFilter = url.searchParams.get("subArea") ?? undefined;

    const where = {
      ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
      ...(subAreaFilter
        ? {
            OR: [
              { doctor: { subArea: subAreaFilter } },
              { chemist: { subArea: subAreaFilter } },
            ],
          }
        : territoryId
        ? {
            OR: [
              { doctor: { territoryId } },
              { chemist: { territoryId } },
            ],
          }
        : {}),
    };

    const [visits, total, rawEntityAreas] = await Promise.all([
      db.visit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
              clinicAddress: true,
              mobile: true,
              whatsApp: true,
              subArea: true,
              beatName: true,
              territory: { select: { id: true, name: true, region: true, zone: true } },
            },
          },
          chemist: {
            select: {
              id: true,
              name: true,
              address: true,
              mobile: true,
              licenseNo: true,
              dlCopyUrl: true,
              dlStatus: true,
              subArea: true,
              beatName: true,
              territory: { select: { id: true, name: true, region: true, zone: true } },
            },
          },
          lead: true,
          samples: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  therapySegment: true,
                  mrp: true,
                  ptr: true,
                  packSize: true,
                  currentBatchNo: true,
                  currentExpDate: true,
                },
              },
            },
          },
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      db.visit.count({ where }),
      db.visit.findMany({
        where: scopeEmployeeId ? { employeeId: scopeEmployeeId } : {},
        select: {
          doctor: {
            select: {
              subArea: true,
              beatName: true,
              territory: { select: { id: true, name: true } },
            },
          },
          chemist: {
            select: {
              subArea: true,
              beatName: true,
              territory: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    // SubArea counts map
    const subAreaCountMap: Record<string, { id: string; name: string; count: number; territoryName: string }> = {};
    // Territory counts map
    const territoryCountMap: Record<string, { id: string; name: string; count: number }> = {};

    for (const v of rawEntityAreas) {
      const subArea = v.doctor?.subArea ?? v.chemist?.subArea;
      const territory = v.doctor?.territory ?? v.chemist?.territory;

      if (subArea) {
        if (!subAreaCountMap[subArea]) {
          subAreaCountMap[subArea] = {
            id: subArea,
            name: subArea,
            count: 0,
            territoryName: territory?.name || "General Territory",
          };
        }
        subAreaCountMap[subArea].count += 1;
      }

      if (territory) {
        if (!territoryCountMap[territory.id]) {
          territoryCountMap[territory.id] = { id: territory.id, name: territory.name, count: 0 };
        }
        territoryCountMap[territory.id].count += 1;
      }
    }

    const purifiedVisits = VisitDeduplicationAgentsService.purifyVisitList(visits);

    return ok({
      visits: purifiedVisits.map((v) => {
        const entity = v.doctor ?? v.chemist;
        const subArea = v.doctor?.subArea ?? v.chemist?.subArea ?? null;
        const beatName = v.doctor?.beatName ?? v.chemist?.beatName ?? null;
        const territory = v.doctor?.territory ?? v.chemist?.territory ?? null;
        const address = v.doctor?.clinicAddress ?? v.chemist?.address ?? null;

        return {
          ...v,
          area: subArea || territory?.name || "General Area",
          subArea,
          beatName,
          territory,
          address,
          photoUrl: v.photoPath ? photoUrl(v.photoPath) : null,
          employeeName: v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : null,
        };
      }),
      total: purifiedVisits.length === visits.length ? total : total - (visits.length - purifiedVisits.length),
      page,
      limit,
      areaCounts: Object.values(subAreaCountMap).sort((a, b) => b.count - a.count),
      subAreaCounts: Object.values(subAreaCountMap).sort((a, b) => b.count - a.count),
      territoryCounts: Object.values(territoryCountMap).sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    console.error("[GET /api/mr/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch visits", 500);
  }
}

async function createVisit(req: AuthedRequest) {
  let uploadedPhotoDiskPath: string | null = null;
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
    if (!employee) return unauthorized("Employee record not found for your account");

    const formData = await req.formData();
    const phoneInput = formData.get("phone") || formData.get("contactPhone") || formData.get("mobile");
    const raw = {
      doctorId: formData.get("doctorId") || undefined,
      chemistId: formData.get("chemistId") || undefined,
      hospitalId: formData.get("hospitalId") || undefined,
      tourPlanDayId: formData.get("tourPlanDayId") || undefined,
      prescribedDoctorId: formData.get("prescribedDoctorId") || undefined,
      prescribedDoctorName: formData.get("prescribedDoctorName") || undefined,
      purpose: formData.get("purpose"),
      phone: phoneInput ? String(phoneInput) : undefined,
      feedback: formData.get("feedback") || undefined,
      receptiveness: formData.get("receptiveness") || undefined,
      followUpDate: formData.get("followUpDate") || undefined,
      latitude: formData.get("latitude") ?? "0",
      longitude: formData.get("longitude") ?? "0",
      locationUnavailable: formData.get("locationUnavailable") === "true" ? true : undefined,
      accuracy: formData.get("accuracy") || formData.get("gpsAccuracy") || undefined,
      startedAt: formData.get("startedAt") || undefined,
      startLatitude: formData.get("startLatitude") || undefined,
      startLongitude: formData.get("startLongitude") || undefined,
      durationMinutes: formData.get("durationMinutes") || undefined,
      boxesPlaced: formData.get("boxesPlaced") || undefined,
      idempotencyKey: formData.get("idempotencyKey") || undefined,
    };

    const parsed = CreateVisitSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.flatten());
    }

    const {
      doctorId,
      chemistId,
      hospitalId,
      tourPlanDayId,
      prescribedDoctorId,
      prescribedDoctorName,
      purpose,
      phone,
      feedback,
      receptiveness,
      followUpDate,
      latitude,
      longitude,
      locationUnavailable,
      accuracy,
      startedAt,
      startLatitude,
      startLongitude,
      durationMinutes,
      boxesPlaced,
    } = parsed.data;

    let leadInput: { status?: string; details?: string; followUpAction?: string; followUpDate?: string } | null = null;
    const leadJson = formData.get("lead");
    if (leadJson) {
      try {
        leadInput = JSON.parse(leadJson.toString());
      } catch {
        return badRequest("Invalid lead JSON payload");
      }
    }

    let rawSamples: { productId: string; quantity: number }[] = [];
    const samplesJson = formData.get("samples");
    if (samplesJson) {
      try {
        rawSamples = JSON.parse(samplesJson.toString());
      } catch {
        return badRequest("Invalid samples JSON payload");
      }
    }

    let rawGifts: { giftCatalogId: string; quantity: number }[] = [];
    const giftsJson = formData.get("gifts");
    if (giftsJson) {
      try {
        rawGifts = JSON.parse(giftsJson.toString());
      } catch {
        return badRequest("Invalid gifts JSON payload");
      }
    }

    let rawCompetitors: { brandName: string; activityIntensity: string; notes?: string }[] = [];
    const compJson = formData.get("competitorLogs");
    if (compJson) {
      try {
        rawCompetitors = JSON.parse(compJson.toString());
      } catch {
        return badRequest("Invalid competitorLogs JSON payload");
      }
    }

    if (!doctorId && !chemistId && !hospitalId) {
      return badRequest("One of doctorId, chemistId, or hospitalId must be provided");
    }

    const settings = await getWorkflowSettings();

    let targetLat = 0;
    let targetLon = 0;
    let doctorTier: string | null = null;
    let doctorSpecialty: string | null = null;

    // 1. Verify Target and fetch coordinates for proximity telemetry & TP enforcement
    if (doctorId) {
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return notFound("Doctor not found");
      targetLat = doctor.latitude;
      targetLon = doctor.longitude;
      doctorTier = doctor.dpsTier;
      doctorSpecialty = doctor.primarySpecialty;

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

    // 2. Optional Phone Validation: allow empty phone; validate & sync ONLY if user entered one
    const phoneValidation = CallComplianceAgentsService.verifyOptionalPhone(phone);
    if (!phoneValidation.isValid) {
      return badRequest(phoneValidation.error || "Invalid phone number format");
    }
    if (!hospitalId && !phoneValidation.isEmpty && phoneValidation.cleanPhone) {
      CallComplianceAgentsService.syncEntityContactNumber({
        doctorId,
        chemistId,
        phone: phoneValidation.cleanPhone,
      }).catch((e) => console.error("[CallCompliance] Contact sync error:", e));
    }

    // 3. Honest GPS Telemetry Processing (Never fabricate coordinates!)
    const gpsTelemetry = CallComplianceAgentsService.processSilentGpsTelemetry({
      latitude,
      longitude,
      accuracy,
    });
    const hasValidGps = gpsTelemetry.hasGps && !locationUnavailable;
    const recordedLat = hasValidGps ? gpsTelemetry.latitude : 0;
    const recordedLon = hasValidGps ? gpsTelemetry.longitude : 0;
    const isLocationUnavailable = !hasValidGps;
    const startHasGps = startLatitude !== undefined && startLongitude !== undefined && (Number(startLatitude) !== 0 || Number(startLongitude) !== 0);
    const recordedStartLat = startHasGps ? Number(startLatitude) : null;
    const recordedStartLon = startHasGps ? Number(startLongitude) : null;

    const distanceFromEntityMeters =
      hasValidGps && targetLat && targetLon
        ? Math.round(haversineDistanceKm(recordedLat, recordedLon, targetLat, targetLon) * 1000)
        : null;

    // 4. Multi-Agent Idempotency Check
    const dupeCheck = await VisitDeduplicationAgentsService.findExistingDuplicateVisit({
      employeeId: employee.id,
      doctorId,
      chemistId,
      hospitalId,
      purpose,
    });
    if (dupeCheck.isDuplicate && dupeCheck.existingVisitId) {
      const existing = await db.visit.findUnique({
        where: { id: dupeCheck.existingVisitId },
        include: {
          doctor: { select: { id: true, fullName: true, clinicAddress: true, territory: { select: { id: true, name: true } } } },
          chemist: { select: { id: true, name: true, address: true, territory: { select: { id: true, name: true } } } },
          lead: true,
          samples: { include: { product: { select: { id: true, name: true } } } },
        },
      });
      if (existing) {
        return ok({
          visitId: existing.id,
          visit: {
            ...existing,
            photoUrl: existing.photoPath ? photoUrl(existing.photoPath) : null,
          },
          anomaly: { isAnomalous: false, reason: null, calculatedSpeed: 0 },
          deduplicated: true,
        });
      }
    }

    // 5. Merge duplicate sample/gift lines and validate positive integer quantities
    const sampleMap = new Map<string, number>();
    for (const s of rawSamples) {
      if (!s.productId || !Number.isInteger(s.quantity) || s.quantity <= 0) {
        return badRequest("All sample quantities must be positive whole numbers");
      }
      sampleMap.set(s.productId, (sampleMap.get(s.productId) ?? 0) + s.quantity);
    }
    const samples = Array.from(sampleMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));

    const giftMap = new Map<string, number>();
    for (const g of rawGifts) {
      if (!g.giftCatalogId || !Number.isInteger(g.quantity) || g.quantity <= 0) {
        return badRequest("All gift quantities must be positive whole numbers");
      }
      giftMap.set(g.giftCatalogId, (giftMap.get(g.giftCatalogId) ?? 0) + g.quantity);
    }
    const gifts = Array.from(giftMap.entries()).map(([giftCatalogId, quantity]) => ({ giftCatalogId, quantity }));

    const visitId = randomUUID();

    // 6. Handle Photo upload (cleaned up automatically if DB transaction fails)
    const photoFile = formData.get("photo") as File | null;
    let photoPath: string | null = null;
    if (photoFile && photoFile.size > 0) {
      const uploadResult = await saveVisitPhoto(photoFile, employee.id, visitId);
      if (!uploadResult.ok) {
        return badRequest(uploadResult.error.message);
      }
      photoPath = uploadResult.result.relativePath;
      uploadedPhotoDiskPath = path.join(process.cwd(), "public", "uploads", "visits", photoPath);
    } else if (settings.requirePhoto) {
      return badRequest("A visit verification photo is required");
    }

    // 7. Compute authentic Call Duration & Call Quality Score (CQS)
    const nowTime = new Date();
    const callStartedAt = startedAt || nowTime;
    const elapsedMinutes = startedAt
      ? Math.max(1, Math.min(600, Math.round((nowTime.getTime() - startedAt.getTime()) / 60000)))
      : 5;
    const resolvedDuration = durationMinutes !== undefined ? durationMinutes : elapsedMinutes;

    let cqsScore: number | null = null;
    if (doctorId) {
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
        durationMinutes: resolvedDuration,
        matchingProducts,
        totalProducts: sampledProducts.length,
        samplesGiven: samples.reduce((sum, s) => sum + s.quantity, 0),
        doctorTier,
      });
    }

    // Resolve structured feedback with prescribed doctor metadata when provided for Chemist visit
    let finalFeedback = feedback?.trim() || null;
    if (chemistId && (prescribedDoctorId || prescribedDoctorName)) {
      let resolvedDocName = prescribedDoctorName?.trim() || "";
      let resolvedDocPhone: string | null = null;
      const prescribedDocPhoneInput = formData.get("prescribedDoctorPhone")
        ? String(formData.get("prescribedDoctorPhone"))
        : undefined;
      if (prescribedDocPhoneInput) {
        const docPhoneCheck = CallComplianceAgentsService.verifyOptionalPhone(prescribedDocPhoneInput);
        if (!docPhoneCheck.isValid) {
          return badRequest(docPhoneCheck.error || "Invalid prescribed doctor phone number");
        }
        if (!docPhoneCheck.isEmpty && docPhoneCheck.cleanPhone && prescribedDoctorId) {
          resolvedDocPhone = docPhoneCheck.cleanPhone;
          await CallComplianceAgentsService.syncEntityContactNumber({
            doctorId: prescribedDoctorId,
            phone: docPhoneCheck.cleanPhone,
          });
        }
      }
      if (prescribedDoctorId) {
        const docRow = await db.doctor.findUnique({
          where: { id: prescribedDoctorId },
          select: { fullName: true, mobile: true, whatsApp: true },
        });
        if (docRow) {
          resolvedDocName = docRow.fullName;
          resolvedDocPhone = resolvedDocPhone || docRow.mobile || docRow.whatsApp || null;
        }
      }
      if (resolvedDocName) {
        const displayDocName = /^dr\.?\s+/i.test(resolvedDocName) ? resolvedDocName : `Dr. ${resolvedDocName}`;
        const docMetaLine = `Prescribed Doctor: ${displayDocName}${resolvedDocPhone ? ` (${resolvedDocPhone})` : ""}`;
        finalFeedback = finalFeedback && !finalFeedback.includes(resolvedDocName)
          ? `${finalFeedback} | ${docMetaLine}`
          : finalFeedback || docMetaLine;
      }
    }

    const totalSampleQty = samples.reduce((sum, s) => sum + s.quantity, 0);
    const resolvedBoxesPlaced =
      boxesPlaced !== undefined ? boxesPlaced : totalSampleQty > 0 ? totalSampleQty : null;

    // 8. Atomic Transaction: Visit + LocationLog + Lead + Samples + Gifts + CompetitorLogs
    const visit = await db.$transaction(async (tx) => {
      const createdVisit = await tx.visit.create({
        data: {
          id: visitId,
          employeeId: employee.id,
          doctorId,
          chemistId,
          hospitalId,
          purpose,
          feedback: finalFeedback,
          photoPath,
          receptiveness: receptiveness || null,
          followUpDate: followUpDate || null,
          latitude: recordedLat,
          longitude: recordedLon,
          locationUnavailable: isLocationUnavailable,
          startedAt: callStartedAt,
          startLatitude: recordedStartLat,
          startLongitude: recordedStartLon,
          endedAt: nowTime,
          durationMinutes: resolvedDuration,
          boxesPlaced: resolvedBoxesPlaced,
          cqsScore,
          anomalyFlag: false,
          anomalyDetails: null,
        },
      });

      if (hasValidGps) {
        await tx.locationLog.create({
          data: {
            employeeId: employee.id,
            latitude: recordedLat,
            longitude: recordedLon,
            isMocked: false,
            recordedAt: nowTime,
          },
        });
      }

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

      if (samples.length > 0) {
        for (const sample of samples) {
          await tx.sample.create({
            data: {
              visitId,
              productId: sample.productId,
              quantity: sample.quantity,
            },
          });

          const decremented = await tx.sampleInventory.updateMany({
            where: { employeeId: employee.id, productId: sample.productId, quantity: { gte: sample.quantity } },
            data: { quantity: { decrement: sample.quantity } },
          });
          if (decremented.count === 0) {
            throw new Error(`Insufficient sample stock for product ${sample.productId}`);
          }
        }
      }

      if (gifts.length > 0) {
        for (const gift of gifts) {
          await tx.gift.create({
            data: {
              visitId,
              giftCatalogId: gift.giftCatalogId,
              quantity: gift.quantity,
            },
          });

          const giftDecremented = await tx.giftCatalog.updateMany({
            where: { id: gift.giftCatalogId, stockQty: { gte: gift.quantity } },
            data: { stockQty: { decrement: gift.quantity } },
          });
          if (giftDecremented.count === 0) {
            throw new Error(`Insufficient gift stock for ${gift.giftCatalogId}`);
          }
        }
      }

      if (rawCompetitors.length > 0) {
        await tx.competitorLog.createMany({
          data: rawCompetitors.map((c) => ({
            visitId,
            brandName: c.brandName,
            activityIntensity: c.activityIntensity,
            notes: c.notes || null,
          })),
        });
      }

      return createdVisit;
    });

    uploadedPhotoDiskPath = null; // Committed cleanly; keep uploaded photo
    CacheService.invalidate("admin_kpis");

    // 9. Tour Plan (N+1) & Nearby Chemist Sync
    const nearbyChemistId = formData.get("nearbyChemistId") ? String(formData.get("nearbyChemistId")) : null;
    const nearbyChemistName = formData.get("nearbyChemistName") ? String(formData.get("nearbyChemistName")) : null;
    const nearbyChemistType = formData.get("nearbyChemistType") ? String(formData.get("nearbyChemistType")) : null;
    const nearbyChemistNotes = formData.get("nearbyChemistNotes") ? String(formData.get("nearbyChemistNotes")) : null;

    let nearbyChemistSyncResult: any = null;
    let tourPlanSync: { tourPlanSynced: boolean; tourPlanDayId: string | null } = {
      tourPlanSynced: false,
      tourPlanDayId: null,
    };

    if (doctorId && (nearbyChemistId || nearbyChemistName)) {
      try {
        nearbyChemistSyncResult = await NearbyChemistAgentsService.processVisitWithNearbyChemist({
          visitId: visit.id,
          employeeId: employee.id,
          doctorId,
          tourPlanDayId,
          nearbyChemistId,
          nearbyChemistName,
          placementType: (nearbyChemistType as any) || "NEAREST_CHEMIST",
          notes: nearbyChemistNotes || finalFeedback || "Completed call with nearby chemist tagged",
          boxesPlaced: resolvedBoxesPlaced ?? 0,
        });
        tourPlanSync = {
          tourPlanSynced: nearbyChemistSyncResult.tourPlanSynced,
          tourPlanDayId: nearbyChemistSyncResult.tourPlanDayId ?? null,
        };
      } catch (e) {
        console.error("[POST /api/mr/visits] Nearby chemist agent error:", e);
      }
    } else if (doctorId || chemistId) {
      try {
        tourPlanSync = await NearbyChemistAgentsService.syncScheduledStopOnVisit({
          employeeId: employee.id,
          doctorId,
          chemistId,
          tourPlanDayId,
          notes: finalFeedback || `Call logged: ${purpose}`,
        });
      } catch (e) {
        console.error("[POST /api/mr/visits] Tour plan sync error:", e);
      }
    }

    // 10. Chemist Drug License (DL) Copy Capture Agent
    let dlCopyResult: any = null;
    if (chemistId) {
      const dlCopyFile = formData.get("dlCopy") as File | null;
      const dlNumberInput = formData.get("dlNumber") || formData.get("licenseNo");
      let dlUrl: string | null = null;

      if (dlCopyFile && dlCopyFile.size > 0) {
        const uploadRes = await saveDrugLicenseFile(dlCopyFile, chemistId);
        if (!uploadRes.ok) {
          return badRequest(uploadRes.error.message);
        }
        dlUrl = uploadRes.result.relativePath;
      }

      if (dlUrl || dlNumberInput) {
        try {
          const updatedChemist = await db.chemist.update({
            where: { id: chemistId },
            data: {
              ...(dlUrl ? { dlCopyUrl: dlUrl, dlStatus: "VERIFIED" } : {}),
              ...(dlNumberInput ? { licenseNo: String(dlNumberInput).trim() } : {}),
            },
            select: { id: true, name: true, licenseNo: true, dlCopyUrl: true, dlStatus: true },
          });
          dlCopyResult = updatedChemist;
        } catch (e) {
          console.error("[POST /api/mr/visits] Chemist DL update error:", e);
        }
      }
    }

    return ok({
      visitId: visit.id,
      success: true,
      visit: {
        id: visit.id,
        durationMinutes: visit.durationMinutes,
        cqsScore: visit.cqsScore,
        boxesPlaced: visit.boxesPlaced,
        locationUnavailable: visit.locationUnavailable,
        latitude: visit.latitude,
        longitude: visit.longitude,
        photoUrl: visit.photoPath ? photoUrl(visit.photoPath) : null,
      },
      gpsTracking: {
        captured: hasValidGps,
        latitude: recordedLat,
        longitude: recordedLon,
        accuracyMeters: gpsTelemetry.accuracyMeters ?? null,
        distanceFromEntityMeters,
      },
      tourPlanSync,
      nearbyChemistSync: nearbyChemistSyncResult,
      chemistDl: dlCopyResult,
    });
  } catch (err) {
    if (uploadedPhotoDiskPath) {
      unlink(uploadedPhotoDiskPath).catch(() => {});
    }
    if (err instanceof Error && (err.message.startsWith("Insufficient sample stock") || err.message.startsWith("Insufficient gift stock"))) {
      return badRequest(err.message);
    }
    console.error("[POST /api/mr/visits]", err);
    return apiError("INTERNAL_SERVER_ERROR", "DCR submission failed", 500);
  }
}

export const GET = withAuth(getVisits, [Role.MR, Role.ASM, Role.RM, Role.ZSM, Role.NSM, Role.MD, Role.ADMIN]);
export const POST = withAuth(createVisit, [Role.MR, Role.ASM, Role.RM, Role.ZSM, Role.NSM, Role.MD, Role.ADMIN]);
