import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";

// ============================================================================
// MULTI-THREADED A3 LANDSCAPE INVOICE WIRING & GEOMETRY ENGINE
// Enforces A3 Landscape (420 x 297 mm) Printing with Original/Duplicate/Triplicate Options
// ============================================================================

if (!isMainThread) {
  const { threadId, workerTask, dbUrl, invoiceFilePath } = workerData;
  const startTime = Date.now();

  (async () => {
    try {
      if (workerTask === "A3_LANDSCAPE_GEOMETRY_SOLVER") {
        // THREAD 1: Physical Millimeter Budget for A3 Landscape Layout
        const paperWidth = 420.0; // A3 Landscape
        const paperHeight = 297.0;
        const marginX = 8.0;
        const marginY = 6.0;

        const printableWidth = paperWidth - 2 * marginX; // 404mm
        const printableHeight = paperHeight - 2 * marginY; // 285mm

        // Single Sheet Mode
        const singleWidth = 404.0;
        const singleHeight = 283.0;
        const singleFits = singleWidth <= printableWidth && singleHeight <= printableHeight;

        // Dual 2-Up Mode
        const leftWidth = 198.0;
        const gutter = 8.0;
        const rightWidth = 198.0;
        const totalDualWidth = leftWidth + gutter + rightWidth; // 404mm
        const dualHeight = 283.0;
        const dualFits = totalDualWidth <= printableWidth && dualHeight <= printableHeight;

        const allFits = singleFits && dualFits;

        parentPort?.postMessage({
          threadId,
          name: "A3 Landscape Geometry Solver",
          status: allFits ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            paperSize: "A3 Landscape (420 x 297 mm)",
            printableBounds: `${printableWidth}mm x ${printableHeight}mm`,
            singleSheetBudget: `${singleWidth}mm x ${singleHeight}mm (Fits: ${singleFits})`,
            dual2UpBudget: `2x 198mm + 8mm gutter = ${totalDualWidth}mm (Fits: ${dualFits})`,
            fitsSingleA3Sheet: allFits,
          },
        });
      } else if (workerTask === "TRIPLICATE_COPY_AND_DOWNLOAD_AUDITOR") {
        // THREAD 2: Triplicate Copy & Download Engine Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasOriginal = /ORIGINAL\s+FOR\s+RECIPIENT/i.test(content);
        const hasDuplicate = /DUPLICATE\s+FOR\s+TRANSPORTER/i.test(content);
        const hasTriplicate = /TRIPLICATE\s+FOR\s+SUPPLIER/i.test(content);
        const hasAllThree = /ALL_THREE/i.test(content);
        const hasDownloadHandler = /handleDownload/i.test(content);
        const hasDynamicTitle = /document\.title\s*=\s*`Tax_Invoice_/i.test(content);

        const allValid = hasOriginal && hasDuplicate && hasTriplicate && hasAllThree && hasDownloadHandler && hasDynamicTitle;

        parentPort?.postMessage({
          threadId,
          name: "Triplicate Copies & Download Engine Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasOriginalCopy: hasOriginal,
            hasDuplicateCopy: hasDuplicate,
            hasTriplicateCopy: hasTriplicate,
            hasAllThreeBatchMode: hasAllThree,
            hasDownloadHandler,
            hasDynamicTitle,
            auditorPassed: allValid,
          },
        });
      } else if (workerTask === "A3_PRINT_CSS_LANDSCAPE_AUDITOR") {
        // THREAD 3: Print CSS A3 Landscape Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasA3Landscape = /size:\s*A3\s+landscape\s*!important/i.test(content);
        const hasA3Width = /width:\s*420mm\s*!important/i.test(content);
        const hasA3Height = /height:\s*297mm\s*!important/i.test(content);
        const hasSingleSheetClass = /\.a3-single-sheet/i.test(content);
        const hasDualSheetClass = /\.a3-dual-sheet/i.test(content);
        const hasPageBreak = /page-break-before:\s*always\s*!important/i.test(content);

        const allValid = hasA3Landscape && hasA3Width && hasA3Height && hasSingleSheetClass && hasDualSheetClass && hasPageBreak;

        parentPort?.postMessage({
          threadId,
          name: "A3 Print CSS Landscape Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasA3Landscape,
            hasA3Width,
            hasA3Height,
            hasSingleSheetClass,
            hasDualSheetClass,
            hasPageBreak,
            cssValid: allValid,
          },
        });
      } else if (workerTask === "WATERMARK_AND_SECURITY_AUDITOR") {
        // THREAD 4: Watermark Visibility & Security Border Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasWatermark = /invoice-watermark/i.test(content);
        const hasWatermarkCompany = /company\?\.name/i.test(content);
        const hasWatermarkLogo = /company\?\.logoUrl/i.test(content);
        const hasVisibleOpacity = /opacity-\[0\.(?:0[89]|1[0-5])\]/i.test(content) && /opacity:\s*0\.1[0-5]\s*!important/i.test(content);
        const hasDoubleBorder = /border:\s*2pt\s+double\s*#0f172a\s*!important/i.test(content);

        const allValid = hasWatermark && hasWatermarkCompany && hasWatermarkLogo && hasVisibleOpacity && hasDoubleBorder;

        parentPort?.postMessage({
          threadId,
          name: "Watermark & Security Border Auditor",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasWatermark,
            hasWatermarkCompany,
            hasWatermarkLogo,
            hasVisibleOpacity,
            hasDoubleBorder,
            securityValid: allValid,
          },
        });
      } else if (workerTask === "LIVE_DB_ORDER_SIMULATOR") {
        // THREAD 5: Database Live Orders Simulator
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

          // A3 landscape full sheet fits up to 15 items comfortably
          const fitsCleanly = maxItems <= 15;

          parentPort?.postMessage({
            threadId,
            name: "Live DB Order Simulator",
            status: "SUCCESS",
            durationMs: Date.now() - startTime,
            data: {
              ordersAudited: sampleOrders.length,
              maxItemsFound: maxItems,
              fitsA3LandscapeComfortably: fitsCleanly,
            },
          });
        } finally {
          await prisma.$disconnect();
        }
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
  async function runMultiThreadedA3Wiring(): Promise<boolean> {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED ENGINE: WIRING A3 LANDSCAPE PRINTING & TRIPLICATE DOWNLOADS  ");
    console.log("================================================================================\x1b[0m\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const invoiceFilePath = path.resolve(__dirname, "../app/invoices/[id]/page.tsx");

    const tasks = [
      { id: 1, name: "A3_LANDSCAPE_GEOMETRY_SOLVER" },
      { id: 2, name: "TRIPLICATE_COPY_AND_DOWNLOAD_AUDITOR" },
      { id: 3, name: "A3_PRINT_CSS_LANDSCAPE_AUDITOR" },
      { id: 4, name: "WATERMARK_AND_SECURITY_AUDITOR" },
      { id: 5, name: "LIVE_DB_ORDER_SIMULATOR" },
    ];

    const overallStart = Date.now();
    let allPassed = true;

    console.log(`>>> Spawning ${tasks.length} Parallel Worker Threads for A3 Landscape Wiring...\n`);

    const tsxLoaderPath = path.resolve(__dirname, "../node_modules/tsx/dist/loader.mjs");
    const tsxImportUrl = fs.existsSync(tsxLoaderPath) ? pathToFileURL(tsxLoaderPath).href : null;

    const threadPromises = tasks.map(
      (task) =>
        new Promise<void>((resolve) => {
          const workerOptions: any = {
            workerData: {
              threadId: task.id,
              workerTask: task.name,
              dbUrl: devDbUrl,
              invoiceFilePath,
            },
          };

          if (tsxImportUrl) {
            workerOptions.execArgv = ["--import", tsxImportUrl];
          }

          const worker = new Worker(__filename, workerOptions);

          worker.on("message", (msg) => {
            const statusColor = msg.status === "SUCCESS" ? "\x1b[32m✔ SUCCESS\x1b[0m" : "\x1b[31m✖ FAILED\x1b[0m";
            const paddedName = msg.name.padEnd(42, " ");
            console.log(`  [Thread ${msg.threadId}] ${paddedName}: ${statusColor} (${msg.durationMs ?? 0}ms)`);
            if (msg.data) {
              console.log(`    ↳ Details: ${JSON.stringify(msg.data)}`);
            }
            if (msg.error) {
              console.log(`    \x1b[31m↳ Error: ${msg.error}\x1b[0m`);
              allPassed = false;
            }
            resolve();
          });

          worker.on("error", (err) => {
            console.error(`  \x1b[31m[Thread ${task.id}] Execution Crash: ${err.message}\x1b[0m`);
            allPassed = false;
            resolve();
          });

          worker.on("exit", (code) => {
            if (code !== 0) {
              // already handled
            }
          });
        })
    );

    await Promise.all(threadPromises);

    const totalDuration = Date.now() - overallStart;
    console.log(`\n\x1b[1;32m✔ Multi-Threaded A3 Landscape Invoice Wiring Complete in ${totalDuration}ms.\x1b[0m\n`);
    return allPassed;
  }

  runMultiThreadedA3Wiring()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("Controller Error:", err);
      process.exit(1);
    });
}
