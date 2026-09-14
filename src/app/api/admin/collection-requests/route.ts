import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OPEN_COLLECTION_STATUSES } from "@/lib/collectionRequests";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/admin/collection-requests — staff only.
 *
 * Every open (REQUESTED or PACKED) pickup request, oldest first, with its
 * customer and cards — backs the /admin/collection-requests staff page
 * used to pack requests in advance.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const requests = await prisma.collectionRequest.findMany({
      where: { status: { in: [...OPEN_COLLECTION_STATUSES] } },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true } },
        listings: { include: listingCatalogInclude },
      },
      orderBy: { requestedAt: "asc" },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        requestRef: r.requestRef,
        status: r.status,
        requestedAt: r.requestedAt,
        packedAt: r.packedAt,
        customer: r.user,
        cards: r.listings.map((listing) => withListingDisplay(listing)),
      })),
    });
  } catch (err) {
    console.error("[admin/collection-requests] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
