import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import {
  listingCatalogInclude,
  withListingDisplay,
  findOrCreatePokemonCatalogEntry,
} from "@/lib/listingDisplay";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cards?forSale=true
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forSaleParam = searchParams.get("forSale");
    const tcgPlayerIdParam = searchParams.get("tcgPlayerId");

    const where: Record<string, unknown> = {};
    if (forSaleParam === "true") where.forSale = true;
    // tcgPlayerId now lives on whichever catalog a listing points to, not on
    // Listing itself — match either catalog relation since the caller has no
    // way to know which game a given tcgPlayerId belongs to.
    if (tcgPlayerIdParam) {
      where.OR = [
        { pokemonCard: { tcgPlayerId: tcgPlayerIdParam } },
        { riftboundCard: { tcgPlayerId: tcgPlayerIdParam } },
      ];
    }

    const listings = await prisma.listing.findMany({
      where,
      include: {
        binder: true,
        // Public listing — email is deliberately excluded (nothing in the
        // frontend reads it here, and card owners' emails shouldn't be
        // exposed to anonymous marketplace visitors).
        owner: { select: { id: true, username: true } },
        ...listingCatalogInclude,
      },
      orderBy: { createdAt: "desc" },
    });

    const cardsForUi = listings.map((listing) => {
      const withDisplay = withListingDisplay(listing);
      return {
        ...withDisplay,
        price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
      };
    });
    return NextResponse.json({ cards: cardsForUi });
  } catch (error: any) {
    console.error("❌ Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// POST /api/cards
export async function POST(req: Request) {
  try {
    // This endpoint lets the caller assign the new card to ANY user (see
    // ownerId below) — it's an admin tool for listing cards on behalf of
    // sellers, not a self-service upload. The `isAdmin` gate on the /upload
    // page only hides the UI; without a server-side check here, anyone
    // could call this route directly and create a card owned by anyone.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();

    const title = formData.get("title") as string | null;
    const condition = formData.get("condition") as string | null;
    const description = (formData.get("description") as string | null) || "";
    const ownerId = formData.get("ownerId") as string | null;
    const setName = (formData.get("setName") as string | null) || "";
    const rarity = (formData.get("rarity") as string | null) || "";
    const forSale = formData.get("forSale") === "true";
    const tcgPlayerId = formData.get("tcgPlayerId") as string | null;
    const language = formData.get("language") as string | null;
    const cardNumber = (formData.get("cardNumber") as string | null) || "";

    // Price logic (may be omitted when NOT for sale)
    const priceRaw = formData.get("price");
    let price: number | null = null;

    if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const dollars = parseFloat(priceRaw);
      if (!Number.isNaN(dollars)) price = dollarsToCents(dollars);
    }

    const priceRequiredButMissing =
      forSale && (price === null || Number.isNaN(price));

    const images = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);

    if (
      !title ||
      !condition ||
      !ownerId ||
      !tcgPlayerId ||
      !language ||
      images.length === 0 ||
      priceRequiredButMissing
    ) {
      console.error("❌ Missing required fields", {
        title,
        condition,
        ownerId,
        forSale,
        price,
        imagesCount: images.length,
        formKeys: Array.from(formData.keys()),
      });

      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const imageUrls: string[] = [];

    for (const image of images) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `cards/${Date.now()}-${image.name}`;

      const { data, error } = await supabase.storage
        .from("card-images")
        .upload(filename, buffer, {
          contentType: image.type,
          upsert: true,
        });

      if (error) {
        console.error("❌ Supabase upload error:", error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from("card-images")
        .getPublicUrl(data.path);

      imageUrls.push(publicUrlData.publicUrl);
    }

    // The admin upload form only collects flat card-identity fields — it
    // doesn't know about the PokemonCardCatalog table. Reuse a catalog row
    // for repeated uploads of "the same" card (matched by tcgPlayerId), or
    // create one, instead of creating an orphaned catalog-less listing.
    const catalogEntry = await findOrCreatePokemonCatalogEntry(prisma, {
      title,
      setName,
      rarity,
      tcgPlayerId,
      language,
      cardNumber,
    });

    const listing = await prisma.listing.create({
      data: {
        game: "POKEMON",
        pokemonCardId: catalogEntry.id,
        price,
        condition,
        description,
        imageUrls,
        forSale,
        ownerId,
      },
      include: listingCatalogInclude,
    });

    return NextResponse.json({ card: withListingDisplay(listing) });
  } catch (error: any) {
    console.error("❌ Error creating card:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create card" },
      { status: 500 }
    );
  }
}
