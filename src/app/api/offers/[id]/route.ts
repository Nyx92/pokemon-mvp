import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { releaseExpiredOfferReservation } from "@/lib/offerExpiry";

const OFFER_ACCEPTANCE_HOURS = 24;

/**
 * PATCH /api/offers/[id]
 * Seller accepts or rejects a pending offer.
 * Body: { action: "accept" | "reject" }
 *
 * Accept:
 *  - Sets offer status → "accepted" with a 24h payment window
 *  - Locks the card with reservedForOffer=true so other buyers can't purchase
 *  - Rejects all other pending offers on the same card
 *
 * Reject:
 *  - Sets offer status → "rejected"
 *  - If this was the accepted offer, releases the card lock
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: { card: { select: { ownerId: true, id: true } } },
    });

    if (!offer)
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    // Only the card owner can accept or reject offers — prevent any other
    // authenticated user from acting on offers that aren't theirs.
    if (offer.card.ownerId !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (offer.archivedAt)
      return NextResponse.json({ error: "Offer is archived" }, { status: 409 });

    const cardId = offer.card.id;
    // The DB doesn't self-update on a timer, so an accepted offer whose 24h window
    // has passed will still appear "accepted" until something checks it.
    // This resets any overdue accepted offer to "expired" and clears the card lock
    // before we act, so the seller isn't incorrectly blocked from accepting a new offer.
    await releaseExpiredOfferReservation(cardId);

    // Re-fetch fresh status after potential expiry release
    const freshOffer = await prisma.offer.findUnique({
      where: { id: params.id },
    });
    if (!freshOffer || freshOffer.status !== "pending") {
      return NextResponse.json(
        { error: "Offer is not pending" },
        { status: 409 }
      );
    }

    if (action === "accept") {
      // Ensure no other accepted offer is still active (safety guard)
      const existingAccepted = await prisma.offer.findFirst({
        where: { cardId, status: "accepted", id: { not: params.id } },
      });
      if (existingAccepted) {
        return NextResponse.json(
          { error: "Another offer is already accepted and pending payment" },
          { status: 409 }
        );
      }

      const acceptedUntil = new Date(
        Date.now() + OFFER_ACCEPTANCE_HOURS * 60 * 60 * 1000
      );

      await prisma.$transaction([
        // Accept this offer with a payment deadline
        prisma.offer.update({
          where: { id: params.id },
          data: { status: "accepted", acceptedUntil },
        }),
        // Reject all other pending offers on the same card
        prisma.offer.updateMany({
          where: { cardId, id: { not: params.id }, status: "pending" },
          data: { status: "rejected" },
        }),
        // Lock the card so regular Buy Now is disabled
        prisma.card.update({
          where: { id: cardId },
          data: {
            reservedForOffer: true,
            reservedById: offer.buyerId,
            reservedUntil: acceptedUntil,
          },
        }),
      ]);
    } else {
      // Reject: if this was the accepted offer, release the card lock
      await prisma.$transaction(async (tx) => {
        await tx.offer.update({
          where: { id: params.id },
          data: { status: "rejected" },
        });

        if (freshOffer.status === "accepted") {
          await tx.card.update({
            where: { id: cardId },
            data: {
              reservedForOffer: false,
              reservedById: null,
              reservedUntil: null,
            },
          });
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[offers PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update offer" },
      { status: 500 }
    );
  }
}
