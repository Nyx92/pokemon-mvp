# Riftbound Card Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `Card` into per-game catalog tables (`PokemonCardCatalog`, `RiftboundCardCatalog`) plus a renamed `Listing` table, so Riftbound cards can be added to the marketplace without duplicating any marketplace mechanic.

**Architecture:** Two new catalog tables hold game-specific card identity (name, set, rarity, stats). `Card` is renamed to `Listing`, loses its identity fields, and gains two nullable foreign keys (one per catalog) plus a `game` discriminator. Every other model's `card`/`cardId` field is renamed to `listing`/`listingId`. This is schema + seed data only — no API routes or UI are touched in this plan (that's Plans 2 and 3).

**Tech Stack:** Prisma 6 (schema managed via `prisma db push`, no migration history), PostgreSQL (Supabase), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-riftbound-card-schema-design.md`

## Global Constraints

- This project has no `prisma/migrations` directory and manages its schema via `prisma db push`, not `prisma migrate`. Every schema change in this plan is applied with `db push`, never `migrate dev`/`migrate reset`.
- This project does not use Prisma `enum` types anywhere (see `Order.status`, a plain `String` with an inline comment listing allowed values). The `game` discriminator field follows this convention: `game String // "POKEMON" | "RIFTBOUND"`, not a Prisma enum.
- The rule "exactly one of `pokemonCardId`/`riftboundCardId` is set, matching `game`" is enforced in application code, not a database `CHECK` constraint — this project's `db push` workflow has no mechanism to hand-write custom SQL into a migration.
- Every model's `card Card @relation(...)` / `cardId String` field is renamed to `listing Listing @relation(...)` / `listingId String` (full rename, not a field-name-preserving alias) — this includes `Order`, `Offer`, `CardWatchlist`, `CartItem`, `CardTransaction`, `Auction`. `Notification.cardId` (a plain string with no FK) is renamed to `listingId` for the same reason, even though it isn't a relation.
- `Bid` has no direct `card`/`cardId` field today (it relates only to `Auction`) — it is not touched by this rename. It only changes transitively in that `Auction.cardId` becomes `Auction.listingId`.
- `BestSeller.tcgPlayerId` is explicitly out of scope — it stays a loose string match, not a relation, per the spec's "Out of scope" section.
- Development database data loss during this plan is expected and fine: `prisma/seed.ts` fully deletes and recreates all data on every run, and this is a dev/test Supabase project (confirmed by the existing `script/reset-db.sh` workflow).

---

### Task 1: Add the two catalog models

**Files:**
- Modify: `prisma/schema.prisma` (insert two new models; no existing models change in this task)

**Interfaces:**
- Consumes: nothing from earlier tasks (first task in this plan)
- Produces: `PokemonCardCatalog` and `RiftboundCardCatalog` Prisma models, with generated Prisma Client types `PokemonCardCatalog` and `RiftboundCardCatalog` (importable from `@prisma/client`). Later tasks reference these by name and by these exact field names.

- [ ] **Step 1: Insert the two catalog models into `prisma/schema.prisma`**

Insert this block immediately before `model Card {` (currently at line 134, right after the `// 🃏 Card — represents a single Pokémon card in a user's collection` comment block's preceding blank line — i.e. insert between the `Binder` model's closing `}` and the `// 🃏 Card` comment):

```prisma
// One row per real, canonical Pokémon card — shared by every seller who
// lists that card. This is "what card is this," not "this seller's copy of
// it" (that's Listing, below). externalId is required+unique but has no
// real source data yet — seed data uses invented "mock-*" slugs until a
// real card-index import exists.
model PokemonCardCatalog {
  id               String   @id @default(uuid())
  externalId       String   @unique   // stable id from the source card index, e.g. "sv3pt5-016"
  nameEn           String
  nameJa           String?
  hp               Int?
  stage            String?
  types            String[]
  dexIds           Int[]
  illustrator      String?
  isFirstEdition   Boolean  @default(false)
  language         String   // print-language classification; carried through
                             // as-is from the source index alongside the
                             // separate nameEn/nameJa fields
  regulationMark   String?
  localId          String?  // card number within its set, e.g. "016" or "SV107"
  setId            String
  setNameEn        String
  setNameJa        String?
  setReleaseDate   DateTime?
  setTotal         Int?
  rarity           String
  year             Int?
  tcgPlayerId      String?
  listings         Listing[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([setId])
}

// One row per real, canonical Riftbound card. Same role as
// PokemonCardCatalog above, for the other game.
model RiftboundCardCatalog {
  id               String   @id @default(uuid())
  riftboundId      String   @unique   // e.g. "unl-176-219" — set + collector number + set total
  name             String
  type             String   // e.g. "Unit"
  supertype        String   // e.g. "Champion"
  rarity           String
  domain           String?
  energy           Int?
  might            Int?
  power            Int?
  artist           String?
  alternateArt     Boolean  @default(false)
  signature        Boolean  @default(false)
  overnumbered     Boolean  @default(false)
  tags             String[]
  textFlavour      String?
  textPlain        String?
  setId            String
  setLabel         String
  collectorNumber  String   // string, not Int — overnumbered variants carry a suffix
  imageUrl         String
  tcgPlayerId      String?
  listings         Listing[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([setId])
}

```

Note: both models declare `listings Listing[]` — this is a forward reference to a relation field that Task 2 adds to `Listing`. Prisma allows this in a single schema file (the whole file is parsed together), but it means this task's `db push` will only succeed once Task 2's `pokemonCard`/`riftboundCard` relation fields also exist. **Do not run `db push` at the end of this task** — run it once at the end of Task 2 instead, when the schema is internally consistent. Skip straight to Step 2.

- [ ] **Step 2: Validate the schema file parses (without pushing yet)**

Run: `npx prisma validate`
Expected: fails with an error naming `Listing` as an undefined type (referenced by `listings Listing[]` on both new models, plus the relation fields these models don't have yet) — for example `Error validating field \`listings\` in model \`PokemonCardCatalog\`: The relation field \`listings\` on model \`PokemonCardCatalog\` is missing an opposite relation field on the model \`Listing\`.` This confirms the two new models were inserted with the correct syntax; the "missing opposite relation" is expected and resolved by Task 2.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add PokemonCardCatalog and RiftboundCardCatalog models

Not yet pushed to the database — Listing doesn't have the opposite
relation fields yet (added in the next commit). Schema is
intentionally not push-valid until then."
```

---

### Task 2: Rename Card to Listing, wire up catalog relations, rename every relation

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: `PokemonCardCatalog`, `RiftboundCardCatalog` from Task 1 (exact model names, exact field names `id`, `tcgPlayerId`).
- Produces: `Listing` Prisma model (renamed from `Card`) with fields `id`, `game`, `pokemonCard`/`pokemonCardId`, `riftboundCard`/`riftboundCardId`, `price`, `condition`, `description`, `imageUrls`, `forSale`, `reservedBy`/`reservedById`/`reservedUntil`/`reservedCheckoutSessionId`, `binder`/`binderId`, `owner`/`ownerId`, `offers`, `transactions`, `orders`, `watchlist`, `cartItems`, `inAuction`, `auctions`, `createdAt`, `updatedAt`. Every later task and every later plan (2 and 3) uses `Listing`/`listing`/`listingId`, never `Card`/`card`/`cardId`, from this point on.

- [ ] **Step 1: Replace the `Card` model with `Listing`**

Replace the entire block from `// 🃏 Card — represents a single Pokémon card in a user's collection` through the closing `}` of `model Card` (lines 133–180 today) with:

```prisma
// 🃏 Listing — one seller's specific physical copy of a card, listed for
// sale. Renamed from Card. Exactly one of pokemonCardId/riftboundCardId is
// set, matching `game` — enforced by assertValidListingCatalogRefs() in
// src/lib/listingCatalog.ts (Task 3), not a database CHECK constraint,
// since this project has no migration history to hand-write one into.
model Listing {
  id           String     @id @default(uuid())
  game         String     // "POKEMON" | "RIFTBOUND"

  pokemonCard   PokemonCardCatalog?   @relation(fields: [pokemonCardId], references: [id])
  pokemonCardId String?
  riftboundCard   RiftboundCardCatalog? @relation(fields: [riftboundCardId], references: [id])
  riftboundCardId String?

  price        Int?
  condition    String
  description  String?
  imageUrls    String[]   // URLs to Supabase Storage images — photos of this specific physical copy
  forSale      Boolean    @default(false)

  // Reservation fields — used by the Buy Now Stripe Checkout flow to prevent
  // double-selling while the buyer is on Stripe's hosted payment page.
  // When a buyer starts checkout, the listing is locked for a short window
  // (reservedUntil). On payment success the lock is cleared and ownership transfers.
  reservedBy                User?     @relation("CardReservations", fields: [reservedById], references: [id], onDelete: SetNull)
  reservedById              String?
  reservedUntil             DateTime?
  // Multiple listings can share the same session ID (cart checkout).
  reservedCheckoutSessionId String?

  // Relations
  binder       Binder?    @relation(fields: [binderId], references: [id], onDelete: SetNull)
  binderId     String?
  owner        User       @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId      String
  offers       Offer[]
  transactions CardTransaction[]
  orders       Order[]
  watchlist    CardWatchlist[]
  cartItems    CartItem[]
  // Auction listings for this card (multiple allowed over time — one active at a time,
  // enforced at the application layer via Listing.inAuction).
  inAuction    Boolean  @default(false)
  auctions     Auction[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([ownerId])
  @@index([forSale])
  @@index([game])
  @@index([pokemonCardId])
  @@index([riftboundCardId])
}
```

- [ ] **Step 2: Rename the two `Card[]` relation fields on `User`**

In `model User`, change:
```prisma
  cards         Card[]
```
to:
```prisma
  listings      Listing[]
```

And change:
```prisma
  reservedCards Card[] @relation("CardReservations")
```
to:
```prisma
  reservedListings Listing[] @relation("CardReservations")
```

(The relation name string `"CardReservations"` stays as-is — it's an internal Prisma relation identifier, not a model/field name, and doesn't need to change for the rename to be complete.)

- [ ] **Step 3: Rename the `Card[]` relation field on `Binder`**

In `model Binder`, change:
```prisma
  // Relation: A binder contains multiple cards
  cards     Card[]
```
to:
```prisma
  // Relation: A binder contains multiple listings
  listings  Listing[]
```

- [ ] **Step 4: Rename `card`/`cardId` on `Order`**

Change:
```prisma
  card              Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId             String
```
to:
```prisma
  listing            Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId          String
```

- [ ] **Step 5: Rename `card`/`cardId` on `Offer`**

Change:
```prisma
  // Relations
  card        Card      @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId      String
```
to:
```prisma
  // Relations
  listing     Listing   @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId   String
```

Also update the comment a few lines above (currently `// Set when the card changes ownership (sold). New owner won't see archived offers,`) to say `// Set when the listing changes ownership (sold). New owner won't see archived offers,` — and update `@@index([cardId])` near the bottom of the model to `@@index([listingId])`.

Also update the comment two lines above `seller` (`// Snapshot of who the seller was at offer-creation time.` / `// card.ownerId changes when the card is transferred, ...`) to read `// listing.ownerId changes when the listing is transferred, ...`.

- [ ] **Step 6: Update the stale comment on `BestSeller`**

Change:
```prisma
  tcgPlayerId String   @unique // maps to Card.tcgPlayerId
```
to:
```prisma
  tcgPlayerId String   @unique // maps to a catalog row's tcgPlayerId (PokemonCardCatalog or RiftboundCardCatalog) — loose string match, not a real relation; see spec's "Out of scope" section
```

This is a comment-only change — `BestSeller`'s own fields are untouched, per the spec.

- [ ] **Step 7: Rename `card`/`cardId` on `CardWatchlist`**

Change:
```prisma
model CardWatchlist {
  id        String   @id @default(uuid())
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime @default(now())

  @@unique([cardId, userId])
}
```
to:
```prisma
model CardWatchlist {
  id        String   @id @default(uuid())
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  createdAt DateTime @default(now())

  @@unique([listingId, userId])
}
```

- [ ] **Step 8: Rename `card`/`cardId` on `CartItem`**

Change:
```prisma
model CartItem {
  id        String   @id @default(uuid())
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  cartId    String
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId    String
  // Whether this item is checked for checkout (user can uncheck individual items)
  selected  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([cartId, cardId])
}
```
to:
```prisma
model CartItem {
  id        String   @id @default(uuid())
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  cartId    String
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId String
  // Whether this item is checked for checkout (user can uncheck individual items)
  selected  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([cartId, listingId])
}
```

- [ ] **Step 9: Rename `cardId` on `Notification`**

Change:
```prisma
  // Optional IDs for deep-linking into the relevant page.
  // Stored as plain strings (no FK) so the notification survives if the
  // linked record is later deleted.
  offerId   String?
  cardId    String?
  orderId   String?
```
to:
```prisma
  // Optional IDs for deep-linking into the relevant page.
  // Stored as plain strings (no FK) so the notification survives if the
  // linked record is later deleted.
  offerId   String?
  listingId String?
  orderId   String?
```

- [ ] **Step 10: Rename `card`/`cardId` on `CardTransaction`**

Change:
```prisma
  card          Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId        String
```
to:
```prisma
  listing       Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId     String
```

- [ ] **Step 11: Rename `card`/`cardId` on `Auction`, and update its doc comment**

Change:
```prisma
// One active auction per card is enforced at the application layer (Card.inAuction flag).
// Historical auction rows are kept for audit/display after the card is sold.
model Auction {
  id        String @id @default(uuid())
  card      Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId    String
```
to:
```prisma
// One active auction per listing is enforced at the application layer (Listing.inAuction flag).
// Historical auction rows are kept for audit/display after the listing is sold.
model Auction {
  id        String @id @default(uuid())
  listing   Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  listingId String
```

- [ ] **Step 12: Format, push, and generate**

Run: `npx prisma format`
Expected: reformats the file with consistent column alignment, no errors.

Run: `npx prisma db push --accept-data-loss`
Expected: succeeds, reporting that `Card` is dropped and `Listing`/`PokemonCardCatalog`/`RiftboundCardCatalog` are created, along with the renamed columns on `Order`/`Offer`/`CardWatchlist`/`CartItem`/`Notification`/`CardTransaction`/`Auction`. `--accept-data-loss` is required and safe here: this is a dev/test database, and Task 4 fully repopulates it via `prisma/seed.ts`, which already deletes all data on every run.

Run: `npx prisma generate`
Expected: succeeds, regenerating `@prisma/client` types for `Listing`, `PokemonCardCatalog`, `RiftboundCardCatalog`, and the renamed fields on every other model.

- [ ] **Step 13: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: rename Card to Listing, add catalog relations

Every model's card/cardId field is renamed to listing/listingId
(Order, Offer, CardWatchlist, CartItem, CardTransaction, Auction,
Notification). Card's identity fields (title, tcgPlayerId, language,
cardNumber, setName, rarity) are removed — they now live on
PokemonCardCatalog/RiftboundCardCatalog, reached via the new
pokemonCard/riftboundCard relations."
```

---

### Task 3: Add the catalog-consistency validation helper

**Files:**
- Create: `src/lib/listingCatalog.ts`
- Test: `src/__tests__/lib/listingCatalog.test.ts`

**Interfaces:**
- Consumes: nothing beyond plain TypeScript types (no Prisma import needed — this is pure validation logic over plain values, so it stays trivially unit-testable and reusable from both API routes and the seed script).
- Produces: `ListingGame` type (`"POKEMON" | "RIFTBOUND"`), `ListingCatalogRefs` interface (`{ game: ListingGame; pokemonCardId?: string | null; riftboundCardId?: string | null }`), and `assertValidListingCatalogRefs(refs: ListingCatalogRefs): void` — throws `Error` with a descriptive message on any invalid combination, returns `undefined` otherwise. Plan 2 (backend rewiring) calls this from every API route that creates or updates a `Listing`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/listingCatalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assertValidListingCatalogRefs } from "@/lib/listingCatalog";

describe("assertValidListingCatalogRefs", () => {
  it("passes for a valid POKEMON listing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "POKEMON", pokemonCardId: "poke-1" })
    ).not.toThrow();
  });

  it("passes for a valid RIFTBOUND listing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "RIFTBOUND", riftboundCardId: "rift-1" })
    ).not.toThrow();
  });

  it("throws when both catalog IDs are set", () => {
    expect(() =>
      assertValidListingCatalogRefs({
        game: "POKEMON",
        pokemonCardId: "poke-1",
        riftboundCardId: "rift-1",
      })
    ).toThrow(/cannot reference both/i);
  });

  it("throws when neither catalog ID is set", () => {
    expect(() => assertValidListingCatalogRefs({ game: "POKEMON" })).toThrow(
      /must reference exactly one/i
    );
  });

  it("throws when game is POKEMON but pokemonCardId is missing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "POKEMON", riftboundCardId: "rift-1" })
    ).toThrow(/cannot reference both/i);
  });

  it("throws when game is RIFTBOUND but riftboundCardId is missing", () => {
    expect(() =>
      assertValidListingCatalogRefs({ game: "RIFTBOUND", pokemonCardId: "poke-1" })
    ).toThrow(/cannot reference both/i);
  });
});
```

(The last two cases resolve to the same "cannot reference both" error as the mismatched-game case is really just "the wrong one is set" — a `POKEMON` listing with only `riftboundCardId` set has exactly one catalog ID set, but it's the wrong one, which the implementation in Step 3 treats as a game/catalog mismatch, not a count mismatch. This is intentional: see Step 3's ordering.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/lib/listingCatalog.test.ts`
Expected: FAIL — `Cannot find module '@/lib/listingCatalog'` (the file doesn't exist yet).

- [ ] **Step 3: Implement the validation helper**

Create `src/lib/listingCatalog.ts`:

```ts
// src/lib/listingCatalog.ts
//
// Enforces the one rule a Postgres foreign key can't express by itself: a
// Listing must reference exactly one catalog row, and it must be the one
// matching `game`. This project manages its schema via `prisma db push`
// (no migration history), so a database CHECK constraint isn't practically
// available here — this rule lives in application code instead, called
// from every place a Listing is created or updated with new catalog refs.

export type ListingGame = "POKEMON" | "RIFTBOUND";

export interface ListingCatalogRefs {
  game: ListingGame;
  pokemonCardId?: string | null;
  riftboundCardId?: string | null;
}

export function assertValidListingCatalogRefs(refs: ListingCatalogRefs): void {
  const hasPokemon = refs.pokemonCardId != null;
  const hasRiftbound = refs.riftboundCardId != null;

  if (hasPokemon && hasRiftbound) {
    throw new Error(
      "A listing cannot reference both a Pokémon and a Riftbound catalog card."
    );
  }
  if (!hasPokemon && !hasRiftbound) {
    throw new Error("A listing must reference exactly one catalog card.");
  }
  if (refs.game === "POKEMON" && !hasPokemon) {
    throw new Error(
      'A listing with game "POKEMON" cannot reference both a Pokémon and a Riftbound catalog card — it must reference a PokemonCardCatalog row, not a RiftboundCardCatalog row.'
    );
  }
  if (refs.game === "RIFTBOUND" && !hasRiftbound) {
    throw new Error(
      'A listing with game "RIFTBOUND" cannot reference both a Pokémon and a Riftbound catalog card — it must reference a RiftboundCardCatalog row, not a PokemonCardCatalog row.'
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/lib/listingCatalog.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/listingCatalog.ts src/__tests__/lib/listingCatalog.test.ts
git commit -m "feat: add assertValidListingCatalogRefs validation helper

Enforces exactly-one-catalog-FK-matching-game at the application
layer, since this project's db-push schema workflow has no
migration to hand-write a CHECK constraint into."
```

---

### Task 4: Rewrite the seed script for the new schema, and add Riftbound seed data

**Files:**
- Modify: `prisma/seed.ts` (full rewrite of the card/listing-creation sections; user/binder/best-seller sections are unchanged)

**Interfaces:**
- Consumes: `PokemonCardCatalog`, `RiftboundCardCatalog`, `Listing` Prisma Client models (Tasks 1–2); no dependency on Task 3's validation helper (seed data is written directly with correct `game`/catalog-ID pairs, so there's nothing to validate against user input here).
- Produces: a working `npx prisma db seed` run that populates catalog + listing data for both games. Nothing later in this plan consumes seed.ts's internals — this is the last task in Plan 1.

Context for this task: the existing seed data has a handful of pre-existing inconsistencies that the old flat `Card` model let slide (e.g. one "Psyduck" test-auction listing reused Charizard's `tcgPlayerId`; a "Gyarados VMAX" test-auction listing reused Starmie's `tcgPlayerId`; one Starmie GX listing is the only one marked `language: "Japanese"` despite otherwise matching the English Starmie GX card exactly). Normalizing into catalog rows forces each of these to resolve to *some* real catalog identity, so this task treats each one as a distinct catalog entry (documented inline in the new file) rather than silently perpetuating a stray copy-pasted ID under the new schema. This is the minimum change necessary to represent the existing data under the new model — it does not add new test scenarios beyond what already existed.

- [ ] **Step 1: Replace the cleanup block**

In `prisma/seed.ts`, change:
```ts
  // ✅ Clean up (child tables first)
  // Bid references Auction
  await prisma.bid.deleteMany();
  // CardTransaction references Order/Card/User
  await prisma.cardTransaction.deleteMany();
  // Offer references Card/User
  await prisma.offer.deleteMany();
  // Order references Card/User
  await prisma.order.deleteMany();
  // Auction references Card/User
  await prisma.auction.deleteMany();
  // Card references Binder/User
  await prisma.card.deleteMany();
  // Binder references User
  await prisma.binder.deleteMany();
  // User references Account/Session (if you have these tables populated in dev)
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  // BestSeller is standalone
  await prisma.bestSeller.deleteMany();
```
to:
```ts
  // ✅ Clean up (child tables first)
  // Bid references Auction
  await prisma.bid.deleteMany();
  // CardTransaction references Order/Listing/User
  await prisma.cardTransaction.deleteMany();
  // Offer references Listing/User
  await prisma.offer.deleteMany();
  // Order references Listing/User
  await prisma.order.deleteMany();
  // Auction references Listing/User
  await prisma.auction.deleteMany();
  // Listing references Binder/User/catalog tables
  await prisma.listing.deleteMany();
  // Catalog tables are standalone (only referenced by Listing, already cleared above)
  await prisma.pokemonCardCatalog.deleteMany();
  await prisma.riftboundCardCatalog.deleteMany();
  // Binder references User
  await prisma.binder.deleteMany();
  // User references Account/Session (if you have these tables populated in dev)
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  // BestSeller is standalone
  await prisma.bestSeller.deleteMany();
```

- [ ] **Step 2: Replace the Pokémon card-creation section with catalog rows + listings**

Replace everything from `// Ash’s Cards` (the comment right after `console.log("✅ Uploaded all mock images");`) through the end of the block that currently reads `console.log("✅ Extra best-seller cards created");` — i.e. every `prisma.card.create`/`prisma.card.createMany` call for Ash's and Misty's regular (non-auction) cards — with:

```ts
  // ── Pokémon catalog — one row per real card, shared by every listing of it ──
  // externalId values are invented "mock-*" slugs: this seed data predates any
  // real card-index import, so there's no real source-index id to carry over.
  const pokemonCatalog = {
    charizardVmax: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-shining-fates-charizard-vmax",
        nameEn: "Charizard VMAX",
        localId: "SV107",
        setNameEn: "Shining Fates",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "232496",
      },
    }),
    venusaurV: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-champions-path-venusaur-v",
        nameEn: "Venusaur V",
        localId: "01/73",
        setNameEn: "Champion's Path",
        rarity: "Rare",
        language: "English",
        tcgPlayerId: "222990",
      },
    }),
    blastoiseHoloRare: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-base-set-blastoise-holo-rare",
        nameEn: "Blastoise Holo Rare",
        localId: "002/102",
        setNameEn: "Base Set",
        rarity: "Holo Rare",
        language: "English",
        tcgPlayerId: "42360",
      },
    }),
    starmieGxEn: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-hidden-fates-starmie-gx-en",
        nameEn: "Starmie GX",
        localId: "14/68",
        setNameEn: "Hidden Fates",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "197658",
      },
    }),
    // Separate catalog row for the Japanese print — language is catalog-level
    // (per the design spec), so a different-language print of the same card
    // is a different catalog row, not a per-listing field.
    starmieGxJp: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-hidden-fates-starmie-gx-jp",
        nameEn: "Starmie GX",
        localId: "14/68",
        setNameEn: "Hidden Fates",
        rarity: "Ultra Rare",
        language: "Japanese",
        tcgPlayerId: "197659",
      },
    }),
    psyduck: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-platinum-psyduck",
        nameEn: "Psyduck",
        localId: "87/127",
        setNameEn: "Platinum",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "88439",
      },
    }),
    gyaradosVmax: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-evolving-skies-gyarados-vmax",
        nameEn: "Gyarados VMAX",
        localId: "109/203",
        setNameEn: "Evolving Skies",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "246724",
      },
    }),
    shuckle: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-neo-revelation-shuckle",
        nameEn: "Shuckle",
        localId: "70/64",
        setNameEn: "Neo Revelation",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "14936",
      },
    }),
    psyduckV: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-fusion-strike-psyduck-v",
        nameEn: "Psyduck V",
        localId: "062/100",
        setNameEn: "Fusion Strike",
        rarity: "Rare",
        language: "Japanese",
        tcgPlayerId: "441629",
      },
    }),
    // The "quick-expiry test auctions" section (below) has three listings whose
    // original tcgPlayerId/set/number didn't match any of the cards above —
    // each becomes its own catalog row rather than silently pointing at the
    // wrong card's identity now that identity is normalized.
    psyduckBaseSet: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-base-set-psyduck",
        nameEn: "Psyduck",
        localId: "053/102",
        setNameEn: "Base Set",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "88900",
      },
    }),
    gyaradosVmaxVividVoltage: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-vivid-voltage-gyarados-vmax",
        nameEn: "Gyarados VMAX",
        localId: "022/185",
        setNameEn: "Vivid Voltage",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "246800",
      },
    }),
  };

  console.log("✅ Pokémon catalog created:", Object.keys(pokemonCatalog).length, "cards");

  // Ash’s Cards
  // Create listings (use create() so we can capture ids easily)
  const charizard = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.charizardVmax.id,
      price: dollarsToCents(120),
      condition: "Mint",
      description: "A stunning Charizard VMAX with fiery holo effect.",
      imageUrls: [mockImageUrlOne],
      forSale: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  await prisma.listing.createMany({
    data: [
      // ── Venusaur V — raw grades ─────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(120),
        condition: "Near Mint",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(90),
        condition: "Lightly Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(65),
        condition: "Moderately Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(40),
        condition: "Heavily Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: null,
        condition: "Damaged",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: false,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      // ── Venusaur V — graded ─────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(380),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — flawless Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(220),
        condition: "PSA 9",
        description: "PSA 9 Mint — near-perfect Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(290),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — stunning sub-grade Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      // ── Blastoise Holo Rare — raw grades ────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(120),
        condition: "Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(100),
        condition: "Near Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(50),
        condition: "Heavily Played",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      // ── Blastoise Holo Rare — graded ────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(480),
        condition: "PSA 8",
        description: "PSA 8 NM-MT — classic Blastoise holo in excellent shape.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(350),
        condition: "CGC 9 Mint",
        description: "CGC 9 Mint — classic Blastoise holo certified by CGC.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: null,
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — classic Blastoise holo certified by SGC.",
        imageUrls: [mockImageUrlThree],
        forSale: false,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
    ],
  });

  // Misty’s Cards 💧
  await prisma.listing.createMany({
    data: [
      // ── Starmie GX — raw grades ─────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(60),
        condition: "Mint",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(45),
        condition: "Near Mint",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(28),
        condition: "Lightly Played",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: null,
        condition: "Damaged",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: false,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Starmie GX — graded ─────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(180),
        condition: "PSA 9",
        description: "PSA 9 Mint — Misty’s Starmie GX in near-perfect shape.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(140),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — beautifully graded Starmie GX.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Psyduck ─────────────────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: null,
        condition: "Lightly Played",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: false,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: dollarsToCents(8),
        condition: "Near Mint",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: dollarsToCents(120),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — a surprisingly valuable Psyduck.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Gyarados VMAX — raw grades ──────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(95),
        condition: "Near Mint",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(70),
        condition: "Lightly Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(35),
        condition: "Heavily Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Gyarados VMAX — graded ──────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(320),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — the apex predator, perfectly graded.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(210),
        condition: "CGC 9.5 Gem Mint",
        description: "CGC 9.5 Gem Mint — top-tier Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(175),
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — certified Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
    ],
  });

  console.log("✅ Listings created for Ash and Misty");

  // ── Extra best-seller listings ─────────────────────────────────────────────
  // Two more listings to fill positions 6 and 7 in the Best Sellers row.
  await prisma.listing.createMany({
    data: [
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.shuckle.id,
        price: dollarsToCents(220),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — the rarest Shuckle you'll ever see.",
        imageUrls: [mockImageUrlShuckle],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.shuckle.id,
        price: dollarsToCents(90),
        condition: "Near Mint",
        description: "Shuckle from Neo Revelation in great shape.",
        imageUrls: [mockImageUrlShuckle],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduckV.id,
        price: dollarsToCents(55),
        condition: "Mint",
        description: "Psyduck V — a modern staple with confusing energy.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduckV.id,
        price: dollarsToCents(40),
        condition: "Near Mint",
        description: "Psyduck V in near-mint condition.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
    ],
  });

  console.log("✅ Extra best-seller listings created");
```

- [ ] **Step 3: Replace the auction-card creation section**

Replace the ten `prisma.card.create({ ... })` calls (`auctionCard1` through `auctionCard10`) with:

```ts
  const auctionCard1 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.charizardVmax.id,
      price: null,
      condition: "Near Mint",
      description: "Auction-only Charizard VMAX — rare chance to own this fire holo.",
      imageUrls: [mockImageUrlOne],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard2 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
      price: null,
      condition: "Lightly Played",
      description: "Vintage Base Set Blastoise in auction — light play only.",
      imageUrls: [mockImageUrlThree],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard3 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.gyaradosVmax.id,
      price: null,
      condition: "Mint",
      description: "Mint-condition Gyarados VMAX in auction — closing soon.",
      imageUrls: [mockImageUrlSix],
      forSale: false,
      inAuction: true,
      binderId: waterBinder.id,
      ownerId: misty.id,
    },
  });

  const auctionCard4 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.venusaurV.id,
      price: null,
      condition: "Near Mint",
      description: "Venusaur V — Grass-type powerhouse in a multi-day auction.",
      imageUrls: [mockImageUrlTwo],
      forSale: false,
      inAuction: true,
      binderId: grassBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard5 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.starmieGxJp.id,
      price: null,
      condition: "Mint",
      description: "Starmie GX in a 2-day auction — get your bids in early.",
      imageUrls: [mockImageUrlFour],
      forSale: false,
      inAuction: true,
      binderId: waterBinder.id,
      ownerId: misty.id,
    },
  });

  const auctionCard6 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.shuckle.id,
      price: null,
      condition: "PSA 10",
      description: "PSA 10 Shuckle in a 3-day auction — a true collector's gem.",
      imageUrls: [mockImageUrlShuckle],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  // ── Quick-expiry test auctions (5 / 6 / 7 / 10 min) ─────────────────────
  // All owned by Ash. Log in as Misty to place bids and test the different paths.
  //
  //  Listing 7  (10 min) — has RP $80, BO $150 → bid below RP → pending_seller_decision
  //  Listing 8  ( 5 min) — no RP, no BO        → let expire untouched → expiredNoBids
  //  Listing 9  ( 6 min) — has RP $50, BO $120 → bid above $50 RP → cron auto-settles
  //  Listing 10 ( 7 min) — has RP $80, no BO   → bid below $80 RP → pending_seller_decision
  const auctionCard7 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
      price: null,
      condition: "Mint",
      description: "TEST (10 min) — bid below S$80 RP to trigger pending_seller_decision, or S$150 BO for instant win.",
      imageUrls: [mockImageUrlThree],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard8 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.psyduckBaseSet.id,
      price: null,
      condition: "Near Mint",
      description: "TEST (5 min) — no RP, no BO. Leave it with zero bids and fire the cron to test the expiredNoBids path.",
      imageUrls: [mockImageUrlFive],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard9 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.gyaradosVmaxVividVoltage.id,
      price: null,
      condition: "Near Mint",
      description: "TEST (6 min) — has RP $50, BO $120. Bid above S$50 RP (e.g. S$60) and let it expire — cron should auto-settle without seller action.",
      imageUrls: [mockImageUrlSix],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard10 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.starmieGxEn.id,
      price: null,
      condition: "Mint",
      description: "TEST (7 min) — has RP $80, no BO. Bid below S$80 RP (e.g. S$40) and let it expire — cron should move to pending_seller_decision.",
      imageUrls: [mockImageUrlFour],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });
```

- [ ] **Step 4: Rename `cardId` to `listingId` in the `prisma.auction.createMany` call**

In the `await prisma.auction.createMany({ data: [ ... ] })` block, change every `cardId: auctionCardN.id,` to `listingId: auctionCardN.id,` (ten occurrences, one per auction entry — the rest of each object, `sellerId`/`startingBid`/`reservePrice`/`buyOutPrice`/`status`/`endsAt`, is unchanged).

- [ ] **Step 5: Rename `cardId` to `listingId` in the offer/order/transaction seed block**

Change:
```ts
  // Offer — Misty (buyer) offers on Ash's Charizard (seller)
  const offer = await prisma.offer.create({
    data: {
      price: dollarsToCents(100),
      message: null,
      status: "pending",
      cardId: charizard.id,
      buyerId: misty.id,
      sellerId: ash.id,
    },
  });
```
to:
```ts
  // Offer — Misty (buyer) offers on Ash's Charizard (seller)
  const offer = await prisma.offer.create({
    data: {
      price: dollarsToCents(100),
      message: null,
      status: "pending",
      listingId: charizard.id,
      buyerId: misty.id,
      sellerId: ash.id,
    },
  });
```

Change:
```ts
  console.log(
    "✅ Offer created from Misty on:",
    charizard.title,
    "Offer:",
    offer.id
  );
```
to:
```ts
  console.log(
    "✅ Offer created from Misty on:",
    pokemonCatalog.charizardVmax.nameEn,
    "Offer:",
    offer.id
  );
```

Change:
```ts
  const order = await prisma.order.create({
    data: {
      cardId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: charizard.price ?? dollarsToCents(120),
      currency: "sgd",
      status: "PAID",
      stripeCheckoutSessionId: "cs_test_seed_123",
      stripePaymentIntentId: "pi_test_seed_123",
    },
  });

  await prisma.cardTransaction.create({
    data: {
      orderId: order.id,
      cardId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: order.amount,
      currency: order.currency,
      stripeEventId: "evt_test_seed_123",
      tcgPlayerId: "232496",
    },
  });

  await prisma.$transaction([
    prisma.card.update({
      where: { id: charizard.id },
      data: {
        ownerId: misty.id,
        forSale: false,
        reservedById: null,
        reservedUntil: null,
        reservedCheckoutSessionId: null,
        binderId: null,
      },
    }),
```
to:
```ts
  const order = await prisma.order.create({
    data: {
      listingId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: charizard.price ?? dollarsToCents(120),
      currency: "sgd",
      status: "PAID",
      stripeCheckoutSessionId: "cs_test_seed_123",
      stripePaymentIntentId: "pi_test_seed_123",
    },
  });

  await prisma.cardTransaction.create({
    data: {
      orderId: order.id,
      listingId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: order.amount,
      currency: order.currency,
      stripeEventId: "evt_test_seed_123",
      tcgPlayerId: "232496",
    },
  });

  await prisma.$transaction([
    prisma.listing.update({
      where: { id: charizard.id },
      data: {
        ownerId: misty.id,
        forSale: false,
        reservedById: null,
        reservedUntil: null,
        reservedCheckoutSessionId: null,
        binderId: null,
      },
    }),
```

- [ ] **Step 6: Rewrite the "additional transactions" block to look up listings via the catalog relation**

Change:
```ts
  // ── Additional transactions so Highest Transacted has data ──────────────────
  // Look up one card per tcgPlayerId to use as the sold card reference
  const venusaurCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "222990", ownerId: ash.id },
  });
  const blastoiseCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "42360", ownerId: ash.id },
  });
  const starmieCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "197658", ownerId: misty.id },
  });
  const gyaradosCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "246724", ownerId: misty.id },
  });

  const extraTransactions = [
    // Venusaur V — 4 transactions (most transacted)
    { card: venusaurCard, tcgPlayerId: "222990", seller: ash, buyer: misty, events: ["evt_seed_ven_1", "evt_seed_ven_2", "evt_seed_ven_3", "evt_seed_ven_4"] },
    // Blastoise — 3 transactions
    { card: blastoiseCard, tcgPlayerId: "42360", seller: ash, buyer: misty, events: ["evt_seed_bla_1", "evt_seed_bla_2", "evt_seed_bla_3"] },
    // Starmie GX — 2 transactions
    { card: starmieCard, tcgPlayerId: "197658", seller: misty, buyer: ash, events: ["evt_seed_sta_1", "evt_seed_sta_2"] },
    // Gyarados VMAX — 2 transactions
    { card: gyaradosCard, tcgPlayerId: "246724", seller: misty, buyer: ash, events: ["evt_seed_gya_1", "evt_seed_gya_2"] },
  ];

  for (const { card, tcgPlayerId, seller, buyer, events } of extraTransactions) {
    if (!card) continue;
    for (const stripeEventId of events) {
      const extraOrder = await prisma.order.create({
        data: {
          cardId: card.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: card.price ?? dollarsToCents(50),
          currency: "sgd",
          status: "PAID",
        },
      });
      await prisma.cardTransaction.create({
        data: {
          orderId: extraOrder.id,
          cardId: card.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: extraOrder.amount,
          currency: extraOrder.currency,
          stripeEventId,
          tcgPlayerId,
        },
      });
    }
  }
```
to:
```ts
  // ── Additional transactions so Highest Transacted has data ──────────────────
  // Look up one listing per catalog card to use as the sold-listing reference.
  // tcgPlayerId now lives on the catalog row, so the filter reaches it through
  // the pokemonCard relation instead of a flat column on Listing.
  const venusaurListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "222990" }, ownerId: ash.id },
  });
  const blastoiseListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "42360" }, ownerId: ash.id },
  });
  const starmieListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "197658" }, ownerId: misty.id },
  });
  const gyaradosListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "246724" }, ownerId: misty.id },
  });

  const extraTransactions = [
    // Venusaur V — 4 transactions (most transacted)
    { listing: venusaurListing, tcgPlayerId: "222990", seller: ash, buyer: misty, events: ["evt_seed_ven_1", "evt_seed_ven_2", "evt_seed_ven_3", "evt_seed_ven_4"] },
    // Blastoise — 3 transactions
    { listing: blastoiseListing, tcgPlayerId: "42360", seller: ash, buyer: misty, events: ["evt_seed_bla_1", "evt_seed_bla_2", "evt_seed_bla_3"] },
    // Starmie GX — 2 transactions
    { listing: starmieListing, tcgPlayerId: "197658", seller: misty, buyer: ash, events: ["evt_seed_sta_1", "evt_seed_sta_2"] },
    // Gyarados VMAX — 2 transactions
    { listing: gyaradosListing, tcgPlayerId: "246724", seller: misty, buyer: ash, events: ["evt_seed_gya_1", "evt_seed_gya_2"] },
  ];

  for (const { listing, tcgPlayerId, seller, buyer, events } of extraTransactions) {
    if (!listing) continue;
    for (const stripeEventId of events) {
      const extraOrder = await prisma.order.create({
        data: {
          listingId: listing.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: listing.price ?? dollarsToCents(50),
          currency: "sgd",
          status: "PAID",
        },
      });
      await prisma.cardTransaction.create({
        data: {
          orderId: extraOrder.id,
          listingId: listing.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: extraOrder.amount,
          currency: extraOrder.currency,
          stripeEventId,
          tcgPlayerId,
        },
      });
    }
  }
```

- [ ] **Step 7: Add Riftbound catalog + listing seed data**

Immediately before the `// ── Best Sellers (admin-curated) ─────────────────────────────────────────────` comment, insert:

```ts
  // ── Riftbound catalog + listing ──────────────────────────────────────────
  // Real card data (not invented) — matches the sample row used when
  // designing the catalog schema. No flavour/rules text is seeded since none
  // was available; textFlavour/textPlain stay null.
  const riftboundVi = await prisma.riftboundCardCatalog.create({
    data: {
      riftboundId: "unl-176-219",
      name: "Vi - Peacekeeper",
      type: "Unit",
      supertype: "Champion",
      rarity: "Rare",
      domain: "Order",
      energy: 5,
      might: 5,
      power: 1,
      artist: "Envar Studio",
      alternateArt: false,
      signature: false,
      overnumbered: false,
      tags: ["Vi", "Piltover"],
      setId: "UNL",
      setLabel: "Unleashed",
      collectorNumber: "176",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/51610bbdecd77b15f58b9a968611e536ebdf445e-744x1039.png",
    },
  });

  await prisma.listing.create({
    data: {
      game: "RIFTBOUND",
      riftboundCardId: riftboundVi.id,
      price: dollarsToCents(15),
      condition: "Near Mint",
      description: "Vi - Peacekeeper from the Unleashed set.",
      imageUrls: [riftboundVi.imageUrl],
      forSale: true,
      ownerId: ash.id,
    },
  });

  console.log("✅ Riftbound catalog + listing created");

```

- [ ] **Step 8: Run the seed script**

Run: `npx tsx prisma/seed.ts` (or `pnpm run seed`, which runs the same command)
Expected: completes with `🌱 Seeding complete!` and no errors, having printed every `✅` log line along the way including the two new ones (`✅ Pokémon catalog created: 11 cards` and `✅ Riftbound catalog + listing created`).

- [ ] **Step 9: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: rewrite seed data for catalog/listing schema, add Riftbound data

Every prisma.card.* call becomes prisma.listing.* with a
pokemonCardId/riftboundCardId reference instead of inline identity
fields. Three pre-existing test-auction listings whose tcgPlayerId
didn't match their own title/set become their own catalog rows
(psyduckBaseSet, gyaradosVmaxVividVoltage, starmieGxJp) rather than
silently keeping a stray copy-pasted id. Adds one real Riftbound
catalog card + listing."
```

---

## Self-review notes

- **Spec coverage:** catalog tables (Task 1) ✓, `Listing` rename + all relation renames (Task 2) ✓, validation helper (Task 3) ✓, seed data for both games (Task 4) ✓. The spec's "Out of scope" items (bulk index import, OCR upload integration, `BestSeller` relation) are correctly left untouched — no task in this plan touches them.
- **Bid discrepancy:** confirmed in Global Constraints — `Bid` has no `card`/`cardId` field to rename; only touched transitively via `Auction`.
- **Type consistency:** `ListingGame`/`ListingCatalogRefs`/`assertValidListingCatalogRefs` (Task 3) are the exact names Plan 2 will import in API routes — no aliasing.
- **What Plan 1 deliberately does not do:** touch any file under `src/app/api/**` or `src/app/**` (pages/components) or `src/types/**`, or update the ~17 existing test files that mock `prisma.card.*`. Those existing tests will fail to compile/run against the new Prisma Client after this plan lands (`prisma.card` no longer exists) until Plan 2 updates them — this is expected and is Plan 2's first job, not a gap in this plan.
