import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/watchlist
 * Returns all listings the authenticated user has watchlisted, newest first.
 * Used by the /watchlist page, but also by useWatchlistIds (Marketplace,
 * HomeFeatured, Auctions, CardListItem) and WatchlistAnimationContext,
 * which wraps the whole app — so in practice this fires on close to every
 * page a logged-in user loads, not just /watchlist. Entries for listings
 * no longer for sale or on auction — or that the user now owns themselves
 * (e.g. they watchlisted it, then bought it) — are silently removed as a
 * side effect of this call. See the pruning step below.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const entries = await prisma.cardWatchlist.findMany({
      where: { userId },
      include: {
        listing: {
          include: {
            // Watchlisting a card requires no relationship with the seller —
            // email deliberately excluded, same rationale as cards/route.ts.
            owner: { select: { id: true, username: true } },
            ...listingCatalogInclude,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ownerId === userId here is the authoritative "no watchlisting your own
    // card" guard — CardListItem/AuctionCardItem hiding the button client-side
    // (isCardOwner in tileHelpers.ts) is UX only, not enforcement; a direct
    // call to POST /api/cards/[id]/watchlist is still blocked server-side
    // there too, and any entry that slips through some other way is cleaned
    // up here on the next read.
    //
    // A watchlisted card is pruned here — rather than via a cron, since the
    // watchlist is only ever read through this route, so cleaning up lazily
    // on read is simpler than a scheduled job and the result is identical —
    // once it's no longer purchasable (sold, mid-auction, marked for
    // in-person collection, etc.) or the user now owns it themselves (they
    // watchlisted it, then bought it — watchlisting your own card is
    // blocked going forward, see POST /api/cards/[id]/watchlist, but this
    // covers entries that predate that guard or crossed this way after).
    const isStale = (listing: (typeof entries)[number]["listing"]) =>
      listing.ownerId === userId || (!listing.forSale && !listing.inAuction);
    const stale = entries.filter((e) => isStale(e.listing));
    if (stale.length > 0) {
      await prisma.cardWatchlist.deleteMany({ where: { id: { in: stale.map((e) => e.id) } } });
    }

    const cards = entries
      .filter((e) => !isStale(e.listing))
      .map(({ listing }) => {
        const withDisplay = withListingDisplay(listing);
        return {
          ...withDisplay,
          price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
        };
      });

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("[watchlist GET] error:", userId, err);
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }
}
