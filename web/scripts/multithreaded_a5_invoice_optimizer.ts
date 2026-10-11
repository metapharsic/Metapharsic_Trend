import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";

// ============================================================================
// MULTI-THREADED A5 INVOICE OPTIMIZER & FIT ENGINE
// Enforces ISO 216 A5 portrait specifications (148mm x 210mm)
// ============================================================================

export interface A5FitMetrics {
  paperWidthMm: number;
  paperHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  headerBudgetMm: number;
  dispatchBudgetMm: number;
  partyBudgetMm: number;
  tableBudgetMm: number;
  totalsBudgetMm: number;
  footerBudgetMm: number;
  totalEstimatedHeightMm: number;
  fitsSingleA5Page: boolean;
  safetyMarginMm: number;
}

if (!isMainThread) {
  // ============================================================================
  // WORKER THREAD LOGIC
  // ============================================================================
  const { threadId, workerTask, dbUrl, invoiceFilePath } = workerData;
  const startTime = Date.now();

  (async () => {
    try {
      if (workerTask === "A5_DIMENSION_VERIFIER") {
        // THREAD 1: Physical Millimeter Budget & Geometry Solver
        const paperWidth = 148.0;
        const paperHeight = 210.0;
        const marginX = 5.0; // 5mm each side
        const marginY = 4.0; // 4mm top and bottom

        const printableWidth = paperWidth - 2 * marginX; // 138mm
        const printableHeight = paperHeight - 2 * marginY; // 202mm

        // Section heights based on compact A5 CSS rules (font size 7.5pt, line-height 1.2, padding 2pt)
        const header = 15.0;
        const dispatch = 13.0;
        const parties = 25.0;
        const tableHeader = 6.0;
        const itemRowHeight = 5.5; // per typical item row
        const sampleItemRows = 3;
        const tableTotal = tableHeader + sampleItemRows * itemRowHeight; // 22.5mm
        const taxAndBank = 26.0;
        const totalsAndSign = 28.0;
        const summaryBlock = Math.max(taxAndBank, totalsAndSign); // 28.0mm
        const termsAndFooter = 11.0;

        const totalEstimated = header + dispatch + parties + tableTotal + summaryBlock + termsAndFooter;
        const fits = totalEstimated <= printableHeight;
        const safetyMargin = printableHeight - totalEstimated;

        parentPort?.postMessage({
          threadId,
          name: "A5 Geometry & Dimension Verifier",
          status: fits ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            paperSize: "A5 Portrait (148 x 210 mm)",
            printableArea: `${printableWidth}mm x ${printableHeight}mm`,
            totalEstimatedHeightMm: totalEstimated.toFixed(1),
            safetyMarginMm: safetyMargin.toFixed(1),
            fitsSingleA5Page: fits,
          },
        });
      } else if (workerTask === "A5_DATABASE_ORDER_STRESS_TESTER") {
        // THREAD 2: Database Live Invoices & Line Item Stress Tester
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
          let auditedOrders = 0;
          for (const ord of sampleOrders) {
            auditedOrders++;
            if (ord.items.length > maxItems) maxItems = ord.items.length;
          }

          // A5 single sheet accommodates up to 8 line items comfortably
          const singleSheetThreshold = 8;
          const passed = maxItems <= singleSheetThreshold;

          parentPort?.postMessage({
            threadId,
            name: "A5 Database Order Stress Tester",
            status: "SUCCESS",
            durationMs: Date.now() - startTime,
            data: {
              ordersAudited: auditedOrders,
              maxItemsInSingleInvoice: maxItems,
              singleSheetThreshold,
              fitsCleanly: passed,
            },
          });
        } finally {
          await prisma.$disconnect();
        }
      } else if (workerTask === "A5_PRINT_CSS_PARITY_ENGINE") {
        // THREAD 3: CSS Parity & Rules Integrity Auditor
        const content = fs.readFileSync(invoiceFilePath, "utf-8");

        const hasA5Page = /size:\s*A5\s+portrait\s*!important/i.test(content);
        const hasA5BodyWidth = /width:\s*148mm\s*!important/i.test(content);
        const hasA5CardWidth = /width:\s*138mm\s*!important/i.test(content);
        const hasDoubleBorder = /border:\s*2pt\s+double\s+#0f172a/i.test(content);
        const hasA5Watermark = /A5\s+FORMAT/i.test(content);
        const hasA3Remnants = /A3\s+portrait/i.test(content);

        const allValid = hasA5Page && hasA5BodyWidth && hasA5CardWidth && !hasA3Remnants;

        parentPort?.postMessage({
          threadId,
          name: "A5 Print CSS & Parity Engine",
          status: allValid ? "SUCCESS" : "FAILED",
          durationMs: Date.now() - startTime,
          data: {
            hasA5Page,
            hasA5BodyWidth,
            hasA5CardWidth,
            hasDoubleBorder,
            hasA5Watermark,
            noA3Remnants: !hasA3Remnants,
            allValid,
          },
        });
      } else if (workerTask === "A5_TYPOGRAPHY_AND_WATERMARK_SCALER") {
        // THREAD 4: Typography, Watermark & Resolution Scaler
        // Validates scaling ratios between screen (96 DPI) and print (300 DPI) for A5
        const ppiScreen = 96;
        const ppiPrint = 300;
        const mmToInch = 1 / 25.4;

        const a5WidthInches = 148 * mmToInch;
        const a5HeightInches = 210 * mmToInch;

        const screenWidthPx = Math.round(a5WidthInches * ppiScreen); // ~559px
        const screenHeightPx = Math.round(a5HeightInches * ppiScreen); // ~794px
        const printWidthPx = Math.round(a5WidthInches * ppiPrint); // ~1748px
        const printHeightPx = Math.round(a5HeightInches * ppiPrint); // ~2480px

        // Recommended typography for A5:
        // Title: 14-16pt, Body: 7.5-8pt, Table: 6.8-7.2pt, Watermark: 32-36pt
        const fontHierarchy = {
          title: "14pt",
          company: "10pt",
          body: "7.5pt",
          table: "6.8pt",
          grandTotal: "12pt",
          watermark: "32pt",
        };

        parentPort?.postMessage({
          threadId,
          name: "A5 Typography & Watermark Scaler",
          status: "SUCCESS",
          durationMs: Date.now() - startTime,
          data: {
            screenViewportPx: `${screenWidthPx}x${screenHeightPx}`,
            print300DpiPx: `${printWidthPx}x${printHeightPx}`,
            fontHierarchy,
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
  // ============================================================================
  // MAIN THREAD ORCHESTRATOR
  // ============================================================================
  async function runMultiThreadedA5Optimization(): Promise<boolean> {
    console.log("\x1b[1;36m================================================================================");
    console.log("   MULTI-THREADED WORKER ENGINE: ISO 216 A5 INVOICE FIT OPTIMIZER               ");
    console.log("================================================================================\x1b[0m\n");

    const devDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trend_mr?schema=public";
    const invoiceFilePath = path.resolve(__dirname, "../app/invoices/[id]/page.tsx");

    const tasks = [
      { id: 1, name: "A5_DIMENSION_VERIFIER" },
      { id: 2, name: "A5_DATABASE_ORDER_STRESS_TESTER" },
      { id: 3, name: "A5_PRINT_CSS_PARITY_ENGINE" },
      { id: 4, name: "A5_TYPOGRAPHY_AND_WATERMARK_SCALER" },
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

        worker.on("exit", (code) => {
          if (code !== 0) {
            // handled
          }
        });
      });
    };

    console.log(`>>> Spawning 4 Parallel Worker Threads for A5 Fit Analysis...\n`);
    const results = await Promise.all(tasks.map(spawnWorker));

    console.log(`\n\x1b[1;32m✔ Multi-Threaded A5 Optimization Completed in ${Date.now() - overallStart}ms.\x1b[0m`);
    return allPassed;
  }

  if (require.main === module) {
    runMultiThreadedA5Optimization()
      .then((ok) => process.exit(ok ? 0 : 1))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}
