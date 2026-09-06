import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  noParams,
  TestFixture,
} from "./helpers/api";
import { POST as changePassword } from "../app/api/admin/users/change-password/route";

describe("Admin User Password Management API", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = jsonRequest("/api/admin/users/change-password", {
      method: "POST",
      body: { userId: fx.mrUserId, newPassword: "NewSecretPassword@123" },
    });
    const res = await changePassword(req, noParams);
    expect(res.status).toBe(401);
  });

  it("forbids non-admin users (e.g. MR) from changing passwords with 403", async () => {
    const req = jsonRequest("/api/admin/users/change-password", {
      method: "POST",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: { userId: fx.asmUserId, newPassword: "NewSecretPassword@123" },
    });
    const res = await changePassword(req, noParams);
    expect(res.status).toBe(403);
  });

  it("rejects passwords shorter than 6 characters with 400", async () => {
    const req = jsonRequest("/api/admin/users/change-password", {
      method: "POST",
      token: tokenFor(fx.adminUserId, Role.ADMIN),
      body: { userId: fx.mrUserId, newPassword: "123" },
    });
    const res = await changePassword(req, noParams);
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.success).toBe(false);
  });

  it("allows ADMIN to change another user's password and invalidates refresh tokens", async () => {
    // 1. Create a dummy refresh token for the MR user
    await testDb.refreshToken.create({
      data: {
        userId: fx.mrUserId,
        token: "dummy-refresh-token-for-invalidation-test",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const newPass = "UpdatedSecretPass@2026";
    const req = jsonRequest("/api/admin/users/change-password", {
      method: "POST",
      token: tokenFor(fx.adminUserId, Role.ADMIN),
      body: { userId: fx.mrUserId, newPassword: newPass },
    });

    const res = await changePassword(req, noParams);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);

    // 2. Verify database hash matches the new password
    const updatedUser = await testDb.user.findUnique({
      where: { id: fx.mrUserId },
    });
    expect(updatedUser).toBeDefined();
    const isMatch = await bcrypt.compare(newPass, updatedUser!.passwordHash);
    expect(isMatch).toBe(true);

    // 3. Verify refresh tokens were invalidated
    const remainingTokens = await testDb.refreshToken.findMany({
      where: { userId: fx.mrUserId },
    });
    expect(remainingTokens.length).toBe(0);
  });
});
