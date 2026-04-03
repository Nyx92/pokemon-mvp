import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, dollarsToCents } from "@/lib/money";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

// How long (in hours) the seller has to respond before the offer expires
// and the buyer's authorised funds are released.
const OFFER_EXPIRY_HOURS = 24;

/**
 * GET /api/offers?cardId=X              — seller: all non-archived offers on their card
 * GET /api/offers?cardId=X&myOffer=true — viewer: their own offer on this card (or null)
 * GET /api/offers?mine=true             — buyer: full offer history
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const myOffer = searchParams.get("myOffer") === "true";
  const mine = searchParams.get("mine") === "true";

  try {
    // ── Viewer: fetch their own offer on a specific card ──────────────────────
    if (cardId && myOffer) {
      const offer = await prisma.offer.findFirst({
        where: {
          cardId,
          buyerId: userId,
          // Show only active offers — exclude paid (already done) and archived.
          // "expired" is included so the buyer can see that their offer expired.
          status: { in: ["pending", "accepted", "rejected", "expired"] },
          archivedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offer: offer
          ? {
              ...offer,
              price: offer.price != null ? centsToDollars(offer.price) : null,
            }
          : null,
      });
    }

    // ── Seller: all non-archived offers on their card ─────────────────────────
    if (cardId) {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { ownerId: true },
      });
      if (!card)
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      if (card.ownerId !== userId)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const offers = await prisma.offer.findMany({
        where: { cardId, archivedAt: null },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offers: offers.map((o) => ({
          ...o,
          price: o.price != null ? centsToDollars(o.price) : null,
        })),
      });
    }

    // ── Buyer: their full offer history ───────────────────────────────────────
    if (mine) {
      const offers = await prisma.offer.findMany({
        where: { buyerId: userId },
        include: {
          card: {
            select: {
              id: true,
              title: true,
              imageUrls: true,
              condition: true,
              forSale: true,
              owner: { select: { id: true, username: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offers: offers.map((o) => ({
          ...o,
          price: o.price != null ? centsToDollars(o.price) : null,
        })),
      });
    }

    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  } catch (err) {
    console.error("[offers GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/offers
 *
 * STEP 2 of placing an offer (step 1 is POST /api/offers/payment-intent).
 *
 * By this point:
 *   - The buyer has already created a Stripe PaymentIntent with capture_method:
 *     "manual" via POST /api/offers/payment-intent.
 *   - The buyer has confirmed their card details via stripe.confirmCardPayment()
 *     in the browser. The funds are now authorised (held) on their card.
 *   - The frontend sends us the resulting paymentIntentId so we can store it.
 *
 * This endpoint:
 *   1. Validates the offer data and card eligibility.
 *   2. Verifies the PaymentIntent in Stripe (must be "requires_capture" status,
 *      meaning it was successfully authorised and is waiting to be captured or
 *      cancelled).
 *   3. If the buyer already has a pending offer (amend case):
 *      - Cancels the OLD PaymentIntent (releases the old hold on their card).
 *      - Updates the existing offer record with the new price/message/PI.
 *   4. If this is a brand-new offer:
 *      - Creates a new offer record.
 *   5. Sets expiresAt = now + 24h on the offer.
 *      The cron job (/api/cron/expire-offers) will cancel the PI and mark
 *      the offer "expired" if the seller doesn't respond within 24h.
 *
 * Body: { cardId, price (cents), message?, paymentIntentId }
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const buyerId = session.user.id;

  try {
    const { cardId, price, message, paymentIntentId } = await req.json();

    // ── 2. Validate inputs ──────────────────────────────────────────────────
    if (!cardId || price == null || Number(price) <= 0) {
      return NextResponse.json(
        { error: "Invalid offer data" },
        { status: 400 }
      );
    }
    // paymentIntentId is now required — it must come from the PI creation step.
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json(
        { error: "Missing paymentIntentId" },
        { status: 400 }
      );
    }

    // ── 3. Verify the card is still for sale ────────────────────────────────
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card)
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (!card.forSale)
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    if (card.ownerId === buyerId) {
      return NextResponse.json(
        { error: "Cannot offer on your own card" },
        { status: 400 }
      );
    }

    // ── 4. Verify the PaymentIntent in Stripe ────────────────────────────────
    // We retrieve the PI from Stripe and confirm its status is "requires_capture".
    // This means stripe.confirmCardPayment() ran successfully in the browser and
    // the funds are authorised (held) but NOT charged yet.
    // We also confirm the PI belongs to this buyer and is for the right amount.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== "requires_capture") {
      // The PI wasn't successfully authorised (e.g. card declined, wrong credentials).
      // Do NOT store the offer — there's nothing to capture.
      return NextResponse.json(
        {
          error: `Payment authorisation failed or was already used (status: ${pi.status})`,
        },
        { status: 409 }
      );
    }

    // Safety: ensure this PI was created for this buyer (metadata check).
    if (pi.metadata?.buyerId && pi.metadata.buyerId !== buyerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const priceInCents = dollarsToCents(Number(price));
    const cleanMessage = message?.trim() || null;

    // ── 5. Check for existing live offer from this buyer ─────────────────────
    // A buyer can only have ONE active offer per card at a time.
    const existing = await prisma.offer.findFirst({
      where: {
        cardId,
        buyerId,
        // "accepted" offers are locked — the seller already chose this offer;
        // the buyer must wait for the capture or cancellation before offering again.
        status: { in: ["pending", "accepted"] },
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.status === "accepted") {
      // The seller already accepted a previous offer from this buyer.
      // With manual capture, the funds will be captured immediately when the
      // seller accepts — so if status is "accepted", the card is mid-transfer.
      return NextResponse.json(
        {
          error:
            "You have an accepted offer that is being processed.",
        },
        { status: 409 }
      );
    }

    // ── 6a. Amend: cancel the old PI and update the existing pending offer ───
    if (existing?.status === "pending") {
      // The buyer is changing their offer. Cancel the OLD PaymentIntent first
      // so the previous hold on their card is released. Then save the new PI.
      if (existing.paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(existing.paymentIntentId);
        } catch (cancelErr) {
          // Log but don't block — the old PI may already be cancelled/expired.
          console.warn(
            "[offers POST] Could not cancel old PI:",
            existing.paymentIntentId,
            cancelErr
          );
        }
      }

      const updated = await prisma.offer.update({
        where: { id: existing.id },
        data: {
          price: priceInCents,
          message: cleanMessage,
          // Replace old PI with the new one
          paymentIntentId,
          // Reset the 24h expiry window from now
          expiresAt: new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
        },
      });

      return NextResponse.json({
        offer: { ...updated, price: centsToDollars(updated.price!) },
        amended: true,
      });
    }

    // ── 6b. New offer ─────────────────────────────────────────────────────────
    const offer = await prisma.offer.create({
      data: {
        cardId,
        buyerId,
        price: priceInCents,
        message: cleanMessage,
        status: "pending",
        paymentIntentId,
        // Seller has 24h to respond. After expiresAt the cron job will:
        //   1. Cancel the PaymentIntent (release the hold on buyer's card)
        //   2. Mark this offer status → "expired"
        expiresAt: new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    return NextResponse.json(
      {
        offer: { ...offer, price: centsToDollars(offer.price!) },
        amended: false,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[offers POST] error:", err);
    return NextResponse.json(
      { error: "Failed to place offer" },
      { status: 500 }
    );
  }
}
