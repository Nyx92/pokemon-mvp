import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";

/**
 * GET /api/auctions/[id]
 *
 * Returns the auction record with its bids (amounts + statuses, no PI ids exposed)
 * and the associated card. Public endpoint — no auth required.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auction = await prisma.auction.findUnique({
      where:   { id: params.id },
      include: {
        card: {
          select: {
            id: true, title: true, imageUrls: true, condition: true,
            setName: true, language: true, cardNumber: true, rarity: true,
            tcgPlayerId: true, inAuction: true,
            owner: { select: { id: true, username: true } },
          },
        },
        bids: {
          // Expose bids to authenticated viewers for history/transparency.
          // PI ids are intentionally excluded — they are internal Stripe references.
          select: {
            id: true, bidderId: true, amount: true, status: true, createdAt: true,
            bidder: { select: { id: true, username: true } },
          },
          orderBy: { amount: "desc" },
        },
        _count: { select: { bids: true } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    return NextResponse.json({
      auction: {
        id:             auction.id,
        cardId:         auction.cardId,
        sellerId:       auction.sellerId,
        startingBid:    centsToDollars(auction.startingBid),
        reservePrice:   auction.reservePrice  != null ? centsToDollars(auction.reservePrice)  : null,
        buyOutPrice:    auction.buyOutPrice   != null ? centsToDollars(auction.buyOutPrice)   : null,
        currentBid:     auction.currentBid   != null ? centsToDollars(auction.currentBid)    : null,
        highestBidderId: auction.highestBidderId,
        status:          auction.status,
        endsAt:          auction.endsAt.toISOString(),
        sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
        version:         auction.version,
        bidCount:        auction._count.bids,
        card:            auction.card,
        bids: auction.bids.map((b) => ({
          ...b,
          amount:    centsToDollars(b.amount),
          createdAt: b.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("[auctions/[id] GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch auction" }, { status: 500 });
  }
}
