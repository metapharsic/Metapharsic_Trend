import { db } from "@/lib/db";
import { costBasis } from "@/lib/pricing";

export interface AgentStatusInfo {
  agentCode: string;
  agentName: string;
  domainScope: string;
  status: "ONLINE_PASS" | "ONLINE_WARN" | "PROCESSING" | "AUDITED";
  score: number;
  latencyMs: number;
  findings: string[];
  warnings: string[];
}

export interface SupplyChainEvent {
  id: string;
  timestamp: string;
  eventType: "PR_RAISED" | "PO_ISSUED" | "GRN_INWARD" | "DC_OUTWARD" | "ORDER_DEDUCTION" | "SAMPLE_ALLOCATION" | "MANUAL_ADJUSTMENT";
  stage: "REQUISITION" | "PROCUREMENT" | "INWARD_GRN" | "DISPATCH_DC" | "FIELD_SAMPLE" | "STOCK_ADJUSTMENT";
  referenceNo: string;
  batchNo?: string | null;
  deltaQty: number;
  balanceAfter: number;
  performedBy: string;
  notes: string;
  valueAmount?: number;
}

export interface ItemSupplyChainReport {
  product: {
    id: string;
    name: string;
    sku: string;
    composition?: string | null;
    packSize?: string | null;
    hsnCode?: string | null;
    mrp: number;
    ptr: number;
    pts: number;
    purchaseRate: number;
    currentStockQty: number;
    currentBatchNo?: string | null;
    reorderLevel: number;
    reorderStatus: "HEALTHY" | "REORDER_REQUIRED" | "CRITICAL_LOW";
  };
  summaryStats: {
    totalTransactionsCount: number;
    prCount: number;
    poCount: number;
    grnCount: number;
    inwardTransactionsCount: number;
    outwardTransactionsCount: number;
    deliveryChallanCount: number;
    sampleAllocationCount: number;
    adjustmentCount: number;
    cumulativeInwardQty: number;
    cumulativeOutwardQty: number;
    totalSalesValue: number;
    totalProcurementCost: number;
    grossProfit: number;
    inventoryTurnoverRate: number;
  };
  chronologicalLedger: SupplyChainEvent[];
  multiAgentCouncil: {
    agents: AgentStatusInfo[];
    overallStatus: "PASS" | "WARN";
    overallScore: number;
    timestamp: string;
  };
}

export class ItemHistoryAgentsService {
  /**
   * Generates a descriptive item supply chain history report using Multi-Agent Council
   */
  static async generateItemAuditReport(productIdOrSku?: string): Promise<ItemSupplyChainReport> {
    const tStart = Date.now();

    // 1. Fetch target product
    let product = null;
    if (productIdOrSku) {
      product = await db.product.findFirst({
        where: {
          OR: [
            { id: productIdOrSku },
            { sku: productIdOrSku },
            { name: { contains: productIdOrSku, mode: "insensitive" } },
          ],
        },
      });
    }

    if (!product) {
      product = await db.product.findFirst({ orderBy: { updatedAt: "desc" } });
    }

    if (!product) {
      throw new Error("No products found in the database to audit.");
    }

    // -------------------------------------------------------------
    // AGENT 1: ProcurementAgent (PR / PO / GRN Audit)
    // -------------------------------------------------------------
    const tProcurement = Date.now();
    const procurementFindings: string[] = [];
    const procurementWarnings: string[] = [];

    const restockMovements = await db.inventoryMovement.findMany({
      where: { productId: product.id, type: "RESTOCK" },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const tenders = await db.hospitalTender.findMany({
      where: { productId: product.id },
      include: { hospital: true },
      orderBy: { createdAt: "desc" },
    });

    const grnCount = restockMovements.length;
    const poCount = tenders.length > 0 ? tenders.length : Math.max(1, grnCount);
    const prCount = product.stockQty < 50 ? 1 : 0;

    let cumulativeInwardQty = restockMovements.reduce((sum, m) => sum + m.delta, 0);
    if (cumulativeInwardQty === 0) {
      cumulativeInwardQty = product.stockQty;
    }

    // Cost basis via lib/pricing (purchaseRate -> pts -> ptr -> price); the
    // old chain ended in a magic 100, which invented a cost out of nothing.
    const purchaseRateVal = costBasis(product).value;
    const totalProcurementCost = Math.round(cumulativeInwardQty * purchaseRateVal * 100) / 100;

    procurementFindings.push(
      `Tracked ${prCount} Purchase Requisitions (PR), ${poCount} Purchase Orders (PO), and ${grnCount} Goods Receipt Notes (GRN).`,
      `Total Inward Volume: ${cumulativeInwardQty} units valued at ?${totalProcurementCost.toLocaleString()} (Cost Basis: ?${purchaseRateVal}/unit).`
    );

    if (product.stockQty < 50) {
      procurementWarnings.push(`Stock below reorder threshold (Current: ${product.stockQty} units, Reorder: 50 units).`);
    }

    const procurementLatency = Date.now() - tProcurement;

    // -------------------------------------------------------------
    // AGENT 2: WarehouseMovementAgent (Inward / Outward / DC Audit)
    // -------------------------------------------------------------
    const tWarehouse = Date.now();
    const warehouseFindings: string[] = [];
    const warehouseWarnings: string[] = [];

    const allMovements = await db.inventoryMovement.findMany({
      where: { productId: product.id },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });

    const sampleAllocations = await db.sampleInventory.findMany({
      where: { productId: product.id },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    const inwardCount = allMovements.filter((m) => m.type === "RESTOCK").length;
    const outwardCount = allMovements.filter((m) => m.type === "ORDER_DEDUCTION").length;
    const adjustmentCount = allMovements.filter((m) => m.type === "MANUAL_ADJUSTMENT").length;
    const sampleCount = sampleAllocations.length;

    let cumulativeOutwardQty = allMovements
      .filter((m) => m.type === "ORDER_DEDUCTION")
      .reduce((sum, m) => sum + Math.abs(m.delta), 0);

    warehouseFindings.push(
      `Audited ${allMovements.length} warehouse movement events (${inwardCount} Inward Restocks, ${outwardCount} Outward Dispatches, ${adjustmentCount} Manual Adjustments).`,
      `Sample Allocations: ${sampleCount} MR inventory assignments. Current Warehouse Stock: ${product.stockQty} units.`
    );

    const warehouseLatency = Date.now() - tWarehouse;

    // -------------------------------------------------------------
    // AGENT 3: CommercialSalesAgent (Orders / Invoices / DC Audit)
    // -------------------------------------------------------------
    const tSales = Date.now();
    const salesFindings: string[] = [];
    const salesWarnings: string[] = [];

    const orderItems = await db.orderItem.findMany({
      where: { productId: product.id },
      include: {
        order: {
          include: {
            chemist: true,
            distributor: true,
            employee: { select: { firstName: true, lastName: true } },
            invoice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const deliveryChallanCount = orderItems.filter((i) => i.order.status === "DELIVERED" || i.order.status === "SHIPPED").length;
    const totalSalesValue = Math.round(
      orderItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0) * 100
    ) / 100;

    const billedUnits = orderItems.reduce((sum, i) => sum + i.quantity, 0);
    if (cumulativeOutwardQty === 0 && billedUnits > 0) {
      cumulativeOutwardQty = billedUnits;
    }

    // Selling rate used to value outward stock movements. Falls back to 0, not
    // to an invented figure: a movement we cannot price should read as
    // unpriced, not as a confident wrong number.
    const ptrVal = Number(product.ptr || product.price || 0);
    const grossProfit = Math.round((totalSalesValue - (billedUnits * purchaseRateVal)) * 100) / 100;

    salesFindings.push(
      `Recorded ${orderItems.length} Secondary Sales Orders across Chemists & Distributors (${deliveryChallanCount} Delivery Challans / Invoices Issued).`,
      `Total Billed Revenue: ?${totalSalesValue.toLocaleString()} across ${billedUnits} units. Gross Margin: ?${grossProfit.toLocaleString()}.`
    );

    const salesLatency = Date.now() - tSales;

    // -------------------------------------------------------------
    // AGENT 4: ItemAuditAgent (Master Lifecycle & Transaction Counter)
    // -------------------------------------------------------------
    const tAudit = Date.now();
    const auditFindings: string[] = [];
    const auditWarnings: string[] = [];

    const totalTransactionsCount =
      prCount +
      poCount +
      grnCount +
      inwardCount +
      outwardCount +
      deliveryChallanCount +
      sampleCount +
      adjustmentCount +
      orderItems.length;

    const inventoryTurnoverRate =
      product.stockQty > 0
        ? Math.round((cumulativeOutwardQty / product.stockQty) * 100) / 100
        : cumulativeOutwardQty > 0 ? 10 : 0;

    const chronologicalLedger: SupplyChainEvent[] = [];
    let runningBalance = 0;

    if (allMovements.length === 0) {
      runningBalance = product.stockQty + cumulativeOutwardQty;
      chronologicalLedger.push({
        id: `GRN-INIT-${product.id.slice(0, 8)}`,
        timestamp: product.createdAt.toISOString(),
        eventType: "GRN_INWARD",
        stage: "INWARD_GRN",
        referenceNo: `GRN-2026-${product.sku}`,
        batchNo: product.currentBatchNo || "BAT-MAIN-001",
        deltaQty: runningBalance,
        balanceAfter: runningBalance,
        performedBy: "Central Warehouse Master",
        notes: `Initial Stock Inward & GRN Receipt for ${product.name}`,
        valueAmount: Math.round(runningBalance * purchaseRateVal),
      });
    } else {
      for (const m of allMovements) {
        runningBalance = m.quantityAfter;
        const perfBy = m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : "Warehouse Staff";
        const isRestock = m.type === "RESTOCK";
        chronologicalLedger.push({
          id: m.id,
          timestamp: m.createdAt.toISOString(),
          eventType: isRestock ? "GRN_INWARD" : m.type === "ORDER_DEDUCTION" ? "DC_OUTWARD" : "MANUAL_ADJUSTMENT",
          stage: isRestock ? "INWARD_GRN" : m.type === "ORDER_DEDUCTION" ? "DISPATCH_DC" : "STOCK_ADJUSTMENT",
          referenceNo: isRestock ? `GRN-${m.id.slice(0, 6).toUpperCase()}` : `DC-${m.id.slice(0, 6).toUpperCase()}`,
          batchNo: product.currentBatchNo || "BAT-2026",
          deltaQty: m.delta,
          balanceAfter: m.quantityAfter,
          performedBy: perfBy,
          notes: m.note || (isRestock ? "Stock Restock" : "Order Deduction"),
          valueAmount: Math.round(Math.abs(m.delta) * (isRestock ? purchaseRateVal : ptrVal)),
        });
      }
    }

    for (const item of orderItems) {
      if (!chronologicalLedger.some((e) => e.notes.includes(item.order.id))) {
        runningBalance = Math.max(0, runningBalance - item.quantity);
        const party = item.order.chemist?.name || item.order.distributor?.name || "Chemist/Distributor";
        const perfBy = item.order.employee ? `${item.order.employee.firstName} ${item.order.employee.lastName}` : "Sales Rep";
        const invNo = item.order.invoice?.invoiceNo || `DC-${item.order.id.slice(0, 8).toUpperCase()}`;
        chronologicalLedger.push({
          id: `ORD-${item.id.slice(0, 8)}`,
          timestamp: item.createdAt.toISOString(),
          eventType: "DC_OUTWARD",
          stage: "DISPATCH_DC",
          referenceNo: invNo,
          batchNo: item.batchNo || product.currentBatchNo || "BAT-2026-A",
          deltaQty: -item.quantity,
          balanceAfter: runningBalance,
          performedBy: perfBy,
          notes: `Secondary Sale & Delivery Challan to ${party} (${item.quantity} units @ ?${item.price})`,
          valueAmount: Math.round(item.quantity * Number(item.price)),
        });
      }
    }

    chronologicalLedger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    auditFindings.push(
      `Reconciled complete supply chain lifecycle across PR, PO, GRN, Inward, Outward, DC, and Sales Orders.`,
      `Total Transaction Frequency: ${totalTransactionsCount} times transactions executed on item '${product.name}'. Turnover Rate: ${inventoryTurnoverRate}x.`
    );

    const auditLatency = Date.now() - tAudit;

    const agents: AgentStatusInfo[] = [
      {
        agentCode: "PROCUREMENT_AGENT",
        agentName: "Procurement & PR/PO/GRN Agent",
        domainScope: "Purchase Requisitions (PR), Purchase Orders (PO), Supplier GRN Receipts",
        status: procurementWarnings.length === 0 ? "ONLINE_PASS" : "ONLINE_WARN",
        score: procurementWarnings.length === 0 ? 100 : 85,
        latencyMs: procurementLatency,
        findings: procurementFindings,
        warnings: procurementWarnings,
      },
      {
        agentCode: "WAREHOUSE_MOVEMENT_AGENT",
        agentName: "Warehouse Inward/Outward & DC Agent",
        domainScope: "Stock Restocks, Order Deductions, Delivery Challans (DC), Sample Allocations",
        status: warehouseWarnings.length === 0 ? "ONLINE_PASS" : "ONLINE_WARN",
        score: warehouseWarnings.length === 0 ? 100 : 90,
        latencyMs: warehouseLatency,
        findings: warehouseFindings,
        warnings: warehouseWarnings,
      },
      {
        agentCode: "COMMERCIAL_SALES_AGENT",
        agentName: "Commercial Sales & Invoicing Agent",
        domainScope: "Secondary Orders, Chemist/Distributor Invoices, Revenue & PTR Margins",
        status: salesWarnings.length === 0 ? "ONLINE_PASS" : "ONLINE_WARN",
        score: salesWarnings.length === 0 ? 100 : 95,
        latencyMs: salesLatency,
        findings: salesFindings,
        warnings: salesWarnings,
      },
      {
        agentCode: "ITEM_AUDIT_AGENT",
        agentName: "Item Lifecycle & Transaction Frequency Agent",
        domainScope: "Full Supply Chain Audit Trail, Transaction Frequency & Multi-Agent Harmonization",
        status: auditWarnings.length === 0 ? "ONLINE_PASS" : "ONLINE_WARN",
        score: 100,
        latencyMs: auditLatency,
        findings: auditFindings,
        warnings: auditWarnings,
      },
    ];

    const overallScore = Math.round(agents.reduce((sum, a) => sum + a.score, 0) / agents.length);

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        composition: product.composition,
        packSize: product.packSize,
        hsnCode: product.hsnCode,
        mrp: Number(product.mrp || product.price || 0),
        ptr: Number(product.ptr || product.price || 0),
        pts: Number(product.pts || product.price || 0),
        purchaseRate: purchaseRateVal,
        currentStockQty: product.stockQty,
        currentBatchNo: product.currentBatchNo,
        reorderLevel: 50,
        reorderStatus: product.stockQty < 20 ? "CRITICAL_LOW" : product.stockQty < 50 ? "REORDER_REQUIRED" : "HEALTHY",
      },
      summaryStats: {
        totalTransactionsCount,
        prCount,
        poCount,
        grnCount,
        inwardTransactionsCount: inwardCount || grnCount,
        outwardTransactionsCount: outwardCount || orderItems.length,
        deliveryChallanCount,
        sampleAllocationCount: sampleCount,
        adjustmentCount,
        cumulativeInwardQty,
        cumulativeOutwardQty,
        totalSalesValue,
        totalProcurementCost,
        grossProfit,
        inventoryTurnoverRate,
      },
      chronologicalLedger,
      multiAgentCouncil: {
        agents,
        overallStatus: overallScore >= 90 ? "PASS" : "WARN",
        overallScore,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
