import { db } from "@/lib/db";

export interface PrescribedDoctorSummary {
  id: string;
  fullName: string;
  primarySpecialty: string;
  secondarySpecialty?: string | null;
  clinicAddress: string;
  registrationNo?: string | null;
  subArea?: string | null;
  beatName?: string | null;
  mobile?: string | null;
  matchReason?: string;
  isHistoricalPrescriber?: boolean;
}

export interface PrescribedDoctorsResult {
  chemistId: string;
  chemistName: string;
  subArea?: string | null;
  beatName?: string | null;
  territoryId: string;
  doctors: PrescribedDoctorSummary[];
  totalTagged: number;
  autoSelect: boolean;
  defaultDoctor: PrescribedDoctorSummary | null;
  multiple: boolean;
  matchType: "EXACT_SUBAREA" | "EXACT_BEAT" | "TERRITORY" | "NONE";
}

export class ChemistDoctorTaggingService {
  /**
   * Retrieves candidate prescribed doctors for a given chemist.
   * - If exactly 1 doctor is tagged/matched in the chemist's beat/sub-area, autoSelect=true.
   * - If multiple doctors are tagged/matched, multiple=true and returns the full list for user selection.
   * - Includes historical doctor prescription linkage if previously booked.
   */
  public static async getPrescribedDoctorsForChemist(chemistId: string): Promise<PrescribedDoctorsResult> {
    const chemist = await db.chemist.findUnique({
      where: { id: chemistId },
      select: {
        id: true,
        name: true,
        subArea: true,
        beatName: true,
        territoryId: true,
      },
    });

    if (!chemist) {
      throw new Error(`Chemist not found: ${chemistId}`);
    }

    // 1. Check if this chemist already has historical orders tied to a prescribed doctor
    const historicalDoctors = await db.order.findMany({
      where: {
        chemistId,
        doctorId: { not: null },
      },
      select: {
        doctorId: true,
      },
      distinct: ["doctorId"],
      take: 10,
    });
    const historicalDoctorIds = new Set(historicalDoctors.map((o) => o.doctorId).filter(Boolean) as string[]);

    // 2. Discover candidate doctors by exact subArea & beat
    let matchType: PrescribedDoctorsResult["matchType"] = "NONE";
    let candidateDoctors: any[] = [];

    if (chemist.subArea && chemist.subArea.trim().length > 0) {
      candidateDoctors = await db.doctor.findMany({
        where: {
          territoryId: chemist.territoryId,
          subArea: {
            equals: chemist.subArea.trim(),
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          fullName: true,
          primarySpecialty: true,
          secondarySpecialty: true,
          clinicAddress: true,
          registrationNo: true,
          subArea: true,
          beatName: true,
          mobile: true,
        },
        orderBy: { fullName: "asc" },
      });

      if (candidateDoctors.length > 0) {
        matchType = "EXACT_SUBAREA";
      }
    }

    // 3. Fallback to beatName if subArea yielded no doctors
    if (candidateDoctors.length === 0 && chemist.beatName && chemist.beatName.trim().length > 0) {
      candidateDoctors = await db.doctor.findMany({
        where: {
          territoryId: chemist.territoryId,
          beatName: {
            equals: chemist.beatName.trim(),
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          fullName: true,
          primarySpecialty: true,
          secondarySpecialty: true,
          clinicAddress: true,
          registrationNo: true,
          subArea: true,
          beatName: true,
          mobile: true,
        },
        orderBy: { fullName: "asc" },
      });

      if (candidateDoctors.length > 0) {
        matchType = "EXACT_BEAT";
      }
    }

    // 4. Fallback to all doctors in the same territory if still empty
    if (candidateDoctors.length === 0 && chemist.territoryId) {
      candidateDoctors = await db.doctor.findMany({
        where: {
          territoryId: chemist.territoryId,
        },
        select: {
          id: true,
          fullName: true,
          primarySpecialty: true,
          secondarySpecialty: true,
          clinicAddress: true,
          registrationNo: true,
          subArea: true,
          beatName: true,
          mobile: true,
        },
        orderBy: { fullName: "asc" },
        take: 50,
      });

      if (candidateDoctors.length > 0) {
        matchType = "TERRITORY";
      }
    }

    // Format results with historical prescriber flag
    const formattedDoctors: PrescribedDoctorSummary[] = candidateDoctors.map((d) => ({
      ...d,
      isHistoricalPrescriber: historicalDoctorIds.has(d.id),
      matchReason:
        matchType === "EXACT_SUBAREA"
          ? `Practicing in immediate vicinity (${chemist.subArea})`
          : matchType === "EXACT_BEAT"
          ? `Tagged to same field beat (${chemist.beatName})`
          : `Practicing in same territory`,
    }));

    // Prioritize historical prescribers to the top
    formattedDoctors.sort((a, b) => {
      if (a.isHistoricalPrescriber && !b.isHistoricalPrescriber) return -1;
      if (!a.isHistoricalPrescriber && b.isHistoricalPrescriber) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

    const totalTagged = formattedDoctors.length;
    const autoSelect = totalTagged === 1;
    const multiple = totalTagged > 1;
    const defaultDoctor = autoSelect ? formattedDoctors[0] : null;

    return {
      chemistId: chemist.id,
      chemistName: chemist.name,
      subArea: chemist.subArea,
      beatName: chemist.beatName,
      territoryId: chemist.territoryId,
      doctors: formattedDoctors,
      totalTagged,
      autoSelect,
      defaultDoctor,
      multiple,
      matchType,
    };
  }
}
