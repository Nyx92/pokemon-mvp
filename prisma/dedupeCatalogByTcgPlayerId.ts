// prisma/dedupeCatalogByTcgPlayerId.ts
//
// One-time cleanup: merges any pre-existing PokemonCardCatalog/
// RiftboundCardCatalog rows that share a tcgPlayerId, before a unique
// constraint is added on that column (see the schema change in the same
// task list this script belongs to). For each group, the oldest row
// survives; every Listing and PriceHistory row pointing at a "loser" is
// re-pointed to the survivor, then the loser is deleted.
//
// Run with: pnpm exec tsx prisma/dedupeCatalogByTcgPlayerId.ts

import { PrismaClient } from "@prisma/client";
import { planCatalogDedupe } from "../src/lib/catalogDedupe";

const prisma = new PrismaClient();

async function dedupePokemon() {
  const rows = await prisma.pokemonCardCatalog.findMany({
    select: { id: true, tcgPlayerId: true, createdAt: true },
  });
  const plans = planCatalogDedupe(rows);
  for (const { survivorId, loserIds } of plans) {
    for (const loserId of loserIds) {
      await prisma.listing.updateMany({ where: { pokemonCardId: loserId }, data: { pokemonCardId: survivorId } });
      await prisma.priceHistory.updateMany({ where: { pokemonCardId: loserId }, data: { pokemonCardId: survivorId } });
      await prisma.pokemonCardCatalog.delete({ where: { id: loserId } });
    }
    console.log(`Pokemon: merged ${loserIds.length} duplicate(s) into ${survivorId}`);
  }
}

async function dedupeRiftbound() {
  const rows = await prisma.riftboundCardCatalog.findMany({
    select: { id: true, tcgPlayerId: true, createdAt: true },
  });
  const plans = planCatalogDedupe(rows);
  for (const { survivorId, loserIds } of plans) {
    for (const loserId of loserIds) {
      await prisma.listing.updateMany({ where: { riftboundCardId: loserId }, data: { riftboundCardId: survivorId } });
      await prisma.priceHistory.updateMany({ where: { riftboundCardId: loserId }, data: { riftboundCardId: survivorId } });
      await prisma.riftboundCardCatalog.delete({ where: { id: loserId } });
    }
    console.log(`Riftbound: merged ${loserIds.length} duplicate(s) into ${survivorId}`);
  }
}

dedupePokemon()
  .then(dedupeRiftbound)
  .then(async () => {
    console.log("Dedup complete — safe to add the tcgPlayerId unique constraint now.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Dedup failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
