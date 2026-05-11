// src/app/api/cart/[itemId]/route.ts
//
//   PATCH  /api/cart/[itemId]  → toggle the selected flag on a cart item
//   DELETE /api/cart/[itemId]  → remove a single item from the cart

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Params = { params: { itemId: string } };

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.selected !== "boolean") {
    return NextResponse.json(
      { error: "selected (boolean) is required" },
      { status: 400 }
    );
  }

  // Verify the item belongs to this user's cart before updating
  const item = await prisma.cartItem.findUnique({
    where: { id: params.itemId },
    include: { cart: { select: { userId: true } } },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.cart.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.cartItem.update({
    where: { id: params.itemId },
    data: { selected: body.selected },
  });

  return NextResponse.json({ success: true, selected: updated.selected });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership before deleting
  const item = await prisma.cartItem.findUnique({
    where: { id: params.itemId },
    include: { cart: { select: { userId: true } } },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.cart.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.cartItem.delete({ where: { id: params.itemId } });

  return NextResponse.json({ success: true });
}
