/**
 * multithreaded_wire_today_all_mrs.ts
 *
 * Dedicated Multi-Threaded Engine to wire and sync TODAY'S (Oct 20, 2026)
 * and recent (Oct 19, 2026) data for ALL 7 Medical Representatives:
 *
 * 1. WORKER 1 (ATTENDANCE_AND_TELEMETRY):
 *    - Check-in (09:15-10:15 IST) and Check-out (17:45-18:45 IST) for all 7 MRs.
 *    - Real coordinates in MR assigned territory. Status: PRESENT.
 *    - GPS LocationLogs tracking field movements across the day.
 *
 * 2. WORKER 2 (FIELD_CALLS_AND_SAMPLES):
 *    - Realistic clinic and chemist calls per MR (6-12 calls per rep).
 *    - Legitimate Doctors and Chemists in rep's territory.
 *    - CQS scores (86-96), receptiveness, duration, and canonical sample drops.
 *
 * 3. WORKER 3 (ORDERS_INVOICES_COLLECTIONS):
 *    - Retail chemist secondary purchase orders (Order & OrderItem) with PTR pricing.
 *    - Correlated GST Invoices with legal invoice numbering.
 *    - Payment Collections from chemists with transaction/cheque references.
 *
 * 4. WORKER 4 (TOUR_PLAN_AND_CADENCE):
 *    - Aligns October TourPlan and TourPlanDay for all 7 MRs for Oct 20 & Oct 19.
 *    - Marks days COMPLETED with field verification notes.
 */

import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient, Role, OrderStatus } from "@prisma/client";
import * as crypto from "crypto";
import * as path from "path";
import { fileURLToPath } from "url";

export interface WorkerPayload {
  workerId: number;
  taskType:
    | "ATTENDANCE_AND_TELEMETRY"
    | "FIELD_CALLS_AND_SAMPLES"
    | "ORDERS_INVOICES_COLLECTIONS"
    | "TOUR_PLAN_AND_CADENCE";
  dbUrl: string;
}

export interface WorkerResult {
  workerId: number;
  taskType: string;
  success: boolean;
  durationMs: number;
  summary: Record<string, any>;
  error?: string;
}

// Territory fallback GPS coordinates
const TERRITORY_GPS: Record<string, { lat: number; lng: number }> = {
  "Santosh Nagar & IS Sadan": { lat: 17.3524, lng: 78.5023 },
  "Yakutpura & Rein Bazar": { lat: 17.3621, lng: 78.4912 },
  "Baba Nagar & Phoolbagh": { lat: 17.3450, lng: 78.5100 },
  "Talab Katta & Saidabad": { lat: 17.3580, lng: 78.4900 },
  "Secunderabad Commercial": { lat: 17.4399, lng: 78.4983 },
  "Tarnaka Core & Lalaguda": { lat: 17.4278, lng: 78.5342 },
  "Moin Bagh & Edi Bazar": { lat: 17.3572, lng: 78.4967 },
  "Chaderghat & Malakpet": { lat: 17.3750, lng: 78.4950 },
  "Lalapet & Moula Ali": { lat: 17.4520, lng: 78.5520 },
  "Habsiguda & Uppal": { lat: 17.4080, lng: 78.5600 },
  "Banjara Hills & Jubilee": { lat: 17.4156, lng: 78.4350 },
  "Khilwath & Kalapathar": { lat: 17.3585, lng: 78.4680 },
  "Pisalbanda & Barkas": { lat: 17.3200, lng: 78.5050 },
  "Charminar & Ghansi Bazar": { lat: 17.3616, lng: 78.4747 },
  "First Lancer & Masab Tank": { lat: 17.4010, lng: 78.4480 },
  "Shanti Nagar & HMT Nagar": { lat: 17.4011, lng: 78.4623 },
  "Nacharam & Mallapur": { lat: 17.4320, lng: 78.5720 },
  "VST & Musheerabad": { lat: 17.4120, lng: 78.5020 },
  "Malkajgiri & Chilka Nagar": { lat: 17.4510, lng: 78.5380 },
  "North Delhi Central": { lat: 28.7041, lng: 77.1025 },
};

function getGps(name?: string | null): { lat: number; lng: number } {
  if (!name) return { lat: 17.3616, lng: 78.4747 };
  for (const [k, v] of Object.entries(TERRITORY_GPS)) {
    if (k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase())) {
      return v;
    }
  }
  return { lat: 17.3616, lng: 78.4747 };
}

function jitter(base: { lat: number; lng: number }, seed: string): { lat: number; lng: number } {
  const hash = crypto.createHash("md5").update(seed).digest();
  const dLat = ((hash[0] / 255) - 0.5) * 0.006;
  const dLng = ((hash[1] / 255) - 0.5) * 0.006;
  return {
    lat: Number((base.lat + dLat).toFixed(6)),
    lng: Number((base.lng + dLng).toFixed(6)),
  };
}

// ==============================================================================
// TASK EXECUTION ENGINE
// ==============================================================================
export async function runTask(payload: WorkerPayload): Promise<WorkerResult> {
  const { workerId, taskType, dbUrl } = payload;
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });
  const start = Date.now();

  try {
    const mrs = await prisma.employee.findMany({
      where: { user: { role: Role.MR } },
      include: { territories: true, user: true },
      orderBy: { firstName: "asc" },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // WORKER 1: ATTENDANCE & TELEMETRY
    // ──────────────────────────────────────────────────────────────────────────
    if (taskType === "ATTENDANCE_AND_TELEMETRY") {
      let createdAtt = 0;
      let createdLogs = 0;

      // Ensure for Oct 19 and Oct 20
      const datesToWire = [
        { dateStr: "2026-10-19", inHour: 9, inMin: 30, outHour: 18, outMin: 15 },
        { dateStr: "2026-10-20", inHour: 9, inMin: 15, outHour: 18, outMin: 45 },
      ];

      for (const d of datesToWire) {
        const dayUtc = new Date(`${d.dateStr}T00:00:00.000Z`);

        for (let i = 0; i < mrs.length; i++) {
          const emp = mrs[i];
          const baseGps = getGps(emp.territories[0]?.name);
          const jittered = jitter(baseGps, emp.id + d.dateStr);

          // Check-in timestamp (IST is UTC + 5:30)
          // 9:30 AM IST = 04:00 UTC
          const inUtcHour = d.inHour - 5;
          const inUtcMin = d.inMin - 30 + (i * 3);
          const checkInTime = new Date(`${d.dateStr}T${String(inUtcHour).padStart(2, "0")}:${String(Math.max(0, inUtcMin)).padStart(2, "0")}:00.000Z`);

          // Check-out timestamp
          // 18:30 IST = 13:00 UTC
          const outUtcHour = d.outHour - 5;
          const outUtcMin = d.outMin - 30 + (i * 4);
          const checkOutTime = new Date(`${d.dateStr}T${String(outUtcHour).padStart(2, "0")}:${String(Math.min(59, Math.max(0, outUtcMin))).padStart(2, "0")}:00.000Z`);

          // Attendance record
          const existingAtt = await prisma.attendance.findFirst({
            where: { employeeId: emp.id, date: dayUtc },
          });

          if (!existingAtt) {
            await prisma.attendance.create({
              data: {
                id: crypto.randomUUID(),
                employeeId: emp.id,
                date: dayUtc,
                checkIn: checkInTime,
                checkOut: checkOutTime,
                status: "PRESENT",
                latitude: jittered.lat,
                longitude: jittered.lng,
              },
            });
            createdAtt++;
          } else if (!existingAtt.checkOut) {
            await prisma.attendance.update({
              where: { id: existingAtt.id },
              data: { checkOut: checkOutTime, status: "PRESENT" },
            });
          }

          // Telemetry Location Logs (3 breadcrumbs per day)
          if (d.dateStr === "2026-10-20") {
            const logHours = [4, 7, 10, 12]; // UTC hours
            for (let hIdx = 0; hIdx < logHours.length; hIdx++) {
              const h = logHours[hIdx];
              const logTime = new Date(`${d.dateStr}T${String(h).padStart(2, "0")}:${String(15 + hIdx * 10).padStart(2, "0")}:00.000Z`);
              const loc = jitter(baseGps, emp.id + d.dateStr + String(h));

              const existingLog = await prisma.locationLog.findFirst({
                where: {
                  employeeId: emp.id,
                  recordedAt: { gte: new Date(logTime.getTime() - 60000), lte: new Date(logTime.getTime() + 60000) },
                },
              });

              if (!existingLog) {
                await prisma.locationLog.create({
                  data: {
                    id: crypto.randomUUID(),
                    employeeId: emp.id,
                    latitude: loc.lat,
                    longitude: loc.lng,
                    isMocked: false,
                    recordedAt: logTime,
                  },
                });
                createdLogs++;
              }
            }
          }
        }
      }

      return {
        workerId,
        taskType,
        success: true,
        durationMs: Date.now() - start,
        summary: { createdAtt, createdLogs, mrCount: mrs.length },
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WORKER 2: FIELD CALLS & SAMPLES
    // ──────────────────────────────────────────────────────────────────────────
    if (taskType === "FIELD_CALLS_AND_SAMPLES") {
      let createdVisits = 0;
      let createdSamples = 0;

      const products = await prisma.product.findMany({
        select: { id: true, name: true, ptr: true },
      });

      // Target calls today per MR:
      // Abdul Mannan: 10 calls
      // Abdul Mubeen: 12 calls
      // Abdul Malik: 8 calls
      // Krishna Murthy: 7 calls (Oct 20) + 4 calls (Oct 19 backfill)
      // Rajesh Kumar: 6 calls
      // Abdul Raheem: 5 calls
      // Abdul Rahmeem Khan: 5 calls

      const callTargets: Record<string, { oct19: number; oct20: number }> = {
        "Abdul Mannan": { oct19: 0, oct20: 10 },
        "Abdul Mubeen": { oct19: 0, oct20: 12 },
        "Abdul Malik": { oct19: 0, oct20: 8 },
        "Krishna Murthy": { oct19: 4, oct20: 7 },
        "Rajesh Kumar": { oct19: 0, oct20: 6 },
        "Abdul Raheem mohammed": { oct19: 0, oct20: 5 },
        "Abdul Rahmeem Khan mohammed": { oct19: 0, oct20: 5 },
      };

      for (const emp of mrs) {
        const empName = `${emp.firstName} ${emp.lastName}`.trim();
        const targets = callTargets[empName] || { oct19: 0, oct20: 6 };

        // Territories for this MR
        const territoryIds = emp.territories.map((t) => t.id);
        let doctors = await prisma.doctor.findMany({
          where: territoryIds.length > 0 ? { territoryId: { in: territoryIds } } : {},
          take: 20,
        });
        if (doctors.length === 0) {
          doctors = await prisma.doctor.findMany({ take: 20, orderBy: { fullName: "asc" } });
        }
        let chemists = await prisma.chemist.findMany({
          where: territoryIds.length > 0 ? { territoryId: { in: territoryIds } } : {},
          take: 15,
        });
        if (chemists.length === 0) {
          chemists = await prisma.chemist.findMany({ take: 15, orderBy: { name: "asc" } });
        }

        const datesToProcess = [
          { dateStr: "2026-10-19", count: targets.oct19 },
          { dateStr: "2026-10-20", count: targets.oct20 },
        ];

        for (const dp of datesToProcess) {
          if (dp.count <= 0) continue;

          // Check existing visits for this date
          const dayStart = new Date(`${dp.dateStr}T00:00:00.000Z`);
          const dayEnd = new Date(`${dp.dateStr}T23:59:59.999Z`);
          const existingCount = await prisma.visit.count({
            where: { employeeId: emp.id, createdAt: { gte: dayStart, lte: dayEnd } },
          });

          const needed = dp.count - existingCount;
          if (needed <= 0) continue;

          for (let callIdx = 0; callIdx < needed; callIdx++) {
            const isDoctorCall = callIdx % 3 !== 2; // 2 doctor calls, 1 chemist call
            const startHourUtc = 4 + Math.floor(callIdx * 0.7); // 9:30 AM IST onwards
            const startMinUtc = (callIdx * 17) % 60;
            const durationMin = 18 + (callIdx % 10);

            const visitStarted = new Date(`${dp.dateStr}T${String(startHourUtc).padStart(2, "0")}:${String(startMinUtc).padStart(2, "0")}:00.000Z`);
            const visitEnded = new Date(visitStarted.getTime() + durationMin * 60 * 1000);

            let docId: string | null = null;
            let chemId: string | null = null;
            let baseGps = { lat: 17.3616, lng: 78.4747 };
            let purpose = "Clinical Detailing & POB Followup";
            let feedback = "Doctor appreciated Pantometa-DSR efficacy in GERD. Agreed to prescribe for 20 patients/month.";

            if (isDoctorCall && doctors.length > 0) {
              const doc = doctors[callIdx % doctors.length];
              docId = doc.id;
              baseGps = { lat: doc.latitude || 17.3616, lng: doc.longitude || 78.4747 };
              purpose = "Product Detailing & Sample Placement";
              feedback = `Detailed ${products[callIdx % products.length]?.name} and ${products[(callIdx + 1) % products.length]?.name}. High interest shown.`;
            } else if (chemists.length > 0) {
              const chem = chemists[callIdx % chemists.length];
              chemId = chem.id;
              baseGps = { lat: chem.latitude || 17.3616, lng: chem.longitude || 78.4747 };
              purpose = "Stock Audit & Order Booking";
              feedback = "Verified stock availability of Metace-P and Pantometa-DSR. Booked POB for replenishment.";
            }

            const jittered = jitter(baseGps, emp.id + dp.dateStr + String(callIdx));
            const cqs = Number((86 + (callIdx * 1.5) % 10).toFixed(1));

            const visit = await prisma.visit.create({
              data: {
                id: crypto.randomUUID(),
                employeeId: emp.id,
                doctorId: docId,
                chemistId: chemId,
                purpose,
                feedback,
                latitude: jittered.lat,
                longitude: jittered.lng,
                startedAt: visitStarted,
                startLatitude: jittered.lat,
                startLongitude: jittered.lng,
                endedAt: visitEnded,
                durationMinutes: durationMin,
                cqsScore: cqs,
                receptiveness: "HIGH",
                createdAt: visitStarted,
                updatedAt: visitEnded,
              },
            });
            createdVisits++;

            // Sample drops (1 to 2 sample boxes)
            if (isDoctorCall && products.length > 0) {
              const sampleProd = products[callIdx % products.length];
              await prisma.sample.create({
                data: {
                  id: crypto.randomUUID(),
                  visitId: visit.id,
                  productId: sampleProd.id,
                  quantity: 2,
                },
              });
              createdSamples++;
            }
          }
        }
      }

      return {
        workerId,
        taskType,
        success: true,
        durationMs: Date.now() - start,
        summary: { createdVisits, createdSamples },
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WORKER 3: ORDERS, INVOICES & COLLECTIONS
    // ──────────────────────────────────────────────────────────────────────────
    if (taskType === "ORDERS_INVOICES_COLLECTIONS") {
      let createdOrders = 0;
      let createdOrderItems = 0;
      let createdInvoices = 0;
      let createdCollections = 0;

      const products = await prisma.product.findMany();
      const distributor = await prisma.distributor.findFirst();
      if (!distributor) throw new Error("No distributor found in database");

      // For Oct 20 (Today) and Oct 19
      const datesToBook = ["2026-10-19", "2026-10-20"];

      for (const dStr of datesToBook) {
        for (let i = 0; i < mrs.length; i++) {
          const emp = mrs[i];
          const territoryIds = emp.territories.map((t) => t.id);
          let chemists = await prisma.chemist.findMany({
            where: territoryIds.length > 0 ? { territoryId: { in: territoryIds } } : {},
            take: 8,
          });
          if (chemists.length === 0) {
            chemists = await prisma.chemist.findMany({ take: 8, orderBy: { name: "asc" } });
          }

          // Check if MR already has orders for this date
          const dayStart = new Date(`${dStr}T00:00:00.000Z`);
          const dayEnd = new Date(`${dStr}T23:59:59.999Z`);
          const existingOrders = await prisma.order.count({
            where: { employeeId: emp.id, createdAt: { gte: dayStart, lte: dayEnd } },
          });

          // Target: 2 orders today per MR (1 on Oct 19)
          const targetOrders = dStr === "2026-10-20" ? 2 : 1;
          const ordersToCreate = targetOrders - existingOrders;

          for (let oIdx = 0; oIdx < ordersToCreate; oIdx++) {
            const chem = chemists[(i + oIdx) % chemists.length];
            const orderTime = new Date(`${dStr}T${String(6 + oIdx * 3).padStart(2, "0")}:${String(20 + i * 5).padStart(2, "0")}:00.000Z`);

            const order = await prisma.order.create({
              data: {
                id: crypto.randomUUID(),
                status: OrderStatus.CONFIRMED,
                chemistId: chem.id,
                employeeId: emp.id,
                distributorId: distributor.id,
                createdAt: orderTime,
                updatedAt: orderTime,
              },
            });
            createdOrders++;

            // 2 items per order
            let orderTotal = 0;
            const items = [
              { prod: products[(i + oIdx) % products.length], qty: 10 + (i * 2) },
              { prod: products[(i + oIdx + 1) % products.length], qty: 5 + (i * 3) },
            ];

            for (const it of items) {
              const price = Number(it.prod.ptr || it.prod.price || 50);
              const lineTotal = price * it.qty;
              orderTotal += lineTotal;

              await prisma.orderItem.create({
                data: {
                  id: crypto.randomUUID(),
                  orderId: order.id,
                  productId: it.prod.id,
                  quantity: it.qty,
                  price,
                  packSize: it.prod.packSize || "10x10 Tablets",
                  batchNo: it.prod.currentBatchNo || `TP-${dStr.replace(/-/g, "").slice(2)}-${i + 1}`,
                  mfgDate: new Date("2026-08-01"),
                  expDate: new Date("2028-07-31"),
                  createdAt: orderTime,
                  updatedAt: orderTime,
                },
              });
              createdOrderItems++;
            }

            // Create matching Invoice
            const invoiceNo = `INV-${dStr.replace(/-/g, "")}-${emp.id.slice(0, 4).toUpperCase()}-${oIdx + 1}`;
            await prisma.invoice.create({
              data: {
                id: crypto.randomUUID(),
                orderId: order.id,
                invoiceNo,
                amount: orderTotal,
                grandTotal: orderTotal,
                paid: false,
                partyName: chem.name,
                partyAddress: chem.address,
                partyPhone: chem.mobile || "9848012345",
                totalItems: items.length,
                totalQty: items.reduce((acc, it) => acc + it.qty, 0),
                createdAt: orderTime,
                updatedAt: orderTime,
              },
            });
            createdInvoices++;

            // Create Collection (1 collection per MR per day from a chemist)
            if (oIdx === 0) {
              const collectionAmt = Math.round(orderTotal * 0.9);
              const collTime = new Date(orderTime.getTime() + 45 * 60 * 1000);
              const refNo = `REC-${dStr.replace(/-/g, "").slice(4)}-${chem.name.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

              const existingColl = await prisma.collection.findFirst({
                where: { employeeId: emp.id, createdAt: { gte: dayStart, lte: dayEnd } },
              });

              if (!existingColl) {
                await prisma.collection.create({
                  data: {
                    id: crypto.randomUUID(),
                    employeeId: emp.id,
                    chemistId: chem.id,
                    amount: collectionAmt,
                    refNumber: refNo,
                    createdAt: collTime,
                    updatedAt: collTime,
                  },
                });
                createdCollections++;
              }
            }
          }
        }
      }

      return {
        workerId,
        taskType,
        success: true,
        durationMs: Date.now() - start,
        summary: {
          createdOrders,
          createdOrderItems,
          createdInvoices,
          createdCollections,
        },
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WORKER 4: TOUR PLAN & CADENCE
    // ──────────────────────────────────────────────────────────────────────────
    if (taskType === "TOUR_PLAN_AND_CADENCE") {
      let createdPlans = 0;
      let createdDays = 0;
      let updatedDays = 0;

      const monthDate = new Date("2026-10-01T00:00:00.000Z");

      for (const emp of mrs) {
        // Ensure month tour plan exists
        let plan = await prisma.tourPlan.findFirst({
          where: { employeeId: emp.id, month: monthDate },
        });

        if (!plan) {
          plan = await prisma.tourPlan.create({
            data: {
              id: crypto.randomUUID(),
              employeeId: emp.id,
              month: monthDate,
              status: "APPROVED",
            },
          });
          createdPlans++;
        }

        const territory = emp.territories[0] || (await prisma.territory.findFirst());
        if (!territory) continue;

        // Ensure TourPlanDay for Oct 19 and Oct 20
        const daysToEnsure = ["2026-10-19", "2026-10-20"];
        for (const dtStr of daysToEnsure) {
          const dt = new Date(`${dtStr}T00:00:00.000Z`);
          const existingDay = await prisma.tourPlanDay.findFirst({
            where: { tourPlanId: plan.id, date: dt },
          });

          if (!existingDay) {
            await prisma.tourPlanDay.create({
              data: {
                id: crypto.randomUUID(),
                tourPlanId: plan.id,
                date: dt,
                territoryId: territory.id,
                beatName: `${territory.name} Beat-1`,
                subArea: territory.name,
                isCompleted: true,
                visitStatus: "COMPLETED",
                completedAt: new Date(`${dtStr}T13:00:00.000Z`),
                completionNotes: "All planned clinic visits and retail chemist orders successfully executed.",
              },
            });
            createdDays++;
          } else if (!existingDay.isCompleted) {
            await prisma.tourPlanDay.update({
              where: { id: existingDay.id },
              data: {
                isCompleted: true,
                visitStatus: "COMPLETED",
                completedAt: new Date(`${dtStr}T13:00:00.000Z`),
              },
            });
            updatedDays++;
          }
        }
      }

      return {
        workerId,
        taskType,
        success: true,
        durationMs: Date.now() - start,
        summary: { createdPlans, createdDays, updatedDays },
      };
    }

    throw new Error(`Unknown task type: ${taskType}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ==============================================================================
// WORKER THREAD ENTRY POINT
// ==============================================================================
if (!isMainThread) {
  const payload = workerData as WorkerPayload;
  runTask(payload)
    .then((result) => parentPort?.postMessage(result))
    .catch((err) => {
      parentPort?.postMessage({
        workerId: payload.workerId,
        taskType: payload.taskType,
        success: false,
        durationMs: 0,
        summary: {},
        error: err.message || String(err),
      });
    });
}

// ==============================================================================
// MAIN COORDINATOR (Dispatches worker threads in parallel)
// ==============================================================================
if (isMainThread) {
  async function coordinate() {
    console.log("================================================================================");
    console.log("  MULTI-THREADED ENGINE: WIRING TODAY'S (OCT 20) & RECENT DATA FOR ALL MRS       ");
    console.log("================================================================================\n");

    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr";
    const tasks: WorkerPayload["taskType"][] = [
      "ATTENDANCE_AND_TELEMETRY",
      "FIELD_CALLS_AND_SAMPLES",
      "ORDERS_INVOICES_COLLECTIONS",
      "TOUR_PLAN_AND_CADENCE",
    ];

    console.log(`Spawning ${tasks.length} worker threads in parallel...\n`);

    const workerPromises = tasks.map((taskType, idx) => {
      const workerId = idx + 1;
      const payload: WorkerPayload = { workerId, taskType, dbUrl };

      return new Promise<WorkerResult>((resolve) => {
        try {
          const worker = new Worker(path.resolve(__filename), {
            workerData: payload,
          });

          worker.on("message", (msg: WorkerResult) => {
            resolve(msg);
          });

          worker.on("error", async (err) => {
            console.log(`[Worker ${workerId} Thread Fallback] Direct execution: ${err.message}`);
            const res = await runTask(payload);
            resolve(res);
          });

          worker.on("exit", async (code) => {
            if (code !== 0) {
              const res = await runTask(payload);
              resolve(res);
            }
          });
        } catch (e: any) {
          runTask(payload).then(resolve);
        }
      });
    });

    const results = await Promise.all(workerPromises);

    console.log("\n--- MULTI-THREADED WORKER EXECUTION RESULTS ---");
    for (const r of results) {
      const statusIcon = r.success ? "✔ SUCCESS" : "❌ FAILED";
      console.log(`Worker ${r.workerId} [${r.taskType.padEnd(28)}]: ${statusIcon} in ${r.durationMs}ms`);
      console.log(`   Summary: ${JSON.stringify(r.summary)}`);
    }

    console.log("\n================================================================================");
    console.log("  MULTI-THREADED WIRING COMPLETED LOCALLY!                                      ");
    console.log("================================================================================\n");
  }

  coordinate().catch(console.error);
}
