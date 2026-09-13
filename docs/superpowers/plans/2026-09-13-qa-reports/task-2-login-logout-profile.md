# Task 2: Login, logout, and profile edit

## Tested

All flows driven with a real headless Chromium via `playwright-core` (harness at
`/tmp/claude-1000/-home-buba-projects/0cc2a3eb-4b77-4109-ad7c-899b4aef5a4f/scratchpad/pw-check/harness.mjs`,
test script `task2-final.mjs` in the same directory).

- **Login as ash (`ash@pokemon.com` / `123`)**: `signIn("credentials", ...)` succeeds, redirects
  to `/`, navbar account button shows `ashketchum`.
- **Logout**: the logout control is not a plain "Log out" button on the page — it's a `Log Out`
  `MenuItem` inside the navbar's account dropdown, opened by clicking the button showing the
  username (`src/app/shared-components/navbar/Navbar.tsx` lines ~250-324, `signOut({ callbackUrl: "/" })`).
  Clicking it correctly reverts the navbar to "Sign up / Login".
- **Protected route while logged out**: `/watchlist` client-side-guards via `useAuth()` +
  `router.replace("/auth/login")` (`src/app/watchlist/page.tsx`). Confirmed it does redirect to
  `/auth/login` (this took up to ~4.5s to fire in this session because the dev server is under
  heavy concurrent load — see "Needs Human Verification" below — so the test polls up to 15s
  rather than asserting instantly).
- **Wrong password for ash**: `signIn` returns an error, the login page shows the red
  "Invalid email or password" helper text (`src/app/auth/login/page.tsx`), no stack trace, no
  silent failure. A `401` on `/auth/login` shows up in the browser console — this is NextAuth's
  own credentials-callback response and is expected/benign, not an app bug.
- **Profile edit as misty**: logged in as `misty@pokemon.com` / `123`, went to
  `/profile/edit/general`, changed the **Address** field (the form has no phone-number field, so
  address was used, matching the plan's "e.g. address or phone number" option), clicked
  "Save changes". Confirmed via a direct Postgres query (`prisma.user.findUnique` on
  `misty@pokemon.com`) that `User.address` persisted to the new value, and confirmed the same
  value renders in the UI after a **fresh full page load** of `/profile/edit/general` (not just
  client-side state) — both the DB row and the UI reflect the saved value:
  ```
  address: "QA Verified Address 1789242419658"
  ```
  (timestamp-suffixed value used to make each run's write uniquely identifiable in the DB).
  `User.password` remains an untouched bcrypt hash throughout (`$2b$10$...`), confirming the
  profile-edit route never touches the password field.

No console errors or 5xx responses were observed in any of the above (`page._errors` empty on
every run).

## Found & Fixed

**Nothing needed fixing.** Initial runs looked like a real bug — after saving the profile edit,
a fresh reload of `/profile/edit/general` sometimes showed the *old* address even though Postgres
already had the *new* one — but this was chased down to root cause via instrumented `fetch`
logging (timestamps + response status for every request) and turned out to be a false alarm:

- The dev server tonight is running all 11 QA tasks' Playwright scripts concurrently against the
  same `next dev` process, plus Prisma/Stripe traffic from the other tasks. Under that load,
  ordinary requests that are normally near-instant were taking multiple seconds — e.g. in one
  captured trace, `PUT /api/user` took ~1.3s, `POST /api/auth/session` (the session-token refresh
  that `useSession().update()` triggers after a successful save) took ~2.8s, and the
  "Profile updated successfully!" snackbar didn't appear until **~4.2s** after clicking Save.
- My first test script only waited 2-3s after clicking Save before reloading and re-checking —
  not enough headroom under tonight's load, so it was reading the page before the session-refresh
  round trip (`getCsrfToken()` → `POST /api/auth/session`, both real network calls, not a no-op)
  had completed. Re-run with the wait replaced by polling (up to ~12-15s) for the actual success
  condition (redirect to `/profile`, or the login-redirect for the watchlist guard), and the
  behavior was 100% correct and repeatable across multiple runs.
- Confirmed this is purely a load/timing artifact, not app logic, by reading
  `node_modules/.pnpm/next-auth@4.24.11.../react/index.js`'s `update()` implementation directly:
  it only no-ops if `loading || !session`, which was never true here — the requests were simply
  slow to resolve, not skipped.

No source file was modified for this task. `npx tsc --noEmit` and `npx vitest run` were **not**
run since no code was changed (per the plan, those are required "after any fix" — there was none).

## Needs Human Verification

- **Dev server responsiveness tonight**: while investigating the false alarm above, a `curl` to
  `http://localhost:3000/` at one point returned nothing at all (`000` / connection empty) with a
  10s timeout, and `page.goto()` calls occasionally failed with `net::ERR_EMPTY_RESPONSE`, before
  succeeding on retry. `next-server` was observed at ~127% CPU. This is almost certainly caused by
  running all 11 QA tasks' browsers/scripts against one dev server simultaneously tonight, not a
  bug in the app itself — but if the human wants to confirm profile-edit / session-refresh
  responsiveness under **normal** (single-user) load, it would be worth clicking "Save changes" on
  `/profile/edit/general` once, by hand, tomorrow when nothing else is hammering the server, and
  confirming the success snackbar appears in well under a second (it should — the slowness seen
  tonight should not reproduce outside this concurrent-QA-sweep condition).
- No other action items — all Task 2 sub-checks passed and were confirmed against Postgres, not
  just the UI.
