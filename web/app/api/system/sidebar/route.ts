import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";
import { ModulesService } from "@/services/modules.service";

async function handleGet(req: AuthedRequest) {
  try {
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role") as Role | null;
    const userRole = req.user?.role;

    let targetRole: Role | undefined = userRole;

    if (userRole === Role.ADMIN && roleParam && Object.values(Role).includes(roleParam)) {
      targetRole = roleParam;
    }

    const [sidebar, artifacts] = await Promise.all([
      ModulesService.getSidebarForRole(targetRole),
      ModulesService.getArtifacts(),
    ]);

    return ok({
      role: targetRole || "ALL",
      categories: sidebar,
      totalModules: sidebar.reduce((sum, cat) => sum + cat.items.length, 0),
      totalArtifacts: artifacts.length,
    });
  } catch (err: any) {
    console.error("[GET /api/system/sidebar] Error:", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to load sidebar navigation from database", 500);
  }
}

export const GET = withAuth(handleGet);
