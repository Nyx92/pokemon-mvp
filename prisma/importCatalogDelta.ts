// prisma/importCatalogDelta.ts
//
// Run with: pnpm exec tsx prisma/importCatalogDelta.ts <path-to-delta.json>

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { importCatalogDelta, type CatalogDelta } from "../src/lib/catalogDeltaImport";

const prisma = new PrismaClient();

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: pnpm exec tsx prisma/importCatalogDelta.ts <path-to-delta.json>");

  const delta: CatalogDelta = JSON.parse(readFileSync(path, "utf-8"));
  const { created, updated } = await importCatalogDelta(prisma, delta);
  console.log(`Imported ${delta.game} delta (${delta.cards.length} cards): ${created} created, ${updated} updated.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error("Import failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
