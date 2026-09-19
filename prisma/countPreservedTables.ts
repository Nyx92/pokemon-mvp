// prisma/countPreservedTables.ts
//
// Prints the row counts of the three tables a database reset must never
// lose data from: PokemonCardCatalog, RiftboundCardCatalog, and
// PriceHistory. script/reset-db.sh calls this before and after
// `prisma db push`, so it can stop immediately — before ever reaching
// `pnpm run seed` — if a schema change unexpectedly drops rows from any of
// them, rather than silently reseeding on top of a partial data loss.
//
// Run with: pnpm exec tsx prisma/countPreservedTables.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [pokemonCardCatalog, riftboundCardCatalog, priceHistory] = await Promise.all([
    prisma.pokemonCardCatalog.count(),
    prisma.riftboundCardCatalog.count(),
    prisma.priceHistory.count(),
  ]);
  // One machine-readable line — the caller just diffs this string
  // before/after, no need to parse individual counts out of it.
  console.log(`${pokemonCardCatalog},${riftboundCardCatalog},${priceHistory}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ countPreservedTables failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
