import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { dollarsToCents, centsToDollars } from "@/lib/money";

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
    if (tcgPlayerIdParam) where.tcgPlayerId = tcgPlayerIdParam;

    const cards = await prisma.card.findMany({
      where,
      include: {
        binder: true,
        // Public listing — email is deliberately excluded (nothing in the
        // frontend reads it here, and card owners' emails shouldn't be
        // exposed to anonymous marketplace visitors).
        owner: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const cardsForUi = cards.map((c) => ({
      ...c,
      // if c.price is cents-int or null
      price: c.price != null ? centsToDollars(c.price) : null,
    }));
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

    // ✅ Basic fields
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

    // ✅ Multiple image files
    const images = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File);

    // Validation
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

    // ✅ Upload all images to Supabase
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

    // ✅ Save new card with multiple image URLs
    const card = await prisma.card.create({
      data: {
        title,
        price,
        condition,
        description,
        imageUrls,
        forSale,
        setName,
        rarity,
        tcgPlayerId,
        language,
        cardNumber,
        owner: { connect: { id: ownerId } },
      },
    });

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error("❌ Error creating card:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create card" },
      { status: 500 }
    );
  }
}
