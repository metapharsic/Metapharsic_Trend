import { Role } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { POST as verifyDlMultiAgent } from "../app/api/mr/chemists/verify-dl-multiagent/route";
import { PUT as updateUser } from "../app/api/users/[id]/route";
import { ChemistDlMultiAgentService } from "../services/chemist-dl-multiagent.service";
import {
  parseAssignedTasks,
  hasMrTask,
  ALL_MR_TASK_CODES,
  TASK_DL_COLLECTION,
  TASK_DOCTOR_DETAILING,
} from "../lib/mr-task-roles";

describe("MR Client DL Upload & Multi-Agent Council Verification", () => {
  let fx: TestFixture;
  let adminToken: string;
  let mrToken: string;
  let chemistId: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    mrToken = tokenFor(fx.mrUserId, Role.MR);

    // Give MR user the required TASK_DL_COLLECTION role
    await testDb.user.update({
      where: { id: fx.mrUserId },
      data: { assignedTasks: JSON.stringify(ALL_MR_TASK_CODES) },
    });

    const chemist = await testDb.chemist.create({
      data: {
        name: "Metro Meds Healthcare Pharmacy",
        contactPerson: "Srinivas Rao",
        address: "Lane 4, Banjara Hills, Hyderabad",
        latitude: 17.4126,
        longitude: 78.4482,
        territoryId: fx.territoryId,
      },
    });
    chemistId = chemist.id;
  });

  describe("Multi-Agent Verification Council Service", () => {
    it("runs 4-agent council deliberation and approves valid drug license copy", async () => {
      const decision = await ChemistDlMultiAgentService.verifyAndCertifyDlCopy({
        chemistId,
        chemistName: "Metro Meds Healthcare Pharmacy",
        submittedLicenseNo: "DL-20B-HYD-2024-9988",
        expiryDate: "2029-12-31",
        notes: "Collected hard copy from store manager Srinivas during morning visit",
        actorUserId: fx.mrUserId,
      });

      expect(decision.success).toBe(true);
      expect(decision.councilDecision).toBe("APPROVED_AND_CERTIFIED");
      expect(decision.overallConfidenceScore).toBeGreaterThanOrEqual(95);
      expect(decision.auditTrail).toHaveLength(4);

      // Verify individual agent roles in council
      const agentCodes = decision.auditTrail.map((a) => a.agentCode);
      expect(agentCodes).toContain("AGENT-DL-OCR");
      expect(agentCodes).toContain("AGENT-DL-STATUTORY");
      expect(agentCodes).toContain("AGENT-DL-TERRITORY");
      expect(agentCodes).toContain("AGENT-DL-GOVERNOR");
    });
  });

  describe("API: POST /api/mr/chemists/verify-dl-multiagent", () => {
    it("allows authorized MR to submit and certify DL copy", async () => {
      const req = jsonRequest(
        "http://localhost:5555/api/mr/chemists/verify-dl-multiagent",
        {
          method: "POST",
          token: mrToken,
          body: {
            chemistId,
            licenseNo: "DL-20B-TG-2024-5544",
            expiryDate: "2030-06-30",
            notes: "Digital scan verified with pharmacist",
          },
        }
      );

      const res = await verifyDlMultiAgent(req as any, noParams as any);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.success).toBe(true);
      expect(body.data.councilDecision).toBe("APPROVED_AND_CERTIFIED");
      expect(body.data.chemistId).toBe(chemistId);

      // Verify database updated with certified license
      const updatedChemist = await testDb.chemist.findUnique({
        where: { id: chemistId },
      });
      expect(updatedChemist?.licenseNo).toBe("DL-20B-TG-2024-5544");
      expect(updatedChemist?.dlStatus).toBe("VERIFIED");
    });

    it("rejects request if MR lacks TASK_DL_COLLECTION task role", async () => {
      // Temporarily remove TASK_DL_COLLECTION
      await testDb.user.update({
        where: { id: fx.mrUserId },
        data: { assignedTasks: JSON.stringify([TASK_DOCTOR_DETAILING]) },
      });

      const req = jsonRequest(
        "http://localhost:5555/api/mr/chemists/verify-dl-multiagent",
        {
          method: "POST",
          token: mrToken,
          body: {
            chemistId,
            licenseNo: "DL-20B-FAIL-1234",
          },
        }
      );

      const res = await verifyDlMultiAgent(req as any, noParams as any);
      expect(res.status).toBe(403);

      const body = await readJson(res);
      const errMsg = body.message || body.error?.message || JSON.stringify(body);
      expect(errMsg).toContain("TASK_DL_COLLECTION");

      // Restore full tasks
      await testDb.user.update({
        where: { id: fx.mrUserId },
        data: { assignedTasks: JSON.stringify(ALL_MR_TASK_CODES) },
      });
    });
  });

  describe("User Management: Admin Task Delegation & Capability Enforcement", () => {
    it("allows Admin to delegate specific tasks to an MR", async () => {
      const tasksToDelegate = [
        TASK_DL_COLLECTION,
        TASK_DOCTOR_DETAILING,
        "TASK_CHEMIST_POB_ORDERS",
      ];

      const req = jsonRequest(
        `http://localhost:5555/api/users/${fx.mrUserId}`,
        {
          method: "PUT",
          token: adminToken,
          body: {
            assignedTasks: tasksToDelegate,
          },
        }
      );

      const res = await updateUser(req as any, { params: { id: fx.mrUserId } } as any);
      const body = await readJson(res);
      if (res.status !== 200) {
        console.error("DEBUG_UPDATE_USER_ERROR:", JSON.stringify(body, null, 2));
      }
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const updatedUser = await testDb.user.findUnique({
        where: { id: fx.mrUserId },
      });
      const parsed = parseAssignedTasks(updatedUser?.assignedTasks);
      expect(parsed).toEqual(tasksToDelegate);
      expect(hasMrTask(updatedUser?.assignedTasks, TASK_DL_COLLECTION)).toBe(true);
      expect(hasMrTask(updatedUser?.assignedTasks, "TASK_INSTITUTIONAL_TENDERS")).toBe(false);
    });

    it("prevents non-admin MR from self-escalating task capabilities", async () => {
      // Admin sets MR to only 2 tasks
      await testDb.user.update({
        where: { id: fx.mrUserId },
        data: { assignedTasks: JSON.stringify([TASK_DL_COLLECTION, TASK_DOCTOR_DETAILING]) },
      });

      const req = jsonRequest(
        `/api/users/${fx.mrUserId}`,
        {
          method: "PUT",
          token: mrToken,
          body: {
            assignedTasks: ALL_MR_TASK_CODES,
          },
        }
      );

      const res = await updateUser(req as any, { params: { id: fx.mrUserId } } as any);
      // Endpoint succeeds but silently strips assignedTasks for non-admins to prevent privilege escalation
      expect(res.status).toBe(200);

      const userInDb = await testDb.user.findUnique({ where: { id: fx.mrUserId } });
      const tasks = parseAssignedTasks(userInDb?.assignedTasks);
      expect(tasks).not.toContain("TASK_INSTITUTIONAL_TENDERS");
      expect(tasks).toEqual([TASK_DL_COLLECTION, TASK_DOCTOR_DETAILING]);
    });

    it("forbids non-admin MR from modifying another user's profile with 403", async () => {
      const req = jsonRequest(
        `/api/users/${fx.asmUserId}`,
        {
          method: "PUT",
          token: mrToken,
          body: {
            assignedTasks: ALL_MR_TASK_CODES,
          },
        }
      );

      const res = await updateUser(req as any, { params: { id: fx.asmUserId } } as any);
      expect(res.status).toBe(403);
    });
  });
});
