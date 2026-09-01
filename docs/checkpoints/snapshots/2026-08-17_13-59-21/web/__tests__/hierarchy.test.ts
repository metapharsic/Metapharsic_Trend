import { growthPercent, achievementPercent, rankOf, membersWithRole, TeamMember } from "../lib/hierarchy";

const member = (over: Partial<TeamMember> & { id: string }): TeamMember => ({
  firstName: "First",
  lastName: "Last",
  managerId: null,
  role: "MR",
  userId: `user-${over.id}`,
  isActive: true,
  ...over,
});

describe("Growth percentage", () => {
  it("computes positive growth", () => {
    expect(growthPercent(150, 100)).toBe(50);
  });

  it("computes decline as negative", () => {
    expect(growthPercent(80, 100)).toBe(-20);
  });

  it("returns null from a zero base rather than infinity", () => {
    // Rendering "∞%" or "100%" for a first month of sales would both mislead.
    expect(growthPercent(500, 0)).toBeNull();
  });

  it("is zero when flat", () => {
    expect(growthPercent(100, 100)).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(growthPercent(1000, 3)).toBe(33233.3);
  });
});

describe("Achievement percentage", () => {
  it("computes achievement against target", () => {
    expect(achievementPercent(210_000, 200_000)).toBe(105);
  });

  it("guards a zero or negative target", () => {
    expect(achievementPercent(500, 0)).toBe(0);
    expect(achievementPercent(500, -100)).toBe(0);
  });

  it("reports zero achievement honestly", () => {
    expect(achievementPercent(0, 200_000)).toBe(0);
  });
});

describe("Ranking", () => {
  const scores = [
    { key: "north", value: 500 },
    { key: "south", value: 900 },
    { key: "east", value: 100 },
  ];

  it("ranks highest score first", () => {
    expect(rankOf(scores, "south")).toBe(1);
    expect(rankOf(scores, "north")).toBe(2);
    expect(rankOf(scores, "east")).toBe(3);
  });

  it("returns null for an absent key", () => {
    expect(rankOf(scores, "west")).toBeNull();
  });

  it("gives tied scores the same rank", () => {
    const tied = [
      { key: "a", value: 100 },
      { key: "b", value: 100 },
      { key: "c", value: 50 },
    ];
    expect(rankOf(tied, "a")).toBe(1);
    expect(rankOf(tied, "b")).toBe(1);
    expect(rankOf(tied, "c")).toBe(3);
  });

  it("handles a single-entry set", () => {
    expect(rankOf([{ key: "only", value: 0 }], "only")).toBe(1);
  });

  it("does not mutate the input order", () => {
    const input = [...scores];
    rankOf(input, "south");
    expect(input.map((s) => s.key)).toEqual(["north", "south", "east"]);
  });
});

describe("Role filtering", () => {
  const team: TeamMember[] = [
    member({ id: "1", role: "ASM" }),
    member({ id: "2", role: "MR" }),
    member({ id: "3", role: "MR" }),
  ];

  it("selects only the requested role", () => {
    expect(membersWithRole(team, "MR")).toHaveLength(2);
    expect(membersWithRole(team, "ASM")).toHaveLength(1);
    expect(membersWithRole(team, "NSM")).toHaveLength(0);
  });
});
