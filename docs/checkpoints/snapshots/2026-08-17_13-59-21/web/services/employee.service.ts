import { BaseService } from "./base.service";
import { Role } from "@prisma/client";

export class EmployeeService extends BaseService {
  /**
   * Fetches the direct reporting hierarchy below a manager.
   * e.g. For a ZSM, fetches RMs.
   */
  async getDirectReports(managerId: string, roleFilter?: Role) {
    return this.withErrorHandling(async () => {
      const reports = await this.db.user.findMany({
        where: {
          employee: {
            managerId,
          },
          ...(roleFilter && { role: roleFilter }),
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              managerId: true,
            }
          }
        },
      });
      return reports;
    }, "getDirectReports");
  }

  /**
   * Fetches all MRs under a specific structural node (ZSM, RM, ASM)
   */
  async getDeepHierarchy(managerId: string) {
    // In a real implementation with deep trees, we'd recursively fetch or use a flat hierarchy mapping.
    // For simplicity, returning just direct reports here as a stub.
    return this.getDirectReports(managerId, "MR");
  }
}

export const employeeService = new EmployeeService();
