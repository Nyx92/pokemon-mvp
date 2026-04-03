import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireOffer } from "@/lib/offerExpiry";

/**
 * POST /api/cron/expire-offers
 *
 * Background job that cleans up overdue pending offers.
 *
 * Why is this needed?
 * ───────────────────
 * When a buyer places an offer, Stripe authorises (holds) the funds on their
 * card. If the seller never responds, that hold must eventually be released —
 * otherwise the buyer's money is stuck indefinitely.
 *
 * This job:
 *   1. Finds all pending offers where expiresAt has passed (seller didn't respond
 *      within 24h).
 *   2. For each one, calls expireOffer() which:
 *        a. Cancels the Stripe PaymentIntent → releases the hold on buyer's card
 *        b. Sets offer status → "expired" in the DB
 *
 * How to run it:
 * ──────────────
 * Call this endpoint on a schedule (e.g. every 15 minutes). Options:
 *   - Vercel Cron Jobs (vercel.json "crons" config, if using Vercel)
 *   - A GitHub Actions scheduled workflow
 *   - Any external cron service (e.g. cron-job.org, EasyCron)
 *   - Locally for testing: `curl -X POST http://localhost:3000/api/cron/expire-offers \
 *       -H "Authorization: Bearer <CRON_SECRET>"`
 *
 * Security:
 * ─────────
 * The endpoint is protected by a shared secret in CRON_SECRET env var.
 * Requests without the correct bearer token are rejected with 401.
 * This prevents arbitrary callers from triggering mass PI cancellations.
 *
 * Set CRON_SECRET in your .env:
 *   CRON_SECRET=some-long-random-secret
 */
export async function POST(req: NextRequest) {
  // ── 1. Authorise the cron caller ──────────────────────────────────────────
  // The secret must match CRON_SECRET in env. Use a long random string.
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    // Misconfiguration — log loudly and refuse
    console.error("[cron/expire-offers] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Find all pending offers that have passed their expiry time ──────────
  // "pending" = seller hasn't responded yet
  // expiresAt < now = the 24h window has passed
  const now = new Date();
  const expiredOffers = await prisma.offer.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      paymentIntentId: true,
      buyerId: true,
      cardId: true,
    },
  });

  if (expiredOffers.length === 0) {
    return NextResponse.json({ expired: 0, message: "Nothing to expire" });
  }

  // ── 3. Expire each offer one by one ───────────────────────────────────────
  // We process sequentially (not in parallel) to avoid hammering Stripe's API
  // with a burst of concurrent requests. If one fails, we log and continue so
  // the rest still get processed.
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const offer of expiredOffers) {
    try {
      // expireOffer: cancels the PI then marks offer "expired" in DB
      await expireOffer(offer);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(
        `Offer ${offer.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      console.error("[cron/expire-offers] Failed to expire offer:", offer.id, err);
    }
  }

  // ── 4. Return a summary ───────────────────────────────────────────────────
  // Useful for monitoring / alerting. Check these in your cron service logs.
  console.log(
    `[cron/expire-offers] Done. Success: ${results.success}, Failed: ${results.failed}`
  );

  return NextResponse.json({
    expired: results.success,
    failed: results.failed,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}
