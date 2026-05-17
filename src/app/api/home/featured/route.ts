import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";

function mapCard(c: any) {
  return { ...c, price: c.price != null ? centsToDollars(c.price) : null };
}

// ── Converts a DB Auction row to the API response shape ──────────────────────
// Mirrors the formatAuction function in /api/auctions/route.ts.
function formatAuction(auction: {
  id: string; cardId: string; sellerId: string;
  startingBid: number; reservePrice: number | null; buyOutPrice: number | null;
  currentBid: number | null; highestBidderId: string | null;
  status: string; endsAt: Date; sellerDecisionDeadline: Date | null;
  version: number;
  _count: { bids: number };
  card: {
    id: string; title: string; imageUrls: string[]; condition: string;
    setName: string | null; language: string; cardNumber: string | null;
    rarity: string | null; tcgPlayerId: string; inAuction: boolean;
    owner: { id: string; username: string | null };
  };
}) {
  return {
    id:                     auction.id,
    cardId:                 auction.cardId,
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
    card:                   auction.card,
  };
}

const AUCTION_CARD_SELECT = {
  id: true, title: true, imageUrls: true, condition: true,
  setName: true, language: true, cardNumber: true, rarity: true,
  tcgPlayerId: true, inAuction: true,
  owner: { select: { id: true, username: true } },
} as const;

const cardInclude = {
  owner: { select: { id: true, username: true, email: true } },
  binder: true,
};

export async function GET() {
  try {
    // Best Sellers: admin-curated, ordered by position.
    // Fetch all rows then slice to 5 *after* filtering out any tcgPlayerIds that
    // have no forSale listing — prevents a null hole from shrinking the visible row.
    const bestSellerRows = await prisma.bestSeller.findMany({
      orderBy: { position: "asc" },
    });
    const bestSellers = (
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

    // Highest Transacted: group transactions by tcgPlayerId (via card join),
    // then fetch the cheapest forSale listing for each.
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

    const highestTransacted = (
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

    // Newly Listed: 5 most recent forSale cards
    const newlyListedRaw = await prisma.card.findMany({
      where: { forSale: true },
      include: cardInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Auctions Ending Soon: 5 active auctions with the earliest end time.
    // Mirrors GET /api/auctions?expiringSoon=true so HomeFeatured can render
    // the auction row immediately without a separate client-side fetch.
    const endingSoonRaw = await prisma.auction.findMany({
      where:   { status: "active", endsAt: { gt: new Date() } },
      include: { card: { select: AUCTION_CARD_SELECT }, _count: { select: { bids: true } } },
      orderBy: { endsAt: "asc" },
      take:    5,
    });

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
