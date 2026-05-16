import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleAuction, cancelBidPI } from "@/lib/auctionSettlement";
import { notifyAsync } from "@/lib/notifications";

/**
 * POST /api/auctions/[id]/decide
 *
 * Seller accepts or rejects the highest bid during the pending_seller_decision window.
 * Only reachable when the auction status is "pending_seller_decision" and the
 * seller decision deadline has not yet passed.
 *
 * Accept flow:
 *   1. Verify auction state and deadline.
 *   2. Call settleAuction() — captures PI, transfers card, marks auction sold.
 *
 * Reject flow:
 *   1. Verify auction state and deadline.
 *   2. Cancel highest bid PI (fire-and-forget).
 *   3. Mark auction "expired", clear Card.inAuction.
 *   4. Notify bidder.
 *
 * Body: { action: "accept" | "reject" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { action } = await req.json();
    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // ── 2. Load auction ────────────────────────────────────────────────────
    const auction = await prisma.auction.findUnique({
      where:   { id: params.id },
      include: {
        bids: {
          where:   { status: "active" },
          orderBy: { amount: "desc" },
          take:    1,
          select:  { id: true, paymentIntentId: true, bidderId: true, amount: true },
        },
        card: { select: { id: true, title: true } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }
    if (auction.sellerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (auction.status !== "pending_seller_decision") {
      return NextResponse.json(
        { error: "Auction is not awaiting a seller decision" },
        { status: 409 }
      );
    }
    if (auction.sellerDecisionDeadline && auction.sellerDecisionDeadline < new Date()) {
      return NextResponse.json(
        { error: "The decision window has expired" },
        { status: 409 }
      );
    }

    const highestBid = auction.bids[0];
    if (!highestBid) {
      return NextResponse.json(
        { error: "No bids found on this auction" },
        { status: 409 }
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACCEPT — delegate to settleAuction (captures PI + transfers card)
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "accept") {
      await settleAuction(params.id);
      return NextResponse.json({ success: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REJECT — cancel PI, expire auction, release card
    // ══════════════════════════════════════════════════════════════════════════

    // 3. Cancel the winning bid's PI (fire-and-forget).
    cancelBidPI(highestBid.paymentIntentId);

    // 4. Mark bid cancelled + auction expired + release the card in one transaction.
    await prisma.$transaction([
      prisma.bid.update({
        where: { id: highestBid.id },
        data:  { status: "cancelled" },
      }),
      prisma.auction.update({
        where: { id: params.id },
        data:  { status: "expired" },
      }),
      prisma.card.update({
        where: { id: auction.card.id },
        data:  { inAuction: false },
      }),
    ]);

    // 5. Notify the bidder that the seller declined.
    notifyAsync({
      userId: highestBid.bidderId,
      type:   "auction_expired",
      title:  `Auction declined for "${auction.card.title}"`,
      body:   `The seller chose not to accept the final bid on "${auction.card.title}". Your hold has been released.`,
      cardId: auction.card.id,
    });

    console.log(
      `[auctions/decide POST] Seller rejected auction ${params.id}. Bid ${highestBid.id} cancelled.`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auctions/decide POST] error:", err);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 }
    );
  }
}
