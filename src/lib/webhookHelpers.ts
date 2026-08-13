// lib/webhookHelpers.ts

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAsync } from "@/lib/notifications";

/**
 * transferCardOwnership — the concurrency-guarded ownership transfer shared
 * by handleCartSessionCompleted and handleSingleSessionCompleted in the
 * Stripe webhook. The WHERE clause only matches if the card is still
 * reserved by this exact checkout session and buyer; if another process
 * already transferred or released it, the count comes back 0 and the caller
 * throws to roll back its transaction (triggering the refund safeguard).
 *
 * Returns the row count rather than throwing itself — the two callers log
 * slightly different messages on failure, which stays their responsibility.
 */
export async function transferCardOwnership(
  tx: Prisma.TransactionClient,
  params: { cardId: string; checkoutSessionId: string; buyerId: string }
): Promise<number> {
  const moved = await tx.card.updateMany({
    where: {
      id: params.cardId,
      reservedCheckoutSessionId: params.checkoutSessionId,
      reservedById: params.buyerId,
      forSale: true,
    },
    data: {
      ownerId: params.buyerId,
      forSale: false,
      price: null,
      reservedById: null,
      reservedUntil: null,
      reservedCheckoutSessionId: null,
      binderId: null,
    },
  });
  return moved.count;
}

/**
 * notifySellerCardSold — fire-and-forget "card sold" notification shared by
 * both webhook handlers. Never throws — a failed lookup/send is swallowed,
 * matching the existing behavior at both call sites (a notification failure
 * must never affect webhook processing).
 */
export function notifySellerCardSold(params: {
  sellerId: string;
  cardId: string;
  orderId: string;
}): void {
  prisma.card
    .findUnique({ where: { id: params.cardId }, select: { title: true } })
    .then((card) =>
      notifyAsync({
        userId: params.sellerId,
        type: "card_sold",
        title: "Your card was sold",
        body: `Your card "${card?.title ?? "a card"}" was purchased via Buy Now.`,
        cardId: params.cardId,
        orderId: params.orderId,
      })
    )
    .catch(() => {});
}
