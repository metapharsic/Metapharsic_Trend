import { db } from "@/lib/db";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, forbidden, apiError } from "@/lib/api-response";
import { Role } from "@prisma/client";
import { ChemistDlMultiAgentService } from "@/services/chemist-dl-multiagent.service";
import { hasMrTask } from "@/lib/mr-task-roles";

export const POST = withAuth(
  async (req: AuthedRequest) => {
    try {
      // 1. Task role verification for MR
      const dbUser = await db.user.findUnique({
        where: { id: req.user?.sub },
        select: {
          email: true,
          assignedTasks: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      if (req.user?.role === Role.MR) {
        if (!hasMrTask(dbUser?.assignedTasks, "TASK_DL_COLLECTION")) {
          return forbidden(
            "Access Denied: You do not have the 'TASK_DL_COLLECTION' (Drug License Collection & Compliance) task role assigned by Administrator."
          );
        }
      }

      // 2. Parse request (supports FormData or JSON)
      const contentType = req.headers.get("content-type") || "";
      let chemistId = "";
      let licenseNo = "";
      let expiryDate = "";
      let notes = "";
      let fileBuffer: Buffer | undefined;
      let fileName: string | undefined;
      let fileUrl: string | undefined;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        chemistId = String(formData.get("chemistId") || "");
        licenseNo = String(formData.get("licenseNo") || "");
        expiryDate = String(formData.get("expiryDate") || "");
        notes = String(formData.get("notes") || "");
        fileUrl = String(formData.get("fileUrl") || "");

        const file = formData.get("file") as File | null;
        if (file && typeof file.arrayBuffer === "function") {
          const bytes = await file.arrayBuffer();
          fileBuffer = Buffer.from(bytes);
          fileName = file.name;
        }
      } else {
        const body = await req.json();
        chemistId = body.chemistId || "";
        licenseNo = body.licenseNo || "";
        expiryDate = body.expiryDate || "";
        notes = body.notes || "";
        fileUrl = body.fileUrl || "";

        if (body.fileBase64 && body.fileName) {
          fileBuffer = Buffer.from(body.fileBase64, "base64");
          fileName = body.fileName;
        }
      }

      if (!chemistId) {
        return badRequest("Missing required field: chemistId");
      }

      // 3. Execute Multi-Agent Verification Pipeline
      const result = await ChemistDlMultiAgentService.verifyAndCertifyDlCopy({
        chemistId,
        fileBuffer,
        fileName,
        fileUrl: fileUrl || undefined,
        licenseNo: licenseNo || undefined,
        expiryDate: expiryDate || undefined,
        uploadedByEmployeeId: req.user?.sub,
        uploadedByEmployeeName: dbUser?.employee
          ? `${dbUser.employee.firstName} ${dbUser.employee.lastName}`
          : dbUser?.email || req.user?.sub,
        notes: notes || undefined,
      });

      return ok({
        message: "Chemist Drug License verified and certified by Multi-Agent Council successfully.",
        ...result,
      });
    } catch (err: any) {
      console.error("[POST /api/mr/chemists/verify-dl-multiagent]", err);
      return apiError("INTERNAL_SERVER_ERROR", err.message || "Multi-Agent DL verification failed", 500);
    }
  },
  [Role.MR, Role.ASM, Role.RM, Role.ZSM, Role.NSM, Role.MD, Role.ADMIN]
);
