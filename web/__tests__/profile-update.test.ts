import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  testDb,
  resetFixture,
  tokenFor,
  jsonRequest,
  readJson,
  TestFixture,
} from "./helpers/api";
import { PUT as updateUser } from "../app/api/users/[id]/route";

describe("User Profile Update API", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await resetFixture();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("successfully updates profile when password is empty string (profile edit without password change)", async () => {
    const req = jsonRequest(`/api/users/${fx.mrUserId}`, {
      method: "PUT",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: {
        firstName: "Abdul",
        lastName: "Mannan",
        phone: "+919985589599",
        password: "", // empty string left by user
      },
    });

    const res = await updateUser(req, { params: { id: fx.mrUserId } });
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.user.employee.firstName).toBe("Abdul");
    expect(body.data.user.employee.lastName).toBe("Mannan");
    expect(body.data.user.employee.phone).toBe("+919985589599");
  });

  it("rejects password update when password has less than 6 characters", async () => {
    const req = jsonRequest(`/api/users/${fx.mrUserId}`, {
      method: "PUT",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: {
        firstName: "Abdul",
        lastName: "Mannan",
        password: "123", // too short
      },
    });

    const res = await updateUser(req, { params: { id: fx.mrUserId } });
    expect(res.status).toBe(400);

    const body = await readJson(res);
    expect(body.success).toBe(false);
  });

  it("successfully updates password when a valid password >= 6 characters is provided", async () => {
    const newPass = "NewSecurePassword123";
    const req = jsonRequest(`/api/users/${fx.mrUserId}`, {
      method: "PUT",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: {
        firstName: "Abdul",
        lastName: "Mannan",
        password: newPass,
      },
    });

    const res = await updateUser(req, { params: { id: fx.mrUserId } });
    expect(res.status).toBe(200);

    const updatedUser = await testDb.user.findUnique({ where: { id: fx.mrUserId } });
    expect(updatedUser).toBeDefined();
    const isMatch = await bcrypt.compare(newPass, updatedUser!.passwordHash);
    expect(isMatch).toBe(true);
  });

  it("prevents non-admin user from elevating their own role during profile update", async () => {
    const req = jsonRequest(`/api/users/${fx.mrUserId}`, {
      method: "PUT",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: {
        firstName: "Abdul",
        role: Role.ADMIN, // attempted privilege escalation
      },
    });

    const res = await updateUser(req, { params: { id: fx.mrUserId } });
    expect(res.status).toBe(200);

    const userInDb = await testDb.user.findUnique({ where: { id: fx.mrUserId } });
    expect(userInDb!.role).toBe(Role.MR); // Role was protected and remains MR
  });

  it("forbids non-admin user from updating another user's profile with 403", async () => {
    const req = jsonRequest(`/api/users/${fx.asmUserId}`, {
      method: "PUT",
      token: tokenFor(fx.mrUserId, Role.MR),
      body: {
        firstName: "Hacked",
      },
    });

    const res = await updateUser(req, { params: { id: fx.asmUserId } });
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("permission");
  });

  it("allows ADMIN to update another user's profile", async () => {
    const req = jsonRequest(`/api/users/${fx.mrUserId}`, {
      method: "PUT",
      token: tokenFor(fx.adminUserId, Role.ADMIN),
      body: {
        firstName: "Abdul Updated By Admin",
      },
    });

    const res = await updateUser(req, { params: { id: fx.mrUserId } });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.user.employee.firstName).toBe("Abdul Updated By Admin");
  });
});

