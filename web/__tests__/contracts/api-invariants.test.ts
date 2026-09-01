/**
 * Repo-wide API contract invariants.
 *
 * These are STATIC checks over every route in app/api -- they read source, not
 * a running server, so they are fast, deterministic, and cover all 110 routes
 * without anyone writing a test per route.
 *
 * They exist because this codebase's recurring failure is not a broken screen,
 * it is two screens quietly disagreeing: one endpoint scoping an MR by
 * territory while its sibling scopes by employeeId, or a paginated list whose
 * caller renders `array.length` as the header count. Both classes are invisible
 * in a UI test and obvious here.
 *
 * Regenerate the extract first:  node qa/tools/extract-asbuilt.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const EXTRACT = path.resolve(ROOT, "../qa/specs/as-built.json");

type Method = { handler: string | null; authenticated: boolean; roles: string[] | { constant: string } | null };
type Route = {
  url: string;
  file: string;
  methods: Record<string, Method>;
  paginated: boolean;
  exposesPaginationTotal: boolean;
  exposesFlatTotal: boolean;
  hardTake: number[];
  usesGroupBy: boolean;
  scope: {
    byEmployeeId: boolean;
    byOrderEmployeeId: boolean;
    byTerritory: boolean;
    resolvesEmployee: boolean;
    managerBypass: boolean;
    managerRoles: string[];
  };
  envelope: { usesHelpers: boolean; rawNextResponse: boolean };
};

const extract = JSON.parse(fs.readFileSync(EXTRACT, "utf8")) as {
  routes: Route[];
  screens: any[];
};
const routes = extract.routes;

/**
 * Pre-existing violations, recorded once so the suite is green on arrival.
 *
 * A contract suite that fails on the day it lands gets muted, not fixed. So
 * every check asserts that today's offenders are a SUBSET of this baseline:
 * existing debt passes, any NEW drift fails immediately. Entries are deleted
 * as they are fixed, and the suite reports the ones that have become stale --
 * so the list can only shrink.
 */
const BASELINE = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, "../qa/specs/baseline.json"), "utf8")
) as Record<string, string[]>;

/**
 * Fails only on offenders the baseline does not already know about.
 *
 * Throws with the offending list rather than using expect's message argument,
 * which Jest does not support (that is a Vitest/Playwright signature).
 */
function expectNoNewOffenders(actual: string[], key: string) {
  const accepted = new Set(BASELINE[key] ?? []);
  const added = actual.filter((a) => !accepted.has(a));

  if (added.length) {
    throw new Error(
      `${added.length} NEW "${key}" contract violation(s):\n  ` +
        added.join("\n  ") +
        `\n\nFix them, or -- if genuinely accepted -- add them to ` +
        `qa/specs/baseline.json with a reason.`
    );
  }
  expect(added).toEqual([]);
}

/** Reports baseline entries that no longer reproduce, so the list stays honest. */
function reportFixed(actual: string[], key: string) {
  const current = new Set(actual);
  const fixed = (BASELINE[key] ?? []).filter((b) => !current.has(b));
  if (fixed.length) {
    console.log(
      `\n  ${key}: ${fixed.length} baseline entr(ies) now fixed -- remove from ` +
      `qa/specs/baseline.json:\n    ${fixed.join("\n    ")}\n`
    );
  }
}

/** Routes that legitimately return a non-list, non-envelope payload. */
const ENVELOPE_EXEMPT = new Set(["/api/logs/frontend"]);

/** A hard `take:` above this with no pagination is a silent cap, not a guard rail. */
const SILENT_CAP_THRESHOLD = 50;

describe("API contract: response envelope", () => {
  it("every route builds responses through lib/api-response helpers", () => {
    const offenders = routes
      .filter((r) => !ENVELOPE_EXEMPT.has(r.url))
      .filter((r) => r.envelope.rawNextResponse && !r.envelope.usesHelpers)
      .map((r) => r.url);

    expectNoNewOffenders(offenders, "envelopeBypass");
    reportFixed(offenders, "envelopeBypass");
  });
});

describe("API contract: authentication", () => {
  it("every exported handler is wrapped in withAuth", () => {
    const offenders: string[] = [];
    for (const r of routes) {
      for (const [verb, m] of Object.entries(r.methods)) {
        if (!m.authenticated) offenders.push(`${verb} ${r.url}`);
      }
    }
    expectNoNewOffenders(offenders, "unauthenticated");
    reportFixed(offenders, "unauthenticated");
  });

  it("no new route gates on an unresolvable role constant", () => {
    // ALL_ROLES-style constants hide the blast radius from static analysis, so
    // each one is an explicit, recorded decision rather than an accident.
    const indirect = routes
      .flatMap((r) =>
        Object.entries(r.methods)
          .filter(([, m]) => m.roles && !Array.isArray(m.roles))
          .map(([verb, m]) => `${verb} ${r.url} -> ${(m.roles as { constant: string }).constant}`)
      )
      .sort();

    expectNoNewOffenders(indirect, "indirectRoleGates");
    reportFixed(indirect, "indirectRoleGates");
  });
});

describe("API contract: pagination", () => {
  it("every paginated list returns pagination.total", () => {
    const offenders = routes
      .filter((r) => r.paginated && !r.exposesPaginationTotal)
      .map((r) => r.url);

    expectNoNewOffenders(offenders, "paginatedWithoutTotal");
    reportFixed(offenders, "paginatedWithoutTotal");
  });

  it("no list endpoint silently caps its result set", () => {
    // A `take: 500` with no skip/page means row 501 is invisible and the client
    // has no way to detect it. Either paginate properly or return a total.
    const offenders = routes
      .filter((r) => !r.paginated)
      .filter((r) => r.hardTake.some((n) => n >= SILENT_CAP_THRESHOLD))
      .filter((r) => !r.exposesPaginationTotal && !r.exposesFlatTotal)
      .map((r) => r.url);

    expectNoNewOffenders(offenders, "silentlyCapped");
    reportFixed(offenders, "silentlyCapped");
  });
});

describe("API contract: cross-module scope consistency", () => {
  /**
   * The rule from CLAUDE.md: every MR-facing "my X" endpoint scopes by the
   * MR's employeeId -- directly, or through the owning order. Territory
   * scoping for a personal list is the drift that produced the
   * orders-vs-invoices mismatch.
   */
  const MR_PERSONAL_SCOPE = [
    "/api/orders/secondary",
    "/api/orders/history",
    "/api/invoices",
    "/api/mr/collections",
    "/api/mr/ledgers",
    "/api/mr/claims",
    "/api/mr/visits",
    "/api/mr/leads",
    "/api/expenses/claims",
  ];

  it.each(MR_PERSONAL_SCOPE)("%s scopes an MR by employeeId", (url) => {
    const route = routes.find((r) => r.url === url);
    expect(route).toBeDefined();

    const scopedByEmployee = route!.scope.byEmployeeId || route!.scope.byOrderEmployeeId;
    expect({ url, scopedByEmployee, resolvesEmployee: route!.scope.resolvesEmployee }).toEqual({
      url,
      scopedByEmployee: true,
      resolvesEmployee: true,
    });
  });

  it("MR-personal endpoints do not fall back to territory scoping", () => {
    const offenders = MR_PERSONAL_SCOPE.map((url) => routes.find((r) => r.url === url)!)
      .filter(Boolean)
      .filter((r) => r.scope.byTerritory && !r.scope.byEmployeeId && !r.scope.byOrderEmployeeId)
      .map((r) => `${r.url} scopes by territory, not employeeId  (${r.file})`);

    expect(offenders).toEqual([]);
  });

  it("sibling endpoints agree on which roles bypass personal scope", () => {
    // orders, invoices and history back the same three tabs of /orders. If one
    // treats MD as a manager and another does not, the same user sees one tab
    // scoped to the whole company and the next scoped to themselves -- or a
    // 401, when the role has no Employee row to fall back to.
    //
    // THIS TEST IS RED ON PURPOSE. It names a live defect:
    //   /api/invoices  -> ASM, ADMIN
    //   /api/orders/*  -> ASM, ADMIN, MD
    // Hoist the manager-role list into one shared helper and it goes green.
    const siblings = ["/api/orders/secondary", "/api/orders/history", "/api/invoices"];
    const byRoute = siblings.map((url) => {
      const r = routes.find((x) => x.url === url)!;
      return { url, managerRoles: r.scope.managerRoles.join(",") };
    });

    const distinct = [...new Set(byRoute.map((b) => b.managerRoles))];
    if (distinct.length > 1) {
      throw new Error(
        `Sibling endpoints disagree on who bypasses personal scope:\n  ` +
          byRoute.map((b) => `${b.url.padEnd(26)} -> [${b.managerRoles}]`).join("\n  ") +
          `\n\nAll three back the same screen, so a role in one list and not ` +
          `another sees inconsistent totals across tabs.`
      );
    }
    expect(distinct).toHaveLength(1);
  });
});

describe("API contract: server-side aggregation", () => {
  /** Tallies shown as KPI tiles must be computed over the full where clause. */
  const TALLY_ENDPOINTS = ["/api/orders/secondary"];

  it.each(TALLY_ENDPOINTS)("%s computes tallies with groupBy, not on a page", (url) => {
    const route = routes.find((r) => r.url === url)!;
    expect({ url, usesGroupBy: route.usesGroupBy }).toEqual({ url, usesGroupBy: true });
  });
});

describe("UI contract: counts are not derived from array length", () => {
  it("no screen renders a heading count from a paginated array's length", () => {
    const paginatedUrls = new Set(
      routes.filter((r) => r.paginated || r.hardTake.length > 0).map((r) => r.url)
    );

    const offenders: string[] = [];
    for (const screen of extract.screens) {
      const touchesPaginated = screen.apis.some((a: string) =>
        paginatedUrls.has(a.replace(/\/$/, ""))
      );
      if (!touchesPaginated) continue;
      for (const h of screen.countHeadings ?? []) {
        offenders.push(`${screen.url}: ${h.heading}`);
      }
    }

    expectNoNewOffenders(offenders, "countFromArrayLength");
    reportFixed(offenders, "countFromArrayLength");
  });
});
