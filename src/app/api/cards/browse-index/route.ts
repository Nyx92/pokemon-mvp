import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, resolveListingDisplay } from "@/lib/listingDisplay";
import type { CardBrowseIndexItem } from "@/types/card";

// This route has no Request param and touches no dynamic API, so Next
// would otherwise statically prerender it once at build time and freeze
// it there forever — meaning a newly created listing would never appear
// in marketplace search/facet results until the next deploy. This forces
// a background revalidation at most once every 60 seconds instead, so
// new listings become searchable within a minute rather than never.
export const revalidate = 60;

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
    // Rethrow instead of returning a 500 JSON response: this route now
    // revalidates on a timer (see `export const revalidate = 60` above),
    // and a *returned* response — even an error one — looks like a normal
    // successful result to Next's cache and would get cached and served
    // to every visitor for up to 60 seconds. Throwing during a background
    // revalidation makes Next discard the failed attempt and keep serving
    // the last known-good cached response instead.
    throw error;
  }
}
