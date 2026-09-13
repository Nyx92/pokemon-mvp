# Pre-launch hardening ledger — plan: docs/superpowers/plans/2026-09-13-pre-launch-hardening.md

Ruling: lightweight adapted mode (same as the QA sweep ledger) — no
worktree, no dedicated reviewer subagent, no 5-round fix loop. Orchestrator
reviews each diff directly. User asleep, autonomous execution authorized.

Task 1 (SEO infra): dispatched -> agent a940e6e447036b53e
Task 3 (security hardening): complete. Reviewed full diff directly:
src/lib/env.ts (boot-time validation of 6 required vars, imported for
side-effect in src/lib/prisma.ts), src/lib/rateLimit.ts (in-memory
fixed-window limiter) wired into login (5/15min by ip:email or email),
signup (10/hr by IP), offer/bid payment-intent routes (20/min by user id) —
all fail closed the same way an invalid request already did, no new
distinguishable signal leaked. next.config.mjs CSP + security headers
live-verified via curl and a real Playwright run (logged-in card-detail
page: zero console errors, BuyBox renders correctly, marketplace images
load). cards routes + checkout/cart: generic client-facing error messages,
10MB upload cap, sharp-decode-as-content-validation, admin ownerId
existence check — all live/tsc/vitest verified. Password min 6->10
(server+client). pricetracker debug console.logs removed. seed.ts admin
account now requires SEED_ADMIN_PASSWORD in production, unchanged in dev.
One false alarm investigated and resolved: the agent's reported `next
build` `_document` PageNotFoundError was stale `.next` cache from the
mid-session Next.js version bump (Task 5), NOT a real regression — a clean
`rm -rf .next && next build` completes successfully with all new routes
(robots.txt/sitemap.xml/manifest.webmanifest/api/health) in the output.
tsc clean, vitest 52 files/450 tests passing on the fully combined
HEAD state of all 3 dispatched tasks + orchestrator work.

Orchestrator follow-up: Task 3's own report flagged that the ownerId-exists
guard was only added to PUT /api/cards/[id], not POST /api/cards (same
client-supplied-ownerId shape). Closed that gap directly in
src/app/api/cards/route.ts, added a mock + a new "returns 400 when the
selected owner does not exist" test to src/__tests__/api/cards/route.test.ts.
tsc clean, vitest 52 files/451 tests passing.

=== ALL 5 TASKS COMPLETE ===
Task 4 (production-readiness): dispatched -> agent aaad49b295929c33c
Task 2 (card metadata refactor): complete (split src/app/cards/[id]/page.tsx
into a server page.tsx with generateMetadata + JSON-LD Product schema +
canonical URL, and src/app/cards/[id]/CardDetailClient.tsx carrying the
unchanged original client logic verbatim; tsc clean, vitest 432/432; live
curl-verified on real Venusaur V listing c36bc587-6d02-4905-ae95-f5f408ed2074
— title/description/OG/Twitter/canonical/JSON-LD all render correctly)
Task 5 (dependency upgrades): complete. Removed unused `nodemailer` +
`@types/nodemailer` (app only uses `resend`, eliminating ~8 nodemailer
CVEs for free). Bumped next 14.2.7->14.2.35 (latest patch within the 14.x
line — closes most but NOT all Next.js CVEs; two criticals, an
unauthenticated RCE via AVIF image optimization and a Windows RCE, are
only fixed in Next >=15.5.24, a major version requiring an app-wide
params/searchParams-become-Promises migration — flagged as a human
decision, NOT attempted tonight, too risky to rush unverified). Bumped
next-auth 4.24.11->4.24.15 + @auth/prisma-adapter 2.10.0->2.11.3 (fixes
critical email-homoglyph-bypass CVE). Bumped axios 1.12.2->1.20.0, sharp
0.33.5->0.35.4 (live-verified: real PNG->WebP decode/resize/encode still
works), swiper 11.2.10->12.1.2 (major bump, fixes critical prototype
pollution — live Playwright-verified: home carousel renders 5 slides,
zero console errors), @supabase/supabase-js 2.75.1->2.116.0 (resolved the
transitive `ws` advisory). pnpm audit --prod: 41 advisories remain, all in
deeply transitive sub-dependencies (preact/effect/yaml/defu/deepmerge-ts
via @auth/core and Prisma's own peer-resolved CLI tooling, qs via stripe's
SDK) with no safe top-level bump available without a Prisma/Stripe major
version — flagged for human decision, not attempted. tsc clean, vitest
52 files/450 tests passing throughout, dev server restarted clean on
Next 14.2.35 with correct Stripe webhook secret picked up, robots.txt/
sitemap.xml/manifest.webmanifest all 200.
