#!/usr/bin/env node
/**
 * Generates the AS-BUILT half of the screen specification by reading source.
 *
 * The as-built column must never be hand-maintained -- if it were, it would
 * drift from the code exactly like the docs it is meant to police. This script
 * is the single producer of qa/specs/as-built.json; the INTENDED column lives
 * in qa/specs/screens/*.yaml and is hand-authored.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = path.join(ROOT, "web");

function walk(dir, match, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, match, out);
    } else if (match(e.name)) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(WEB, p).split(path.sep).join("/");

/* ---------------------------------------------------------------- routes -- */

// Maps an app-router file path to its public URL, dropping route groups
// like (dashboard) which are organisational only and not part of the URL.
function urlFor(file, kind) {
  const parts = rel(file).split("/");
  parts.shift();                          // "app"
  parts.pop();                            // "route.ts" | "page.tsx"
  const segs = parts.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

function extractRoute(file) {
  const src = fs.readFileSync(file, "utf8");
  const methods = {};
  // export const GET = withAuth(handlerName, [Role.MR, Role.ASM])
  // Role arrays routinely span several lines, so the export statement is
  // sliced on balanced parentheses rather than matched with one regex --
  // a single pattern covering every arg shape backtracks badly here.
  const exportRe = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*/g;
  let em;
  while ((em = exportRe.exec(src))) {
    const verb = em[1];
    const rest = src.slice(em.index + em[0].length);
    if (!rest.startsWith("withAuth(")) {
      methods[verb] = {
        handler: rest.split(/[;\n]/)[0].trim() || null,
        authenticated: false,
        roles: null,
      };
      continue;
    }
    let depth = 0, end = -1;
    for (let k = "withAuth".length; k < rest.length; k++) {
      if (rest[k] === "(") depth++;
      else if (rest[k] === ")" && --depth === 0) { end = k; break; }
    }
    const args = rest.slice("withAuth(".length, end === -1 ? rest.length : end);
    const comma = args.indexOf(",");
    const handler = (comma === -1 ? args : args.slice(0, comma)).trim() || null;
    const rolesRaw = comma === -1 ? "" : args.slice(comma + 1).trim();

    let roles = null;
    if (rolesRaw) {
      const enumHits = [...rolesRaw.matchAll(/Role\.(\w+)/g)].map((r) => r[1]);
      const strHits = [...rolesRaw.matchAll(/["'`]([A-Z_]{2,})["'`]/g)].map((r) => r[1]);
      const named = [...new Set([...enumHits, ...strHits])].sort();
      roles = named.length ? named : { constant: rolesRaw.replace(/\s+/g, " ") };
    }
    methods[verb] = { handler, authenticated: true, roles };
  }

  const body = (name) => {
    if (!name) return "";
    const i = src.indexOf(`function ${name}(`);
    if (i === -1) return src;
    // Handler bodies are top-level, so the next top-level declaration ends it.
    const rest = src.slice(i + 1);
    const j = rest.search(/\n(?:async function|function|export const)\s/);
    return j === -1 ? rest : rest.slice(0, j);
  };

  const paginated = /skip:\s*\(page/.test(src) || /skip:\s*\w*[Ss]kip/.test(src);

  return {
    url: urlFor(file, "route"),
    file: rel(file),
    methods,
    paginated,
    // A paginated list must expose the full-scope total under pagination.total.
    exposesPaginationTotal: /pagination:\s*\{[^}]*\btotal\b/s.test(src),
    exposesFlatTotal: /\bok\(\s*\{[^}]*\btotal\b/s.test(src) &&
                      !/pagination:\s*\{[^}]*\btotal\b/s.test(src),
    // A hard take: N with no pagination silently truncates the list.
    hardTake: [...src.matchAll(/take:\s*(\d{2,})/g)].map((x) => Number(x[1])),
    usesGroupBy: /\.groupBy\(/.test(src),
    scope: {
      // Matches `employeeId: employee.id`, `employeeId: scopeEmployeeId`,
      // and the shorthand `{ employeeId }`.
      byEmployeeId: /employeeId:\s*[A-Za-z_$][\w$.]*/.test(src) ||
                    /\{\s*employeeId\s*\}/.test(src),
      byOrderEmployeeId: /order:\s*\{\s*employeeId/.test(src),
      byTerritory: /territoryId:\s*\{?\s*in:/.test(src) || /territoryId:\s*territor/i.test(src),
      resolvesEmployee: /employee\.findUnique\(\s*\{\s*where:\s*\{\s*userId/.test(src),
      managerBypass: /isManager/.test(src),
      managerRoles: [...src.matchAll(/isManager\s*=\s*([^;]+);/gs)]
        .flatMap((x) => [...x[1].matchAll(/Role\.(\w+)/g)].map((r) => r[1]))
        .sort(),
    },
    envelope: {
      usesHelpers: /\b(ok|created|badRequest|notFound|forbidden|unauthorized|conflict|apiError)\(/.test(src),
      rawNextResponse: /NextResponse\.json\(/.test(src),
    },
    validators: [...src.matchAll(/(\w+Schema)\.(?:safeParse|parse)\(/g)].map((x) => x[1]).sort(),
    _bodyOfGet: body(methods.GET?.handler),
  };
}

/* --------------------------------------------------------------- screens -- */

function extractScreen(file) {
  const src = fs.readFileSync(file, "utf8");
  const url = urlFor(file, "page");

  // Every API surface the screen actually talks to.
  const apis = [
    ...new Set(
      [...src.matchAll(/["'`](\/api\/[^"'`?\s${]*)/g)].map((m) => m[1])
    ),
  ].sort();

  // <select> elements and the collection each one is populated from, so the
  // spec can assert "this dropdown is fed by that endpoint".
  const dropdowns = [];
  const selectRe = /<select\b([\s\S]*?)<\/select>/g;
  let s;
  while ((s = selectRe.exec(src))) {
    const block = s[0];
    const nameM = block.match(/(?:name|id|aria-label)=["']([^"']+)["']/);
    const valueM = block.match(/value=\{([^}]+)\}/);
    const sourceM = block.match(/\{\s*(\w+)(?:\?\.|\.)?\s*\.map\(/);
    dropdowns.push({
      name: nameM?.[1] ?? valueM?.[1] ?? null,
      boundTo: valueM?.[1]?.trim() ?? null,
      optionsFrom: sourceM?.[1] ?? null,
      hasPlaceholder: /<option[^>]*value=""/.test(block),
      required: /\brequired\b/.test(block),
    });
  }

  // Controlled inputs -> the field list for the screen.
  const fields = [];
  const inputRe = /<(input|textarea)\b([^>]*)>/g;
  let i;
  while ((i = inputRe.exec(src))) {
    const attrs = i[2];
    const at = (k) => attrs.match(new RegExp(`${k}=["'{]([^"'}]+)`))?.[1] ?? null;
    fields.push({
      tag: i[1],
      name: at("name") ?? at("id") ?? at("placeholder"),
      type: at("type") ?? (i[1] === "textarea" ? "textarea" : "text"),
      required: /\brequired\b/.test(attrs),
      min: at("min"),
      max: at("max"),
      step: at("step"),
      maxLength: at("maxLength"),
    });
  }

  // Client-side validation messages -- what the user is actually told.
  const validationMessages = [
    ...new Set([...src.matchAll(/setError\(\s*["'`]([^"'`]{4,})["'`]/g)].map((m) => m[1])),
  ];

  // Counts rendered straight off an array length. When the array came from a
  // paginated or hard-capped fetch this is the silent-truncation bug.
  const lengthDerivedCounts = [
    ...new Set(
      [...src.matchAll(/([A-Za-z][\w.]*)\.length\}?\s*\)/g)]
        .map((m) => m[1])
        .filter((v) => !/^(items|validItems|parts|arr)$/.test(v))
    ),
  ];
  const countHeadings = [...src.matchAll(/([A-Z][\w ]{3,30})\s*\(\{(\w+)\.length\}/g)].map((m) => ({
    heading: m[1].trim(),
    array: m[2],
  }));

  return {
    url,
    file: rel(file),
    roleFromPath: url.split("/")[1] ?? null,
    apis,
    dropdowns,
    fields,
    validationMessages,
    lengthDerivedCounts,
    countHeadings,
    readsPaginationTotal: /pagination(?:\?\.)?\.total|\.total\b/.test(src),
  };
}

/* ---------------------------------------------------------------- zod ----- */

function extractValidators() {
  const f = path.join(WEB, "lib/validators.ts");
  if (!fs.existsSync(f)) return {};
  const src = fs.readFileSync(f, "utf8");
  const out = {};
  const re = /export const (\w+Schema)\s*=\s*z\.object\(\{([\s\S]*?)\n\}\);/g;
  let m;
  while ((m = re.exec(src))) {
    const [, name, block] = m;
    const fields = {};
    for (const line of block.split("\n")) {
      const fm = line.match(/^\s{2}(\w+):\s*(.+?),?\s*$/);
      if (!fm) continue;
      const [, field, chain] = fm;
      fields[field] = {
        optional: /\.optional\(\)|\.nullish\(\)/.test(chain),
        rule: chain.replace(/\s+/g, " ").trim(),
      };
    }
    out[name] = fields;
  }
  return out;
}

/* --------------------------------------------------------------- prisma -- */

function extractModels() {
  const f = path.join(WEB, "prisma/schema.prisma");
  if (!fs.existsSync(f)) return {};
  const src = fs.readFileSync(f, "utf8");
  const out = {};
  const re = /^model (\w+) \{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(src))) {
    const [, name, block] = m;
    out[name] = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
      .map((l) => {
        const [field, type] = l.split(/\s+/);
        return { field, type, required: type && !type.endsWith("?") };
      })
      .filter((x) => x.field && x.type);
  }
  return out;
}

/* ----------------------------------------------------------------- main -- */

const routes = walk(path.join(WEB, "app/api"), (n) => n === "route.ts").map(extractRoute);
for (const r of routes) delete r._bodyOfGet;

const screens = walk(path.join(WEB, "app"), (n) => n === "page.tsx")
  .filter((f) => !f.includes(`${path.sep}api${path.sep}`))
  .map(extractScreen);

const out = {
  generatedFrom: "source",
  counts: { routes: routes.length, screens: screens.length },
  routes: routes.sort((a, b) => a.url.localeCompare(b.url)),
  screens: screens.sort((a, b) => a.url.localeCompare(b.url)),
  validators: extractValidators(),
  models: extractModels(),
};

const dest = path.join(ROOT, "qa/specs/as-built.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(
  `as-built: ${routes.length} routes, ${screens.length} screens, ` +
  `${Object.keys(out.validators).length} schemas, ${Object.keys(out.models).length} models -> qa/specs/as-built.json`
);
