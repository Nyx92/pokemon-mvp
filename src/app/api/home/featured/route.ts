import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";

function mapCard(c: any) {
  return { ...c, price: c.price != null ? centsToDollars(c.price) : null };
}

const cardInclude = {
  owner: { select: { id: true, username: true, email: true } },
  binder: true,
};

export async function GET() {
  try {
    // Best Sellers: admin-curated, ordered by position
    const bestSellerRows = await prisma.bestSeller.findMany({
      orderBy: { position: "asc" },
    });
    const bestSellers = (
      await Promise.all(
        bestSellerRows.map(({ tcgPlayerId }) =>
          prisma.card.findFirst({
            where: { tcgPlayerId, forSale: true },
            include: cardInclude,
            orderBy: { price: "asc" },
          })
        )
      )
    )
      .filter(Boolean)
      .map(mapCard);

    // Highest Transacted: group transactions by tcgPlayerId (via card join),
    // then fetch the cheapest forSale listing for each.
    const topTcgPlayerIds = await prisma.$queryRaw<
      Array<{ tcgPlayerId: string; count: bigint }>
    >`
      SELECT c."tcgPlayerId", COUNT(*) AS count
      FROM "CardTransaction" ct
      JOIN "Card" c ON ct."cardId" = c.id
      GROUP BY c."tcgPlayerId"
      ORDER BY count DESC
      LIMIT 5
    `;

    const highestTransacted = (
      await Promise.all(
        topTcgPlayerIds.map(({ tcgPlayerId }) =>
          prisma.card.findFirst({
            where: { tcgPlayerId, forSale: true },
            include: cardInclude,
            orderBy: { price: "asc" },
          })
        )
      )
    )
      .filter(Boolean)
      .map(mapCard);

    // Newly Listed: 5 most recent forSale cards
    const newlyListedRaw = await prisma.card.findMany({
      where: { forSale: true },
      include: cardInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      bestSellers,
      highestTransacted,
      newlyListed: newlyListedRaw.map(mapCard),
    });
  } catch (error) {
    console.error("❌ Error fetching featured cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured cards" },
      { status: 500 }
    );
  }
}
