import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SCAN_WINDOW_MINUTES = 60;

export interface ComplianceScanResult {
  mockedLocationEmployees: number;
  accountsLocked: number;
}

/**
 * Scans recent location logs for spoofed GPS signatures and locks the offending
 * accounts. Per docs/03_features/module_admin.md the lock is immediate; an admin
 * must clear `lockedAt`/`lockedReason` and re-activate the user to restore access.
 */
export async function runComplianceScan(): Promise<ComplianceScanResult> {
  const since = new Date(Date.now() - SCAN_WINDOW_MINUTES * 60 * 1000);

  const mockedLogs = await db.locationLog.findMany({
    where: { isMocked: true, recordedAt: { gte: since } },
    distinct: ["employeeId"],
    select: { employeeId: true },
  });

  if (mockedLogs.length === 0) {
    return { mockedLocationEmployees: 0, accountsLocked: 0 };
  }

  const employees = await db.employee.findMany({
    where: { id: { in: mockedLogs.map((l) => l.employeeId) } },
    select: { id: true, userId: true, user: { select: { isActive: true } } },
  });

  const toLock = employees.filter((e) => e.user.isActive);

  if (toLock.length > 0) {
    await db.user.updateMany({
      where: { id: { in: toLock.map((e) => e.userId) } },
      data: {
        isActive: false,
        lockedAt: new Date(),
        lockedReason: "Mock GPS location detected",
      },
    });
  }

  return { mockedLocationEmployees: mockedLogs.length, accountsLocked: toLock.length };
}

export function startComplianceAlertsJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await runComplianceScan();
      if (result.accountsLocked > 0) {
        console.log(
          `[ComplianceJob] Locked ${result.accountsLocked} account(s) for mock GPS at ${new Date().toISOString()}`
        );
      }
    } catch (err) {
      console.error("[ComplianceJob] Error:", err);
    }
  });
  console.log("[ComplianceJob] Scheduled — runs every 15 minutes");
}
