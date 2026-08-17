import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions, isAdminOrOwner } from "@/lib/auth";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import {
  listingCatalogInclude,
  withListingDisplay,
  updatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const [listing, watchlistEntry] = await Promise.all([
      prisma.listing.findUnique({
        where: { id: params.id },
        include: {
          binder: true,
          // Public card detail page — email deliberately excluded (nothing in
          // the frontend reads it here, and card owners' emails shouldn't be
          // exposed to anonymous visitors).
          owner: { select: { id: true, username: true } },
          _count: { select: { watchlist: true } },
          ...listingCatalogInclude,
        },
      }),
      session?.user?.id
        ? prisma.cardWatchlist.findUnique({
            where: {
              listingId_userId: { listingId: params.id, userId: session.user.id },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Check if the requesting user has this card watchlisted
    const watchlistedByUser = !!watchlistEntry;

    const { _count, ...rest } = withListingDisplay(listing);
    return NextResponse.json({
      card: {
        ...rest,
        price: rest.price != null ? centsToDollars(rest.price) : null,
        watchlistCount: _count.watchlist,
        watchlistedByUser,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching card:", error);
    return NextResponse.json(
      { error: "Failed to fetch card" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listing = await prisma.listing.findUnique({ where: { id: params.id } });
    if (!listing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "admin";

    if (!isAdminOrOwner(session, listing.ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();

    const forSale = formData.get("forSale") === "true";
    const priceRaw = formData.get("price");
    let price: number | null = null;
    if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const dollars = parseFloat(priceRaw);
      if (!Number.isNaN(dollars)) price = dollarsToCents(dollars);
    }

    // A card mid-auction must not be re-listed for sale through this path —
    // POST /api/auctions already set forSale: false and inAuction: true to
    // lock it. Allowing forSale: true here would let Buy Now/offers run
    // concurrently with live bids (the same double-sale class of bug fixed
    // in the offer-accept and auction-creation guards).
    if (forSale && listing.inAuction) {
      return NextResponse.json(
        { error: "Cannot list a card for sale while it is in an active auction" },
        { status: 409 }
      );
    }

    if (forSale && (price == null || price <= 0)) {
      return NextResponse.json(
        { error: "Price must be greater than $0 when listing a card for sale" },
        { status: 400 }
      );
    }

    // Owner: only price + forSale
    if (!isAdmin) {
      const updated = await prisma.listing.update({
        where: { id: params.id },
        data: { price, forSale },
      });
      return NextResponse.json({
        card: {
          ...updated,
          price: updated.price != null ? centsToDollars(updated.price) : null,
        },
      });
    }

    // Admin: full update. Card-identity fields (title/setName/rarity/etc.)
    // only apply when this listing already points at a POKEMON catalog row
    // — editing here updates that row directly (catalog data is shared
    // across every listing of the same card, so the edit is visible to
    // every other seller's listing of it too), rather than reassigning
    // which catalog row the listing points to. RIFTBOUND listings have no
    // identity fields in this form yet (out of scope — see the schema
    // design's non-goals), so their catalog reference is left untouched;
    // only the marketplace fields below (price/condition/etc.) apply.
    const title = formData.get("title") as string;
    const condition = formData.get("condition") as string;
    const description = (formData.get("description") as string) || "";
    const ownerId = formData.get("ownerId") as string;
    const setName = (formData.get("setName") as string) || "";
    const rarity = (formData.get("rarity") as string) || "";
    const tcgPlayerId = formData.get("tcgPlayerId") as string;
    const language = formData.get("language") as string;
    const cardNumber = (formData.get("cardNumber") as string) || "";

    // Existing image URLs the client wants to keep
    const keepRaw = formData.get("keepImageUrls") as string | null;
    const keepImageUrls: string[] = keepRaw ? JSON.parse(keepRaw) : [];

    // Upload any new images
    const newImages = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);
    const newImageUrls: string[] = [];

    for (const image of newImages) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const filename = `cards/${Date.now()}-${image.name}`;
      const { data, error } = await supabase.storage
        .from("card-images")
        .upload(filename, buffer, { contentType: image.type, upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from("card-images")
        .getPublicUrl(data.path);
      newImageUrls.push(pub.publicUrl);
    }

    const imageUrls = [...keepImageUrls, ...newImageUrls];
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    if (listing.game === "POKEMON" && listing.pokemonCardId) {
      await updatePokemonCatalogEntry(prisma, listing.pokemonCardId, {
        title,
        setName,
        rarity,
        tcgPlayerId,
        language,
        cardNumber,
      });
    }

    const updated = await prisma.listing.update({
      where: { id: params.id },
      data: {
        price,
        condition,
        description,
        imageUrls,
        forSale,
        ownerId,
      },
      include: listingCatalogInclude,
    });

    const withDisplay = withListingDisplay(updated);
    return NextResponse.json({
      card: {
        ...withDisplay,
        price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
      },
    });
  } catch (error: any) {
    console.error("❌ Error updating card:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update card" },
      { status: 500 }
    );
  }
}
