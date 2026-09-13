# Task 1: SEO Infrastructure — Report

## Files created

- `src/app/robots.ts` (36 lines) — allows `/`, `/marketplace`, `/cards/*`;
  disallows all 11 private/API paths from the spec. Base URL from
  `process.env.NEXT_PUBLIC_SITE_URL`, falling back to
  `http://localhost:3001` only when unset. References `${baseUrl}/sitemap.xml`.
- `src/app/sitemap.ts` (65 lines) — static entries for `/` and `/marketplace`,
  plus one entry per distinct card at `/cards/[listing.id]`. Confirmed via
  `src/app/api/cards/[id]/route.ts` that the `[id]` route param resolves to
  `Listing.id`, not a catalog id. Queries `prisma.listing.findMany({ where:
  { forSale: true } })` ordered by `updatedAt` desc, capped at 5000 rows, then
  dedupes by `pokemonCardId ?? riftboundCardId ?? listing.id` so a card listed
  by multiple sellers gets one entry (the most-recently-updated listing,
  which also supplies `lastModified` from `Listing.updatedAt`, confirmed to
  exist in `prisma/schema.prisma`). Wrapped in try/catch so a transient DB
  error degrades to the two static entries instead of a 500.
- `src/app/manifest.ts` (28 lines) — `name`/`short_name` "Pokémon MVP"
  (matching `layout.tsx`'s root metadata), `display: "standalone"`,
  `theme_color: "#0053ff"`, `background_color: "#f4f4f4"`. Rather than
  falsely claiming 192x192/512x512 sizes for the source `public/collateral/
  logo.png` (actual: 199x171), I used `sharp` (already a project dependency)
  to generate real `public/icons/icon-192.png` and `icon-512.png` (resize +
  contain on a transparent square canvas) and referenced those with accurate
  `sizes`. No trace of a prior favicon-generation script was found in the
  repo to follow as precedent, so this is a fresh one-off generation.
- `src/app/not-found.tsx` (16 lines), `src/app/error.tsx` (23 lines, `"use
  client"`), `src/app/global-error.tsx` (57 lines, `"use client"`, renders
  its own bare `<html>/<body>` with inline styles only, no MUI/theme
  dependency per Next 14 convention for root-layout failures).
  `not-found.tsx`/`error.tsx` reuse the existing `ErrorState` shared
  component (`not_found`/`error` variants) already used by
  `marketplace/error.tsx`, for visual consistency.
- Per-segment error boundaries, all `"use client"`, matching
  `marketplace/error.tsx`'s exact structure: `src/app/checkout/error.tsx`
  (24 lines), `src/app/cart/error.tsx` (20 lines), `src/app/offers/error.tsx`
  (20 lines), `src/app/auctions/error.tsx` (21 lines, `dark` prop set since
  `/auctions` renders over a dark background image like `/marketplace`;
  cart/offers/checkout are light-background pages so `dark` was omitted
  there after checking their page source).

## Files modified

- `src/app/marketplace/page.tsx` — confirmed server component (no `"use
  client"`); added `export const metadata` with title `"Marketplace |
  Pokémon MVP"` and a description mentioning Pokémon and Riftbound cards.
- `src/app/profile/page.tsx`, `src/app/profile/edit/general/page.tsx`,
  `src/app/checkout/success/page.tsx` — all confirmed server components;
  added `metadata: { robots: { index: false, follow: false } }` as
  defense-in-depth alongside the `robots.ts` disallow rules.

## Skipped, with reason

- `src/app/page.tsx` (home) — confirmed `"use client"` at line 1 (uses
  `usePathname`, `useAuth`). Per instructions, metadata exports only go on
  server components; this needs a server/client split like Task 2's card
  page to carry home-specific metadata. Left untouched, noted here as
  out of scope for this task.
- `src/app/cards/[id]/page.tsx` — explicitly excluded per the plan (owned by
  a parallel Task 2 refactor). Not touched.

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `npx vitest run` — 50 test files / 432 tests passed, identical to the
  pre-change baseline run. No regressions.
- `npx next build` — succeeded. Build output confirms `/robots.txt`,
  `/sitemap.xml`, and `/manifest.webmanifest` all generated as static
  routes (○), and every other route still builds. The only "error"-looking
  line in build output was a pre-existing, unrelated informational
  `DYNAMIC_SERVER_USAGE` notice for `/api/users` (uses `headers()`), not
  caused by this change.
- Manually re-read every new/modified file after writing: `robots.ts`
  exports a default function returning `MetadataRoute.Robots`, `sitemap.ts`
  returns `Promise<MetadataRoute.Sitemap>`, `manifest.ts` returns
  `MetadataRoute.Manifest`, all typed via `import type { MetadataRoute }
  from "next"` — confirmed via successful build/typecheck, not just visual
  inspection.

## Notes for the orchestrator

- Sitemap's card-id dedup keeps only the single most-recently-updated
  listing per catalog card. If two different sellers list the same catalog
  card, only one of those two listing URLs appears in the sitemap (by
  design, to avoid near-duplicate-content entries for the same product) —
  the other listing is still reachable via marketplace search/links, just
  not sitemap-indexed.
- `public/icons/icon-192.png` and `icon-512.png` are new generated binary
  assets, not previously tracked in the repo.
