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

  it("prevents deleting a product that has associated commercial order items", async () => {
    // Create an order associated with fx.productId
    const order = await testDb.order.create({
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
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("Cannot delete product because it has associated commercial orders");
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
    expect(body.data.message).toBe("Product deleted");

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
});
