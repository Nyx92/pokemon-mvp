// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma"; // adjust to your path
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const authSession = await getServerSession(authOptions);
  const buyerId = authSession?.user?.id;

  try {
    const body = await req.json();
    const { cardId } = body as { cardId: string };

    if (!buyerId)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // 1) Load card + validate
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card)
      return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (!card.forSale) {
      return NextResponse.json(
        { error: "Card is not for sale" },
        { status: 409 }
      );
    }
    if (card.price == null || card.price <= 0) {
      return NextResponse.json(
        { error: "Card has invalid price" },
        { status: 400 }
      );
    }

    const amount = card.price;
    const reserveMinutes = 1;
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60_000);

    const order = await prisma.$transaction(async (tx) => {
      console.log("[checkout] buyerId from session:", buyerId);

      const buyer = await prisma.user.findUnique({
        where: { id: buyerId! },
      });
      console.log("[checkout] buyer exists in DB:", !!buyer);
      // Reserve the card (optimistic concurrency: only reserve if still available)
      const updated = await tx.card.updateMany({
        where: {
          id: cardId,
          forSale: true,
          OR: [
            { reservedUntil: null },
            { reservedUntil: { lt: new Date() } },
            { reservedCheckoutSessionId: null },
          ],
        },
        data: {
          reservedById: buyerId,
          reservedUntil,
        },
      });

      if (updated.count !== 1)
        throw new Error("Card just got reserved/sold by someone else");

      // Create order
      return tx.order.create({
        data: {
          cardId,
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

    // 3) Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            unit_amount: amount,
            product_data: {
              name: card.title,
              images: finalImageUrls,
              metadata: { cardId },
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel?cardId=${encodeURIComponent(cardId)}`,
      metadata: {
        orderId: order.id,
        cardId,
        buyerId,
        sellerId: card.ownerId,
      },
      // TODO: Re-enable `expires_at` after testing.
      // Stripe requires `expires_at` to be at least 30 minutes from session creation.
      // When we re-enable it, also add a "Resume checkout" flow:
      // - Persist stripeCheckoutSessionId on Order (already doing)
      // - Provide an endpoint/UI that finds the user's latest PENDING order and redirects them back to the same Checkout Session
      //   (or creates a new session if the old one expired).
      // expires_at: Math.floor(reservedUntil.getTime() / 1000),
      // expires_at: Math.floor(reservedUntil.getTime() / 1000),
    });

    // 4) Save session id + tie reservation to this session id
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSessionId: checkoutSession.id },
      }),
      prisma.card.update({
        where: { id: cardId },
        data: { reservedCheckoutSessionId: checkoutSession.id },
      }),
    ]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
