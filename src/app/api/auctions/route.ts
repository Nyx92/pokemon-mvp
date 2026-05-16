import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, dollarsToCents } from "@/lib/money";

// ── Shared shape for converting a DB Auction row to the API response ────────
// Prices are stored as cents in the DB; callers receive dollars.
function formatAuction(
  auction: {
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
  }
) {
  return {
    id:             auction.id,
    cardId:         auction.cardId,
    sellerId:       auction.sellerId,
    startingBid:    centsToDollars(auction.startingBid),
    reservePrice:   auction.reservePrice   != null ? centsToDollars(auction.reservePrice)   : null,
    buyOutPrice:    auction.buyOutPrice    != null ? centsToDollars(auction.buyOutPrice)    : null,
    currentBid:     auction.currentBid    != null ? centsToDollars(auction.currentBid)     : null,
    highestBidderId: auction.highestBidderId,
    status:          auction.status,
    endsAt:          auction.endsAt.toISOString(),
    sellerDecisionDeadline: auction.sellerDecisionDeadline?.toISOString() ?? null,
    version:         auction.version,
    bidCount:        auction._count.bids,
    card:            auction.card,
  };
}

const CARD_SELECT = {
  id: true, title: true, imageUrls: true, condition: true,
  setName: true, language: true, cardNumber: true, rarity: true,
  tcgPlayerId: true, inAuction: true,
  owner: { select: { id: true, username: true } },
} as const;

/**
 * GET /api/auctions
 *   ?cardId=xxx        — active auction for a specific card (used by card detail page)
 *   ?expiringSoon=true — the 5 active auctions expiring soonest (used by homepage row)
 *   (no params)        — all active auctions (used by /auctions listing page)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardId       = searchParams.get("cardId");
  const expiringSoon = searchParams.get("expiringSoon") === "true";

  try {
    // ── Active auction for a single card ──────────────────────────────────────
    // Returns any auction that is still active or awaiting the seller's decision.
    // We intentionally include "active + endsAt in the past" rows here — the client
    // distinguishes them by checking endsAt and bidCount:
    //   • active + past + bidCount = 0  → treated as ended immediately (auctionExpiredClientSide in page.tsx)
    //   • active + past + bidCount > 0  → pre-cron window; info box shown ("refresh shortly")
    //   • pending_seller_decision       → Accept/Decline buttons shown
    if (cardId) {
      const auction = await prisma.auction.findFirst({
        where: {
          cardId,
          status: { in: ["active", "pending_seller_decision"] },
        },
        include: { card: { select: CARD_SELECT }, _count: { select: { bids: true } } },
      });

      return NextResponse.json({ auction: auction ? formatAuction(auction) : null });
    }

    // ── Expiring-soon: the 5 active auctions with the earliest end time ──────
    // endsAt > now guards the window between endsAt passing and the cron running
    // (up to ~5 min), ensuring stale "active" auctions don't leak into the row.
    if (expiringSoon) {
      const auctions = await prisma.auction.findMany({
        where:   { status: "active", endsAt: { gt: new Date() } },
        include: { card: { select: CARD_SELECT }, _count: { select: { bids: true } } },
        orderBy: { endsAt: "asc" },
        take:    5,
      });

      return NextResponse.json({ auctions: auctions.map(formatAuction) });
    }

    // ── All active auctions (auctions browse page) ────────────────────────────
    // Same endsAt > now guard: exclude auctions the cron hasn't expired yet.
    const auctions = await prisma.auction.findMany({
      where:   { status: "active", endsAt: { gt: new Date() } },
      include: { card: { select: CARD_SELECT }, _count: { select: { bids: true } } },
      orderBy: { endsAt: "asc" },
      take:    100,
    });

    return NextResponse.json({ auctions: auctions.map(formatAuction) });
  } catch (err) {
    console.error("[auctions GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
  }
}

/**
 * POST /api/auctions
 *
 * Seller starts an auction on one of their cards.
 *
 * 1. Auth check — must be logged in.
 * 2. Validate inputs:
 *    - startingBid required and > 0
 *    - durationDays must be 1–6
 *    - buyOutPrice > reservePrice if both supplied
 * 3. Load the card — must be owned by the seller and not already in auction.
 * 4. Create the Auction record.
 * 5. Mark Card.inAuction = true and Card.forSale = false so offers and Buy Now
 *    are blocked while the auction is running.
 *
 * Body: { cardId, startingBid (dollars), reservePrice?, buyOutPrice?, durationDays }
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const sellerId = session.user.id;

  try {
    const { cardId, startingBid, reservePrice, buyOutPrice, durationDays } =
      await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    }

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

    // ── 3. Verify the card belongs to the seller and is not in auction ───────
    const card = await prisma.card.findUnique({
      where:  { id: cardId },
      select: { ownerId: true, inAuction: true, title: true },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (card.ownerId !== sellerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (card.inAuction) {
      return NextResponse.json(
        { error: "This card already has an active auction" },
        { status: 409 }
      );
    }

    // ── 4 & 5. Create auction + lock card (atomic) ───────────────────────────
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const [auction] = await prisma.$transaction([
      prisma.auction.create({
        data: {
          cardId,
          sellerId,
          startingBid:  startingBidCents,
          reservePrice: reservePriceCents,
          buyOutPrice:  buyOutPriceCents,
          endsAt,
          status: "active",
        },
        include: { card: { select: CARD_SELECT }, _count: { select: { bids: true } } },
      }),
      // Prevent Buy Now / offers while auction is live.
      prisma.card.update({
        where: { id: cardId },
        data:  { inAuction: true, forSale: false },
      }),
    ]);

    console.log(`[auctions POST] Auction created: ${auction.id} for card ${cardId}`);

    return NextResponse.json({ auction: formatAuction(auction) }, { status: 201 });
  } catch (err) {
    console.error("[auctions POST] error:", err);
    return NextResponse.json({ error: "Failed to create auction" }, { status: 500 });
  }
}
