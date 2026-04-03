import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, dollarsToCents } from "@/lib/money";
import { releaseExpiredOfferReservation } from "@/lib/offerExpiry";

/**
 * GET /api/offers?cardId=X           — seller: all non-archived offers on their card
 * GET /api/offers?cardId=X&myOffer=true — viewer: their own offer on this card (or null)
 * GET /api/offers?mine=true          — buyer: full offer history
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const myOffer = searchParams.get("myOffer") === "true";
  const mine = searchParams.get("mine") === "true";

  try {
    // ── Viewer: fetch their own offer on a specific card ──────────────────────
    if (cardId && myOffer) {
      await releaseExpiredOfferReservation(cardId);

      const offer = await prisma.offer.findFirst({
        where: {
          cardId,
          buyerId: userId,
          // show the most relevant active offer (exclude paid/archived)
          status: { in: ["pending", "accepted", "rejected", "expired"] },
          archivedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offer: offer
          ? { ...offer, price: offer.price != null ? centsToDollars(offer.price) : null }
          : null,
      });
    }

    // ── Seller: all non-archived offers on their card ─────────────────────────
    if (cardId) {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { ownerId: true },
      });
      if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
      if (card.ownerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await releaseExpiredOfferReservation(cardId);

      const offers = await prisma.offer.findMany({
        where: { cardId, archivedAt: null },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offers: offers.map((o) => ({
          ...o,
          price: o.price != null ? centsToDollars(o.price) : null,
        })),
      });
    }

    // ── Buyer: their full offer history ───────────────────────────────────────
    if (mine) {
      const offers = await prisma.offer.findMany({
        where: { buyerId: userId },
        include: {
          card: {
            select: {
              id: true,
              title: true,
              imageUrls: true,
              condition: true,
              forSale: true,
              reservedForOffer: true,
              owner: { select: { id: true, username: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        offers: offers.map((o) => ({
          ...o,
          price: o.price != null ? centsToDollars(o.price) : null,
        })),
      });
    }

    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  } catch (err) {
    console.error("[offers GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
}

/**
 * POST /api/offers — buyer places or amends an offer on a card.
 * If a pending offer already exists, it is updated in-place.
 * Blocked if the buyer already has an accepted offer (must pay or wait for expiry).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const buyerId = session.user.id;

  try {
    const { cardId, price, message } = await req.json();

    if (!cardId || price == null || Number(price) <= 0) {
      return NextResponse.json({ error: "Invalid offer data" }, { status: 400 });
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (!card.forSale) return NextResponse.json({ error: "Card is not for sale" }, { status: 409 });
    if (card.ownerId === buyerId) {
      return NextResponse.json({ error: "Cannot offer on your own card" }, { status: 400 });
    }

    await releaseExpiredOfferReservation(cardId);

    // Check for existing live offers from this buyer
    const existing = await prisma.offer.findFirst({
      where: { cardId, buyerId, status: { in: ["pending", "accepted"] }, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.status === "accepted") {
      return NextResponse.json(
        { error: "You have an accepted offer — please pay or wait for it to expire before amending." },
        { status: 409 }
      );
    }

    const priceInCents = dollarsToCents(Number(price));
    const cleanMessage = message?.trim() || null;

    if (existing?.status === "pending") {
      // Amend: update the existing pending offer
      const updated = await prisma.offer.update({
        where: { id: existing.id },
        data: { price: priceInCents, message: cleanMessage },
      });
      return NextResponse.json({
        offer: { ...updated, price: centsToDollars(updated.price!) },
        amended: true,
      });
    }

    // New offer
    const offer = await prisma.offer.create({
      data: {
        cardId,
        buyerId,
        price: priceInCents,
        message: cleanMessage,
        status: "pending",
      },
    });

    return NextResponse.json(
      { offer: { ...offer, price: centsToDollars(offer.price!) }, amended: false },
      { status: 201 }
    );
  } catch (err) {
    console.error("[offers POST] error:", err);
    return NextResponse.json({ error: "Failed to place offer" }, { status: 500 });
  }
}
