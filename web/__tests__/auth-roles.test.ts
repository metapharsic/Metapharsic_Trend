import { LoginSchema } from "../lib/validators";

describe("Role-Specific Authentication Validation Schema Tests", () => {
  const validRoles = [
    "MD", "NSM", "ZSM", "RM", "ASM", "MR",
    "DISTRIBUTOR", "DOCTOR", "ADMIN", "HR",
    "FINANCE", "WAREHOUSE", "MARKETING"
  ];

  it("should validate successfully for all 13 corporate and clinical roles", () => {
    validRoles.forEach((role) => {
      const payload = {
        email: `${role.toLowerCase()}@mrtracker.com`,
        password: "securepassword123",
        role,
      };

      const result = LoginSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  it("should fail validation if the role is not recognized", () => {
    const payload = {
      email: "test@mrtracker.com",
      password: "securepassword123",
      role: "UNKNOWN_ROLE",
    };

    const result = LoginSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should fail validation for invalid email formatting", () => {
    const payload = {
      email: "invalid-email-format",
      password: "securepassword123",
      role: "MD",
    };

    const result = LoginSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should fail validation for too short passwords (< 6 characters)", () => {
    const payload = {
      email: "md@mrtracker.com",
      password: "short",
      role: "MD",
    };

    const result = LoginSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
