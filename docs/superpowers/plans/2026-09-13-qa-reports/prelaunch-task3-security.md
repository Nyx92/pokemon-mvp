# Task 3: Security Hardening — Report

## 1. `src/lib/env.ts` (new)

Validates `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` at
import time, throwing one `Error` naming every missing var. Names were taken
from actual `process.env.X` reads in this repo (`.env`, `src/lib/prisma.ts`,
`src/lib/auth.ts`, `src/app/api/stripe/webhook/route.ts`, the
`createClient(...)` calls in `src/app/api/cards/route.ts`,
`src/app/api/cards/[id]/route.ts`, `prisma/seed.ts`) — **not** the
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` names suggested in
the plan, since this project doesn't use those; Supabase is only ever
touched server-side via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
Exports a typed `env` object for future migration off `process.env.X as
string`. Imported once, for its side effect, from `src/lib/prisma.ts`.
Confirmed no test file imports the real `prisma.ts` (all mock
`@/lib/prisma`), so this never runs during `vitest`, and `.env` already has
every required var, so `next dev`/`next build` are unaffected.

## 2. `src/lib/rateLimit.ts` (new)

In-memory sliding-window limiter (`Map<key, {count, windowStart}>`), lazy
eviction on each call (no `setInterval`, documented as unsafe in
serverless). Comment flags it as a single-instance stopgap needing
Upstash/Redis for real multi-instance production traffic. Wired into:

- `src/lib/auth.ts` `authorize()` — 5/15min, keyed `ip:email` when
  `req.headers["x-forwarded-for"]` is present, else `email` alone. NextAuth
  v4's `authorize(credentials, req)` types `req.headers` as
  `Record<string, any>` copied from the original request, so this is a real
  (not guessed) API; falls back to email-only per the plan's own escape
  hatch since forwarded-for isn't always present. On limit, returns `null` —
  matching this function's existing convention (it never throws; every
  reject path already returns `null`), so a rate-limited attempt is
  indistinguishable from a wrong password.
- `POST /api/user` (signup) — 10/hour by IP (`x-forwarded-for`, no existing
  precedent for IP extraction elsewhere in the codebase), 429 + generic
  message on limit.
- `POST /api/offers/payment-intent` and `POST /api/auctions/[id]/bid/intent`
  — 20/min by `session.user.id`.

## 3. `next.config.mjs`

Added `headers()` returning CSP, `X-Frame-Options: DENY`, HSTS,
`X-Content-Type-Options: nosniff`, `Referrer-Policy` for `/(.*)`. CSP allows
`https://js.stripe.com` (script/frame) and `https://hooks.stripe.com`
(frame), `https://api.stripe.com` (connect), and the exact Supabase storage
hostname from `images.remotePatterns` (`img-src`). `script-src`/`style-src`
keep `'unsafe-inline'`/`'unsafe-eval'` since MUI/emotion injects runtime
`<style>` tags and Next dev HMR uses eval — an overly strict CSP breaking
the app's own styling was judged worse than a looser one. Confirmed
`layout.tsx` uses `next/font/google` (self-hosted at build time), so no
external `font-src` was added. No dev server was running on port 3000 to
curl live; `npx next build` was run instead and reached "Compiled
successfully" (confirming `next.config.mjs` parses/loads correctly) before
hitting an unrelated pre-existing `PageNotFoundError: /_document` during
page-data collection — a Pages-Router artifact in this pure App-Router repo,
untouched by this task and reproducible with no relation to the headers
change (installed `next@14.2.35` vs. the `14.2.7` in `package.json` looks
like the likely cause; left for Task 5/human attention).

## 4. `src/app/api/cards/route.ts` + `src/app/api/cards/[id]/route.ts`

- Both catch blocks now log via `console.error` and return a fixed generic
  message (`"Failed to create/update listing. Please try again."`) at the
  same status (500) instead of `error.message`.
- Added a 10MB per-file cap (`MAX_IMAGE_BYTES`), checked against `File.size`
  before any buffering, in both the POST create loop and the PUT
  new-images loop — 413 on violation.
- `file-type` is not a dependency (checked `package.json`), so per the plan,
  content-type validation instead wraps the existing `compressCardImage()`
  call (which decodes with `sharp` before re-encoding) in a `try/catch` —
  non-image bytes fail to decode and now return 400 with a clear message
  instead of bubbling into the generic 500 handler.
- Admin `PUT` branch: added `prisma.user.findUnique({ where: { id: ownerId
  } })` before `listing.update`; 400 with a clear message if the id doesn't
  resolve to a real user. Scoped to `PUT` only, per the plan's explicit
  wording — `POST /api/cards` has the same client-supplied-`ownerId` shape
  but wasn't listed for this specific check; flagging as a possible
  follow-up rather than expanding scope unasked.

## 5. `src/app/api/checkout/cart/route.ts`

Same fix: catch block now logs server-side and returns a fixed generic
message at the same 500 status instead of `err.message`.

## 6. Password length 6 → 10

`src/app/api/user/route.ts`: server check raised to `< 10`, message updated.
`src/app/auth/signup/page.tsx`: client check + helper text raised to match
(both the `formData.password.length < 10` guard and the "at least 10
characters" helper text).

## 7. `src/app/api/pricetracker/[tcgId]/route.ts`

Removed all 5 debug `console.log`s (`condition`, `"graded true?"`, `graded`,
`url`, `data`). The `console.error` in the catch block was left untouched.

## 8. `prisma/seed.ts`

Chose the smaller diff (option b from the task): the admin password now
reads `process.env.SEED_ADMIN_PASSWORD`, falling back to the literal
`"admin"` only when `NODE_ENV !== "production"`; in production with no
`SEED_ADMIN_PASSWORD` set, the script throws before creating anything.
Dev/test behavior (`admin`/`admin@pokemon.com`) is byte-for-byte unchanged.
No other part of the seed script was touched.

## Verification

- `npx tsc --noEmit` — clean, exit 0.
- `npx vitest run` — **52 files / 450 tests passed**, same as pre-change
  baseline plus one new test I added.
- Updated 2 pre-existing tests whose assertions encoded the exact behavior
  just fixed (per the task's own instruction to update rather than revert):
  - `src/__tests__/api/checkout/cart.test.ts` — the "reserved by another
    buyer" 500 test now asserts the new generic message instead of the old
    leaked `err.message`.
  - `src/__tests__/api/cards/put-card.test.ts` — added `user: { findUnique }`
    to the mocked Prisma client (new dependency from the ownerId-exists
    check) and a new test covering the "owner doesn't exist" 400 path.
  - Note: `src/__tests__/api/user/route.test.ts` already existed
    (apparently from a parallel Task 4 run) and was already written
    forward-compatible with the 6→10 password change and used a 16-char
    password throughout, so it needed no edits and wasn't affected by the
    new signup rate limit either.
- Re-read every modified/created file once after editing to confirm the
  diff matched intent.

## Skipped / could not fully verify

- Live `curl` header verification of `next.config.mjs` — no dev server was
  running on port 3000. `next build`'s compile step succeeded, which is the
  relevant confirmation that the config is syntactically valid; the later
  build failure is unrelated (see item 3 above).
- Did not extend the `ownerId`-exists check to `POST /api/cards` (only`PUT`
  was in scope per the plan) — worth a follow-up since that route has the
  identical client-supplied-`ownerId` shape.
- Did not rotate the live `admin@pokemon.com` password or touch any live
  Stripe/Supabase account settings, per Global Constraints.
