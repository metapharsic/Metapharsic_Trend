export interface TargetAchievementDTO {
  target: number;
  achieved: number;
  percentage: number;
}

export interface ZonalPerformanceDTO {
  zoneId: string;
  zoneName: string;
  sales: TargetAchievementDTO;
  compliancePercentage: number;
  activeAnomalies: number;
}

export interface RegionalPerformanceDTO {
  regionId: string;
  regionName: string;
  sales: TargetAchievementDTO;
  compliancePercentage: number;
  activeAnomalies: number;
}

export interface MrPerformanceDTO {
  employeeId: string;
  employeeName: string;
  territoryName: string;
  sales: TargetAchievementDTO;
  callsCompleted: number;
  callsPlanned: number;
  isCheckedIn: boolean;
}
