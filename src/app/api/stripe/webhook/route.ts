import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig)
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error("[webhook] signature verify failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const orderId = session.metadata?.orderId;
        const cardId = session.metadata?.cardId;
        const buyerId = session.metadata?.buyerId;
        const sellerId = session.metadata?.sellerId;

        if (!orderId || !cardId || !buyerId || !sellerId) {
          throw new Error("Missing metadata on session");
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;

        // Idempotency: store event.id in CardTransaction.stripeEventId (unique)
        await prisma.$transaction(async (tx) => {
          // If already processed, do nothing
          const existingTx = await tx.cardTransaction.findUnique({
            where: { stripeEventId: event.id },
          });
          if (existingTx) return;

          // Load order
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (!order) throw new Error("Order not found");

          if (order.status === "PAID") {
            // still write idempotency guard so retries don’t keep failing
            await tx.cardTransaction.create({
              data: {
                orderId: order.id,
                cardId,
                sellerId,
                buyerId,
                amount: order.amount,
                currency: order.currency,
                stripeEventId: event.id,
              },
            });
            return;
          }

          // Update order + create transaction + transfer ownership
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId ?? undefined,
            },
          });

          await tx.cardTransaction.create({
            data: {
              orderId,
              cardId,
              sellerId,
              buyerId,
              amount: order.amount,
              currency: order.currency,
              stripeEventId: event.id,
            },
          });

          // Transfer card
          // Guard: ensure the reservedCheckoutSessionId matches THIS session
          await tx.card.update({
            where: { id: cardId },
            data: {
              ownerId: buyerId,
              forSale: false,
              status: "sold",
              reservedById: null,
              reservedUntil: null,
              reservedCheckoutSessionId: null,
              binderId: null, // optional: remove from seller binder
            },
          });
        });

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        const cardId = session.metadata?.cardId;

        if (orderId && cardId) {
          await prisma.$transaction([
            prisma.order.update({
              where: { id: orderId },
              data: { status: "EXPIRED" },
            }),
            prisma.card.updateMany({
              where: {
                id: cardId,
                status: "reserved",
                reservedCheckoutSessionId: session.id,
              },
              data: {
                status: "available",
                reservedById: null,
                reservedUntil: null,
                reservedCheckoutSessionId: null,
              },
            }),
          ]);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler failed:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
