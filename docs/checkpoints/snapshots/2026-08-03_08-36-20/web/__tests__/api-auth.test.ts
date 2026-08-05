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
import { GET as getReports } from "../app/api/reports/route";
import { POST as generatePayroll } from "../app/api/hrms/payroll/route";

/**
 * Route-level authorization tests. These exercise the real withAuth middleware
 * against real handlers — the layer that unit tests of pure functions cannot reach,
 * and where a regression silently exposes data.
 */
describe("API route authorization", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await getProducts(jsonRequest("/api/products"), noParams);
    expect(res.status).toBe(401);
    const body = await readJson(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed bearer token", async () => {
    const req = jsonRequest("/api/products", { token: "not-a-real-jwt" });
    const res = await getProducts(req, noParams);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const jwt = require("jsonwebtoken");
    const forged = jwt.sign({ sub: fx.adminUserId, role: Role.ADMIN }, "wrong-secret");
    const res = await getProducts(jsonRequest("/api/products", { token: forged }), noParams);
    expect(res.status).toBe(401);
  });

  it("allows an MR to read the product catalogue", async () => {
    const req = jsonRequest("/api/products", { token: tokenFor(fx.mrUserId, Role.MR) });
    const res = await getProducts(req, noParams);
    expect(res.status).toBe(200);
  });

  it("forbids an MR from creating products", async () => {
    const req = jsonRequest("/api/products", {
      method: "POST",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: { name: "Sneaky", sku: "SNK-1", price: 10 },
    });
    const res = await createProduct(req, noParams);
    expect(res.status).toBe(403);
    expect((await readJson(res)).error.code).toBe("FORBIDDEN");
  });

  it("allows an ASM to create products", async () => {
    const req = jsonRequest("/api/products", {
      method: "POST",
      token: tokenFor(fx.asmUserId, Role.ASM),
      body: { name: "Legit Product", sku: "LGT-1", price: 50 },
    });
    const res = await createProduct(req, noParams);
    expect(res.status).toBe(201);
  });

  it("forbids an MR from reading BI reports", async () => {
    const req = jsonRequest("/api/reports", { token: tokenFor(fx.mrUserId, Role.MR) });
    const res = await getReports(req, noParams);
    expect(res.status).toBe(403);
  });

  it("forbids an ASM from generating payroll (ADMIN only)", async () => {
    const req = jsonRequest("/api/hrms/payroll", {
      method: "POST",
      token: tokenFor(fx.asmUserId, Role.ASM),
      body: { employeeId: fx.mrEmployeeId, month: "2026-08-01", basicSalary: 1000 },
    });
    const res = await generatePayroll(req, noParams);
    expect(res.status).toBe(403);
  });
});

describe("API input validation", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("rejects a product with a negative price", async () => {
    const req = jsonRequest("/api/products", {
      method: "POST",
      token: tokenFor(fx.adminUserId, Role.ADMIN),
      body: { name: "Bad", sku: "BAD-1", price: -5 },
    });
    const res = await createProduct(req, noParams);
    expect(res.status).toBe(400);
    expect((await readJson(res)).error.code).toBe("BAD_REQUEST");
  });

  it("rejects a duplicate SKU with 409 rather than 500", async () => {
    const body = { name: "Dupe A", sku: "DUP-1", price: 10 };
    const token = tokenFor(fx.adminUserId, Role.ADMIN);

    const first = await createProduct(
      jsonRequest("/api/products", { method: "POST", token, body }),
      noParams
    );
    expect(first.status).toBe(201);

    const second = await createProduct(
      jsonRequest("/api/products", {
        method: "POST",
        token,
        body: { ...body, name: "Dupe B" },
      }),
      noParams
    );
    expect(second.status).toBe(409);
  });

  it("returns 400 for an unknown report id", async () => {
    const req = jsonRequest("/api/reports?report=does-not-exist", {
      token: tokenFor(fx.adminUserId, Role.ADMIN),
    });
    const res = await getReports(req, noParams);
    expect(res.status).toBe(400);
  });
});
