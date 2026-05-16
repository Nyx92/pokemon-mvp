/**
 * auctionSettlement.ts — shared logic for settling a completed auction.
 *
 * Called from three places:
 *   - POST /api/auctions/[id]/bid    (when a bid hits the reserve or buy-out price)
 *   - POST /api/auctions/[id]/decide (when the seller accepts after pending_seller_decision)
 *   - GET  /api/cron/expire-auctions (when the auction closes with highest bid >= reservePrice)
 *
 * Settlement mirrors the offer-accept flow in PATCH /api/offers/[id]:
 *   1. Capture the winning bid's PaymentIntent (money moves from buyer to platform).
 *   2. Atomic DB transaction:
 *      a. Create Order record (sale history + amount)
 *      b. Create CardTransaction audit record (stripeEventId = PI id, same convention)
 *      c. Mark winning bid → "won"
 *      d. Mark all other active bids → "cancelled" (PI cancellations happen outside tx)
 *      e. Transfer card ownership (ownerId = winner, inAuction = false)
 *      f. Mark auction → "sold"
 *   3. If DB fails AFTER capture: issue a Stripe refund (compensating transaction)
 *      so the buyer is made whole.
 *   4. Cancel losing bidders' PIs (fire-and-forget, same pattern as expired offers).
 *   5. Notify winner and seller (fire-and-forget).
 */

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { notifyAsync } from "@/lib/notifications";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * settleAuction — captures the winning PI and completes the ownership transfer.
 * Safe to call multiple times: returns immediately if the auction is already "sold".
 */
export async function settleAuction(auctionId: string): Promise<void> {
  // 1. Load the auction with its current winning (active) bid and card metadata.
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        where:   { status: "active" },
        orderBy: { amount: "desc" },
        take:    1,
      },
      card: { select: { title: true, tcgPlayerId: true } },
    },
  });

  if (!auction) throw new Error(`[auctionSettlement] Auction ${auctionId} not found`);
  if (auction.status === "sold") return; // already settled — idempotent

  const winningBid = auction.bids[0];
  if (!winningBid) throw new Error(`[auctionSettlement] No active bid on auction ${auctionId}`);

  // 2. Capture the winning PI. Money moves from buyer to platform.
  //    Capture first so the DB transaction can record the confirmed payment.
  //    If capture fails (issuer decline at capture time), we throw without
  //    touching the DB — auction stays in its current state for a retry.
  const captured = await stripe.paymentIntents.capture(winningBid.paymentIntentId);
  console.log(`[auctionSettlement] PI captured: ${captured.id} → ${captured.status}`);

  // 3. Snapshot losing bids now (before the transaction marks them cancelled)
  //    so we have their PI ids for the fire-and-forget cancellations in step 5.
  const losingBids = await prisma.bid.findMany({
    where:  { auctionId, status: "active", id: { not: winningBid.id } },
    select: { id: true, paymentIntentId: true, bidderId: true },
  });

  // 4. Atomic DB transaction — all succeed or all roll back.
  //    Cannot include Stripe calls here (they can't be rolled back).
  try {
    await prisma.$transaction(async (tx) => {
      // 4a. Create an Order record to represent this sale.
      const order = await tx.order.create({
        data: {
          cardId:                 auction.cardId,
          sellerId:               auction.sellerId,
          buyerId:                winningBid.bidderId,
          amount:                 winningBid.amount,
          currency:               "sgd",
          status:                 "PAID",
          stripePaymentIntentId:  winningBid.paymentIntentId,
        },
      });

      // 4b. Permanent audit record.
      //     stripeEventId uses the PI id (same convention as PATCH /api/offers/[id])
      //     since auction settlements don't go through a Stripe webhook event.
      await tx.cardTransaction.create({
        data: {
          orderId:      order.id,
          cardId:       auction.cardId,
          sellerId:     auction.sellerId,
          buyerId:      winningBid.bidderId,
          amount:       winningBid.amount,
          currency:     "sgd",
          stripeEventId: winningBid.paymentIntentId,
          tcgPlayerId:  auction.card.tcgPlayerId ?? undefined,
        },
      });

      // 4c. Mark winning bid as won.
      await tx.bid.update({
        where: { id: winningBid.id },
        data:  { status: "won" },
      });

      // 4d. Cancel all other active bids in the DB.
      //     Their Stripe PIs are cancelled outside the transaction (step 5).
      if (losingBids.length > 0) {
        await tx.bid.updateMany({
          where: { auctionId, status: "active", id: { not: winningBid.id } },
          data:  { status: "cancelled" },
        });
      }

      // 4e. Transfer card ownership.
      await tx.card.update({
        where: { id: auction.cardId },
        data:  { ownerId: winningBid.bidderId, inAuction: false, forSale: false },
      });

      // 4f. Mark auction as sold.
      await tx.auction.update({
        where: { id: auctionId },
        data:  { status: "sold" },
      });
    });
  } catch (dbErr) {
    // DB failed AFTER PI was captured — refund the buyer to make them whole.
    console.error("[auctionSettlement] DB transaction failed after capture, issuing refund:", dbErr);
    try {
      await stripe.refunds.create({ payment_intent: winningBid.paymentIntentId });
    } catch (refundErr) {
      console.error("[auctionSettlement] Refund also failed — manual intervention required:", refundErr);
    }
    throw dbErr;
  }

  // 5. Cancel losing PIs outside the transaction — fire-and-forget.
  //    A background cron can sweep up any that slip through on transient errors.
  for (const bid of losingBids) {
    cancelBidPI(bid.paymentIntentId);
    notifyAsync({
      userId: bid.bidderId,
      type:   "auction_expired",
      title:  `Auction ended for "${auction.card.title}"`,
      body:   `The auction for "${auction.card.title}" has ended. You did not win this time.`,
      cardId: auction.cardId,
    });
  }

  // 6. Notify winner and seller.
  const amountDisplay = `S$${(winningBid.amount / 100).toFixed(2)}`;

  notifyAsync({
    userId: winningBid.bidderId,
    type:   "auction_won",
    title:  `You won "${auction.card.title}"!`,
    body:   `Congratulations! You won the auction for "${auction.card.title}" at ${amountDisplay}. The card is now yours.`,
    cardId: auction.cardId,
  });

  notifyAsync({
    userId: auction.sellerId,
    type:   "auction_sold",
    title:  `"${auction.card.title}" sold via auction`,
    body:   `Your card "${auction.card.title}" was sold for ${amountDisplay}.`,
    cardId: auction.cardId,
  });

  console.log(
    `[auctionSettlement] Settled. Auction: ${auctionId}, Winner: ${winningBid.bidderId}, Amount: ${winningBid.amount}`
  );
}

/**
 * cancelBidPI — cancels a bid's Stripe PI, swallowing terminal-state errors.
 * Exported so the cron and decide route can reuse it without duplicating
 * the payment_intent_unexpected_state guard (same pattern as expireOffer).
 */
export function cancelBidPI(paymentIntentId: string): void {
  stripe.paymentIntents.cancel(paymentIntentId).catch((err: { code?: string }) => {
    // payment_intent_unexpected_state = PI already captured/cancelled — safe to ignore.
    if (err?.code !== "payment_intent_unexpected_state") {
      console.error(`[auctionSettlement] Failed to cancel PI ${paymentIntentId}:`, err);
    }
  });
}
