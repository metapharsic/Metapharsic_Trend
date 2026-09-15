import { UserProvisioningAgentsService } from "../services/user-provisioning-agents.service";
import { Role } from "@prisma/client";

describe("User Provisioning & Organizational Alignment Multi-Agent Suite", () => {
  describe("UserIntegrityAuditAgent (auditOrganization)", () => {
    it("should audit organization, compute health metrics and identify coverage", async () => {
      const audit = await UserProvisioningAgentsService.auditOrganization();

      expect(audit).toBeDefined();
      expect(typeof audit.totalUsers).toBe("number");
      expect(typeof audit.activeUsers).toBe("number");
      expect(typeof audit.healthScore).toBe("number");
      expect(audit.healthScore).toBeGreaterThanOrEqual(0);
      expect(audit.healthScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(audit.anomalies)).toBe(true);
      expect(audit.totalTerritories).toBeGreaterThanOrEqual(0);
      expect(typeof audit.auditedAt).toBe("string");
    });
  });

  describe("UserProvisioningExecutionAgent validation guards", () => {
    it("should reject password less than 6 characters on update", async () => {
      await expect(
        UserProvisioningAgentsService.updateUserDetails("non-existent-id", {
          email: "test@mrtracker.com",
          role: Role.MR,
          firstName: "Test",
          lastName: "User",
          phone: "1234567890",
          password: "123", // too short
        })
      ).rejects.toThrow("Password must be at least 6 characters");
    });

    it("should reject updating non-existent user", async () => {
      await expect(
        UserProvisioningAgentsService.updateUserDetails("non-existent-user-id-9999", {
          email: "nonexistent@mrtracker.com",
          role: Role.MR,
          firstName: "Non",
          lastName: "Existent",
          phone: "1234567890",
        })
      ).rejects.toThrow("User not found");
    });
  });
});
