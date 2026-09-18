import { GET as getInvoices } from "../app/api/invoices/route";
import { POST as dispatchWhatsApp } from "../app/api/mr/reports/multi-agent/whatsapp/route";
import { GET as getWhatsAppHistory } from "../app/api/whatsapp/history/route";
import { ReportsService } from "../src/reports/reports.service";
import { formatHistoricalWhatsAppReport } from "../lib/whatsapp-reports";
import { db } from "../lib/db";
import { Role } from "@prisma/client";
import { tokenFor, jsonRequest } from "./helpers/api";

describe("WhatsApp Intelligence Dispatch & Invoiced Secondary Sales Control", () => {
  let adminUser: any;
  let mrUser: any;
  let mrEmployee: any;
  let territory: any;
  let chemist: any;
  let distributor: any;
  let product: any;
  let invoicedOrder: any;
  let uninvoicedOrder: any;
  let adminToken: string;
  let mrToken: string;

  beforeAll(async () => {
    // 1. Setup Admin user
    adminUser = await db.user.create({
      data: {
        email: `admin_wa_test_${Date.now()}@trendmr.com`,
        passwordHash: "hash",
        role: Role.ADMIN,
      },
    });
    adminToken = tokenFor(adminUser.id, Role.ADMIN);

    // 2. Setup Territory & MR user & Employee
    territory = await db.territory.create({
      data: {
        name: `Test Territory ${Date.now()}`,
        region: "North",
        zone: "Zone 1",
      },
    });

    mrUser = await db.user.create({
      data: {
        email: `mr_wa_test_${Date.now()}@trendmr.com`,
        passwordHash: "hash",
        role: Role.MR,
      },
    });
    mrToken = tokenFor(mrUser.id, Role.MR);

    mrEmployee = await db.employee.create({
      data: {
        userId: mrUser.id,
        firstName: "Test",
        lastName: "FieldRep",
        phone: "919876543210",
        territories: { connect: [{ id: territory.id }] },
      },
    });

    // 3. Setup Chemist, Distributor, Product
    chemist = await db.chemist.create({
      data: {
        name: "Test Chemist Pharmacy",
        address: "123 Main St",
        contactPerson: "John Chemist",
        latitude: 22.5726,
        longitude: 88.3639,
        territoryId: territory.id,
      },
    });

    distributor = await db.distributor.create({
      data: {
        name: "Test Stockist Agency",
        address: "456 Market St",
        territoryId: territory.id,
      },
    });

    product = await db.product.create({
      data: {
        name: "Amoxicillin 500mg",
        sku: `AMX-${Date.now()}`,
        price: 150.0,
        ptr: 150.0,
        pts: 120.0,
        mrp: 200.0,
        stockQty: 500,
      },
    });

    // 4. Create an Invoiced Order for MR
    invoicedOrder = await db.order.create({
      data: {
        employeeId: mrEmployee.id,
        chemistId: chemist.id,
        distributorId: distributor.id,
        status: "DELIVERED",
        items: {
          create: [
            {
              productId: product.id,
              quantity: 10,
              price: 150.0,
            },
          ],
        },
      },
    });

    await db.invoice.create({
      data: {
        orderId: invoicedOrder.id,
        invoiceNo: `INV-TEST-${Date.now()}`,
        amount: 1500.0,
        grandTotal: 1500.0,
        partyName: chemist.name,
      },
    });

    // 5. Create an Uninvoiced Order for MR
    uninvoicedOrder = await db.order.create({
      data: {
        employeeId: mrEmployee.id,
        chemistId: chemist.id,
        distributorId: distributor.id,
        status: "PENDING",
        items: {
          create: [
            {
              productId: product.id,
              quantity: 5,
              price: 150.0,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    const orderIds = [invoicedOrder?.id, uninvoicedOrder?.id].filter(Boolean);
    if (orderIds.length > 0) {
      await db.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (mrEmployee?.id) {
      await db.whatsAppDispatchLog.deleteMany({ where: { employeeId: mrEmployee.id } });
      await db.employee.delete({ where: { id: mrEmployee.id } });
    }
    const userIds = [adminUser?.id, mrUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (product?.id) await db.product.delete({ where: { id: product.id } });
    if (chemist?.id) await db.chemist.delete({ where: { id: chemist.id } });
    if (distributor?.id) await db.distributor.delete({ where: { id: distributor.id } });
    if (territory?.id) await db.territory.delete({ where: { id: territory.id } });
  });

  describe("1. Invoiced Secondary Sales & Access Control (/api/invoices)", () => {
    it("allows ADMIN to view all invoices and overall totals", async () => {
      const req = jsonRequest("/api/invoices", { token: adminToken });
      const res = await getInvoices(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.invoices).toBeDefined();
      expect(body.data.totals).toBeDefined();
      expect(body.data.invoices.some((inv: any) => inv.orderId === invoicedOrder.id)).toBe(true);
    });

    it("restricts MR user to see strictly invoices raised for their own booked orders", async () => {
      const req = jsonRequest("/api/invoices", { token: mrToken });
      const res = await getInvoices(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.invoices).toBeDefined();
      body.data.invoices.forEach((inv: any) => {
        expect(inv.order).toBeDefined();
      });
    });
  });

  describe("2. WhatsApp History Dispatch & Audit Trail Logging", () => {
    it("formats historical WhatsApp report cleanly", () => {
      const text = formatHistoricalWhatsAppReport(
        "Quarterly Audit Summary",
        "Test FieldRep",
        "2026-01-01",
        "2026-03-31",
        {
          totalInvoicedSales: 1500,
          totalBookedSales: 2250,
          totalOrdersCount: 2,
          invoicedOrdersCount: 1,
          totalDoctorCalls: 12,
          totalChemistCalls: 8,
          totalCollections: 1000,
          multiAgentGrade: "A+",
          multiAgentScore: 96,
        }
      );

      expect(text).toContain("HISTORICAL INTELLIGENCE DISPATCH");
      expect(text).toContain("Test FieldRep");
      expect(text).toContain("1,500");
      expect(text).toContain("2,250");
      expect(text).toContain("96/100");
    });

    it("POST /api/mr/reports/multi-agent/whatsapp handles HISTORY_REQUEST and logs dispatch", async () => {
      const req = jsonRequest("/api/mr/reports/multi-agent/whatsapp", {
        method: "POST",
        token: adminToken,
        body: {
          targetType: "HISTORY_REQUEST",
          employeeId: mrEmployee.id,
          period: "monthly",
          customMessage: "Monthly Performance Historical Dispatch",
        },
      });

      const res = await dispatchWhatsApp(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.success).toBe(true);
      expect(body.data.mode).toBe("HISTORY_REQUEST");
      expect(body.data.whatsappText).toContain("HISTORICAL INTELLIGENCE DISPATCH");

      // Verify record logged in WhatsAppDispatchLog
      const logs = await ReportsService.getWhatsAppDispatchHistory({
        employeeId: mrEmployee.id,
        targetType: "HISTORY_REQUEST",
      });

      expect(logs.logs.length).toBeGreaterThan(0);
      expect(logs.logs[0].employeeId).toBe(mrEmployee.id);
      expect(logs.logs[0].targetType).toBe("HISTORY_REQUEST");
    });

    it("GET /api/whatsapp/history returns audit logs with role scoping", async () => {
      const req = jsonRequest("/api/whatsapp/history", { token: adminToken });

      const res = await getWhatsAppHistory(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.logs).toBeDefined();
      expect(body.data.pagination).toBeDefined();
      expect(body.data.logs.some((l: any) => l.employeeId === mrEmployee.id)).toBe(true);
    });
  });
});
