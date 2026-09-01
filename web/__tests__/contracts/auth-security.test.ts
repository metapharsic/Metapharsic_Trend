/**
 * Authentication invariants.
 *
 * These are static reads of the auth route sources. They are separate from the
 * general API contract suite because an auth regression is not a consistency
 * problem -- it is the whole system's front door, and it deserves to fail
 * loudly and on its own.
 *
 * There is no baseline file here on purpose. A known-broken lock is not
 * "accepted debt".
 */
import fs from "fs";
import path from "path";

const AUTH_DIR = path.resolve(__dirname, "../../app/api/auth");

function authRouteFiles(dir = AUTH_DIR, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) authRouteFiles(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

const files = authRouteFiles().map((f) => ({
  file: path.relative(path.resolve(__dirname, "../.."), f).split(path.sep).join("/"),
  src: fs.readFileSync(f, "utf8"),
}));

describe("auth: no password may bypass the hash comparison", () => {
  it("no login route accepts a hardcoded list of fallback passwords", () => {
    // A list of literal passwords near a bcrypt.compare means some input can
    // authenticate without matching the stored hash. There is no legitimate
    // version of this in a login route.
    const offenders = files
      .filter(({ src }) => {
        const hasLiteralList = /const\s+\w*[Pp]asswords?\w*\s*=\s*\[/.test(src);
        const hasCompare = /bcrypt\.compare\(/.test(src);
        return hasLiteralList && hasCompare;
      })
      .map(({ file, src }) => {
        const line = src.split("\n").findIndex((l) => /const\s+\w*[Pp]asswords?\w*\s*=\s*\[/.test(l));
        return `${file}:${line + 1}`;
      });

    if (offenders.length) {
      throw new Error(
        `AUTH BYPASS: ${offenders.length} login route(s) hold a hardcoded password list ` +
          `alongside bcrypt.compare:\n  ` +
          offenders.join("\n  ") +
          `\n\nAny caller supplying a listed password authenticates as that account ` +
          `regardless of the stored hash. Delete the list and the fallback branch.`
      );
    }
    expect(offenders).toEqual([]);
  });

  it("no login route reassigns its password-match flag to true", () => {
    // Catches the shape even if the literal list is moved to a constant,
    // an env var, or another module.
    const offenders = files
      .filter(({ src }) => /(passwordMatch|isValid|matched)\s*=\s*true\s*;/.test(src))
      .map(({ file }) => file);

    if (offenders.length) {
      throw new Error(
        `AUTH BYPASS: login route(s) force the password-match result to true:\n  ` +
          offenders.join("\n  ") +
          `\n\nThe only thing permitted to set that flag is the bcrypt comparison itself.`
      );
    }
    expect(offenders).toEqual([]);
  });

  it("no login route silently rewrites a stored password hash on success", () => {
    // The bypass above also *overwrites* the real hash with the guessed value,
    // so a single unauthorised login permanently changes the account password.
    const offenders = files
      .filter(({ src }) => /passwordHash:\s*newHash/.test(src))
      .map(({ file }) => file);

    if (offenders.length) {
      throw new Error(
        `Login route(s) rewrite passwordHash during login:\n  ` +
          offenders.join("\n  ") +
          `\n\nPassword changes belong in an authenticated change-password flow, ` +
          `never as a side effect of signing in.`
      );
    }
    expect(offenders).toEqual([]);
  });
});

describe("auth: role checks", () => {
  it("every login route verifies the account's role before issuing a token", () => {
    // /api/auth/login enforces `user.role !== role`. /api/auth/login/manager
    // issues a token for whatever role the account happens to hold, so a
    // DISTRIBUTOR or DOCTOR account authenticates through the manager door.
    const offenders = files
      .filter(({ file }) => /login/.test(file))
      .filter(({ src }) => /signAccessToken\(/.test(src))
      .filter(({ src }) => !/user\.role\s*!==|allowed(Roles)?\.includes|MANAGER_ROLES/.test(src))
      .map(({ file }) => file);

    if (offenders.length) {
      throw new Error(
        `Login route(s) issue a token without checking which roles may use that door:\n  ` +
          offenders.join("\n  ") +
          `\n\nEach login endpoint should assert the account's role is one it serves.`
      );
    }
    expect(offenders).toEqual([]);
  });
});
