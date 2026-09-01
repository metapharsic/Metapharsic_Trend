import { BaseService } from "./base.service";

export class TerritoryService extends BaseService {
  /**
   * Fetches all territories managed by a specific user.
   */
  async getTerritoriesByManager(userId: string) {
    return this.withErrorHandling(async () => {
      // In our schema, Territories are linked to MRs (Employees). 
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: { employee: { include: { territories: true } } }
      });

      return user?.employee?.territories || [];
    }, "getTerritoriesByManager");
  }

  /**
   * Gets doctors associated with a specific territory
   */
  async getDoctorsInTerritory(territoryId: string) {
    return this.withErrorHandling(async () => {
      return this.db.doctor.findMany({
        where: { territoryId },
        select: {
          id: true,
          fullName: true,
          primarySpecialty: true,
          secondarySpecialty: true,
          clinicAddress: true,
          mobile: true,
        }
      });
    }, "getDoctorsInTerritory");
  }
}

export const territoryService = new TerritoryService();
