import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars } from "@/lib/money";

/**
 * GET /api/price-history/[tcgId]?game=POKEMON|RIFTBOUND
 *
 * Replaces the old /api/pricetracker/[tcgId] route, which called
 * pokemonpricetracker.com live on every page view and had no data for
 * Riftbound at all. This route only reads our own PriceHistory table,
 * populated ahead of time by GET /api/cron/refresh-prices — so a page view
 * never waits on (or spends budget on) a vendor call.
 *
 * Returns every variant this card has data for in one response — "RAW" for
 * ungraded, plus one entry per graded variant (e.g. "PSA 10") — so the chart
 * can switch between them client-side without a second request.
 */
export async function GET(
  req: Request,
  props: { params: Promise<{ tcgId: string }> }
) {
  const { tcgId } = await props.params;
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");

  if (game !== "POKEMON" && game !== "RIFTBOUND") {
    return NextResponse.json(
      { error: "game must be POKEMON or RIFTBOUND" },
      { status: 400 }
    );
  }

  try {
    const catalog =
      game === "POKEMON"
        ? await prisma.pokemonCardCatalog.findFirst({
            where: { tcgPlayerId: tcgId },
            select: { id: true },
          })
        : await prisma.riftboundCardCatalog.findFirst({
            where: { tcgPlayerId: tcgId },
            select: { id: true },
          });

    if (!catalog) {
      return NextResponse.json({ variants: {} });
    }

    const rows = await prisma.priceHistory.findMany({
      where:
        game === "POKEMON"
          ? { pokemonCardId: catalog.id }
          : { riftboundCardId: catalog.id },
      orderBy: { capturedAt: "asc" },
      select: { variant: true, priceCents: true, capturedAt: true },
    });

    const variants: Record<
      string,
      { currentPrice: number | null; lastUpdated: string | null; history: { date: string; price: number }[] }
    > = {};

    for (const row of rows) {
      const dollars = centsToDollars(row.priceCents);
      const date = row.capturedAt.toISOString().slice(0, 10);
      const entry = (variants[row.variant] ??= {
        currentPrice: null,
        lastUpdated: null,
        history: [],
      });
      entry.history.push({ date, price: dollars });
      // rows are ordered by capturedAt asc, so the last one written is the latest
      entry.currentPrice = dollars;
      entry.lastUpdated = date;
    }

    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[price-history GET] error:", tcgId, game, err);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
