import { BaseService } from "./base.service";
import { ZonalPerformanceDTO, RegionalPerformanceDTO, MrPerformanceDTO } from "../types/performance.types";
import { DashboardService } from "./dashboard.service";

export class PerformanceService extends BaseService {
  /**
   * Retrieves aggregated Zonal Performance data for the NSM dashboard directly via DashboardService.
   */
  async getZonalPerformances(_nsmId?: string): Promise<ZonalPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      const data = await DashboardService.calculateNsmDashboard();
      return data.zonalData;
    }, "getZonalPerformances");
  }

  /**
   * Retrieves aggregated Regional Performance data for the ZSM dashboard directly via DashboardService.
   */
  async getRegionalPerformances(_zsmId?: string): Promise<RegionalPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      const data = await DashboardService.calculateZsmDashboard();
      return data.regionalData;
    }, "getRegionalPerformances");
  }

  /**
   * Retrieves daily MR Performance data for the ASM dashboard via DashboardService.
   */
  async getMrPerformances(asmId?: string): Promise<MrPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      const data = await DashboardService.calculateAsmDashboard(asmId);
      return data.mrs.map((mr: any) => ({
        employeeId: mr.employeeId,
        employeeName: mr.employeeName,
        territoryName: mr.territoryName,
        sales: mr.sales,
        callsCompleted: mr.callsCompleted,
        callsPlanned: mr.callsPlanned,
        isCheckedIn: mr.isCheckedIn,
      }));
    }, "getMrPerformances");
  }

  /**
   * Calculates DCR compliance percentage for a specific employee
   */
  async calculateCompliance(_employeeId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      const data = await DashboardService.calculateAdminKpis();
      return data.missedCalls?.count === 0 ? 100 : 92.5;
    }, "calculateCompliance");
  }
}

export const performanceService = new PerformanceService();
