# Task 1: Sign-up flow

## Tested

Drove `/auth/signup` with a real Chromium browser (`playwright-core` + the shared
`harness.mjs`, extended with a local `task1-signup.mjs` script in the scratchpad
`pw-check/` directory) against the live dev server at `http://localhost:3000`.

- **Happy path.** Filled every visible field in `src/app/auth/signup/page.tsx`
  (First Name, Last Name, Email, Username, Password, Confirm Password, Country,
  Sex, Date of Birth, Address) for a brand-new account
  `qa-signup-test@pokemon.com` / `qa_signup_test` and submitted. The app shows a
  `window.alert("✅ Account created successfully!")` and redirects to
  `/auth/login` (this app logs users in via a separate NextAuth credentials
  step, not automatically after signup — confirmed this is the intended
  behavior by reading `handleSubmit` in the signup page, which explicitly does
  `router.push("/auth/login")` on success). No console errors.
  - DB verification (direct Postgres query via throwaway `tsx` script):
    exactly one `User` row for `qa-signup-test@pokemon.com`, `username:
    "qa_signup_test"`, `role: "user"`, `verified: false`, and
    `password: "$2b$10$1ck8Yk2ifoTyDE38T.xjB.B.UH6GUGF8BOwpHrjPOCuNXG0WhzsXS"`
    — a real bcrypt hash (`$2b$10$...`), not plaintext.
- **Invalid email format.** Filled the form with `email = "not-an-email"` and
  clicked submit. The browser's native HTML5 constraint validation (the field
  is `type="email"` with `required`) blocked the submit before any JS ran:
  `validationMessage: "Please include an '@' in the email address. ..."`,
  and confirmed via network listener that `/api/user` was **never called**.
  This was already working correctly, no fix needed.
- Re-ran all of the above (plus the two sub-checks below) a second time after
  the fixes to confirm nothing regressed — same clean results, see "Found &
  Fixed" for the before/after on the two real bugs.

## Found & Fixed

### Bug 1 — duplicate email returned a raw 500 instead of a clear error

**Symptom:** signing up again with `qa-signup-test@pokemon.com` (same email,
different username) returned HTTP 500 with body `{"error":"Failed to create
user"}`, and the signup page's `alert()` showed a hardcoded, unhelpful
`"Failed to create account. Check console for details."` — no indication to
the user that the email was already taken. Confirmed via direct DB query that
no duplicate row was actually created (the Postgres `@unique` constraint on
`User.email` held), so this was purely a bad-error-handling bug, not a data
integrity one.

**Root cause:** `src/app/api/user/route.ts`'s `POST` handler had no `catch`
branch for Prisma's `P2002` unique-constraint-violation error — it fell
through to the generic `"Failed to create user"` / 500 response. The sibling
`PUT` handler in the same file already had this exact pattern for email
edits (`if (err.code === "P2002") return ... 409 ...`), so `POST` was simply
missing the same handling.

**Fix:**
- `src/app/api/user/route.ts` — added a `P2002` branch to `POST`'s catch
  block, mirroring `PUT`'s existing convention, returning 409 with
  `"That email is already in use."` (or `"That username is already taken."` if
  the violated constraint's `meta.target` is `username` instead — both fields
  are `@unique` on `User` in `prisma/schema.prisma`).
- `src/app/auth/signup/page.tsx` — the `catch` block in `handleSubmit` was
  discarding the real thrown error message and always alerting a generic
  string; changed it to `alert(err instanceof Error ? err.message : ...)` so
  the real server-provided message (e.g. "That email is already in use.")
  actually reaches the user, matching this component's existing convention of
  surfacing errors via `alert()`.

**Verified:** re-ran the duplicate-email sub-test. Response is now
`409 { error: "That email is already in use." }`, the on-page alert now shows
that exact text, and a DB count query confirms `User` rows for
`qa-signup-test@pokemon.com` stayed at exactly 1 (no duplicate, no crash).

### Bug 2 — no minimum password length enforced (anywhere)

**Symptom:** submitted the form with `password = "1"` / `confirmPassword =
"1"` (all other fields valid). The form happily submitted, `/api/user`
returned `201`, and a real `User` row was created in Postgres with a bcrypt
hash of the single character `"1"`. Neither the client component nor the API
route had any length/strength check — the only server check was
`if (!data.email || !data.password)`, which a 1-character string satisfies.

**Root cause:**
- `src/app/api/user/route.ts` `POST` had no password-length validation at all.
- `src/app/auth/signup/page.tsx` had client-side checks for password
  *mismatch* and phone-number format, but nothing for password length, and the
  native HTML `<input type="password">` had no `minLength` attribute either.

**Fix:**
- `src/app/api/user/route.ts` — added `if (data.password.length < 6) return
  400 { error: "Password must be at least 6 characters" }` right after the
  existing required-fields check (server-side defense in depth).
- `src/app/auth/signup/page.tsx` — added a `passwordTooShort` flag to the
  existing `errors` state object (alongside the pre-existing
  `passwordMismatch` and `phoneInvalid` flags, same pattern), validated it
  first in `handleSubmit` before the mismatch check, and wired
  `error`/`helperText` props onto the Password `TextField` showing "Password
  must be at least 6 characters" — consistent with how `Confirm Password` and
  the phone field already surface their own inline errors in this file.

**Verified:** re-ran the short-password sub-test. The form now blocks
submission client-side (`apiResp: null` — `/api/user` was never called, per a
network listener), and a follow-up DB query confirms no `User` row exists for
`qa-shortpw@pokemon.com`.

**Regression check:** `npx tsc --noEmit` — clean, no errors. `npx vitest run`
— full suite, 50 files / 432 tests, all passing (there is an existing
`src/__tests__/api/users/route.test.ts` covering this route; it also passed
unchanged).

## Needs Human Verification

- None for this task — every sub-check (happy path, duplicate email, invalid
  email format, short password) was driven end-to-end through the real
  browser and cross-checked directly against Postgres, both before and after
  the fix.
- Minor, non-blocking note for a human to eyeball if curious: the signup
  page's success/failure feedback still uses native `window.alert()` (this was
  already the case before this session and is out of this task's scope to
  redesign) — it works and is now accurate, but a toast/snackbar would read
  less "developer-console-y" if the team ever revisits this page's UX.
- The throwaway `qa-signup-test@pokemon.com` account created during the
  happy-path test was left in the database (per the plan's fixture note, this
  account is this task's designated fixture and isn't shared with any other
  task) — safe to delete manually if a totally clean seed set is wanted before
  demoing to the user tomorrow.
