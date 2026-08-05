import { PrismaClient } from "@prisma/client";

/**
 * Org-hierarchy resolution.
 *
 * Reporting lines live in `Employee.managerId` (self-relation), so a manager's
 * scope is every employee transitively beneath them. Resolved breadth-first with
 * one query per level rather than a recursive CTE, so it stays portable and the
 * cycle guard is explicit — a mis-entered `managerId` loop would otherwise hang
 * the request.
 */

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  managerId: string | null;
  role: string;
  userId: string;
  isActive: boolean;
}

/** Safety valve: org depth beyond this indicates a cycle or bad data, not a real chart. */
const MAX_DEPTH = 12;

export async function resolveTeam(
  db: PrismaClient,
  rootEmployeeId: string
): Promise<TeamMember[]> {
  const collected = new Map<string, TeamMember>();
  const seen = new Set<string>([rootEmployeeId]);
  let frontier = [rootEmployeeId];
  let depth = 0;

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    const children = await db.employee.findMany({
      where: { managerId: { in: frontier } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        managerId: true,
        user: { select: { role: true, isActive: true, id: true } },
      },
    });

    const next: string[] = [];
    for (const child of children) {
      if (seen.has(child.id)) continue; // cycle guard
      seen.add(child.id);
      collected.set(child.id, {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        managerId: child.managerId,
        role: child.user.role,
        userId: child.user.id,
        isActive: child.user.isActive,
      });
      next.push(child.id);
    }

    frontier = next;
    depth++;
  }

  return [...collected.values()];
}

export function membersWithRole(team: TeamMember[], role: string): TeamMember[] {
  return team.filter((m) => m.role === role);
}

/** Percentage change between two periods. Returns null when the base is zero — a
 *  jump from nothing is not a meaningful growth rate and rendering "∞%" is worse
 *  than rendering "n/a". */
export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Achievement against target, guarding a zero target. */
export function achievementPercent(achieved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((achieved / target) * 1000) / 10;
}

/**
 * Dense ranking (1-based) of a key within a scored set, highest score first.
 * Ties share a rank. Returns null when the key is absent.
 */
export function rankOf(scores: { key: string; value: number }[], key: string): number | null {
  const sorted = [...scores].sort((a, b) => b.value - a.value);
  const index = sorted.findIndex((s) => s.key === key);
  if (index === -1) return null;

  let rank = 1;
  for (let i = 0; i < index; i++) {
    if (sorted[i].value > sorted[index].value) rank++;
  }
  return rank;
}
