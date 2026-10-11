import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, created, badRequest, apiError, unauthorized } from "@/lib/api-response";
import { ModulesService } from "@/services/modules.service";
import { db } from "@/lib/db";

async function handleGet(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role") as Role | null;
    const userRole = req.user?.role;

    let targetRole: Role | undefined = userRole;

    // ADMIN can query modules for any specific role if requested
    if (userRole === Role.ADMIN && roleParam && Object.values(Role).includes(roleParam)) {
      targetRole = roleParam;
    }

    if (targetRole) {
      const [modules, sidebar] = await Promise.all([
        ModulesService.getModulesForRole(targetRole),
        ModulesService.getSidebarForRole(targetRole),
      ]);

      return ok({
        role: targetRole,
        total: modules.length,
        modules,
        sidebar,
      });
    }

    // Default: all active modules
    const [allModules, allSidebar] = await Promise.all([
      ModulesService.getAllModules(false),
      ModulesService.getSidebarForRole(undefined),
    ]);

    return ok({
      total: allModules.length,
      modules: allModules,
      sidebar: allSidebar,
    });
  } catch (err: any) {
    console.error("[GET /api/system/modules] Error:", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch system modules from database", 500);
  }
}

async function handlePost(req: AuthedRequest) {
  try {
    if (req.user?.role !== Role.ADMIN) {
      return unauthorized("Admin role required to provision or update system modules");
    }

    const body = await req.json();
    const {
      code,
      label,
      href,
      icon,
      category,
      categoryOrder = 0,
      sortOrder = 0,
      roles = [Role.ADMIN],
      labelByRole,
      isArtifact = false,
      moduleType = "MODULE",
      badge,
      description,
      isActive = true,
    } = body;

    if (!code || !label || !href || !icon || !category) {
      return badRequest("Missing required module fields: code, label, href, icon, category");
    }

    const upserted = await db.appModule.upsert({
      where: { code },
      update: {
        label,
        href,
        icon,
        category,
        categoryOrder,
        sortOrder,
        roles,
        labelByRole: labelByRole ?? undefined,
        isArtifact,
        moduleType,
        badge,
        description,
        isActive,
      },
      create: {
        code,
        label,
        href,
        icon,
        category,
        categoryOrder,
        sortOrder,
        roles,
        labelByRole: labelByRole ?? undefined,
        isArtifact,
        moduleType,
        badge,
        description,
        isActive,
      },
    });

    return created({ module: upserted });
  } catch (err: any) {
    console.error("[POST /api/system/modules] Error:", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to save module into database", 500);
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, [Role.ADMIN]);
