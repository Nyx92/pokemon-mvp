import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cards
export async function GET() {
  try {
    const cards = await prisma.card.findMany({
      include: {
        binder: true,
        owner: { select: { username: true } },
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
