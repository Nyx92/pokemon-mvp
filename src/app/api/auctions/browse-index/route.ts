import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCatalogDisplayCore } from "@/lib/listingDisplay";
import type { AuctionBrowseIndexItem } from "@/types/auction";

// Same background-revalidation rationale as GET /api/cards/browse-index —
// this route has no dynamic API of its own, so without this Next would
// statically prerender it once at build time and freeze it there.
export const revalidate = 60;

// GET /api/auctions/browse-index
//
// Lightweight, public, text-only projection of every active (not-yet-ended)
// auction. Feeds the auctions page's client-side fuzzy search and filter
// facets, mirroring GET /api/cards/browse-index for the marketplace.
//
// Uses a narrow `select` rather than the full listingCatalogInclude/
// resolveListingDisplay helper other auction routes use — this route only
// ever reads 4 catalog fields plus bid count/endsAt/buyout, and a full
// catalog include measured ~3x slower at this catalog's scale when the
// marketplace's equivalent browse-index route had the exact same shape
// (see that route's history) — applying the same fix here from the start
// rather than waiting to hit the same problem again. resolveCatalogDisplayCore
// (shared with that route) keeps the fallback-ordering logic in one place.
export async function GET() {
  try {
    const auctions = await prisma.auction.findMany({
      where: { status: "active", endsAt: { gt: new Date() } },
      select: {
        id: true,
        listingId: true,
        endsAt: true,
        buyOutPrice: true,
        _count: { select: { bids: true } },
        listing: {
          select: {
            game: true,
            condition: true,
            pokemonCard: { select: { nameEn: true, rarity: true, setNameEn: true, language: true } },
            riftboundCard: { select: { name: true, rarity: true, setLabel: true, type: true } },
          },
        },
      },
    });

    const items: AuctionBrowseIndexItem[] = auctions.map((auction) => ({
      // The auctions page navigates by listingId (same card-detail route
      // the marketplace grid uses), not the Auction row's own id.
      id: auction.listingId,
      ...resolveCatalogDisplayCore(auction.listing),
      condition: auction.listing.condition,
      game: auction.listing.game as "POKEMON" | "RIFTBOUND",
      bidCount: auction._count.bids,
      endsAt: auction.endsAt.toISOString(),
      hasBuyOut: auction.buyOutPrice != null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("❌ Error building auction browse index:", error);
    // Same rethrow-not-return rationale as the marketplace equivalent: this
    // route revalidates on a timer, and returning an error response would
    // get cached as if it were a valid result for up to 60 seconds.
    throw error;
  }
}
