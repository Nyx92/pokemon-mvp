import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/auctions/[id]/bid/intent
 *
 * Step 1 of 2 for placing a bid (mirrors POST /api/offers/payment-intent).
 *
 * Creates a Stripe PaymentIntent with capture_method: "manual" for the bid
 * amount. Returns the clientSecret so the frontend can confirm the PI via
 * stripe.confirmCardPayment(). Funds are authorised (held) but NOT charged.
 *
 * Basic validation runs here so we don't create dangling PIs for invalid bids.
 * Full version-locked validation runs in Step 2 (POST /api/auctions/[id]/bid).
 *
 * Body: { amount } — bid amount in dollars
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const bidderId = session.user.id;

  try {
    const { amount } = await req.json();

    // ── 2. Validate amount ──────────────────────────────────────────────────
    const amountCents = dollarsToCents(Number(amount));
    if (!amount || amountCents <= 0) {
      return NextResponse.json(
        { error: "Bid amount must be greater than $0" },
        { status: 400 }
      );
    }

    // ── 3. Load auction for pre-flight checks ───────────────────────────────
    // These are optimistic checks only — the binding version-lock is in Step 2.
    const auction = await prisma.auction.findUnique({
      where:  { id: params.id },
      select: {
        id: true, status: true, endsAt: true, sellerId: true,
        startingBid: true, currentBid: true,
        card: { select: { id: true, title: true } },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }
    if (auction.status !== "active") {
      return NextResponse.json({ error: "Auction is not active" }, { status: 409 });
    }
    if (auction.endsAt < new Date()) {
      return NextResponse.json({ error: "Auction has ended" }, { status: 409 });
    }
    if (auction.sellerId === bidderId) {
      return NextResponse.json(
        { error: "You cannot bid on your own auction" },
        { status: 403 }
      );
    }
    if (amountCents < auction.startingBid) {
      return NextResponse.json(
        { error: `Bid must be at least S$${(auction.startingBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }
    if (auction.currentBid !== null && amountCents <= auction.currentBid) {
      return NextResponse.json(
        { error: `Bid must be higher than the current bid of S$${(auction.currentBid / 100).toFixed(2)}` },
        { status: 400 }
      );
    }

    // ── 4. Create the Stripe PaymentIntent ───────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount:         amountCents,
      currency:       "sgd",
      capture_method: "manual", // authorise now, capture only if this bid wins
      metadata: {
        bidderId,
        auctionId: params.id,
        cardTitle: auction.card.title,
      },
    });

    return NextResponse.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("[auctions/bid/intent POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
