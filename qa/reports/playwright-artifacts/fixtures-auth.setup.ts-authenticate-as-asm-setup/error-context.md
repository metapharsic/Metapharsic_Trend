# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fixtures\auth.setup.ts >> authenticate as asm
- Location: fixtures\auth.setup.ts:13:8

# Error details

```
Error: Login as asm (asm@mrtracker.com) did not leave /login -- check the seed accounts exist (cd web && npm run db:seed) or set E2E_ASM_EMAIL / _PASSWORD.

expect(page).not.toHaveURL(expected) failed

Expected pattern: not /\/login/
Received string: "http://localhost:5555/login"
Timeout: 20000ms

Call log:
  - Login as asm (asm@mrtracker.com) did not leave /login -- check the seed accounts exist (cd web && npm run db:seed) or set E2E_ASM_EMAIL / _PASSWORD. with timeout 20000ms
    42 × locator resolved to <html lang="en" class="__variable_f367f3 __variable_ed3508">…</html>
       - unexpected value "http://localhost:5555/login"

```

```yaml
- heading "Trend MR" [level=1]
- paragraph: Sign in to your account
- text: Email
- textbox: asm@mrtracker.com
- text: Password
- textbox: asm123
- button "Sign in"
- paragraph: "⚡ Quick 1-Click Role Logins:"
- button "👑 Admin (Executive)"
- button "👔 MD (Director)"
- button "💼 ASM (Manager)"
- button "🩺 MR (Abdul Mannan)"
- alert
```

# Test source

```ts
  1  | /**
  2  |  * Logs in once per role and saves storage state, so the spec files don't each
  3  |  * pay for a login. Runs as its own Playwright project, before everything else.
  4  |  *
  5  |  * Nothing may import this file -- import fixtures/accounts.ts instead.
  6  |  */
  7  | import { test as setup, expect } from "@playwright/test";
  8  | import fs from "node:fs";
  9  | import path from "node:path";
  10 | import { ROLES, ACCOUNTS, statePath } from "./accounts";
  11 | 
  12 | for (const role of ROLES) {
  13 |   setup(`authenticate as ${role}`, async ({ page }) => {
  14 |     const { email, password, landing } = ACCOUNTS[role];
  15 | 
  16 |     await page.goto("/login");
  17 | 
  18 |     // The login form's markup varies; try the accessible label, then fall back
  19 |     // to input type. A failure here should say "login broke", not "timeout".
  20 |     const emailBox = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
  21 |     const passBox = page.getByLabel(/password/i).or(page.locator('input[type="password"]')).first();
  22 | 
  23 |     await emailBox.fill(email);
  24 |     await passBox.fill(password);
  25 |     await page.getByRole("button", { name: /sign in|log ?in|continue/i }).first().click();
  26 | 
  27 |     await expect(
  28 |       page,
  29 |       `Login as ${role} (${email}) did not leave /login -- check the seed accounts exist ` +
  30 |         `(cd web && npm run db:seed) or set E2E_${role.toUpperCase()}_EMAIL / _PASSWORD.`
> 31 |     ).not.toHaveURL(/\/login/, { timeout: 20_000 });
     |           ^ Error: Login as asm (asm@mrtracker.com) did not leave /login -- check the seed accounts exist (cd web && npm run db:seed) or set E2E_ASM_EMAIL / _PASSWORD.
  32 | 
  33 |     // Some roles land on a shared dashboard rather than their canonical page,
  34 |     // which is fine -- leaving /login is the real success signal.
  35 |     await page.waitForURL(new RegExp(landing.replace(/\//g, "\\/")), { timeout: 8_000 }).catch(() => {});
  36 | 
  37 |     fs.mkdirSync(path.dirname(statePath(role)), { recursive: true });
  38 |     await page.context().storageState({ path: statePath(role) });
  39 |   });
  40 | }
  41 | 
```