import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * expireOffer(offerId)
 *
 * Marks a single offer as "expired" and cancels its Stripe PaymentIntent.
 * This is the shared helper used by both:
 *   - The cron job (POST /api/cron/expire-offers) — runs on a schedule
 *     to bulk-expire all offers where expiresAt has passed.
 *   - Any future on-demand expiry check (e.g. before displaying an offer).
 *
 * Steps:
 *   1. Cancel the Stripe PaymentIntent (releases the hold on buyer's card).
 *   2. Mark the offer status → "expired" in the DB.
 *
 * Order matters: we cancel the PI first. If the DB update fails, we can
 * retry — a cancelled PI is idempotent (cancelling an already-cancelled PI
 * just returns the same object). If we updated the DB first and then the
 * PI cancel failed, we'd have an "expired" DB record with an active hold —
 * the buyer would be stuck with a charge they can't pay or cancel.
 */
export async function expireOffer(offer: {
  id: string;
  paymentIntentId: string | null;
}) {
  // ── Step 1: Cancel the Stripe PaymentIntent ───────────────────────────────
  if (offer.paymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(offer.paymentIntentId);
    } catch (err: unknown) {
      const stripeErr = err as { code?: string; message?: string };

      if (stripeErr?.code === "payment_intent_unexpected_state") {
        // PI is already in a terminal state (cancelled, captured, etc.).
        // The hold is already released or the payment already went through —
        // safe to fall through and mark the offer expired in the DB.
        console.warn(
          "[offerExpiry] PI already in terminal state, skipping cancel:",
          offer.paymentIntentId
        );
      } else {
        // Unexpected error (network failure, Stripe outage, etc.).
        // Re-throw so the DB update below does NOT run.
        // The offer stays "pending" and the cron will retry on its next run.
        // This prevents the offer from being permanently stranded as "expired"
        // in our DB while the PI is still holding the buyer's funds on Stripe.
        console.error(
          "[offerExpiry] Unexpected error cancelling PI — leaving offer pending for retry:",
          offer.paymentIntentId,
          stripeErr
        );
        throw err;
      }
    }
  }

  // ── Step 2: Mark offer as expired in DB ───────────────────────────────────
  await prisma.offer.update({
    where: { id: offer.id },
    data: { status: "expired" },
  });
}
