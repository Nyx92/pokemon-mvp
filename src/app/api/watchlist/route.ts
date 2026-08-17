import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { centsToDollars } from "@/lib/money";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/watchlist
 * Returns all listings the authenticated user has watchlisted, newest first.
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

  const cards = entries.map(({ listing }) => {
    const withDisplay = withListingDisplay(listing);
    return {
      ...withDisplay,
      price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
    };
  });

  return NextResponse.json({ cards });
}
