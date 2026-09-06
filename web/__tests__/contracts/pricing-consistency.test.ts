/**
 * Pricing contract: there is exactly ONE cost basis in this codebase.
 *
 * The recurring failure here was never a broken screen -- it was four modules
 * each inventing their own answer to "what did this cost us", so the same
 * order showed a different profit on the invoice list, the reports page, the
 * simulator and the MR council. lib/pricing.ts is now the single source of
 * truth (purchaseRate -> pts -> ptr -> price, positive values only, no
 * multipliers), and these are STATIC checks that nothing quietly grows its
 * own again. They read source with fs -- no server, no shelling out.
 */
import fs from "fs";
import path from "path";

const WEB_ROOT = path.resolve(__dirname, "../..");
const SCAN_ROOTS = ["app/api", "lib", "services"];
const PRICING_MODULE = "lib/pricing.ts";

/**
 * Reads a price/cost field but only to DISPLAY or to BILL it -- never to
 * decide what something cost us. Each entry is `file` plus the exact source
 * text of the accepted expression, so a new fallback chain in the same file
 * still fails. Every entry below was read and verified individually.
 */
const COST_CHAIN_ALLOWLIST: { file: string; match: string; why: string }[] = [
  {
    file: "app/api/manager/mr-stock/route.ts",
    match: "Number(row.product.ptr ?? row.product.price ?? 0)",
    why: "Values sample stock held by an MR at its SELLING price for a display column; not a cost basis.",
  },
  {
    file: "app/api/mr/samples/route.ts",
    match: "Number(s.product.ptr ?? s.product.price ?? 0)",
    why: "Same sample-stock valuation, MR-facing copy of the screen above. Display only.",
  },
  {
    file: "app/api/orders/[id]/route.ts",
    match: "Number(p.ptr ?? p.price)",
    why: "List price to BILL the line at (revenue ladder), before scheme discounts. Not cost.",
  },
  {
    file: "app/api/orders/secondary/route.ts",
    match: "Number(p.ptr ?? p.price)",
    why: "Same billing list price on order creation. Not cost.",
  },
  {
    file: "app/api/simulator/scheme/route.ts",
    match: "Number(product.ptr ?? product.price)",
    why: "The PTR rung of the selling ladder shown back to the user; the simulator's COST side now goes through costBasis().",
  },
  {
    file: "app/api/products/route.ts",
    match: "Number(p.ptr ?? p.price)",
    why: "unitValue for the catalogue's display-only margin column.",
  },
  {
    file: "app/api/products/route.ts",
    match: "Number(p.pts ?? p.ptr ?? p.price)",
    why: "Feeds the catalogue's estimated-purchase-rate display when marginStructure has no stored rate. Display only -- but it is the closest thing left to a second cost basis, so it is called out rather than hidden.",
  },
  {
    file: "app/api/products/[id]/route.ts",
    match: "Number(product.purchaseRate ?? parsed.data.purchaseRate ?? 0)",
    why: "Echoes the just-saved value into the pricing-audit response. No profit is derived from it.",
  },
  {
    file: "services/item-history-agents.service.ts",
    match: "Number(product.ptr || product.price || 100)",
    why: "PTR shown in the item-history narrative; that report's cost figure uses purchaseRateVal, not this.",
  },
  {
    file: "services/item-history-agents.service.ts",
    match: "Number(product.ptr || product.price || 0)",
    why: "Price-ladder echo in the report payload (mrp/ptr/pts trio). Display only.",
  },
  {
    file: "services/item-history-agents.service.ts",
    match: "Number(product.pts || product.price || 0)",
    why: "Same price-ladder echo. Display only.",
  },
  {
    file: "lib/multi-agent-council.ts",
    match: "iSum + Number(it.product?.ptr || it.price || 0) * it.quantity",
    why: "POB (proof-of-business) order value per chemist visit -- a revenue headline, no cost or profit derived.",
  },
  {
    file: "lib/multi-agent-council.ts",
    match: "sum + Number(it.product?.ptr || it.price || 0) * it.quantity",
    why: "Order-list PTR total for display; the council's profit maths goes through profitFor().",
  },
];

/** Every .ts/.tsx under the scanned roots, excluding tests and pricing itself. */
function collectSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    const abs = path.join(WEB_ROOT, dir);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        walk(rel);
      } else if (/\.tsx?$/.test(entry.name) && rel !== PRICING_MODULE) {
        out.push(rel);
      }
    }
  };
  SCAN_ROOTS.forEach(walk);
  return out.sort();
}

type Hit = { file: string; line: number; text: string };

function scan(matcher: (line: string) => boolean): Hit[] {
  const hits: Hit[] = [];
  for (const file of collectSourceFiles()) {
    const lines = fs.readFileSync(path.join(WEB_ROOT, file), "utf8").split("\n");
    lines.forEach((text, i) => {
      // Comment lines are prose about the rule, not code that breaks it.
      const code = text.trim();
      if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;
      if (matcher(code)) hits.push({ file, line: i + 1, text: code });
    });
  }
  return hits;
}

const COST_FIELD = "(?:purchaseRate|pts|ptr|price|billedPrice)";

/** `ptr * 0.88`, `price * 0.9`, `rate * 1.12` -- a guess wearing a number's clothes. */
const MARGIN_MULTIPLIER = new RegExp(
  `(?:${COST_FIELD}[\\w.?()\\]]*\\s*\\*\\s*(?:0\\.\\d+|1\\.\\d+)` +
    `|(?:0\\.\\d+|1\\.\\d+)\\s*\\*\\s*[\\w.?]*${COST_FIELD})`,
  "i"
);

/** `pts ?? ptr`, `ptr || price` -- one cost/price field falling back to another. */
const COST_FALLBACK_CHAIN = new RegExp(
  `\\b${COST_FIELD}\\b[^;\\n]{0,60}?(?:\\?\\?|\\|\\|)\\s*[\\w.?[\\]]*\\b${COST_FIELD}\\b`
);

function isAllowlisted(hit: Hit): boolean {
  return COST_CHAIN_ALLOWLIST.some((a) => a.file === hit.file && hit.text.includes(a.match));
}

function render(hits: Hit[]): string {
  return hits.map((h) => `  ${h.file}:${h.line}\n    ${h.text}`).join("\n");
}

describe("pricing contract: lib/pricing.ts is the single source of truth", () => {
  it("exposes the API the rest of the codebase depends on", () => {
    const abs = path.join(WEB_ROOT, PRICING_MODULE);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `${PRICING_MODULE} is missing. Every cost and profit figure in the app ` +
          `resolves through it; without it each module goes back to inventing its own.`
      );
    }
    const src = fs.readFileSync(abs, "utf8");
    const missing = ["costBasis", "profitFor", "COST_BASIS_SELECT"].filter(
      (name) => !new RegExp(`export\\s+(?:function|const)\\s+${name}\\b`).test(src)
    );
    if (missing.length) {
      throw new Error(
        `${PRICING_MODULE} no longer exports: ${missing.join(", ")}. ` +
          `Callers across app/api, lib and services import these by name.`
      );
    }
    expect(missing).toEqual([]);
  });
});

describe("pricing contract: no invented margin multipliers", () => {
  it("no module multiplies a price or rate by a hardcoded factor", () => {
    const offenders = scan((l) => MARGIN_MULTIPLIER.test(l));
    if (offenders.length) {
      throw new Error(
        `${offenders.length} hardcoded margin multiplier(s) applied to a price or rate:\n` +
          render(offenders) +
          `\n\nA literal like \`ptr * 0.88\` is a margin ASSUMPTION disguised as data: ` +
          `it invents a cost nobody recorded, then reports the resulting profit as ` +
          `fact. If the real cost is missing, say so (costBasis().source / .exact) -- ` +
          `do not guess. Resolve cost through lib/pricing.costBasis() instead.`
      );
    }
    expect(offenders).toEqual([]);
  });
});

describe("pricing contract: no module owns a second cost basis", () => {
  it("no file outside lib/pricing.ts builds its own cost fallback chain", () => {
    const offenders = scan((l) => COST_FALLBACK_CHAIN.test(l)).filter((h) => !isAllowlisted(h));
    if (offenders.length) {
      throw new Error(
        `${offenders.length} private cost-basis fallback chain(s) outside ${PRICING_MODULE}:\n` +
          render(offenders) +
          `\n\nA chain like \`pts ?? ptr ?? price\` is a second answer to "what did ` +
          `this cost us", and the screen that owns it will disagree with every other ` +
          `screen showing the same order. Call costBasis() / profitFor() from ` +
          `${PRICING_MODULE}. If the read is genuinely display-only (a price ladder ` +
          `shown to the user, a billing list price), add it to COST_CHAIN_ALLOWLIST ` +
          `with the reason.`
      );
    }
    expect(offenders).toEqual([]);
  });

  it("every allowlist entry still corresponds to real source", () => {
    const stale = COST_CHAIN_ALLOWLIST.filter((a) => {
      const abs = path.join(WEB_ROOT, a.file);
      return !fs.existsSync(abs) || !fs.readFileSync(abs, "utf8").includes(a.match);
    }).map((a) => `${a.file}  ::  ${a.match}`);

    if (stale.length) {
      throw new Error(
        `${stale.length} COST_CHAIN_ALLOWLIST entr(ies) no longer match any source:\n  ` +
          stale.join("\n  ") +
          `\n\nDelete them. An allowlist that outlives the code it excused silently ` +
          `widens to cover whatever is written there next.`
      );
    }
    expect(stale).toEqual([]);
  });
});
