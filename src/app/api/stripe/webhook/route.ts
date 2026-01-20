import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"; // important for Stripe signature verification

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const stripeSessionId = session.id;
      const cardId = session.metadata?.cardId;
      const buyerId = session.metadata?.buyerId; // ✅ from your checkout metadata
      const buyerEmail = session.customer_details?.email ?? null;

      if (!cardId) {
        console.warn(
          "⚠️ checkout.session.completed missing cardId in metadata"
        );
        return NextResponse.json({ ok: true });
      }

      // ✅ Idempotency: ensure we only process once
      // You need SOME record to check against.
      // Best: create a Purchase table later.
      // For now: store stripeSessionId on the card if you have a field.
      //
      // If you DON'T have a field, you can still do a safe update using status/forSale checks,
      // but you won't be protected against edge cases as well.

      // Option A (recommended): if your Card model has stripeSessionId (string?) – use it
      // Option B: fall back to "already sold" check

      const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { id: true, status: true, forSale: true, ownerId: true },
      });

      if (!card) {
        console.warn("⚠️ Card not found for cardId:", cardId);
        return NextResponse.json({ ok: true });
      }

      // If already sold, treat as processed (idempotent-ish)
      if (card.status === "sold" || card.forSale === false) {
        return NextResponse.json({ ok: true });
      }

      // ✅ Transaction: mark as sold + transfer owner if we know buyerId
      await prisma.$transaction(async (tx) => {
        await tx.card.update({
          where: { id: cardId },
          data: {
            status: "sold",
            forSale: false,
            // Optional: record who bought it if buyerId exists
            ...(buyerId ? { owner: { connect: { id: buyerId } } } : {}),
            // If you add a field later:
            // stripeSessionId,
          },
        });

        // Later: create purchase record here (when you add schema)
        // await tx.purchase.create({ data: {...} })
      });

      console.log("✅ Processed checkout.session.completed", {
        stripeSessionId,
        cardId,
        buyerId,
        buyerEmail,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Stripe webhook handler failed:", err);
    // Stripe will retry on non-2xx
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
