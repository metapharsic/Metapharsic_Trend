export interface ComplianceScanResult {
  mockedLocationEmployees: number;
  accountsLocked: number;
}

/**
 * GPS compliance scans are disabled.
 */
export async function runComplianceScan(): Promise<ComplianceScanResult> {
  return { mockedLocationEmployees: 0, accountsLocked: 0 };
}

export function startComplianceAlertsJob() {
  // No-op: GPS tracking removed
}
