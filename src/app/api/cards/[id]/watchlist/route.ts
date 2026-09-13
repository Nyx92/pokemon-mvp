import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/cards/[id]/watchlist
 * Toggles the watchlist status for the current user on a specific listing.
 * Returns { watchlisted: boolean, count: number }.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listingId = params.id;
  const userId = session.user.id;

  // Check if the user already has this listing watchlisted
  const existing = await prisma.cardWatchlist.findUnique({
    where: { listingId_userId: { listingId, userId } },
  });

  if (existing) {
    await prisma.cardWatchlist.delete({ where: { id: existing.id } });
  } else {
    await prisma.cardWatchlist.create({ data: { listingId, userId } });
  }

  const count = await prisma.cardWatchlist.count({ where: { listingId } });

  // watchlisted: true if we just added it (existing was null), false if we just removed it
  return NextResponse.json({ watchlisted: !existing, count });
}
