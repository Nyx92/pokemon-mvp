# Task 11 — Cross-cutting: responsiveness, empty/error states, footer

## Tested

- **Mobile viewport (390x844), no horizontal overflow.** Logged in as ash
  (`ash@pokemon.com` / `123`). Checked `document.documentElement.scrollWidth`
  vs `window.innerWidth` on `/`, `/marketplace`, `/cart`, and a card detail
  page (`/cards/458416fb-b446-470e-990b-6ea39a2569bf`, "Psyduck V"). All four
  came back `hasOverflow: false` (scrollWidth === innerWidth === 390) both
  before and after the fix below. The home page's Swiper carousel has slide
  `<div>`s individually wider than the viewport (e.g. 622px), but the carousel
  container clips them (`overflow: hidden`), so the document itself never
  scrolls horizontally. That's normal carousel behavior, not a bug.

- **Mobile navbar.** Screenshot at 390px width confirms the "MXYYC" wordmark
  text is hidden (only the paw-print logo icon shows), and the cart/watchlist/
  notification icons plus the username pill sit cleanly in the header bar with
  no overlap or clipping. This matches the responsive-navbar fix from earlier
  tonight and still holds.

- **Card detail page at mobile width, post-fix.** Navigated from the
  marketplace grid (clicking a card image; the grid uses `router.push`, not
  `<a href>`, so `a[href^="/cards/"]` finds nothing, which is expected, not a
  bug) to a real Riftbound/Pokemon card detail page at 390px width. Confirmed
  no console errors, no overflow, and (after the fix below) the card image
  renders full-width and correctly proportioned instead of collapsed.

- **Error state: made-up UUID.** `/cards/00000000-0000-0000-0000-000000000000`
  renders a proper "Card not found" empty/error state (search icon, "This card
  may have been removed or the link is incorrect.", a "Back to Marketplace"
  button), not a raw stack trace, not an infinite spinner. The underlying
  `GET /api/cards/[id]` correctly 404s (confirmed `Listing.id` is a plain
  `String @id @default(uuid())` in `prisma/schema.prisma`, so a well-formed but
  nonexistent UUID just misses on `findUnique` rather than throwing a
  cast/type error) and the client classifies `res.status === 404` into the
  `not_found` branch already written in `src/app/cards/[id]/page.tsx`. The
  only console entries logged are the expected `Failed to load resource: 404`
  browser-native entry for the failed fetch and the app's own intentional
  `console.error("Error loading card:", ...)`, both expected instrumentation,
  not bugs.

- **Footer "Terms of Use" modal.** Verified all three ways of interacting with
  it, using `.MuiModal-root` presence in the DOM as the ground truth (it's a
  plain MUI `Modal`, not a `Dialog`, so it has no `role="dialog"`, a detail
  that tripped up my first pass at this test, see below):
  - Click "Terms of Use" in the footer: modal opens with real placeholder
    Terms content (headings, body copy, a working scrollable content area).
  - `Escape` key: modal closes (MUI's built-in `Modal onClose` handles this;
    `disableEscapeKeyDown` is not set in `src/app/shared-components/footer/modals/termsOfUse.tsx`).
  - Clicking the `IconButton aria-label="Close"`: modal closes.
  - Clicking the backdrop (outside the modal content): modal closes.
  All three close paths worked cleanly with zero console errors. (My first
  test script used `[role="dialog"]` as the presence-check selector, which
  never matches this component, producing a false "Escape doesn't close it"
  reading purely from a bad test selector, not a real app bug. Re-tested with
  the correct `.MuiModal-root` selector and all three close paths pass.)

- **Console/network re-scan.** Ran with `page.on("console"/"pageerror"/"response")`
  collectors (the shared harness's `newPage(..., {collectErrors:true})`)
  across every page above. Zero console errors, zero page errors, zero 5xx
  responses on any of them after the fix. Cross-checked the two other task
  reports that existed at the time this task ran (`task-1-signup.md`,
  `task-3-marketplace.md`; tasks 2, 4 through 10 had not yet written reports)
  via `grep -i console`: both explicitly confirm zero console errors on their
  flows. No new console/network issues to consolidate from what's landed so
  far; see "Needs Human Verification" below for the gap this leaves.

## Found & Fixed

**Bug: card detail page's image column collapses to about 48px wide on
mobile, instead of filling the viewport.**

- **Where:** `src/app/cards/[id]/page.tsx`, the three-column layout under the
  card detail page (`/cards/[id]`).
- **Root cause:** The three columns (image, title/metadata, buy box) are each
  wrapped in a `<motion.div style={{ flex: "0 0 360px", ... }}>` (and `500px`
  for the buy-box column) so that Framer Motion's entrance animation and the
  flex sizing live on the same element, the actual flex item inside the outer
  `<Box sx={{ display:"flex", flexDirection:{xs:"column",md:"row"},
  alignItems:"flex-start" }}>`. A plain `style` prop can't express MUI's
  responsive breakpoint objects, so `flex: "0 0 360px"` applied unconditionally
  at every width. In row layout (desktop) that's correct: a fixed 360px-wide
  column. But once `flexDirection` switches to `"column"` below `md`,
  `flex-basis` on a column flex item sets **height**, not width, so this
  became "exactly 360px tall, width unconstrained." Combined with the parent's
  `alignItems: "flex-start"` (which does not stretch children to the
  container's cross-axis width), the column's width fell back to shrink-to-fit
  sizing based on its own content. The image itself contributes 0 to that
  computation (it's an absolutely-positioned `next/image fill` inside a
  `position: relative` box with no intrinsic size), so the box shrank down to
  the width of the next-largest content, the 32-48px watchlist bookmark
  icon/thumbnail row, leaving the actual card image rendered inside an
  effectively invisible sliver instead of the full-width box the design
  intends. (There was already a `sx={{ flex: { xs: "0 0 auto", md: "0 0 360px" } }}`
  written on the *inner* `Box` one level down, with exactly the right
  responsive values, but that inner `Box` isn't itself a flex item of the
  outer row/column container, so that styling was dead code with zero effect.
  It was clearly meant to live one level up.)
- **Fix:** Converted each of the three column wrappers from a plain
  `<motion.div style={{...}}>` to `<Box component={motion.div} sx={{...}}>`,
  which lets Framer Motion's animation props (`initial`/`animate`/`transition`)
  pass straight through to the underlying `motion.div` (MUI's `Box` forwards
  unrecognized props to whatever `component` it's given) while making the
  actual flex-basis responsive via `sx`, matching the codebase's existing
  breakpoint-object convention used everywhere else in this same file. Added
  an explicit `width: { xs: "100%", md: "auto" }` alongside the breakpointed
  `flex` value so the column reliably fills the mobile width instead of
  depending on shrink-to-fit content sizing. Applied to all three columns
  (image, title/metadata, buy box) for consistency: only the image column was
  visibly broken in a screenshot, but the title/metadata and buy-box columns
  were relying on the same shrink-to-fit behavior "accidentally" looking
  correct because their content (text, buttons) happens to want full width.
  The fix makes all three deterministic instead of two of them being lucky.
- **Verified:**
  - `npx tsc --noEmit`: clean, exit code 0.
  - `npx vitest run`: full suite, 432/432 tests passed (no tests live under
    `src/lib` or `src/app/api` needed re-running for this change since it's a
    pure `src/app/cards/[id]/page.tsx` layout fix, but ran the full suite
    anyway as a sanity check).
  - Re-drove the card detail page at 390x844 post-fix: the card image now
    renders full-width, correctly proportioned (screenshot:
    `mobile-card-detail4.png` in the scratchpad pw-check dir shows the actual
    Psyduck card art filling the image box, vs. the pre-fix screenshot showing
    a tiny white sliver).
  - Re-checked desktop (1400x1000) on the same card page to confirm no
    regression: `hasOverflow: false`, layout visually unchanged from before
    the fix (row layout with 360/flex/500 columns, screenshot
    `desktop-card-detail-after-fix.png`).
  - Re-ran the full mobile-viewport overflow sweep (`/`, `/marketplace`,
    `/cart`, the card detail page): all still `hasOverflow: false`, zero
    console errors.

## Needs Human Verification

- **Other tasks' reports were incomplete at the time this task ran.** Only
  `task-1-signup.md` and `task-3-marketplace.md` existed in
  `docs/superpowers/plans/2026-09-13-qa-reports/` when I ran the "re-scan all
  prior tasks' console errors" step; both report zero console errors. Tasks
  2, 4, 5, 6, 7, 8, 9, 10 had not yet written reports. Whoever reviews this
  plan's overall output should re-grep those reports for `console` once they
  land, to make sure nothing new turned up in flows this task didn't
  independently drive (offers, auctions, admin upload, etc.).
- **Visual polish check on the fixed card-detail layout, by eye, on a real
  phone or narrow browser window:** open any card detail page (e.g.
  `http://localhost:3000/cards/458416fb-b446-470e-990b-6ea39a2569bf`) at
  about 390px width and confirm the card image column looks right: it should
  fill the available width above the title, not a tiny sliver. I confirmed
  this via screenshot and DOM measurement, but a human glance across a couple
  of different cards (one with multiple images/thumbnails, one without) would
  catch anything a script-based check might miss, such as the thumbnail row
  wrapping oddly under the now-wider image.
- **Voucher / other in-progress tasks' fixtures:** not applicable to this task
  (read-only, no fixtures used), so nothing to flag there.
