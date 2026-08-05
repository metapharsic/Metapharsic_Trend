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
import { PUT as updateProduct, DELETE as deleteProduct } from "../app/api/products/[id]/route";

describe("Products CRUD operations", () => {
  let fx: TestFixture;
  let testProductId: string;

  beforeAll(async () => {
    fx = await resetFixture();
    
    // Create a temporary product for testing updates and deletion
    const product = await testDb.product.create({
      data: {
        name: "Test Aspirin 100mg",
        sku: "TEST-ASP-100",
        price: 15.00,
        mrp: 20.00,
        ptr: 15.00,
        pts: 12.00,
        stockQty: 50,
        therapySegment: "Cardiology",
      }
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    // Cleanup any remaining test product
    try {
      await testDb.product.delete({ where: { sku: "TEST-ASP-100" } });
    } catch {}
    await testDb.$disconnect();
  });

  it("allows an admin to update product details and stock levels", async () => {
    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest(`/api/products/${testProductId}`, {
      method: "PUT",
      token,
      body: {
        name: "Test Aspirin 100mg (Updated)",
        stockQty: 120,
        ptr: 16.50,
      }
    });

    const res = await updateProduct(req, { params: { id: testProductId } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.product.name).toBe("Test Aspirin 100mg (Updated)");
    expect(body.data.product.stockQty).toBe(120);
    expect(Number(body.data.product.ptr)).toBe(16.50);
  });

  it("allows an admin to delete a product that has no references", async () => {
    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest(`/api/products/${testProductId}`, {
      method: "DELETE",
      token,
    });

    const res = await deleteProduct(req, { params: { id: testProductId } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Product deleted");
  });

  it("returns a clean 404 error if trying to modify a non-existent product", async () => {
    const token = tokenFor(fx.adminUserId, Role.ADMIN);
    const req = jsonRequest("/api/products/non-existent-uuid", {
      method: "PUT",
      token,
      body: { name: "Ghost" },
    });

    const res = await updateProduct(req, { params: { id: "non-existent-uuid" } });
    expect(res.status).toBe(404);
  });
});
