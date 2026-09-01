import { BaseService } from "./base.service";
import { ZonalPerformanceDTO, RegionalPerformanceDTO, TargetAchievementDTO, MrPerformanceDTO } from "../types/performance.types";

export class PerformanceService extends BaseService {
  /**
   * Retrieves aggregated Zonal Performance data for the NSM dashboard.
   * This is an example implementation of circulating performance data through a DTO.
   */
  async getZonalPerformances(nsmId: string): Promise<ZonalPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      // In a real scenario, this would query Targets and Collections across all zones under this NSM.
      // We return mock calculated data mapped strictly to the DTO for now.
      
      const mockedZonalData: ZonalPerformanceDTO[] = [
        {
          zoneId: "zone-east",
          zoneName: "East Zone",
          sales: {
            target: 5000000,
            achieved: 4200000,
            percentage: 84.0,
          },
          compliancePercentage: 92.5,
          activeAnomalies: 3,
        },
        {
          zoneId: "zone-west",
          zoneName: "West Zone",
          sales: {
            target: 6000000,
            achieved: 6100000,
            percentage: 101.6,
          },
          compliancePercentage: 96.0,
          activeAnomalies: 1,
        }
      ];

      return mockedZonalData;
    }, "getZonalPerformances");
  }

  /**
   * Retrieves aggregated Regional Performance data for the ZSM dashboard.
   */
  async getRegionalPerformances(zsmId: string): Promise<RegionalPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      // Mock data representing regions under a specific Zone
      const mockedRegionalData: RegionalPerformanceDTO[] = [
        {
          regionId: "reg-kolkata",
          regionName: "Kolkata Region",
          sales: {
            target: 2000000,
            achieved: 1600000,
            percentage: 80.0,
          },
          compliancePercentage: 88.5,
          activeAnomalies: 2,
        },
        {
          regionId: "reg-bhubaneswar",
          regionName: "Bhubaneswar Region",
          sales: {
            target: 1500000,
            achieved: 1400000,
            percentage: 93.3,
          },
          compliancePercentage: 94.0,
          activeAnomalies: 1,
        },
        {
          regionId: "reg-patna",
          regionName: "Patna Region",
          sales: {
            target: 1500000,
            achieved: 1200000,
            percentage: 80.0,
          },
          compliancePercentage: 90.0,
          activeAnomalies: 0,
        }
      ];

      return mockedRegionalData;
    }, "getRegionalPerformances");
  }

  /**
   * Retrieves daily MR Performance data for the ASM dashboard.
   */
  async getMrPerformances(asmId: string): Promise<MrPerformanceDTO[]> {
    return this.withErrorHandling(async () => {
      // Mock data representing MRs assigned to an ASM
      const mockedMrData: MrPerformanceDTO[] = [
        {
          employeeId: "emp-mr-1",
          employeeName: "Rahul Sharma",
          territoryName: "Kolkata North",
          sales: {
            target: 50000,
            achieved: 45000,
            percentage: 90.0,
          },
          callsPlanned: 12,
          callsCompleted: 10,
          isCheckedIn: true,
        },
        {
          employeeId: "emp-mr-2",
          employeeName: "Priya Das",
          territoryName: "Kolkata South",
          sales: {
            target: 45000,
            achieved: 48000,
            percentage: 106.6,
          },
          callsPlanned: 10,
          callsCompleted: 11,
          isCheckedIn: true,
        },
        {
          employeeId: "emp-mr-3",
          employeeName: "Amit Kumar",
          territoryName: "Howrah",
          sales: {
            target: 55000,
            achieved: 20000,
            percentage: 36.3,
          },
          callsPlanned: 14,
          callsCompleted: 4,
          isCheckedIn: false,
        }
      ];

      return mockedMrData;
    }, "getMrPerformances");
  }

  /**
   * Calculates DCR compliance percentage for a specific user role or ID
   */
  async calculateCompliance(userId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      // Stub: Calculate compliance based on Visit and TourPlan records
      return 95.5; 
    }, "calculateCompliance");
  }
}

export const performanceService = new PerformanceService();
