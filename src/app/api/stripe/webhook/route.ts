import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// Webhooks should run on Node runtime (Stripe SDK + raw body signature verification)
export const runtime = "nodejs";
// Prevent caching / ensure webhook always executes dynamically
export const dynamic = "force-dynamic";

// Stripe client (server-side secret key)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  /**
   * 1) Signature + raw body verification
   * Stripe signs the raw request body. We MUST use req.text() (raw string)
   * and verify it using STRIPE_WEBHOOK_SECRET.
   */
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

  /**
   * 2) Handle webhook event types
   * - checkout.session.completed => user finished checkout; finalize if paid
   * - checkout.session.expired   => checkout session expired; release reservation + expire order
   */
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        /**
         * ✅ Safety: Only finalize when Stripe confirms payment is paid
         * (prevents marking PAID when payment is incomplete or async).
         */
        if (session.payment_status !== "paid") break;

        /**
         * We rely on metadata added when creating the Checkout Session
         * (orderId/cardId/buyerId/sellerId).
         */
        const orderId = session.metadata?.orderId;
        const cardId = session.metadata?.cardId;
        const buyerId = session.metadata?.buyerId;
        const sellerId = session.metadata?.sellerId;

        if (!orderId || !cardId || !buyerId || !sellerId) {
          throw new Error("Missing metadata on session");
        }

        /**
         * PaymentIntent is useful for refunds / reconciliation later.
         * (Stripe may store it as string or object; we keep only string id)
         */
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;

        /**
         * 3) Finalize purchase atomically (DB transaction)
         * This is the authoritative “transfer card + mark order paid” step.
         */
        await prisma.$transaction(async (tx) => {
          /**
           * 3a) Idempotency guard
           * Stripe may retry events. We store Stripe's event.id as a unique key.
           * If we’ve already processed this exact webhook event, do nothing.
           */
          const existingTx = await tx.cardTransaction.findUnique({
            where: { stripeEventId: event.id },
          });
          if (existingTx) return;

          /**
           * 3b) Load order from DB
           * We also validate that metadata matches the order to prevent
           * accidental mismatches updating the wrong order/card.
           */
          const order = await tx.order.findUnique({ where: { id: orderId } });

          if (!order) throw new Error("Order not found");

          // ✅ Metadata matches DB order
          if (order.cardId !== cardId) throw new Error("Order card mismatch");
          if (order.buyerId !== buyerId)
            throw new Error("Order buyer mismatch");
          if (order.sellerId !== sellerId)
            throw new Error("Order seller mismatch");

          // ✅ Ensure this order is tied to THIS Checkout Session id (extra safety)
          if (
            order.stripeCheckoutSessionId &&
            order.stripeCheckoutSessionId !== session.id
          ) {
            throw new Error("Order session mismatch");
          }

          /**
           * 3c) If order already PAID:
           * We do NOT re-transfer or re-update order.
           * You currently *still write* a CardTransaction row to record this
           * webhook event id as processed (so retries won’t fail).
           *
           * Note: This means you might store more than one CardTransaction per order
           * over time (rare), depending on how Stripe retries.
           */
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

          /**
           * 3d) Mark order as PAID and store Stripe PaymentIntent id
           */
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId ?? undefined,
            },
          });

          /**
           * 3e) Create CardTransaction record (your “receipt / ledger” entry)
           */
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

          /**
           * 3f) Transfer ownership + finalize listing
           * Critical guard:
           * - only transfer if this card is reserved by THIS checkout session + buyer
           * - prevents double-sell and wrong finalization
           *
           * We use updateMany so we can check how many rows were updated.
           */
          const moved = await tx.card.updateMany({
            where: {
              id: cardId,
              reservedCheckoutSessionId: session.id,
              reservedById: buyerId,
              forSale: true,
            },
            data: {
              ownerId: buyerId,
              forSale: false, // card no longer listed after purchase
              reservedById: null,
              reservedUntil: null,
              reservedCheckoutSessionId: null,
              binderId: null, // remove from seller binder
            },
          });

          /**
           * If count != 1, it means the card wasn't reserved correctly
           * (wrong session, already sold, race condition, etc).
           */
          if (moved.count !== 1) {
            throw new Error("Card was not reserved by this checkout session");
          }
        });

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        /**
         * When checkout expires:
         * - mark order EXPIRED if still PENDING
         * - release reservation if reservation was tied to this session id
         */
        const orderId = session.metadata?.orderId;
        const cardId = session.metadata?.cardId;

        if (orderId && cardId) {
          await prisma.$transaction([
            prisma.order.updateMany({
              // ✅ don't overwrite paid orders
              where: { id: orderId, status: "PENDING" },
              data: { status: "EXPIRED" },
            }),
            prisma.card.updateMany({
              // ✅ only release reservation belonging to this expired session
              where: {
                id: cardId,
                reservedCheckoutSessionId: session.id,
              },
              data: {
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
        // Ignore other event types for now
        break;
    }

    // ✅ Always acknowledge receipt quickly with 2xx
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] handler failed:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
