/**
 * Role accounts and storage-state paths.
 *
 * Deliberately contains NO Playwright test registration. Spec files import
 * `statePath` from here rather than from auth.setup.ts -- importing a file
 * that calls test()/setup() re-registers those tests inside the importing
 * file, which is how the first run ended up with 45 failures and no login.
 */
import path from "node:path";

export const ROLES = ["admin", "md", "asm", "mr"] as const;
export type RoleKey = (typeof ROLES)[number];

export const ACCOUNTS: Record<RoleKey, { email: string; password: string; landing: string }> = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "admin@mrtracker.com", password: process.env.E2E_ADMIN_PASSWORD ?? "admin123", landing: "/admin" },
  md:    { email: process.env.E2E_MD_EMAIL    ?? "md@mrtracker.com",    password: process.env.E2E_MD_PASSWORD    ?? "md12345",  landing: "/md" },
  asm:   { email: process.env.E2E_ASM_EMAIL   ?? "asm@mrtracker.com",   password: process.env.E2E_ASM_PASSWORD   ?? "asm123",   landing: "/asm" },
  mr:    { email: process.env.E2E_MR_EMAIL    ?? "mr@mrtracker.com",    password: process.env.E2E_MR_PASSWORD    ?? "mr12345",  landing: "/mr" },
};

export const statePath = (role: RoleKey | string) =>
  path.resolve(__dirname, `../.auth/${role}.json`);
