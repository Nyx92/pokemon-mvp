import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireOffer } from "@/lib/offerExpiry";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * PATCH /api/offers/[id]
 * Seller accepts or rejects a pending offer.
 * Body: { action: "accept" | "reject" }
 *
 * ── Accept flow ────────────────────────────────────────────────────────────
 *   1. Retrieve the offer + its PaymentIntent ID.
 *   2. Capture the PaymentIntent via Stripe API.
 *      → Money moves from buyer to Stripe. No further action needed by buyer.
 *   3. Inside a DB transaction (atomic — all succeed or all roll back):
 *      a. Mark offer status → "accepted" (briefly, then "paid" below)
 *      b. Transfer card ownership to the buyer (ownerId = buyerId)
 *      c. Mark card as no longer for sale (forSale = false)
 *      d. Archive ALL offers on this card (new owner shouldn't see old offers)
 *      e. Create a CardTransaction record to preserve the sale history
 *   4. Update the offer status → "paid" and link to the Order (outside the
 *      main tx, after capture succeeds).
 *
 *   Why capture then transfer in one go?
 *   In the old flow, accept → buyer waits → buyer pays separately → webhook
 *   triggers transfer. With manual capture, the accept IS the payment — we
 *   capture and transfer atomically so there's no window where money moved
 *   but the card wasn't transferred (or vice versa).
 *
 * ── Reject flow ────────────────────────────────────────────────────────────
 *   1. Cancel the PaymentIntent via Stripe API.
 *      → Stripe releases the hold on the buyer's card. They are not charged.
 *   2. Mark offer status → "rejected".
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { action } = await req.json();
    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // ── 2. Load the offer and its card ─────────────────────────────────────
    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        card: { select: { ownerId: true, id: true, title: true } },
      },
    });

    if (!offer)
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    // Only the card owner (seller) can accept or reject — prevent other users
    // from acting on offers that aren't on their card.
    if (offer.card.ownerId !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Archived offers belong to a card that has already been sold — they are
    // read-only history at this point.
    if (offer.archivedAt)
      return NextResponse.json({ error: "Offer is archived" }, { status: 409 });

    // Only pending offers can be acted on. Accepted/rejected/paid/expired are
    // terminal states (or mid-processing).
    if (offer.status !== "pending") {
      return NextResponse.json(
        { error: "Offer is not pending" },
        { status: 409 }
      );
    }

    // On-demand expiry guard — catches the window between expiresAt passing
    // and the cron job running. If the seller tries to accept/reject an offer
    // that has already passed its deadline (but is still "pending" in the DB
    // because the cron hasn't fired yet), we expire it right now — same two
    // steps as the cron: cancel the Stripe PI, then mark status → "expired".
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await expireOffer({
        id: offer.id,
        paymentIntentId: offer.paymentIntentId,
      });
      return NextResponse.json(
        { error: "This offer has expired" },
        { status: 409 }
      );
    }

    // The offer must have a PaymentIntent — it was created when the buyer
    // submitted the offer form. If it's missing, something went wrong upstream.
    if (!offer.paymentIntentId) {
      return NextResponse.json(
        { error: "No payment intent found for this offer" },
        { status: 409 }
      );
    }

    const cardId = offer.card.id;

    // ══════════════════════════════════════════════════════════════════════════
    // ACCEPT
    // ══════════════════════════════════════════════════════════════════════════
    if (action === "accept") {
      // ── 3. Guard: check card is not reserved by an active Buy Now checkout ──
      // Must run BEFORE capturing the PI. The checkout flow sets reservedById +
      // reservedUntil but leaves forSale: true until the webhook fires. If we
      // captured the PI first and then found the card was reserved, money would
      // have already moved with no way to roll it back cleanly.
      const currentCard = await prisma.card.findUnique({
        where: { id: cardId },
        select: { reservedById: true, reservedUntil: true },
      });
      if (
        currentCard?.reservedById &&
        currentCard.reservedUntil &&
        currentCard.reservedUntil > new Date()
      ) {
        return NextResponse.json(
          { error: "Card is currently reserved by a pending checkout" },
          { status: 409 }
        );
      }

      // ── 4. Capture the PaymentIntent ──────────────────────────────────────
      // This is the moment money moves. Stripe will charge the buyer's card
      // for the amount that was authorised when they placed the offer.
      // If capture fails (e.g. card issuer declined at capture time), we catch
      // the error and return 500 — the offer stays "pending" and the seller can
      // try again or the buyer can re-place the offer.
      const captured = await stripe.paymentIntents.capture(
        offer.paymentIntentId
      );

      // The PI should now be "succeeded" — just for logging/debugging.
      // In a production app you might want to alert if status is unexpected.
      console.log(
        `[offers PATCH] PI captured: ${captured.id} → ${captured.status}`
      );

      // ── 5. Atomic DB transaction ───────────────────────────────────────────
      // Everything below must either all succeed or all roll back.
      // We cannot have money captured but the card not transferred.
      const { order } = await prisma.$transaction(async (tx) => {
        // 5a. Create an Order record to represent this sale.
        //     This links the offer, buyer, seller, and amount for history/display.
        const order = await tx.order.create({
          data: {
            cardId,
            sellerId: userId, // seller = card owner = current user
            buyerId: offer.buyerId,
            amount: offer.price!, // already in cents
            currency: "sgd",
            status: "PAID",
            stripePaymentIntentId: offer.paymentIntentId,
          },
        });

        // 5b. Mark the offer as paid and link it to the Order.
        //     "paid" is the final happy-path status — the buyer got the card.
        await tx.offer.update({
          where: { id: params.id },
          data: {
            status: "paid",
            orderId: order.id,
          },
        });

        // 5c. Archive ALL offers on this card (pending, rejected, expired, etc.)
        //     The card is now sold — neither the new owner nor old buyers should
        //     see these in their active views. History is preserved via archivedAt.
        await tx.offer.updateMany({
          where: { cardId, archivedAt: null },
          data: { archivedAt: new Date() },
        });

        // 5d. Transfer card ownership to the buyer.
        //     - ownerId changes to the buyer
        //     - forSale = false (card is sold, shouldn't appear in marketplace)
        //     - Clear any reservation fields (no longer needed)
        await tx.card.update({
          where: { id: cardId },
          data: {
            ownerId: offer.buyerId,
            forSale: false,
            reservedById: null,
            reservedUntil: null,
            reservedCheckoutSessionId: null,
          },
        });

        // 5e. Create a CardTransaction — permanent audit trail of who sold what,
        //     for how much, and which Stripe PI was used.
        //     (stripeEventId uses the PI id since there's no webhook event here)
        await tx.cardTransaction.create({
          data: {
            orderId: order.id,
            cardId,
            sellerId: userId,
            buyerId: offer.buyerId,
            amount: offer.price!,
            currency: "sgd",
            // Use the PI id as a unique key — there's one PI per offer,
            // so this prevents duplicate transaction records if PATCH is retried.
            stripeEventId: offer.paymentIntentId!,
            tcgPlayerId:
              (
                await tx.card.findUnique({
                  where: { id: cardId },
                  select: { tcgPlayerId: true },
                })
              )?.tcgPlayerId ?? undefined,
          },
        });

        return { order };
      });

      console.log(
        `[offers PATCH] Card ${cardId} transferred to buyer ${offer.buyerId}. Order: ${order.id}`
      );
      return NextResponse.json({ success: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REJECT
    // ══════════════════════════════════════════════════════════════════════════

    // ── 5. Cancel the PaymentIntent ───────────────────────────────────────────
    // This releases the hold on the buyer's card. No money moves.
    // The buyer will see the charge attempt disappear from their bank statement
    // within a few business days.
    try {
      await stripe.paymentIntents.cancel(offer.paymentIntentId);
      console.log(`[offers PATCH] PI cancelled: ${offer.paymentIntentId}`);
    } catch (cancelErr) {
      // If the PI was already cancelled (e.g. expired, duplicate reject call),
      // log and continue — we still want to update our DB status.
      console.warn(
        "[offers PATCH] Could not cancel PI (may already be cancelled):",
        offer.paymentIntentId,
        cancelErr
      );
    }

    // ── 6. Mark the offer as rejected in the DB ───────────────────────────────
    await prisma.offer.update({
      where: { id: params.id },
      data: { status: "rejected" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[offers PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update offer" },
      { status: 500 }
    );
  }
}
