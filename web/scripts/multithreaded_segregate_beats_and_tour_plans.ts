import { isMainThread, Worker, parentPort, workerData } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import path from 'path';

export interface BeatDefinition {
  id: string;
  name: string;
  zone: 'Secunderabad & East Corridor' | 'South Hyderabad & Old City Corridor';
  subAreas: string[];
  keywords: string[];
  centroid: { lat: number; lng: number };
}

export const BEATS: BeatDefinition[] = [
  // Zone 1: Secunderabad & East Corridor
  {
    id: 'SEC-BEAT-1',
    name: 'Tarnaka Core & Lalaguda',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['Tarnaka Junction', 'Osmania University Road', 'Vijayapuri', 'South Lalaguda'],
    keywords: ['tarnaka', 'taranaka', 'osmania', 'vijayapuri', 'lalaguda', 's. lalaguda'],
    centroid: { lat: 17.4285, lng: 78.5310 }
  },
  {
    id: 'SEC-BEAT-2',
    name: 'Shanti Nagar & HMT Nagar',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['Shanti Nagar', 'BJzR Nagar', 'HMT Nagar', 'Jyothi Clinic Belt'],
    keywords: ['shanti nagar', 'shantinagar', 'hmt nagar', 'bjzr', 'jyothi clinic'],
    centroid: { lat: 17.4485, lng: 78.5080 }
  },
  {
    id: 'SEC-BEAT-3',
    name: 'Lalapet & Moula Ali',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['Lalapet Main Road', 'Railway Colony', 'Moula Ali Bridge'],
    keywords: ['lalapet', 'moula ali', 'moulaali', 'lalaguda gate'],
    centroid: { lat: 17.4460, lng: 78.5380 }
  },
  {
    id: 'SEC-BEAT-4',
    name: 'Nacharam & Mallapur',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['Nacharam Signal', 'Industrial Area', 'Mallapur', 'Raghavendra Nagar', 'Kakatiya Nagar'],
    keywords: ['nacharam', 'mallapur', 'raghavendra nagar', 'kakatiya nagar', 'nacharam signal'],
    centroid: { lat: 17.4360, lng: 78.5620 }
  },
  {
    id: 'SEC-BEAT-5',
    name: 'VST, Musheerabad & RTC X Roads',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['VST X Roads', 'Ramnagar', 'Musheerabad', 'Chikkadpally'],
    keywords: ['vst', 'ramnagar', 'musheerabad', 'chikkadpally', 'rtc x'],
    centroid: { lat: 17.4120, lng: 78.5020 }
  },
  {
    id: 'SEC-BEAT-6',
    name: 'Habsiguda & Uppal',
    zone: 'Secunderabad & East Corridor',
    subAreas: ['Habsiguda X Roads', 'Ramanthapur', 'Uppal Ring Road', 'Boduppal'],
    keywords: ['habsiguda', 'uppal', 'ramanthapur', 'boduppal', 'peerzadiguda'],
    centroid: { lat: 17.4110, lng: 78.5490 }
  },

  // Zone 2: South Hyderabad & Old City Corridor
  {
    id: 'HYD-BEAT-1',
    name: 'Santosh Nagar Main & IS Sadan',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Santosh Nagar Main Road', 'Watertank Belt', 'IS Sadan', 'Champapet'],
    keywords: ['santosh nagar', 'santoshnagar', 'is sadan', 'champapet', 'santosh nager', 'watertank'],
    centroid: { lat: 17.3590, lng: 78.5010 }
  },
  {
    id: 'HYD-BEAT-2',
    name: 'Baba Nagar & Phoolbagh',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Baba Nagar Clinics', 'Pure Health Care', 'Usman & Azeem Belt', 'Phoolbagh'],
    keywords: ['baba nagar', 'babanagar', 'phoolbagh', 'pure health care'],
    centroid: { lat: 17.3665, lng: 78.4990 }
  },
  {
    id: 'HYD-BEAT-3',
    name: 'Yakutpura & Rein Bazar',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Yakutpura Station', 'Rein Bazar', 'Rain Bazar', 'Shia Pharmacy Belt', 'Madannapet'],
    keywords: ['yakutpura', 'rein bazar', 'rain bazar', 'rain bazaar', 'madannapet', 'shia pharmacy'],
    centroid: { lat: 17.3620, lng: 78.4870 }
  },
  {
    id: 'HYD-BEAT-4',
    name: 'Talab Katta & Saidabad',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Talab Katta', 'Sultan Shahi', 'Bhavani Nagar', 'Saidabad'],
    keywords: ['talab katta', 'talabkatta', 'sultan shahi', 'bhavani nagar', 'saidabad'],
    centroid: { lat: 17.3670, lng: 78.5060 }
  },
  {
    id: 'HYD-BEAT-5',
    name: 'Charminar, Ghansi Bazar & Shah Gunj',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Ghansi Bazar', 'Shah Gunj', 'Mir Alam Mandi', 'Falaknuma', 'Charminar'],
    keywords: ['ghansi bazar', 'shah gunj', 'charminar', 'mir alam', 'falaknuma'],
    centroid: { lat: 17.3640, lng: 78.4740 }
  },
  {
    id: 'HYD-BEAT-6',
    name: 'Pisalbanda & Balapur',
    zone: 'South Hyderabad & Old City Corridor',
    subAreas: ['Pisalbanda', 'Balapur', 'Chandrayangutta', 'Barkas', 'Bandlaguda'],
    keywords: ['pisalbanda', 'balapur', 'chandrayangutta', 'barkas', 'bandlaguda'],
    centroid: { lat: 17.3380, lng: 78.5120 }
  }
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

export function classifyEntity(address: string, lat: number, lng: number, currentTerritoryName?: string): { beatId: string; beatName: string; subArea: string; matchMethod: 'KEYWORD' | 'GPS_CENTROID' | 'TERRITORY_FALLBACK' } {
  const cleanAddr = (address || '').toLowerCase();

  // 1. Keyword Exact / Fuzzy Match
  for (const b of BEATS) {
    for (const kw of b.keywords) {
      if (cleanAddr.includes(kw)) {
        // find subArea
        const sub = b.subAreas.find(s => cleanAddr.includes(s.toLowerCase())) || b.subAreas[0];
        return { beatId: b.id, beatName: b.name, subArea: sub, matchMethod: 'KEYWORD' };
      }
    }
  }

  // 2. GPS Centroid Match
  if (lat && lng && lat !== 0 && lng !== 0) {
    let closestBeat = BEATS[0];
    let minDistance = Infinity;

    // Filter beats if current territory is explicitly Secunderabad or South
    const isSecunderabad = (currentTerritoryName || '').toLowerCase().includes('tarnaka') || 
                          (currentTerritoryName || '').toLowerCase().includes('shanti');
    const isSouth = (currentTerritoryName || '').toLowerCase().includes('santosh');

    const candidateBeats = isSecunderabad 
      ? BEATS.filter(b => b.id.startsWith('SEC-'))
      : isSouth
      ? BEATS.filter(b => b.id.startsWith('HYD-'))
      : BEATS;

    for (const b of candidateBeats) {
      const dist = calculateDistanceKm(lat, lng, b.centroid.lat, b.centroid.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestBeat = b;
      }
    }
    return { beatId: closestBeat.id, beatName: closestBeat.name, subArea: closestBeat.subAreas[0], matchMethod: 'GPS_CENTROID' };
  }

  // 3. Fallback based on territory name
  const terr = (currentTerritoryName || '').toLowerCase();
  if (terr.includes('tarnaka') || terr.includes('shanti')) {
    return { beatId: 'SEC-BEAT-1', beatName: 'Tarnaka Core & Lalaguda', subArea: 'Tarnaka Junction', matchMethod: 'TERRITORY_FALLBACK' };
  }
  return { beatId: 'HYD-BEAT-1', beatName: 'Santosh Nagar Main & IS Sadan', subArea: 'Santosh Nagar Main Road', matchMethod: 'TERRITORY_FALLBACK' };
}

// -------------------------------------------------------------
// WORKER THREAD LOGIC
// -------------------------------------------------------------
if (!isMainThread) {
  const { workerType, items } = workerData;

  if (workerType === 'DOCTOR_CLASSIFIER') {
    const results = items.map((doc: any) => {
      const classification = classifyEntity(doc.clinicAddress, doc.latitude, doc.longitude, doc.territory?.name);
      return {
        id: doc.id,
        fullName: doc.fullName,
        subArea: classification.subArea,
        beatName: `${classification.beatId}: ${classification.beatName}`,
        beatId: classification.beatId,
        matchMethod: classification.matchMethod
      };
    });
    parentPort?.postMessage({ status: 'SUCCESS', count: results.length, data: results });
  } else if (workerType === 'CHEMIST_CLASSIFIER') {
    const results = items.map((chem: any) => {
      const classification = classifyEntity(chem.address, chem.latitude, chem.longitude, chem.territory?.name);
      return {
        id: chem.id,
        name: chem.name,
        subArea: classification.subArea,
        beatName: `${classification.beatId}: ${classification.beatName}`,
        beatId: classification.beatId,
        matchMethod: classification.matchMethod
      };
    });
    parentPort?.postMessage({ status: 'SUCCESS', count: results.length, data: results });
  }
}

// -------------------------------------------------------------
// MAIN THREAD CONTROLLER
// -------------------------------------------------------------
async function runWorker(workerType: string, items: any[]): Promise<any> {
  const plainItems = JSON.parse(JSON.stringify(items));
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { workerType, items: plainItems }
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker ${workerType} stopped with exit code ${code}`));
    });
  });
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 MULTI-THREADED AREA SEGREGATION & TOUR PLAN ENGINE');
  console.log('========================================================================');
  const prisma = new PrismaClient();

  try {
    // 1. Fetch raw data
    console.log('📦 Loading Doctors & Chemists from Local PostgreSQL...');
    const doctors = await prisma.doctor.findMany({
      include: { territory: { select: { id: true, name: true } } }
    });
    const chemists = await prisma.chemist.findMany({
      include: { territory: { select: { id: true, name: true } } }
    });
    console.log(`Loaded ${doctors.length} Doctors and ${chemists.length} Chemists.`);

    // 2. Spawn Worker Threads for High-Speed Classification
    console.log('\n🧵 Spawning Worker Threads...');
    const t0 = Date.now();

    const [doctorWorkerRes, chemistWorkerRes] = await Promise.all([
      runWorker('DOCTOR_CLASSIFIER', doctors),
      runWorker('CHEMIST_CLASSIFIER', chemists)
    ]);

    console.log(`✅ Doctor Classifier Thread: ${doctorWorkerRes.count} classified in ${Date.now() - t0}ms`);
    console.log(`✅ Chemist Classifier Thread: ${chemistWorkerRes.count} classified in ${Date.now() - t0}ms`);

    const classifiedDocs = doctorWorkerRes.data;
    const classifiedChemists = chemistWorkerRes.data;

    // Print Beat Distribution
    console.log('\n📊 BEAT DISTRIBUTION MATRIX:');
    const beatStats: Record<string, { doctors: number; chemists: number }> = {};
    for (const b of BEATS) {
      beatStats[b.id] = { doctors: 0, chemists: 0 };
    }
    for (const d of classifiedDocs) {
      if (beatStats[d.beatId]) beatStats[d.beatId].doctors++;
    }
    for (const c of classifiedChemists) {
      if (beatStats[c.beatId]) beatStats[c.beatId].chemists++;
    }

    for (const b of BEATS) {
      const stat = beatStats[b.id];
      console.log(`  [${b.id}] ${b.name.padEnd(36)} -> Docs: ${stat.doctors.toString().padStart(3)} | Chemists: ${stat.chemists.toString().padStart(3)} | Total: ${(stat.doctors + stat.chemists).toString().padStart(3)}`);
    }

    // 3. Database Persistence: Batch update Doctor and Chemist records with Beat & SubArea
    console.log('\n💾 Persisting Beat & SubArea assignments into Local Database...');
    let docUpdates = 0;
    for (const d of classifiedDocs) {
      await prisma.doctor.update({
        where: { id: d.id },
        data: {
          subArea: d.subArea,
          beatName: d.beatName
        }
      });
      docUpdates++;
    }

    let chemUpdates = 0;
    for (const c of classifiedChemists) {
      await prisma.chemist.update({
        where: { id: c.id },
        data: {
          subArea: c.subArea,
          beatName: c.beatName
        }
      });
      chemUpdates++;
    }
    console.log(`✅ Successfully updated ${docUpdates} Doctors and ${chemUpdates} Chemists in PostgreSQL!`);

    // 4. Territory Re-assignment / Consolidation:
    // Move any South/Old City clinics into 'Santosh Nagar & Yakutpura'
    // Move all Secunderabad/Tarnaka clinics into 'Tarnaka'
    console.log('\n🗺️ Harmonizing Territory Links for clean Tour Planning...');
    const tarnakaTerritory = await prisma.territory.findFirst({ where: { name: 'Tarnaka' } });
    const santoshTerritory = await prisma.territory.findFirst({ where: { name: 'Santosh Nagar & Yakutpura' } });

    if (tarnakaTerritory && santoshTerritory) {
      // All SEC beats belong to Tarnaka
      const secDocIds = classifiedDocs.filter((d: any) => d.beatId.startsWith('SEC-')).map((d: any) => d.id);
      const secChemIds = classifiedChemists.filter((c: any) => c.beatId.startsWith('SEC-')).map((c: any) => c.id);

      const hydDocIds = classifiedDocs.filter((d: any) => d.beatId.startsWith('HYD-')).map((d: any) => d.id);
      const hydChemIds = classifiedChemists.filter((c: any) => c.beatId.startsWith('HYD-')).map((c: any) => c.id);

      await prisma.doctor.updateMany({
        where: { id: { in: secDocIds } },
        data: { territoryId: tarnakaTerritory.id }
      });
      await prisma.chemist.updateMany({
        where: { id: { in: secChemIds } },
        data: { territoryId: tarnakaTerritory.id }
      });

      await prisma.doctor.updateMany({
        where: { id: { in: hydDocIds } },
        data: { territoryId: santoshTerritory.id }
      });
      await prisma.chemist.updateMany({
        where: { id: { in: hydChemIds } },
        data: { territoryId: santoshTerritory.id }
      });

      console.log(`✅ Harmonized ${secDocIds.length} Doctors and ${secChemIds.length} Chemists to Secunderabad / Tarnaka Corridor`);
      console.log(`✅ Harmonized ${hydDocIds.length} Doctors and ${hydChemIds.length} Chemists to South Hyderabad / Santosh Nagar Corridor`);
    }

    console.log('\n🎯 AREA SEGREGATION & BEAT RECONCILIATION COMPLETED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Error executing multi-threaded segregation:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (isMainThread) {
  main();
}
