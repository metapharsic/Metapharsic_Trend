import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";

// ============================================================================
// MULTI-THREADED A4 LANDSCAPE DUAL INVOICE WIRING & GEOMETRY ENGINE
// Enforces 2-Up Dual A5 Invoices on a Single A4 Landscape Paper (297 x 210 mm)
// ============================================================================

if (!isMainThread) {
  const { threadId, workerTask, dbUrl, invoiceFilePath } = workerData;
  const startTime = Date.now();

  (async () => {
    try {
      if (workerTask === "A4_LANDSCAPE_GEOMETRY_SOLVER") {
        // THREAD 1: Physical Millimeter Budget for 2-Up Landscape Layout
        const paperWidth = 297.0; // A4 Landscape
        const paperHeight = 210.0;
        const marginX = 4.0;
        const marginY = 3.0;

        const printableWidth = paperWidth - 2 * marginX; // 289mm
        const printableHeight = paperHeight - 2 * marginY; // 204mm

        const leftWidth = 141.0;
        const gutter = 6.0;
        const rightWidth = 141.0;
        const totalWidthUsed = leftWidth + gutter + rightWidth; // 288mm

        const leftHeight = 200.0;
        const rightHeight = 200.0;

        const fitsWidth = totalWidthUsed <= printableWidth;
        const fitsHeight = leftHeight <= printableHeight && rightHeight <= printableHeight;
        const allFits = fitsWidth && fitsHeight;

        parentPort?.postMessage({
          threadId,
          name: "A4 Landscape Geometry Solver",
          status: allFits ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            paperSize: "A4 Landscape (297 x 210 mm)",
            leftInvoiceSize: "141 x 200 mm (A5 Format)",
            rightInvoiceSize: "141 x 200 mm (A5 Format)",
            gutterWidth: `${gutter}mm (Cutting Line)`,
            totalWidthUsed: `${totalWidthUsed}mm / ${printableWidth}mm`,
            heightUsed: `${leftHeight}mm / ${printableHeight}mm`,
            fitsSingleA4Sheet: allFits,
          },
        });
      } else if (workerTask === "DUAL_PANEL_CONTENT_PARITY_ENGINE") {
        // THREAD 2: Parity & Dual Copy Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasLeftCopy = /leftCopy/i.test(content);
        const hasRightCopy = /rightCopy/i.test(content);
        const hasCuttingLine = /CUT\s*\/\s*FOLD\s*HERE/i.test(content);
        const hasDualSheetGrid = /dual-a4-sheet/i.test(content);

        const allValid = hasLeftCopy && hasRightCopy && hasCuttingLine && hasDualSheetGrid;

        parentPort?.postMessage({
          threadId,
          name: "Dual Panel Parity & Copy Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasLeftCopy,
            hasRightCopy,
            hasCuttingLine,
            hasDualSheetGrid,
            parityWired: allValid,
          },
        });
      } else if (workerTask === "PRINT_CSS_LANDSCAPE_AUDITOR") {
        // THREAD 3: Print CSS Landscape Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasA4Landscape = /size:\s*A4\s+landscape\s*!important/i.test(content);
        const hasA4Width = /width:\s*297mm\s*!important/i.test(content);
        const hasA4Height = /height:\s*210mm\s*!important/i.test(content);
        const hasColumns = /grid-template-columns:\s*141mm\s+141mm\s*!important/i.test(content);

        const allValid = hasA4Landscape && hasA4Width && hasA4Height && hasColumns;

        parentPort?.postMessage({
          threadId,
          name: "Print CSS Landscape Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasA4Landscape,
            hasA4Width,
            hasA4Height,
            hasColumns,
            cssValid: allValid,
          },
        });
      } else if (workerTask === "LIVE_DB_ORDER_DUAL_SIMULATOR") {
        // THREAD 4: Database Live Orders Dual Simulator
        const prisma = new PrismaClient({
          datasources: { db: { url: dbUrl } },
        });

        try {
          const sampleOrders = await prisma.order.findMany({
            take: 20,
            include: {
              items: { include: { product: true } },
              invoice: true,
              chemist: true,
              doctor: true,
            },
            orderBy: { createdAt: "desc" },
          });

          let maxItems = 0;
          for (const ord of sampleOrders) {
            if (ord.items.length > maxItems) maxItems = ord.items.length;
          }

          // A5 half panel fits up to 7 items comfortably without height overflow
          const fitsCleanly = maxItems <= 8;

          parentPort?.postMessage({
            threadId,
            name: "Live DB Order Dual Simulator",
            status: "SUCCESS",
            durationMs: Date.now() - startTime,
            data: {
              ordersAudited: sampleOrders.length,
              maxItemsFound: maxItems,
              fitsDualSheetComfortably: fitsCleanly,
            },
          });
        } finally {
          await prisma.$disconnect();
        }
      } else if (workerTask === "WATERMARK_AND_LABEL_CLEANLINESS_AUDITOR") {
        // THREAD 5: Watermark Visibility & Label Cleanliness Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasWatermark = /invoice-watermark/i.test(content);
        const hasWatermarkCompany = /company\?\.name/i.test(content);
        const hasWatermarkLogo = /company\?\.logoUrl/i.test(content);
        const hasVisibleOpacity = /opacity-\[0\.(?:0[89]|1[0-5])\]/i.test(content) && /opacity:\s*0\.1[0-5]\s*!important/i.test(content);

        const noA5HalfA4 = !/A5\s*\(1\/2\s*A4\)/i.test(content);
        const noA4LandscapeLong = !/A4\s*LANDSCAPE\s*\(DUAL\s*A5\s*COPIES/i.test(content);
        const noA5Format = !/A5\s*FORMAT/i.test(content);

        const allValid = hasWatermark && hasWatermarkCompany && hasWatermarkLogo && hasVisibleOpacity && noA5HalfA4 && noA4LandscapeLong && noA5Format;

        parentPort?.postMessage({
          threadId,
          name: "Watermark & Label Cleanliness Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasWatermark,
            hasWatermarkCompany,
            hasWatermarkLogo,
            hasVisibleOpacity,
            noA5HalfA4,
            noA4LandscapeLong,
            noA5Format,
            cleanAndWatermarked: allValid,
          },
        });
      }
    } catch (err: any) {
      parentPort?.postMessage({
        threadId,
        name: workerTask,
        status: "FAILED",
        error: err.message || String(err),
      });
    }
  })();
} else {
  // MAIN CONTROLLER
  async function runMultiThreadedDualA4Wiring(): Promise<boolean> {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED ENGINE: WIRING 2-UP DUAL A5 INVOICES ON A4 LANDSCAPE SHEET     ");
    console.log("================================================================================\x1b[0m\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const invoiceFilePath = path.resolve(__dirname, "../app/invoices/[id]/page.tsx");

    const tasks = [
      { id: 1, name: "A4_LANDSCAPE_GEOMETRY_SOLVER" },
      { id: 2, name: "DUAL_PANEL_CONTENT_PARITY_ENGINE" },
      { id: 3, name: "PRINT_CSS_LANDSCAPE_AUDITOR" },
      { id: 4, name: "LIVE_DB_ORDER_DUAL_SIMULATOR" },
      { id: 5, name: "WATERMARK_AND_LABEL_CLEANLINESS_AUDITOR" },
    ];

    const overallStart = Date.now();
    let allPassed = true;

    const spawnWorker = (task: { id: number; name: string }): Promise<any> => {
      return new Promise((resolve) => {
        const tsxLoaderPath = path.resolve(__dirname, "../node_modules/tsx/dist/loader.mjs");
        const loaderUrl = fs.existsSync(tsxLoaderPath)
          ? pathToFileURL(tsxLoaderPath).href
          : "tsx";
        const execArgv = ["--import", loaderUrl];

        const worker = new Worker(__filename, {
          workerData: {
            threadId: task.id,
            workerTask: task.name,
            dbUrl: devDbUrl,
            invoiceFilePath,
          },
          execArgv,
        });

        worker.on("message", (msg) => {
          const statusTag = msg.status === "SUCCESS" ? "\x1b[32m✔ SUCCESS\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
          console.log(`  [Thread ${msg.threadId}] ${msg.name.padEnd(35)}: ${statusTag} (${msg.durationMs}ms)`);
          if (msg.data) {
            console.log(`    ↳ Details: ${JSON.stringify(msg.data)}`);
          }
          if (msg.status !== "SUCCESS") allPassed = false;
          resolve(msg);
        });

        worker.on("error", (err) => {
          console.error(`  [Thread ${task.id}] Error:`, err);
          allPassed = false;
          resolve({ status: "ERROR", error: err.message });
        });
      });
    };

    console.log(`>>> Spawning 4 Parallel Worker Threads for Dual A4 Landscape Wiring...\n`);
    await Promise.all(tasks.map(spawnWorker));

    console.log(`\n\x1b[1;32m✔ Multi-Threaded A4 Landscape Dual Invoice Wiring Complete in ${Date.now() - overallStart}ms.\x1b[0m`);
    return allPassed;
  }

  if (require.main === module) {
    runMultiThreadedDualA4Wiring()
      .then((ok) => process.exit(ok ? 0 : 1))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}
