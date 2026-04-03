import { prisma } from "@/lib/prisma";

/**
 * Lazily checks if the card's accepted-offer reservation has expired.
 * If so, resets the offer to "expired" and releases the card lock.
 * Call this before any read that depends on offer/reservation state.
 */
export async function releaseExpiredOfferReservation(cardId: string) {
  const now = new Date();

  // Find an accepted offer on this card whose window has passed
  const expiredOffer = await prisma.offer.findFirst({
    where: {
      cardId,
      status: "accepted",
      acceptedUntil: { lt: now },
    },
  });

  if (!expiredOffer) return;

  await prisma.$transaction([
    // Mark offer as expired
    prisma.offer.update({
      where: { id: expiredOffer.id },
      data: { status: "expired" },
    }),
    // Release the card's offer lock so it's purchasable again
    prisma.card.update({
      where: { id: cardId },
      data: {
        reservedForOffer: false,
        reservedById: null,
        reservedUntil: null,
      },
    }),
  ]);
}
