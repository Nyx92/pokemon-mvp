// app/api/user/cards/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user/cards
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cards = await prisma.card.findMany({
      where: { ownerId: session.user.id },
      include: {
        binder: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error("❌ Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch user's cards" },
      { status: 500 }
    );
  }
}
