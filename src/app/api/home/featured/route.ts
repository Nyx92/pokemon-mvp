import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

function mapCard(listing: any) {
  const withDisplay = withListingDisplay(listing);
  return {
    ...withDisplay,
    price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
  };
}

// ── Converts a DB Auction row to the API response shape ──────────────────────
// Mirrors the formatAuction function in /api/auctions/route.ts.
function formatAuction(auction: {
  id: string; listingId: string; sellerId: string;
  startingBid: number; reservePrice: number | null; buyOutPrice: number | null;
  currentBid: number | null; highestBidderId: string | null;
  status: string; endsAt: Date; sellerDecisionDeadline: Date | null;
  version: number;
  _count: { bids: number };
  listing: any;
}) {
  return {
    id:                     auction.id,
    cardId:                 auction.listingId,
    sellerId:               auction.sellerId,
    startingBid:            centsToDollars(auction.startingBid),
    reservePrice:           auction.reservePrice   != null ? centsToDollars(auction.reservePrice)   : null,
    buyOutPrice:            auction.buyOutPrice    != null ? centsToDollars(auction.buyOutPrice)    : null,
    currentBid:             auction.currentBid     != null ? centsToDollars(auction.currentBid)     : null,
    highestBidderId:        auction.highestBidderId,
    status:                 auction.status,
    endsAt:                 auction.endsAt.toISOString(),
    sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
    version:                auction.version,
    bidCount:               auction._count.bids,
    card:                   withListingDisplay(auction.listing),
  };
}

const AUCTION_LISTING_SELECT = {
  id: true, imageUrls: true, condition: true, inAuction: true,
  owner: { select: { id: true, username: true } },
  pokemonCard: true,
  riftboundCard: true,
} as const;

const listingInclude = {
  // Public, unauthenticated endpoint — email deliberately excluded, same
  // rationale as src/app/api/cards/route.ts and cards/[id]/route.ts.
  owner: { select: { id: true, username: true } },
  binder: true,
  ...listingCatalogInclude,
} as const;

export async function GET() {
  try {
    const [bestSellers, highestTransacted, newlyListedRaw, endingSoonRaw] = await Promise.all([
      // Best Sellers: admin-curated, ordered by position.
      // Fetch all rows then slice to 5 *after* filtering out any tcgPlayerIds that
      // have no forSale listing — prevents a null hole from shrinking the visible row.
      (async () => {
        const bestSellerRows = await prisma.bestSeller.findMany({
          orderBy: { position: "asc" },
        });
        return (
          await Promise.all(
            bestSellerRows.map(({ tcgPlayerId }) =>
              prisma.listing.findFirst({
                where: {
                  forSale: true,
                  OR: [
                    { pokemonCard: { tcgPlayerId } },
                    { riftboundCard: { tcgPlayerId } },
                  ],
                },
                include: listingInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .slice(0, 5)
          .map(mapCard);
      })(),

      // Highest Transacted: group transactions by tcgPlayerId — already a
      // denormalized column on CardTransaction, no join needed — then fetch
      // the cheapest forSale listing for each.
      (async () => {
        const topTcgPlayerIds = await prisma.$queryRaw<
          Array<{ tcgPlayerId: string; count: bigint }>
        >`
          SELECT ct."tcgPlayerId", COUNT(*) AS count
          FROM "CardTransaction" ct
          WHERE ct."tcgPlayerId" IS NOT NULL
          GROUP BY ct."tcgPlayerId"
          ORDER BY count DESC
          LIMIT 5
        `;
        return (
          await Promise.all(
            topTcgPlayerIds.map(({ tcgPlayerId }) =>
              prisma.listing.findFirst({
                where: {
                  forSale: true,
                  OR: [
                    { pokemonCard: { tcgPlayerId } },
                    { riftboundCard: { tcgPlayerId } },
                  ],
                },
                include: listingInclude,
                orderBy: { price: "asc" },
              })
            )
          )
        )
          .filter(Boolean)
          .map(mapCard);
      })(),

      // Newly Listed: 5 most recent forSale listings
      prisma.listing.findMany({
        where: { forSale: true },
        include: listingInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Auctions Ending Soon: 5 active auctions with the earliest end time.
      // Mirrors GET /api/auctions?expiringSoon=true so HomeFeatured can render
      // the auction row immediately without a separate client-side fetch.
      prisma.auction.findMany({
        where:   { status: "active", endsAt: { gt: new Date() } },
        include: { listing: { select: AUCTION_LISTING_SELECT }, _count: { select: { bids: true } } },
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
  } catch (error) {
    console.error("❌ Error fetching featured cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured cards" },
      { status: 500 }
    );
  }
}
