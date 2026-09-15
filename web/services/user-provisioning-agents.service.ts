import { db } from "@/lib/db";
import { Role, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { getEligibleManagerRoles } from "@/lib/roles-responsibilities";

export interface UserAuditAnomaly {
  userId: string;
  email: string;
  type: "MISSING_EMPLOYEE" | "INVALID_MANAGER" | "ORPHANED_TERRITORY" | "UNBOUND_MR" | "MULTIPLE_ASSIGNMENTS";
  severity: "LOW" | "MEDIUM" | "HIGH";
  details: string;
}

export interface UserOrganizationAudit {
  totalUsers: number;
  activeUsers: number;
  mrsCount: number;
  asmsCount: number;
  totalTerritories: number;
  assignedTerritories: number;
  unassignedTerritories: number;
  anomalies: UserAuditAnomaly[];
  healthScore: number; // 0 - 100
  auditedAt: string;
}

export interface ProvisionUserPayload {
  email: string;
  password?: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string;
  managerId?: string | null;
  territoryIds?: string[];
  isActive?: boolean;
  resetDeviceUuid?: boolean;
}

/**
 * Multi-Agent User Provisioning & Organizational Alignment Suite
 *
 * Domain Agents:
 * 1. UserIntegrityAuditAgent (AGENT-USER-AUDITOR): Scans profiles, roles, manager lines, and territory coverage.
 * 2. TerritoryAlignmentAgent (AGENT-TERRITORY-ALIGNER): Reconciles bidirectional territory ownership safely.
 * 3. UserProvisioningExecutionAgent (AGENT-PROVISIONING-EXECUTOR): Executes atomic provisioning & updates.
 */
export class UserProvisioningAgentsService {

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 1: USER INTEGRITY AUDIT AGENT
  // ───────────────────────────────────────────────────────────────────────────
  static async auditOrganization(): Promise<UserOrganizationAudit> {
    const [users, territories] = await Promise.all([
      db.user.findMany({
        include: {
          employee: {
            include: {
              manager: { include: { user: { select: { role: true } } } },
              territories: true,
            },
          },
        },
      }),
      db.territory.findMany({
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const anomalies: UserAuditAnomaly[] = [];

    for (const u of users) {
      // 1. Missing employee record for non-portal roles
      if (!u.employee && u.role !== Role.DOCTOR && u.role !== Role.DISTRIBUTOR) {
        anomalies.push({
          userId: u.id,
          email: u.email,
          type: "MISSING_EMPLOYEE",
          severity: "HIGH",
          details: `User with role ${u.role} has no linked Employee record.`,
        });
      }

      // 2. Manager line hierarchy validation
      if (u.employee?.managerId && u.employee.manager) {
        const eligibleManagerRoles = getEligibleManagerRoles(u.role);
        const actualManagerRole = u.employee.manager.user?.role;
        if (actualManagerRole && !eligibleManagerRoles.includes(actualManagerRole)) {
          anomalies.push({
            userId: u.id,
            email: u.email,
            type: "INVALID_MANAGER",
            severity: "MEDIUM",
            details: `Role ${u.role} is reporting to ${actualManagerRole}, which violates the reporting matrix.`,
          });
        }
      }

      // 3. Active MR without any assigned territories
      if (u.isActive && u.role === Role.MR && u.employee && (!u.employee.territories || u.employee.territories.length === 0)) {
        anomalies.push({
          userId: u.id,
          email: u.email,
          type: "ORPHANED_TERRITORY",
          severity: "MEDIUM",
          details: `Active MR ${u.employee.firstName} ${u.employee.lastName} has no assigned territories.`,
        });
      }
    }

    const assignedTerritoriesCount = territories.filter((t) => t.employeeId !== null).length;
    const unassignedTerritoriesCount = territories.length - assignedTerritoriesCount;

    // Calculate organizational health score (100 - penalties)
    let penalty = 0;
    for (const a of anomalies) {
      if (a.severity === "HIGH") penalty += 15;
      else if (a.severity === "MEDIUM") penalty += 5;
      else penalty += 2;
    }
    const healthScore = Math.max(0, Math.min(100, 100 - penalty));

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      mrsCount: users.filter((u) => u.role === Role.MR).length,
      asmsCount: users.filter((u) => u.role === Role.ASM).length,
      totalTerritories: territories.length,
      assignedTerritories: assignedTerritoriesCount,
      unassignedTerritories: unassignedTerritoriesCount,
      anomalies,
      healthScore,
      auditedAt: new Date().toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 2: TERRITORY ALIGNMENT AGENT
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Synchronizes territory ownership for an employee:
   * Sets employeeId = targetEmployeeId on selected territoryIds,
   * and clears employeeId (to null) on any territories previously assigned to this employee that were removed.
   */
  static async alignEmployeeTerritories(
    employeeId: string,
    selectedTerritoryIds: string[],
    prismaTx: Prisma.TransactionClient | typeof db = db
  ): Promise<{ assignedCount: number; unassignedCount: number }> {
    // 1. Unassign territories previously assigned to this employee but not in the new list
    const unassigned = await prismaTx.territory.updateMany({
      where: {
        employeeId: employeeId,
        id: { notIn: selectedTerritoryIds },
      },
      data: {
        employeeId: null,
      },
    });

    // 2. Assign selected territories to this employee
    let assignedCount = 0;
    if (selectedTerritoryIds.length > 0) {
      const assigned = await prismaTx.territory.updateMany({
        where: {
          id: { in: selectedTerritoryIds },
        },
        data: {
          employeeId: employeeId,
        },
      });
      assignedCount = assigned.count;
    }

    return {
      assignedCount,
      unassignedCount: unassigned.count,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AGENT 3: USER PROVISIONING & UPDATE EXECUTION AGENT
  // ───────────────────────────────────────────────────────────────────────────
  static async updateUserDetails(
    userId: string,
    payload: {
      email?: string;
      password?: string;
      role?: Role;
      firstName?: string;
      lastName?: string;
      phone?: string;
      managerId?: string | null;
      territoryIds?: string[];
      isActive?: boolean;
      resetDeviceUuid?: boolean;
    }
  ) {
    if (payload.password !== undefined && payload.password.trim() !== "") {
      if (payload.password.trim().length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
    }

    return await db.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (!existingUser) {
        throw new Error("User not found");
      }

      const userUpdates: Prisma.UserUpdateInput = {};

      // 1. Email update with conflict check
      if (payload.email && payload.email.trim().toLowerCase() !== existingUser.email.toLowerCase()) {
        const cleanEmail = payload.email.trim().toLowerCase();
        const conflict = await tx.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: "insensitive" },
            id: { not: userId },
          },
        });
        if (conflict) {
          throw new Error("A user with this email address already exists");
        }
        userUpdates.email = cleanEmail;
      }

      // 2. Role update
      if (payload.role !== undefined) {
        userUpdates.role = payload.role;
      }

      // 3. Active status
      if (payload.isActive !== undefined) {
        userUpdates.isActive = payload.isActive;
      }

      // 4. Device UUID reset
      if (payload.resetDeviceUuid) {
        userUpdates.deviceUuid = null;
      }

      // 5. Explicit password change
      if (payload.password && payload.password.trim().length >= 6) {
        userUpdates.passwordHash = await bcrypt.hash(payload.password.trim(), 12);
      }

      // 6. Apply user updates
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: userUpdates,
      });

      // 7. Update Employee profile & link territories
      let employee = existingUser.employee;
      if (employee) {
        const employeeUpdates: Prisma.EmployeeUpdateInput = {};
        if (payload.firstName !== undefined) employeeUpdates.firstName = payload.firstName.trim();
        if (payload.lastName !== undefined) employeeUpdates.lastName = payload.lastName.trim();
        if (payload.phone !== undefined) employeeUpdates.phone = payload.phone.trim();
        if (payload.managerId !== undefined) {
          employeeUpdates.manager = payload.managerId ? { connect: { id: payload.managerId } } : { disconnect: true };
        }

        employee = await tx.employee.update({
          where: { id: employee.id },
          data: employeeUpdates,
        });

        // Align territories if provided
        if (payload.territoryIds !== undefined) {
          await this.alignEmployeeTerritories(employee.id, payload.territoryIds, tx);
        }
      } else if (payload.role !== Role.DOCTOR && payload.role !== Role.DISTRIBUTOR) {
        // Create missing employee profile if not present
        employee = await tx.employee.create({
          data: {
            userId: userId,
            firstName: payload.firstName?.trim() || "First",
            lastName: payload.lastName?.trim() || "Last",
            phone: payload.phone?.trim() || "0000000000",
            managerId: payload.managerId || null,
          },
        });
        if (payload.territoryIds && payload.territoryIds.length > 0) {
          await this.alignEmployeeTerritories(employee.id, payload.territoryIds, tx);
        }
      }

      // Return fully hydrated user record
      return await tx.user.findUnique({
        where: { id: userId },
        include: {
          employee: {
            include: {
              manager: { select: { id: true, firstName: true, lastName: true, user: { select: { role: true } } } },
              territories: { select: { id: true, name: true, region: true, zone: true } },
            },
          },
        },
      });
    });
  }
}
