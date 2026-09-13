# Task 4: Production-readiness fixes — report

Plan: `docs/superpowers/plans/2026-09-13-pre-launch-hardening.md`, Task 4.

## 1. Health-check route

Created `src/app/api/health/route.ts`. `GET` runs `prisma.$queryRaw\`SELECT 1\``
using the shared singleton `prisma` client from `src/lib/prisma.ts` (same
`import { prisma } from "@/lib/prisma"` convention every other route in
`src/app/api/**` uses). On success returns
`NextResponse.json({ status: "ok" }, { status: 200 })`; on any failure the
real error is logged server-side (`console.error`) only, and the response is
`NextResponse.json({ status: "error" }, { status: 503 })` — no error detail,
stack trace, or connection info reaches the client. No auth, matching the
plan (meant for uptime monitors).

## 2. Cron schedule fix

Read both cron route docstrings first:
`src/app/api/cron/expire-auctions/route.ts` ("Runs every 5 minutes") and
`src/app/api/cron/expire-offers/route.ts` ("Vercel Cron Jobs ... call this via
GET every 5 minutes on Pro plan"). Both confirm the intended cadence is 5
minutes, not once daily. Updated both entries in `vercel.json` from
`"0 0 * * *"` to `"*/5 * * * *"`.

**Flagging for human/billing decision:** sub-daily cron granularity (anything
more frequent than once a day) requires a Vercel plan above the free Hobby
tier. This is a plan/billing choice, not something fixed in code — if the
project is still on Hobby, Vercel will either reject this cron config at
deploy time or silently coerce it to a daily schedule, so the account's plan
tier needs to be confirmed before relying on 5-minute cron execution in
production.

## 3. UploadCard.tsx — next/image migration

Read the full file first. All three raw `<img>` elements were replaced with
`next/image`'s `<Image>`, at the confirmed locations (line numbers shifted
slightly after adding the `Image` import, but same three spots):

- **Catalog-match preview** (was ~414): `catalogLookup.catalog.imageUrl`. This
  is a real external URL, but not from Supabase — traced it to Riftbound
  catalog data sourced from `cmsassets.rgpub.io` (a third-party TCG CDN, see
  `prisma/seed.ts` which has an existing comment noting this same host isn't
  in `next.config.mjs`'s `remotePatterns`). Rather than speculatively widening
  the security allow-list for one small admin-only thumbnail, used
  `unoptimized` on this `<Image>` — `width={56} height={78}`, same as the
  original inline styles.
- **Main preview** (was ~722): `displayUrl`, which is either an existing
  Supabase storage URL (`kind: "existing"`) or a local blob-URL preview from
  `URL.createObjectURL()` (`kind: "new"`). Used `unoptimized={images[currentImageIndex]?.kind === "new"}`
  so blob previews render (unoptimized, since Next's optimizer can't fetch
  `blob:` URLs) while real Supabase URLs still get optimization. Preserved
  `width: "100%", maxHeight: 320, objectFit: "contain"` via the `style` prop,
  added numeric `width={600} height={320}` (Next requires explicit
  dimensions) as the intrinsic ratio the CSS then overrides responsively.
- **Thumbnail strip** (was ~778): same `existing`/`new` duality per slot,
  same `unoptimized={slot.kind === "new"}` pattern, `width={56} height={56}`
  matching the fixed 56×56 thumbnail box, `alt` text unchanged.

No changes to `next.config.mjs`'s `remotePatterns` — confident that
expanding it wasn't warranted here since `unoptimized` is the documented,
narrower fix for both the blob-preview case and the one external CDN host.

## 4. `src/__tests__/api/user/route.test.ts` (new)

Read `src/app/api/user/route.ts` fully — it exports `POST` (signup) and
`PUT` (profile update, session-authenticated); no `GET`/`DELETE`. Current
password minimum in the file at test-writing time is still 6 characters (the
parallel Task 3 security-hardening agent may raise it to 10 — since that's a
different in-flight task on the same file, tests use a clearly-too-short
password (`"ab"`) and a clearly-long-enough one (16 chars) so they stay valid
under either threshold). 11 tests: valid signup (asserts `bcrypt.hash` called
with the plaintext + salt rounds, and `prisma.user.create` called with hashed
password / role `"user"` / `verified: false`), missing email/password (400),
too-short password (400, message matches `/password/i`), duplicate email via
`P2002` + `meta.target: ["email"]` (409, message matches `/email/i`),
duplicate username via `P2002` + `meta.target: ["username"]` (409, message
matches `/username/i`), unexpected error (500), plus PUT coverage: 401
unauthenticated, 400 missing email, successful update scoped to
`session.user.id`, 409 on `P2002`, 500 on unexpected error. Mocking follows
the `cards/route.test.ts` / `checkout/cart.test.ts` convention: `vi.hoisted`
mock objects, `vi.mock("@/lib/prisma")`, `vi.mock("next-auth")`,
`vi.mock("@/lib/auth", () => ({ authOptions: {} }))`, import the route after
mocks are registered.

## 5. `src/__tests__/api/binders/route.test.ts` (new)

Read `src/app/api/binders/route.ts` fully — `GET` (list current user's
binders, 401 if no session) and `POST` (create binder, 401 if no session, 400
if name blank, 400 on case-insensitive duplicate via `findFirst` with
`mode: "insensitive"`). 6 tests covering exactly that surface: GET 401, GET
happy path (asserts `where: { userId }` and the returned `binders` array),
POST 401, POST 400 on blank name, POST happy path (asserts `findFirst`'s
insensitive-match query and `create`'s `{ name, userId }` payload), POST 400
on duplicate name typed in different case (`"VINTAGE"` vs stored
`"vintage"`).

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `npx vitest run` — **52 test files, 449 tests, all passing** (was 50 files
  before this task; the two new files add 17 tests total — 11 in
  `user/route.test.ts`, 6 in `binders/route.test.ts`). No regressions.
- `npx next lint` — `✔ No ESLint warnings or errors`. The three
  `@next/next/no-img-element` warnings in `UploadCard.tsx` are gone; no new
  lint issues introduced anywhere else.
- Re-read every modified/created file after writing (`src/app/api/health/route.ts`,
  `vercel.json`, `src/app/upload/UploadCard.tsx`, both new test files) to
  sanity-check.

## Skipped / not applicable

Nothing in this task's scope was skipped. The one item requiring a human
decision (Vercel plan tier for 5-minute cron) is flagged above per the plan's
explicit instruction not to work around it in code.
