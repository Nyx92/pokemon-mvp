import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { postCollectionRequest } from "@/lib/discord";
import {
  OPEN_COLLECTION_STATUSES,
  generateCollectionRef,
  listingCollectionIneligibilityReason,
} from "@/lib/collectionRequests";

/**
 * POST /api/collection-requests
 *
 * Body: { listingIds: string[] }
 *
 * Marks one or more cards the caller owns as "collect in person." Joins the
 * caller's existing open (REQUESTED/PACKED) request if they have one —
 * topping up a request that was already PACKED reverts it to REQUESTED so
 * staff re-check it — otherwise creates a new one. A card already for sale,
 * in an auction, with a pending offer, or already part of a request/already
 * collected is rejected; see src/lib/collectionRequests.ts.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  // 🔒 Rate limit by user id — this fires a Discord webhook call on every
  // request, and is otherwise a cheap-to-spam DB write. In-memory stopgap
  // (see src/lib/rateLimit.ts).
  const { allowed } = checkRateLimit(`collection-request:${userId}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { listingIds: rawListingIds } = await req.json();
    if (!Array.isArray(rawListingIds) || rawListingIds.length === 0) {
      return NextResponse.json({ error: "Select at least one card" }, { status: 400 });
    }
    // De-duped: findMany below returns at most one row per id, so a
    // duplicate id in the submitted list would otherwise make listings.length
    // fall short of listingIds.length and wrongly trip the 404 check below.
    const listingIds = Array.from(new Set(rawListingIds));

    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, ownerId: true, forSale: true, inAuction: true, collectionRequestId: true, collectedAt: true },
    });

    if (listings.length !== listingIds.length) {
      return NextResponse.json({ error: "One or more cards were not found" }, { status: 404 });
    }
    const notOwned = listings.find((l) => l.ownerId !== userId);
    if (notOwned) {
      return NextResponse.json({ error: "You can only mark cards you own" }, { status: 403 });
    }

    for (const listing of listings) {
      const reason = listingCollectionIneligibilityReason(listing);
      if (reason) {
        return NextResponse.json({ error: `One of your selected cards ${reason}` }, { status: 409 });
      }
    }

    // A card with a pending offer must resolve that first — same rationale
    // as the identical guard in POST /api/auctions: accepting the offer
    // later would fight this request over who "owns" the card next.
    const pendingOffer = await prisma.offer.findFirst({
      where: { listingId: { in: listingIds }, status: "pending", archivedAt: null },
      select: { id: true },
    });
    if (pendingOffer) {
      return NextResponse.json(
        { error: "One of your selected cards has a pending offer — resolve it first" },
        { status: 409 }
      );
    }

    // Finding/creating the request and attaching the listings to it happen
    // in one transaction — otherwise a crash between the two writes could
    // leave a request row linked to none of its cards (or an existing
    // request "revived" from PACKED with the new cards never attached).
    // The Discord post below is a best-effort side effect, not part of this
    // atomicity, so it stays outside the transaction.
    const request = await prisma.$transaction(async (tx) => {
      const existing = await tx.collectionRequest.findFirst({
        where: { userId, status: { in: [...OPEN_COLLECTION_STATUSES] } },
        orderBy: { requestedAt: "desc" },
      });

      const request = existing
        ? await tx.collectionRequest.update({
            where: { id: existing.id },
            // Topping up an already-packed request means staff need to
            // re-pack it with the new items included.
            data: existing.status === "PACKED" ? { status: "REQUESTED", packedAt: null } : {},
          })
        : await tx.collectionRequest.create({
            data: { requestRef: generateCollectionRef(), userId },
          });

      await tx.listing.updateMany({
        where: { id: { in: listingIds } },
        data: { collectionRequestId: request.id },
      });

      return { ...request, isTopUp: Boolean(existing) };
    });

    const messageId = await postCollectionRequest({
      requestRef: request.requestRef,
      customerEmail: session.user.email ?? "",
      customerName: session.user.username ?? session.user.firstName,
      // Just this call's items, not the request's running total — see
      // postCollectionRequest's isTopUp param for how the alert phrases this.
      itemCount: listingIds.length,
      isTopUp: request.isTopUp,
    });
    if (messageId) {
      await prisma.collectionRequest.update({
        where: { id: request.id },
        data: { discordMessageIds: { push: messageId } },
      });
    }

    return NextResponse.json({
      request: { id: request.id, requestRef: request.requestRef, status: request.status },
    });
  } catch (err) {
    console.error("[collection-requests] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
