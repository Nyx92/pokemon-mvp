// src/lib/catalogDeltaImport.ts
//
// Applies a CatalogDelta (produced by the separate tcg-index-sync project,
// or a hand-written fixture in tests) to the catalog tables. Upserts by
// tcgPlayerId — the same key the unique constraint enforces — so this is
// safe to run repeatedly with overlapping deltas. Cards with no
// tcgPlayerId are skipped: there's nothing to key an upsert on, and every
// catalog row this app cares about already requires one.

import type { PrismaClient } from "@prisma/client";

export type CatalogDeltaCard = {
  externalId: string;
  tcgPlayerId: string | null;
  name: string;
  language?: "English" | "Japanese";
  imageUrl: string | null;
  [key: string]: unknown;
};

export type CatalogDelta = {
  game: "POKEMON" | "RIFTBOUND";
  generatedAt: string;
  cards: CatalogDeltaCard[];
};

function toPokemonData(card: CatalogDeltaCard) {
  return {
    externalId: card.externalId,
    tcgPlayerId: card.tcgPlayerId,
    nameEn: card.name,
    language: card.language ?? "English",
    imageUrl: card.imageUrl,
    setId: (card.setId as string) ?? card.externalId,
    setNameEn: (card.setNameEn as string) ?? "",
    rarity: (card.rarity as string) ?? "",
    localId: (card.localId as string) ?? null,
  };
}

function toRiftboundData(card: CatalogDeltaCard) {
  return {
    riftboundId: card.externalId,
    tcgPlayerId: card.tcgPlayerId,
    name: card.name,
    imageUrl: card.imageUrl ?? "",
    setId: (card.setId as string) ?? card.externalId,
    setLabel: (card.setLabel as string) ?? "",
    rarity: (card.rarity as string) ?? "",
    collectorNumber: (card.collectorNumber as string) ?? "",
    type: (card.type as string) ?? "",
    supertype: (card.supertype as string) ?? "",
  };
}

export async function importCatalogDelta(
  prisma: PrismaClient,
  delta: CatalogDelta
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const card of delta.cards) {
    if (!card.tcgPlayerId) continue;

    if (delta.game === "POKEMON") {
      const existing = await prisma.pokemonCardCatalog.findUnique({ where: { tcgPlayerId: card.tcgPlayerId } });
      const data = toPokemonData(card);
      await prisma.pokemonCardCatalog.upsert({
        where: { tcgPlayerId: card.tcgPlayerId },
        update: data,
        create: data,
      });
      existing ? updated++ : created++;
    } else {
      const existing = await prisma.riftboundCardCatalog.findUnique({ where: { tcgPlayerId: card.tcgPlayerId } });
      const data = toRiftboundData(card);
      await prisma.riftboundCardCatalog.upsert({
        where: { tcgPlayerId: card.tcgPlayerId },
        update: data,
        create: data,
      });
      existing ? updated++ : created++;
    }
  }

  return { created, updated };
}
