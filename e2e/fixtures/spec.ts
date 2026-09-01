/**
 * Loads the intended screen specs so Playwright asserts against the same
 * source of truth as the static diff. A test that hard-codes its expectations
 * is a second spec that drifts from the first.
 */
import fs from "node:fs";
import path from "node:path";
import { parseYaml } from "../../qa/tools/mini-yaml.mjs";

const SPEC_DIR = path.resolve(__dirname, "../../qa/specs/screens");

export interface Dropdown {
  name: string;
  label: string;
  source: string;
  required?: boolean;
  placeholder?: boolean;
  options?: string[];
  emptyStateMessage?: string;
}

export interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
}

export interface Validation {
  trigger: string;
  message: string;
  level?: "client" | "server";
}

export interface ScreenSpec {
  screen: string;
  title: string;
  url: string;
  module: string;
  roles: { allowed: string[]; denied: string[] };
  scope: Record<string, string>;
  apis: { url: string; purpose: string; paginated?: boolean; requiresPaginationTotal?: boolean; tallySource?: string }[];
  tabs?: { id: string; heading: string; countFrom: string }[];
  dropdowns?: Dropdown[];
  fields?: Field[];
  validations?: Validation[];
}

export function loadSpecs(): ScreenSpec[] {
  return fs
    .readdirSync(SPEC_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => parseYaml(fs.readFileSync(path.join(SPEC_DIR, f), "utf8")) as ScreenSpec);
}

export function loadSpec(screen: string): ScreenSpec {
  const spec = loadSpecs().find((s) => s.screen === screen);
  if (!spec) throw new Error(`No spec named "${screen}" in ${SPEC_DIR}`);
  return spec;
}
