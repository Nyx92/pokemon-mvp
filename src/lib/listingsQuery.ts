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

// withListingDisplay<T extends ListingWithCatalog> requires this exact
// shape as T — ListingWithCatalog itself isn't exported from
// listingDisplay.ts, so it's reconstructed here from the same
// listingCatalogInclude both files already share (can't drift out of sync
// with it, since it's the identical `include` value, not a re-typed copy).
type ListingWithCatalog = Prisma.ListingGetPayload<{ include: typeof listingCatalogInclude }>;

export interface ListingsPageResult {
  cards: ReturnType<typeof mapListing>[];
  totalCount?: number;
  hasMore?: boolean;
}

function mapListing(listing: ListingWithCatalog) {
  const withDisplay = withListingDisplay(listing);
  return {
    ...withDisplay,
    price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
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
  if (ids.length > 0) and.push({ id: { in: ids } });
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
      include: {
        binder: true,
        owner: { select: { id: true, username: true } },
        ...listingCatalogInclude,
      },
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
