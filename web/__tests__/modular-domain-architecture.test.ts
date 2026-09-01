import { Role, OrderStatus, TenderStatus } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";

// Import Modular Domain Services and Handlers from web/src
import {
  ProductsService,
  InventoryService,
  PurchaseService,
  SalesService,
  ReportsService,
  MultiAgentCouncilCoordinator,
} from "../src";

describe("Modular Domain Architecture & Multi-Agent Model Tests", () => {
  let fx: TestFixture;
  let adminToken: string;
  let mrToken: string;

  beforeAll(async () => {
    fx = await resetFixture();
    adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    mrToken = tokenFor(fx.mrUserId, Role.MR);
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe("1. Products Module (src/products/)", () => {
    it("creates, queries, and calculates stock burn rate forecasting", async () => {
      const createdProd = await ProductsService.createProduct(
        {
          name: "Test Modular Azithromycin 500mg",
          sku: "TEST-MOD-AZITHRO",
          price: 120.0,
          ptr: 100.0,
          pts: 80.0,
          mrp: 150.0,
          stockQty: 500,
          therapySegment: "Antibiotics",
          hsnCode: "30049099",
          gstPct: 12,
        },
        fx.mrEmployeeId
      );

      expect(createdProd).toBeDefined();
      expect(createdProd.sku).toBe("TEST-MOD-AZITHRO");
      expect(createdProd.stockQty).toBe(500);

      const listRes = await ProductsService.listProducts({ page: 1, limit: 10, search: "TEST-MOD-AZITHRO" });
      expect(listRes.products.length).toBeGreaterThanOrEqual(1);
      const prod = listRes.products[0];
      expect(prod).toHaveProperty("stockValue");
      expect(prod).toHaveProperty("forecast");
      expect(prod.forecast).toHaveProperty("burnRatePerDay");

      // Cleanup
      await ProductsService.deleteProduct(createdProd.id);
    });
  });

  describe("2. Inventory Module (src/inventory/)", () => {
    it("handles stock adjustments, restocks, and MR sample allocations with audit logging", async () => {
      const prod = await testDb.product.findFirst();
      expect(prod).toBeDefined();
      const initialStock = prod!.stockQty;

      // Restock
      const restockRes = await InventoryService.restock(
        {
          productId: prod!.id,
          quantity: 50,
          batchNo: "BATCH-MOD-2026",
          note: "Unit Test Restock",
        },
        fx.mrEmployeeId
      );

      expect(restockRes.product.stockQty).toBe(initialStock + 50);
      expect(restockRes.movement.type).toBe("RESTOCK");

      // Allocate Sample to MR
      const allocRes = await InventoryService.allocateSampleToMr(
        {
          employeeId: fx.mrEmployeeId,
          productId: prod!.id,
          quantity: 10,
        },
        fx.mrEmployeeId
      );

      expect(allocRes.sampleInventory.quantity).toBeGreaterThanOrEqual(10);
      expect(allocRes.log.quantity).toBe(10);

      // Fetch MR Samples
      const mrSamples = await InventoryService.getMrSamples(fx.mrEmployeeId);
      expect(mrSamples.samples.length).toBeGreaterThanOrEqual(1);
      expect(mrSamples.totalEstimatedValue).toBeGreaterThan(0);

      // Warehouse Overview
      const dashboard = await InventoryService.getWarehouseDashboard();
      expect(dashboard.kpis.totalStockUnits).toBeGreaterThan(0);
    });
  });

  describe("3. Purchase Module (src/purchase/)", () => {
    it("processes inward stock receipts, hospital tenders, and trade schemes", async () => {
      const prod = await testDb.product.findFirst();
      expect(prod).toBeDefined();

      // Inward Stock Receipt (GRN)
      const inwardRes = await PurchaseService.processInwardStock({
        productId: prod!.id,
        quantity: 25,
        batchNo: "GRN-BATCH-999",
        mfgDate: new Date("2026-01-01"),
        expDate: new Date("2028-01-01"),
        supplierName: "Apex Pharma Labs",
        grnNumber: "GRN-2026-001",
      });

      expect(inwardRes.product.currentBatchNo).toBe("GRN-BATCH-999");
      expect(inwardRes.movement.delta).toBe(25);

      // Hospital Tender
      const tender = await PurchaseService.createHospitalTender({
        hospitalId: fx.hospitalId,
        productId: prod!.id,
        tenderNo: `TND-${Date.now()}`,
        contractRate: 85.0,
        quantity: 1000,
        status: TenderStatus.WON,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(tender.status).toBe(TenderStatus.WON);
      expect(Number(tender.contractRate)).toBe(85.0);

      // Hospital Formulary
      const formulary = await PurchaseService.setHospitalFormulary({
        hospitalId: fx.hospitalId,
        productId: prod!.id,
        included: true,
        notes: "Approved in Q3 formulary meeting",
      });

      expect(formulary.included).toBe(true);
    });
  });

  describe("4. Sales Module (src/sales/)", () => {
    it("creates secondary sales order, updates status lifecycle, and generates GST invoice", async () => {
      const prod = await testDb.product.findFirst();
      expect(prod).toBeDefined();

      // 1. Create Sales Order
      const order = await SalesService.createOrder(
        {
          chemistId: fx.chemistId,
          distributorId: fx.distributorId,
          items: [
            {
              productId: prod!.id,
              quantity: 5,
              price: 100.0,
              discountPct: 5,
              gstPct: 12,
            },
          ],
        },
        fx.mrEmployeeId
      );

      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.items.length).toBe(1);
      expect(Number(order.items[0].discountPct)).toBe(5);

      // 2. Deliver Order
      const delivered = await SalesService.updateOrderStatus(
        order.id,
        { status: OrderStatus.DELIVERED },
        fx.mrEmployeeId
      );
      expect(delivered?.status).toBe(OrderStatus.DELIVERED);

      // 3. Generate GST Invoice
      const invoice = await SalesService.generateInvoice({
        orderId: order.id,
        lrNo: "LR-7890",
        cases: 1,
        transport: "SafeExpress",
      });

      expect(invoice.invoiceNo).toMatch(/^INV-/);
      expect(Number(invoice.grandTotal)).toBeGreaterThan(0);

      // 4. Record Collection
      const collection = await SalesService.recordCollection(
        {
          chemistId: fx.chemistId,
          amount: 250.0,
          refNumber: "CHQ-123456",
        },
        fx.mrEmployeeId
      );

      expect(Number(collection.amount)).toBe(250.0);
    });
  });

  describe("5. Reports Module & Multi-Agent Model (src/reports/)", () => {
    it("executes BI enterprise reports and runs full Multi-Agent Council evaluation", async () => {
      // 1. BI Report Catalog
      const catalog = await ReportsService.runBiReport({ timeframe: "this_month" }, null);
      expect(catalog.reports.length).toBeGreaterThanOrEqual(6);

      // 2. Product-wise sales report
      const salesReport = await ReportsService.runBiReport({ report: "product-wise-sales", timeframe: "this_month" }, null);
      expect(salesReport.id).toBe("product-wise-sales");
      expect(Array.isArray(salesReport.rows)).toBe(true);

      // 3. Multi-Agent Council Evaluation
      const councilReport = await ReportsService.generateMrMultiAgentReport(fx.mrEmployeeId, { period: "all" });
      expect(councilReport).toBeDefined();
      expect(councilReport?.councilEvaluation).toBeDefined();

      const { councilEvaluation } = councilReport!;
      expect(councilEvaluation.overallGrade).toBeDefined();
      expect(councilEvaluation.councilScore).toBeGreaterThanOrEqual(0);
      expect(councilEvaluation.totalAgentsOnline).toBeGreaterThanOrEqual(8);
      expect(councilEvaluation.agentStatuses.length).toBe(9);

      // Verify specific agent statuses
      const agentCodes = councilEvaluation.agentStatuses.map((a) => a.agentCode);
      expect(agentCodes).toContain("ROLE_AUTH_AGENT");
      expect(agentCodes).toContain("FIELD_DCR_AGENT");
      expect(agentCodes).toContain("INVENTORY_BATCH_AGENT");
      expect(agentCodes).toContain("ROUTING_COMPLIANCE_AGENT");
      expect(agentCodes).toContain("COMMERCIAL_AGENT");
      expect(agentCodes).toContain("PURCHASE_PROCUREMENT_AGENT");
      expect(agentCodes).toContain("EXPENSE_HRMS_AGENT");
      expect(agentCodes).toContain("FINANCE_ACCOUNTS_AGENT");
      expect(agentCodes).toContain("DATA_INTEGRITY_AGENT");

      // Verify Live Council Status Board
      const statusBoard = await ReportsService.getCouncilStatusBoard();
      expect(statusBoard.totalMrsEvaluated).toBeGreaterThanOrEqual(1);
      expect(statusBoard.councilStatusSummary).toHaveProperty("ONLINE_PASS");
    });
  });
});
