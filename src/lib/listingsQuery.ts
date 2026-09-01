// src/lib/listingsQuery.ts
//
// Shared by GET /api/cards (client-side search/filter/pagination) and the
// /marketplace Server Component (initial page-1 fetch at request time) so
// the where-clause-building logic exists in exactly one place.

import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";
import type { Prisma } from "@prisma/client";

export const MAX_PAGE_SIZE = 100;

// Every route reaching this module is public/unauthenticated (GET /api/cards
// has no auth check, and a future direct Server Component caller would have
// none either) — bounds how much untrusted `ids` input a caller can inflate
// a single query with. Lives here (not in the route handler) so any caller
// of getListingsPage gets this bound for free, matching MAX_PAGE_SIZE above.
export const MAX_IDS = 200;

export interface ListingsQueryParams {
  forSale?: boolean;
  tcgPlayerId?: string | null;
  game?: "POKEMON" | "RIFTBOUND" | null;
  setNames?: string[];
  rarities?: string[];
  types?: string[];
  languages?: string[];
  conditions?: string[];
  ids?: string[];
  page?: number | null;
  pageSize?: number | null;
}

// Hoisted so the type used by mapListing() and the `include` passed to the
// real prisma.listing.findMany() call below are the exact same value —
// previously the type was reconstructed from only listingCatalogInclude,
// so tsc had no way to notice if the query's actual include (binder,
// owner) ever drifted from what mapListing() assumed it received. See
// MarketPlace.tsx's `!(userId && product.owner?.id === userId)` check,
// which silently hides a user's own listings from the marketplace — the
// one consumer of `owner` this include exists to keep type-safe.
const listingsInclude = {
  binder: true,
  // Public listing — email is deliberately excluded (nothing in the
  // frontend reads it here, and card owners' emails shouldn't be exposed
  // to anonymous marketplace visitors). CardItem types owner.email as
  // required; that is a type-level artifact, not a signal to add it to
  // this select.
  owner: { select: { id: true, username: true } },
  ...listingCatalogInclude,
} satisfies Prisma.ListingInclude;

type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof listingsInclude }>;

export interface ListingsPageResult {
  cards: ReturnType<typeof mapListing>[];
  totalCount?: number;
  hasMore?: boolean;
}

function mapListing(listing: ListingWithRelations) {
  const withDisplay = withListingDisplay(listing);
  return {
    ...withDisplay,
    price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
    // CardItem.binder is optional (absent), not nullable — a listing with
    // no binderId comes back from Prisma as `binder: null`, so normalize
    // that to `undefined` here to match. Every consumer (MyCollection.tsx)
    // already only ever checks binder truthily or via `?.`, so this is a
    // no-behavior-change type fix, not a functional one.
    binder: withDisplay.binder ?? undefined,
    // Listing.game is a plain `String` column (not a Prisma enum), but every
    // write path validates it's one of these two literals before persisting
    // (see the `game !== "POKEMON" && game !== "RIFTBOUND"` 400 check in
    // POST /api/cards) — narrowing here just makes that existing invariant
    // visible to the type system, matching CardItem's stricter field type.
    game: withDisplay.game as "POKEMON" | "RIFTBOUND",
    // CardItem.status has no backing column on Listing — nothing in this
    // schema ever marks a listing "sold" (ownership/forSale simply doesn't
    // change on purchase today) or "reserved" outside the
    // reservedBy/reservedUntil fields already exposed via `...withDisplay`.
    // "available" is a safe, behavior-preserving default: every consumer
    // that reads `.status` only ever compares it against "sold"
    // (CardMarketChart.tsx, cards/[id]/page.tsx), which this still fails,
    // matching the `undefined` every one of those call sites got before
    // this field existed.
    status: "available" as const,
    // Prisma returns real Date objects, but CardItem (and every existing
    // consumer of this shape via GET /api/cards, which serializes its
    // response through NextResponse.json → JSON.stringify) expects ISO
    // strings. Converting here keeps the /marketplace Server Component's
    // directly-passed props byte-for-byte identical in shape to what a
    // later client-side /api/cards fetch (e.g. after a filter change)
    // returns, instead of leaving Date objects on the wire only for the
    // initial server-rendered page.
    createdAt: withDisplay.createdAt.toISOString(),
    updatedAt: withDisplay.updatedAt.toISOString(),
    // Same ISO-string conversion as createdAt/updatedAt above — nothing
    // reads this field today, but leaving it as a live Date object here
    // (while every other Date field on this shape is converted) would be
    // an inconsistency waiting to bite the first future consumer.
    reservedUntil: withDisplay.reservedUntil != null ? withDisplay.reservedUntil.toISOString() : null,
  };
}

export async function getListingsPage(params: ListingsQueryParams): Promise<ListingsPageResult> {
  const {
    forSale, tcgPlayerId, game,
    setNames = [], rarities = [], types = [], languages = [], conditions = [], ids = [],
    page = null, pageSize = null,
  } = params;

  const and: Prisma.ListingWhereInput[] = [];
  if (forSale === true) and.push({ forSale: true });
  if (tcgPlayerId) {
    and.push({
      OR: [
        { pokemonCard: { tcgPlayerId } },
        { riftboundCard: { tcgPlayerId } },
      ],
    });
  }
  if (game === "POKEMON" || game === "RIFTBOUND") and.push({ game });
  const clampedIds = ids.slice(0, MAX_IDS);
  if (clampedIds.length > 0) and.push({ id: { in: clampedIds } });
  if (setNames.length > 0) {
    and.push({
      OR: [
        { pokemonCard: { setNameEn: { in: setNames } } },
        { riftboundCard: { setLabel: { in: setNames } } },
      ],
    });
  }
  if (rarities.length > 0) {
    and.push({
      OR: [
        { pokemonCard: { rarity: { in: rarities } } },
        { riftboundCard: { rarity: { in: rarities } } },
      ],
    });
  }
  if (types.length > 0) and.push({ riftboundCard: { type: { in: types } } });
  if (conditions.length > 0) and.push({ condition: { in: conditions } });
  if (languages.length > 0) {
    and.push({
      OR: [
        { pokemonCard: { language: { in: languages } } },
        ...(languages.includes("English") ? [{ game: "RIFTBOUND" as const }] : []),
      ],
    });
  }

  const where: Prisma.ListingWhereInput = and.length > 0 ? { AND: and } : {};

  const isPaginated = page != null && pageSize != null;
  const clampedPage = isPaginated ? Math.max(1, page!) : null;
  const clampedPageSize = isPaginated ? Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize!)) : null;

  const [listings, totalCount] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: listingsInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...(isPaginated ? { skip: (clampedPage! - 1) * clampedPageSize!, take: clampedPageSize! } : {}),
    }),
    isPaginated ? prisma.listing.count({ where }) : Promise.resolve(null),
  ]);

  const cards = listings.map(mapListing);
  const result: ListingsPageResult = { cards };
  if (isPaginated && totalCount != null) {
    result.totalCount = totalCount;
    result.hasMore = clampedPage! * clampedPageSize! < totalCount;
  }
  return result;
}
