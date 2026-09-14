// app/api/user/cards/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";
import { MAX_IDS, MAX_PAGE_SIZE, buildCatalogFacetClauses } from "@/lib/listingsQuery";
import type { Prisma } from "@prisma/client";

// GET /api/user/cards
//   ?status=for_sale|in_auction|pending_collection|available — restrict to one status (see mapListing below)
//   ?game, ?setName, ?rarity, ?type, ?language, ?condition (repeatable except game) — same
//                                        catalog facets Marketplace's FilterBar exposes, see
//                                        buildCatalogFacetClauses
//   ?ids=<id> (repeatable)            — search mode: fetch exactly these listings (already
//                                        relevance-ranked client-side, see MyCollection.tsx),
//                                        clamped to MAX_IDS same as GET /api/cards
//   ?page & ?pageSize                 — paginates; omit either to get every matching row in
//                                        one response (used by the lightweight browse-index
//                                        fetch, which needs the full set for client-side search)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const ids = searchParams.getAll("ids").slice(0, MAX_IDS);
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const rawPage = pageParam ? parseInt(pageParam, 10) : null;
    const rawPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const isPaginated =
      rawPage != null && rawPageSize != null && !Number.isNaN(rawPage) && !Number.isNaN(rawPageSize);
    const clampedPage = isPaginated ? Math.max(1, rawPage!) : null;
    const clampedPageSize = isPaginated ? Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize!)) : null;

    // collectedAt: null — once a card is handed over at in-person pickup
    // it's flagged, not deleted (see POST /api/collection-requests/[id]/otp/confirm),
    // and stops showing up here, same as a sold card leaving this list
    // because ownerId moved to the buyer.
    const and: Prisma.ListingWhereInput[] = [
      { ownerId: session.user.id },
      { collectedAt: null },
    ];
    if (status === "for_sale") and.push({ forSale: true });
    else if (status === "in_auction") and.push({ inAuction: true });
    else if (status === "pending_collection") and.push({ collectionRequestId: { not: null } });
    else if (status === "available") and.push({ forSale: false, inAuction: false, collectionRequestId: null });
    if (ids.length > 0) and.push({ id: { in: ids } });
    and.push(
      ...buildCatalogFacetClauses({
        game: searchParams.get("game") as "POKEMON" | "RIFTBOUND" | null,
        setNames: searchParams.getAll("setName"),
        rarities: searchParams.getAll("rarity"),
        types: searchParams.getAll("type"),
        languages: searchParams.getAll("language"),
        conditions: searchParams.getAll("condition"),
      })
    );

    const where: Prisma.ListingWhereInput = { AND: and };

    const [listings, totalCount] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          collectionRequest: { select: { id: true, requestRef: true, status: true } },
          ...listingCatalogInclude,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        ...(isPaginated ? { skip: (clampedPage! - 1) * clampedPageSize!, take: clampedPageSize! } : {}),
      }),
      isPaginated ? prisma.listing.count({ where }) : Promise.resolve(null),
    ]);

    const cards = listings.map(({ collectionRequest, ...listing }) => ({
      ...withListingDisplay(listing),
      // Drives the "For Collection" filter/tab and the eligible-to-select
      // check in My Collection — see src/app/myCollection/MyCollection.tsx.
      status: collectionRequest
        ? "pending_collection"
        : listing.inAuction
          ? "in_auction"
          : listing.forSale
            ? "for_sale"
            : "available",
      collectionRequestId: collectionRequest?.id ?? null,
      collectionRequestRef: collectionRequest?.requestRef ?? null,
      collectionRequestStatus: collectionRequest?.status ?? null,
    }));

    const body: { cards: typeof cards; hasMore?: boolean } = { cards };
    if (isPaginated && totalCount != null) {
      body.hasMore = clampedPage! * clampedPageSize! < totalCount;
    }

    return NextResponse.json(body);
  } catch (error: any) {
    console.error("❌ Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user's cards" },
      { status: 500 }
    );
  }
}
