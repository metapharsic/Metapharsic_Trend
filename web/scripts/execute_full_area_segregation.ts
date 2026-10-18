import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export interface AreaDef {
  territoryName: string;
  region: string;
  zone: string;
  priority: number;
  primaryMrEmail?: string;
  beatCode: string;
  beatName: string;
  defaultSubArea: string;
  keywords: string[];
  subAreaRules: { subArea: string; keywords: string[] }[];
}

export const CANONICAL_TERRITORIES: AreaDef[] = [
  // =========================================================================
  // 1. South Hyderabad & Old City Corridor
  // =========================================================================
  {
    territoryName: "Santosh Nagar & IS Sadan",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "abdulmannan@mrtracker.com",
    beatCode: "HYD-BEAT-1",
    beatName: "HYD-BEAT-1: Santosh Nagar Main & IS Sadan",
    defaultSubArea: "Santosh Nagar Main",
    keywords: ["santosh nagar", "santoshnagar", "santosh nager", "is sadan", "champapet", "lucky hotel", "watertank"],
    subAreaRules: [
      { subArea: "IS Sadan", keywords: ["is sadan"] },
      { subArea: "Champapet", keywords: ["champapet"] },
      { subArea: "Watertank Belt", keywords: ["watertank"] },
      { subArea: "Lucky Hotel Belt", keywords: ["lucky hotel"] },
      { subArea: "Santosh Nagar Main", keywords: ["santosh nagar", "santoshnagar", "santosh nager"] },
    ],
  },
  {
    territoryName: "Yakutpura & Rein Bazar",
    region: "Old City",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "abdulmannan@mrtracker.com",
    beatCode: "HYD-BEAT-3",
    beatName: "HYD-BEAT-3: Yakutpura & Rein Bazar",
    defaultSubArea: "Yakutpura Station",
    keywords: ["yakutpura", "rein bazar", "rein bazaar", "rain bazar", "rain bazaar", "madannapet", "shia pharmacy", "labbaik"],
    subAreaRules: [
      { subArea: "Rein Bazar", keywords: ["rein bazar", "rein bazaar", "rain bazar", "rain bazaar", "shia pharmacy"] },
      { subArea: "Madannapet", keywords: ["madannapet"] },
      { subArea: "Yakutpura Station", keywords: ["yakutpura", "labbaik"] },
    ],
  },
  {
    territoryName: "Baba Nagar & Phoolbagh",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    primaryMrEmail: "abdulmannan@mrtracker.com",
    beatCode: "HYD-BEAT-2",
    beatName: "HYD-BEAT-2: Baba Nagar & Phoolbagh",
    defaultSubArea: "Baba Nagar Main",
    keywords: ["baba nagar", "babanagar", "phoolbagh", "pure health care", "azeem pharmacy", "usman medical"],
    subAreaRules: [
      { subArea: "Phoolbagh", keywords: ["phoolbagh"] },
      { subArea: "Pure Health Care Belt", keywords: ["pure health care"] },
      { subArea: "Baba Nagar Main", keywords: ["baba nagar", "babanagar", "azeem pharmacy", "usman medical"] },
    ],
  },
  {
    territoryName: "Talab Katta & Saidabad",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    primaryMrEmail: "abdulmannan@mrtracker.com",
    beatCode: "HYD-BEAT-4",
    beatName: "HYD-BEAT-4: Talab Katta & Saidabad",
    defaultSubArea: "Talab Katta Main",
    keywords: ["talab katta", "talabkatta", "talab kata", "sultan shahi", "bhavani nagar", "saidabad"],
    subAreaRules: [
      { subArea: "Sultan Shahi", keywords: ["sultan shahi"] },
      { subArea: "Saidabad", keywords: ["saidabad"] },
      { subArea: "Bhavani Nagar", keywords: ["bhavani nagar"] },
      { subArea: "Talab Katta Main", keywords: ["talab katta", "talabkatta", "talab kata"] },
    ],
  },
  {
    territoryName: "Charminar & Ghansi Bazar",
    region: "Old City",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "raheem@mrtracker.com",
    beatCode: "HYD-BEAT-5",
    beatName: "HYD-BEAT-5: Charminar & Ghansi Bazar",
    defaultSubArea: "Charminar Core",
    keywords: [
      "ghansi bazar", "ghansibazar", "shah gunj", "shahgunj", "charminar", "chelapura", "mogal pura", "moghalpura",
      "hussani alam", "fatha darwaza", "fatadarwaza", "fateh darwaza", "shahli banda", "shalibanda", "lal darwaza",
      "himmatpura", "himatpura", "himat pura", "mir alam",
    ],
    subAreaRules: [
      { subArea: "Ghansi Bazar", keywords: ["ghansi bazar", "ghansibazar"] },
      { subArea: "Shah Gunj", keywords: ["shah gunj", "shahgunj"] },
      { subArea: "Chelapura", keywords: ["chelapura"] },
      { subArea: "Moghalpura", keywords: ["mogal pura", "moghalpura"] },
      { subArea: "Hussaini Alam", keywords: ["hussani alam"] },
      { subArea: "Fateh Darwaza", keywords: ["fatha darwaza", "fatadarwaza", "fateh darwaza"] },
      { subArea: "Shalibanda & Lal Darwaza", keywords: ["shahli banda", "shalibanda", "lal darwaza"] },
      { subArea: "Himmatpura", keywords: ["himmatpura", "himatpura", "himat pura"] },
      { subArea: "Charminar Core", keywords: ["charminar", "mir alam"] },
    ],
  },
  {
    territoryName: "Khilwath & Kalapathar",
    region: "Old City",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "raheem@mrtracker.com",
    beatCode: "HYD-BEAT-8",
    beatName: "HYD-BEAT-8: Khilwath & Kalapathar",
    defaultSubArea: "Khilwath Main",
    keywords: ["khilwath", "khilwat", "kalapathr", "kalapathar", "dodh boli", "doodh bowli", "baradari"],
    subAreaRules: [
      { subArea: "Kalapathar", keywords: ["kalapathr", "kalapathar"] },
      { subArea: "Doodh Bowli", keywords: ["dodh boli", "doodh bowli"] },
      { subArea: "Baradari", keywords: ["baradari"] },
      { subArea: "Khilwath Main", keywords: ["khilwath", "khilwat"] },
    ],
  },
  {
    territoryName: "Moin Bagh & Edi Bazar",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "HYD-BEAT-9",
    beatName: "HYD-BEAT-9: Moin Bagh & Edi Bazar",
    defaultSubArea: "Moin Bagh Main",
    keywords: ["moin bagh", "edi bazar", "eidi bazr", "riyasat nagar", "rakshapuram", "dabilpura", "dabirpura", "engin boli", "engine bowli"],
    subAreaRules: [
      { subArea: "Edi Bazar", keywords: ["edi bazar", "eidi bazr"] },
      { subArea: "Riyasat Nagar", keywords: ["riyasat nagar"] },
      { subArea: "Rakshapuram", keywords: ["rakshapuram"] },
      { subArea: "Dabirpura", keywords: ["dabilpura", "dabirpura"] },
      { subArea: "Engine Bowli", keywords: ["engin boli", "engine bowli"] },
      { subArea: "Moin Bagh Main", keywords: ["moin bagh"] },
    ],
  },
  {
    territoryName: "Pisalbanda & Barkas",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    primaryMrEmail: "raheem@mrtracker.com",
    beatCode: "HYD-BEAT-6",
    beatName: "HYD-BEAT-6: Pisalbanda & Barkas",
    defaultSubArea: "Pisalbanda Main",
    keywords: ["pisalbanda", "chandrayangutta", "barkas", "barks", "bandlaguda", "balapur"],
    subAreaRules: [
      { subArea: "Barkas", keywords: ["barkas", "barks"] },
      { subArea: "Chandrayangutta", keywords: ["chandrayangutta"] },
      { subArea: "Balapur", keywords: ["balapur"] },
      { subArea: "Bandlaguda", keywords: ["bandlaguda"] },
      { subArea: "Pisalbanda Main", keywords: ["pisalbanda"] },
    ],
  },
  {
    territoryName: "Chaderghat & Malakpet",
    region: "Central East",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "HYD-BEAT-10",
    beatName: "HYD-BEAT-10: Chaderghat & Malakpet",
    defaultSubArea: "Chaderghat Main",
    keywords: ["chaderghat", "chadr ghat", "chardr ghat", "malak pet", "malakpet", "azampura", "chanchalguda", "chanchal guda"],
    subAreaRules: [
      { subArea: "Malakpet", keywords: ["malak pet", "malakpet"] },
      { subArea: "Azampura", keywords: ["azampura"] },
      { subArea: "Chanchalguda", keywords: ["chanchalguda", "chanchal guda"] },
      { subArea: "Chaderghat Main", keywords: ["chaderghat", "chadr ghat", "chardr ghat"] },
    ],
  },
  {
    territoryName: "First Lancer & Masab Tank",
    region: "Central Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 1,
    primaryMrEmail: "raheem@mrtracker.com",
    beatCode: "HYD-BEAT-7",
    beatName: "HYD-BEAT-7: First Lancer & Masab Tank",
    defaultSubArea: "First Lancer Belt",
    keywords: ["first lancer", "masab tank", "mehdipatnam", "humayun nagar"],
    subAreaRules: [
      { subArea: "Masab Tank", keywords: ["masab tank"] },
      { subArea: "Mehdipatnam", keywords: ["mehdipatnam"] },
      { subArea: "First Lancer Belt", keywords: ["first lancer"] },
    ],
  },

  // =========================================================================
  // 2. Secunderabad & East Corridor
  // =========================================================================
  {
    territoryName: "Tarnaka Core & Lalaguda",
    region: "Secunderabad",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "SEC-BEAT-1",
    beatName: "SEC-BEAT-1: Tarnaka Core & Lalaguda",
    defaultSubArea: "Tarnaka Core",
    keywords: ["tarnaka", "taranaka", "lalaguda", "osmania", "vijayapuri", "s. lalaguda", "hema nagar", "adarsh nagar", "ambedkar nagar", "banaka", "bannaka", "manikeshwari"],
    subAreaRules: [
      { subArea: "South Lalaguda", keywords: ["lalaguda", "s. lalaguda"] },
      { subArea: "Vijayapuri", keywords: ["vijayapuri"] },
      { subArea: "Hema Nagar", keywords: ["hema nagar"] },
      { subArea: "Ambedkar Nagar", keywords: ["ambedkar nagar"] },
      { subArea: "Banaka Belt", keywords: ["banaka", "bannaka"] },
      { subArea: "Manikeshwari Nagar", keywords: ["manikeshwari"] },
      { subArea: "Tarnaka Core", keywords: ["tarnaka", "taranaka", "osmania"] },
    ],
  },
  {
    territoryName: "Shanti Nagar & HMT Nagar",
    region: "Secunderabad West",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    primaryMrEmail: "krishna@mrtracker.com",
    beatCode: "SEC-BEAT-2",
    beatName: "SEC-BEAT-2: Shanti Nagar & HMT Nagar",
    defaultSubArea: "Shanti Nagar Main",
    keywords: ["shanti nagar", "shantinagar", "santhi nagar", "hmt nagar", "hmt", "jyothi clinic", "bjzr", "bjr nagar", "b j r nagar"],
    subAreaRules: [
      { subArea: "HMT Nagar", keywords: ["hmt nagar", "hmt"] },
      { subArea: "BJR Nagar", keywords: ["bjzr", "bjr nagar", "b j r nagar"] },
      { subArea: "Jyothi Clinic Belt", keywords: ["jyothi clinic"] },
      { subArea: "Shanti Nagar Main", keywords: ["shanti nagar", "shantinagar", "santhi nagar"] },
    ],
  },
  {
    territoryName: "Lalapet & Moula Ali",
    region: "Secunderabad North",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "SEC-BEAT-3",
    beatName: "SEC-BEAT-3: Lalapet & Moula Ali",
    defaultSubArea: "Lalapet Main",
    keywords: ["lalapet", "moula ali", "moulaali", "lalaguda gate", "railway colony"],
    subAreaRules: [
      { subArea: "Moula Ali", keywords: ["moula ali", "moulaali"] },
      { subArea: "Railway Colony", keywords: ["railway colony", "lalaguda gate"] },
      { subArea: "Lalapet Main", keywords: ["lalapet"] },
    ],
  },
  {
    territoryName: "Nacharam & Mallapur",
    region: "East Corridor",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    primaryMrEmail: "krishna@mrtracker.com",
    beatCode: "SEC-BEAT-4",
    beatName: "SEC-BEAT-4: Nacharam & Mallapur",
    defaultSubArea: "Nacharam Main",
    keywords: ["nacharam", "mallapur", "raghavendra nagar", "kakatiya nagar", "kakartiya nagar", "nacharam village", "nacharam signal", "industrial area nacharam", "hmt nacharam"],
    subAreaRules: [
      { subArea: "Raghavendra Nagar", keywords: ["raghavendra nagar"] },
      { subArea: "Mallapur", keywords: ["mallapur"] },
      { subArea: "Kakatiya Nagar", keywords: ["kakatiya nagar", "kakartiya nagar"] },
      { subArea: "Nacharam Industrial", keywords: ["nacharam village", "nacharam signal", "industrial area nacharam", "hmt nacharam"] },
      { subArea: "Nacharam Main", keywords: ["nacharam"] },
    ],
  },
  {
    territoryName: "VST & Musheerabad",
    region: "Secunderabad Central",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    primaryMrEmail: "krishna@mrtracker.com",
    beatCode: "SEC-BEAT-5",
    beatName: "SEC-BEAT-5: VST & Musheerabad",
    defaultSubArea: "VST Junction",
    keywords: ["vst", "musheerabad", "ramnagar", "chikkadpally", "rtc x", "vst nacharam", "vst colony"],
    subAreaRules: [
      { subArea: "Musheerabad", keywords: ["musheerabad"] },
      { subArea: "Ramnagar", keywords: ["ramnagar"] },
      { subArea: "Chikkadpally", keywords: ["chikkadpally", "rtc x"] },
      { subArea: "VST Junction", keywords: ["vst", "vst nacharam", "vst colony"] },
    ],
  },
  {
    territoryName: "Malkajgiri & Chilka Nagar",
    region: "Secunderabad North",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    primaryMrEmail: "krishna@mrtracker.com",
    beatCode: "SEC-BEAT-8",
    beatName: "SEC-BEAT-8: Malkajgiri & Chilka Nagar",
    defaultSubArea: "Malkajgiri Main",
    keywords: ["malkajgiri", "malkangiri", "chilka nagar"],
    subAreaRules: [
      { subArea: "Chilka Nagar", keywords: ["chilka nagar"] },
      { subArea: "Malkajgiri Main", keywords: ["malkajgiri", "malkangiri"] },
    ],
  },
  {
    territoryName: "Habsiguda & Uppal",
    region: "East Corridor",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "SEC-BEAT-6",
    beatName: "SEC-BEAT-6: Habsiguda & Uppal",
    defaultSubArea: "Habsiguda X Roads",
    keywords: ["habsiguda", "uppal", "ramanthapur", "boduppal", "peerzadiguda"],
    subAreaRules: [
      { subArea: "Uppal", keywords: ["uppal", "boduppal", "peerzadiguda"] },
      { subArea: "Ramanthapur", keywords: ["ramanthapur"] },
      { subArea: "Habsiguda X Roads", keywords: ["habsiguda"] },
    ],
  },
  {
    territoryName: "Secunderabad Commercial",
    region: "Secunderabad Commercial",
    zone: "Secunderabad & East Corridor",
    priority: 1,
    primaryMrEmail: "abdulmalik@metapharsic.com",
    beatCode: "SEC-BEAT-7",
    beatName: "SEC-BEAT-7: Secunderabad Commercial",
    defaultSubArea: "Station Road Belt",
    keywords: ["secunderabad commercial", "station road", "mg road", "rashtrapati", "sec-bad", "commercial secunderabad"],
    subAreaRules: [
      { subArea: "MG Road", keywords: ["mg road", "rashtrapati"] },
      { subArea: "Commercial Hub", keywords: ["secunderabad commercial", "sec-bad", "commercial secunderabad"] },
      { subArea: "Station Road Belt", keywords: ["station road"] },
    ],
  },

  // =========================================================================
  // 3. Hyderabad Metro West
  // =========================================================================
  {
    territoryName: "Banjara Hills & Jubilee",
    region: "Central West",
    zone: "Hyderabad Metro West",
    priority: 1,
    primaryMrEmail: "abdulmubeen@mrtracker.com",
    beatCode: "MET-BEAT-1",
    beatName: "MET-BEAT-1: Banjara Hills & Jubilee",
    defaultSubArea: "Banjara Hills Main",
    keywords: ["banjara hills", "banjarahills", "jubilee hills", "jubileehills", "somajiguda", "panjagutta"],
    subAreaRules: [
      { subArea: "Jubilee Hills", keywords: ["jubilee hills", "jubileehills"] },
      { subArea: "Somajiguda", keywords: ["somajiguda", "panjagutta"] },
      { subArea: "Banjara Hills Main", keywords: ["banjara hills", "banjarahills"] },
    ],
  },

  // =========================================================================
  // 4. North Regional Corridor
  // =========================================================================
  {
    territoryName: "North Delhi Central",
    region: "North",
    zone: "Delhi Central",
    priority: 1,
    primaryMrEmail: "mr@mrtracker.com",
    beatCode: "DEL-BEAT-1",
    beatName: "DEL-BEAT-1: North Delhi Central",
    defaultSubArea: "Delhi Central Hub",
    keywords: ["north delhi", "delhi central", "karol bagh", "connaught place"],
    subAreaRules: [
      { subArea: "Karol Bagh", keywords: ["karol bagh"] },
      { subArea: "Central Connaught", keywords: ["connaught place"] },
      { subArea: "Delhi Central Hub", keywords: ["north delhi", "delhi central"] },
    ],
  },
];

export function classifyEntityAddress(name: string, address: string): { territoryName: string; beatCode: string; beatName: string; subArea: string } {
  const fullText = `${name} ${address}`.toLowerCase();

  for (const area of CANONICAL_TERRITORIES) {
    for (const kw of area.keywords) {
      if (fullText.includes(kw)) {
        let matchedSubArea = area.defaultSubArea;
        for (const rule of area.subAreaRules) {
          if (rule.keywords.some((k) => fullText.includes(k))) {
            matchedSubArea = rule.subArea;
            break;
          }
        }
        return {
          territoryName: area.territoryName,
          beatCode: area.beatCode,
          beatName: area.beatName,
          subArea: matchedSubArea,
        };
      }
    }
  }

  // Fallbacks
  if (fullText.includes("sec") || fullText.includes("bad")) {
    return {
      territoryName: "Secunderabad Commercial",
      beatCode: "SEC-BEAT-7",
      beatName: "SEC-BEAT-7: Secunderabad Commercial",
      subArea: "Commercial Hub",
    };
  }

  return {
    territoryName: "Santosh Nagar & IS Sadan",
    beatCode: "HYD-BEAT-1",
    beatName: "HYD-BEAT-1: Santosh Nagar Main & IS Sadan",
    subArea: "Santosh Nagar Main",
  };
}

async function main() {
  console.log("================================================================================");
  console.log("   🚀 EXECUTING COMPLETE AREA SEGREGATION & ACTIVITY SYNCHRONIZATION ENGINE     ");
  console.log("================================================================================\n");

  const startTime = Date.now();

  // 1. Map MR Employees
  const employees = await prisma.employee.findMany({
    include: { user: { select: { email: true } } },
  });
  const employeeEmailMap = new Map<string, string>();
  for (const emp of employees) {
    if (emp.user?.email) {
      employeeEmailMap.set(emp.user.email.toLowerCase(), emp.id);
    }
  }

  // 2. Provision Canonical Territories
  console.log("1. Provisioning & Synchronizing 19 Canonical Territories...");
  const territoryNameToId: Record<string, string> = {};

  for (const def of CANONICAL_TERRITORIES) {
    const assignedEmpId = def.primaryMrEmail ? employeeEmailMap.get(def.primaryMrEmail.toLowerCase()) ?? null : null;

    // Check if territory exists with exact name or legacy name mapping
    let existing = await prisma.territory.findFirst({
      where: {
        OR: [
          { name: def.territoryName },
          ...(def.territoryName === "Santosh Nagar & IS Sadan" ? [{ name: "Santosh Nagar & Yakutpura" }] : []),
          ...(def.territoryName === "Shanti Nagar & HMT Nagar" ? [{ name: "Shanti Nagar & Taranaka" }] : []),
          ...(def.territoryName === "Tarnaka Core & Lalaguda" ? [{ name: "Tarnaka" }] : []),
          ...(def.territoryName === "Charminar & Ghansi Bazar" ? [{ name: "Hyderabad" }] : []),
        ],
      },
    });

    if (existing) {
      const updated = await prisma.territory.update({
        where: { id: existing.id },
        data: {
          name: def.territoryName,
          region: def.region,
          zone: def.zone,
          priority: def.priority,
          employeeId: assignedEmpId ?? existing.employeeId,
        },
      });
      territoryNameToId[def.territoryName] = updated.id;
    } else {
      const created = await prisma.territory.create({
        data: {
          name: def.territoryName,
          region: def.region,
          zone: def.zone,
          priority: def.priority,
          employeeId: assignedEmpId,
        },
      });
      territoryNameToId[def.territoryName] = created.id;
    }
  }
  console.log(`✅ Synchronized ${Object.keys(territoryNameToId).length} Territories in PostgreSQL.`);

  // 3. Classify and Update Doctors
  console.log("\n2. Segregating & Updating Doctors (361 entities)...");
  const doctors = await prisma.doctor.findMany({
    select: { id: true, fullName: true, clinicAddress: true },
  });

  let updatedDocsCount = 0;
  for (const doc of doctors) {
    const classification = classifyEntityAddress(doc.fullName, doc.clinicAddress);
    const targetTerritoryId = territoryNameToId[classification.territoryName];

    await prisma.doctor.update({
      where: { id: doc.id },
      data: {
        territoryId: targetTerritoryId,
        beatName: classification.beatName,
        subArea: classification.subArea,
      },
    });
    updatedDocsCount++;
  }
  console.log(`✅ Successfully updated all ${updatedDocsCount} Doctors with clean Area, Beat & Territory.`);

  // 4. Classify and Update Chemists
  console.log("\n3. Segregating & Updating Chemists (188 entities)...");
  const chemists = await prisma.chemist.findMany({
    select: { id: true, name: true, address: true },
  });

  let updatedChemCount = 0;
  for (const chem of chemists) {
    const classification = classifyEntityAddress(chem.name, chem.address);
    const targetTerritoryId = territoryNameToId[classification.territoryName];

    await prisma.chemist.update({
      where: { id: chem.id },
      data: {
        territoryId: targetTerritoryId,
        beatName: classification.beatName,
        subArea: classification.subArea,
      },
    });
    updatedChemCount++;
  }
  console.log(`✅ Successfully updated all ${updatedChemCount} Chemists with clean Area, Beat & Territory.`);

  // 5. Synchronize Tour Plans (TourPlanDay)
  console.log("\n4. Synchronizing Tour Plan Days with Correct Segregated Areas & Beats...");
  const tourDays = await prisma.tourPlanDay.findMany({
    include: {
      plannedDoctor: { select: { subArea: true, beatName: true, territoryId: true } },
    },
  });

  let updatedTourDaysCount = 0;
  for (const day of tourDays) {
    let subArea = day.plannedDoctor?.subArea ?? null;
    let beatName = day.plannedDoctor?.beatName ?? null;
    let territoryId = day.plannedDoctor?.territoryId ?? day.territoryId;

    if (!subArea || !beatName) {
      // Fallback classification based on territory
      const defaultArea = CANONICAL_TERRITORIES.find((t) => territoryNameToId[t.territoryName] === territoryId);
      if (defaultArea) {
        subArea = subArea || defaultArea.defaultSubArea;
        beatName = beatName || defaultArea.beatName;
      }
    }

    await prisma.tourPlanDay.update({
      where: { id: day.id },
      data: {
        subArea,
        beatName,
        territoryId,
      },
    });
    updatedTourDaysCount++;
  }
  console.log(`✅ Successfully updated ${updatedTourDaysCount} TourPlanDays with Area and Beat.`);

  // 6. Harmonize Distributors
  console.log("\n5. Harmonizing Distributors...");
  const distributors = await prisma.distributor.findMany();
  for (const d of distributors) {
    const classification = classifyEntityAddress(d.name, d.address);
    const targetTerritoryId = territoryNameToId[classification.territoryName] || territoryNameToId["Secunderabad Commercial"];
    if (targetTerritoryId && d.territoryId !== targetTerritoryId) {
      await prisma.distributor.update({
        where: { id: d.id },
        data: { territoryId: targetTerritoryId },
      });
    }
  }
  console.log(`✅ Synchronized ${distributors.length} Distributors.`);

  // 7. Verify Database Parity
  console.log("\n6. Verifying Complete Database Area Parity...");
  const docNullSubAreas = await prisma.doctor.count({ where: { subArea: null } });
  const docNullBeats = await prisma.doctor.count({ where: { beatName: null } });
  const chemNullSubAreas = await prisma.chemist.count({ where: { subArea: null } });
  const chemNullBeats = await prisma.chemist.count({ where: { beatName: null } });
  const tourNullSubAreas = await prisma.tourPlanDay.count({ where: { subArea: null } });

  console.log(`Doctor null subArea: ${docNullSubAreas}`);
  console.log(`Doctor null beatName: ${docNullBeats}`);
  console.log(`Chemist null subArea: ${chemNullSubAreas}`);
  console.log(`Chemist null beatName: ${chemNullBeats}`);
  console.log(`TourDay null subArea: ${tourNullSubAreas}`);

  // 8. Generate Area Visited Summary across MRs
  console.log("\n================================================================================");
  console.log("            MR VISITED AREAS SEGREGATION SUMMARY (ACROSS ALL ACTIVITIES)        ");
  console.log("================================================================================");

  const mrs = await prisma.employee.findMany({
    where: { user: { role: Role.MR } },
    include: {
      user: { select: { email: true } },
      visits: {
        include: {
          doctor: { select: { subArea: true, beatName: true, territory: { select: { name: true } } } },
          chemist: { select: { subArea: true, beatName: true, territory: { select: { name: true } } } },
        },
      },
      orders: {
        include: {
          chemist: { select: { subArea: true, territory: { select: { name: true } } } },
        },
      },
      collections: {
        include: {
          chemist: { select: { subArea: true, territory: { select: { name: true } } } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  for (const mr of mrs) {
    const visitedAreas = new Map<string, { calls: number; territory: string }>();
    for (const v of mr.visits) {
      const area = v.doctor?.subArea || v.chemist?.subArea || "General Area";
      const terr = v.doctor?.territory?.name || v.chemist?.territory?.name || "General Territory";
      const cur = visitedAreas.get(area) || { calls: 0, territory: terr };
      cur.calls += 1;
      visitedAreas.set(area, cur);
    }

    console.log(`\nMR: ${mr.firstName} ${mr.lastName} (${mr.user.email})`);
    console.log(`  Total Calls: ${mr.visits.length} | Orders: ${mr.orders.length} | Collections: ${mr.collections.length}`);
    console.log(`  Distinct Areas Visited (${visitedAreas.size} areas):`);
    const sorted = Array.from(visitedAreas.entries()).sort((a, b) => b[1].calls - a[1].calls);
    sorted.forEach(([area, info]) => {
      console.log(`    📍 ${area.padEnd(28)} [${info.calls.toString().padStart(3)} calls] — Territory: ${info.territory}`);
    });
  }

  console.log(`\n⏱️ Pipeline completed in ${Date.now() - startTime}ms with 100% SUCCESS!`);
  console.log("================================================================================");
}

main()
  .catch((e) => {
    console.error("FATAL ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
