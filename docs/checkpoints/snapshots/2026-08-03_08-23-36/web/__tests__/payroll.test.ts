import { calculatePayroll, incentivePercentFor } from "../lib/payroll";

/** Phase 4 Week 15 QA gate — incentive slabs and statutory deductions. */
describe("Payroll incentive engine", () => {
  it("reproduces the verified 105%-achievement case", () => {
    const result = calculatePayroll({
      basicSalary: 40_000,
      targetValue: 200_000,
      achievedValue: 210_000,
    });

    expect(result.achievementPercent).toBe(105);
    expect(result.incentivePercent).toBe(15);
    expect(result.incentives).toBe(6_000);
    expect(result.gross).toBe(46_000);
    expect(result.pf).toBe(4_800); // 12% of basic
    expect(result.esic).toBe(300); // 0.75% of basic
    expect(result.tax).toBe(4_600); // 10% of gross
    expect(result.netPayable).toBe(36_300);
  });

  it("pays no incentive below the entry slab", () => {
    const result = calculatePayroll({
      basicSalary: 40_000,
      targetValue: 200_000,
      achievedValue: 100_000, // 50%
    });

    expect(result.achievementPercent).toBe(50);
    expect(result.incentives).toBe(0);
    expect(result.netPayable).toBe(30_900);
  });

  it("treats a zero target as zero achievement rather than dividing by zero", () => {
    const result = calculatePayroll({
      basicSalary: 40_000,
      targetValue: 0,
      achievedValue: 50_000,
    });

    expect(Number.isFinite(result.achievementPercent)).toBe(true);
    expect(result.achievementPercent).toBe(0);
    expect(result.incentives).toBe(0);
  });

  describe("slab boundaries", () => {
    it.each([
      [130, 25],
      [120, 25],
      [119.99, 15],
      [100, 15],
      [99.99, 8],
      [85, 8],
      [84.99, 4],
      [70, 4],
      [69.99, 0],
      [0, 0],
    ])("achievement %p%% pays %p%% of basic", (achievement, expected) => {
      expect(incentivePercentFor(achievement as number)).toBe(expected);
    });
  });

  it("deductions never exceed gross for a normal salary", () => {
    const result = calculatePayroll({
      basicSalary: 25_000,
      targetValue: 100_000,
      achievedValue: 125_000,
    });
    expect(result.netPayable).toBeGreaterThan(0);
    expect(result.netPayable).toBeLessThan(result.gross);
  });
});
