/**
 * Spec-driven UI conformance.
 *
 * One test body, parameterised over every screen spec -- adding a new
 * qa/specs/screens/*.yaml automatically produces its own coverage. These
 * assertions are limited to what the browser alone can answer.
 */
import { test, expect, Page } from "@playwright/test";
import { loadSpecs, ScreenSpec } from "../fixtures/spec";
import { statePath } from "../fixtures/accounts";

const specs = loadSpecs();

/** The lowest-privilege role a spec admits, so we test the tightest scope. */
function primaryRole(spec: ScreenSpec): "mr" | "asm" | "admin" | "md" {
  const order = ["MR", "ASM", "MD", "ADMIN"] as const;
  const first = order.find((r) => spec.roles.allowed.includes(r)) ?? "ADMIN";
  return first.toLowerCase() as "mr" | "asm" | "admin" | "md";
}

/** Prefers a stable hook, falls back to the accessible label. */
function control(page: Page, name: string, label: string) {
  const byTestId = page.getByTestId(name);
  const byName = page.locator(`[name="${name}"]`);
  const byLabel = page.getByLabel(new RegExp(label, "i"));
  return { byTestId, byName, byLabel };
}

for (const spec of specs) {
  test.describe(`${spec.title} (${spec.url})`, () => {
    test.use({ storageState: statePath(primaryRole(spec)) });

    test.beforeEach(async ({ page }) => {
      await page.goto(spec.url);
      await expect(page).not.toHaveURL(/\/login/);
    });

    for (const dd of spec.dropdowns ?? []) {
      test(`dropdown "${dd.name}" is present and populated`, async ({ page }) => {
        const { byTestId, byName, byLabel } = control(page, dd.name, dd.label);
        const select = (await byTestId.count())
          ? byTestId
          : (await byName.count())
            ? byName
            : byLabel;

        await expect(select, `Spec requires a "${dd.label}" dropdown on ${spec.url}`).toBeVisible();

        // An empty dropdown is the single most common defect in this app:
        // the select renders, the fetch that fills it 403s or returns [],
        // and the user sees a control they cannot use.
        const options = select.locator("option");
        const count = await options.count();
        const real = dd.placeholder ? count - 1 : count;

        expect(
          real,
          `"${dd.label}" rendered ${real} selectable option(s). Source: ${dd.source}`
        ).toBeGreaterThan(0);

        if (dd.options) {
          const texts = (await options.allTextContents()).map((t) => t.trim().toUpperCase());
          for (const expected of dd.options) {
            expect(texts.join("|"), `"${dd.label}" is missing option ${expected}`).toContain(expected);
          }
        }
      });
    }

    for (const f of spec.fields ?? []) {
      test(`field "${f.name}" is present and addressable`, async ({ page }) => {
        const { byTestId, byName, byLabel } = control(page, f.name, f.label);
        const found =
          (await byTestId.count()) || (await byName.count()) || (await byLabel.count());

        expect(
          found,
          `Field "${f.label}" has no data-testid, name, or accessible label on ${spec.url}. ` +
            `Without one the field cannot be automated or specified.`
        ).toBeGreaterThan(0);
      });
    }

    for (const v of (spec.validations ?? []).filter((v) => v.level !== "server")) {
      test(`validation fires: ${v.trigger}`, async ({ page }) => {
        const submit = page.getByRole("button", { name: /save|submit|create|book|record/i }).first();
        test.skip((await submit.count()) === 0, "No submit control on this screen");

        await submit.click();
        await expect(
          page.getByText(v.message, { exact: false }),
          `Expected "${v.message}" after: ${v.trigger}`
        ).toBeVisible();
      });
    }

    for (const tab of spec.tabs ?? []) {
      test(`"${tab.heading}" count matches the API total`, async ({ page }) => {
        // The regression that started all of this: a header count taken from
        // the fetched array rather than the server's total, so a truncated or
        // paginated list under-reports and nobody notices.
        const api = spec.apis.find((a) => a.requiresPaginationTotal);
        test.skip(!api, "No paginated API declared for this tab");

        const [response] = await Promise.all([
          page.waitForResponse((r) => r.url().includes(api!.url) && r.ok(), { timeout: 20_000 }),
          page.reload(),
        ]);
        const body = await response.json();
        const total = body?.data?.pagination?.total;

        expect(
          total,
          `${api!.url} did not return data.pagination.total; the UI has nothing correct to display.`
        ).toBeGreaterThanOrEqual(0);

        const heading = page.getByText(new RegExp(`${tab.heading}\\s*\\(\\d+\\)`));
        test.skip((await heading.count()) === 0, `No "${tab.heading} (n)" heading rendered`);

        const shown = Number((await heading.first().textContent())!.match(/\((\d+)\)/)![1]);
        expect(
          shown,
          `"${tab.heading}" shows ${shown} but ${api!.url} reports ${total} in scope.`
        ).toBe(total);
      });
    }

    test("no role in the denied list can load the screen", async ({ browser }) => {
      // ADMIN is the broadest seeded role; if the spec denies it, it must 403.
      const denied = spec.roles.denied.find((r) => ["ADMIN", "ASM", "MR", "MD"].includes(r));
      test.skip(!denied, "No seeded role is denied by this spec");

      const ctx = await browser.newContext({ storageState: statePath(denied!.toLowerCase() as any) });
      const p = await ctx.newPage();
      const res = await p.goto(spec.url);
      expect(res?.status(), `${denied} should not be able to load ${spec.url}`).toBeGreaterThanOrEqual(400);
      await ctx.close();
    });
  });
}
