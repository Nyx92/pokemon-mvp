import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { releaseExpiredOfferReservation } from "@/lib/offerExpiry";

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

    // Release any expired offer reservations before returning card state
    await releaseExpiredOfferReservation(params.id);

    const card = await prisma.card.findUnique({
      where: { id: params.id },
      include: {
        binder: true,
        owner: { select: { id: true, username: true, email: true } },
        _count: { select: { likes: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const likedByUser = session?.user?.id
      ? !!(await prisma.cardLike.findUnique({
          where: {
            cardId_userId: { cardId: params.id, userId: session.user.id },
          },
        }))
      : false;

    const { _count, ...rest } = card;
    return NextResponse.json({
      card: {
        ...rest,
        price: card.price != null ? centsToDollars(card.price) : null,
        likesCount: _count.likes,
        likedByUser,
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

    const card = await prisma.card.findUnique({ where: { id: params.id } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "admin";
    const isOwner = card.ownerId === session.user.id;

    if (!isAdmin && !isOwner) {
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

    // Owner: only price + forSale
    if (!isAdmin) {
      const updated = await prisma.card.update({
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

    // Admin: full update
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

    const updated = await prisma.card.update({
      where: { id: params.id },
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

    return NextResponse.json({
      card: {
        ...updated,
        price: updated.price != null ? centsToDollars(updated.price) : null,
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
