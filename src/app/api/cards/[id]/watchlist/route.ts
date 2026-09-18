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

  try {
    // Check if the user already has this listing watchlisted
    const existing = await prisma.cardWatchlist.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });

    if (existing) {
      // Always allow removing — including a stale entry for a card the user
      // now owns (e.g. they watchlisted it, then bought it), so there's a
      // way to clear it even though GET /api/watchlist already prunes these
      // automatically on the next load.
      await prisma.cardWatchlist.delete({ where: { id: existing.id } });
    } else {
      // Watchlisting your own card makes no sense — you already have it. This
      // is the authoritative check; CardListItem/AuctionCardItem hiding the
      // button for the owner (isCardOwner in tileHelpers.ts) is UX only, and
      // GET /api/watchlist prunes any entry that slips through some other way.
      const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true } });
      if (listing?.ownerId === userId) {
        return NextResponse.json({ error: "You can't watchlist your own card" }, { status: 400 });
      }
      await prisma.cardWatchlist.create({ data: { listingId, userId } });
    }

    const count = await prisma.cardWatchlist.count({ where: { listingId } });

    // watchlisted: true if we just added it (existing was null), false if we just removed it
    return NextResponse.json({ watchlisted: !existing, count });
  } catch (err) {
    console.error("[cards/[id]/watchlist POST] error:", listingId, userId, err);
    return NextResponse.json({ error: "Failed to update watchlist" }, { status: 500 });
  }
}
