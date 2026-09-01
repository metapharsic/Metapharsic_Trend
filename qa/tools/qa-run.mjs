#!/usr/bin/env node
/**
 * One entry point for the whole QA stack, in dependency order:
 *
 *   as-built extract -> spec diff -> Jest contracts -> Playwright -> report
 *
 * Each layer is cheaper and more deterministic than the next, so a failure in
 * an early layer short-circuits the expensive ones unless --all is passed.
 *
 *   node qa/tools/qa-run.mjs                 # static layers only (seconds)
 *   node qa/tools/qa-run.mjs --e2e           # include Playwright
 *   node qa/tools/qa-run.mjs --all --json    # everything, machine-readable
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const wantE2E = args.includes("--e2e") || args.includes("--all");
const asJson = args.includes("--json");

const results = [];

function step(name, fn) {
  const started = Date.now();
  try {
    const output = fn();
    results.push({ name, ok: true, ms: Date.now() - started, output });
    if (!asJson) console.log(`  ok   ${name}  (${Date.now() - started}ms)`);
    return true;
  } catch (err) {
    const output = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") || err.message;
    results.push({ name, ok: false, ms: Date.now() - started, output });
    if (!asJson) {
      console.log(`  FAIL ${name}  (${Date.now() - started}ms)`);
      console.log(output.split("\n").map((l) => "       " + l).join("\n"));
    }
    return false;
  }
}

const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd: path.join(ROOT, cwd), encoding: "utf8", stdio: "pipe" });

if (!asJson) console.log("\nTrend MR QA\n");

step("extract as-built from source", () => run("node", ["qa/tools/extract-asbuilt.mjs"], "."));
const specOk = step("spec conformance", () => run("node", ["qa/tools/diff-spec.mjs", "--fail-on=high"], "."));
const contractsOk = step("API + UI contracts", () => run("npx", ["jest", "__tests__/contracts", "--silent"], "web"));

if (wantE2E && (specOk && contractsOk || args.includes("--all"))) {
  step("browser conformance", () => run("npx", ["playwright", "test"], "e2e"));
} else if (wantE2E && !asJson) {
  console.log("  skip browser conformance -- fix the static layers first, or pass --all");
}

const reportDir = path.join(ROOT, "qa/reports");
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, "last-run.json"), JSON.stringify({ results }, null, 2));

if (asJson) console.log(JSON.stringify({ results }, null, 2));
else {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} layers passed\n`);
}

process.exit(results.some((r) => !r.ok) ? 1 : 0);
