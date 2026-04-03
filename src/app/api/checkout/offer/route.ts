import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * POST /api/checkout/offer
 * Creates a Stripe checkout session for an accepted offer.
 * The card is reserved atomically to prevent double-sells.
 * Body: { offerId: string }
 */
export async function POST(req: NextRequest) {
  const authSession = await getServerSession(authOptions);
  const buyerId = authSession?.user?.id;
  if (!buyerId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const { offerId } = await req.json();
    if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 });

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { card: true },
    });

    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (offer.buyerId !== buyerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (offer.status !== "accepted") {
      return NextResponse.json({ error: "Offer is not accepted" }, { status: 409 });
    }
    if (offer.archivedAt) {
      return NextResponse.json({ error: "Offer is no longer valid" }, { status: 409 });
    }
    // Check 24h payment window hasn't expired
    if (offer.acceptedUntil && offer.acceptedUntil < new Date()) {
      return NextResponse.json({ error: "The payment window for this offer has expired" }, { status: 409 });
    }
    if (offer.price == null || offer.price <= 0) {
      return NextResponse.json({ error: "Invalid offer price" }, { status: 400 });
    }

    const card = offer.card;
    if (!card.forSale) {
      return NextResponse.json({ error: "Card is no longer for sale" }, { status: 409 });
    }

    const amount = offer.price; // already in cents
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const reservedUntil = new Date(Date.now() + 60_000); // 1 min reservation (TODO: increase for prod)

    // Reserve the card for Stripe checkout.
    // Authorization is already proven above (offer.status === "accepted", offer.buyerId === buyerId).
    // We only block if the card is already mid-checkout for someone else's Stripe session.
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.card.updateMany({
        where: {
          id: card.id,
          forSale: true,
          // Allow if: no active Stripe session yet, OR reservation belongs to this buyer
          OR: [
            { reservedCheckoutSessionId: null },
            { reservedById: buyerId },
          ],
        },
        data: {
          reservedById: buyerId,
          reservedUntil,
          reservedForOffer: false,
        },
      });
      if (updated.count !== 1) throw new Error("Card is currently being checked out by someone else");

      return tx.order.create({
        data: {
          cardId: card.id,
          sellerId: card.ownerId,
          buyerId,
          amount,
          currency: "sgd",
          status: "PENDING",
        },
      });
    });

    const finalImageUrls = (card.imageUrls ?? [])
      .filter(Boolean)
      .map((url) => (url.startsWith("http") ? url : `${baseUrl}${url}`));

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            unit_amount: amount,
            product_data: {
              name: `${card.title} (Offer)`,
              images: finalImageUrls,
              metadata: { cardId: card.id },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?cardId=${encodeURIComponent(card.id)}`,
      metadata: {
        orderId: order.id,
        cardId: card.id,
        buyerId,
        sellerId: card.ownerId,
        offerId, // signals webhook to mark offer as paid
      },
    });

    // Save session id and tie reservation to it
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSessionId: checkoutSession.id },
      }),
      prisma.card.update({
        where: { id: card.id },
        data: { reservedCheckoutSessionId: checkoutSession.id },
      }),
    ]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout/offer] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
