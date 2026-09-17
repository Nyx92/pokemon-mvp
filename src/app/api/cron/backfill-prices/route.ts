import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usdToSgdCents } from "@/lib/money";
import {
  fetchCardVariants,
  pickPricedVariants,
  usdMarket,
  runWithConcurrency,
  type JustTcgMarket,
} from "@/lib/pricing/justtcg";

/**
 * GET /api/cron/backfill-prices?limit=500 ← recommended schedule: twice a month (cron-job.org)
 * POST /api/cron/backfill-prices ← kept for local curl testing
 *
 * The EXPENSIVE, occasional half of the two-tier pricing strategy (see also
 * /api/cron/refresh-prices for the cheap, frequent half). Pulls up to a full
 * year of daily history per card from JustTCG's v2 endpoint — the only one
 * that supports both graded prices and a configurable history window — one
 * call per card, since v2 has no batch mode.
 *
 * Self-resuming: a card is marked `priceBackfilledAt` once it succeeds, so a
 * card is only ever deep-pulled once, not re-pulled every run. Each
 * invocation processes at most `limit` cards (default 500, capped at 950)
 * to stay comfortably under JustTCG's 1,000-request daily cap even
 * alongside other calls made the same day. Run it again (same day or the
 * next) to keep working through the backlog — it always picks up wherever
 * it left off, and once every card is backfilled, a run does almost nothing
 * (only genuinely new catalog cards get pulled).
 *
 * Catalog-wide, listing-prioritized: every pending card is eligible now, not
 * just ones with a listing, but a card someone's actually trying to sell is
 * pulled before one nobody's listed yet, within the same per-run budget.
 *
 * For local testing:
 *   curl "http://localhost:3000/api/cron/backfill-prices?limit=50" \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

type PendingCard = { id: string; tcgPlayerId: string | null; language?: string };

/**
 * Writes one variant's full backfill in a small, fixed number of queries
 * instead of one round trip per day. A card that's never been backfilled
 * before has no pre-existing rows for its history days (that's what
 * priceBackfilledAt gates), so the only day that can possibly already exist
 * is today — if the cheap daily refresh already wrote it first. One read
 * finds those, one createMany writes everything else, and only real
 * collisions (typically zero or one) get an individual update.
 */
async function backfillVariant(
  catalogIdField: "pokemonCardId" | "riftboundCardId",
  catalogId: string,
  game: "POKEMON" | "RIFTBOUND",
  label: string,
  market: JustTcgMarket,
  capturedAt: Date
) {
  const priceCentsByDay = new Map<string, number>();
  for (const point of market.price_history ?? []) {
    const day = new Date(point.t * 1000).toISOString().slice(0, 10);
    priceCentsByDay.set(day, usdToSgdCents(point.p));
  }
  // The live price can be newer than the last price_history point, or the
  // only price at all if a variant has no history array.
  if (typeof market.price === "number") {
    priceCentsByDay.set(capturedAt.toISOString().slice(0, 10), usdToSgdCents(market.price));
  }
  if (priceCentsByDay.size === 0) return;

  const days = [...priceCentsByDay.keys()];
  const existingRows = await prisma.priceHistory.findMany({
    where: {
      [catalogIdField]: catalogId,
      variant: label,
      capturedAt: { in: days.map((d) => new Date(d)) },
    },
    select: { id: true, capturedAt: true },
  });
  const existingIdByDay = new Map(
    existingRows.map((r) => [r.capturedAt.toISOString().slice(0, 10), r.id])
  );

  const toCreate = days
    .filter((day) => !existingIdByDay.has(day))
    .map((day) => ({
      game,
      [catalogIdField]: catalogId,
      variant: label,
      priceCents: priceCentsByDay.get(day) as number,
      capturedAt: new Date(day),
    }));
  if (toCreate.length > 0) {
    await prisma.priceHistory.createMany({ data: toCreate });
  }

  for (const [day, id] of existingIdByDay) {
    await prisma.priceHistory.update({
      where: { id },
      data: { priceCents: priceCentsByDay.get(day) as number },
    });
  }
}

async function backfillCard(
  catalogIdField: "pokemonCardId" | "riftboundCardId",
  catalogId: string,
  game: "POKEMON" | "RIFTBOUND",
  tcgPlayerId: string,
  language: string | undefined,
  capturedAt: Date
) {
  const variants = await fetchCardVariants({
    tcgPlayerId,
    game,
    language,
    historyWindow: "1y",
  });

  // A card with several graded prices (PSA 8/9/10, CGC, ...) used to pay for
  // each variant's read+write round trip one after another — the real cost
  // of even a single card's backfill when many grades exist. These write to
  // different rows, so they run concurrently instead.
  const picks = pickPricedVariants(variants).filter((p) => usdMarket(p.variant) !== null);
  await runWithConcurrency(picks, 5, ({ label, variant }) =>
    backfillVariant(catalogIdField, catalogId, game, label, usdMarket(variant) as JustTcgMarket, capturedAt)
  );
}

async function runBackfill(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("[cron/backfill-prices] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  // Default 500, not the route's own 950 cap on its own — the daily refresh
  // job (now covering the full catalog too) needs headroom in the same
  // shared JustTCG daily budget. See the design doc's Budget note.
  const requestedLimit = Number(searchParams.get("limit") ?? "500");
  const limit = Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 500, 950);

  const capturedAt = new Date(new Date().toISOString().slice(0, 10));
  // No listings filter here: every pending card is eligible, listed or not.
  const basePending = { tcgPlayerId: { not: null }, priceBackfilledAt: null };

  // Listed cards first, since a card someone's actually trying to sell
  // matters more than one nobody's listed yet, when JustTCG's daily budget
  // is the limiting factor. No new state: same priceBackfilledAt queue,
  // just drained in two ordered passes instead of one query gated on
  // listing existence. Once the listed pass alone fills the budget, the
  // unlisted pass is skipped entirely — no point spending a second query.
  async function takeCards<T extends "pokemonCardCatalog" | "riftboundCardCatalog">(
    model: T,
    remaining: number
  ): Promise<PendingCard[]> {
    if (remaining <= 0) return [];
    const select =
      model === "pokemonCardCatalog"
        ? { id: true, tcgPlayerId: true, language: true }
        : { id: true, tcgPlayerId: true };

    const listed: PendingCard[] = await (prisma[model] as any).findMany({
      where: { ...basePending, listings: { some: {} } },
      select,
      take: remaining,
      orderBy: { id: "asc" },
    });
    if (listed.length >= remaining) return listed;

    const unlisted: PendingCard[] = await (prisma[model] as any).findMany({
      where: { ...basePending, listings: { none: {} } },
      select,
      take: remaining - listed.length,
      orderBy: { id: "asc" },
    });
    return [...listed, ...unlisted];
  }

  const pokemonCards = await takeCards("pokemonCardCatalog", limit);
  const riftboundCards = await takeCards("riftboundCardCatalog", limit - pokemonCards.length);

  const results = { backfilled: 0, failed: 0, errors: [] as string[] };

  // Cards run several at a time instead of one at a time — each one pays a
  // JustTCG round trip plus several database round trips, so processing them
  // strictly in sequence was the main reason a run could take far longer
  // than any cron-job.org timeout. Capped at the Supabase pooler's
  // connection_limit=5 (see src/lib/prisma.ts).
  const BACKFILL_CONCURRENCY = 5;

  await runWithConcurrency(pokemonCards, BACKFILL_CONCURRENCY, async (card) => {
    try {
      await backfillCard("pokemonCardId", card.id, "POKEMON", card.tcgPlayerId as string, card.language, capturedAt);
      await prisma.pokemonCardCatalog.update({
        where: { id: card.id },
        data: { priceBackfilledAt: new Date() },
      });
      results.backfilled++;
    } catch (err) {
      results.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Pokemon card ${card.id}: ${msg}`);
      console.error("[cron/backfill-prices] Failed to backfill card:", card.id, msg);
    }
  });

  await runWithConcurrency(riftboundCards, BACKFILL_CONCURRENCY, async (card) => {
    try {
      await backfillCard("riftboundCardId", card.id, "RIFTBOUND", card.tcgPlayerId as string, undefined, capturedAt);
      await prisma.riftboundCardCatalog.update({
        where: { id: card.id },
        data: { priceBackfilledAt: new Date() },
      });
      results.backfilled++;
    } catch (err) {
      results.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Riftbound card ${card.id}: ${msg}`);
      console.error("[cron/backfill-prices] Failed to backfill card:", card.id, msg);
    }
  });

  const [remainingPokemon, remainingRiftbound] = await Promise.all([
    prisma.pokemonCardCatalog.count({ where: basePending }),
    prisma.riftboundCardCatalog.count({ where: basePending }),
  ]);

  console.log(
    `[cron/backfill-prices] Done. Backfilled: ${results.backfilled}, Failed: ${results.failed}, Remaining: ${remainingPokemon + remainingRiftbound}`
  );

  return NextResponse.json({
    backfilled: results.backfilled,
    failed: results.failed,
    remaining: remainingPokemon + remainingRiftbound,
    ...(results.errors.length > 0 && { errors: results.errors }),
  });
}

export const GET = runBackfill;
export const POST = runBackfill;
