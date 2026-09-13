# Legal Pages + Next.js 14 → 16 Upgrade — Final Report (2026-09-13)

## Legal pages

Added real `/terms`, `/privacy`, `/refund-policy` pages (MXYYC, contact
`mxyyc@mxyyc.community`, all-sales-final stance per your answer). Replaced
the footer's old "Terms of Use" link, which previously opened a modal
containing entirely unrelated leftover content from a different project
(literal "PLACEHOLDER" text, references to fake medical certificates) —
deleted that modal file, wired the footer to the three new real pages.
These are drafts, not legal advice — recommend a lawyer glance over them
before relying on them for anything contentious.

## Next.js upgrade: 14.2.35 → 16.3.5 (latest)

Went through both major versions (14→15→16) one at a time using Next's
official `@next/codemod upgrade` tool, fixing everything it surfaced, then
verified with `tsc`, `eslint`, `vitest` (451 tests), a full production
`next build`, and a live Playwright pass over every route with real data.

**What changed under the hood:**
- React 18 → 19 (Next 15's requirement).
- `params`/`searchParams` in dynamic routes are now `Promise`s — the
  codemod fixed all 12 affected route/page files automatically; I fixed
  the 35 test call-sites it couldn't reach.
- `next lint` is gone in Next 16 — migrated to plain `eslint .`.
- Dev and build now use Turbopack by default.

**Real bugs I found and fixed along the way (none were pre-existing —
all introduced by the upgrade tooling itself):**
1. Next's own codemod added a `cacheComponents`-only config flag to 9 pages
   that don't have that experimental feature turned on — this actually
   broke the production build. Removed it from all 9.
2. `eslint-config-next`'s config format changed shape between 15 and 16 in
   a way that crashed ESLint entirely — fixed the import pattern.
3. Next 16 requires React's automatic JSX runtime, which correctly exposed
   14 files with a genuinely dead `import React from "react"` — removed
   all 14 (verified none of them actually used `React.` anywhere first).
4. The production build couldn't fetch the Inter font from Google Fonts in
   this environment — switched to self-hosting the exact same font instead
   of pulling it from Google at build time, which is a strict improvement
   (no external dependency during your build, ever) regardless of why it
   surfaced.

**Not fixed, flagged for you:** the upgrade also turned on a stricter lint
rule that flags 18 pre-existing files for calling `setState` synchronously
inside `useEffect` (a common, currently-harmless React pattern, not a bug —
confirmed by all tests and live testing passing). Refactoring 18 files'
state patterns is a real but separate cleanup task, not something I did
tonight since it's not broken, just newly-flagged as non-ideal style.

**Verification:** `tsc` clean, `eslint` clean (aside from the flagged
style items above), `vitest` 52 files / 451 tests passing, a full
production build succeeds (44 routes), and a live Playwright pass over
every page/route — home, marketplace, card detail, cart, offers, auctions,
notifications, profile, admin upload/edit, the new legal pages, 404, and
every dynamic API route — all loaded correctly against real seeded data
with zero unexpected errors.

One cosmetic side note: Next 16 auto-generates an `AGENTS.md`/`CLAUDE.md`
at your repo root now (an official feature to help AI coding tools know
the framework changed) — harmless, regenerates itself, safe to commit or
ignore.
