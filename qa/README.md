# Trend MR QA framework

Four layers, cheapest first. Each one catches what the layer below it cannot,
and nothing is duplicated between them.

```
  qa/specs/screens/*.yaml     intended     hand-authored, the source of truth
            |
            |  qa/tools/diff-spec.mjs
            v
  qa/specs/as-built.json      as-built     GENERATED from source, never edited
            |
            +--> web/__tests__/contracts   static invariants over all routes
            |
            +--> e2e/specs                 live browser conformance
            |
            +--> .claude/agents/qa-auditor exploratory audit + bug reports
```

## Why this order

The recurring defect in this codebase is not a broken screen. It is two screens
quietly disagreeing — one endpoint scoping an MR by territory while its sibling
scopes by `employeeId`, or a list capped at 500 rows whose header count is
`array.length`. That class of bug is nearly invisible to a browser test and
trivially detectable by reading the routes side by side. So the static layers
come first and carry most of the weight; the browser is reserved for what only
a browser can see.

## The two columns

**Intended** (`qa/specs/screens/*.yaml`) is written by a human. It states what a
screen should contain: fields, types, dropdown data sources, validation rules,
role visibility, backing APIs and tables.

**As-built** (`qa/specs/as-built.json`) is produced by `extract-asbuilt.mjs`
reading `app/`, `lib/validators.ts` and `schema.prisma`. It is never edited by
hand — an as-built column maintained by a person drifts from the code exactly
like the documentation it was meant to replace.

`diff-spec.mjs` compares them. The diff is the bug backlog.

## Commands

```bash
node qa/tools/qa-run.mjs              # static layers  (seconds)
node qa/tools/qa-run.mjs --e2e        # + browser conformance
node qa/tools/qa-run.mjs --all --json # everything, machine-readable

node qa/tools/extract-asbuilt.mjs     # regenerate the as-built column
node qa/tools/diff-spec.mjs           # spec conformance report
node qa/tools/diff-spec.mjs --json    # same, for the QA agent
cd web && npx jest __tests__/contracts
cd e2e && npx playwright test
```

## Adding a screen

Write `qa/specs/screens/<name>.yaml`. That is the whole task — the diff picks it
up, and `e2e/specs/screen-conformance.spec.ts` generates its browser coverage
from the same file. Copy `orders.yaml`; it exercises every supported clause.

Rules that hold for every route (authentication, response envelope, pagination
totals, scope consistency) live in `web/__tests__/contracts` and need no spec
file — they apply to all 110 routes automatically.

## Prerequisites

The static layers need only Node — the tooling is deliberately dependency-free,
including its YAML reader, because `node_modules` resolution over a mounted
filesystem is slow enough to stop people running it.

Playwright is not yet installed:

```bash
cd e2e && npm init -y && npm i -D @playwright/test && npx playwright install chromium
```

It expects the app on `http://localhost:5555` and a seeded database
(`cd web && npm run db:seed`). Seed logins are read from `E2E_*_EMAIL` /
`E2E_*_PASSWORD` and fall back to the local seed accounts.

## Where the QA agent fits

`.claude/agents/qa-auditor.md` reads the spec, drives the running app, and
drafts bug reports with screenshots into `qa/reports/`. It is not the gate — it
is non-deterministic and belongs alongside the suites, never instead of them.
Its job is to find what nobody thought to write a test for; every defect it
confirms should end up as a new deterministic assertion in one of the layers
above, so the agent never has to find it twice.
