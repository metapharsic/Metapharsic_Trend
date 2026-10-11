import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, apiError, unauthorized } from "@/lib/api-response";
import { ModulesService } from "@/services/modules.service";
import { db } from "@/lib/db";

async function handleGet(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const artifactType = url.searchParams.get("type") || undefined;
    const category = url.searchParams.get("category") || undefined;

    const artifacts = await ModulesService.getArtifacts({ artifactType, category });

    return ok({
      total: artifacts.length,
      artifacts,
    });
  } catch (err: any) {
    console.error("[GET /api/system/artifacts] Error:", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch system artifacts from database", 500);
  }
}

async function handlePost(req: AuthedRequest) {
  try {
    if (req.user?.role !== Role.ADMIN) {
      return unauthorized("Admin privilege required to provision system artifacts");
    }

    const body = await req.json();
    const {
      code,
      title,
      artifactType = "REPORT",
      category,
      fileFormat = "MARKDOWN",
      filePath,
      content,
      metadata,
      status = "ACTIVE",
      version = "1.0.0",
    } = body;

    if (!code || !title || !category) {
      return badRequest("Missing required artifact fields: code, title, category");
    }

    const artifact = await db.systemArtifact.upsert({
      where: { code },
      update: {
        title,
        artifactType,
        category,
        fileFormat,
        filePath,
        content,
        metadata: metadata ?? undefined,
        status,
        version,
      },
      create: {
        code,
        title,
        artifactType,
        category,
        fileFormat,
        filePath,
        content,
        metadata: metadata ?? undefined,
        status,
        version,
        generatedBy: req.user?.sub || "ADMIN",
      },
    });

    return created({ artifact });
  } catch (err: any) {
    console.error("[POST /api/system/artifacts] Error:", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to save system artifact into database", 500);
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, [Role.ADMIN]);
