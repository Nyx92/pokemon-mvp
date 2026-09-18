import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCatalogDisplayCore } from "@/lib/listingDisplay";
import type { MyCollectionBrowseIndexItem } from "@/types/card";

/**
 * GET /api/user/cards/browse-index
 *
 * Lightweight, text-only projection of every card the caller owns —
 * mirrors GET /api/cards/browse-index's role for the marketplace: feeds
 * My Collection's client-side fuzzy search across the caller's *entire*
 * collection, while the paginated GET /api/user/cards only ever holds one
 * page of full (image/price-bearing) card data at a time. See
 * src/app/myCollection/MyCollection.tsx.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const listings = await prisma.listing.findMany({
      where: { ownerId: userId, collectedAt: null },
      select: {
        id: true,
        game: true,
        condition: true,
        forSale: true,
        inAuction: true,
        collectionRequestId: true,
        pokemonCard: { select: { nameEn: true, rarity: true, setNameEn: true, language: true } },
        riftboundCard: { select: { name: true, rarity: true, setLabel: true, type: true } },
      },
    });

    const items: MyCollectionBrowseIndexItem[] = listings.map((listing) => ({
      id: listing.id,
      ...resolveCatalogDisplayCore(listing),
      condition: listing.condition,
      game: listing.game as "POKEMON" | "RIFTBOUND",
      status: listing.collectionRequestId
        ? "pending_collection"
        : listing.inAuction
          ? "in_auction"
          : listing.forSale
            ? "for_sale"
            : "available",
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[user/cards/browse-index GET] error:", userId, err);
    return NextResponse.json({ error: "Failed to fetch collection index" }, { status: 500 });
  }
}
