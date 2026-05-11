// src/app/api/cart/route.ts
//
// Three operations on the user's cart:
//
//   GET  /api/cart          → return the full cart grouped into packages by seller
//   POST /api/cart          → add a card (idempotent — adding the same card twice is safe)
//   DELETE /api/cart        → clear all items (or only selected items with ?selected=true)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Upsert so that the very first GET silently creates an empty cart for new users
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: {
          card: {
            include: {
              owner: { select: { id: true, username: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Also fetch the user's profile so the cart summary can show the shipping address
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      address: true,
      phoneNumber: true,
    },
  });

  // Group items by seller — each group becomes a "package" in the UI
  const sellerMap = new Map<
    string,
    { sellerName: string; items: (typeof cart.items)[number][] }
  >();

  for (const item of cart.items) {
    const sellerId = item.card.owner.id;
    const sellerName = item.card.owner.username ?? item.card.owner.email;
    if (!sellerMap.has(sellerId)) {
      sellerMap.set(sellerId, { sellerName, items: [] });
    }
    sellerMap.get(sellerId)!.items.push(item);
  }

  const packages = Array.from(sellerMap.entries()).map(
    ([sellerId, { sellerName, items }]) => ({
      sellerId,
      sellerName,
      items: items.map((item) => ({
        id: item.id,
        selected: item.selected,
        createdAt: item.createdAt.toISOString(),
        card: {
          id: item.card.id,
          title: item.card.title,
          price: item.card.price != null ? centsToDollars(item.card.price) : null,
          condition: item.card.condition,
          imageUrls: item.card.imageUrls,
          language: item.card.language,
          setName: item.card.setName,
          rarity: item.card.rarity,
          cardNumber: item.card.cardNumber,
          forSale: item.card.forSale,
          tcgPlayerId: item.card.tcgPlayerId,
          owner: item.card.owner,
        },
      })),
    })
  );

  // Build the display name for the shipping address panel
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "User";

  return NextResponse.json({
    packages,
    userAddress: user
      ? { name, address: user.address ?? null, phoneNumber: user.phoneNumber ?? null }
      : null,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const cardId = typeof body?.cardId === "string" ? body.cardId : null;
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Validate the card exists, is for sale, and doesn't belong to the buyer
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (!card.forSale) {
    return NextResponse.json({ error: "Card is not for sale" }, { status: 400 });
  }
  if (card.ownerId === userId) {
    return NextResponse.json(
      { error: "You cannot add your own card to your cart" },
      { status: 400 }
    );
  }

  // Get or create the user's cart
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // Check if already in cart before creating (so we can tell the caller)
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_cardId: { cartId: cart.id, cardId } },
  });

  if (existing) {
    const count = await prisma.cartItem.count({ where: { cartId: cart.id } });
    return NextResponse.json({
      success: true,
      alreadyInCart: true,
      cartItemId: existing.id,
      count,
    });
  }

  const item = await prisma.cartItem.create({
    data: { cartId: cart.id, cardId, selected: true },
  });

  const count = await prisma.cartItem.count({ where: { cartId: cart.id } });

  return NextResponse.json({
    success: true,
    alreadyInCart: false,
    cartItemId: item.id,
    count,
  });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  // ?selected=true → only remove checked items; otherwise remove everything
  const selectedOnly = url.searchParams.get("selected") === "true";

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  const result = await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      ...(selectedOnly ? { selected: true } : {}),
    },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
