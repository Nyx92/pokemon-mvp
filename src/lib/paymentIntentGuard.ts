// lib/paymentIntentGuard.ts

import type Stripe from "stripe";
import { NextResponse } from "next/server";

/**
 * verifyPaymentIntentAmountOrRespond — cross-checks that the amount a
 * PaymentIntent was actually authorised for matches the amount the client
 * is claiming (an offer price or a bid amount). Without this, a buyer could
 * authorise a small PI, then submit an arbitrarily larger claimed amount —
 * the DB would record the larger figure while Stripe only ever holds/
 * captures the smaller one. Fixed once already (commit 8401551) in both
 * offers/route.ts and bid/route.ts independently; centralized here so a
 * future payment-accepting route can reuse it instead of a third hand-copy.
 *
 * Returns `null` when the amounts match (caller proceeds normally).
 * Returns a ready-to-return NextResponse when they don't: the mismatched PI
 * is cancelled (best-effort — a cancel failure is logged, not thrown) and a
 * 400 response is built with an entity-specific error message.
 */
export async function verifyPaymentIntentAmountOrRespond(
  stripe: Stripe,
  paymentIntentId: string,
  authorisedAmountCents: number,
  claimedAmountCents: number,
  entityLabel: "Offer" | "Bid"
): Promise<NextResponse | null> {
  if (authorisedAmountCents === claimedAmountCents) return null;

  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (cancelErr) {
    console.warn(
      `[${entityLabel.toLowerCase()} amount guard] Could not cancel mismatched PI:`,
      paymentIntentId,
      cancelErr
    );
  }

  return NextResponse.json(
    { error: `${entityLabel} amount does not match the authorised payment amount` },
    { status: 400 }
  );
}
