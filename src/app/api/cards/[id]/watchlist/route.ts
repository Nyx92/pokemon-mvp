import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/cards/[id]/watchlist
 * Toggles the watchlist status for the current user on a specific card.
 * Returns { watchlisted: boolean, count: number }.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cardId = params.id;
  const userId = session.user.id;

  // Check if the user already has this card watchlisted
  const existing = await prisma.cardWatchlist.findUnique({
    where: { cardId_userId: { cardId, userId } },
  });

  if (existing) {
    await prisma.cardWatchlist.delete({ where: { id: existing.id } });
  } else {
    await prisma.cardWatchlist.create({ data: { cardId, userId } });
  }

  const count = await prisma.cardWatchlist.count({ where: { cardId } });

  // watchlisted: true if we just added it (existing was null), false if we just removed it
  return NextResponse.json({ watchlisted: !existing, count });
}
