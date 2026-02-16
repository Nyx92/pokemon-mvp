// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma"; // adjust to your path

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardId } = body as { cardId: string };

    // TODO: get buyerId from NextAuth server session instead of client
    const buyerId = body.buyerId as string | undefined;
    if (!buyerId)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // 1) Load card + validate
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card)
      return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (!card.forSale || card.status !== "available") {
      return NextResponse.json(
        { error: "Card is not available" },
        { status: 409 }
      );
    }
    if (!card.price || card.price <= 0) {
      return NextResponse.json(
        { error: "Card has invalid price" },
        { status: 400 }
      );
    }

    const amount = Math.round(card.price * 100);

    // 2) Create stripe session first OR create order first.
    // I prefer: create Order + reserve card, then create session, then update order with session id.
    const reserveMinutes = 15;
    const reservedUntil = new Date(Date.now() + reserveMinutes * 60_000);

    const order = await prisma.$transaction(async (tx) => {
      // Reserve the card (optimistic concurrency: only reserve if still available)
      const updated = await tx.card.updateMany({
        where: {
          id: cardId,
          status: "available",
          forSale: true,
          reservedUntil: null,
        },
        data: {
          status: "reserved",
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
    const session = await stripe.checkout.sessions.create({
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
      expires_at: Math.floor(reservedUntil.getTime() / 1000),
    });

    // 4) Save session id + tie reservation to this session id
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSessionId: session.id },
      }),
      prisma.card.update({
        where: { id: cardId },
        data: { reservedCheckoutSessionId: session.id },
      }),
    ]);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
