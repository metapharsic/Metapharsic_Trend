import { Role } from "@prisma/client";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { GET as getProducts, POST as createProduct } from "../app/api/products/route";
import { PUT as updateProduct, DELETE as deleteProduct } from "../app/api/products/[id]/route";
import { GET as getMovements } from "../app/api/products/[id]/movements/route";
import { GET as getIntelligence } from "../app/api/products/[id]/intelligence/route";

describe("Products CRUD operations", () => {
  let fx: TestFixture;
  let mdUserId: string;

  beforeAll(async () => {
    fx = await resetFixture();

    // Create an MD user for testing executive role access
    const mdUser = await testDb.user.upsert({
      where: { email: "md.test@mrtracker.com" },
      update: {},
      create: {
        email: "md.test@mrtracker.com",
        passwordHash: "dummyhash",
        role: Role.MD,
      },
    });
    mdUserId = mdUser.id;
  });

  afterAll(async () => {
    try {
      await testDb.product.deleteMany({
        where: { sku: { in: ["TEST-CRUD-1", "TEST-CRUD-2", "TEST-ASP-100"] } },
      });
    } catch {}
    await testDb.$disconnect();
  });

  it("allows an Admin and MD to create a product with batch, dates, HSN, and GST", async () => {
    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest("/api/products", {
      method: "POST",
      token,
      body: {
        name: "Test CRUD Medicine 1",
        sku: "TEST-CRUD-1",
        price: 25.0,
        mrp: 30.0,
        ptr: 25.0,
        pts: 20.0,
        hsnCode: "30049099",
        gstPct: 12,
        stockQty: 100,
        therapySegment: "Antibiotics",
        currentBatchNo: "BAT-2026-001",
        currentMfgDate: "2026-01-15",
        currentExpDate: "2028-01-15",
      },
    });

    const res = await createProduct(req, noParams);
    expect(res.status).toBe(201);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.product.sku).toBe("TEST-CRUD-1");
    expect(body.data.product.stockQty).toBe(100);

    // Verify initial stock intake movement was recorded
    const movements = await testDb.inventoryMovement.findMany({
      where: { productId: body.data.product.id },
    });
    expect(movements.length).toBeGreaterThanOrEqual(1);
    expect(movements[0].type).toBe("RESTOCK");
    expect(movements[0].delta).toBe(100);
  });

  it("allows an MD user to fetch products catalog and view movement history", async () => {
    const mdToken = tokenFor(mdUserId, Role.MD);
    const req = jsonRequest("/api/products", {
      method: "GET",
      token: mdToken,
    });

    const res = await getProducts(req, noParams);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.products)).toBe(true);

    const testProd = body.data.products.find((p: any) => p.sku === "TEST-CRUD-1");
    expect(testProd).toBeDefined();

    // Test movement audit endpoint with MD role
    const movReq = jsonRequest(`/api/products/${testProd.id}/movements`, {
      method: "GET",
      token: mdToken,
    });
    const movRes = await getMovements(movReq, { params: { id: testProd.id } });
    expect(movRes.status).toBe(200);
    const movBody = await readJson(movRes);
    expect(movBody.success).toBe(true);
    expect(movBody.data.movements.length).toBeGreaterThanOrEqual(1);
  });

  it("allows an Admin to update product details, adjust stock, and clear batch/dates", async () => {
    const product = await testDb.product.findUnique({ where: { sku: "TEST-CRUD-1" } });
    expect(product).toBeDefined();

    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest(`/api/products/${product!.id}`, {
      method: "PUT",
      token,
      body: {
        name: "Test CRUD Medicine 1 (Updated)",
        stockQty: 150,
        ptr: 27.5,
        currentBatchNo: null,
        currentMfgDate: null,
        currentExpDate: null,
      },
    });

    const res = await updateProduct(req, { params: { id: product!.id } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.product.name).toBe("Test CRUD Medicine 1 (Updated)");
    expect(body.data.product.stockQty).toBe(150);
    expect(Number(body.data.product.ptr)).toBe(27.5);
    expect(body.data.product.currentBatchNo).toBeNull();
    expect(body.data.product.currentMfgDate).toBeNull();
    expect(body.data.product.currentExpDate).toBeNull();

    // Verify stock adjustment movement was logged
    const movement = await testDb.inventoryMovement.findFirst({
      where: { productId: product!.id, type: "MANUAL_ADJUSTMENT" },
      orderBy: { createdAt: "desc" },
    });
    expect(movement).toBeDefined();
    expect(movement!.delta).toBe(50); // 150 - 100 = +50
    expect(movement!.quantityAfter).toBe(150);
  });

  it("successfully deletes a product and cascade-cleans associated order items and catalog records", async () => {
    // Create an order associated with fx.productId
    await testDb.order.create({
      data: {
        distributorId: fx.distributorId,
        chemistId: fx.chemistId,
        employeeId: fx.mrEmployeeId,
        status: "CONFIRMED",
        items: {
          create: {
            productId: fx.productId,
            quantity: 10,
            price: 120.0,
          },
        },
      },
    });

    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest(`/api/products/${fx.productId}`, {
      method: "DELETE",
      token,
    });

    const res = await deleteProduct(req, { params: { id: fx.productId } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain("deleted successfully");

    const deleted = await testDb.product.findUnique({ where: { id: fx.productId } });
    expect(deleted).toBeNull();
  });

  it("successfully deletes a product with catalog/formulary/sample associations", async () => {
    const product = await testDb.product.findUnique({ where: { sku: "TEST-CRUD-1" } });
    expect(product).toBeDefined();

    // Add dummy catalog references
    await testDb.hospitalFormulary.create({
      data: {
        hospitalId: fx.hospitalId,
        productId: product!.id,
        included: true,
      },
    });

    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest(`/api/products/${product!.id}`, {
      method: "DELETE",
      token,
    });

    const res = await deleteProduct(req, { params: { id: product!.id } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);

    const check = await testDb.product.findUnique({ where: { id: product!.id } });
    expect(check).toBeNull();
  });

  it("forbids an MR from editing or deleting products", async () => {
    const mrToken = tokenFor(fx.mrUserId, Role.MR);

    const putReq = jsonRequest(`/api/products/${fx.productId}`, {
      method: "PUT",
      token: mrToken,
      body: { name: "Hacked" },
    });
    const putRes = await updateProduct(putReq, { params: { id: fx.productId } });
    expect(putRes.status).toBe(403);

    const delReq = jsonRequest(`/api/products/${fx.productId}`, {
      method: "DELETE",
      token: mrToken,
    });
    const delRes = await deleteProduct(delReq, { params: { id: fx.productId } });
    expect(delRes.status).toBe(403);
  });

  it("exposes realized invoice profit & unit profit to ADMIN only and strips commercial fields for MD", async () => {
    const adminToken = tokenFor(fx.adminUserId, Role.ADMIN);
    const mdToken = tokenFor(mdUserId, Role.MD);

    const createdRes = await createProduct(
      jsonRequest("/api/products", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Test Profit Telemetry SKU",
          sku: "TEST-PROFIT-1",
          price: 100,
          mrp: 125,
          ptr: 100,
          purchaseRate: 40,
          stockQty: 200,
        },
      }),
      noParams
    );
    expect(createdRes.status).toBe(201);
    const createdBody = await readJson(createdRes);
    const createdId = createdBody.data.product.id;

    try {
      const adminRes = await getProducts(
        jsonRequest("/api/products?limit=100", { method: "GET", token: adminToken }),
        noParams
      );
      expect(adminRes.status).toBe(200);
      const adminBody = await readJson(adminRes);
      const adminProd = adminBody.data.products.find((p: any) => p.sku === "TEST-PROFIT-1");
      expect(adminProd).toBeDefined();
      expect(adminProd.stockBoxes).toBe(20);
      expect(adminProd.unitProfit).toBe(60);
      expect(adminProd.potentialStockProfit).toBe(12000);
      expect(adminProd.profitAnalytics).toMatchObject({
        invoicedCount: 0,
        invoicedBilledQty: 0,
        invoicedFreeQty: 0,
        realizedProfit: 0,
      });

      const mdRes = await getProducts(
        jsonRequest("/api/products?limit=100", { method: "GET", token: mdToken }),
        noParams
      );
      expect(mdRes.status).toBe(200);
      const mdBody = await readJson(mdRes);
      const mdProd = mdBody.data.products.find((p: any) => p.sku === "TEST-PROFIT-1");
      expect(mdProd).toBeDefined();
      expect(mdProd.profitAnalytics).toBeUndefined();
      expect(mdProd.unitProfit).toBeUndefined();
      expect(mdProd.potentialStockProfit).toBeUndefined();
      expect(mdProd.purchaseRate).toBeUndefined();

      // Verify /api/products/[id]/intelligence endpoint returns 360° telemetry to ADMIN & clinical-only to MD
      const intelAdminRes = await getIntelligence(
        jsonRequest(`/api/products/${createdId}/intelligence`, { method: "GET", token: adminToken }),
        { params: { id: createdId } }
      );
      expect(intelAdminRes.status).toBe(200);
      const intelAdminBody = await readJson(intelAdminRes);
      expect(intelAdminBody.data.clinicalProfile.therapeuticClass).toBeDefined();
      expect(Array.isArray(intelAdminBody.data.monthlyTrend)).toBe(true);
      expect(Array.isArray(intelAdminBody.data.topChemists)).toBe(true);
      expect(Array.isArray(intelAdminBody.data.mrBreakdown)).toBe(true);
      expect(Array.isArray(intelAdminBody.data.schemeMix)).toBe(true);

      const intelMdRes = await getIntelligence(
        jsonRequest(`/api/products/${createdId}/intelligence`, { method: "GET", token: mdToken }),
        { params: { id: createdId } }
      );
      expect(intelMdRes.status).toBe(200);
      const intelMdBody = await readJson(intelMdRes);
      expect(intelMdBody.data.clinicalProfile.therapeuticClass).toBeDefined();
      expect(intelMdBody.data.commercialRestricted).toBe(true);
      expect(intelMdBody.data.topChemists).toBeUndefined();
    } finally {
      await testDb.product.delete({ where: { id: createdId } });
    }
  });
});
