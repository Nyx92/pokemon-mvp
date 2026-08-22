import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, resolveListingDisplay } from "@/lib/listingDisplay";
import type { CardBrowseIndexItem } from "@/types/card";

// GET /api/cards/browse-index
//
// Lightweight, public (no auth — matches GET /api/cards' existing
// no-auth-required browsing pattern), text-only projection of every
// for-sale listing. Feeds the marketplace's client-side fuzzy search
// (fuse.js, same pattern already used there) and filter-sidebar facet
// counts — deliberately excludes price/images/description to keep this
// small enough to fetch once per page load regardless of catalog size.
export async function GET() {
  try {
    const listings = await prisma.listing.findMany({
      where: { forSale: true },
      include: listingCatalogInclude,
    });

    const items: CardBrowseIndexItem[] = listings.map((listing) => {
      const display = resolveListingDisplay(listing);
      return {
        id: listing.id,
        title: display.title,
        setName: display.setName,
        rarity: display.rarity,
        type: display.type ?? null,
        language: display.language,
        condition: listing.condition,
        game: listing.game as "POKEMON" | "RIFTBOUND",
      };
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("❌ Error building browse index:", error);
    return NextResponse.json(
      { error: "Failed to build browse index" },
      { status: 500 }
    );
  }
}
