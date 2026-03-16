import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const card = await prisma.card.findUnique({
      where: { id: params.id },
      include: {
        binder: true,
        owner: { select: { id: true, username: true, email: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({
      card: {
        ...card,
        price: card.price != null ? centsToDollars(card.price) : null,
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
