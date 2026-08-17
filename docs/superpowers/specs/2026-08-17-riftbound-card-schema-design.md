# Riftbound Card Support — Schema Design

**Date:** 2026-08-17
**Status:** Approved, pending implementation plan

## Problem

The marketplace currently sells only Pokémon cards. The `Card` model conflates two concerns in one table: *what card this is* (title, set, rarity, TCGPlayer ID) and *this specific seller's listing of it* (price, condition, owner, reservation state, photos). We want to add Riftbound cards to the same marketplace without duplicating every marketplace mechanic (`Order`, `Offer`, `Auction`, `Bid`, `Cart`, `CardWatchlist`, `CardTransaction`, `BestSeller`), because both games will use identical buying/selling flows — only the card-identity attributes differ (Pokémon: `hp`/`stage`/`types`/dex number; Riftbound: `domain`/`energy`/`might`/`power`/supertype).

## Goals

- Support listing, browsing, buying, and selling Riftbound cards through the existing marketplace mechanics, unchanged.
- Give each game's card-identity data proper, typed, queryable columns — not a shared free-for-all of nullable fields or an opaque JSON blob.
- Let two sellers list the same physical card (e.g. two copies of the same Riftbound rare) without duplicating or risking drift in that card's identity data (name, rarity, set, etc.).
- Keep each listing independently identifiable — its own condition, price, and photos, since a photo reflects that specific physical copy's condition.

## Non-goals

- Importing the full Pokémon (34,368) or Riftbound (1,048) card index files from `MXYYC-TCG-IDENTIFIER` in bulk. Seed data only, shaped like the real data.
- Wiring the OCR identification pipeline into the seller upload flow. The schema doesn't foreclose this, but it isn't being built now.
- A third game. The design should make adding one straightforward later, but nothing here builds for it speculatively.
- A database-level `CHECK` constraint enforcing "exactly one catalog FK, matching `game`." This project manages its schema via `prisma db push` (no migration history — confirmed via `git ls-files prisma/migrations` returning nothing and the directory not existing on disk), so hand-written SQL migrations aren't part of the current workflow. This rule is enforced at the application layer instead.

## Design

### Catalog / listing split

A **catalog** row is the abstract card — one row per real card, shared across every seller who lists it (e.g. one `RiftboundCardCatalog` row for "Vi - Peacekeeper, UNL-176", referenced by however many `Listing` rows point at it). A **listing** row is one seller's physical copy — its own price, condition, photos, and marketplace state (reservation, `forSale`, auction status).

This replaces the current pattern where `Card` stores its own copy of `title`/`cardNumber`/`setName`/`rarity` per row, which is how `BestSeller.tcgPlayerId` ended up as a loose string match instead of a real relation — there's no single row that "is" a given card today.

Two new catalog tables, one per game, because the attribute shapes barely overlap (see field lists below) and each game's fields should be properly typed/indexable rather than living in nullable columns or a JSON bag with no schema. `Card` is renamed to `Listing` and gains two nullable foreign keys, one per catalog, alongside a `game` discriminator saying which one is populated.

### Schema

```prisma
// One row per real, canonical Pokémon card. Shared by every listing of that
// card — this is "what card is this," not "this seller's copy of it."
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
  language         String   // the card's print-language classification; carried
                             // through as-is from the source index alongside the
                             // separate nameEn/nameJa fields — exact semantics
                             // (e.g. whether EN/JP prints of the same card share
                             // one row or get separate rows) to be confirmed
                             // against real source data during implementation
  regulationMark   String?
  localId          String?  // card number within its set, e.g. "016" or "SV107" —
                             // the Pokémon equivalent of RiftboundCardCatalog's
                             // collectorNumber below. Missing from the first draft
                             // of this spec; added when mapping existing seed data.
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

// A specific seller's physical copy of a card, listed for sale. Renamed
// from Card. Exactly one of pokemonCardId/riftboundCardId is set, matching
// `game` — enforced in application code (see "Validation" below), not by a
// database CHECK constraint, since this project has no migration history
// to hand-write one into (schema is managed via `prisma db push`).
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
  imageUrls    String[]   // photos of this specific physical copy — unchanged from Card
  forSale      Boolean    @default(false)

  // Reservation fields — used by the Buy Now Stripe Checkout flow to prevent
  // double-selling while the buyer is on Stripe's hosted payment page.
  // (unchanged from Card)
  reservedBy                User?     @relation("CardReservations", fields: [reservedById], references: [id], onDelete: SetNull)
  reservedById              String?
  reservedUntil             DateTime?
  reservedCheckoutSessionId String?

  binder       Binder?    @relation(fields: [binderId], references: [id], onDelete: SetNull)
  binderId     String?
  owner        User       @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId      String
  offers       Offer[]
  transactions CardTransaction[]
  orders       Order[]
  watchlist    CardWatchlist[]
  cartItems    CartItem[]
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

`title`, `tcgPlayerId`, `language`, `cardNumber`, `setName`, `rarity` are removed from `Listing` — they're now reached through whichever catalog relation is populated. No denormalized display-name/title field is kept on `Listing`; every consumer resolves the card's name via the catalog join. A cached copy would drift out of sync with the catalog exactly the way per-listing strings could today — normalizing was the point.

### Rename scope

Every model that currently has `card Card @relation(...)` / `cardId String` — `Order`, `Offer`, `CardTransaction`, `CardWatchlist`, `CartItem`, `Auction`, `Bid` — is renamed to `listing Listing @relation(...)` / `listingId String`. This is a deliberate choice over keeping the old field names: it touches more application code up front, but avoids a permanently confusing `card: Listing` field name going forward.

### Validation

One shared helper (used by every code path that creates or updates a `Listing`) enforces: exactly one of `pokemonCardId`/`riftboundCardId` is set, and it matches `game`. This keeps the rule in one place instead of repeated at each call site, and is unit tested directly (see Testing).

### Data flow / seed data

`prisma/seed.ts` is extended to insert a handful of `PokemonCardCatalog` and `RiftboundCardCatalog` rows, shaped like real data (matching the field values you'd see from the `MXYYC-TCG-IDENTIFIER` index files), plus at least one seeded `Listing` per game so the marketplace has real Riftbound data to browse against in development. This is seed data for local development, not a bulk import — pulling in the full 34,368-card Pokémon index or the full 1,048-card Riftbound index is explicitly out of scope (see Non-goals).

### Testing

- Existing tests referencing `Card`/`card`/`cardId` are updated to `Listing`/`listing`/`listingId`.
- New unit tests for the validation helper: rejects both FKs set, both unset, and a `game` value that doesn't match the populated FK.
- New tests covering a Riftbound listing end-to-end (create, fetch, display) alongside the existing Pokémon coverage, so the two games are tested symmetrically rather than Riftbound being an afterthought.

### Code comments

New models and the validation helper follow the existing comment style in `schema.prisma` (e.g. `Card`'s reservation-field block, `Order.status`) — explaining non-obvious *why*, not restating field names.

## Out of scope for this design (candidate follow-ups, not required now)

- `BestSeller.tcgPlayerId` is currently a loose string match against `Card.tcgPlayerId`. It could become a real relation to a catalog row now that catalogs exist, but nothing in this design requires changing it, and it isn't touched here.
- Bulk-importing the full card indexes from `MXYYC-TCG-IDENTIFIER`.
- Wiring the OCR pipeline into the upload flow to auto-fill catalog data from a scanned photo.
