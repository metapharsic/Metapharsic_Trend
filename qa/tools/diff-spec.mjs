#!/usr/bin/env node
/**
 * Compares the hand-authored INTENDED specs (qa/specs/screens/*.yaml) against
 * the generated AS-BUILT extract (qa/specs/as-built.json) and emits findings.
 *
 *   node qa/tools/diff-spec.mjs              # human-readable report
 *   node qa/tools/diff-spec.mjs --json       # machine-readable, for the QA agent
 *   node qa/tools/diff-spec.mjs --fail-on=high
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./mini-yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const asBuilt = JSON.parse(fs.readFileSync(path.join(ROOT, "qa/specs/as-built.json"), "utf8"));
const specDir = path.join(ROOT, "qa/specs/screens");

const findings = [];
const add = (f) => findings.push(f);

const routeFor = (url) => asBuilt.routes.find((r) => r.url === url);
const screenFor = (url) => asBuilt.screens.find((s) => s.url === url);

for (const file of fs.readdirSync(specDir).filter((f) => /\.ya?ml$/.test(f))) {
  const spec = parseYaml(fs.readFileSync(path.join(specDir, file), "utf8"));
  const where = `qa/specs/screens/${file}`;
  const screen = screenFor(spec.url);

  if (!screen) {
    add({ severity: "high", screen: spec.screen, rule: "screen-missing",
          detail: `Spec declares ${spec.url} but no page.tsx renders it.`, where });
    continue;
  }

  /* ---- 1. every declared API is actually called, and vice versa --------- */
  const declared = new Set((spec.apis ?? []).map((a) => a.url));
  const called = new Set(screen.apis.map((a) => a.replace(/\/$/, "")));
  for (const d of declared) {
    if (!called.has(d)) {
      add({ severity: "medium", screen: spec.screen, rule: "api-declared-not-called",
            detail: `Spec lists ${d} but ${screen.file} never calls it.`, where: screen.file });
    }
  }
  for (const c of called) {
    if (!declared.has(c) && !/\/api\/(auth|logs)/.test(c)) {
      add({ severity: "low", screen: spec.screen, rule: "api-called-not-declared",
            detail: `${screen.file} calls ${c}, which the spec does not document.`, where: screen.file });
    }
  }

  /* ---- 2. pagination contract on every list endpoint ------------------- */
  for (const api of spec.apis ?? []) {
    const route = routeFor(api.url);
    if (!route) {
      add({ severity: "high", screen: spec.screen, rule: "route-missing",
            detail: `Spec references ${api.url} but no route.ts implements it.`, where });
      continue;
    }
    if (api.requiresPaginationTotal) {
      if (!route.exposesPaginationTotal) {
        add({
          severity: "high", screen: spec.screen, rule: "pagination-total-missing",
          detail:
            `${api.url} is specified as paginated but its GET does not return ` +
            `pagination.total` +
            (route.exposesFlatTotal ? ` (it returns a flat "total" instead — shape drift vs siblings).` : `.`) +
            (route.hardTake.length ? ` It hard-caps at take: ${route.hardTake.join(", ")}, so rows beyond that vanish silently.` : ""),
          where: route.file,
        });
      }
      if (!route.paginated && route.hardTake.length) {
        add({
          severity: "high", screen: spec.screen, rule: "silent-truncation",
          detail: `${api.url} fetches with take: ${route.hardTake.join(", ")} and no skip/page — the list is capped with no way for the client to know.`,
          where: route.file,
        });
      }
    }
    if (api.tallySource === "server" && !route.usesGroupBy) {
      add({ severity: "medium", screen: spec.screen, rule: "client-side-tally",
            detail: `${api.url} is specified to compute tallies server-side but has no groupBy.`, where: route.file });
    }
  }

  /* ---- 3. tab counts must not come from array.length ------------------- */
  for (const tab of spec.tabs ?? []) {
    const heading = screen.countHeadings.find((h) => h.heading === tab.heading);
    if (heading && tab.countFrom !== "array.length") {
      add({
        severity: "high", screen: spec.screen, rule: "count-from-array-length",
        detail:
          `Heading "${tab.heading}" renders {${heading.array}.length}, but the spec requires ` +
          `${tab.countFrom}. On a paginated or capped fetch this under-reports with no visible error.`,
        where: screen.file,
      });
    }
  }

  /* ---- 4. dropdowns: present, sourced, placeholder --------------------- */
  for (const dd of spec.dropdowns ?? []) {
    const built = screen.dropdowns.find((d) => d.name === dd.name || d.boundTo === dd.name);
    if (!built) {
      add({ severity: "high", screen: spec.screen, rule: "dropdown-missing",
            detail: `Spec requires dropdown "${dd.name}" (${dd.label}); no matching <select> found.`, where: screen.file });
      continue;
    }
    if (dd.source !== "static" && !built.optionsFrom) {
      add({ severity: "medium", screen: spec.screen, rule: "dropdown-not-sourced",
            detail: `Dropdown "${dd.name}" has no .map() options source; spec says it is fed by ${dd.source}.`, where: screen.file });
    }
    if (dd.placeholder && !built.hasPlaceholder) {
      add({ severity: "low", screen: spec.screen, rule: "dropdown-no-placeholder",
            detail: `Dropdown "${dd.name}" is missing an empty placeholder option.`, where: screen.file });
    }
  }

  /* ---- 5. fields present and addressable ------------------------------ */
  const named = new Set(screen.fields.map((f) => f.name).filter(Boolean));
  for (const f of spec.fields ?? []) {
    if (!named.has(f.name)) {
      add({
        severity: "medium", screen: spec.screen, rule: "field-not-addressable",
        detail:
          `Field "${f.name}" (${f.label}) has no name/id/data-testid in ${screen.file}. ` +
          `It may render, but nothing can select it — the field is untestable and unspecifiable.`,
        where: screen.file,
      });
    }
  }

  /* ---- 6. client validation messages exist ---------------------------- */
  for (const v of (spec.validations ?? []).filter((v) => v.level !== "server")) {
    if (!screen.validationMessages.includes(v.message)) {
      add({ severity: "medium", screen: spec.screen, rule: "validation-missing",
            detail: `No client validation emits "${v.message}" (trigger: ${v.trigger}).`, where: screen.file });
    }
  }

  /* ---- 7. role gate parity across the screen's endpoints -------------- */
  const allowed = new Set(spec.roles?.allowed ?? []);
  for (const api of spec.apis ?? []) {
    const route = routeFor(api.url);
    const roles = route?.methods?.GET?.roles;
    if (!roles) continue;
    if (!Array.isArray(roles)) {
      add({ severity: "low", screen: spec.screen, rule: "role-gate-indirect",
            detail: `${api.url} GET gates on the constant ${roles.constant}; the spec cannot verify the role set statically.`, where: route.file });
      continue;
    }
    const missing = [...allowed].filter((r) => !roles.includes(r));
    if (missing.length) {
      add({
        severity: "medium", screen: spec.screen, rule: "role-gate-drift",
        detail:
          `${api.url} GET admits [${roles.join(", ")}] but the screen is open to ` +
          `[${[...allowed].join(", ")}] — ${missing.join(", ")} would load the page and get a 403 from this call.`,
        where: route.file,
      });
    }
    const extra = roles.filter((r) => spec.roles?.denied?.includes(r));
    if (extra.length) {
      add({ severity: "high", screen: spec.screen, rule: "role-over-permissive",
            detail: `${api.url} GET admits ${extra.join(", ")}, which the spec explicitly denies.`, where: route.file });
    }
  }
}

/* -------------------------------------------------- repo-wide invariants -- */
// These need no per-screen spec: they hold for every route in the app.
for (const r of asBuilt.routes) {
  if (r.paginated && !r.exposesPaginationTotal) {
    add({
      severity: r.exposesFlatTotal ? "medium" : "high",
      screen: "(repo-wide)", rule: "paginated-without-total",
      detail: r.exposesFlatTotal
        ? `${r.url} paginates and returns a flat "total" instead of pagination.total — inconsistent with its siblings, so a shared client helper reads undefined.`
        : `${r.url} paginates (skip/take) but never returns a total, so no caller can render a correct count.`,
      where: r.file,
    });
  }
  if (r.envelope.rawNextResponse && !r.envelope.usesHelpers) {
    add({ severity: "medium", screen: "(repo-wide)", rule: "envelope-bypass",
          detail: `${r.url} builds responses with NextResponse.json directly, bypassing the {success,data,error} helpers.`, where: r.file });
  }
  for (const [verb, m] of Object.entries(r.methods)) {
    if (!m.authenticated) {
      add({ severity: "high", screen: "(repo-wide)", rule: "unauthenticated-route",
            detail: `${verb} ${r.url} is exported without withAuth.`, where: r.file });
    }
  }
}

/* ------------------------------------------------------------- reporting -- */
const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ findings, counts: tally() }, null, 2));
} else {
  const c = tally();
  console.log(`\nSpec conformance: ${findings.length} finding(s)  ` +
              `[high ${c.high}, medium ${c.medium}, low ${c.low}]\n`);
  let last = null;
  for (const f of findings) {
    if (f.severity !== last) { console.log(`--- ${f.severity.toUpperCase()} ---`); last = f.severity; }
    console.log(`  [${f.rule}] ${f.screen}\n      ${f.detail}\n      at ${f.where}`);
  }
  console.log();
}

function tally() {
  return findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] ?? 0) + 1), a),
                         { high: 0, medium: 0, low: 0 });
}

const gate = process.argv.find((a) => a.startsWith("--fail-on="))?.split("=")[1];
if (gate && findings.some((f) => order[f.severity] <= order[gate])) process.exit(1);
