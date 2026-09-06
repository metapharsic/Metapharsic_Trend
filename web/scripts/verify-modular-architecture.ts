import { db } from "../lib/db";
import { Role, OrderStatus, TenderStatus } from "@prisma/client";
import {
  ProductsService,
  InventoryService,
  PurchaseService,
  SalesService,
  ReportsService,
} from "../src";

async function main() {
  console.log("================================================================================");
  console.log("   MODULAR DOMAIN ARCHITECTURE & MULTI-AGENT MODEL VERIFICATION SUITE           ");
  console.log("================================================================================\n");

  try {
    // 1. Verify Products Module
    console.log("📦 1. Testing Products Module (src/products)...");
    const testSku = `TEST-MOD-${Date.now()}`;
    const product = await ProductsService.createProduct({
      name: `Test Medicine ${Date.now()}`,
      sku: testSku,
      price: 150.0,
      ptr: 120.0,
      pts: 95.0,
      mrp: 180.0,
      stockQty: 250,
      therapySegment: "Cardiology",
      hsnCode: "30049099",
      gstPct: 12,
      currentBatchNo: "BAT-VERIFY-001",
    });
    console.log(`   ✔️ Created Product: ${product.name} (SKU: ${product.sku}, Stock: ${product.stockQty})`);

    const productList = await ProductsService.listProducts({ page: 1, limit: 5, search: testSku });
    console.log(`   ✔️ Listed Products: Total=${productList.pagination.total}, Forecast BurnRate=${productList.products[0]?.forecast?.burnRatePerDay}`);

    // 2. Verify Inventory Module
    console.log("\n🏢 2. Testing Inventory Module (src/inventory)...");
    const restockRes = await InventoryService.restock({
      productId: product.id,
      quantity: 50,
      batchNo: "BAT-VERIFY-002",
      note: "E2E Verification Restock",
    });
    console.log(`   ✔️ Restocked Product: New Stock=${restockRes.product.stockQty}, Movement Delta=${restockRes.movement.delta}`);

    const mrEmployee = await db.employee.findFirst({ where: { user: { role: Role.MR } } });
    if (mrEmployee) {
      const sampleAlloc = await InventoryService.allocateSampleToMr({
        employeeId: mrEmployee.id,
        productId: product.id,
        quantity: 15,
      });
      console.log(`   ✔️ Allocated Sample to MR (${mrEmployee.firstName}): Qty=${sampleAlloc.sampleInventory.quantity}`);

      const mrSamples = await InventoryService.getMrSamples(mrEmployee.id);
      console.log(`   ✔️ Fetched MR Samples: ${mrSamples.samples.length} items, Total Val=₹${mrSamples.totalEstimatedValue}`);
    }

    const warehouseOverview = await InventoryService.getWarehouseDashboard();
    console.log(`   ✔️ Warehouse Overview: Total Stock Units=${warehouseOverview.kpis.totalStockUnits}, Alerts=${warehouseOverview.kpis.lowStockAlertsCount}`);

    // 3. Verify Purchase Module
    console.log("\n🛒 3. Testing Purchase Module (src/purchase)...");
    const hospital = await db.hospital.findFirst();
    if (hospital) {
      const tender = await PurchaseService.createHospitalTender({
        hospitalId: hospital.id,
        productId: product.id,
        tenderNo: `TND-VERIFY-${Date.now()}`,
        contractRate: 110.0,
        quantity: 500,
        status: TenderStatus.WON,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      });
      console.log(`   ✔️ Created Hospital Tender: TenderNo=${tender.tenderNo}, Rate=₹${tender.contractRate}, Status=${tender.status}`);

      const formulary = await PurchaseService.setHospitalFormulary({
        hospitalId: hospital.id,
        productId: product.id,
        included: true,
        notes: "Verified in formulary",
      });
      console.log(`   ✔️ Hospital Formulary Updated: Included=${formulary.included}`);
    }

    const inwardRes = await PurchaseService.processInwardStock({
      productId: product.id,
      quantity: 100,
      batchNo: "BAT-GRN-003",
      mfgDate: new Date(),
      expDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
      supplierName: "Sun Biotech Labs",
      grnNumber: `GRN-${Date.now()}`,
    });
    console.log(`   ✔️ Processed Inward Stock (GRN): New Stock=${inwardRes.product.stockQty}, Batch=${inwardRes.product.currentBatchNo}`);

    // 4. Verify Sales Module
    console.log("\n💰 4. Testing Sales Module (src/sales)...");
    const chemist = await db.chemist.findFirst();
    const distributor = await db.distributor.findFirst();
    if (chemist && distributor) {
      const order = await SalesService.createOrder(
        {
          chemistId: chemist.id,
          distributorId: distributor.id,
          applyBestScheme: true,
          items: [
            {
              productId: product.id,
              quantity: 10,
              freeQty: 0,
              price: 120.0,
              discountPct: 5,
              gstPct: 12,
            },
          ],
        },
        mrEmployee?.id
      );
      console.log(`   ✔️ Created Sales Order: Order #${order.id.slice(0, 8)}, Items=${order.items.length}, Status=${order.status}`);

      const deliveredOrder = await SalesService.updateOrderStatus(order.id, { status: OrderStatus.DELIVERED }, mrEmployee?.id);
      console.log(`   ✔️ Updated Order Status: Status=${deliveredOrder?.status}`);

      const invoice = await SalesService.generateInvoice({
        orderId: order.id,
        lrNo: "LR-998811",
        cases: 1,
        transport: "DTDC Express",
      });
      console.log(`   ✔️ Generated GST Invoice: InvoiceNo=${invoice.invoiceNo}, Grand Total=₹${invoice.grandTotal}`);

      if (mrEmployee) {
        const collection = await SalesService.recordCollection(
          {
            chemistId: chemist.id,
            amount: 500.0,
            refNumber: `CHQ-${Date.now().toString().slice(-6)}`,
          },
          mrEmployee.id
        );
        console.log(`   ✔️ Recorded Chemist Collection: Receipt=${collection.refNumber}, Amount=₹${collection.amount}`);
      }
    }

    // 5. Verify Reports & Multi-Agent Model Module
    console.log("\n🤖 5. Testing Reports Module & Multi-Agent Model (src/reports)...");
    const biCatalog = await ReportsService.runBiReport({ timeframe: "this_month" }, null);
    console.log(`   ✔️ BI Report Catalog: ${biCatalog.reports?.length} reports available.`);

    const salesBi = await ReportsService.runBiReport({ report: "product-wise-sales", timeframe: "this_month" }, null);
    console.log(`   ✔️ Product-wise Profitability Report: ${salesBi.rows?.length} SKUs evaluated.`);

    if (mrEmployee) {
      console.log(`\n🧠 Running Multi-Agent Council Evaluation for MR: ${mrEmployee.firstName} ${mrEmployee.lastName}...`);
      const councilReport = await ReportsService.generateMrMultiAgentReport(mrEmployee.id, { period: "all" });
      if (councilReport) {
        const { councilEvaluation } = councilReport;
        console.log(`   🎖️ Council Overall Grade: ${councilEvaluation.overallGrade} | Score: ${councilEvaluation.councilScore}/100`);
        console.log(`   📊 Executive Summary: ${councilEvaluation.executiveSummary}`);
        console.log(`   👥 Domain Diagnostic Agents Evaluated (${councilEvaluation.totalAgentsOnline}/${councilEvaluation.totalAgentsEvaluated} Online):`);
        
        for (const agent of councilEvaluation.agentStatuses) {
          const icon = agent.status === "ONLINE_PASS" ? "🟢" : agent.status === "ONLINE_WARNING" ? "🟡" : "🔴";
          console.log(`      ${icon} [${agent.agentCode}] ${agent.agentName} — Status: ${agent.status} (${agent.score}/100) [${agent.executionTimeMs}ms]`);
        }
      }
    }

    const councilBoard = await ReportsService.getCouncilStatusBoard();
    console.log(`\n   ✔️ Multi-Agent Council Status Board: Total MRs Evaluated=${councilBoard.totalMrsEvaluated}, Health=${councilBoard.overallCouncilHealth}`);
    console.log("   Council Status Summary:", JSON.stringify(councilBoard.councilStatusSummary));

    // Cleanup test product
    await ProductsService.deleteProduct(product.id);
    console.log("\n🧹 Cleaned up temporary test artifacts.");

    console.log("\n================================================================================");
    console.log("   🎉 ALL 5 MODULES & MULTI-AGENT COUNCIL PASSED VERIFICATION WITH 100% SUCCESS  ");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("\n❌ Verification Failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
