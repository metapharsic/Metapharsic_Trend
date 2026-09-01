import { canTransitionOrder, creditUtilizationPercent } from "../lib/order-workflow";

describe("Order status transitions", () => {
  it("allows the standard forward path", () => {
    expect(canTransitionOrder("PENDING", "CONFIRMED").allowed).toBe(true);
    expect(canTransitionOrder("CONFIRMED", "SHIPPED").allowed).toBe(true);
    expect(canTransitionOrder("SHIPPED", "DELIVERED").allowed).toBe(true);
  });

  it("rejects skipping a stage", () => {
    const result = canTransitionOrder("PENDING", "SHIPPED");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/directly/i);
  });

  it("rejects skipping straight to delivered", () => {
    expect(canTransitionOrder("PENDING", "DELIVERED").allowed).toBe(false);
    expect(canTransitionOrder("CONFIRMED", "DELIVERED").allowed).toBe(false);
  });

  it("rejects moving backward", () => {
    expect(canTransitionOrder("SHIPPED", "CONFIRMED").allowed).toBe(false);
    expect(canTransitionOrder("DELIVERED", "SHIPPED").allowed).toBe(false);
  });

  it("rejects a no-op transition to the same status", () => {
    const result = canTransitionOrder("CONFIRMED", "CONFIRMED");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already/i);
  });

  it("allows cancellation from PENDING or CONFIRMED", () => {
    expect(canTransitionOrder("PENDING", "CANCELLED").allowed).toBe(true);
    expect(canTransitionOrder("CONFIRMED", "CANCELLED").allowed).toBe(true);
  });

  it("refuses cancellation once shipped — that is a returns problem, not a status flip", () => {
    const result = canTransitionOrder("SHIPPED", "CANCELLED");
    expect(result.allowed).toBe(false);
  });

  it("treats DELIVERED and CANCELLED as final states", () => {
    for (const to of ["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"] as const) {
      expect(canTransitionOrder("DELIVERED", to).allowed).toBe(false);
    }
    for (const to of ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"] as const) {
      expect(canTransitionOrder("CANCELLED", to).allowed).toBe(false);
    }
  });

  it("gives a reason string for every rejected transition", () => {
    const result = canTransitionOrder("DELIVERED", "PENDING");
    expect(result.reason).toBeTruthy();
  });
});

describe("Credit utilization", () => {
  it("computes exposure as a percentage of the limit", () => {
    expect(creditUtilizationPercent(50_000, 100_000)).toBe(50);
    expect(creditUtilizationPercent(105_000, 100_000)).toBe(105); // over limit is a valid, alarming state
  });

  it("returns null when no credit limit is configured", () => {
    expect(creditUtilizationPercent(50_000, null)).toBeNull();
  });

  it("returns null for a zero or negative limit rather than dividing by it", () => {
    expect(creditUtilizationPercent(50_000, 0)).toBeNull();
    expect(creditUtilizationPercent(50_000, -1)).toBeNull();
  });

  it("is zero when nothing is outstanding", () => {
    expect(creditUtilizationPercent(0, 100_000)).toBe(0);
  });
});
