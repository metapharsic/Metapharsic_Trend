/**
 * Logs in once per role and saves storage state, so the spec files don't each
 * pay for a login. Runs as its own Playwright project, before everything else.
 *
 * Nothing may import this file -- import fixtures/accounts.ts instead.
 */
import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ROLES, ACCOUNTS, statePath } from "./accounts";

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password, landing } = ACCOUNTS[role];

    await page.goto("/login");

    // The login form's markup varies; try the accessible label, then fall back
    // to input type. A failure here should say "login broke", not "timeout".
    const emailBox = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
    const passBox = page.getByLabel(/password/i).or(page.locator('input[type="password"]')).first();

    await emailBox.fill(email);
    await passBox.fill(password);
    await page.getByRole("button", { name: /sign in|log ?in|continue/i }).first().click();

    await expect(
      page,
      `Login as ${role} (${email}) did not leave /login -- check the seed accounts exist ` +
        `(cd web && npm run db:seed) or set E2E_${role.toUpperCase()}_EMAIL / _PASSWORD.`
    ).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // Some roles land on a shared dashboard rather than their canonical page,
    // which is fine -- leaving /login is the real success signal.
    await page.waitForURL(new RegExp(landing.replace(/\//g, "\\/")), { timeout: 8_000 }).catch(() => {});

    fs.mkdirSync(path.dirname(statePath(role)), { recursive: true });
    await page.context().storageState({ path: statePath(role) });
  });
}
