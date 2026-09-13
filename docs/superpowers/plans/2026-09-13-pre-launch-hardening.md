# Pre-Launch Hardening Plan

> Adapted lightweight execution (same ruling as the 2026-09-13 QA sweep): no
> git worktree (shared working tree, user asleep, autonomous execution
> explicitly authorized), no dedicated reviewer subagent per task, no 5-round
> fix loop. Orchestrator (me) reviews each task's diff directly against
> `git diff`, `tsc`, and `vitest`. Ledger at
> `docs/superpowers/plans/2026-09-13-pre-launch-ledger.md`.

**Goal:** Get pokemon-mvp to a real go-live-ready state: fix Critical/High
security, SEO/searchability, and production-readiness gaps found by three
parallel audit agents (security, SEO, production-readiness) tonight.

**Source audits:** full text preserved in the orchestrator's conversation
(not re-copied here to keep this file scannable) — security audit
(agent a57a960b9e968bc54), SEO audit (agent af6675da79da7851a),
production-readiness audit (agent af8aa4d24b90099a4).

## Global Constraints

- Do not fabricate legal/business content (Terms, Privacy, Refund Policy) —
  flag as human-decision only.
- Do not touch live Stripe/Supabase account settings or deploy anything.
- Do not silently rotate the live `admin@pokemon.com` password — flag it as
  a top-priority manual action instead (user is actively using this account).
- Any dependency version bump must be verified with a full `next build` +
  `tsc --noEmit` + `vitest run` pass before being considered done.
- Every fix must end with `npx tsc --noEmit` and `npx vitest run` clean
  (except pure-infra files with no logic, e.g. `robots.ts`).

## Task 1: SEO infrastructure (agent-dispatched)

Create: `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`,
`src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`,
per-segment error boundaries for `checkout`, `cart`, `offers`, `auctions`.
Modify: add `metadata`/`generateMetadata` + `robots: {index:false}` to
server-component pages that need it (marketplace, home if server-splittable,
profile, checkout/success, etc.), per SEO audit items 1, 5, 6, 8, 9, 10.
Excludes `src/app/cards/[id]/page.tsx` (owned by orchestrator directly,
Task 2 below).

## Task 2: Card detail page metadata refactor (orchestrator-owned)

Split `src/app/cards/[id]/page.tsx` into a server `page.tsx` (data fetch +
`generateMetadata` with title/description/OG/Twitter + JSON-LD
`schema.org/Product`) wrapping a client component carrying today's
interactive UI unchanged. Add `alternates.canonical`.

## Task 3: Security hardening (agent-dispatched)

- `src/lib/env.ts`: validate required env vars at boot, throw with clear
  names if missing.
- `src/lib/rateLimit.ts`: in-memory sliding-window limiter (documented as a
  stopgap; real prod should move to Upstash/Redis), wired into
  `src/lib/auth.ts` `authorize()`, `POST /api/user` (signup),
  `POST /api/offers/payment-intent`, `POST /api/auctions/[id]/bid/intent`.
- `next.config.mjs`: add `headers()` — CSP, `X-Frame-Options: DENY`, HSTS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- `src/app/api/cards/route.ts`, `src/app/api/cards/[id]/route.ts`: generic
  client-facing error messages (log real error server-side only); add
  server-side file-size cap + real content-type validation (not just
  extension) on image uploads; validate admin-supplied `ownerId` exists
  before `update`.
- `src/app/api/checkout/cart/route.ts`: same generic-error-message fix.
- `src/app/api/user/route.ts` + `src/app/auth/signup/page.tsx`: raise min
  password length 6 → 10, update client validation message to match.
- `src/app/api/pricetracker/[tcgId]/route.ts`: remove debug `console.log`s.
- `prisma/seed.ts`: gate the hardcoded `admin@pokemon.com`/`admin` seed
  account behind a non-production check or a required env-var password, so
  a future reseed against a real prod DB can't recreate a known-credential
  admin account.

## Task 4: Production-readiness fixes (agent-dispatched)

- `src/app/api/health/route.ts`: cheap `SELECT 1` via Prisma, 200/503.
- `vercel.json`: fix cron schedule to `*/5 * * * *` to match the
  `expire-auctions`/`expire-offers` route docstrings; note in the report
  that sub-daily cron requires a Vercel plan above Hobby (human decision).
- `src/app/upload/UploadCard.tsx`: replace the 3 raw `<img>` elements
  (lines ~414, 722, 778) with `next/image` to clear the `next lint` warnings.
- `src/__tests__/api/user/route.test.ts` (new): cover the base user CRUD
  route (currently untested).
- `src/__tests__/api/binders/route.test.ts` (new): cover the binders route
  (currently untested), matching sibling route test conventions.

## Task 5: Dependency upgrades (orchestrator-owned, sequential, last)

Bump `next` to latest patched 14.2.x; upgrade `axios`, `swiper`,
`nodemailer`, `sharp`, `next-auth`/`@auth/core` to patched versions one at a
time, verifying `next build` + `tsc --noEmit` + `vitest run` after each.
Re-run `pnpm audit --prod` at the end and record remaining findings (if any
can't be cleanly bumped without a breaking major, flag for human decision
rather than force a breaking upgrade).

## Explicitly NOT fixed here (human-decision items, listed in final report)

- Rotating the live `admin@pokemon.com` password.
- Terms of Service / Privacy Policy / Refund Policy content.
- Supabase pooler `connection_limit=5` tier decision.
- Error-tracking/monitoring integration (Sentry) — needs an account/DSN.
- Setting `NEXT_PUBLIC_SITE_URL` to the real production domain at deploy time.
- Vercel plan tier needed for 5-minute cron granularity.
