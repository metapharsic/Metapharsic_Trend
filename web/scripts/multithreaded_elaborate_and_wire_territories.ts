import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@prisma/client";
import path from "path";

export interface ElaboratedTerritoryDef {
  key: string;
  name: string;
  previousName?: string;
  region: string;
  zone: string;
  priority: number;
  mrEmail?: string;
  centroid: { lat: number; lng: number };
  keywords: string[];
  subAreas: string[];
  beatCode: string;
}

export const ELABORATED_TERRITORIES: ElaboratedTerritoryDef[] = [
  // Zone 1: Secunderabad & East Corridor
  {
    key: "SEC_TARNAKA",
    name: "Tarnaka Core & Lalaguda",
    previousName: "Tarnaka",
    region: "Secunderabad",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    mrEmail: "abdulmubeen@mrtracker.com",
    centroid: { lat: 17.4285, lng: 78.5310 },
    keywords: ["tarnaka", "taranaka", "lalaguda", "osmania", "vijayapuri", "s. lalaguda", "hema nagar", "adarsh nagar", "ambedkar nagar"],
    subAreas: ["Tarnaka Junction", "Osmania University Road", "Vijayapuri", "South Lalaguda", "Hema Nagar", "Adarsh Nagar"],
    beatCode: "SEC-BEAT-1",
  },
  {
    key: "SEC_SHANTI_NAGAR",
    name: "Shanti Nagar & HMT Nagar",
    previousName: "Shanti Nagar & Taranaka",
    region: "Secunderabad West",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    mrEmail: "krishna@mrtracker.com",
    centroid: { lat: 17.4485, lng: 78.5080 },
    keywords: ["shanti nagar", "shantinagar", "santhi nagar", "hmt nagar", "hmt", "jyothi clinic", "bjzr nagar", "bjr nagar"],
    subAreas: ["Shanti Nagar", "HMT Nagar", "Jyothi Clinic Belt", "BJR Nagar"],
    beatCode: "SEC-BEAT-2",
  },
  {
    key: "SEC_LALAPET",
    name: "Lalapet & Moula Ali",
    region: "Secunderabad North",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    mrEmail: "abdulmubeen@mrtracker.com",
    centroid: { lat: 17.4460, lng: 78.5380 },
    keywords: ["lalapet", "moula ali", "moulaali", "lalaguda gate", "railway colony"],
    subAreas: ["Lalapet Main Road", "Railway Colony", "Moula Ali Bridge"],
    beatCode: "SEC-BEAT-3",
  },
  {
    key: "SEC_NACHARAM",
    name: "Nacharam & Mallapur",
    region: "East Corridor",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    mrEmail: "krishna@mrtracker.com",
    centroid: { lat: 17.4360, lng: 78.5620 },
    keywords: ["nacharam", "mallapur", "raghavendra nagar", "kakatiya nagar", "industrial area nacharam", "nacharam signal"],
    subAreas: ["Nacharam Signal", "Industrial Area", "Mallapur", "Raghavendra Nagar", "Kakatiya Nagar"],
    beatCode: "SEC-BEAT-4",
  },
  {
    key: "SEC_VST",
    name: "VST, Musheerabad & RTC X Roads",
    region: "Secunderabad Central",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    mrEmail: "krishna@mrtracker.com",
    centroid: { lat: 17.4120, lng: 78.5020 },
    keywords: ["vst", "musheerabad", "ramnagar", "malkajgiri", "malkangiri", "chikkadpally", "rtc x", "rtc cross"],
    subAreas: ["VST X Roads", "Ramnagar", "Musheerabad", "Malkajgiri", "Chikkadpally"],
    beatCode: "SEC-BEAT-5",
  },
  {
    key: "SEC_HABSIGUDA",
    name: "Habsiguda & Uppal",
    region: "East Corridor",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    mrEmail: "abdulmubeen@mrtracker.com",
    centroid: { lat: 17.4110, lng: 78.5490 },
    keywords: ["habsiguda", "uppal", "ramanthapur", "boduppal", "peerzadiguda"],
    subAreas: ["Habsiguda X Roads", "Ramanthapur", "Uppal Ring Road", "Boduppal"],
    beatCode: "SEC-BEAT-6",
  },
  {
    key: "SEC_COMMERCIAL",
    name: "Secunderabad Commercial",
    previousName: "Secunderabad Commercial",
    region: "Secunderabad Commercial",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    mrEmail: "abdulmalik@metapharsic.com",
    centroid: { lat: 17.4399, lng: 78.4983 },
    keywords: ["secunderabad commercial", "station road", "mg road", "rashtrapati", "commercial secunderabad"],
    subAreas: ["Commercial Hub", "Station Road Belt", "MG Road"],
    beatCode: "SEC-BEAT-7",
  },

  // Zone 2: South Hyderabad & Old City Corridor
  {
    key: "HYD_SANTOSH_NAGAR",
    name: "Santosh Nagar & IS Sadan",
    previousName: "Santosh Nagar & Yakutpura",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    mrEmail: "abdulmannan@mrtracker.com",
    centroid: { lat: 17.3590, lng: 78.5010 },
    keywords: ["santosh nagar", "santoshnagar", "santosh nager", "is sadan", "champapet", "lucky hotel", "watertank"],
    subAreas: ["Santosh Nagar Main Road", "Watertank Belt", "IS Sadan", "Champapet"],
    beatCode: "HYD-BEAT-1",
  },
  {
    key: "HYD_CHARMINAR",
    name: "Charminar, Ghansi Bazar & Shah Gunj",
    region: "Old City",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    mrEmail: "raheem@mrtracker.com",
    centroid: { lat: 17.3640, lng: 78.4740 },
    keywords: ["ghansi bazar", "ghansibazar", "shah gunj", "shahgunj", "charminar", "mir alam", "falaknuma", "edi bazar", "moin bagh"],
    subAreas: ["Ghansi Bazar", "Shah Gunj", "Charminar", "Mir Alam Mandi", "Falaknuma"],
    beatCode: "HYD-BEAT-5",
  },
  {
    key: "HYD_YAKUTPURA",
    name: "Yakutpura & Rein Bazar",
    region: "Old City",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    mrEmail: "abdulmannan@mrtracker.com",
    centroid: { lat: 17.3620, lng: 78.4870 },
    keywords: ["yakutpura", "rein bazar", "rain bazar", "rain bazaar", "madannapet", "shia pharmacy"],
    subAreas: ["Yakutpura Station", "Rein Bazar", "Rain Bazar", "Madannapet", "Shia Pharmacy Belt"],
    beatCode: "HYD-BEAT-3",
  },
  {
    key: "HYD_TALAB_KATTA",
    name: "Talab Katta & Saidabad",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    mrEmail: "abdulmannan@mrtracker.com",
    centroid: { lat: 17.3670, lng: 78.5060 },
    keywords: ["talab katta", "talabkatta", "sultan shahi", "bhavani nagar", "saidabad"],
    subAreas: ["Talab Katta", "Sultan Shahi", "Bhavani Nagar", "Saidabad"],
    beatCode: "HYD-BEAT-4",
  },
  {
    key: "HYD_BABA_NAGAR",
    name: "Baba Nagar & Phoolbagh",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    mrEmail: "abdulmannan@mrtracker.com",
    centroid: { lat: 17.3665, lng: 78.4990 },
    keywords: ["baba nagar", "babanagar", "phoolbagh", "pure health care", "azeem pharmacy", "azeem belt"],
    subAreas: ["Baba Nagar Clinics", "Pure Health Care", "Phoolbagh", "Azeem Belt"],
    beatCode: "HYD-BEAT-2",
  },
  {
    key: "HYD_PISALBANDA",
    name: "Pisalbanda & Balapur",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    mrEmail: "raheem@mrtracker.com",
    centroid: { lat: 17.3380, lng: 78.5120 },
    keywords: ["pisalbanda", "balapur", "chandrayangutta", "barkas", "bandlaguda"],
    subAreas: ["Pisalbanda", "Balapur", "Chandrayangutta", "Barkas", "Bandlaguda"],
    beatCode: "HYD-BEAT-6",
  },
  {
    key: "HYD_BANJARA",
    name: "Banjara Hills & Jubilee",
    previousName: "Banjara Hills & Jubilee",
    region: "Central West",
    zone: "Hyderabad Metro West",
    priority: 1,
    mrEmail: "abdulmubeen@mrtracker.com",
    centroid: { lat: 17.4325, lng: 78.4071 },
    keywords: ["banjara hills", "banjarahills", "jubilee hills", "jubileehills", "somajiguda", "panjagutta"],
    subAreas: ["Road No 1 to 12", "Jubilee Enclave", "Somajiguda Belt"],
    beatCode: "MET-BEAT-1",
  },
  {
    key: "HYD_CENTRAL",
    name: "Hyderabad Central & First Lancer",
    previousName: "Hyderabad",
    region: "Central Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    mrEmail: "raheem@mrtracker.com",
    centroid: { lat: 17.3616, lng: 78.4747 },
    keywords: ["first lancer", "masab tank", "mehdipatnam", "humayun nagar"],
    subAreas: ["First Lancer Belt", "Masab Tank", "Mehdipatnam"],
    beatCode: "HYD-BEAT-7",
  },

  // Zone 3: North Regional Corridor
  {
    key: "DELHI_CENTRAL",
    name: "North Delhi Central",
    previousName: "North Delhi Central",
    region: "North",
    zone: "Delhi Central",
    priority: 1,
    mrEmail: "mr@mrtracker.com",
    centroid: { lat: 28.7041, lng: 77.1025 },
    keywords: ["north delhi", "delhi central", "karol bagh", "connaught place"],
    subAreas: ["Delhi Industrial Area", "Karol Bagh", "Central Connaught"],
    beatCode: "DEL-BEAT-1",
  },
];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function matchEntityToTerritory(
  entity: {
    address?: string | null;
    clinicAddress?: string | null;
    subArea?: string | null;
    beatName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    currentTerritoryName?: string | null;
  }
): {
  territoryKey: string;
  territoryName: string;
  subArea: string;
  beatName: string;
  matchMethod: "SUBAREA_EXACT" | "KEYWORD" | "GPS_CENTROID" | "CORRIDOR_FALLBACK";
} {
  const rawAddr = (entity.clinicAddress || entity.address || "").toLowerCase();
  const subAreaInput = (entity.subArea || "").toLowerCase();
  const beatInput = (entity.beatName || "").toLowerCase();
  const fullText = `${rawAddr} ${subAreaInput} ${beatInput}`;

  // 1. Check SubArea exact match
  if (entity.subArea) {
    for (const t of ELABORATED_TERRITORIES) {
      for (const sa of t.subAreas) {
        if (sa.toLowerCase() === subAreaInput) {
          return {
            territoryKey: t.key,
            territoryName: t.name,
            subArea: sa,
            beatName: `${t.beatCode}: ${t.name}`,
            matchMethod: "SUBAREA_EXACT",
          };
        }
      }
    }
  }

  // 2. Keyword exact match
  for (const t of ELABORATED_TERRITORIES) {
    for (const kw of t.keywords) {
      if (fullText.includes(kw)) {
        const foundSub = t.subAreas.find((s) => fullText.includes(s.toLowerCase())) || t.subAreas[0];
        return {
          territoryKey: t.key,
          territoryName: t.name,
          subArea: foundSub,
          beatName: `${t.beatCode}: ${t.name}`,
          matchMethod: "KEYWORD",
        };
      }
    }
  }

  // 3. GPS Centroid Distance
  const lat = entity.latitude;
  const lng = entity.longitude;
  if (lat && lng && lat !== 0 && lng !== 0) {
    let closestTerritory = ELABORATED_TERRITORIES[0];
    let minDistance = Infinity;

    for (const t of ELABORATED_TERRITORIES) {
      const dist = calculateDistanceKm(lat, lng, t.centroid.lat, t.centroid.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestTerritory = t;
      }
    }

    return {
      territoryKey: closestTerritory.key,
      territoryName: closestTerritory.name,
      subArea: closestTerritory.subAreas[0],
      beatName: `${closestTerritory.beatCode}: ${closestTerritory.name}`,
      matchMethod: "GPS_CENTROID",
    };
  }

  // 4. Corridor fallback
  const curr = (entity.currentTerritoryName || "").toLowerCase();
  if (curr.includes("tarnaka") || curr.includes("secunderabad") || curr.includes("shanti")) {
    const t = ELABORATED_TERRITORIES.find((x) => x.key === "SEC_TARNAKA")!;
    return {
      territoryKey: t.key,
      territoryName: t.name,
      subArea: t.subAreas[0],
      beatName: `${t.beatCode}: ${t.name}`,
      matchMethod: "CORRIDOR_FALLBACK",
    };
  }

  const defaultT = ELABORATED_TERRITORIES.find((x) => x.key === "HYD_SANTOSH_NAGAR")!;
  return {
    territoryKey: defaultT.key,
    territoryName: defaultT.name,
    subArea: defaultT.subAreas[0],
    beatName: `${defaultT.beatCode}: ${defaultT.name}`,
    matchMethod: "CORRIDOR_FALLBACK",
  };
}

// -----------------------------------------------------------------------------
// WORKER THREAD IMPLEMENTATION
// -----------------------------------------------------------------------------
if (!isMainThread) {
  const { threadId, workerType, dbUrl, data } = workerData;
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  (async () => {
    const startTime = Date.now();

    try {
      if (workerType === "TERRITORY_PROVISIONER") {
        console.log(`[Thread ${threadId}: TERRITORY_PROVISIONER] Starting on ${dbUrl.split("@")[1]}...`);

        const employeeMap = new Map<string, string>();
        const employees = await prisma.employee.findMany({
          include: { user: { select: { email: true } } },
        });
        for (const e of employees) {
          if (e.user?.email) {
            employeeMap.set(e.user.email.toLowerCase(), e.id);
          }
        }

        const territoryMap: Record<string, string> = {}; // name -> id

        for (const def of ELABORATED_TERRITORIES) {
          const empId = def.mrEmail ? employeeMap.get(def.mrEmail.toLowerCase()) ?? null : null;

          // Check if previously existed under current or previous name
          let existing = await prisma.territory.findFirst({
            where: {
              OR: [
                { name: def.name },
                ...(def.previousName ? [{ name: def.previousName }] : []),
              ],
            },
          });

          if (existing) {
            const updated = await prisma.territory.update({
              where: { id: existing.id },
              data: {
                name: def.name,
                region: def.region,
                zone: def.zone,
                priority: def.priority,
                employeeId: empId ?? existing.employeeId,
              },
            });
            territoryMap[def.name] = updated.id;
          } else {
            const created = await prisma.territory.create({
              data: {
                name: def.name,
                region: def.region,
                zone: def.zone,
                priority: def.priority,
                employeeId: empId,
              },
            });
            territoryMap[def.name] = created.id;
          }
        }

        const count = await prisma.territory.count();
        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: { totalTerritories: count, territoryMap },
        });
      } else if (workerType === "DOCTOR_REMAPPER") {
        console.log(`[Thread ${threadId}: DOCTOR_REMAPPER] Wiring doctors on ${dbUrl.split("@")[1]}...`);
        const { territoryMap } = data;

        const doctors = await prisma.doctor.findMany({
          select: {
            id: true,
            fullName: true,
            clinicAddress: true,
            subArea: true,
            beatName: true,
            latitude: true,
            longitude: true,
            territory: { select: { name: true } },
          },
        });

        const breakdown: Record<string, number> = {};
        const methodStats: Record<string, number> = {};

        for (const doc of doctors) {
          const match = matchEntityToTerritory({
            clinicAddress: doc.clinicAddress,
            subArea: doc.subArea,
            beatName: doc.beatName,
            latitude: doc.latitude,
            longitude: doc.longitude,
            currentTerritoryName: doc.territory?.name,
          });

          const targetTerritoryId = territoryMap[match.territoryName];
          if (!targetTerritoryId) {
            throw new Error(`Target territory ${match.territoryName} not found in territoryMap`);
          }

          await prisma.doctor.update({
            where: { id: doc.id },
            data: {
              territoryId: targetTerritoryId,
              subArea: match.subArea,
              beatName: match.beatName,
            },
          });

          breakdown[match.territoryName] = (breakdown[match.territoryName] || 0) + 1;
          methodStats[match.matchMethod] = (methodStats[match.matchMethod] || 0) + 1;
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: { totalDoctors: doctors.length, breakdown, methodStats },
        });
      } else if (workerType === "CHEMIST_REMAPPER") {
        console.log(`[Thread ${threadId}: CHEMIST_REMAPPER] Wiring chemists on ${dbUrl.split("@")[1]}...`);
        const { territoryMap } = data;

        const chemists = await prisma.chemist.findMany({
          select: {
            id: true,
            name: true,
            address: true,
            subArea: true,
            beatName: true,
            latitude: true,
            longitude: true,
            territory: { select: { name: true } },
          },
        });

        const breakdown: Record<string, number> = {};
        const methodStats: Record<string, number> = {};

        for (const chem of chemists) {
          const match = matchEntityToTerritory({
            address: chem.address,
            subArea: chem.subArea,
            beatName: chem.beatName,
            latitude: chem.latitude,
            longitude: chem.longitude,
            currentTerritoryName: chem.territory?.name,
          });

          const targetTerritoryId = territoryMap[match.territoryName];
          if (!targetTerritoryId) {
            throw new Error(`Target territory ${match.territoryName} not found in territoryMap`);
          }

          await prisma.chemist.update({
            where: { id: chem.id },
            data: {
              territoryId: targetTerritoryId,
              subArea: match.subArea,
              beatName: match.beatName,
            },
          });

          breakdown[match.territoryName] = (breakdown[match.territoryName] || 0) + 1;
          methodStats[match.matchMethod] = (methodStats[match.matchMethod] || 0) + 1;
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: { totalChemists: chemists.length, breakdown, methodStats },
        });
      } else if (workerType === "INTEGRITY_REALIGNER") {
        console.log(`[Thread ${threadId}: INTEGRITY_REALIGNER] Harmonizing tour plans & distributors on ${dbUrl.split("@")[1]}...`);
        const { territoryMap } = data;

        // 1. Realign TourPlanDays with planned doctor's territory
        const daysWithDoctor = await prisma.tourPlanDay.findMany({
          where: { plannedDoctorId: { not: null } },
          include: { plannedDoctor: { select: { territoryId: true } } },
        });

        let updatedDaysCount = 0;
        for (const day of daysWithDoctor) {
          if (day.plannedDoctor?.territoryId && day.territoryId !== day.plannedDoctor.territoryId) {
            await prisma.tourPlanDay.update({
              where: { id: day.id },
              data: { territoryId: day.plannedDoctor.territoryId },
            });
            updatedDaysCount++;
          }
        }

        // 2. Realign distributors
        const distributors = await prisma.distributor.findMany();
        let updatedDistributorsCount = 0;
        for (const d of distributors) {
          const match = matchEntityToTerritory({ address: d.address, currentTerritoryName: d.name });
          const targetTerritoryId = territoryMap[match.territoryName] || territoryMap["Secunderabad Commercial"];
          if (targetTerritoryId && d.territoryId !== targetTerritoryId) {
            await prisma.distributor.update({
              where: { id: d.id },
              data: { territoryId: targetTerritoryId },
            });
            updatedDistributorsCount++;
          }
        }

        parentPort?.postMessage({
          threadId,
          status: "SUCCESS",
          workerType,
          durationMs: Date.now() - startTime,
          data: {
            updatedTourPlanDays: updatedDaysCount,
            totalTourPlanDaysChecked: daysWithDoctor.length,
            updatedDistributors: updatedDistributorsCount,
          },
        });
      }
    } catch (err: any) {
      console.error(`[Thread ${threadId}: ${workerType}] Error:`, err);
      parentPort?.postMessage({
        threadId,
        status: "ERROR",
        workerType,
        error: err.message || String(err),
      });
    } finally {
      await prisma.$disconnect();
    }
  })();
}

// -----------------------------------------------------------------------------
// MAIN THREAD CONTROLLER
// -----------------------------------------------------------------------------
if (isMainThread) {
  async function runWorker(
    threadId: number,
    workerType: string,
    dbUrl: string,
    data?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { threadId, workerType, dbUrl, data },
      });

      worker.on("message", (msg) => {
        if (msg.status === "SUCCESS") {
          resolve(msg);
        } else {
          reject(new Error(`Worker ${threadId} failed: ${msg.error}`));
        }
      });

      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker ${threadId} exited with code ${code}`));
      });
    });
  }

  async function executeMultiThreadedWiring() {
    console.log("==========================================================================");
    console.log("   🚀 MULTI-THREADED TERRITORY ELABORATOR & ENTITY WIRING ENGINE");
    console.log("==========================================================================");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const testDbUrl = devDbUrl.replace("/trend_mr?", "/trend_mr_test?");

    const dbs = [
      { name: "DEVELOPMENT (trend_mr)", url: devDbUrl },
      { name: "TEST (trend_mr_test)", url: testDbUrl },
    ];

    for (const targetDb of dbs) {
      console.log(`\n▶ [ENGINE] Starting Multi-Threaded Pipeline on ${targetDb.name}...`);
      const overallStart = Date.now();

      // STEP 1: Provision elaborated territories
      console.log(`\n--- STEP 1: Spawning Thread 1 (Territory Provisioner) ---`);
      const step1Result: any = await runWorker(1, "TERRITORY_PROVISIONER", targetDb.url);
      console.log(`✅ [Thread 1] Provisioned ${step1Result.data.totalTerritories} territories in ${step1Result.durationMs}ms`);
      const territoryMap = step1Result.data.territoryMap;

      // STEP 2: Concurrently execute Doctor remapping, Chemist remapping, and TourPlan realignment
      console.log(`\n--- STEP 2: Spawning Parallel Worker Threads (2, 3, 4) ---`);
      const [docRes, chemRes, alignRes]: any[] = await Promise.all([
        runWorker(2, "DOCTOR_REMAPPER", targetDb.url, { territoryMap }),
        runWorker(3, "CHEMIST_REMAPPER", targetDb.url, { territoryMap }),
        runWorker(4, "INTEGRITY_REALIGNER", targetDb.url, { territoryMap }),
      ]);

      console.log(`✅ [Thread 2: DOCTOR_REMAPPER] Processed & rewired ${docRes.data.totalDoctors} doctors in ${docRes.durationMs}ms`);
      console.log(`   Doctor Territory Breakdown:`, docRes.data.breakdown);
      console.log(`   Doctor Match Methods:`, docRes.data.methodStats);

      console.log(`✅ [Thread 3: CHEMIST_REMAPPER] Processed & rewired ${chemRes.data.totalChemists} chemists in ${chemRes.durationMs}ms`);
      console.log(`   Chemist Territory Breakdown:`, chemRes.data.breakdown);
      console.log(`   Chemist Match Methods:`, chemRes.data.methodStats);

      console.log(`✅ [Thread 4: INTEGRITY_REALIGNER] Realigned ${alignRes.data.updatedTourPlanDays} TourPlanDays & ${alignRes.data.updatedDistributors} distributors in ${alignRes.durationMs}ms`);

      // STEP 3: Verify results
      const prisma = new PrismaClient({ datasources: { db: { url: targetDb.url } } });
      const territoriesSummary = await prisma.territory.findMany({
        select: {
          name: true,
          region: true,
          zone: true,
          _count: { select: { doctors: true, chemists: true, distributors: true, tourPlanDays: true } },
        },
        orderBy: { name: "asc" },
      });

      console.log(`\n📊 [${targetDb.name}] ELABORATED TERRITORY POPULATION SUMMARY:`);
      console.table(
        territoriesSummary.map((t) => ({
          Territory: t.name,
          Region: t.region,
          Zone: t.zone,
          Doctors: t._count.doctors,
          Chemists: t._count.chemists,
          Distributors: t._count.distributors,
          TourPlanDays: t._count.tourPlanDays,
        }))
      );

      const unmappedDoctors = await prisma.doctor.count({ where: { territoryId: { equals: "" } } });
      const unmappedChemists = await prisma.chemist.count({ where: { territoryId: { equals: "" } } });
      console.log(`\n🛡️ Integrity Check: Unmapped Doctors = ${unmappedDoctors}, Unmapped Chemists = ${unmappedChemists}`);
      console.log(`⏱️ Completed ${targetDb.name} in ${Date.now() - overallStart}ms`);

      await prisma.$disconnect();
    }

    console.log("\n🎉 MULTI-THREADED TERRITORY ELABORATION & ENTITY WIRING COMPLETED SUCCESSFULLY ACROSS ALL DATABASES!");
  }

  executeMultiThreadedWiring().catch((err) => {
    console.error("FATAL ERROR in multi-threaded execution:", err);
    process.exit(1);
  });
}
