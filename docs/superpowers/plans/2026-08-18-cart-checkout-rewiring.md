# Cart & Checkout API Rewiring (Plan 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every cart/checkout/webhook backend file still calling the pre-rename Prisma model `Card`/`cardId` (renamed to `Listing`/`listingId` with two new catalog tables in a prior plan), so a buyer can add a listing to their cart, check out (Buy Now or full-cart), and have the Stripe webhook correctly transfer ownership. Also fixes a live bug discovered while scoping this plan: `src/lib/notifications.ts` still writes `cardId` into the `Notification` model, whose field is now `listingId` — every notification in the app (card_sold, offers, auctions) has been silently failing since the schema migration merged, because `notifyAsync` swallows all errors.

**Architecture:** Same pattern as the prior Listing API Rewiring plan (Plan 2a): a shared helper, `src/lib/listingDisplay.ts` (already built, unchanged by this plan), resolves card-identity fields (title, rarity, setName, etc.) from whichever catalog relation (`pokemonCard`/`riftboundCard`) a listing points to. Every route in this plan maps its Prisma query results through that helper before returning JSON or building a Stripe line item, so `src/types/cart.ts` and the frontend need zero changes. All external wire contracts (JSON request/response field names like `cardId`, Stripe `metadata.cardId`) are preserved exactly as-is — only internal Prisma model/field names change. `notifications.ts`'s public function signature also keeps its `cardId` parameter name unchanged, since it has many callers outside this plan's scope (offers, auctions) — only its internal Prisma write is fixed to use the correct `listingId` column.

**Tech Stack:** Next.js 14 App Router route handlers, Prisma 6, Stripe SDK, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-riftbound-card-schema-design.md` (the schema this plan wires up to) — same relationship as Plan 2a: a direct, previously-agreed-to continuation of that architectural work, not a new design requiring its own spec.

## Global Constraints

- **Schema is already migrated — no schema changes in this plan.** `Listing`, `PokemonCardCatalog`, `RiftboundCardCatalog` already exist. Confirmed field names used throughout this plan (from `prisma/schema.prisma`): `Order.listingId`, `Offer.listingId`, `CardTransaction.listingId`, `CartItem.listingId` with compound unique key `cartId_listingId`, `Notification.listingId`. `Listing`'s own scalar fields (`price`, `condition`, `imageUrls`, `forSale`, `ownerId`, `reservedById`, `reservedUntil`, `reservedCheckoutSessionId`, `binderId`) are unchanged from the old `Card` model — only the identity fields (`title`, `setName`, `rarity`, `language`, `cardNumber`, `tcgPlayerId`) moved to the catalog tables.
- **External wire contracts are preserved exactly.** JSON request/response field names (e.g. `{ cardId: "..." }` in POST bodies), Stripe `metadata.cardId`, and cancel/success URL query params (`?cardId=...`) all keep the literal string `cardId` — only internal Prisma calls change to `listingId`. This avoids any frontend changes, matching Plan 2a's approach.
- **`src/lib/listingDisplay.ts` is not modified by this plan** — it already exports `listingCatalogInclude`, `resolveListingDisplay`, `withListingDisplay` (see Plan 2a). Import and use them; do not redefine.
- **`notifyAsync`/`createNotification` in `src/lib/notifications.ts` keep their public `cardId?: string` parameter name unchanged** — only the internal `prisma.notification.create` call is fixed to write it to the `listingId` column. This is a deliberate, narrow fix: `notifyAsync` has call sites in offers and auctions routes that are out of scope for this plan, and renaming the parameter would force changes there too.
- **`src/app/api/cart/[itemId]/route.ts` needs NO changes.** Checked during planning — it only operates on `CartItem`/`Cart` by id and never references the old `Card` model or any `cardId` field. Not included as a task.
- Public/anonymous-reachable owner data must never include email — `owner: { select: { id: true, username: true } }`, never bare `owner: true`.
- Prices are stored in cents; `dollarsToCents`/`centsToDollars` from `@/lib/money` convert at API boundaries, exactly where the current code already does.
- Test files follow this codebase's existing mock pattern: `vi.hoisted(() => ({...}))` to build the mock object, `vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))` to register it, then `import` the route under test.

---

### Task 1: `src/lib/notifications.ts` — fix the `cardId`→`listingId` write bug

**Files:**
- Modify: `src/lib/notifications.ts`
- Create: `src/__tests__/lib/notifications.test.ts` (no test file exists for this module today)

**Interfaces:** None consumed. Produces: `createNotification`/`notifyAsync` (unchanged public signatures) — every existing caller across the codebase keeps working with zero changes.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  notification: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const mockSendEmailAsync = vi.hoisted(() => vi.fn());
const mockBuildNotificationEmail = vi.hoisted(() =>
  vi.fn((title: string, body: string) => `<p>${title}: ${body}</p>`)
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email", () => ({
  sendEmailAsync: mockSendEmailAsync,
  buildNotificationEmail: mockBuildNotificationEmail,
}));

import { createNotification, notifyAsync } from "@/lib/notifications";

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ email: "seller@test.com" });
  });

  // What's being tested: the actual bug this task fixes. The Notification
  // model's foreign key column is `listingId` (renamed from `cardId` when
  // Card became Listing), but this function's own external parameter is
  // still named `cardId` for backward compatibility with its many callers.
  // The internal Prisma write must map one to the other.
  it("writes the card id to the Notification model's listingId column", async () => {
    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Your card was sold",
      body: "body text",
      cardId: "listing-1",
      orderId: "order-1",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "card_sold",
        title: "Your card was sold",
        body: "body text",
        offerId: undefined,
        listingId: "listing-1",
        orderId: "order-1",
      },
    });
  });

  it("sends an email to the recipient when they have one on file", async () => {
    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Sold!",
      body: "text",
      cardId: "listing-1",
    });

    expect(mockSendEmailAsync).toHaveBeenCalledWith(
      expect.objectContaining({ to: "seller@test.com", subject: "Sold!" })
    );
  });

  it("skips sending an email when the recipient has none on file", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ email: null });

    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Sold!",
      body: "text",
    });

    expect(mockSendEmailAsync).not.toHaveBeenCalled();
  });
});

describe("notifyAsync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never throws even when the DB write fails", async () => {
    mockPrisma.notification.create.mockRejectedValue(new Error("db down"));

    expect(() =>
      notifyAsync({ userId: "user-1", type: "card_sold", title: "t", body: "b" })
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/notifications.test.ts`
Expected: FAIL — the first test's `toHaveBeenCalledWith` assertion fails because the route still passes `cardId: "listing-1"` in the `data` object instead of `listingId: "listing-1"`.

- [ ] **Step 3: Fix the implementation**

In `src/lib/notifications.ts`, replace the `createNotification` function body:

```ts
// Creates the DB record and fires the email. Awaitable if you need to be sure
// the DB write succeeded — though most callers use notifyAsync() instead.
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const { userId, type, title, body, offerId, cardId, orderId } = input;

  // Step 1: Persist the notification so it appears in the bell/page.
  // The Notification model's FK column is `listingId` (renamed from `cardId`
  // when Card became Listing) — this function's own external parameter name
  // stays `cardId` so its many callers across offers/auctions/checkout don't
  // need to change; only this internal write needs to know about the
  // renamed column.
  await prisma.notification.create({
    data: { userId, type, title, body, offerId, listingId: cardId, orderId },
  });

  // Step 2: Look up the recipient's email and send — fire-and-forget.
  // We fetch the email here so callers don't need to pass it; the extra
  // DB round-trip is acceptable because this whole function is async side-effect.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email) {
    sendEmailAsync({
      to: user.email,
      subject: title,
      html: buildNotificationEmail(title, body),
    });
  }
}
```

(Everything else in the file — the type definitions, `notifyAsync`, all comments outside this one function body — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/notifications.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/__tests__/lib/notifications.test.ts
git commit -m "fix: write notification card reference to the renamed listingId column"
```

---

### Task 2: `src/lib/webhookHelpers.ts` — rewire onto `Listing` + catalog

**Files:**
- Modify: `src/lib/webhookHelpers.ts`
- Modify: `src/__tests__/lib/webhookHelpers.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `resolveListingDisplay` from `@/lib/listingDisplay`.
- Produces (used by Task 6 / `stripe/webhook/route.ts`): `transferCardOwnership(tx, { listingId, checkoutSessionId, buyerId }): Promise<number>` (param renamed from `cardId`); `notifySellerCardSold(params: { sellerId: string; listingId: string; orderId: string }): void` (param renamed from `cardId`). Both signatures are renamed here because this file and its only caller (`stripe/webhook/route.ts`, Task 6) are fully owned by this plan — there's no external caller to preserve compatibility for.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/lib/webhookHelpers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
}));
const mockNotifyAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync, createNotification: vi.fn() }));

import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";

describe("transferCardOwnership", () => {
  it("runs the concurrency-guarded updateMany with the expected where/data shape", async () => {
    const tx = { listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const count = await transferCardOwnership(tx as any, {
      listingId: "listing-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(1);
    expect(tx.listing.updateMany).toHaveBeenCalledWith({
      where: {
        id: "listing-1",
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
    const tx = { listing: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    const count = await transferCardOwnership(tx as any, {
      listingId: "listing-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(0);
  });
});

describe("notifySellerCardSold", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the listing's title via the catalog relation and fires a card_sold notification", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({
      id: "listing-1",
      pokemonCard: {
        nameEn: "Charizard",
        rarity: "Rare Holo",
        setNameEn: "Base Set",
        language: "English",
        localId: "004",
        tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    });

    notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget chain resolve

    expect(mockPrisma.listing.findUnique).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      include: { pokemonCard: true, riftboundCard: true },
    });
    expect(mockNotifyAsync).toHaveBeenCalledWith({
      userId: "seller-1",
      type: "card_sold",
      title: "Your card was sold",
      body: 'Your card "Charizard" was purchased via Buy Now.',
      cardId: "listing-1",
      orderId: "order-1",
    });
  });

  it("falls back to 'a card' when the listing can no longer be found", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);

    notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Your card "a card" was purchased via Buy Now.' })
    );
  });

  it("never throws even if the listing lookup fails", async () => {
    mockPrisma.listing.findUnique.mockRejectedValue(new Error("db down"));

    expect(() =>
      notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/webhookHelpers.test.ts`
Expected: FAIL — the module still calls `tx.card.updateMany`/`prisma.card.findUnique` and reads `card?.title` directly instead of resolving through the catalog.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/lib/webhookHelpers.ts`:

```ts
// lib/webhookHelpers.ts

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAsync } from "@/lib/notifications";
import { listingCatalogInclude, resolveListingDisplay } from "@/lib/listingDisplay";

/**
 * transferCardOwnership — the concurrency-guarded ownership transfer shared
 * by handleCartSessionCompleted and handleSingleSessionCompleted in the
 * Stripe webhook. The WHERE clause only matches if the listing is still
 * reserved by this exact checkout session and buyer; if another process
 * already transferred or released it, the count comes back 0 and the caller
 * throws to roll back its transaction (triggering the refund safeguard).
 *
 * Returns the row count rather than throwing itself — the two callers log
 * slightly different messages on failure, which stays their responsibility.
 */
export async function transferCardOwnership(
  tx: Prisma.TransactionClient,
  params: { listingId: string; checkoutSessionId: string; buyerId: string }
): Promise<number> {
  const moved = await tx.listing.updateMany({
    where: {
      id: params.listingId,
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
 * must never affect webhook processing). The listing's title is resolved via
 * its catalog relation (pokemonCard/riftboundCard) since it's no longer a
 * flat column on Listing itself.
 */
export function notifySellerCardSold(params: {
  sellerId: string;
  listingId: string;
  orderId: string;
}): void {
  prisma.listing
    .findUnique({ where: { id: params.listingId }, include: listingCatalogInclude })
    .then((listing) => {
      const title = listing ? resolveListingDisplay(listing).title : "a card";
      notifyAsync({
        userId: params.sellerId,
        type: "card_sold",
        title: "Your card was sold",
        body: `Your card "${title}" was purchased via Buy Now.`,
        cardId: params.listingId,
        orderId: params.orderId,
      });
    })
    .catch(() => {});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/webhookHelpers.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhookHelpers.ts src/__tests__/lib/webhookHelpers.test.ts
git commit -m "fix: rewire webhookHelpers onto Listing + catalog tables"
```

---

### Task 3: `src/app/api/cart/route.ts` — GET/POST/DELETE

**Files:**
- Modify: `src/app/api/cart/route.ts`
- Modify: `src/__tests__/api/cart/route.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.

DELETE needs no changes at all — it only touches `Cart`/`CartItem` by id, never `Listing`. Included in this task only so its tests stay green after the file is rewritten; no new DELETE tests needed.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/cart/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for GET, POST, and DELETE /api/cart.
 *
 * GET  → groups cart items into packages by seller; includes userAddress.
 * POST → adds a listing (idempotent — adding the same listing twice is safe).
 * DELETE → clears all items or only selected ones (?selected=true).
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cart: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  cartItem: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  listing: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET, POST, DELETE } from "@/app/api/cart/route";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SESSION = { user: { id: "user-1" } };

function makeRequest(url = "http://localhost/api/cart", init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

function listingFixture(owner: { id: string; username: string | null }) {
  return {
    id: "listing-1",
    price: 5000,
    condition: "NM",
    imageUrls: [],
    forSale: true,
    pokemonCard: {
      nameEn: "Charizard",
      rarity: "Rare",
      setNameEn: "Base Set",
      language: "English",
      localId: "4/102",
      tcgPlayerId: "tcg-1",
    },
    riftboundCard: null,
    owner,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  // What's being tested: items are grouped by seller, prices are converted
  // from cents (DB storage) to dollars (API response), and card identity
  // fields are resolved via the catalog relation.
  it("groups items by seller, converts price from cents to dollars, and resolves catalog fields", async () => {
    const owner = { id: "seller-1", username: "seller" };
    const item = {
      id: "item-1",
      selected: true,
      createdAt: new Date("2024-01-01"),
      listing: listingFixture(owner),
    };

    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1", items: [item] });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      address: "123 Main St",
      phoneNumber: "+65 9000 0000",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.packages).toHaveLength(1);
    expect(body.packages[0].sellerId).toBe("seller-1");
    expect(body.packages[0].items[0].card.price).toBe(50); // cents → dollars
    expect(body.packages[0].items[0].card.title).toBe("Charizard");
    expect(body.userAddress?.name).toBe("John Doe");
  });

  // What's being tested: an empty cart returns an empty packages array.
  it("returns empty packages for an empty cart", async () => {
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1", items: [] });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.packages).toEqual([]);
  });

  // What's being tested: the listing owner's email must never reach the
  // response, and the query itself must not select it — asserting only on
  // the response body isn't enough here, since the mock below already
  // returns an email-free owner regardless of what select we pass Prisma;
  // reverting the route's `owner: { select: { id, username } }` back to
  // including `email: true` would still pass a body-only assertion.

  function cartItemFixture(owner: { id: string; username: string | null }) {
    return {
      id: "item-1",
      selected: true,
      createdAt: new Date("2025-01-01"),
      listing: listingFixture(owner),
    };
  }

  it("never includes the listing owner's email in the response or the query", async () => {
    mockPrisma.cart.upsert.mockResolvedValue({
      items: [cartItemFixture({ id: "owner-1", username: "Ash" })],
    });

    const res = await GET();
    const body = await res.json();

    const owner = body.packages[0].items[0].card.owner;
    expect(owner).toEqual({ id: "owner-1", username: "Ash" });
    expect(owner.email).toBeUndefined();
    expect(body.packages[0].sellerName).toBe("Ash");

    const upsertArgs = mockPrisma.cart.upsert.mock.calls[0][0];
    expect(upsertArgs.include.items.include.listing.include.owner).toEqual({
      select: { id: true, username: true },
    });
  });

  // What's being tested: the sellerName fallback used to read `owner.email`
  // when `username` was missing; now that email is no longer selected, it
  // must fall back to the literal string "Seller" instead of silently
  // becoming undefined.

  it("falls back sellerName to 'Seller' when the owner has no username", async () => {
    mockPrisma.cart.upsert.mockResolvedValue({
      items: [cartItemFixture({ id: "owner-1", username: null })],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.packages[0].sellerName).toBe("Seller");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  function postRequest(body: Record<string, unknown>) {
    return makeRequest("http://localhost/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(401);
  });

  // What's being tested: missing body is rejected with 400.
  it("returns 400 when cardId is missing", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  // What's being tested: a user cannot add their own listing.
  it("returns 400 when the user tries to add their own card", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "user-1", // same as session user
    });
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(400);
  });

  // What's being tested: a non-for-sale listing is rejected.
  it("returns 400 when the card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: false,
      ownerId: "seller-1",
    });
    const res = await POST(postRequest({ cardId: "listing-1" }));
    expect(res.status).toBe(400);
  });

  // What's being tested: a new listing is added and count is returned.
  it("creates a cart item and returns alreadyInCart: false", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "seller-1",
    });
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null); // not in cart yet
    mockPrisma.cartItem.create.mockResolvedValueOnce({ id: "item-1" });
    mockPrisma.cartItem.count.mockResolvedValueOnce(1);

    const res = await POST(postRequest({ cardId: "listing-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadyInCart).toBe(false);
    expect(body.count).toBe(1);
    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: "cart-1", listingId: "listing-1", selected: true },
    });
  });

  // What's being tested: adding a listing that's already in the cart returns
  // alreadyInCart: true without creating a duplicate row, and the lookup
  // uses the renamed cartId_listingId compound key.
  it("returns alreadyInCart: true when card is already in cart", async () => {
    mockPrisma.listing.findUnique.mockResolvedValueOnce({
      id: "listing-1",
      forSale: true,
      ownerId: "seller-1",
    });
    mockPrisma.cart.upsert.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce({ id: "item-1" }); // already present
    mockPrisma.cartItem.count.mockResolvedValueOnce(3);

    const res = await POST(postRequest({ cardId: "listing-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyInCart).toBe(true);
    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
      where: { cartId_listingId: { cartId: "cart-1", listingId: "listing-1" } },
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/cart
// ═════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: the auth gate.
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  // What's being tested: if the user has no cart, the route returns success
  // without touching the DB (graceful no-op).
  it("returns success with deleted: 0 when cart does not exist", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(0);
    expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  // What's being tested: without ?selected=true, all items are removed.
  it("removes all items when ?selected param is absent", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 3 });

    const res = await DELETE(makeRequest("http://localhost/api/cart", { method: "DELETE" }));
    const body = await res.json();

    expect(body.deleted).toBe(3);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1" },
    });
  });

  // What's being tested: with ?selected=true only the checked items are removed.
  it("removes only selected items when ?selected=true", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1" });
    mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 2 });

    const res = await DELETE(
      makeRequest("http://localhost/api/cart?selected=true", { method: "DELETE" })
    );
    const body = await res.json();

    expect(body.deleted).toBe(2);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1", selected: true },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/cart/route.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique` and reads `item.card`/`cardId_cardId`-style keys.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/cart/route.ts`:

```ts
// src/app/api/cart/route.ts
//
// Three operations on the user's cart:
//
//   GET  /api/cart          → return the full cart grouped into packages by seller
//   POST /api/cart          → add a listing (idempotent — adding the same listing twice is safe)
//   DELETE /api/cart        → clear all items (or only selected items with ?selected=true)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Upsert so that the very first GET silently creates an empty cart for new users
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: {
          listing: {
            include: {
              // Adding to cart requires no relationship with the seller yet —
              // email deliberately excluded, same rationale as cards/route.ts.
              owner: { select: { id: true, username: true } },
              ...listingCatalogInclude,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Also fetch the user's profile so the cart summary can show the shipping address
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      address: true,
      phoneNumber: true,
    },
  });

  // Group items by seller — each group becomes a "package" in the UI
  const sellerMap = new Map<
    string,
    { sellerName: string; items: (typeof cart.items)[number][] }
  >();

  for (const item of cart.items) {
    const sellerId = item.listing.owner.id;
    const sellerName = item.listing.owner.username ?? "Seller";
    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, { sellerName, items: [] });
    }
    sellerMap.get(sellerId)!.items.push(item);
  }

  const packages = Array.from(sellerMap.entries()).map(
    ([sellerId, { sellerName, items }]) => ({
      sellerId,
      sellerName,
      items: items.map((item) => {
        const display = withListingDisplay(item.listing);
        return {
          id: item.id,
          selected: item.selected,
          createdAt: item.createdAt.toISOString(),
          card: {
            id: display.id,
            title: display.title,
            price: display.price != null ? centsToDollars(display.price) : null,
            condition: display.condition,
            imageUrls: display.imageUrls,
            language: display.language,
            setName: display.setName,
            rarity: display.rarity,
            cardNumber: display.cardNumber,
            forSale: display.forSale,
            tcgPlayerId: display.tcgPlayerId,
            owner: display.owner,
          },
        };
      }),
    })
  );

  // Build the display name for the shipping address panel
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "User";

  return NextResponse.json({
    packages,
    userAddress: user
      ? { name, address: user.address ?? null, phoneNumber: user.phoneNumber ?? null }
      : null,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  // Wire contract unchanged — the request body still uses `cardId`, even
  // though it now maps to a Listing row.
  const listingId = typeof body?.cardId === "string" ? body.cardId : null;
  if (!listingId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Validate the listing exists, is for sale, and doesn't belong to the buyer
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (!listing.forSale) {
    return NextResponse.json({ error: "Card is not for sale" }, { status: 400 });
  }
  if (listing.ownerId === userId) {
    return NextResponse.json(
      { error: "You cannot add your own card to your cart" },
      { status: 400 }
    );
  }

  // Get or create the user's cart
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // Check if already in cart before creating (so we can tell the caller)
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_listingId: { cartId: cart.id, listingId } },
  });

  if (existing) {
    const count = await prisma.cartItem.count({ where: { cartId: cart.id } });
    return NextResponse.json({
      success: true,
      alreadyInCart: true,
      cartItemId: existing.id,
      count,
    });
  }

  const item = await prisma.cartItem.create({
    data: { cartId: cart.id, listingId, selected: true },
  });

  const count = await prisma.cartItem.count({ where: { cartId: cart.id } });

  return NextResponse.json({
    success: true,
    alreadyInCart: false,
    cartItemId: item.id,
    count,
  });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  // ?selected=true → only remove checked items; otherwise remove everything
  const selectedOnly = url.searchParams.get("selected") === "true";

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  const result = await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      ...(selectedOnly ? { selected: true } : {}),
    },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/cart/route.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cart/route.ts src/__tests__/api/cart/route.test.ts
git commit -m "fix: rewire GET/POST/DELETE /api/cart onto Listing + catalog tables"
```

---

### Task 4: `src/app/api/checkout/route.ts` — single-item Buy Now checkout

**Files:**
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/__tests__/api/checkout/route.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.

Wire contracts preserved: the request body still uses `cardId`, and Stripe `metadata`/URL query params still use `cardId` — only internal Prisma calls change (`prisma.card`→`prisma.listing`, `Order.cardId`→`Order.listingId`).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/checkout/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/checkout (single-item Buy Now).
 *
 * See the module-level comment in the original version of this file for the
 * full walkthrough of vi.hoisted()/vi.mock() execution order — unchanged
 * here, only the mocked Prisma model (card → listing) and the fixture shape
 * (flat title → catalog relation) are updated.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  checkout: {
    sessions: { create: vi.fn() },
  },
}));

const mockPrisma = vi.hoisted(() => ({
  listing: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  order: {
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/checkout/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Shared test data — reused across tests. Spread and override individual
// fields to simulate different listing states (e.g. { ...LISTING, forSale: false })
const LISTING = {
  id: "card-1",
  price: 5000, // S$50.00 in cents — matches how prices are stored in the DB
  forSale: true,
  ownerId: "seller-1",
  imageUrls: ["https://example.com/img.png"],
  pokemonCard: {
    nameEn: "Charizard Base Set",
    rarity: "Rare Holo",
    setNameEn: "Base Set",
    language: "English",
    localId: "004",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

const MOCK_ORDER = { id: "order-1" };
const MOCK_SESSION = {
  id: "cs_test_123",
  url: "https://checkout.stripe.com/pay/cs_test_123",
};

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated buyer
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });

    // Default: listing found and for sale
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);

    // Default: buyer exists. The route's transaction callback calls
    // prisma.user.findUnique (module-level client, not tx) to double-check
    // the authenticated buyer is a real DB user before reserving the listing.
    mockPrisma.user.findUnique.mockResolvedValue({ id: "buyer-1" });

    // Default: $transaction calls the callback (interactive form) or resolves array
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          order: { create: vi.fn().mockResolvedValue(MOCK_ORDER) },
          user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
        };
        return fnOrOps(mockTx);
      }
      // Sequential array form (updating order + listing with session id)
      return Promise.all(fnOrOps);
    });

    // Default: Stripe checkout session created
    mockStripeInstance.checkout.sessions.create.mockResolvedValue(MOCK_SESSION);

    // Default: order + listing updated with session id
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.listing.update.mockResolvedValue({});
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Not authenticated" });
  });

  // ── Card validation ─────────────────────────────────────────────────────────

  it("returns 404 when card does not exist", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ cardId: "card-x" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "Card not found" });
  });

  it("returns 409 when card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, forSale: false });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is not for sale" });
  });

  it("returns 403 when buyer tries to buy their own card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: LISTING.ownerId } });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "You cannot buy your own card" });
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 when card has no price", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, price: null });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Card has invalid price" });
  });

  it("returns 400 when card price is zero", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, price: 0 });

    const res = await POST(makeRequest({ cardId: "card-1" }));
    expect(res.status).toBe(400);
  });

  // ── Race condition (card snatched by another buyer) ─────────────────────────

  it("returns 500 when the card was just reserved by another buyer", async () => {
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          listing: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, // race lost
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

  it("reservation query's OR clause only allows never-reserved or expired reservations", async () => {
    let capturedWhere: any;
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          listing: {
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

    expect(capturedWhere.OR).toEqual([
      { reservedUntil: null },
      { reservedUntil: { lt: expect.any(Date) } },
    ]);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("reserves listing, creates order, creates Stripe session, returns checkout URL", async () => {
    let capturedOrderData: any;
    mockPrisma.$transaction.mockImplementationOnce(async (fnOrOps) => {
      const mockTx = {
        listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        order: {
          create: vi.fn().mockImplementation((args) => {
            capturedOrderData = args.data;
            return Promise.resolve(MOCK_ORDER);
          }),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ id: "buyer-1" }) },
      };
      return (fnOrOps as any)(mockTx);
    });
    mockPrisma.$transaction.mockImplementationOnce(async (ops) => Promise.all(ops as any));

    const res = await POST(makeRequest({ cardId: "card-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe(MOCK_SESSION.url);

    // The Order is created against the renamed listingId column, keyed off
    // the request body's cardId value.
    expect(capturedOrderData).toMatchObject({ listingId: "card-1", sellerId: LISTING.ownerId });

    // Stripe checkout session created with correct amount, currency, and the
    // resolved title (from the catalog relation, not a flat column)
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "sgd",
              unit_amount: LISTING.price,
              product_data: expect.objectContaining({ name: "Charizard Base Set" }),
            }),
            quantity: 1,
          }),
        ],
        metadata: expect.objectContaining({
          cardId: "card-1",
          buyerId: "buyer-1",
          sellerId: LISTING.ownerId,
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/checkout/route.test.ts`
Expected: FAIL — the route still calls `prisma.card.findUnique`/`tx.card.updateMany` and reads `card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/checkout/route.ts`:

```ts
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma"; // adjust to your path
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const authSession = await getServerSession(authOptions);
  const buyerId = authSession?.user?.id;

  try {
    const body = await req.json();
    const { cardId } = body as { cardId: string };

    if (!buyerId)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    /** * 1) Security & Validation: Fetch authoritative listing data from DB.
     * Prevents buying unlisted items or price manipulation via client-side request.
     */
    const listing = await prisma.listing.findUnique({
      where: { id: cardId },
      include: listingCatalogInclude,
    });
    if (!listing)
      return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (!listing.forSale) {
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    }

    if (listing.ownerId === buyerId) {
      return NextResponse.json(
        { error: "You cannot buy your own card" },
        { status: 403 }
      );
    }

    if (listing.price == null || listing.price <= 0) {
      return NextResponse.json(
        { error: "Card has invalid price" },
        { status: 400 }
      );
    }

    const amount = listing.price;
    // 15 minutes gives a buyer enough time to complete the Stripe Checkout
    // page without holding the card unreasonably long from other buyers.
    // Deliberately under Stripe's 30-minute expires_at minimum — see the
    // comment on the commented-out expires_at below for why the two aren't
    // synced yet.
    const reserveMinutes = 15;
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60_000);

    const order = await prisma.$transaction(async (tx) => {
      // 1. Double-check the buyer exists in the system
      const buyer = await prisma.user.findUnique({
        where: { id: buyerId! },
      });
      if (!buyer) {
        throw new Error("Authenticated buyer not found in database");
      }
      // 2. The "Atomic Reservation"
      // We don't just find the listing; we try to UPDATE it only if it's currently available.
      const updated = await tx.listing.updateMany({
        where: {
          id: cardId,
          forSale: true,
          // A listing is reservable only if it has never been reserved, or its
          // previous reservation has expired. The old third branch
          // (`reservedCheckoutSessionId: null`) let a second buyer steal an
          // *active* reservation during the window between "reservedUntil
          // set" and "Stripe session created" (reservedCheckoutSessionId is
          // only stamped after the session.create() call below returns) —
          // whoever's update ran last would win, and the webhook would
          // later refund whichever buyer actually completed payment.
          OR: [
            { reservedUntil: null }, // Never reserved
            { reservedUntil: { lt: new Date() } }, // Previous reservation expired
          ],
        },
        data: {
          reservedById: buyerId,
          reservedUntil,
        },
      });
      // 3. If updateMany affected 0 rows, it means the listing is being reserved
      if (updated.count !== 1)
        throw new Error("Card just got reserved/sold by someone else");

      // 4. Create the formal Order record linked to this attempt
      return tx.order.create({
        data: {
          listingId: cardId,
          sellerId: listing.ownerId,
          buyerId,
          amount,
          currency: "sgd",
          status: "PENDING",
        },
      });
    });

    /**
     * 3a) Formatting: Convert relative image paths to absolute URLs.
     * Stripe requires full 'http' paths to render images on the checkout page.
     */
    const finalImageUrls = (listing.imageUrls ?? [])
      .filter(Boolean)
      .map((url) => (url.startsWith("http") ? url : `${baseUrl}${url}`));

    const title = withListingDisplay(listing).title;

    // 3) Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            unit_amount: amount,
            product_data: {
              name: title,
              images: finalImageUrls,
              metadata: { cardId },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?cardId=${encodeURIComponent(cardId)}`,
      metadata: {
        orderId: order.id,
        cardId,
        buyerId,
        sellerId: listing.ownerId,
      },
      // expires_at intentionally omitted: Stripe requires it to be at least
      // 30 minutes from session creation, but our DB reservation
      // (reserveMinutes above) is 15 minutes — syncing the two would mean
      // either lengthening the DB hold to 30+ minutes (locking the card from
      // other buyers longer) or building a "resume checkout" flow (find the
      // user's latest PENDING order, redirect back to its still-open
      // session, or create a new one if expired). Deferred as a follow-up;
      // tracked outside this plan.
    });

    // 4) Save session id + tie reservation to this session id
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSessionId: checkoutSession.id },
      }),
      prisma.listing.update({
        where: { id: cardId },
        data: { reservedCheckoutSessionId: checkoutSession.id },
      }),
    ]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/checkout/route.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/route.ts src/__tests__/api/checkout/route.test.ts
git commit -m "fix: rewire POST /api/checkout onto Listing + catalog tables"
```

---

### Task 5: `src/app/api/checkout/cart/route.ts` — multi-item cart checkout

**Files:**
- Modify: `src/app/api/checkout/cart/route.ts`
- Modify: `src/__tests__/api/checkout/cart.test.ts`

**Interfaces:**
- Consumes: `listingCatalogInclude`, `withListingDisplay` from `@/lib/listingDisplay`.

Simplification made here versus the original: the initial `cart.findUnique` query no longer needs to `include: { items: { include: { card: {...} } } }` — every place that used to read `item.card.title` for an error message now just uses `item.listingId`, since the only place a title is actually needed (Stripe line items, validation error messages) already goes through `freshListings`/`listingMap` (which does include the catalog). This drops one unnecessary nested include entirely. The one observable behavior change: the "card no longer exists" error message reads `Card "<id>" no longer exists` instead of `Card "<stale title>" no longer exists` — there's no existing test asserting that exact string, so this is safe.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/checkout/cart.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/checkout/cart.
 *
 * The route:
 *   1. Authenticates the user
 *   2. Fetches selected cart items (listing ids only) + fresh listing data
 *   3. Validates listings (for sale, not own, price > 0)
 *   4. Atomically reserves all listings and creates Orders
 *   5. Creates a Stripe Checkout Session with all items as line items
 *   6. Stamps Orders and Listings with the session ID
 *   7. Returns { url }
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  cart: { findUnique: vi.fn() },
  listing: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  order: { create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockStripeCreate = vi.hoisted(() => vi.fn());
const mockStripe = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockStripeCreate } },
  }))
);

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("stripe", () => ({ default: mockStripe }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/checkout/cart/route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION = { user: { id: "buyer-1" } };

const LISTING = {
  id: "card-1",
  price: 1000,          // 1000 cents = S$10.00
  forSale: true,
  ownerId: "seller-1",
  imageUrls: ["https://example.com/charizard.jpg"],
  pokemonCard: {
    nameEn: "Charizard",
    rarity: "Rare",
    setNameEn: "Base Set",
    language: "English",
    localId: "4",
    tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

const CART_ITEM = {
  id: "cartitem-1",
  listingId: "card-1",
  selected: true,
};

const CART = {
  id: "cart-1",
  userId: "buyer-1",
  items: [CART_ITEM],
};

function makeRequest() {
  return new NextRequest("http://localhost/api/checkout/cart", { method: "POST" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/checkout/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  // What's being tested: auth gate
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  // What's being tested: empty cart / no selected items
  it("returns 400 when cart has no selected items", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce({ id: "cart-1", items: [] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no selected items/i);
  });

  // What's being tested: cart not found returns same 400
  it("returns 400 when cart does not exist", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  // What's being tested: listing no longer for sale is rejected with 409
  it("returns 409 when a listing is no longer for sale", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([{ ...LISTING, forSale: false }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("no longer for sale");
  });

  // What's being tested: buyer trying to purchase their own listing is blocked
  it("returns 400 when buyer tries to buy their own card", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([{ ...LISTING, ownerId: "buyer-1" }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/own card/i);
  });

  // What's being tested: listing with no price is rejected
  it("returns 400 when a listing has no price", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([{ ...LISTING, price: null }]);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no valid price/i);
  });

  // What's being tested: reservation conflict returns a user-friendly 500
  it("returns 500 when a listing is already reserved by another buyer", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([LISTING]);

    mockPrisma.$transaction.mockRejectedValueOnce(
      new Error('"Charizard" was just reserved by another buyer. Please try again.')
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("reserved by another buyer");
  });

  // What's being tested: the reservation query's OR clause only allows
  // never-reserved or expired reservations (same guard as single-item
  // checkout — see Task 4).
  it("reservation query's OR clause only allows never-reserved or expired reservations", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([LISTING]);

    let capturedWhere: any;
    mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
      if (typeof fnOrOps === "function") {
        const mockTx = {
          listing: {
            updateMany: vi.fn().mockImplementation((args) => {
              capturedWhere = args.where;
              return Promise.resolve({ count: 1 });
            }),
          },
          order: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
        };
        return fnOrOps(mockTx);
      }
      return Promise.all(fnOrOps);
    });

    await POST(makeRequest());

    expect(capturedWhere.OR).toEqual([
      { reservedUntil: null },
      { reservedUntil: { lt: expect.any(Date) } },
    ]);
  });

  // What's being tested: happy path — session created, url returned, and
  // the order is created against the renamed listingId column.
  it("creates orders, creates stripe session, returns url", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([LISTING]);

    let capturedOrderData: any;
    mockPrisma.$transaction.mockImplementationOnce(async (fnOrOps) => {
      const mockTx = {
        listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        order: {
          create: vi.fn().mockImplementation((args) => {
            capturedOrderData = args.data;
            return Promise.resolve({ id: "order-1" });
          }),
        },
      };
      return (fnOrOps as any)(mockTx);
    });
    mockPrisma.$transaction.mockImplementationOnce(async (ops) => Promise.all(ops as any));

    mockStripeCreate.mockResolvedValueOnce({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/pay/cs_test_abc");
    expect(capturedOrderData).toMatchObject({ listingId: "card-1", sellerId: "seller-1" });

    // Stripe session should be created with correct metadata and resolved title
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ checkoutType: "cart", buyerId: "buyer-1" }),
        cancel_url: expect.stringContaining("/cart"),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: expect.objectContaining({ name: "Charizard" }),
            }),
          }),
        ],
      })
    );
  });

  // What's being tested: Stripe error surfaces as 500 with message
  it("returns 500 when Stripe session creation fails", async () => {
    mockPrisma.cart.findUnique.mockResolvedValueOnce(CART);
    mockPrisma.listing.findMany.mockResolvedValueOnce([LISTING]);
    mockPrisma.$transaction.mockResolvedValueOnce([
      { orderId: "order-1", listingId: "card-1", sellerId: "seller-1", amount: 1000 },
    ]);
    mockStripeCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/checkout/cart.test.ts`
Expected: FAIL — the route still calls `prisma.card.findMany`/`tx.card.updateMany` and reads `card.title` directly.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/checkout/cart/route.ts`:

```ts
// POST /api/checkout/cart
//
// Creates a single Stripe Checkout Session covering all selected cart items.
//
// Flow:
//   1. Auth + fetch selected cart item listing ids
//   2. Validate every listing (for sale, not own, price > 0) using fresh data
//   3. Atomically reserve all listings + create one Order per listing (single DB transaction)
//   4. Create one Stripe session with all listings as line items
//   5. Stamp every Order and Listing with the Stripe session ID
//   6. Return { url } — caller redirects window.location to the Stripe page
//
// Webhook counterpart: app/api/stripe/webhook/route.ts handles
//   checkout.session.completed  → transfers all listings, cleans up cart
//   checkout.session.expired    → releases all reservations

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(_req: NextRequest) {
  const authSession = await getServerSession(authOptions);
  const buyerId = authSession?.user?.id;

  if (!buyerId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    // ── 1. Fetch selected items' listing ids ──────────────────────────────────
    const cart = await prisma.cart.findUnique({
      where: { userId: buyerId },
      include: {
        items: { where: { selected: true } },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "No selected items in cart" }, { status: 400 });
    }

    // ── 2. Validate every listing using authoritative DB data ───────────────
    // Fetch fresh copies to prevent stale-snapshot attacks (price manipulation, etc.)
    const listingIds = cart.items.map((i) => i.listingId);
    const freshListings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: {
        id: true, price: true, forSale: true, ownerId: true, imageUrls: true,
        ...listingCatalogInclude,
      },
    });
    const listingMap = new Map(freshListings.map((l) => [l.id, withListingDisplay(l)]));

    for (const item of cart.items) {
      const listing = listingMap.get(item.listingId);
      if (!listing) {
        return NextResponse.json({ error: `Card "${item.listingId}" no longer exists` }, { status: 404 });
      }
      if (!listing.forSale) {
        return NextResponse.json({ error: `"${listing.title}" is no longer for sale` }, { status: 409 });
      }
      if (listing.ownerId === buyerId) {
        return NextResponse.json({ error: "Cannot buy your own card" }, { status: 400 });
      }
      if (!listing.price || listing.price <= 0) {
        return NextResponse.json({ error: `"${listing.title}" has no valid price` }, { status: 400 });
      }
    }

    const reservedUntil = new Date(Date.now() + 60_000); // 1-minute reservation window

    // ── 3. Atomic multi-listing reservation + order creation ─────────────────
    // Each listing is reserved only if currently unlocked.
    // Failure of any single reservation rolls back the entire transaction,
    // so we never partially-reserve a cart.
    const orders = await prisma.$transaction(async (tx) => {
      const created: { orderId: string; listingId: string; sellerId: string; amount: number }[] = [];

      for (const item of cart.items) {
        const listing = listingMap.get(item.listingId)!;

        const reserved = await tx.listing.updateMany({
          where: {
            id: listing.id,
            forSale: true,
            // A listing is reservable only if it has never been reserved, or its
            // previous reservation has expired. The old third branch
            // (`reservedCheckoutSessionId: null`) let a second buyer steal an
            // *active* reservation during the window between "reservedUntil
            // set" and "Stripe session created" (reservedCheckoutSessionId is
            // only stamped after the session.create() call below returns) —
            // whoever's update ran last would win, and the webhook would
            // later refund whichever buyer actually completed payment.
            OR: [
              { reservedUntil: null },
              { reservedUntil: { lt: new Date() } },
            ],
          },
          data: { reservedById: buyerId, reservedUntil },
        });

        if (reserved.count !== 1) {
          throw new Error(`"${listing.title}" was just reserved by another buyer. Please try again.`);
        }

        const order = await tx.order.create({
          data: {
            listingId: listing.id,
            sellerId: listing.ownerId,
            buyerId,
            amount: listing.price!,
            currency: "sgd",
            status: "PENDING",
          },
        });

        created.push({ orderId: order.id, listingId: listing.id, sellerId: listing.ownerId, amount: listing.price! });
      }

      return created;
    });

    // ── 4. Build Stripe line items ────────────────────────────────────────────
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orders.map(({ listingId, amount }) => {
      const listing = listingMap.get(listingId)!;
      const imageUrls = (listing.imageUrls ?? [])
        .filter(Boolean)
        .slice(0, 1) // Stripe allows up to 8; one is enough per line item
        .map((url) => (url.startsWith("http") ? url : `${baseUrl}${url}`));

      return {
        price_data: {
          currency: "sgd",
          unit_amount: amount,
          product_data: {
            name: listing.title,
            images: imageUrls,
            metadata: { cardId: listingId },
          },
        },
        quantity: 1,
      };
    });

    // ── 5. Create Stripe Checkout Session ─────────────────────────────────────
    // metadata.checkoutType = "cart" tells the webhook to use the multi-order path.
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,
      metadata: {
        checkoutType: "cart",
        buyerId,
      },
    });

    // ── 6. Stamp Orders + Listings with the session ID ────────────────────────
    await prisma.$transaction([
      ...orders.map(({ orderId }) =>
        prisma.order.update({
          where: { id: orderId },
          data: { stripeCheckoutSessionId: checkoutSession.id },
        })
      ),
      ...orders.map(({ listingId }) =>
        prisma.listing.update({
          where: { id: listingId },
          data: { reservedCheckoutSessionId: checkoutSession.id },
        })
      ),
    ]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout/cart] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/checkout/cart.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/cart/route.ts src/__tests__/api/checkout/cart.test.ts
git commit -m "fix: rewire POST /api/checkout/cart onto Listing + catalog tables"
```

---

### Task 6: `src/app/api/stripe/webhook/route.ts` — payment webhook

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/__tests__/api/stripe/webhook.test.ts`

**Interfaces:**
- Consumes: `transferCardOwnership(tx, { listingId, checkoutSessionId, buyerId })`, `notifySellerCardSold({ sellerId, listingId, orderId })` from `@/lib/webhookHelpers` (Task 2's renamed signatures).

Renames applied throughout: `prisma.card`→`prisma.listing`/`tx.card`→`tx.listing`; every `order.cardId` read becomes `order.listingId`; `tx.cardTransaction.create`'s `cardId` data field becomes `listingId`; `tx.offer.updateMany`'s `where: { cardId }` becomes `where: { listingId }`; the internal `meta` object passed from `handleSessionCompleted` to `handleSingleSessionCompleted` renames its `cardId` key to `listingId` (this is a private interface between two functions in this same file — not a Stripe wire format — so it's fully owned by this rename). Stripe's own `session.metadata.cardId` field name is untouched (external wire format, written by Tasks 4 and 5).

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/__tests__/api/stripe/webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for POST /api/stripe/webhook
 *
 * Two event types are handled:
 *
 *   checkout.session.completed (payment_status: "paid"):
 *     Inside a single DB transaction:
 *       1. Guard: if session already REFUNDED, skip (duplicate event after auto-refund)
 *       2. Idempotency: if CardTransaction for this event+order exists, skip
 *       3. Mark order PAID, attach stripePaymentIntentId
 *       4. Create CardTransaction audit record (stripeEventId = idempotency key)
 *       5. Transfer listing ownership (updateMany with guard on reservedById)
 *       6. Archive all offers on the listing
 *     If the DB transaction fails AFTER payment was captured:
 *       → issue automatic Stripe refund so the customer is made whole
 *       → mark orders REFUNDED, return 200 (Stripe stops retrying)
 *       If the refund itself also fails → return 500 (Stripe retries)
 *
 *   checkout.session.expired:
 *     Mark the order EXPIRED and release the listing reservation.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  refunds:  { create: vi.fn() },
}));

// mockTx is the fake Prisma client injected into the $transaction callback
const mockTx = vi.hoisted(() => ({
  cardTransaction: { findUnique: vi.fn(), create: vi.fn() },
  order:           { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  listing:         { updateMany: vi.fn() },
  offer:           { updateMany: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  order:        { findFirst: vi.fn(), updateMany: vi.fn() },
  // findUnique: post-transaction listing lookup (for the seller notification,
  // via webhookHelpers — mocked separately below).
  // updateMany: used by handleSessionExpired (array-form $transaction).
  listing:      { updateMany: vi.fn() },
}));

const mockNotifySellerCardSold = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
// notifySellerCardSold is fire-and-forget and does its own catalog lookup
// internally (covered by webhookHelpers.test.ts) — mock it here so this
// file only asserts on what the webhook itself is responsible for: calling
// it with the right { sellerId, listingId, orderId }.
vi.mock("@/lib/webhookHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/webhookHelpers")>();
  return { ...actual, notifySellerCardSold: mockNotifySellerCardSold };
});

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST } from "@/app/api/stripe/webhook/route";

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeRequest(body = "raw-body") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

const SESSION_COMPLETED_EVENT = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_status: "paid",
      payment_intent: "pi_123",
      metadata: { orderId: "order-1", cardId: "card-1", buyerId: "buyer-1", sellerId: "seller-1" },
    },
  },
};

const SESSION_EXPIRED_EVENT = {
  id: "evt_2",
  type: "checkout.session.expired",
  data: {
    object: {
      id: "cs_test_456",
      metadata: { orderId: "order-1", cardId: "card-1" },
    },
  },
};

const PENDING_ORDER = {
  id: "order-1",
  listingId: "card-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  amount: 5000,
  currency: "sgd",
  status: "PENDING",
  stripeCheckoutSessionId: "cs_test_123",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_COMPLETED_EVENT);
    mockStripeInstance.refunds.create.mockResolvedValue({ id: "re_123" });

    // Default: no existing REFUNDED orders (session not yet refunded)
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    // Default: session-expiry release.
    mockPrisma.listing.updateMany.mockResolvedValue({ count: 1 });

    // Default: $transaction runs the callback with the mock tx client,
    // with all tx methods pre-set to succeed
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.listing.updateMany.mockResolvedValue({ count: 1 });
      mockTx.offer.updateMany.mockResolvedValue({});
      return fn(mockTx);
    });
  });

  // ── Signature verification ────────────────────────────────────────────────

  it("returns 400 when the stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "raw",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Missing Stripe signature" });
  });

  it("returns 400 when the signature does not match (tampered payload)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid signature" });
  });

  // ── Happy path: checkout.session.completed ────────────────────────────────

  it("marks order PAID, transfers listing, creates transaction record on successful checkout", async () => {
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);

    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "PAID", stripePaymentIntentId: "pi_123" }),
      })
    );
    expect(mockTx.listing.updateMany).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        reservedCheckoutSessionId: "cs_test_123",
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
    expect(mockTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: "order-1", listingId: "card-1", stripeEventId: "evt_1" }),
      })
    );
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listingId: "card-1" } })
    );
    expect(mockNotifySellerCardSold).toHaveBeenCalledWith({
      sellerId: "seller-1",
      listingId: "card-1",
      orderId: "order-1",
    });
  });

  // ── payment_status guard ──────────────────────────────────────────────────

  it("skips processing when payment_status is not paid", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      ...SESSION_COMPLETED_EVENT,
      data: { object: { ...SESSION_COMPLETED_EVENT.data.object, payment_status: "unpaid" } },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Missing metadata ──────────────────────────────────────────────────────

  it("returns 500 when session metadata is incomplete (no auto-refund)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      ...SESSION_COMPLETED_EVENT,
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          payment_intent: "pi_123",
          metadata: { orderId: "order-1" }, // missing cardId, buyerId, sellerId
        },
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it("is idempotent — skips listing transfer if event was already processed", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue({ id: "ct_existing" });
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTx.listing.updateMany).not.toHaveBeenCalled();
  });

  // ── Order not found ───────────────────────────────────────────────────────

  it("issues auto-refund and returns 200 when order does not exist in DB", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(null); // order missing
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123" })
    );
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });

  // ── Transfer guard failure — auto-refund ──────────────────────────────────

  it("issues auto-refund and returns 200 when listing was not reserved by this session", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.listing.updateMany.mockResolvedValue({ count: 0 }); // guard failed
      return fn(mockTx);
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123" })
    );
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } })
    );
  });

  // ── Refund also fails ─────────────────────────────────────────────────────

  it("returns 500 when transfer fails AND Stripe refund also fails", async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      mockTx.cardTransaction.findUnique.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(PENDING_ORDER);
      mockTx.order.update.mockResolvedValue({});
      mockTx.cardTransaction.create.mockResolvedValue({});
      mockTx.listing.updateMany.mockResolvedValue({ count: 0 });
      return fn(mockTx);
    });

    mockStripeInstance.refunds.create.mockRejectedValueOnce(new Error("Stripe refund API down"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── Already refunded guard ────────────────────────────────────────────────

  it("skips processing and returns 200 when session was already refunded", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: "order-1" }); // already REFUNDED

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
  });

  // ── checkout.session.expired ──────────────────────────────────────────────

  it("marks order EXPIRED and clears listing reservation on session expiry", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(SESSION_EXPIRED_EVENT);

    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
  });

  // ── Unknown event type ────────────────────────────────────────────────────

  it("returns 200 for unhandled event types (safe to ignore)", async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      id: "evt_unknown",
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Cart checkout path ─────────────────────────────────────────────────────

  it("processes all orders in a cart session and notifies each seller with the renamed listingId", async () => {
    const CART_EVENT = {
      id: "evt_cart_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_cart_123",
          payment_status: "paid",
          payment_intent: "pi_cart_123",
          metadata: { checkoutType: "cart", buyerId: "buyer-1" },
        },
      },
    };
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(CART_EVENT);

    const CART_ORDER_1 = { id: "order-1", listingId: "card-1", sellerId: "seller-1", buyerId: "buyer-1", amount: 1000, currency: "sgd", status: "PENDING" };
    const CART_ORDER_2 = { id: "order-2", listingId: "card-2", sellerId: "seller-2", buyerId: "buyer-1", amount: 2000, currency: "sgd", status: "PENDING" };

    const mockCartTx = {
      order: { findMany: vi.fn().mockResolvedValue([CART_ORDER_1, CART_ORDER_2]), update: vi.fn().mockResolvedValue({}) },
      cardTransaction: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      offer: { updateMany: vi.fn().mockResolvedValue({}) },
      cart: { findUnique: vi.fn().mockResolvedValue({ id: "cart-1" }) },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockCartTx));

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(mockCartTx.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "card-1" }) })
    );
    expect(mockCartTx.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "card-2" }) })
    );
    expect(mockCartTx.cardTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listingId: "card-1" }) })
    );
    expect(mockCartTx.offer.updateMany).toHaveBeenCalledWith({ where: { listingId: "card-1" }, data: { archivedAt: expect.any(Date) } });
    expect(mockCartTx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart-1", listingId: { in: ["card-1", "card-2"] } },
    });
    expect(mockNotifySellerCardSold).toHaveBeenCalledWith({ sellerId: "seller-1", listingId: "card-1", orderId: "order-1" });
    expect(mockNotifySellerCardSold).toHaveBeenCalledWith({ sellerId: "seller-2", listingId: "card-2", orderId: "order-2" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api/stripe/webhook.test.ts`
Expected: FAIL — the route still calls `tx.card.updateMany`/`prisma.card.updateMany`, reads `order.cardId`, and calls `transferCardOwnership`/`notifySellerCardSold` with the old `cardId` param name.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `src/app/api/stripe/webhook/route.ts`:

```ts
/**
 * POST /api/stripe/webhook
 *
 * This is Stripe's entry point into our system. Every event that Stripe sends
 * (payment completed, session expired, etc.) arrives here as a signed HTTP POST.
 *
 * ── How Stripe webhooks work ────────────────────────────────────────────────
 * Stripe sends events asynchronously. When a buyer completes checkout on Stripe's
 * hosted page, Stripe immediately captures the payment and then fires a
 * `checkout.session.completed` event to this endpoint. The buyer's browser is
 * redirected to our /checkout/success page at roughly the same time, but the
 * webhook and the redirect are INDEPENDENT — do not rely on ordering between them.
 *
 * Stripe retries failed webhooks (non-2xx response) up to 3 days with exponential
 * backoff. This means any handler here can be called more than once for the same
 * event. All processing must be idempotent.
 *
 * ── Event types handled ──────────────────────────────────────────────────────
 *
 *   checkout.session.completed  (payment_status: "paid")
 *     The buyer has paid. Steps (see handleSessionCompleted / handleSingleSessionCompleted
 *     / handleCartSessionCompleted for numbered inline comments):
 *       1.  Verify payment_status === "paid"
 *       2.  Guard: skip if session was already refunded (Stripe retry after auto-refund)
 *       3.  Extract metadata, resolve paymentIntentId
 *       4.  Branch → cart path or single-item path
 *       --- inside the DB transaction ---
 *       5.  Idempotency check — skip if event already processed
 *       6.  Fetch & validate order
 *       7.  Mark order PAID
 *       8.  Create CardTransaction audit record
 *       9.  Transfer listing ownership (guarded updateMany)
 *       10. Archive open offers on the listing
 *       11. (Cart only) Remove purchased items from buyer's cart
 *     If ANY step 7–11 fails → auto-refund fires (see issueRefundOnTransferFailure)
 *
 *   checkout.session.expired
 *     The buyer did not complete payment. Steps:
 *       1. Mark pending orders EXPIRED
 *       2. Release listing reservations so other buyers can purchase
 *
 * ── Single-item vs cart checkout ─────────────────────────────────────────────
 * Our app supports two checkout flows:
 *   - Single-item: one listing → one order → metadata contains orderId/cardId/buyerId/sellerId
 *   - Cart:        N listings → N orders → metadata contains checkoutType="cart" and buyerId
 *
 * The webhook branches on `session.metadata.checkoutType` to handle each case.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";

// Webhooks must run on Node runtime (Stripe SDK + raw-body signature verification)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  // ── Step 1: Verify the webhook signature ─────────────────────────────────
  // Stripe signs every payload with STRIPE_WEBHOOK_SECRET. We verify it before
  // trusting any data — without this, anyone could POST fake events and trigger
  // fraudulent transfers or refunds.
  //
  // Step 1a: Ensure the signature header is present.
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.warn("[webhook] ❌ No signature found in headers");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  // Step 1b: Read the raw body (must be text, not parsed JSON — the signature
  // is computed over the exact bytes Stripe sent; any transformation breaks it)
  // and call constructEvent, which verifies the signature cryptographically.
  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log(`[webhook] ✅ Event verified: ${event.id} [${event.type}]`);
  } catch {
    // constructEvent throws if the signature doesn't match — tampered payload
    // or wrong webhook secret. Return 400 so Stripe knows not to retry.
    console.error(
      "[webhook] ❌ Signature verification failed. Check STRIPE_WEBHOOK_SECRET."
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Step 2: Route to the appropriate handler ──────────────────────────────
  // Any unhandled exception from a handler bubbles up here and returns 500,
  // which tells Stripe to retry the event later.
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSessionCompleted(event);
        break;

      case "checkout.session.expired":
        await handleSessionExpired(event);
        break;

      default:
        // We don't handle this event type — return 200 so Stripe stops sending it.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler failed:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkout.session.completed — entry point
// ─────────────────────────────────────────────────────────────────────────────
//
// Runs two guards before doing any work, then branches to the cart or
// single-item handler depending on session.metadata.checkoutType.

async function handleSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  console.log(`[webhook] 💳 Processing completed session: ${session.id}`);

  // Step 1: payment_status guard
  // Stripe can fire checkout.session.completed even for sessions that weren't
  // paid (e.g. setup mode, free trials). Only proceed when funds are captured.
  if (session.payment_status !== "paid") {
    console.warn(
      `[webhook] ⏳ Not paid (status: ${session.payment_status}). Skipping.`
    );
    return;
  }

  // Step 2: Already-refunded guard
  // If a previous webhook run partially succeeded but then failed during the
  // listing transfer and issued an auto-refund, orders are now REFUNDED. Stripe
  // retries the event, but we must not attempt another transfer. Exit early
  // so the retry is a safe no-op.
  const alreadyRefunded = await prisma.order.findFirst({
    where: { stripeCheckoutSessionId: session.id, status: "REFUNDED" },
    select: { id: true },
  });
  if (alreadyRefunded) {
    console.log(
      `[webhook] ⏩ Session ${session.id} was already refunded. Skipping.`
    );
    return;
  }

  // Step 3: Extract metadata and resolve paymentIntentId
  // Metadata was written by the checkout route when the session was created:
  //   - checkoutType: "cart" → multi-order path; absent → single-order path
  //   - buyerId, orderId, cardId, sellerId: set for single-item checkout only
  // payment_intent may be a string ID or an expanded object — normalise to string
  // so we can pass it to the refund API if needed.
  const { checkoutType, buyerId, orderId, cardId, sellerId } =
    session.metadata || {};
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Step 4: Branch to the correct handler
  if (checkoutType === "cart") {
    await handleCartSessionCompleted(session, event, buyerId!, paymentIntentId);
  } else {
    await handleSingleSessionCompleted(
      session,
      event,
      {
        orderId: orderId!,
        listingId: cardId!,
        buyerId: buyerId!,
        sellerId: sellerId!,
      },
      paymentIntentId
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-refund safeguard — issueRefundOnTransferFailure
// ─────────────────────────────────────────────────────────────────────────────
//
// Called from the catch block of handleCartSessionCompleted and
// handleSingleSessionCompleted whenever a listing transfer fails AFTER Stripe has
// already captured payment. The buyer has been charged but has not received
// their card — we must make them whole immediately.
//
// Steps:
//   1. Verify we have a paymentIntentId (required to call the refund API).
//   2. Call stripe.refunds.create() — returns funds to the buyer's card.
//   3. Mark orders REFUNDED in our DB so any future Stripe retry for this
//      session hits the already-refunded guard (Step 2 above) and exits safely.
//
// Failure modes:
//   - No paymentIntentId → re-throw so webhook returns 500 and Stripe retries.
//     An engineer must issue the refund manually via the Stripe dashboard.
//   - stripe.refunds.create() fails → re-throw the original transfer error so
//     the webhook returns 500 and Stripe retries (refund may succeed next time).

async function issueRefundOnTransferFailure(
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null,
  transferErr: unknown
): Promise<void> {
  console.error(
    `[webhook] ❌ Transfer failed for session ${session.id} — attempting auto-refund:`,
    transferErr
  );

  // Step 1: Verify we have a paymentIntentId to refund against.
  if (!paymentIntentId) {
    console.error(
      `[webhook] ❌ No paymentIntentId for session ${session.id} — cannot auto-refund.`
    );
    throw transferErr; // → webhook returns 500 → Stripe retries → manual intervention
  }

  try {
    // Step 2: Issue the Stripe refund. Stripe processes this asynchronously;
    // funds typically appear within 5–10 business days depending on the issuer.
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    console.log(`[webhook] 💰 Auto-refund issued for session ${session.id}`);

    // Step 3: Stamp orders REFUNDED so that if Stripe retries this webhook event,
    // the already-refunded guard in handleSessionCompleted exits cleanly without
    // attempting another transfer or issuing a duplicate refund.
    // Note: orders are still PENDING here because the DB transaction that would
    // have marked them PAID was rolled back when the transfer failed.
    await prisma.order.updateMany({
      where: { stripeCheckoutSessionId: session.id, status: "PENDING" },
      data: { status: "REFUNDED" },
    });

    // Returning normally (not throwing) is intentional. The caller returns
    // { received: true } with HTTP 200 → Stripe stops retrying. Buyer is refunded.
  } catch (refundErr) {
    // Refund failed — log the refund error but re-throw the original transfer
    // error so Stripe retries the whole event. The refund may succeed next time.
    console.error(
      `[webhook] ❌ CRITICAL: Auto-refund ALSO failed for session ${session.id}.`,
      refundErr
    );
    throw transferErr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart checkout — handleCartSessionCompleted
// ─────────────────────────────────────────────────────────────────────────────
//
// The cart checkout route creates one Order per listing but a single Stripe session
// covering all of them. All N orders are processed inside one DB transaction so
// either ALL listings transfer or NONE do. If the transaction fails, the catch block
// calls issueRefundOnTransferFailure so the buyer gets a full refund.

async function handleCartSessionCompleted(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
  buyerId: string,
  paymentIntentId: string | null
) {
  console.log(`[webhook] 🛒 Cart checkout for buyer ${buyerId}`);

  let soldItems: { sellerId: string; listingId: string; orderId: string }[] = [];

  try {
    soldItems = await prisma.$transaction(async (tx) => {
      // Step 1: Load all orders tied to this Stripe session.
      // Each order was created by the cart checkout route (one per listing).
      const orders = await tx.order.findMany({
        where: { stripeCheckoutSessionId: session.id },
      });

      if (orders.length === 0) {
        // Should never happen if the checkout route ran correctly.
        // Throw → 500 → Stripe retries while we investigate.
        console.error(`[webhook] ❌ No orders found for session ${session.id}`);
        throw new Error("No orders for session");
      }

      const purchasedListingIds: string[] = [];
      // Accumulates sold order info so we can notify sellers after the transaction.
      const soldOrders: { sellerId: string; listingId: string; orderId: string }[] = [];

      for (const order of orders) {
        // Step 2: Idempotency check (per order)
        // The composite unique index @@unique([stripeEventId, orderId]) on
        // CardTransaction is our idempotency key. If a record already exists for
        // this (event, order) pair, we already handled it on a prior webhook
        // delivery. Skip to avoid double-transferring.
        const existingTx = await tx.cardTransaction.findUnique({
          where: {
            stripeEventId_orderId: {
              stripeEventId: event.id,
              orderId: order.id,
            },
          },
        });
        if (existingTx) {
          console.log(
            `[webhook] ⏩ Already processed order ${order.id}. Skipping.`
          );
          continue;
        }

        // Step 3: Mark order PAID
        // Only update if not already PAID — guards against partial retries where
        // this order was processed but a later one in the loop failed.
        if (order.status !== "PAID") {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId ?? undefined,
            },
          });
        }

        // Step 4: Create CardTransaction audit record
        // This is our permanent ledger entry for the sale. The stripeEventId
        // stored here is what the idempotency check in Step 2 looks up.
        await tx.cardTransaction.create({
          data: {
            orderId: order.id,
            listingId: order.listingId,
            sellerId: order.sellerId,
            buyerId,
            amount: order.amount,
            currency: order.currency,
            stripeEventId: event.id,
          },
        });

        // Step 5: Transfer listing ownership
        // The WHERE clause is a concurrency guard — it only matches if the
        // listing is still reserved by THIS exact checkout session and buyer. If
        // another process already transferred or released it, count will be 0
        // and we throw, rolling back the entire transaction (all listings stay
        // with their sellers).
        const movedCount = await transferCardOwnership(tx, {
          listingId: order.listingId,
          checkoutSessionId: session.id,
          buyerId,
        });

        if (movedCount !== 1) {
          console.error(`[webhook] ❌ Listing transfer failed for listing ${order.listingId}. Count: ${movedCount}`);
          throw new Error(`Card transfer failed for order ${order.id}`);
        }

        // Step 6: Archive open offers on this listing
        // Once ownership transfers, all pending offers are invalid. We archive
        // (set archivedAt) rather than delete so history is preserved for
        // buyers and admins.
        await tx.offer.updateMany({
          where: { listingId: order.listingId },
          data: { archivedAt: new Date() },
        });

        purchasedListingIds.push(order.listingId);
        soldOrders.push({ sellerId: order.sellerId, listingId: order.listingId, orderId: order.id });
        console.log(`[webhook] ✅ Transferred listing ${order.listingId}`);
      }

      // Step 7: Remove purchased items from the buyer's cart
      // Now that ownership has transferred, the listings should no longer appear
      // in the cart. Only runs if at least one listing transferred in this delivery.
      if (purchasedListingIds.length > 0) {
        const cart = await tx.cart.findUnique({ where: { userId: buyerId } });
        if (cart) {
          await tx.cartItem.deleteMany({
            where: { cartId: cart.id, listingId: { in: purchasedListingIds } },
          });
        }
      }

      return soldOrders;
    });
  } catch (err) {
    // The DB transaction rolled back — no orders were marked PAID, no listings
    // were transferred. Stripe has already captured the payment.
    // → Hand off to the refund safeguard (see issueRefundOnTransferFailure above).
    await issueRefundOnTransferFailure(session, paymentIntentId, err);
    return;
  }

  // Step 8: Notify each seller — fire-and-forget, one notification per listing sold.
  for (const { sellerId, listingId, orderId } of soldItems) {
    notifySellerCardSold({ sellerId, listingId, orderId });
  }

  console.log(`[webhook] 🎉 Cart checkout complete for session ${session.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-listing checkout — handleSingleSessionCompleted
// ─────────────────────────────────────────────────────────────────────────────
//
// The Buy Now flow creates one Order and one Stripe session. All IDs needed
// (orderId, listingId, buyerId, sellerId) are stored in session.metadata (as
// cardId — the metadata key itself is unchanged; only this function's own
// internal parameter is named listingId).
//
// Important distinction on error handling:
//   Missing metadata → code bug → throw WITHOUT auto-refund (Stripe retries
//   while an engineer investigates; we can't refund without the IDs anyway).
//   Missing order / failed transfer → runtime error → auto-refund fires.

async function handleSingleSessionCompleted(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
  meta: { orderId: string; listingId: string; buyerId: string; sellerId: string },
  paymentIntentId: string | null
) {
  const { orderId, listingId, buyerId, sellerId } = meta;
  console.log(`[webhook] 📋 Single checkout — listing: ${listingId}, order: ${orderId}`);

  // Step 1: Validate metadata
  // Missing IDs = bug in our checkout route (metadata wasn't written correctly).
  // Do NOT auto-refund — we don't have the IDs needed to do so safely, and the
  // bug needs to be fixed before retrying. Throw → 500 → Stripe retries.
  if (!orderId || !listingId || !buyerId || !sellerId) {
    console.error("[webhook] ❌ Missing metadata in single-item session.");
    throw new Error("Missing metadata on session");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Step 2: Idempotency check
      // If a CardTransaction already exists for this (stripeEventId, orderId) pair,
      // we've already handled this Stripe event on a prior delivery. Exit early —
      // do not re-transfer the listing or create duplicate records.
      const existingTx = await tx.cardTransaction.findUnique({
        where: { stripeEventId_orderId: { stripeEventId: event.id, orderId } },
      });
      if (existingTx) {
        console.log("[webhook] ⏩ Event already processed. Skipping.");
        return;
      }

      // Step 3: Fetch and validate the order
      // Re-fetch inside the transaction for a consistent snapshot. The cross-checks
      // below detect data corruption or mismatched metadata between DB and Stripe.
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");

      if (order.listingId !== listingId) throw new Error("Order card mismatch");
      if (order.buyerId !== buyerId) throw new Error("Order buyer mismatch");
      if (order.sellerId !== sellerId) throw new Error("Order seller mismatch");
      if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
        throw new Error("Order session mismatch");
      }

      // Step 3a: Handle already-PAID order (partial retry recovery)
      // A previous run may have succeeded in marking the order PAID but crashed
      // before writing the CardTransaction. Write the audit record and return —
      // do not attempt to re-transfer the listing (it's already been transferred).
      if (order.status === "PAID") {
        await tx.cardTransaction.create({
          data: { orderId, listingId, sellerId, buyerId, amount: order.amount, currency: order.currency, stripeEventId: event.id },
        });
        return;
      }

      // Step 4: Mark order PAID
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID", stripePaymentIntentId: paymentIntentId ?? undefined },
      });

      // Step 5: Create CardTransaction audit record
      // Permanent ledger entry for this sale. The stripeEventId stored here is
      // what the idempotency check in Step 2 looks up on future retries.
      await tx.cardTransaction.create({
        data: { orderId, listingId, sellerId, buyerId, amount: order.amount, currency: order.currency, stripeEventId: event.id },
      });

      // Step 6: Transfer listing ownership
      // The WHERE clause is a concurrency guard: the update only matches if the
      // listing is still reserved by this exact session and buyer. If another
      // process already transferred or released it, count will be 0 → we throw →
      // transaction rolls back → catch block fires the auto-refund (Step 7 below).
      const movedCount = await transferCardOwnership(tx, {
        listingId,
        checkoutSessionId: session.id,
        buyerId,
      });

      if (movedCount !== 1) {
        console.error(`[webhook] ❌ Transfer FAILED. Count: ${movedCount}.`);
        throw new Error("Card was not reserved by this checkout session");
      }

      // Step 7: Archive open offers on this listing
      // Once ownership transfers, all pending offers are invalid. Archived (not
      // deleted) so history is preserved.
      await tx.offer.updateMany({ where: { listingId }, data: { archivedAt: new Date() } });
      console.log("[webhook] 🎉 Single-item transfer successful.");
    });
  } catch (err) {
    // The DB transaction rolled back. Stripe has the money but the listing was not
    // transferred. → Hand off to the refund safeguard (see issueRefundOnTransferFailure above).
    await issueRefundOnTransferFailure(session, paymentIntentId, err);
    return;
  }

  // Notify the seller — fire-and-forget.
  notifySellerCardSold({ sellerId, listingId, orderId });
}

// ─────────────────────────────────────────────────────────────────────────────
// checkout.session.expired — handleSessionExpired
// ─────────────────────────────────────────────────────────────────────────────
//
// The buyer opened the Stripe Checkout page but did not pay before the session
// timed out (default: 24 hours). No money was captured.

async function handleSessionExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  console.log(`[webhook] ⌛ Session expired: ${session.id}`);

  // Step 1 + 2 run in a single transaction so they succeed or fail together.
  // The array form of $transaction is used here (not the interactive callback
  // form) because the two operations are independent — no reads needed between them.
  await prisma.$transaction([
    // Step 1: Mark all pending orders for this session EXPIRED.
    // Prevents them from lingering as PENDING forever in the DB.
    prisma.order.updateMany({
      where: { stripeCheckoutSessionId: session.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    }),
    // Step 2: Release listing reservations.
    // Clears reservedById / reservedUntil / reservedCheckoutSessionId so the
    // listings appear as available again and other buyers can purchase them.
    prisma.listing.updateMany({
      where: { reservedCheckoutSessionId: session.id },
      data: { reservedById: null, reservedUntil: null, reservedCheckoutSessionId: null },
    }),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api/stripe/webhook.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all tests green (this is the last task in the plan — this is the point to confirm nothing outside this plan's direct scope regressed).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/__tests__/api/stripe/webhook.test.ts
git commit -m "fix: rewire Stripe webhook onto Listing + catalog tables"
```

---

## Manual Verification (after all tasks complete)

The plan's tests mock Prisma and Stripe, so they can't prove the real checkout flow works end-to-end. Before finishing this branch:

1. Start the dev server, add a listing to the cart, and confirm `/api/cart` returns correct title/price/rarity for both a Pokémon and the seeded Riftbound listing.
2. Trigger a Buy Now checkout (`POST /api/checkout`) and a cart checkout (`POST /api/checkout/cart`) against the real dev database — confirm both create `Order` rows with `listingId` set and reach Stripe's hosted checkout page with the correct product name and price.
3. If feasible, use the Stripe CLI (`stripe trigger checkout.session.completed` or a real test-mode payment) to confirm the webhook actually transfers ownership and archives offers against the real database, not just mocks.
4. Confirm a notification row is now actually created with `listingId` set (e.g. via Prisma Studio or a direct query) after a card_sold event — this is the regression Task 1 fixes, and it was previously failing completely silently.
