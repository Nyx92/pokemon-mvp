# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the money/ownership-integrity bugs, PII regression, and correctness/efficiency issues found by a full-codebase review of the Pokemon MVP marketplace, without regressing any existing behavior.

**Architecture:** Next.js 14 App Router API routes (`src/app/api/**/route.ts`) backed by Prisma/Postgres and Stripe (manual-capture PaymentIntents for offers/bids, Checkout Sessions for Buy Now). Tests are Vitest unit tests that mock `@/lib/prisma`, `next-auth`, `stripe`, and `@/lib/notifications` — there is **no** component-test infrastructure (no React Testing Library/jsdom configured), so frontend-only changes are verified manually via the `run` skill instead of new automated tests.

**Tech Stack:** Next.js 14, Prisma 6, Stripe 17, NextAuth 4, Vitest 2, MUI 7, React 18.

## Global Constraints

- Money is always stored in cents in the DB; convert with `dollarsToCents`/`centsToDollars` from `src/lib/money.ts`. Never introduce a new inline `/100` or `*100`.
- Every new/changed route handler keeps returning the same JSON error shape (`{ error: string }`) and HTTP status codes already used in that file, unless a task says otherwise.
- Test convention: `vi.hoisted()` mock objects → `vi.mock()` registrations → `import { HANDLER } from "@/app/api/.../route"` → tests. Match this exactly (see any file under `src/__tests__/api/**` for the pattern).
- Run `pnpm test` (not a subset) before each checkpoint sign-off — regressions in files this plan doesn't touch are still regressions.
- Commit after every task with `git add <files> && git commit -m "..."`.

## Scope note (what's deliberately NOT in this plan)

The review surfaced 21 findings. This plan covers 19 of them as Tasks 1–19 below, ordered by real-world blast radius: money/ownership bugs first, then the PII regression, then correctness bugs, then efficiency/cleanup. Two findings are deliberately deferred to a separate, lower-risk follow-up plan because they are independent of everything here and not worth gating these fixes on:

- SSE notification-stream polling backoff (`src/app/api/notifications/stream/route.ts`) — a scaling concern, not a bug.
- The remaining pure-cosmetic duplication (grade-dropdown loop in `UploadCard.tsx`, `cartStatus` boolean repetition in `BuyBox.tsx`, offers-GET price-mapping helper, `getLanguageChip` reuse in `cart/page.tsx`, and the org-wide migration of all 22 `getServerSession` call sites to a shared `requireAuth()` wrapper beyond the two files this plan already touches for other reasons).

---

## Phase 1 — Money & Ownership Integrity

*Why this phase is first: these bugs can cause a buyer to be charged for a card they never receive, a seller's card to be sold twice, or an auction to silently erase a paid sale. Everything here gets its own failing test before the fix, per the user's explicit request for extra rigor on payment/ownership code.*

### Task 1: Block offer-accept while the card is in an active auction

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts:125-138`
- Test: `src/__tests__/api/offers/patch-offer.test.ts`

**Interfaces:**
- No new exports. `prisma.card.findUnique` in the accept flow now also selects `inAuction`.

- [ ] **Step 1: Write the failing test**

Add to the `describe("PATCH /api/offers/[id] — accept", ...)` block in `src/__tests__/api/offers/patch-offer.test.ts`, right after the existing "Buy Now reservation guard" test:

```ts
  // ── Auction guard ──────────────────────────────────────────────────────────

  // What's being tested: a card that's mid-auction must not also be sellable
  // via an accepted offer — settleAuction() would later silently overwrite
  // the ownership transfer this accept just performed (double-sale bug).

  it("returns 409 when the card is currently in an active auction", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({
      reservedById: null,
      reservedUntil: null,
      inAuction: true,
    });

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is currently in an active auction" });

    // PI capture must NOT be called — money must not move while the card is
    // locked in an auction.
    expect(mockStripeInstance.paymentIntents.capture).not.toHaveBeenCalled();
  });
```

Also update the `beforeEach` default two lines above (so every *other* test in the file keeps passing with the new field present):

```ts
    // Default: card is NOT reserved and NOT in an auction
    mockPrisma.card.findUnique.mockResolvedValue({ reservedById: null, reservedUntil: null, inAuction: false });
```

(This replaces the existing line `mockPrisma.card.findUnique.mockResolvedValue({ reservedById: null, reservedUntil: null });` in that same `beforeEach`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/offers/patch-offer.test.ts -t "active auction"`
Expected: FAIL — actual status is 200 (capture proceeds), not 409.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/offers/[id]/route.ts`, replace lines 125–138:

```ts
      const currentCard = await prisma.card.findUnique({
        where: { id: cardId },
        select: { reservedById: true, reservedUntil: true },
      });
      if (
        currentCard?.reservedById &&
        currentCard.reservedUntil &&
        currentCard.reservedUntil > new Date()
      ) {
        return NextResponse.json(
          { error: "Card is currently reserved by a pending checkout" },
          { status: 409 }
        );
      }
```

with:

```ts
      const currentCard = await prisma.card.findUnique({
        where: { id: cardId },
        select: { reservedById: true, reservedUntil: true, inAuction: true },
      });
      if (
        currentCard?.reservedById &&
        currentCard.reservedUntil &&
        currentCard.reservedUntil > new Date()
      ) {
        return NextResponse.json(
          { error: "Card is currently reserved by a pending checkout" },
          { status: 409 }
        );
      }
      // A card mid-auction must not also be sellable via an accepted offer —
      // settleAuction() transfers ownership unconditionally when the auction
      // ends, which would silently overwrite this accept's transfer.
      if (currentCard?.inAuction) {
        return NextResponse.json(
          { error: "Card is currently in an active auction" },
          { status: 409 }
        );
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/offers/patch-offer.test.ts`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offers/[id]/route.ts src/__tests__/api/offers/patch-offer.test.ts
git commit -m "fix: block offer-accept while card is in an active auction"
```

---

### Task 2: Block starting an auction while the card has a pending offer

**Files:**
- Modify: `src/app/api/auctions/route.ts:181-198`
- Test: `src/__tests__/api/auctions/create.test.ts`

**Interfaces:**
- No new exports. Adds one `prisma.offer.findFirst` call to `POST /api/auctions`.

- [ ] **Step 1: Write the failing test**

Add `offer: { findFirst: vi.fn() }` to the hoisted `mockPrisma` in `src/__tests__/api/auctions/create.test.ts`:

```ts
const mockPrisma = vi.hoisted(() => ({
  card:    { findUnique: vi.fn(), update: vi.fn() },
  auction: { create: vi.fn() },
  offer:   { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
```

Add a default in `beforeEach` (so the other tests, which don't care about this guard, keep passing):

```ts
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret";
  mockPrisma.offer.findFirst.mockResolvedValue(null); // default: no pending offer
});
```

Add a new test after `"returns 409 when card is already in auction"`:

```ts
  // What's being tested: a card with a pending offer must not also be
  // auctionable — the seller could accept that offer mid-auction and
  // settleAuction() would later overwrite the transfer when the auction ends
  // (the other half of the double-sale bug fixed in offers/[id]/route.ts).

  it("returns 409 when card has a pending offer", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    mockPrisma.offer.findFirst.mockResolvedValue({ id: "offer-1" });

    const res = await POST(postReq({ cardId: "card-1", startingBid: 5, durationDays: 3 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/pending offer/i);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts -t "pending offer"`
Expected: FAIL — the route creates the auction anyway (201), and `mockPrisma.offer.findFirst` doesn't even exist as a call the route makes yet.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/auctions/route.ts`, after the existing card checks (lines 187–198) and before "── 4 & 5. Create auction + lock card":

```ts
    if (card.inAuction) {
      return NextResponse.json(
        { error: "This card already has an active auction" },
        { status: 409 }
      );
    }

    // A card with a pending offer must not also be auctionable — see the
    // matching guard in offers/[id]/route.ts's accept flow for the other
    // half of this race.
    const pendingOffer = await prisma.offer.findFirst({
      where: { cardId, status: "pending", archivedAt: null },
      select: { id: true },
    });
    if (pendingOffer) {
      return NextResponse.json(
        { error: "This card has a pending offer — resolve it before starting an auction" },
        { status: 409 }
      );
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/route.ts src/__tests__/api/auctions/create.test.ts
git commit -m "fix: block starting an auction while the card has a pending offer"
```

---

### Task 3: Block re-listing a card for sale while it's in an active auction

**Files:**
- Modify: `src/app/api/cards/[id]/route.ts:63-107`
- Test: Create `src/__tests__/api/cards/put-card.test.ts`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/api/cards/put-card.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PUT /api/cards/[id]
 *
 * Owner-only update path: a card owner can toggle forSale/price on their own
 * card. Tests here cover the guard that blocks re-listing a card for sale
 * while it's locked in an active auction (POST /api/auctions sets
 * inAuction: true and forSale: false — this route must not let the owner
 * silently undo that via a separate PUT while bids are live).
 */

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn(), update: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() } })),
}));

import { PUT } from "@/app/api/cards/[id]/route";

const OWNER_SESSION = { user: { id: "owner-1", role: "user" } };

function putRequest(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request("http://localhost/api/cards/card-1", { method: "PUT", body });
}

const CARD = {
  id: "card-1",
  ownerId: "owner-1",
  price: 1000,
  forSale: true,
  inAuction: false,
};

describe("PUT /api/cards/[id] — owner update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(OWNER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    mockPrisma.card.update.mockResolvedValue({ ...CARD, price: 1500, forSale: true });
  });

  it("returns 409 when the owner tries to list a card for sale while it's in an active auction", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "Cannot list a card for sale while it is in an active auction",
    });
    expect(mockPrisma.card.update).not.toHaveBeenCalled();
  });

  it("allows unlisting (forSale: false) even while in an active auction", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({ ...CARD, inAuction: true, forSale: false });

    const res = await PUT(putRequest({ price: "", forSale: "false" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.card.update).toHaveBeenCalled();
  });

  it("allows the normal price/forSale update when not in an auction", async () => {
    const res = await PUT(putRequest({ price: "15", forSale: "true" }), { params: { id: "card-1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { price: 1500, forSale: true },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/cards/put-card.test.ts -t "active auction"`
Expected: FAIL — the route currently updates the card and returns 200 regardless of `inAuction`.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/cards/[id]/route.ts`, after the `forSale`/`price` parsing block (lines 85–93) and before `// Owner: only price + forSale` (line 95):

```ts
    // A card mid-auction must not be re-listed for sale through this path —
    // POST /api/auctions already set forSale: false and inAuction: true to
    // lock it. Allowing forSale: true here would let Buy Now/offers run
    // concurrently with live bids (the same double-sale class of bug fixed
    // in the offer-accept and auction-creation guards).
    if (forSale && card.inAuction) {
      return NextResponse.json(
        { error: "Cannot list a card for sale while it is in an active auction" },
        { status: 409 }
      );
    }

```

(inserted directly above the `// Owner: only price + forSale` comment; applies to both the owner and admin paths since both can flip `forSale`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/cards/put-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cards/\[id\]/route.ts src/__tests__/api/cards/put-card.test.ts
git commit -m "fix: block re-listing a card for sale while it's in an active auction"
```

---

### Task 4: Add a refund safety net when the offer-accept DB transaction fails after PI capture

**Files:**
- Modify: `src/app/api/offers/[id]/route.ts:156-238,292-298`
- Test: `src/__tests__/api/offers/patch-offer.test.ts`

**Interfaces:**
- No new exports. Mirrors the existing try/catch + `stripe.refunds.create` pattern already in `src/lib/auctionSettlement.ts:130-139`.

- [ ] **Step 1: Write the failing test**

Add `refunds: { create: vi.fn() }` to `mockStripeInstance` in `src/__tests__/api/offers/patch-offer.test.ts`:

```ts
const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: {
    capture: vi.fn(),
    cancel: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
}));
```

Add a default in the accept `beforeEach` (refund succeeds unless a test overrides it):

```ts
    mockStripeInstance.refunds.create.mockResolvedValue({ id: "re_123" });
```

Add a new test after the happy-path "captures PI, creates order..." test:

```ts
  // ── Refund safety net ─────────────────────────────────────────────────────

  // What's being tested: if the DB transaction throws AFTER the PI was
  // captured (money already moved), the route must issue a Stripe refund so
  // the buyer isn't charged for a card that never transferred — mirroring
  // the existing safety net in settleAuction() (lib/auctionSettlement.ts).

  it("refunds the buyer if the DB transaction fails after PI capture", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });

    expect(res.status).toBe(500);
    expect(mockStripeInstance.paymentIntents.capture).toHaveBeenCalledWith("pi_123");
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_123" });
  });

  it("still returns 500 (not a crash) if the compensating refund itself fails", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB exploded"));
    mockStripeInstance.refunds.create.mockRejectedValue(new Error("refund also failed"));

    const res = await PATCH(patchRequest({ action: "accept" }), { params: { id: "offer-1" } });

    expect(res.status).toBe(500);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/offers/patch-offer.test.ts -t "refunds the buyer"`
Expected: FAIL — `mockStripeInstance.refunds.create` is never called; the route just falls through to the generic 500 catch.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/offers/[id]/route.ts`, wrap the `$transaction` call (lines 159–234) in its own try/catch, mirroring `auctionSettlement.ts`:

```ts
      // ── 5. Atomic DB transaction ───────────────────────────────────────────
      // Everything below must either all succeed or all roll back.
      // We cannot have money captured but the card not transferred.
      let order;
      try {
        const result = await prisma.$transaction(async (tx) => {
          // 5a. Create an Order record to represent this sale.
          //     This links the offer, buyer, seller, and amount for history/display.
          const order = await tx.order.create({
            data: {
              cardId,
              sellerId: userId, // seller = card owner = current user
              buyerId: offer.buyerId,
              amount: offer.price!, // already in cents
              currency: "sgd",
              status: "PAID",
              stripePaymentIntentId: offer.paymentIntentId,
            },
          });

          // 5b. Mark the offer as paid and link it to the Order.
          //     "paid" is the final happy-path status — the buyer got the card.
          await tx.offer.update({
            where: { id: params.id },
            data: {
              status: "paid",
              orderId: order.id,
            },
          });

          // 5c. Archive ALL offers on this card (pending, rejected, expired, etc.)
          //     The card is now sold — neither the new owner nor old buyers should
          //     see these in their active views. History is preserved via archivedAt.
          await tx.offer.updateMany({
            where: { cardId, archivedAt: null },
            data: { archivedAt: new Date() },
          });

          // 5d. Transfer card ownership to the buyer.
          //     - ownerId changes to the buyer
          //     - forSale = false (card is sold, shouldn't appear in marketplace)
          //     - price = null (listing price is cleared — card has a new owner)
          //     - Clear any reservation fields (no longer needed)
          await tx.card.update({
            where: { id: cardId },
            data: {
              ownerId: offer.buyerId,
              forSale: false,
              price: null,
              reservedById: null,
              reservedUntil: null,
              reservedCheckoutSessionId: null,
            },
          });

          // 5e. Create a CardTransaction — permanent audit trail of who sold what,
          //     for how much, and which Stripe PI was used.
          //     (stripeEventId uses the PI id since there's no webhook event here)
          await tx.cardTransaction.create({
            data: {
              orderId: order.id,
              cardId,
              sellerId: userId,
              buyerId: offer.buyerId,
              amount: offer.price!,
              currency: "sgd",
              // Use the PI id as a unique key — there's one PI per offer,
              // so this prevents duplicate transaction records if PATCH is retried.
              stripeEventId: offer.paymentIntentId!,
              tcgPlayerId:
                (
                  await tx.card.findUnique({
                    where: { id: cardId },
                    select: { tcgPlayerId: true },
                  })
                )?.tcgPlayerId ?? undefined,
            },
          });

          return { order };
        });
        order = result.order;
      } catch (txErr) {
        // DB failed AFTER the PI was captured — refund the buyer so they're
        // not charged for a card that never transferred. Mirrors the same
        // safety net in lib/auctionSettlement.ts's settleAuction().
        console.error(
          "[offers PATCH] DB transaction failed after capture, issuing refund:",
          txErr
        );
        try {
          await stripe.refunds.create({ payment_intent: offer.paymentIntentId! });
        } catch (refundErr) {
          console.error(
            "[offers PATCH] Refund also failed — manual intervention required:",
            refundErr
          );
        }
        throw txErr;
      }
```

This replaces the original `const { order } = await prisma.$transaction(async (tx) => { ... });` block. Everything inside the transaction callback is unchanged — only the wrapping try/catch and the `let order` / `order = result.order` reassignment are new. The existing outer `catch (err)` at the bottom of the function (lines 292–298) is untouched — it still returns the generic 500 after this inner catch re-throws.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/offers/patch-offer.test.ts`
Expected: PASS — all tests, including the two new refund tests and the original happy-path test (which doesn't hit the catch branch).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offers/\[id\]/route.ts src/__tests__/api/offers/patch-offer.test.ts
git commit -m "fix: refund the buyer if the offer-accept DB transaction fails after PI capture"
```

---

### Task 5: Fix the Buy-Now reservation race that can get a paying buyer wrongly refunded

**Files:**
- Modify: `src/app/api/checkout/route.ts:59-98`
- Modify: `src/app/api/checkout/cart/route.ts:86-124`
- Test: `src/__tests__/api/checkout/route.test.ts`
- Test: `src/__tests__/api/checkout/cart.test.ts`

**Interfaces:**
- No new exports. The `reservedCheckoutSessionId: null` branch is removed from the reservation `updateMany`'s `OR` clause in both files — a card is now reservable only if it's *never* been reserved or its previous reservation has *expired*, closing the window where a second buyer could steal the slot between "reservation created" and "Stripe session id stamped."

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/api/checkout/route.test.ts`, in the "Race condition" section, right after the existing `"returns 500 when the card was just reserved by another buyer"` test:

```ts
  // What's being tested: the specific race this fix closes. Buyer A has
  // already reserved the card (reservedUntil is in the future) but their
  // Stripe session hasn't been created yet, so reservedCheckoutSessionId is
  // still null. Before the fix, the `{ reservedCheckoutSessionId: null }`
  // branch of the OR clause let Buyer B's updateMany match and steal the
  // reservation out from under Buyer A. After the fix, only an expired or
  // never-set reservedUntil allows a new reservation — an active
  // reservedUntil blocks Buyer B regardless of reservedCheckoutSessionId.

  it("does not let a second buyer steal a reservation that's active but not yet session-stamped", async () => {
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          // Simulates the real WHERE clause correctly rejecting Buyer B:
          // reservedUntil is in the future and reservedCheckoutSessionId is
          // null, but reservedCheckoutSessionId: null must no longer be a
          // standalone match branch.
          card: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
          order: { create: vi.fn() },
          user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(500);
  });

  it("reservation query no longer includes a standalone reservedCheckoutSessionId:null branch", async () => {
    let capturedWhere: any;
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          card: {
            updateMany: vi.fn().mockImplementation((args) => {
              capturedWhere = args.where;
              return Promise.resolve({ count: 1 });
            }),
          },
          order: { create: vi.fn().mockResolvedValue(MOCK_ORDER) },
          user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    await POST(makeRequest({ cardId: "card-1" }));

    expect(capturedWhere.OR).not.toContainEqual({ reservedCheckoutSessionId: null });
  });
```

Add the equivalent two tests to `src/__tests__/api/checkout/cart.test.ts` — read that file first to match its exact mock shape (the cart route's `$transaction` mock is the callback form only, looping per cart item), then adapt the same two assertions (0-count rejection when `reservedUntil` is active, and `capturedWhere.OR` not containing a standalone `reservedCheckoutSessionId: null`) against `tx.card.updateMany`'s captured `where` inside the per-item loop.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/checkout/route.test.ts -t "reservedCheckoutSessionId"`
Expected: FAIL on the second test — `capturedWhere.OR` currently *does* contain `{ reservedCheckoutSessionId: null }`.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/checkout/route.ts`, replace the `OR` clause (lines 72–76):

```ts
          OR: [
            { reservedUntil: null }, // Never reserved
            { reservedUntil: { lt: new Date() } }, // Previous reservation expired
            { reservedCheckoutSessionId: null }, // No active Stripe session
          ],
```

with:

```ts
          // A card is reservable only if it has never been reserved, or its
          // previous reservation has expired. The old third branch
          // (`reservedCheckoutSessionId: null`) let a second buyer steal an
          // *active* reservation during the window between "reservedUntil
          // set" and "Stripe session created" (reservedCheckoutSessionId is
          // only stamped after the session.create() call below returns) —
          // whoever's card.update ran last would win, and the webhook would
          // later refund whichever buyer actually completed payment.
          OR: [
            { reservedUntil: null }, // Never reserved
            { reservedUntil: { lt: new Date() } }, // Previous reservation expired
          ],
```

Apply the identical change to `src/app/api/checkout/cart/route.ts` lines 96–100.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/checkout/route.test.ts src/__tests__/api/checkout/cart.test.ts`
Expected: PASS — all tests in both files, including the pre-existing happy path and the two new tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/route.ts src/app/api/checkout/cart/route.ts \
  src/__tests__/api/checkout/route.test.ts src/__tests__/api/checkout/cart.test.ts
git commit -m "fix: close Buy-Now reservation-theft race that could wrongly refund a paying buyer"
```

---

### Task 6: Fix the NaN validation bypass on auction creation

**Files:**
- Modify: `src/app/api/auctions/route.ts:145-179`
- Test: `src/__tests__/api/auctions/create.test.ts`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/api/auctions/create.test.ts`, after the existing `"returns 400 when startingBid is zero"` test:

```ts
  // What's being tested: a non-numeric startingBid must be rejected with a
  // clean 400, not silently become NaN and reach prisma.auction.create
  // (which would throw a raw Prisma validation error, caught by the generic
  // catch and surfaced as an unhelpful 500).

  it("returns 400 when startingBid is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    const res = await POST(postReq({ cardId: "card-1", startingBid: "abc", durationDays: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/starting bid/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when reservePrice is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, reservePrice: "xyz", durationDays: 3,
    }));
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when buyOutPrice is not a number", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 5, buyOutPrice: "xyz", durationDays: 3,
    }));
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts -t "not a number"`
Expected: FAIL — `dollarsToCents(Number("abc"))` is `NaN`, `!startingBid` is `false` (non-empty string is truthy), and `NaN <= 0` is `false`, so the guard passes and the (mocked) transaction is called.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/auctions/route.ts`, replace lines 145–179:

```ts
    const startingBidCents = dollarsToCents(Number(startingBid));
    if (!startingBid || startingBidCents <= 0) {
      return NextResponse.json(
        { error: "Starting bid must be greater than $0" },
        { status: 400 }
      );
    }

    const days = Number(durationDays);
    if (!days || days < 1 || days > 6) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 6 days" },
        { status: 400 }
      );
    }

    const reservePriceCents = reservePrice != null ? dollarsToCents(Number(reservePrice)) : null;
    const buyOutPriceCents  = buyOutPrice  != null ? dollarsToCents(Number(buyOutPrice))  : null;

    if (reservePriceCents !== null && reservePriceCents < startingBidCents) {
      return NextResponse.json(
        { error: "Reserve price must be at least the starting bid" },
        { status: 400 }
      );
    }
    if (
      reservePriceCents !== null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents <= reservePriceCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be higher than the reserve price" },
        { status: 400 }
      );
    }
```

with:

```ts
    // Number.isNaN checks come BEFORE the <= 0 comparisons below —
    // `NaN <= 0` and `!amount` (for a truthy non-numeric string) are both
    // `false`, so a non-numeric input would otherwise silently reach
    // prisma.auction.create as NaN and surface as a raw 500.
    const startingBidNum = Number(startingBid);
    if (!startingBid || Number.isNaN(startingBidNum)) {
      return NextResponse.json(
        { error: "Starting bid must be greater than $0" },
        { status: 400 }
      );
    }
    const startingBidCents = dollarsToCents(startingBidNum);
    if (startingBidCents <= 0) {
      return NextResponse.json(
        { error: "Starting bid must be greater than $0" },
        { status: 400 }
      );
    }

    const days = Number(durationDays);
    if (!durationDays || Number.isNaN(days) || days < 1 || days > 6) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 6 days" },
        { status: 400 }
      );
    }

    if (reservePrice != null && Number.isNaN(Number(reservePrice))) {
      return NextResponse.json({ error: "Reserve price must be a number" }, { status: 400 });
    }
    if (buyOutPrice != null && Number.isNaN(Number(buyOutPrice))) {
      return NextResponse.json({ error: "Buy-out price must be a number" }, { status: 400 });
    }

    const reservePriceCents = reservePrice != null ? dollarsToCents(Number(reservePrice)) : null;
    const buyOutPriceCents  = buyOutPrice  != null ? dollarsToCents(Number(buyOutPrice))  : null;

    if (reservePriceCents !== null && reservePriceCents < startingBidCents) {
      return NextResponse.json(
        { error: "Reserve price must be at least the starting bid" },
        { status: 400 }
      );
    }
    if (
      reservePriceCents !== null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents <= reservePriceCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be higher than the reserve price" },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts`
Expected: PASS — all tests, including the pre-existing zero/missing-bid tests (unchanged behavior for those) and the three new NaN tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/route.ts src/__tests__/api/auctions/create.test.ts
git commit -m "fix: reject non-numeric auction bid/price inputs instead of letting them become NaN"
```

---

### Task 7: Fix the buyOutPrice-below-startingBid gap when no reservePrice is set

**Files:**
- Modify: `src/app/api/auctions/route.ts` (same validation block touched in Task 6)
- Test: `src/__tests__/api/auctions/create.test.ts`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/api/auctions/create.test.ts`, after the existing `"returns 400 when buyOutPrice <= reservePrice"` test:

```ts
  // What's being tested: the existing buyOutPrice <= reservePrice check only
  // runs when reservePrice is set. Without a reserve, buyOutPrice must still
  // be validated against startingBid — otherwise the very first legal bid
  // (>= startingBid) can force an instant settlement below the seller's
  // intended buy-out floor.

  it("returns 400 when buyOutPrice is below startingBid and no reservePrice is set", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 50, buyOutPrice: 10, durationDays: 3,
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/buy-out/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows buyOutPrice equal to startingBid when no reservePrice is set", async () => {
    mockGetServerSession.mockResolvedValue(SELLER_SESSION);
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    const dbAuction = makeDbAuction({ startingBid: 5000, buyOutPrice: 5000 });
    mockPrisma.$transaction.mockResolvedValue([dbAuction]);
    const res = await POST(postReq({
      cardId: "card-1", startingBid: 50, buyOutPrice: 50, durationDays: 3,
    }));
    expect(res.status).toBe(201);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts -t "no reservePrice is set"`
Expected: FAIL on the first new test — `buyOutPrice=10 < startingBid=50` currently passes validation and reaches `$transaction` (201).

- [ ] **Step 3: Write minimal implementation**

In the same validation block from Task 6, add a check right after the existing `buyOutPriceCents <= reservePriceCents` block:

```ts
    if (
      reservePriceCents !== null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents <= reservePriceCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be higher than the reserve price" },
        { status: 400 }
      );
    }
    // Without a reserve price, buyOutPrice must still be at least the
    // starting bid — otherwise the first legal bid (>= startingBid) would
    // trigger an instant buy-out settlement below the seller's intended floor.
    if (
      reservePriceCents === null &&
      buyOutPriceCents  !== null &&
      buyOutPriceCents  < startingBidCents
    ) {
      return NextResponse.json(
        { error: "Buy-out price must be at least the starting bid" },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/auctions/create.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auctions/route.ts src/__tests__/api/auctions/create.test.ts
git commit -m "fix: reject buyOutPrice below startingBid when no reservePrice is set"
```

---

## ✅ CHECKPOINT 1 — Money & Ownership Integrity

Before moving to Phase 2:

1. Run the full suite: `pnpm test`. All tests must pass, not just the ones touched above.
2. Re-read the diff for Tasks 1–7 (`git diff main` or equivalent) end to end — this phase touches live payment/ownership code, so a second look before moving on is worth the five minutes.
3. Confirm no task accidentally changed a response shape or status code for an *existing* passing test (the test run in step 1 is the real check, but skim the diff for anything outside the intended `if` blocks).
4. **Stop and report to the user here before continuing to Phase 2.**

---

## Phase 2 — PII Regression

*Why this phase is second: real user emails are actively leaking to anonymous visitors right now. Lower engineering risk than Phase 1 (pure data-shape change, no payment logic), but high real-world urgency.*

### Task 8: Remove card-owner email from `home/featured`, `watchlist`, and `cart` responses

**Files:**
- Modify: `src/app/api/home/featured/route.ts:50-53`
- Modify: `src/app/api/watchlist/route.ts:20-30`
- Modify: `src/app/api/cart/route.ts:17-42,62-69`
- Test: Create `src/__tests__/api/home/featured.test.ts`
- Test: `src/__tests__/api/watchlist/route.test.ts`
- Test: `src/__tests__/api/cart/route.test.ts`

**Interfaces:**
- No new exports. `owner` select shrinks from `{ id, username, email }` to `{ id, username }` in all three files, matching the pattern already used correctly in `src/app/api/cards/route.ts` and `src/app/api/cards/[id]/route.ts`.

- [ ] **Step 1: Write the failing test (watchlist)**

Add to `src/__tests__/api/watchlist/route.test.ts`, after the existing `"returns watchlisted cards with prices converted..."` test:

```ts
  // What's being tested: the card owner's email must never reach the
  // response. Commit 6410447 already fixed this for /api/cards and
  // /api/cards/[id] — this route was missed. Watchlisting a card requires
  // no relationship with the seller, so there's no reason to expose it.

  it("never includes the card owner's email in the response", async () => {
    mockPrisma.cardWatchlist.findMany.mockResolvedValueOnce([
      makeWatchlistEntry("c1", 1000),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.cards[0].owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(body.cards[0].owner.email).toBeUndefined();
  });
```

- [ ] **Step 2: Write the failing test (cart)**

Add to the `describe("GET /api/cart", ...)` block in `src/__tests__/api/cart/route.test.ts`:

```ts
  // What's being tested: the card owner's email must never reach the
  // response, and the sellerName fallback must not silently read it either
  // now that email is no longer selected.

  it("never includes the card owner's email, and falls back sellerName to 'Seller' if username is missing", async () => {
    mockPrisma.cart.upsert.mockResolvedValue({
      items: [
        {
          id: "item-1",
          selected: true,
          createdAt: new Date("2025-01-01"),
          card: {
            id: "card-1",
            title: "Charizard",
            price: 5000,
            condition: "NM",
            imageUrls: [],
            language: "English",
            setName: "Base Set",
            rarity: "Rare",
            cardNumber: "004",
            forSale: true,
            tcgPlayerId: null,
            owner: { id: "owner-1", username: "Ash" },
          },
        },
      ],
    });

    const res = await GET();
    const body = await res.json();

    const owner = body.packages[0].items[0].card.owner;
    expect(owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(owner.email).toBeUndefined();
    expect(body.packages[0].sellerName).toBe("Ash");
  });
```

- [ ] **Step 3: Write the failing test (home/featured — new file)**

Create `src/__tests__/api/home/featured.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/home/featured
 *
 * Public, unauthenticated homepage data source (best sellers, highest
 * transacted, newly listed, auctions ending soon). Because it has no auth
 * check at all, it must never include a card owner's email — anyone can
 * curl this endpoint. Commit 6410447 fixed the equivalent leak on
 * /api/cards and /api/cards/[id]; this route was missed.
 */

const mockPrisma = vi.hoisted(() => ({
  bestSeller: { findMany: vi.fn() },
  card: { findFirst: vi.fn(), findMany: vi.fn() },
  auction: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/home/featured/route";

function makeCard(overrides: Partial<any> = {}) {
  return {
    id: "card-1",
    title: "Charizard",
    price: 1000,
    forSale: true,
    tcgPlayerId: "tcg-1",
    binder: null,
    owner: { id: "owner-1", username: "Ash" },
    ...overrides,
  };
}

describe("GET /api/home/featured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bestSeller.findMany.mockResolvedValue([{ tcgPlayerId: "tcg-1" }]);
    mockPrisma.card.findFirst.mockResolvedValue(makeCard());
    mockPrisma.$queryRaw.mockResolvedValue([{ tcgPlayerId: "tcg-1", count: 3n }]);
    mockPrisma.card.findMany.mockResolvedValue([makeCard()]);
    mockPrisma.auction.findMany.mockResolvedValue([]);
  });

  it("never includes the card owner's email in bestSellers, highestTransacted, or newlyListed", async () => {
    const res = await GET();
    const body = await res.json();

    for (const list of [body.bestSellers, body.highestTransacted, body.newlyListed]) {
      for (const card of list) {
        expect(card.owner).toEqual({ id: "owner-1", username: "Ash" });
        expect(card.owner.email).toBeUndefined();
      }
    }
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test src/__tests__/api/home/featured.test.ts src/__tests__/api/watchlist/route.test.ts src/__tests__/api/cart/route.test.ts`
Expected: FAIL — `owner.email` is currently present (`"ash@pkmn.com"` etc.) in all three.

- [ ] **Step 5: Write minimal implementation**

In `src/app/api/home/featured/route.ts`, replace lines 50–53:

```ts
const cardInclude = {
  owner: { select: { id: true, username: true, email: true } },
  binder: true,
};
```

with:

```ts
const cardInclude = {
  // Public, unauthenticated endpoint — email deliberately excluded, same
  // rationale as src/app/api/cards/route.ts and cards/[id]/route.ts.
  owner: { select: { id: true, username: true } },
  binder: true,
};
```

In `src/app/api/watchlist/route.ts`, replace line 25:

```ts
          owner: { select: { id: true, username: true, email: true } },
```

with:

```ts
          // Watchlisting a card requires no relationship with the seller —
          // email deliberately excluded, same rationale as cards/route.ts.
          owner: { select: { id: true, username: true } },
```

In `src/app/api/cart/route.ts`, replace line 35:

```ts
              owner: { select: { id: true, username: true, email: true } },
```

with:

```ts
              // Adding to cart requires no relationship with the seller yet —
              // email deliberately excluded, same rationale as cards/route.ts.
              owner: { select: { id: true, username: true } },
```

The same file uses `item.card.owner.email` as a fallback for `sellerName` at line 64 (`item.card.owner.username ?? item.card.owner.email`). Since `email` is no longer selected, replace that line with:

```ts
    const sellerName = item.card.owner.username ?? "Seller";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test src/__tests__/api/home/featured.test.ts src/__tests__/api/watchlist/route.test.ts src/__tests__/api/cart/route.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `pnpm test`
Expected: PASS. (Check specifically that no other cart test asserted on `owner.email` being present — if one does, update its fixture/assertion to match the new shape rather than skip it.)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/home/featured/route.ts src/app/api/watchlist/route.ts src/app/api/cart/route.ts \
  src/__tests__/api/home/featured.test.ts src/__tests__/api/watchlist/route.test.ts src/__tests__/api/cart/route.test.ts
git commit -m "fix: stop leaking card owner email via home/featured, watchlist, and cart endpoints"
```

---

## ✅ CHECKPOINT 2 — PII Regression

1. Run `pnpm test`.
2. Grep for any other stray `email: true` inside an `owner`/`buyer`/`seller` select across `src/app/api/**` to confirm no fourth sibling was missed: `grep -rn "email: true" src/app/api`. Cross-check each hit against whether the viewer has an actual transactional relationship with that user (an offer was placed, or an order exists) — those are legitimate and should stay; anything reachable by an anonymous or unrelated viewer is not.
3. **Stop and report to the user here before continuing to Phase 3.**

---

## Phase 3 — Correctness Bugs

*Why this phase is third: real bugs with real user impact (wrong prices shown, silently duplicated logic that can regress a fixed security bug, a stale-fetch UI bug, missing icons, a badge counter drifting), but none of them move money or leak data.*

### Task 9: Fix `mapConditionToAPI` to recognize CGC/SGC/Beckett grades, not just PSA

**Files:**
- Modify: `src/app/utils/mapCondition.ts`
- Test: Create `src/__tests__/lib/mapCondition.test.ts`

**Interfaces:**
- `mapConditionToAPI(condition: string): ConditionMapping` — signature unchanged. `ConditionMapping` type unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/mapCondition.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapConditionToAPI } from "@/app/utils/mapCondition";

/**
 * mapConditionToAPI classifies a card's condition string into either a
 * graded lookup (for the price chart's graded-price data) or a raw lookup
 * (ungraded market price). Before this fix, only "psa" was recognized as
 * graded — every CGC/SGC/Beckett-graded card silently fell through to
 * { type: "raw", key: "Near Mint" }, showing the wrong market chart data.
 */

describe("mapConditionToAPI", () => {
  it("classifies PSA grades as graded", () => {
    expect(mapConditionToAPI("PSA 10")).toEqual({ type: "graded", grade: "10" });
  });

  it("classifies CGC grades as graded", () => {
    expect(mapConditionToAPI("CGC 10 Pristine")).toEqual({
      type: "graded",
      grade: "cgc 10 pristine",
    });
  });

  it("classifies SGC grades as graded", () => {
    expect(mapConditionToAPI("SGC 9.5 Gem Mint")).toEqual({
      type: "graded",
      grade: "sgc 9.5 gem mint",
    });
  });

  it("classifies Beckett grades as graded", () => {
    expect(mapConditionToAPI("Beckett 9 Mint")).toEqual({
      type: "graded",
      grade: "beckett 9 mint",
    });
  });

  it("still classifies raw conditions correctly", () => {
    expect(mapConditionToAPI("Near Mint")).toEqual({ type: "raw", key: "Near Mint" });
    expect(mapConditionToAPI("Lightly Played")).toEqual({ type: "raw", key: "Lightly Played" });
    expect(mapConditionToAPI("Damaged")).toEqual({ type: "raw", key: "Damaged" });
  });

  it("falls back to raw Near Mint for an unrecognized string", () => {
    expect(mapConditionToAPI("???")).toEqual({ type: "raw", key: "Near Mint" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/lib/mapCondition.test.ts -t "CGC"`
Expected: FAIL — `mapConditionToAPI("CGC 10 Pristine")` currently returns `{ type: "raw", key: "Near Mint" }`.

- [ ] **Step 3: Write minimal implementation**

Replace `src/app/utils/mapCondition.ts` lines 7–36:

```ts
export function mapConditionToAPI(condition: string): ConditionMapping {
  const c = condition.toLowerCase();

  // Graded cards (PSA…)
  if (c.includes("psa")) {
    return {
      type: "graded",
      grade: c.replace("psa", "").trim(), // "10", "9", "8.5"
    };
  }

  if (c.includes("near") || c.includes("nm")) {
    return { type: "raw", key: "Near Mint" };
  }
  if (c.includes("light") || c.includes("lp")) {
    return { type: "raw", key: "Lightly Played" };
  }
  if (c.includes("moderate") || c.includes("mp")) {
    return { type: "raw", key: "Moderately Played" };
  }
  if (c.includes("heavy") || c.includes("hp")) {
    return { type: "raw", key: "Heavily Played" };
  }
  if (c.includes("damaged") || c.includes("poor")) {
    return { type: "raw", key: "Damaged" };
  }

  // Default fallback
  return { type: "raw", key: "Near Mint" };
}
```

with:

```ts
// Any of these substrings identifies a graded (not raw) card. Kept in sync
// with the grading companies in src/constants/grades.ts.
const GRADING_COMPANY_MARKERS = ["psa", "cgc", "sgc", "beckett"];

export function mapConditionToAPI(condition: string): ConditionMapping {
  const c = condition.toLowerCase();

  const gradingCompany = GRADING_COMPANY_MARKERS.find((marker) => c.includes(marker));
  if (gradingCompany) {
    return {
      type: "graded",
      grade: gradingCompany === "psa" ? c.replace("psa", "").trim() : c,
    };
  }

  if (c.includes("near") || c.includes("nm")) {
    return { type: "raw", key: "Near Mint" };
  }
  if (c.includes("light") || c.includes("lp")) {
    return { type: "raw", key: "Lightly Played" };
  }
  if (c.includes("moderate") || c.includes("mp")) {
    return { type: "raw", key: "Moderately Played" };
  }
  if (c.includes("heavy") || c.includes("hp")) {
    return { type: "raw", key: "Heavily Played" };
  }
  if (c.includes("damaged") || c.includes("poor")) {
    return { type: "raw", key: "Damaged" };
  }

  // Default fallback
  return { type: "raw", key: "Near Mint" };
}
```

Note: PSA keeps its existing `grade` shape (just the number, e.g. `"10"`) so no downstream PSA consumer (`CardMarketChart.tsx`) changes behavior. CGC/SGC/Beckett now return the full lowercased condition string as `grade` — check `src/app/shared-components/cards/CardMarketChart.tsx`'s graded-price lookup to confirm it can key on this (it likely needs a matching lookup table entry per exact grade string on the pricing-data side; if `cardData.priceHistory.conditions` doesn't yet have CGC/SGC/Beckett keys, that's a pricing-data completeness gap outside this fix's scope — the classification bug is what this task fixes, not the presence of graded price data for every company).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/lib/mapCondition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/mapCondition.ts src/__tests__/lib/mapCondition.test.ts
git commit -m "fix: classify CGC/SGC/Beckett grades as graded in mapConditionToAPI"
```

---

### Task 10: Extract a shared `verifyPaymentIntentAmountOrRespond` helper (dedup, no behavior change)

**Files:**
- Create: `src/lib/paymentIntentGuard.ts`
- Modify: `src/app/api/offers/route.ts:261-280`
- Modify: `src/app/api/auctions/[id]/bid/route.ts:124-135`
- Test: Create `src/__tests__/lib/paymentIntentGuard.test.ts`

**Interfaces:**
- Produces: `verifyPaymentIntentAmountOrRespond(stripe: Stripe, paymentIntentId: string, authorisedAmountCents: number, claimedAmountCents: number, entityLabel: "Offer" | "Bid"): Promise<NextResponse | null>` — returns `null` when the amounts match (caller proceeds); returns a ready-to-return `NextResponse` (400, PI already cancelled) when they don't.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/paymentIntentGuard.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { verifyPaymentIntentAmountOrRespond } from "@/lib/paymentIntentGuard";

/**
 * verifyPaymentIntentAmountOrRespond — the PI-amount cross-check that closes
 * the price-tampering bug fixed in commit 8401551. Previously hand-copied
 * identically into offers/route.ts and bid/route.ts; extracted here so a
 * future payment-accepting route can reuse it instead of hand-copying a
 * third time (and risking getting it wrong).
 */

function fakeStripe(cancelImpl: () => Promise<any> = () => Promise.resolve({})) {
  return { paymentIntents: { cancel: vi.fn(cancelImpl) } } as any;
}

describe("verifyPaymentIntentAmountOrRespond", () => {
  it("returns null when the authorised amount matches the claimed amount", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 5000, "Offer");
    expect(result).toBeNull();
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("cancels the PI and returns a 400 NextResponse when amounts mismatch", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Offer");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_123");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toBe("Offer amount does not match the authorised payment amount");
  });

  it("uses the entity label in the error message for bids", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Bid");
    const body = await result!.json();
    expect(body.error).toBe("Bid amount does not match the authorised payment amount");
  });

  it("still returns the 400 response even if cancelling the mismatched PI fails", async () => {
    const stripe = fakeStripe(() => Promise.reject(new Error("already cancelled")));
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Offer");
    expect(result!.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/lib/paymentIntentGuard.test.ts`
Expected: FAIL — the module doesn't exist yet (`Cannot find module '@/lib/paymentIntentGuard'`).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/paymentIntentGuard.ts`:

```ts
import type Stripe from "stripe";
import { NextResponse } from "next/server";

/**
 * verifyPaymentIntentAmountOrRespond — cross-checks that the amount a
 * PaymentIntent was actually authorised for matches the amount the client
 * is claiming (an offer price or a bid amount). Without this, a buyer could
 * authorise a small PI, then submit an arbitrarily larger claimed amount —
 * the DB would record the larger figure while Stripe only ever holds/
 * captures the smaller one. Fixed once already (commit 8401551) in both
 * offers/route.ts and bid/route.ts independently; centralized here so a
 * future payment-accepting route can reuse it instead of a third hand-copy.
 *
 * Returns `null` when the amounts match (caller proceeds normally).
 * Returns a ready-to-return NextResponse when they don't: the mismatched PI
 * is cancelled (best-effort — a cancel failure is logged, not thrown) and a
 * 400 response is built with an entity-specific error message.
 */
export async function verifyPaymentIntentAmountOrRespond(
  stripe: Stripe,
  paymentIntentId: string,
  authorisedAmountCents: number,
  claimedAmountCents: number,
  entityLabel: "Offer" | "Bid"
): Promise<NextResponse | null> {
  if (authorisedAmountCents === claimedAmountCents) return null;

  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (cancelErr) {
    console.warn(
      `[${entityLabel.toLowerCase()} amount guard] Could not cancel mismatched PI:`,
      paymentIntentId,
      cancelErr
    );
  }

  return NextResponse.json(
    { error: `${entityLabel} amount does not match the authorised payment amount` },
    { status: 400 }
  );
}
```

In `src/app/api/offers/route.ts`, replace lines 261–280:

```ts
    if (pi.amount !== priceInCents) {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (cancelErr) {
        console.warn(
          "[offers POST] Could not cancel mismatched PI:",
          paymentIntentId,
          cancelErr
        );
      }
      return NextResponse.json(
        { error: "Offer amount does not match the authorised payment amount" },
        { status: 400 }
      );
    }
```

with:

```ts
    const amountMismatch = await verifyPaymentIntentAmountOrRespond(
      stripe,
      paymentIntentId,
      pi.amount,
      priceInCents,
      "Offer"
    );
    if (amountMismatch) return amountMismatch;
```

Add the import at the top of the file: `import { verifyPaymentIntentAmountOrRespond } from "@/lib/paymentIntentGuard";`

In `src/app/api/auctions/[id]/bid/route.ts`, replace lines 129–135:

```ts
    if (pi.amount !== amountCents) {
      await cancelSafely(paymentIntentId);
      return NextResponse.json(
        { error: "Bid amount does not match the authorised payment amount" },
        { status: 400 }
      );
    }
```

with:

```ts
    const amountMismatch = await verifyPaymentIntentAmountOrRespond(
      stripe,
      paymentIntentId,
      pi.amount,
      amountCents,
      "Bid"
    );
    if (amountMismatch) return amountMismatch;
```

Add the same import. Leave the file's local `cancelSafely` function and its other call sites (lines 81, 85, 89, 96, 103, 190, 197) untouched — only this one mismatch check is being replaced.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/lib/paymentIntentGuard.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `pnpm test src/__tests__/api/offers/route.test.ts src/__tests__/api/auctions/bid.test.ts`
Expected: PASS — the response shape and status codes for the mismatch case are byte-identical to before, so any existing test covering this path should pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/paymentIntentGuard.ts src/app/api/offers/route.ts src/app/api/auctions/\[id\]/bid/route.ts \
  src/__tests__/lib/paymentIntentGuard.test.ts
git commit -m "refactor: extract shared verifyPaymentIntentAmountOrRespond helper"
```

---

### Task 11: Extract a shared `isAdminOrOwner` helper and apply it in `cards/[id]/route.ts`

**Files:**
- Modify: `src/lib/auth.ts` (add export, no changes to existing exports)
- Modify: `src/app/api/cards/[id]/route.ts:78-83`
- Test: Create `src/__tests__/lib/isAdminOrOwner.test.ts`

**Interfaces:**
- Produces: `isAdminOrOwner(session: { user?: { id?: string; role?: string | null } } | null | undefined, ownerId: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/isAdminOrOwner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAdminOrOwner } from "@/lib/auth";

describe("isAdminOrOwner", () => {
  it("returns true for an admin regardless of ownerId", () => {
    expect(isAdminOrOwner({ user: { id: "user-1", role: "admin" } }, "owner-1")).toBe(true);
  });

  it("returns true when the session user id matches ownerId", () => {
    expect(isAdminOrOwner({ user: { id: "owner-1", role: "user" } }, "owner-1")).toBe(true);
  });

  it("returns false for a non-admin, non-owner user", () => {
    expect(isAdminOrOwner({ user: { id: "user-1", role: "user" } }, "owner-1")).toBe(false);
  });

  it("returns false when there is no session", () => {
    expect(isAdminOrOwner(null, "owner-1")).toBe(false);
    expect(isAdminOrOwner(undefined, "owner-1")).toBe(false);
  });

  it("returns false when the session has no user id", () => {
    expect(isAdminOrOwner({ user: {} }, "owner-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/lib/isAdminOrOwner.test.ts`
Expected: FAIL — `isAdminOrOwner` is not exported from `@/lib/auth` yet.

- [ ] **Step 3: Write minimal implementation**

Add to the end of `src/lib/auth.ts` (after the closing `};` of `authOptions`, keeping every existing export untouched):

```ts

/**
 * isAdminOrOwner — the "can this user touch this resource" check used by
 * routes where BOTH an admin and the resource's owner may act (currently
 * just the owner/admin split in cards/[id]/route.ts PUT). Centralized so a
 * future route with the same admin-or-owner shape can reuse it instead of
 * hand-copying `session.user.role === "admin" || card.ownerId === session.user.id`
 * a third time — that hand-copying pattern is exactly how the two prior auth
 * gaps (commits f034471, 6410447) happened.
 *
 * NOT a drop-in replacement for owner-only checks (e.g. offers/[id]/route.ts's
 * accept/reject, which intentionally has no admin bypass) — only use this
 * where admin access is already an intended behavior.
 */
export function isAdminOrOwner(
  session: { user?: { id?: string; role?: string | null } } | null | undefined,
  ownerId: string
): boolean {
  if (!session?.user?.id) return false;
  return session.user.role === "admin" || session.user.id === ownerId;
}
```

In `src/app/api/cards/[id]/route.ts`, replace lines 78–83:

```ts
    const isAdmin = session.user.role === "admin";
    const isOwner = card.ownerId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
```

with:

```ts
    const isAdmin = session.user.role === "admin";

    if (!isAdminOrOwner(session, card.ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
```

(`isAdmin` is kept as its own variable — it's still read later at line 96 (`if (!isAdmin) { ... }`) to branch between the owner-only and admin-full-update paths; only the combined forbidden-check is deduplicated.) Add the import: `import { isAdminOrOwner } from "@/lib/auth";`

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/lib/isAdminOrOwner.test.ts src/__tests__/api/cards/put-card.test.ts`
Expected: PASS — including the Task 3 tests, unaffected by this dedup.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/cards/\[id\]/route.ts src/__tests__/lib/isAdminOrOwner.test.ts
git commit -m "refactor: extract shared isAdminOrOwner helper"
```

---

### Task 12: Reject zero/negative listing prices

**Files:**
- Modify: `src/app/api/cards/[id]/route.ts` (server-side, right after Task 3's guard)
- Modify: `src/app/shared-components/cards/EditPriceDialog.tsx:41-45`
- Modify: `src/app/upload/UploadCard.tsx:148-149`
- Test: `src/__tests__/api/cards/put-card.test.ts`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Write the failing test (server-side)**

Add to `src/__tests__/api/cards/put-card.test.ts`:

```ts
  it("returns 400 when forSale is true and price is zero", async () => {
    const res = await PUT(putRequest({ price: "0", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Price must be greater than $0 when listing a card for sale",
    });
    expect(mockPrisma.card.update).not.toHaveBeenCalled();
  });

  it("returns 400 when forSale is true and price is negative", async () => {
    const res = await PUT(putRequest({ price: "-5", forSale: "true" }), { params: { id: "card-1" } });
    expect(res.status).toBe(400);
    expect(mockPrisma.card.update).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/cards/put-card.test.ts -t "price is zero"`
Expected: FAIL — the route currently accepts `price: "0"`/`"-5"` and calls `prisma.card.update`.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/cards/[id]/route.ts`, right after the Task 3 guard (`if (forSale && card.inAuction) { ... }`), add:

```ts
    if (forSale && (price == null || price <= 0)) {
      return NextResponse.json(
        { error: "Price must be greater than $0 when listing a card for sale" },
        { status: 400 }
      );
    }
```

In `src/app/shared-components/cards/EditPriceDialog.tsx`, replace lines 41–45:

```ts
    if (forSale && (!price || Number.isNaN(Number(price)))) {
      setError("Enter a valid price.");
      return;
    }
```

with:

```ts
    if (forSale && (!price || Number.isNaN(Number(price)) || Number(price) <= 0)) {
      setError("Enter a valid price greater than $0.");
      return;
    }
```

In `src/app/upload/UploadCard.tsx`, replace lines 148–149:

```ts
    const priceRequiredButMissing =
      form.forSale && (!form.price || Number.isNaN(Number(form.price)));
```

with:

```ts
    const priceRequiredButMissing =
      form.forSale &&
      (!form.price || Number.isNaN(Number(form.price)) || Number(form.price) <= 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/api/cards/put-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Manually verify the two client dialogs**

There is no component-test harness in this repo (no React Testing Library/jsdom configured — `pnpm test` only exercises API routes and `src/lib`), so verify these two UI changes manually instead of writing a new test:

1. Load the `run` skill, start the dev server.
2. On a card you own, open "Edit price," toggle "List for sale" on, enter `0`, click Save → confirm the inline error "Enter a valid price greater than $0." appears and the request is not sent (check the Network tab).
3. Repeat with `-5`.
4. On the Upload Card page, toggle "For sale," enter `0` in price, attempt to submit → confirm the same class of validation blocks submission.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cards/\[id\]/route.ts src/app/shared-components/cards/EditPriceDialog.tsx \
  src/app/upload/UploadCard.tsx src/__tests__/api/cards/put-card.test.ts
git commit -m "fix: reject zero/negative listing prices server-side and client-side"
```

---

### Task 13: Fix the stale-fetch race on the card detail page

**Files:**
- Modify: `src/app/cards/[id]/page.tsx:68-123`

**Interfaces:**
- No new exports. Internal component change only.

- [ ] **Step 1: Write the implementation**

There's no test harness for this component (see Task 12, Step 5) and the bug only manifests on rapid client-side navigation between two `/cards/[id]` routes, which isn't something the existing Vitest/API-mock setup can exercise — this is a direct fix + manual verification, matching how the codebase already handles frontend-only changes.

Replace the three effects at `src/app/cards/[id]/page.tsx:68-123`:

```tsx
  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      // 1. Reset error state and start loading.
      setCardErrorType(null);
      setLoading(true);
      try {
        // 2. Fetch card.
        const res = await fetch(`/api/cards/${id}`);
        if (!res.ok) {
          // 3. Classify the error so the render branch shows the right message.
          const data = await res.json().catch(() => ({}));
          console.error("Error loading card:", data.error ?? res.status);
          setCardErrorType(res.status === 404 ? "not_found" : "error");
          return;
        }
        const data = await res.json();
        const fetchedCard: CardItem = data.card;
        // 4. Set card state.
        setCard(fetchedCard);
        setWatchlisted(fetchedCard.watchlistedByUser ?? false);
        setWatchlistCount(fetchedCard.watchlistCount ?? 0);
        // 5. If the card is in an auction, fetch it now (same tick → no flicker).
        if (fetchedCard.inAuction === true) {
          const aRes = await fetch(`/api/auctions?cardId=${encodeURIComponent(id)}`);
          const aData = await aRes.json().catch(() => ({}));
          if (aData.auction) setAuction(aData.auction);
        }
      } catch (err) {
        console.error("Failed to fetch card:", err);
        setCardErrorType("error");
      } finally {
        // 6. Always clear loading once all fetches are done.
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  // Fetch the viewer's own offer on this card (non-owners only)
  useEffect(() => {
    if (!id || !userId) return;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}&myOffer=true`)
      .then((r) => r.json())
      .then((data) => { if ("offer" in data) setActiveOffer(data.offer); })
      .catch(() => {});
  }, [id, userId]);

  // Fetch offer count for owner's button label
  useEffect(() => {
    if (!id || !userId) return;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.offers) setOffersCount(data.offers.length); })
      .catch(() => {});
  }, [id, userId]);
```

with:

```tsx
  useEffect(() => {
    if (!id) return;
    // Next.js App Router reuses this component instance across sibling
    // /cards/[id] navigations — it does NOT necessarily unmount. Without a
    // "is this fetch still for the current id" guard, a slow in-flight fetch
    // for the PREVIOUS card can resolve after the user has already navigated
    // to a new card and overwrite that new card's state.
    let isCurrent = true;
    const fetchAll = async () => {
      // 1. Reset error state and start loading.
      setCardErrorType(null);
      setLoading(true);
      try {
        // 2. Fetch card.
        const res = await fetch(`/api/cards/${id}`);
        if (!isCurrent) return;
        if (!res.ok) {
          // 3. Classify the error so the render branch shows the right message.
          const data = await res.json().catch(() => ({}));
          console.error("Error loading card:", data.error ?? res.status);
          setCardErrorType(res.status === 404 ? "not_found" : "error");
          return;
        }
        const data = await res.json();
        const fetchedCard: CardItem = data.card;
        // 4. Set card state.
        setCard(fetchedCard);
        setWatchlisted(fetchedCard.watchlistedByUser ?? false);
        setWatchlistCount(fetchedCard.watchlistCount ?? 0);
        // 5. If the card is in an auction, fetch it now (same tick → no flicker).
        if (fetchedCard.inAuction === true) {
          const aRes = await fetch(`/api/auctions?cardId=${encodeURIComponent(id)}`);
          const aData = await aRes.json().catch(() => ({}));
          if (isCurrent && aData.auction) setAuction(aData.auction);
        }
      } catch (err) {
        if (!isCurrent) return;
        console.error("Failed to fetch card:", err);
        setCardErrorType("error");
      } finally {
        // 6. Always clear loading once all fetches are done, but only for
        //    the id this effect run was fetching.
        if (isCurrent) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  // Fetch the viewer's own offer on this card (non-owners only)
  useEffect(() => {
    if (!id || !userId) return;
    let isCurrent = true;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}&myOffer=true`)
      .then((r) => r.json())
      .then((data) => { if (isCurrent && "offer" in data) setActiveOffer(data.offer); })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [id, userId]);

  // Fetch offer count for owner's button label
  useEffect(() => {
    if (!id || !userId) return;
    let isCurrent = true;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (isCurrent && data.offers) setOffersCount(data.offers.length); })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [id, userId]);
```

(A boolean flag is used rather than `AbortController` here because these responses are consumed via `.json()` either way — the abort would only save the network round trip, not change correctness, and a flag is simpler to review for three near-identical effects.)

- [ ] **Step 2: Manually verify**

Via the `run` skill: open a card detail page, then rapidly click through 2–3 "other listings" links before the first page finishes loading. Confirm the final page always shows the card matching the current URL, never a flash of stale data from a previous card.

- [ ] **Step 3: Commit**

```bash
git add src/app/cards/\[id\]/page.tsx
git commit -m "fix: stale-fetch race on card detail page during rapid navigation"
```

---

### Task 14: Extract shared `transferCardOwnership`/`notifySellerCardSold` helpers for the Stripe webhook

**Files:**
- Create: `src/lib/webhookHelpers.ts`
- Modify: `src/app/api/stripe/webhook/route.ts:355-376,414-429,520-528,543-556`
- Test: Create `src/__tests__/lib/webhookHelpers.test.ts`

**Interfaces:**
- Produces: `transferCardOwnership(tx: Prisma.TransactionClient, params: { cardId: string; checkoutSessionId: string; buyerId: string }): Promise<number>` — returns the number of rows the concurrency-guarded `updateMany` actually matched (0 or 1); callers decide how to react (they currently throw with slightly different log messages, which stays caller-side).
- Produces: `notifySellerCardSold(params: { sellerId: string; cardId: string; orderId: string }): void` — fire-and-forget, never throws.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/webhookHelpers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() },
}));
const mockNotifyAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync, createNotification: vi.fn() }));

import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";

describe("transferCardOwnership", () => {
  it("runs the concurrency-guarded updateMany with the expected where/data shape", async () => {
    const tx = { card: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const count = await transferCardOwnership(tx as any, {
      cardId: "card-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(1);
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        reservedCheckoutSessionId: "cs_123",
        reservedById: "buyer-1",
        forSale: true,
      },
      data: {
        ownerId: "buyer-1",
        forSale: false,
        price: null,
        reservedById: null,
        reservedUntil: null,
        reservedCheckoutSessionId: null,
        binderId: null,
      },
    });
  });

  it("returns 0 when the card was already transferred/released by another process", async () => {
    const tx = { card: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    const count = await transferCardOwnership(tx as any, {
      cardId: "card-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(0);
  });
});

describe("notifySellerCardSold", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up the card title and fires a card_sold notification", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({ title: "Charizard" });

    notifySellerCardSold({ sellerId: "seller-1", cardId: "card-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget chain resolve

    expect(mockNotifyAsync).toHaveBeenCalledWith({
      userId: "seller-1",
      type: "card_sold",
      title: "Your card was sold",
      body: 'Your card "Charizard" was purchased via Buy Now.',
      cardId: "card-1",
      orderId: "order-1",
    });
  });

  it("never throws even if the card lookup fails", async () => {
    mockPrisma.card.findUnique.mockRejectedValue(new Error("db down"));
    expect(() =>
      notifySellerCardSold({ sellerId: "seller-1", cardId: "card-1", orderId: "order-1" })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/lib/webhookHelpers.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/webhookHelpers.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAsync } from "@/lib/notifications";

/**
 * transferCardOwnership — the concurrency-guarded ownership transfer shared
 * by handleCartSessionCompleted and handleSingleSessionCompleted in the
 * Stripe webhook. The WHERE clause only matches if the card is still
 * reserved by this exact checkout session and buyer; if another process
 * already transferred or released it, the count comes back 0 and the caller
 * throws to roll back its transaction (triggering the refund safeguard).
 *
 * Returns the row count rather than throwing itself — the two callers log
 * slightly different messages on failure, which stays their responsibility.
 */
export async function transferCardOwnership(
  tx: Prisma.TransactionClient,
  params: { cardId: string; checkoutSessionId: string; buyerId: string }
): Promise<number> {
  const moved = await tx.card.updateMany({
    where: {
      id: params.cardId,
      reservedCheckoutSessionId: params.checkoutSessionId,
      reservedById: params.buyerId,
      forSale: true,
    },
    data: {
      ownerId: params.buyerId,
      forSale: false,
      price: null,
      reservedById: null,
      reservedUntil: null,
      reservedCheckoutSessionId: null,
      binderId: null,
    },
  });
  return moved.count;
}

/**
 * notifySellerCardSold — fire-and-forget "card sold" notification shared by
 * both webhook handlers. Never throws — a failed lookup/send is swallowed,
 * matching the existing behavior at both call sites (a notification failure
 * must never affect webhook processing).
 */
export function notifySellerCardSold(params: {
  sellerId: string;
  cardId: string;
  orderId: string;
}): void {
  prisma.card
    .findUnique({ where: { id: params.cardId }, select: { title: true } })
    .then((card) =>
      notifyAsync({
        userId: params.sellerId,
        type: "card_sold",
        title: "Your card was sold",
        body: `Your card "${card?.title ?? "a card"}" was purchased via Buy Now.`,
        cardId: params.cardId,
        orderId: params.orderId,
      })
    )
    .catch(() => {});
}
```

In `src/app/api/stripe/webhook/route.ts`, add the import: `import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";`

Replace lines 355–376 (inside `handleCartSessionCompleted`):

```ts
        const moved = await tx.card.updateMany({
          where: {
            id: order.cardId,
            reservedCheckoutSessionId: session.id,
            reservedById: buyerId,
            forSale: true,
          },
          data: {
            ownerId: buyerId,                  // new owner is the buyer
            forSale: false,                    // taken off the marketplace
            price: null,                       // price no longer relevant
            reservedById: null,                // clear reservation
            reservedUntil: null,
            reservedCheckoutSessionId: null,
            binderId: null,                    // detach from seller's binder
          },
        });

        if (moved.count !== 1) {
          console.error(`[webhook] ❌ Card transfer failed for card ${order.cardId}. Count: ${moved.count}`);
          throw new Error(`Card transfer failed for order ${order.id}`);
        }
```

with:

```ts
        const movedCount = await transferCardOwnership(tx, {
          cardId: order.cardId,
          checkoutSessionId: session.id,
          buyerId,
        });

        if (movedCount !== 1) {
          console.error(`[webhook] ❌ Card transfer failed for card ${order.cardId}. Count: ${movedCount}`);
          throw new Error(`Card transfer failed for order ${order.id}`);
        }
```

Replace lines 414–429 (the seller-notification loop):

```ts
  // Step 8: Notify each seller — fire-and-forget, one notification per card sold.
  for (const { sellerId, cardId, orderId } of soldItems) {
    prisma.card
      .findUnique({ where: { id: cardId }, select: { title: true } })
      .then((card) =>
        notifyAsync({
          userId:  sellerId,
          type:    "card_sold",
          title:   "Your card was sold",
          body:    `Your card "${card?.title ?? "a card"}" was purchased via Buy Now.`,
          cardId,
          orderId,
        })
      )
      .catch(() => {});
  }
```

with:

```ts
  // Step 8: Notify each seller — fire-and-forget, one notification per card sold.
  for (const { sellerId, cardId, orderId } of soldItems) {
    notifySellerCardSold({ sellerId, cardId, orderId });
  }
```

Replace lines 520–528 (inside `handleSingleSessionCompleted`):

```ts
      const moved = await tx.card.updateMany({
        where: { id: cardId, reservedCheckoutSessionId: session.id, reservedById: buyerId, forSale: true },
        data: { ownerId: buyerId, forSale: false, price: null, reservedById: null, reservedUntil: null, reservedCheckoutSessionId: null, binderId: null },
      });

      if (moved.count !== 1) {
        console.error(`[webhook] ❌ Transfer FAILED. Count: ${moved.count}.`);
        throw new Error("Card was not reserved by this checkout session");
      }
```

with:

```ts
      const movedCount = await transferCardOwnership(tx, {
        cardId,
        checkoutSessionId: session.id,
        buyerId,
      });

      if (movedCount !== 1) {
        console.error(`[webhook] ❌ Transfer FAILED. Count: ${movedCount}.`);
        throw new Error("Card was not reserved by this checkout session");
      }
```

Replace lines 543–556 (the single-item notify block):

```ts
  // Notify the seller — fire-and-forget.
  prisma.card
    .findUnique({ where: { id: cardId }, select: { title: true } })
    .then((card) =>
      notifyAsync({
        userId:  sellerId,
        type:    "card_sold",
        title:   "Your card was sold",
        body:    `Your card "${card?.title ?? "a card"}" was purchased via Buy Now.`,
        cardId,
        orderId,
      })
    )
    .catch(() => {});
}
```

with:

```ts
  // Notify the seller — fire-and-forget.
  notifySellerCardSold({ sellerId, cardId, orderId });
}
```

If `notifyAsync`/`prisma` are no longer referenced elsewhere in the file after these edits, leave their imports in place regardless — `prisma` and `notifyAsync` are almost certainly still used by other handlers in this same file (`handleSessionCompleted`, `handleSessionExpired`); do not remove the imports without first confirming with a repo-wide grep that they're unused.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/lib/webhookHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full webhook test suite to confirm no regression**

Run: `pnpm test src/__tests__/api/stripe/webhook.test.ts`
Expected: PASS — the DB calls and notification payloads are byte-identical to before, so existing assertions on `tx.card.updateMany`/`notifyAsync` calls should still match.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webhookHelpers.ts src/app/api/stripe/webhook/route.ts src/__tests__/lib/webhookHelpers.test.ts
git commit -m "refactor: extract shared transferCardOwnership/notifySellerCardSold helpers"
```

---

### Task 15: Add missing notification icons and fix the watchlist badge rollback bug

**Files:**
- Modify: `src/app/notifications/page.tsx:18-31,64-72`
- Modify: `src/app/context/WatchlistAnimationContext.tsx:161-178`

**Interfaces:**
- No new exports. Internal component changes only.

- [ ] **Step 1: Write the implementation (notification icons)**

In `src/app/notifications/page.tsx`, add four icon imports after the existing icon imports (line 31):

```tsx
import GavelIcon from "@mui/icons-material/Gavel";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TimerOffIcon from "@mui/icons-material/TimerOff";
```

(`GavelIcon` and `SellOutlinedIcon` are already imported — only the last three are new.)

Replace the `typeConfig` function (lines 64–72):

```tsx
// Icon and colour for each notification type
function typeConfig(type: string): { Icon: React.ElementType; color: string } {
  switch (type) {
    case "offer_received": return { Icon: GavelIcon,              color: "#f59e0b" };
    case "offer_accepted": return { Icon: CheckCircleOutlineIcon, color: "#10b981" };
    case "offer_rejected": return { Icon: CancelOutlinedIcon,     color: "#ef4444" };
    case "card_sold":      return { Icon: SellOutlinedIcon,       color: "#6366f1" };
    default:               return { Icon: NotificationsNoneIcon,  color: "#6b7280" };
  }
}
```

with:

```tsx
// Icon and colour for each notification type
function typeConfig(type: string): { Icon: React.ElementType; color: string } {
  switch (type) {
    case "offer_received":          return { Icon: GavelIcon,              color: "#f59e0b" };
    case "offer_accepted":          return { Icon: CheckCircleOutlineIcon, color: "#10b981" };
    case "offer_rejected":          return { Icon: CancelOutlinedIcon,     color: "#ef4444" };
    case "card_sold":               return { Icon: SellOutlinedIcon,       color: "#6366f1" };
    case "bid_received":            return { Icon: GavelIcon,              color: "#f59e0b" };
    case "outbid":                  return { Icon: TrendingDownIcon,       color: "#ef4444" };
    case "auction_won":             return { Icon: EmojiEventsIcon,        color: "#10b981" };
    case "auction_sold":            return { Icon: SellOutlinedIcon,       color: "#6366f1" };
    case "auction_decision_needed": return { Icon: HourglassEmptyIcon,     color: "#f59e0b" };
    case "auction_expired":         return { Icon: TimerOffIcon,           color: "#6b7280" };
    default:                        return { Icon: NotificationsNoneIcon,  color: "#6b7280" };
  }
}
```

- [ ] **Step 2: Write the implementation (watchlist badge rollback)**

In `src/app/context/WatchlistAnimationContext.tsx`, replace `triggerFly` (lines 161–178):

```tsx
  const triggerFly = useCallback(
    (sourceRect: DOMRect, imageUrl: string): (() => void) => {
      const id = Date.now() + Math.random();
      setFlies((prev) => [...prev, { id, imageUrl, sourceRect }]);

      let cancelled = false;
      // Increment count after the animation completes (~700 ms)
      const timer = setTimeout(() => {
        if (!cancelled) setCount((prev) => prev + 1);
      }, 750);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
    []
  );
```

with:

```tsx
  const triggerFly = useCallback(
    (sourceRect: DOMRect, imageUrl: string): (() => void) => {
      const id = Date.now() + Math.random();
      setFlies((prev) => [...prev, { id, imageUrl, sourceRect }]);

      let cancelled = false;
      let fired = false;
      // Increment count after the animation completes (~700 ms)
      const timer = setTimeout(() => {
        fired = true;
        if (!cancelled) setCount((prev) => prev + 1);
      }, 750);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        // clearTimeout is a no-op once the timer has already fired — if the
        // caller cancels AFTER the 750ms increment already happened (e.g. a
        // slow watchlist POST that fails after the animation finished), roll
        // the increment back explicitly so the badge count doesn't drift.
        if (fired) setCount((prev) => Math.max(0, prev - 1));
      };
    },
    []
  );
```

- [ ] **Step 3: Manually verify**

There is no component-test harness for either of these files (see Task 12, Step 5). Verify via the `run` skill:

1. Notifications: seed or trigger a `bid_received`/`auction_won`/`outbid` notification (place a bid on a test auction) and confirm `/notifications` shows a distinct icon per type, not the generic grey fallback.
2. Watchlist badge: in DevTools, throttle the network to "Slow 3G" and simulate a failed watchlist POST (e.g. temporarily stop the dev server mid-request, or use a request-blocking DevTools rule). Watchlist a card, let the fly animation complete (~750ms) before the request fails, and confirm the navbar badge count returns to its prior value rather than staying incremented.

- [ ] **Step 4: Commit**

```bash
git add src/app/notifications/page.tsx src/app/context/WatchlistAnimationContext.tsx
git commit -m "fix: add missing auction notification icons and fix watchlist badge rollback"
```

---

## ✅ CHECKPOINT 3 — Correctness Bugs

1. Run `pnpm test`.
2. Manually re-run the Task 12, 13, and 15 browser verifications together in one pass (they all touch adjacent card/notification UI) to catch any interaction between them.
3. **Stop and report to the user here before continuing to Phase 4.**

---

## Phase 4 — Efficiency & Cleanup

*Why this phase is last: real issues, but none of them are bugs a user can trigger to lose money, data, or see wrong security-sensitive information — they're latency, wasted work, and code-duplication cleanup.*

### Task 16: Fix the broken Fuse.js memoization in `useFuzzySearch`

**Files:**
- Modify: `src/app/marketplace/MarketPlace.tsx`
- Modify: `src/app/myCollection/MyCollection.tsx`
- Test: Create `src/__tests__/lib/useFuzzySearch.test.ts`

**Interfaces:**
- `useFuzzySearch` signature (`src/app/utils/account/useFuzzySearch.tsx`) is unchanged — the fix is at the call sites, which currently pass a new `keys` array literal on every render, defeating the hook's own `useMemo`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/useFuzzySearch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";

/**
 * useFuzzySearch's Fuse index is built inside a useMemo keyed on [data, keys,
 * threshold]. If a caller passes a NEW array literal for `keys` on every
 * render (e.g. `keys: ["title", "status"]` written inline in JSX), the
 * useMemo dependency never matches and the index is rebuilt from scratch on
 * every re-render — including every keystroke in a search box. This test
 * pins the hook's own memoization: calling it twice with a referentially
 * STABLE keys array and the same data/threshold must not change behavior
 * between renders (the fix is at the call sites, not in this hook — this
 * test documents the contract the call-site fix relies on).
 */

describe("useFuzzySearch", () => {
  const data = [{ title: "Charizard" }, { title: "Blastoise" }];
  const stableKeys = ["title"];

  it("returns matching results for a query", () => {
    const { result } = renderHook(() =>
      useFuzzySearch({ data, query: "char", keys: stableKeys })
    );
    expect(result.current).toEqual([{ title: "Charizard" }]);
  });

  it("returns all data when the query is empty", () => {
    const { result } = renderHook(() =>
      useFuzzySearch({ data, query: "", keys: stableKeys })
    );
    expect(result.current).toEqual(data);
  });
});
```

If `@testing-library/react` is not installed, install it as a dev dependency first: `pnpm add -D @testing-library/react`. This is the one exception to "no component-test infra" in this plan — `renderHook` only needs the React Testing Library hooks utility, not a full jsdom component-rendering setup, and pins down the hook's own contract rather than a UI component.

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm test src/__tests__/lib/useFuzzySearch.test.ts`
Expected: PASS — this test targets the hook's existing, correct behavior (it already memoizes correctly *given* a stable `keys` reference). It exists to lock in that contract before the call-site fix, and to give the two page components something to be checked against if their search behavior ever regresses.

- [ ] **Step 3: Write minimal implementation**

In `src/app/marketplace/MarketPlace.tsx`, hoist the inline array currently passed to `useFuzzySearch` to a module-level constant above the component:

```tsx
// Hoisted so the reference is stable across renders — passing a new array
// literal here every render defeats useFuzzySearch's internal useMemo,
// rebuilding the entire Fuse index on every keystroke in the search box.
const MARKETPLACE_SEARCH_KEYS = ["title", "status", "condition", "setName", "rarity", "type"];
```

Then replace the call site:

```tsx
  const searchResults = useFuzzySearch({
    data,
    query: search,
    keys: ["title", "status", "condition", "setName", "rarity", "type"],
  });
```

with:

```tsx
  const searchResults = useFuzzySearch({
    data,
    query: search,
    keys: MARKETPLACE_SEARCH_KEYS,
  });
```

In `src/app/myCollection/MyCollection.tsx`, apply the identical pattern. Add above the component:

```tsx
const MY_COLLECTION_SEARCH_KEYS = ["title", "status", "condition", "setName", "rarity", "type"];
```

Then replace lines 99–103:

```tsx
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: ["title", "status", "condition", "setName", "rarity", "type"],
  });
```

with:

```tsx
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: MY_COLLECTION_SEARCH_KEYS,
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/lib/useFuzzySearch.test.ts`
Expected: PASS.

- [ ] **Step 5: Manually verify**

Via the `run` skill: open `/marketplace` with a few dozen cards, open the browser Performance/React Profiler, type a multi-character search query, and confirm Fuse's index construction (`new Fuse(...)`) no longer re-runs on every keystroke (only `fuse.search()` should run per keystroke; the index itself should be built once per actual data change).

- [ ] **Step 6: Commit**

```bash
git add src/app/marketplace/MarketPlace.tsx src/app/myCollection/MyCollection.tsx \
  src/__tests__/lib/useFuzzySearch.test.ts package.json pnpm-lock.yaml
git commit -m "fix: stabilize useFuzzySearch keys array to restore Fuse index memoization"
```

---

### Task 17: Parallelize independent queries in `home/featured` and `cards/[id]`; skip the wasted offer-count fetch for non-owners

**Files:**
- Modify: `src/app/api/home/featured/route.ts:55-136`
- Modify: `src/app/api/cards/[id]/route.ts:13-61` (the GET handler)
- Modify: `src/app/cards/[id]/page.tsx` (the offer-count effect touched in Task 13)
- Test: Create `src/__tests__/api/home/featured.test.ts` (extends the file created in Task 8)
- Test: `src/__tests__/api/cards/route.test.ts` or a new `get-card.test.ts` if no GET test exists for `cards/[id]/route.ts`

**Interfaces:**
- No new exports.

- [ ] **Step 1: Write the failing test (home/featured concurrency)**

Add to `src/__tests__/api/home/featured.test.ts` (created in Task 8):

```ts
  // What's being tested: the four independent query groups (bestSellers,
  // highestTransacted, newlyListed, auctionsEndingSoon) must be issued
  // concurrently, not one after another — none of them depends on another's
  // result. This test proves concurrency by using manually-controlled
  // ("deferred") promises: if the route awaited them sequentially, only the
  // first mock would be invoked before this assertion runs; if it uses
  // Promise.all (or an equivalent), all four are invoked before any resolve.

  it("issues all four independent query groups concurrently", async () => {
    const started: string[] = [];
    const finishers: Record<string, (v: any) => void> = {};

    function deferred(name: string, value: any) {
      started.push(name);
      return new Promise((resolve) => {
        finishers[name] = () => resolve(value);
      });
    }

    mockPrisma.bestSeller.findMany.mockImplementation(() => deferred("bestSeller", []));
    mockPrisma.$queryRaw.mockImplementation(() => deferred("queryRaw", []));
    mockPrisma.card.findMany.mockImplementation(() => deferred("newlyListed", []));
    mockPrisma.auction.findMany.mockImplementation(() => deferred("endingSoon", []));

    const resPromise = GET();
    await Promise.resolve(); // let the handler run up to its first await boundary
    await Promise.resolve(); // and its microtask continuations

    expect(started.sort()).toEqual(["bestSeller", "endingSoon", "newlyListed", "queryRaw"]);

    Object.values(finishers).forEach((finish) => finish(undefined));
    await resPromise;
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/api/home/featured.test.ts -t "concurrently"`
Expected: FAIL — with the current sequential `await`s, `mockPrisma.$queryRaw`/`card.findMany`/`auction.findMany` are never called because the handler is still stuck awaiting `bestSeller.findMany`'s never-resolving deferred promise, so `started` only ever contains `["bestSeller"]` and the test times out or the assertion fails.

- [ ] **Step 3: Write minimal implementation**

Replace the body of `GET` in `src/app/api/home/featured/route.ts` (lines 56–128, inside the `try` block) — from `const bestSellerRows = ...` through the `return NextResponse.json({...})` — with:

```ts
    const [bestSellers, highestTransacted, newlyListedRaw, endingSoonRaw] = await Promise.all([
      // Best Sellers: admin-curated, ordered by position.
      (async () => {
        const bestSellerRows = await prisma.bestSeller.findMany({
          orderBy: { position: "asc" },
        });
        return (
          await Promise.all(
            bestSellerRows.map(({ tcgPlayerId }) =>
              prisma.card.findFirst({
                where: { tcgPlayerId, forSale: true },
                include: cardInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .slice(0, 5)
          .map(mapCard);
      })(),

      // Highest Transacted: group transactions by tcgPlayerId (via card join),
      // then fetch the cheapest forSale listing for each.
      (async () => {
        const topTcgPlayerIds = await prisma.$queryRaw<
          Array<{ tcgPlayerId: string; count: bigint }>
        >`
          SELECT c."tcgPlayerId", COUNT(*) AS count
          FROM "CardTransaction" ct
          JOIN "Card" c ON ct."cardId" = c.id
          GROUP BY c."tcgPlayerId"
          ORDER BY count DESC
          LIMIT 5
        `;
        return (
          await Promise.all(
            topTcgPlayerIds.map(({ tcgPlayerId }) =>
              prisma.card.findFirst({
                where: { tcgPlayerId, forSale: true },
                include: cardInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .map(mapCard);
      })(),

      // Newly Listed: 5 most recent forSale cards
      prisma.card.findMany({
        where: { forSale: true },
        include: cardInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Auctions Ending Soon: 5 active auctions with the earliest end time.
      prisma.auction.findMany({
        where:   { status: "active", endsAt: { gt: new Date() } },
        include: { card: { select: AUCTION_CARD_SELECT }, _count: { select: { bids: true } } },
        orderBy: { endsAt: "asc" },
        take:    5,
      }),
    ]);

    return NextResponse.json({
      bestSellers,
      highestTransacted,
      newlyListed:        newlyListedRaw.map(mapCard),
      auctionsEndingSoon: endingSoonRaw.map(formatAuction),
    });
```

In `src/app/api/cards/[id]/route.ts`'s `GET`, replace lines 20–43:

```ts
const card = await prisma.card.findUnique({
      where: { id: params.id },
      include: {
        binder: true,
        owner: { select: { id: true, username: true } },
        _count: { select: { watchlist: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Check if the requesting user has this card watchlisted
    const watchlistedByUser = session?.user?.id
      ? !!(await prisma.cardWatchlist.findUnique({
          where: {
            cardId_userId: { cardId: params.id, userId: session.user.id },
          },
        }))
      : false;
```

with:

```ts
    const [card, watchlistEntry] = await Promise.all([
      prisma.card.findUnique({
        where: { id: params.id },
        include: {
          binder: true,
          owner: { select: { id: true, username: true } },
          _count: { select: { watchlist: true } },
        },
      }),
      session?.user?.id
        ? prisma.cardWatchlist.findUnique({
            where: {
              cardId_userId: { cardId: params.id, userId: session.user.id },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const watchlistedByUser = !!watchlistEntry;
```

In `src/app/cards/[id]/page.tsx`, update the "Fetch offer count for owner's button label" effect (already touched in Task 13) to only fire for the card's owner:

```tsx
  // Fetch offer count for owner's button label — owner-only; this endpoint
  // 403s for non-owners, so firing it for every viewer wastes a request and
  // a DB query on every card-page view.
  useEffect(() => {
    if (!id || !userId || !card || card.owner?.id !== userId) return;
    let isCurrent = true;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (isCurrent && data.offers) setOffersCount(data.offers.length); })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [id, userId, card]);
```

(Confirm the `CardItem` type/`card` state shape actually exposes `owner.id` — it does, per the GET response shape above; if the component's local `CardItem` TypeScript type doesn't yet declare `owner`, add `owner: { id: string; username: string | null }` to it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/api/home/featured.test.ts`
Expected: PASS.

`src/__tests__/api/cards/route.test.ts` only covers POST (per its docblock). Create `src/__tests__/api/cards/get-card.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/cards/[id]
 *
 * Public card detail lookup + per-viewer watchlist flag. The card lookup and
 * the watchlist lookup are independent of each other and are now fetched
 * concurrently via Promise.all instead of sequentially.
 */

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() },
  cardWatchlist: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/cards/[id]/route";

const CARD = {
  id: "card-1",
  title: "Charizard",
  price: 5000,
  binder: null,
  owner: { id: "owner-1", username: "Ash" },
  _count: { watchlist: 3 },
};

describe("GET /api/cards/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.card.findUnique.mockResolvedValue(CARD);
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue(null);
  });

  it("returns 404 when the card doesn't exist", async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    expect(res.status).toBe(404);
  });

  it("returns watchlistedByUser: false and skips the watchlist query for an anonymous viewer", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.card.watchlistedByUser).toBe(false);
    expect(body.card.watchlistCount).toBe(3);
    expect(body.card.price).toBe(50); // cents → dollars
    expect(mockPrisma.cardWatchlist.findUnique).not.toHaveBeenCalled();
  });

  it("returns watchlistedByUser: true when the logged-in viewer has watchlisted this card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "viewer-1" } });
    mockPrisma.cardWatchlist.findUnique.mockResolvedValue({ cardId: "card-1", userId: "viewer-1" });

    const res = await GET(new Request("http://localhost/api/cards/card-1"), { params: { id: "card-1" } });
    const body = await res.json();

    expect(body.card.watchlistedByUser).toBe(true);
    expect(mockPrisma.cardWatchlist.findUnique).toHaveBeenCalledWith({
      where: { cardId_userId: { cardId: "card-1", userId: "viewer-1" } },
    });
  });
});
```

- [ ] **Step 5: Manually verify the offer-count fetch skip**

Via the `run` skill: open a card you do NOT own while logged in, check the Network tab, and confirm `GET /api/offers?cardId=...` (without `myOffer=true`) is no longer fired. Open a card you DO own and confirm it still fires and the offer count still shows correctly.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/home/featured/route.ts src/app/api/cards/\[id\]/route.ts src/app/cards/\[id\]/page.tsx \
  src/__tests__/api/home/featured.test.ts src/__tests__/api/cards/get-card.test.ts
git commit -m "perf: parallelize independent queries; skip wasted offer-count fetch for non-owners"
```

---

### Task 18: Remove debug logging and resolve the checkout TODOs

**Files:**
- Modify: `src/app/api/checkout/route.ts:54-65,134-141`
- Test: `src/__tests__/api/checkout/route.test.ts` (verify no regression, no new test needed — this is a log/comment/constant change)

**Interfaces:**
- No behavior/interface change for the 15-minute reservation window bump — same shape, different constant value. No new exports.

- [ ] **Step 1: Write the implementation**

In `src/app/api/checkout/route.ts`, replace lines 54–57:

```ts
    const amount = card.price;
    // TODO: Increase to 15-30 mins for production.
    // Note: If syncing with Stripe's 'expires_at', Stripe requires a 30min minimum.
    const reserveMinutes = 1;
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60_000);
```

with:

```ts
    const amount = card.price;
    // 15 minutes gives a buyer enough time to complete the Stripe Checkout
    // page without holding the card unreasonably long from other buyers.
    // Deliberately under Stripe's 30-minute expires_at minimum — see the
    // comment on the commented-out expires_at below for why the two aren't
    // synced yet.
    const reserveMinutes = 15;
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60_000);
```

Replace lines 59–65 (remove the two debug `console.log` calls):

```ts
    const order = await prisma.$transaction(async (tx) => {
      console.log("[checkout] buyerId from session:", buyerId);
      // 1. Double-check the buyer exists in the system
      const buyer = await prisma.user.findUnique({
        where: { id: buyerId! },
      });
      console.log("[checkout] buyer exists in DB:", !!buyer);
      // 2. The "Atomic Reservation"
```

with:

```ts
    const order = await prisma.$transaction(async (tx) => {
      // 1. Double-check the buyer exists in the system
      const buyer = await prisma.user.findUnique({
        where: { id: buyerId! },
      });
      // 2. The "Atomic Reservation"
```

Replace lines 134–141:

```ts
      // TODO: Re-enable `expires_at` after testing.
      // Stripe requires `expires_at` to be at least 30 minutes from session creation.
      // When we re-enable it, also add a "Resume checkout" flow:
      // - Persist stripeCheckoutSessionId on Order (already doing)
      // - Provide an endpoint/UI that finds the user's latest PENDING order and redirects them back to the same Checkout Session
      //   (or creates a new session if the old one expired).
      // expires_at: Math.floor(reservedUntil.getTime() / 1000),
      // expires_at: Math.floor(reservedUntil.getTime() / 1000),
```

with:

```ts
      // expires_at intentionally omitted: Stripe requires it to be at least
      // 30 minutes from session creation, but our DB reservation
      // (reserveMinutes above) is 15 minutes — syncing the two would mean
      // either lengthening the DB hold to 30+ minutes (locking the card from
      // other buyers longer) or building a "resume checkout" flow (find the
      // user's latest PENDING order, redirect back to its still-open
      // session, or create a new one if expired). Deferred as a follow-up;
      // tracked outside this plan.
```

- [ ] **Step 2: Run the existing tests to confirm no regression**

Run: `pnpm test src/__tests__/api/checkout/route.test.ts`
Expected: PASS — no test in this file asserts on the removed `console.log` calls or the exact `reserveMinutes` value, so this should be a clean pass. If any test does assert on the 1-minute value specifically, update its expectation to 15 minutes rather than skip it.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "chore: remove debug logging and resolve checkout reservation-window TODOs"
```

---

### Task 19: Add a shared `formatPrice` helper and migrate the highest-traffic call sites

**Files:**
- Modify: `src/lib/money.ts`
- Modify: `src/app/cart/page.tsx`
- Modify: `src/app/shared-components/cards/BuyBox.tsx`
- Test: Create `src/__tests__/lib/money.test.ts` additions (the file already exists per the earlier test listing — add to it, don't overwrite)

**Interfaces:**
- Produces: `formatPrice(dollars: number | null | undefined, opts?: { fallback?: string }): string` — formats a **dollar** amount (not cents) as `"S$X.XX"`, or `opts.fallback` (default `"—"`) when `dollars` is `null`/`undefined`. Takes dollars, not cents, because every call site in Phase 4 already has a dollar value in hand — API routes convert cents→dollars at the response boundary (via `centsToDollars`) before the value ever reaches a component; components never hold raw cents.

- [ ] **Step 1: Write the failing test**

First read the existing `src/__tests__/lib/money.test.ts` to match its exact `describe` structure, then add:

```ts
  describe("formatPrice", () => {
    it("formats a dollar amount as a S$ string with two decimal places", () => {
      expect(formatPrice(19.99)).toBe("S$19.99");
      expect(formatPrice(5)).toBe("S$5.00");
    });

    it("returns the fallback for null/undefined", () => {
      expect(formatPrice(null)).toBe("—");
      expect(formatPrice(undefined)).toBe("—");
    });

    it("accepts a custom fallback", () => {
      expect(formatPrice(null, { fallback: "N/A" })).toBe("N/A");
    });
  });
```

Add the import at the top of the test file: `import { formatPrice } from "@/lib/money";` (alongside whatever `dollarsToCents`/`centsToDollars` import already exists there).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/__tests__/lib/money.test.ts -t "formatPrice"`
Expected: FAIL — `formatPrice` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add to the end of `src/lib/money.ts`:

```ts

/**
 * Formats a dollar amount for display as "S$X.XX". This is the UI-layer
 * formatting `centsToDollars`'s docblock always said belonged here, but
 * never actually provided — every call site had been hand-rolling
 * `S$${dollars.toFixed(2)}` independently, with inconsistent null handling
 * ("—" vs "S$ -" vs no guard at all).
 *
 * Takes DOLLARS, not cents — by the time a value reaches a component, it has
 * already been through `centsToDollars` at the API response boundary.
 *
 * WHEN TO USE:
 * - Any time a dollar amount is rendered directly in JSX as a price string.
 */
export function formatPrice(
  dollars: number | null | undefined,
  opts: { fallback?: string } = {}
): string {
  if (dollars == null) return opts.fallback ?? "—";
  return `S$${dollars.toFixed(2)}`;
}
```

In `src/app/cart/page.tsx`, delete the local helper (lines 39–41):

```tsx
function fmt(dollars: number) {
  return `S$${dollars.toFixed(2)}`;
}
```

Add `import { formatPrice } from "@/lib/money";` near the other imports, then replace each call site:

- Line 208: `{fmt(card.price)}` → `{formatPrice(card.price)}`
- Line 236: `{card.price != null ? fmt(card.price) : "—"}` → `{formatPrice(card.price)}` (the null check is now redundant — `formatPrice` already returns `"—"` for `null`)
- Line 242: `{ label: "Item Price", value: card.price != null ? fmt(card.price) : "—" }` → `{ label: "Item Price", value: formatPrice(card.price) }`
- Line 610: `{ label: "Items Total", value: fmt(summary.itemsTotal) }` → `{ label: "Items Total", value: formatPrice(summary.itemsTotal) }`
- Line 626: `{fmt(summary.itemsTotal)}` → `{formatPrice(summary.itemsTotal)}`

In `src/app/shared-components/cards/BuyBox.tsx`, add `import { formatPrice } from "@/lib/money";` near the other imports, then replace these call sites (verified current line numbers/content):

- Line 301: `{listing?.price != null ? `S$${listing.price.toFixed(2)}` : "—"}` → `{formatPrice(listing?.price)}`
- Lines 455, 466, 478 (same pattern repeated 3x): `Your offer of <strong>S${activeOffer.price!.toFixed(2)}</strong>{" "}` → `Your offer of <strong>{formatPrice(activeOffer.price)}</strong>{" "}`
- Line 519: `S${(auction.currentBid ?? 0).toFixed(2)}` → `{formatPrice(auction.currentBid ?? 0)}`
- Line 617: `` `Buy Now S$${auction.buyOutPrice.toFixed(2)}` `` → `` `Buy Now ${formatPrice(auction.buyOutPrice)}` ``
- Line 640: `Accept S${auction.currentBid.toFixed(2)}` → `Accept {formatPrice(auction.currentBid)}`
- Line 684: `{value !== null ? `S$${value.toFixed(2)}` : "—"}` → `{formatPrice(value)}`
- Line 871: `As low as S${lowestOther.toFixed(2)}` → `As low as {formatPrice(lowestOther)}`

Leave every other `.toFixed(2)` call site in this file (and other files) untouched — this task migrates these two files' call sites only; the remaining ~10 call sites listed in the review findings are lower-traffic and deferred per this plan's Scope Note.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/__tests__/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Manually verify the two migrated files**

Via the `run` skill: open `/cart` and a card detail page's BuyBox, confirm prices render identically to before (e.g. `S$80.00` not `S$80`, matching the existing `.toFixed(2)` behavior — `formatPrice` preserves this).

- [ ] **Step 6: Commit**

```bash
git add src/lib/money.ts src/app/cart/page.tsx src/app/shared-components/cards/BuyBox.tsx \
  src/__tests__/lib/money.test.ts
git commit -m "refactor: add shared formatPrice helper; migrate cart and BuyBox call sites"
```

---

## ✅ CHECKPOINT 4 — Efficiency & Cleanup (final)

1. Run `pnpm test` one last time — full suite green.
2. Run `pnpm lint` and `pnpm build` to catch any TypeScript issues introduced across all 19 tasks (in particular the `Prisma.TransactionClient` type in Task 14 and the `CardItem.owner` type addition in Task 17).
3. Re-read `git log --oneline` for this plan's commits against the task list above — every task should have exactly one commit (or note where a task's fix and its test were split across two, if that happened).
4. Report to the user: what was fixed, what was deferred (the Scope Note at the top of this plan), and the full commit list for their review before merging.
