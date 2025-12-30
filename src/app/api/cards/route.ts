import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cards
export async function GET() {
  try {
    const cards = await prisma.card.findMany({
      include: {
        binder: true,
        owner: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ cards });
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
      price = parseFloat(priceRaw);
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
