import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usdToSgdCents } from "@/lib/money";
import {
  fetchCardVariants,
  fetchCardVariantsBatch,
  pickPricedVariants,
  usdMarket,
  chunk,
} from "@/lib/pricing/justtcg";
import { toPriceVariantLabel } from "@/app/utils/mapCondition";

/**
 * GET /api/cron/refresh-prices ← recommended schedule: once a day (cron-job.org)
 * POST /api/cron/refresh-prices ← kept for local curl testing
 *
 * The CHEAP, frequent half of the two-tier pricing strategy (see also
 * /api/cron/backfill-prices for the expensive, occasional half). This job
 * only ever writes *today's* price — it never touches history — so it's
 * safe to run daily indefinitely without approaching JustTCG's call quota:
 *
 *   - Raw prices for the whole catalog go through JustTCG's v1 batch
 *     endpoint, 100 cards per call (~13 calls for 1,200+ cards).
 *   - Graded prices need v2 (v1 doesn't return them), so those are one call
 *     per card — but only for cards that actually have a graded Listing,
 *     which today is a small fraction of the catalog.
 *
 * Total: roughly (catalog size / 100) + (graded-listed card count) calls
 * per run — under 20 today, and still cheap even as the catalog grows.
 *
 * For local testing:
 *   curl http://localhost:3000/api/cron/refresh-prices \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

type CardRef = {
  catalogIdField: "pokemonCardId" | "riftboundCardId";
  catalogId: string;
  game: "POKEMON" | "RIFTBOUND";
  tcgPlayerId: string;
  language?: string;
};

async function upsertPriceRow(
  catalogIdField: "pokemonCardId" | "riftboundCardId",
  catalogId: string,
  game: "POKEMON" | "RIFTBOUND",
  variant: string,
  priceCents: number,
  capturedAt: Date
) {
  const existing = await prisma.priceHistory.findFirst({
    where: { [catalogIdField]: catalogId, variant, capturedAt },
    select: { id: true },
  });

  if (existing) {
    await prisma.priceHistory.update({
      where: { id: existing.id },
      data: { priceCents },
    });
  } else {
    await prisma.priceHistory.create({
      data: { game, [catalogIdField]: catalogId, variant, priceCents, capturedAt },
    });
  }
}

async function runRefresh(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("[cron/refresh-prices] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capturedAt = new Date(new Date().toISOString().slice(0, 10));

  const [pokemonCards, riftboundCards, pokemonListings, riftboundListings] = await Promise.all([
    prisma.pokemonCardCatalog.findMany({
      where: { tcgPlayerId: { not: null } },
      select: { id: true, tcgPlayerId: true, language: true },
    }),
    prisma.riftboundCardCatalog.findMany({
      where: { tcgPlayerId: { not: null } },
      select: { id: true, tcgPlayerId: true },
    }),
    prisma.listing.findMany({
      where: { game: "POKEMON", pokemonCardId: { not: null } },
      select: { condition: true, pokemonCardId: true },
    }),
    prisma.listing.findMany({
      where: { game: "RIFTBOUND", riftboundCardId: { not: null } },
      select: { condition: true, riftboundCardId: true },
    }),
  ]);

  const gradedPokemonCardIds = new Set(
    pokemonListings
      .filter((l) => toPriceVariantLabel(l.condition) !== "RAW")
      .map((l) => l.pokemonCardId)
  );
  const gradedRiftboundCardIds = new Set(
    riftboundListings
      .filter((l) => toPriceVariantLabel(l.condition) !== "RAW")
      .map((l) => l.riftboundCardId)
  );

  const allCards: CardRef[] = [
    ...pokemonCards.map((c) => ({
      catalogIdField: "pokemonCardId" as const,
      catalogId: c.id,
      game: "POKEMON" as const,
      tcgPlayerId: c.tcgPlayerId as string,
      language: c.language,
    })),
    ...riftboundCards.map((c) => ({
      catalogIdField: "riftboundCardId" as const,
      catalogId: c.id,
      game: "RIFTBOUND" as const,
      tcgPlayerId: c.tcgPlayerId as string,
    })),
  ];

  const results = { rawRefreshed: 0, gradedRefreshed: 0, failed: 0, errors: [] as string[] };

  // ── Raw prices: batched, 100 cards per call ────────────────────────────
  for (const batch of chunk(allCards, 100)) {
    try {
      const byTcgId = await fetchCardVariantsBatch(batch.map((c) => c.tcgPlayerId));
      for (const card of batch) {
        const variants = byTcgId.get(card.tcgPlayerId) ?? [];
        for (const { label, variant } of pickPricedVariants(variants)) {
          const market = usdMarket(variant);
          if (!market) continue;
          await upsertPriceRow(
            card.catalogIdField,
            card.catalogId,
            card.game,
            label,
            usdToSgdCents(market.price),
            capturedAt
          );
        }
        results.rawRefreshed++;
      }
    } catch (err) {
      results.failed += batch.length;
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Batch of ${batch.length} starting at ${batch[0]?.tcgPlayerId}: ${msg}`);
      console.error("[cron/refresh-prices] Batch failed:", msg);
    }
  }

  // ── Graded prices: one call per card that actually has a graded listing ─
  const gradedCards = allCards.filter(
    (c) =>
      (c.game === "POKEMON" && gradedPokemonCardIds.has(c.catalogId)) ||
      (c.game === "RIFTBOUND" && gradedRiftboundCardIds.has(c.catalogId))
  );

  for (const card of gradedCards) {
    try {
      const variants = await fetchCardVariants({
        tcgPlayerId: card.tcgPlayerId,
        game: card.game,
        language: card.language,
      });
      const gradedPicks = pickPricedVariants(variants).filter((p) => p.label !== "RAW");
      for (const { label, variant } of gradedPicks) {
        const market = usdMarket(variant);
        if (!market) continue;
        await upsertPriceRow(
          card.catalogIdField,
          card.catalogId,
          card.game,
          label,
          usdToSgdCents(market.price),
          capturedAt
        );
      }
      results.gradedRefreshed++;
    } catch (err) {
      results.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Graded card ${card.catalogId}: ${msg}`);
      console.error("[cron/refresh-prices] Failed graded card:", card.catalogId, msg);
    }
  }

  console.log(
    `[cron/refresh-prices] Done. Raw: ${results.rawRefreshed}, Graded: ${results.gradedRefreshed}, Failed: ${results.failed}`
  );

  return NextResponse.json({
    rawRefreshed: results.rawRefreshed,
    gradedRefreshed: results.gradedRefreshed,
    failed: results.failed,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}

export const GET = runRefresh;
export const POST = runRefresh;
