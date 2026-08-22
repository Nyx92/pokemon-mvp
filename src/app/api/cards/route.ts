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
  findOrCreateRiftboundCatalogEntry,
} from "@/lib/listingDisplay";
import { isValidRiftboundType, isValidRiftboundSupertype } from "@/lib/riftboundCatalog";
import type { Prisma } from "@prisma/client";

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
    const gameParam = searchParams.get("game");
    const setNames = searchParams.getAll("setName");
    const rarities = searchParams.getAll("rarity");
    const types = searchParams.getAll("type");
    const languages = searchParams.getAll("language");
    const conditions = searchParams.getAll("condition");
    const ids = searchParams.getAll("ids");

    const and: Prisma.ListingWhereInput[] = [];
    if (forSaleParam === "true") and.push({ forSale: true });
    // tcgPlayerId now lives on whichever catalog a listing points to, not on
    // Listing itself — match either catalog relation since the caller has no
    // way to know which game a given tcgPlayerId belongs to.
    if (tcgPlayerIdParam) {
      and.push({
        OR: [
          { pokemonCard: { tcgPlayerId: tcgPlayerIdParam } },
          { riftboundCard: { tcgPlayerId: tcgPlayerIdParam } },
        ],
      });
    }
    if (gameParam === "POKEMON" || gameParam === "RIFTBOUND") {
      and.push({ game: gameParam });
    }
    if (ids.length > 0) and.push({ id: { in: ids } });
    if (setNames.length > 0) {
      and.push({
        OR: [
          { pokemonCard: { setNameEn: { in: setNames } } },
          { riftboundCard: { setLabel: { in: setNames } } },
        ],
      });
    }
    if (rarities.length > 0) {
      and.push({
        OR: [
          { pokemonCard: { rarity: { in: rarities } } },
          { riftboundCard: { rarity: { in: rarities } } },
        ],
      });
    }
    if (types.length > 0) {
      and.push({ riftboundCard: { type: { in: types } } });
    }
    if (conditions.length > 0) and.push({ condition: { in: conditions } });
    if (languages.length > 0) {
      // Riftbound has no real per-card language column (resolveListingDisplay
      // hardcodes "English" for every Riftbound listing) — so a Riftbound row
      // only matches a language filter when "English" is one of the selected
      // values, rather than trying to filter a column that doesn't exist.
      and.push({
        OR: [
          { pokemonCard: { language: { in: languages } } },
          ...(languages.includes("English") ? [{ game: "RIFTBOUND" as const }] : []),
        ],
      });
    }

    const where: Prisma.ListingWhereInput = and.length > 0 ? { AND: and } : {};

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = pageParam ? parseInt(pageParam, 10) : null;
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : null;
    const isPaginated =
      page != null && pageSize != null && !Number.isNaN(page) && !Number.isNaN(pageSize);

    const [listings, totalCount] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          binder: true,
          // Public listing — email is deliberately excluded (nothing in the
          // frontend reads it here, and card owners' emails shouldn't be
          // exposed to anonymous marketplace visitors).
          owner: { select: { id: true, username: true } },
          ...listingCatalogInclude,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        ...(isPaginated ? { skip: (page! - 1) * pageSize!, take: pageSize! } : {}),
      }),
      isPaginated ? prisma.listing.count({ where }) : Promise.resolve(null),
    ]);

    const cardsForUi = listings.map((listing) => {
      const withDisplay = withListingDisplay(listing);
      return {
        ...withDisplay,
        price: withDisplay.price != null ? centsToDollars(withDisplay.price) : null,
      };
    });

    const body: { cards: typeof cardsForUi; totalCount?: number; hasMore?: boolean } = {
      cards: cardsForUi,
    };
    if (isPaginated && totalCount != null) {
      body.totalCount = totalCount;
      body.hasMore = page! * pageSize! < totalCount;
    }
    return NextResponse.json(body);
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

    const game = formData.get("game") as string | null;
    if (game !== "POKEMON" && game !== "RIFTBOUND") {
      return NextResponse.json(
        { error: `Unknown game: "${game}"` },
        { status: 400 }
      );
    }

    const title = formData.get("title") as string | null;
    const condition = formData.get("condition") as string | null;
    const description = (formData.get("description") as string | null) || "";
    const ownerId = formData.get("ownerId") as string | null;
    const setName = (formData.get("setName") as string | null) || "";
    const rarity = (formData.get("rarity") as string | null) || "";
    const forSale = formData.get("forSale") === "true";
    const tcgPlayerId = formData.get("tcgPlayerId") as string | null;
    // Pokemon-only — Riftbound catalog rows have no language field.
    const language = formData.get("language") as string | null;
    const cardNumber = (formData.get("cardNumber") as string | null) || "";
    // Riftbound-only.
    const type = formData.get("type") as string | null;
    const supertype = (formData.get("supertype") as string | null) ?? "";

    if (game === "RIFTBOUND") {
      if (!type || !isValidRiftboundType(type)) {
        return NextResponse.json(
          { error: `Unknown Riftbound type: "${type}"` },
          { status: 400 }
        );
      }
      if (!isValidRiftboundSupertype(type, supertype)) {
        return NextResponse.json(
          { error: `Supertype "${supertype}" is not valid for type "${type}"` },
          { status: 400 }
        );
      }
    }

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
      (game === "POKEMON" && !language) ||
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
    // doesn't know about the PokemonCardCatalog/RiftboundCardCatalog tables.
    // Reuse a catalog row for repeated uploads of "the same" card (matched by
    // tcgPlayerId), or create one, instead of creating an orphaned
    // catalog-less listing.
    const listingData =
      game === "POKEMON"
        ? {
            game: "POKEMON" as const,
            pokemonCardId: (
              await findOrCreatePokemonCatalogEntry(prisma, {
                title,
                setName,
                rarity,
                tcgPlayerId,
                language: language as string,
                cardNumber,
              })
            ).id,
          }
        : {
            game: "RIFTBOUND" as const,
            riftboundCardId: (
              await findOrCreateRiftboundCatalogEntry(prisma, {
                title,
                setName,
                rarity,
                tcgPlayerId,
                cardNumber,
                type: type as string,
                supertype,
              })
            ).id,
          };

    const listing = await prisma.listing.create({
      data: {
        ...listingData,
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
