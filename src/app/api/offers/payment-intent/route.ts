import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/offers/payment-intent
 *
 * STEP 1 of placing an offer:
 * The buyer fills in their price + message AND provides their card details via
 * Stripe Elements. Before we even store the offer in our DB, we need a
 * PaymentIntent from Stripe so the buyer's card can be authorised (funds held).
 *
 * Flow:
 *   1. Buyer fills in offer form (price, message) + Stripe CardElement
 *   2. Frontend calls this endpoint → we create a PaymentIntent with
 *      capture_method: "manual" → Stripe returns a clientSecret
 *   3. Frontend uses the clientSecret to call stripe.confirmCardPayment()
 *      → Stripe authorises (holds) the funds on the buyer's card
 *   4. Frontend then calls POST /api/offers with { cardId, price, message, paymentIntentId }
 *      → we save the offer in the DB, linked to this PaymentIntent
 *
 * Why manual capture?
 *   - Stripe "authorises" the charge immediately (funds are held / ring-fenced)
 *     but does NOT move money yet.
 *   - If the seller accepts → we call stripe.paymentIntents.capture() → money moves.
 *   - If the seller rejects or the offer expires → we call stripe.paymentIntents.cancel()
 *     → funds are released back to the buyer with no charge.
 *
 * Body: { cardId: string, price: number }   (price in cents)
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const buyerId = session.user.id;

  try {
    const { cardId, price } = await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid cardId / price" },
        { status: 400 }
      );
    }

    // ── 3. Verify the card exists and is still for sale ─────────────────────
    // We check this early so we don't create a dangling PaymentIntent for a
    // card the buyer can't actually buy.
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, title: true, forSale: true, ownerId: true },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (!card.forSale) {
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    }
    // Prevent the card owner from placing an offer on their own card
    if (card.ownerId === buyerId) {
      return NextResponse.json(
        { error: "You cannot place an offer on your own card" },
        { status: 403 }
      );
    }

    // ── 4. Create the Stripe PaymentIntent with capture_method: "manual" ────
    // This authorises the buyer's card without charging it.
    // The `amount` must be in the smallest currency unit (cents for SGD).
    // `currency` must be lowercase.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price,          // already in cents (the frontend sends cents)
      currency: "sgd",
      capture_method: "manual", // <── KEY: authorise now, charge only on accept
      metadata: {
        // Store context so we can trace this PI back to the offer later.
        // Note: these are informational — the authoritative link is
        // Offer.paymentIntentId in our DB.
        buyerId,
        cardId,
        cardTitle: card.title,
      },
    });

    // ── 5. Return the clientSecret to the frontend ──────────────────────────
    // The frontend passes this to stripe.confirmCardPayment(clientSecret, {
    //   payment_method: { card: cardElement }
    // }) to collect and authorise the buyer's card details.
    // After confirmation, the PI status moves from "requires_payment_method"
    // → "requires_capture", meaning funds are held.
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("[offers/payment-intent] error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
