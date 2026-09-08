import { db } from "@/lib/db";
import { Role, DmsStatus } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, apiError } from "@/lib/api-response";

async function getDmsWorkflows(_req: AuthedRequest) {
  try {
    const workflows = await db.dmsWorkflow.findMany({
      where: {
        document: {
          status: { not: DmsStatus.Deleted },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = workflows.map((wf) => ({
      id: wf.id,
      documentId: wf.documentId,
      documentTitle: wf.documentTitle,
      currentStep: wf.currentStep,
      assignedTo: wf.assignedTo || "Unassigned",
      dueDate: wf.dueDate ? wf.dueDate.toISOString().slice(0, 10) : "",
      comments: wf.comments || [],
      status: wf.status === "In_Progress" ? "In Progress" : wf.status,
      createdAt: wf.createdAt.toISOString().slice(0, 10),
      updatedAt: wf.updatedAt.toISOString().slice(0, 10),
    }));

    return ok(formatted);
  } catch (err: any) {
    console.error("[GET /api/dms/workflows]", err);
    return apiError("INTERNAL_SERVER_ERROR", err.message || "Failed to fetch workflows", 500);
  }
}

export const GET = withAuth(getDmsWorkflows, Object.values(Role));
