import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";

/**
 * GET /api/watchlist
 * Returns all cards the authenticated user has watchlisted, newest first.
 * Used by the /watchlist page.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const entries = await prisma.cardWatchlist.findMany({
    where: { userId },
    include: {
      card: {
        include: {
          owner: { select: { id: true, username: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const cards = entries.map(({ card }) => ({
    ...card,
    price: card.price != null ? centsToDollars(card.price) : null,
  }));

  return NextResponse.json({ cards });
}
