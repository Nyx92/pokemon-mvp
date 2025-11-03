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

    const image = formData.get("image") as File;
    const title = formData.get("title") as string;
    const price = parseFloat(formData.get("price") as string);
    const condition = formData.get("condition") as string;
    const description = formData.get("description") as string;
    const ownerId = formData.get("ownerId") as string;
    const setName = formData.get("setName") as string;
    const rarity = formData.get("rarity") as string;
    const type = formData.get("type") as string;

    if (!title || !price || !condition || !ownerId || !image) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Upload image to Supabase
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `cards/${Date.now()}-${image.name}`;
    const { data, error } = await supabase.storage
      .from("card-images")
      .upload(filename, buffer, {
        contentType: image.type,
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from("card-images")
      .getPublicUrl(data.path);
    const imageUrl = publicUrlData.publicUrl;
    const forSale = formData.get("forSale") === "true";

    // ✅ Save new card
    const card = await prisma.card.create({
      data: {
        title,
        price,
        condition,
        description,
        imageUrls: [imageUrl],
        forSale,
        setName,
        rarity,
        type,
        owner: { connect: { id: ownerId } }, // attach to the user
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
