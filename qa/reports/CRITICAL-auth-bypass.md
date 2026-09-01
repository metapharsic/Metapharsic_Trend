# CRITICAL — authentication bypass in both login routes

Found while debugging why the `md` and `asm` Playwright logins failed. Confirmed
by reading source and by a dedicated test suite
(`web/__tests__/contracts/auth-security.test.ts`, 4/4 failing).

## The defect

`web/app/api/auth/login/route.ts:45`
`web/app/api/auth/login/manager/route.ts:38`

```ts
const standardPasswords = ["Password@123", "admin123", "mr12345", "asm123", "password", "admin", "123456"];
let passwordMatch = await bcrypt.compare(password, user.passwordHash);

if (!passwordMatch && standardPasswords.includes(password)) {
  passwordMatch = true;                      // <-- bypasses the hash entirely
  const newHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
}
```

Anyone who knows a valid email address can sign in as that account by typing
`password`, `admin`, or `123456`. The stored hash is not consulted — it is
**overwritten** with the guessed value, so the legitimate owner is locked out
and the change is permanent.

`/api/auth/login/manager` additionally performs **no role check at all** before
issuing a token. `/api/auth/login` does (`user.role !== role`), so the two
front doors disagree. The login page posts to the manager route, which is the
unprotected one.

## Reach

- `/login` is the primary login page and posts to the manager route.
- Applies to every account including `ADMIN` and `MD`.
- The production VPS runs this code (`metapharsic.cloud`, PM2 `trend-mr`).

## Why it stayed hidden

It makes login *more* likely to succeed, so it never produced a bug report. It
surfaced only because the E2E harness logged in as four roles and two failed —
`admin123` and `mr12345` are on the list and passed regardless of the database,
while `md12345` is not and hit the real comparison.

That is also the diagnosis for the `md`/`asm` failures: those two accounts are
probably missing or stale in the local database. `prisma/seed.ts` upserts the
User but calls `prisma.employee.create` (not upsert), so a second seed run
throws partway and leaves later accounts unseeded. Re-seeding a clean database
should fix the E2E logins — but that is the small problem in this file.

## Fix

1. Delete both `standardPasswords` blocks. Password match is `bcrypt.compare`
   and nothing else.
2. Remove the `passwordHash` rewrite. Password changes belong in an
   authenticated change-password flow.
3. Add a role check to `/api/auth/login/manager` — assert the account's role is
   one that door serves.
4. **Force a password reset for every account.** Any account whose password is
   currently one of the seven listed values may have been set by someone else.
5. Make `prisma/seed.ts` use `employee.upsert` so re-seeding is idempotent.

## Regression guard

`web/__tests__/contracts/auth-security.test.ts` — deliberately has no baseline
entry. A known-broken lock is not accepted debt.

```
✕ no login route accepts a hardcoded list of fallback passwords
✕ no login route reassigns its password-match flag to true
✕ no login route silently rewrites a stored password hash on success
✕ every login route verifies the account's role before issuing a token
```
