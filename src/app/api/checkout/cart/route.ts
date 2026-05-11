// POST /api/checkout/cart
//
// Creates a single Stripe Checkout Session covering all selected cart items.
//
// Flow:
//   1. Auth + fetch selected cart items with card data
//   2. Validate every card (for sale, not own, price > 0)
//   3. Atomically reserve all cards + create one Order per card (single DB transaction)
//   4. Create one Stripe session with all cards as line items
//   5. Stamp every Order and Card with the Stripe session ID
//   6. Return { url } — caller redirects window.location to the Stripe page
//
// Webhook counterpart: app/api/stripe/webhook/route.ts handles
//   checkout.session.completed  → transfers all cards, cleans up cart
//   checkout.session.expired    → releases all reservations

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(_req: NextRequest) {
  const authSession = await getServerSession(authOptions);
  const buyerId = authSession?.user?.id;

  if (!buyerId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    // ── 1. Fetch selected items with full card data ───────────────────────────
    const cart = await prisma.cart.findUnique({
      where: { userId: buyerId },
      include: {
        items: {
          where: { selected: true },
          include: {
            card: { select: { id: true, title: true, price: true, forSale: true, ownerId: true, imageUrls: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "No selected items in cart" }, { status: 400 });
    }

    // ── 2. Validate every card using authoritative DB data ───────────────────
    // Fetch fresh copies to prevent stale-snapshot attacks (price manipulation, etc.)
    const cardIds = cart.items.map((i) => i.cardId);
    const freshCards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, title: true, price: true, forSale: true, ownerId: true, imageUrls: true },
    });
    const cardMap = new Map(freshCards.map((c) => [c.id, c]));

    for (const item of cart.items) {
      const card = cardMap.get(item.cardId);
      if (!card) {
        return NextResponse.json({ error: `Card "${item.card.title}" no longer exists` }, { status: 404 });
      }
      if (!card.forSale) {
        return NextResponse.json({ error: `"${card.title}" is no longer for sale` }, { status: 409 });
      }
      if (card.ownerId === buyerId) {
        return NextResponse.json({ error: "Cannot buy your own card" }, { status: 400 });
      }
      if (!card.price || card.price <= 0) {
        return NextResponse.json({ error: `"${card.title}" has no valid price` }, { status: 400 });
      }
    }

    const reservedUntil = new Date(Date.now() + 60_000); // 1-minute reservation window

    // ── 3. Atomic multi-card reservation + order creation ────────────────────
    // Each card is reserved only if currently unlocked.
    // Failure of any single reservation rolls back the entire transaction,
    // so we never partially-reserve a cart.
    const orders = await prisma.$transaction(async (tx) => {
      const created: { orderId: string; cardId: string; sellerId: string; amount: number }[] = [];

      for (const item of cart.items) {
        const card = cardMap.get(item.cardId)!;

        const reserved = await tx.card.updateMany({
          where: {
            id: card.id,
            forSale: true,
            OR: [
              { reservedUntil: null },
              { reservedUntil: { lt: new Date() } },
              { reservedCheckoutSessionId: null },
            ],
          },
          data: { reservedById: buyerId, reservedUntil },
        });

        if (reserved.count !== 1) {
          throw new Error(`"${card.title}" was just reserved by another buyer. Please try again.`);
        }

        const order = await tx.order.create({
          data: {
            cardId: card.id,
            sellerId: card.ownerId,
            buyerId,
            amount: card.price!,
            currency: "sgd",
            status: "PENDING",
          },
        });

        created.push({ orderId: order.id, cardId: card.id, sellerId: card.ownerId, amount: card.price! });
      }

      return created;
    });

    // ── 4. Build Stripe line items ────────────────────────────────────────────
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orders.map(({ cardId, amount }) => {
      const card = cardMap.get(cardId)!;
      const imageUrls = (card.imageUrls ?? [])
        .filter(Boolean)
        .slice(0, 1) // Stripe allows up to 8; one is enough per line item
        .map((url) => (url.startsWith("http") ? url : `${baseUrl}${url}`));

      return {
        price_data: {
          currency: "sgd",
          unit_amount: amount,
          product_data: {
            name: card.title,
            images: imageUrls,
            metadata: { cardId },
          },
        },
        quantity: 1,
      };
    });

    // ── 5. Create Stripe Checkout Session ─────────────────────────────────────
    // metadata.checkoutType = "cart" tells the webhook to use the multi-order path.
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,
      metadata: {
        checkoutType: "cart",
        buyerId,
      },
    });

    // ── 6. Stamp Orders + Cards with the session ID ───────────────────────────
    await prisma.$transaction([
      ...orders.map(({ orderId }) =>
        prisma.order.update({
          where: { id: orderId },
          data: { stripeCheckoutSessionId: checkoutSession.id },
        })
      ),
      ...orders.map(({ cardId }) =>
        prisma.card.update({
          where: { id: cardId },
          data: { reservedCheckoutSessionId: checkoutSession.id },
        })
      ),
    ]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout/cart] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
