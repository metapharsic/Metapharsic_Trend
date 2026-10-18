import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AreaDef {
  territoryName: string;
  region: string;
  zone: string;
  priority: number;
  beatCode: string;
  beatName: string;
  defaultSubArea: string;
  keywords: string[];
  subAreaRules: { subArea: string; keywords: string[] }[];
}

export const AREA_CATALOG: AreaDef[] = [
  // --- South Hyderabad & Old City Corridor ---
  {
    territoryName: "Santosh Nagar & IS Sadan",
    region: "South Hyderabad",
    zone: "South Hyderabad & Old City Corridor",
    priority: 2,
    beatCode: "HYD-BEAT-1",
    beatName: "HYD-BEAT-1: Santosh Nagar Main & IS Sadan",
    defaultSubArea: "Santosh Nagar",
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
    beatCode: "HYD-BEAT-3",
    beatName: "HYD-BEAT-3: Yakutpura & Rein Bazar",
    defaultSubArea: "Yakutpura",
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
    beatCode: "HYD-BEAT-2",
    beatName: "HYD-BEAT-2: Baba Nagar & Phoolbagh",
    defaultSubArea: "Baba Nagar",
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
    beatCode: "HYD-BEAT-4",
    beatName: "HYD-BEAT-4: Talab Katta & Saidabad",
    defaultSubArea: "Talab Katta",
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
    beatCode: "HYD-BEAT-5",
    beatName: "HYD-BEAT-5: Charminar & Ghansi Bazar",
    defaultSubArea: "Charminar",
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
    beatCode: "HYD-BEAT-8",
    beatName: "HYD-BEAT-8: Khilwath & Kalapathar",
    defaultSubArea: "Khilwath",
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
    beatCode: "HYD-BEAT-9",
    beatName: "HYD-BEAT-9: Moin Bagh & Edi Bazar",
    defaultSubArea: "Moin Bagh",
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
    beatCode: "HYD-BEAT-6",
    beatName: "HYD-BEAT-6: Pisalbanda & Barkas",
    defaultSubArea: "Pisalbanda",
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
    beatCode: "HYD-BEAT-10",
    beatName: "HYD-BEAT-10: Chaderghat & Malakpet",
    defaultSubArea: "Chaderghat",
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
    beatCode: "HYD-BEAT-7",
    beatName: "HYD-BEAT-7: First Lancer & Masab Tank",
    defaultSubArea: "First Lancer",
    keywords: ["first lancer", "masab tank", "mehdipatnam", "humayun nagar"],
    subAreaRules: [
      { subArea: "Masab Tank", keywords: ["masab tank"] },
      { subArea: "Mehdipatnam", keywords: ["mehdipatnam"] },
      { subArea: "First Lancer Belt", keywords: ["first lancer"] },
    ],
  },

  // --- Secunderabad & East Corridor ---
  {
    territoryName: "Tarnaka Core & Lalaguda",
    region: "Secunderabad",
    zone: "Secunderabad & East Corridor",
    priority: 2,
    beatCode: "SEC-BEAT-1",
    beatName: "SEC-BEAT-1: Tarnaka Core & Lalaguda",
    defaultSubArea: "Tarnaka",
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
    beatCode: "SEC-BEAT-2",
    beatName: "SEC-BEAT-2: Shanti Nagar & HMT Nagar",
    defaultSubArea: "Shanti Nagar",
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
    beatCode: "SEC-BEAT-3",
    beatName: "SEC-BEAT-3: Lalapet & Moula Ali",
    defaultSubArea: "Lalapet",
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
    beatCode: "SEC-BEAT-4",
    beatName: "SEC-BEAT-4: Nacharam & Mallapur",
    defaultSubArea: "Nacharam",
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
    beatCode: "SEC-BEAT-5",
    beatName: "SEC-BEAT-5: VST & Musheerabad",
    defaultSubArea: "VST",
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
    beatCode: "SEC-BEAT-8",
    beatName: "SEC-BEAT-8: Malkajgiri & Chilka Nagar",
    defaultSubArea: "Malkajgiri",
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
    beatCode: "SEC-BEAT-6",
    beatName: "SEC-BEAT-6: Habsiguda & Uppal",
    defaultSubArea: "Habsiguda",
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
    beatCode: "SEC-BEAT-7",
    beatName: "SEC-BEAT-7: Secunderabad Commercial",
    defaultSubArea: "Station Road",
    keywords: ["secunderabad commercial", "station road", "mg road", "rashtrapati", "sec-bad", "commercial secunderabad"],
    subAreaRules: [
      { subArea: "MG Road", keywords: ["mg road", "rashtrapati"] },
      { subArea: "Commercial Hub", keywords: ["secunderabad commercial", "sec-bad", "commercial secunderabad"] },
      { subArea: "Station Road Belt", keywords: ["station road"] },
    ],
  },

  // --- Hyderabad Metro West ---
  {
    territoryName: "Banjara Hills & Jubilee",
    region: "Central West",
    zone: "Hyderabad Metro West",
    priority: 1,
    beatCode: "MET-BEAT-1",
    beatName: "MET-BEAT-1: Banjara Hills & Jubilee",
    defaultSubArea: "Banjara Hills",
    keywords: ["banjara hills", "banjarahills", "jubilee hills", "jubileehills", "somajiguda", "panjagutta"],
    subAreaRules: [
      { subArea: "Jubilee Hills", keywords: ["jubilee hills", "jubileehills"] },
      { subArea: "Somajiguda", keywords: ["somajiguda", "panjagutta"] },
      { subArea: "Banjara Hills Main", keywords: ["banjara hills", "banjarahills"] },
    ],
  },

  // --- North Regional Corridor ---
  {
    territoryName: "North Delhi Central",
    region: "North",
    zone: "Delhi Central",
    priority: 1,
    beatCode: "DEL-BEAT-1",
    beatName: "DEL-BEAT-1: North Delhi Central",
    defaultSubArea: "Delhi Central",
    keywords: ["north delhi", "delhi central", "karol bagh", "connaught place"],
    subAreaRules: [
      { subArea: "Karol Bagh", keywords: ["karol bagh"] },
      { subArea: "Central Connaught", keywords: ["connaught place"] },
      { subArea: "Delhi Central Hub", keywords: ["north delhi", "delhi central"] },
    ],
  },
];

export function classifyText(text: string): { territoryName: string; beatCode: string; beatName: string; subArea: string } {
  const clean = (text || "").toLowerCase();

  for (const area of AREA_CATALOG) {
    for (const kw of area.keywords) {
      if (clean.includes(kw)) {
        let matchedSubArea = area.defaultSubArea;
        for (const rule of area.subAreaRules) {
          if (rule.keywords.some((k) => clean.includes(k))) {
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

  // Fallback if not matched: South Hyderabad generic or Secunderabad
  if (clean.includes("sec") || clean.includes("bad")) {
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

async function testClassification() {
  const doctors = await prisma.doctor.findMany({ select: { id: true, fullName: true, clinicAddress: true } });
  const chemists = await prisma.chemist.findMany({ select: { id: true, name: true, address: true } });

  const territoryStats: Record<string, { docs: number; chems: number }> = {};
  const subAreaStats: Record<string, number> = {};

  for (const d of doctors) {
    const res = classifyText(`${d.fullName} ${d.clinicAddress}`);
    if (!territoryStats[res.territoryName]) territoryStats[res.territoryName] = { docs: 0, chems: 0 };
    territoryStats[res.territoryName].docs++;
    subAreaStats[res.subArea] = (subAreaStats[res.subArea] || 0) + 1;
  }

  for (const c of chemists) {
    const res = classifyText(`${c.name} ${c.address}`);
    if (!territoryStats[res.territoryName]) territoryStats[res.territoryName] = { docs: 0, chems: 0 };
    territoryStats[res.territoryName].chems++;
    subAreaStats[res.subArea] = (subAreaStats[res.subArea] || 0) + 1;
  }

  console.log("=== CLASSIFICATION TEST RESULTS ===");
  console.log("Territory Breakdown:");
  for (const [terr, stats] of Object.entries(territoryStats).sort((a, b) => (b[1].docs + b[1].chems) - (a[1].docs + a[1].chems))) {
    console.log(`  ${terr.padEnd(35)} -> Docs: ${stats.docs.toString().padStart(3)} | Chems: ${stats.chems.toString().padStart(3)} | Total: ${stats.docs + stats.chems}`);
  }

  console.log(`\nDistinct Sub-Areas Mapped: ${Object.keys(subAreaStats).length}`);
  console.log("Top 25 Sub-Areas:");
  Object.entries(subAreaStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([sa, count]) => {
      console.log(`  - [${count.toString().padStart(3)}] ${sa}`);
    });
}

testClassification().catch(console.error).finally(() => prisma.$disconnect());
