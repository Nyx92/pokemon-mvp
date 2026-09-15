# Card Lookup Pipeline — pokemon-mvp Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tcgPlayerId` a real, enforced unique key on both catalog tables; give `pokemon-mvp` a script that imports a card-index delta file (produced by a separate, new project — see the companion plan `2026-09-16-card-lookup-pricing-pipeline-tcg-index-sync.md`); and make the pricing cron jobs listing-prioritized instead of listing-gated.

**Architecture:** A one-time cleanup script removes any pre-existing duplicate `tcgPlayerId` rows before a real database unique constraint is added. The two existing find-or-create helpers become atomic upserts against that constraint. A new import script consumes a delta JSON (any file matching the agreed shape — this plan does not depend on the sync project existing yet, since its tests use a hand-written fixture). The two cron routes change their eligibility queries.

**Tech Stack:** Prisma, Next.js API routes, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-card-lookup-pricing-pipeline-design.md`

## Global Constraints

- Schema changes are pushed with `pnpm exec prisma db push` (no migrations folder).
- Never delete a catalog row while anything still needs it — `Listing→catalog` is `onDelete: Restrict` (blocks deletion outright) and `PriceHistory→catalog` is `onDelete: Cascade` (deleting the row silently destroys its price history) — any row being removed must have its dependents re-pointed first.
- The delta file shape (from the spec) both this plan and the sync project agree on:
  ```ts
  type CatalogDelta = {
    game: "POKEMON" | "RIFTBOUND";
    generatedAt: string;
    cards: Array<{
      externalId: string;
      tcgPlayerId: string | null;
      name: string;
      language?: "English" | "Japanese";
      imageUrl: string | null;
      [key: string]: unknown; // remaining fields match the target catalog model 1:1
    }>;
  };
  ```

---

### Task 1: Dedupe existing duplicate `tcgPlayerId` rows

**Files:**
- Create: `prisma/dedupeCatalogByTcgPlayerId.ts`
- Test: `src/__tests__/lib/dedupeCatalogByTcgPlayerId.test.ts`
- Modify (extract for testability): `src/lib/catalogDedupe.ts` (new — the pure logic), imported by both the script and the test

**Interfaces:**
- Produces: `planCatalogDedupe(rows: { id: string; tcgPlayerId: string | null; createdAt: Date }[]): { survivorId: string; loserIds: string[] }[]` — pure function, one entry per group of 2+ rows sharing a non-null `tcgPlayerId`, survivor = oldest `createdAt`.

- [ ] **Step 1: Write the failing test for the pure planning function**

Create `src/__tests__/lib/dedupeCatalogByTcgPlayerId.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planCatalogDedupe } from "@/lib/catalogDedupe";

describe("planCatalogDedupe", () => {
  it("groups rows sharing a tcgPlayerId, oldest as survivor", () => {
    const rows = [
      { id: "b", tcgPlayerId: "123", createdAt: new Date("2026-02-01") },
      { id: "a", tcgPlayerId: "123", createdAt: new Date("2026-01-01") },
      { id: "c", tcgPlayerId: "123", createdAt: new Date("2026-03-01") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([
      { survivorId: "a", loserIds: ["b", "c"] },
    ]);
  });

  it("ignores rows with a null tcgPlayerId", () => {
    const rows = [
      { id: "a", tcgPlayerId: null, createdAt: new Date("2026-01-01") },
      { id: "b", tcgPlayerId: null, createdAt: new Date("2026-01-02") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([]);
  });

  it("returns nothing for tcgPlayerIds that only appear once", () => {
    const rows = [
      { id: "a", tcgPlayerId: "123", createdAt: new Date("2026-01-01") },
      { id: "b", tcgPlayerId: "456", createdAt: new Date("2026-01-01") },
    ];
    expect(planCatalogDedupe(rows)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test dedupeCatalogByTcgPlayerId.test.ts`
Expected: FAIL — `@/lib/catalogDedupe` doesn't exist yet.

- [ ] **Step 3: Implement the pure function**

Create `src/lib/catalogDedupe.ts`:

```ts
// src/lib/catalogDedupe.ts
//
// Pure planning logic for prisma/dedupeCatalogByTcgPlayerId.ts — kept
// separate from the script so it's testable without a database.

type CatalogRow = { id: string; tcgPlayerId: string | null; createdAt: Date };

/**
 * Groups rows that share a non-null tcgPlayerId (a pre-existing data
 * problem — see prisma/dedupeCatalogByTcgPlayerId.ts). The oldest row per
 * group survives; the rest are candidates for merging into it.
 */
export function planCatalogDedupe(
  rows: CatalogRow[]
): { survivorId: string; loserIds: string[] }[] {
  const byTcgPlayerId = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    if (!row.tcgPlayerId) continue;
    const group = byTcgPlayerId.get(row.tcgPlayerId) ?? [];
    group.push(row);
    byTcgPlayerId.set(row.tcgPlayerId, group);
  }

  const plans: { survivorId: string; loserIds: string[] }[] = [];
  for (const group of byTcgPlayerId.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    plans.push({ survivorId: sorted[0].id, loserIds: sorted.slice(1).map((r) => r.id) });
  }
  return plans;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test dedupeCatalogByTcgPlayerId.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Write the script that applies the plan against the real database**

Create `prisma/dedupeCatalogByTcgPlayerId.ts`:

```ts
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
```

- [ ] **Step 6: Run it against the real dev database**

Run: `pnpm exec tsx prisma/dedupeCatalogByTcgPlayerId.ts`
Expected: prints one line per merged group (may print nothing if there were no duplicates — that's success too, not a failure).

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalogDedupe.ts src/__tests__/lib/dedupeCatalogByTcgPlayerId.test.ts prisma/dedupeCatalogByTcgPlayerId.ts
git commit -m "Add one-time cleanup for duplicate catalog tcgPlayerId rows"
```

---

### Task 2: Unique constraint on `tcgPlayerId` + atomic upserts

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/listingDisplay.ts:117-146,184-219` (`findOrCreatePokemonCatalogEntry`, `findOrCreateRiftboundCatalogEntry`)
- Test: `src/__tests__/lib/listingDisplay.test.ts` (existing file — check it first; if it doesn't cover these two functions yet, add tests for them)

**Interfaces:**
- Consumes: Task 1 must run first, or this step's `db push` can fail on existing duplicates.
- Produces: `findOrCreatePokemonCatalogEntry`/`findOrCreateRiftboundCatalogEntry` keep their exact same signatures and return types — only their internals change.

- [ ] **Step 1: Add the unique constraint**

In `prisma/schema.prisma`, change both:
```prisma
  tcgPlayerId    String?
```
to:
```prisma
  tcgPlayerId    String? @unique
```
(one occurrence in `PokemonCardCatalog`, one in `RiftboundCardCatalog`).

- [ ] **Step 2: Push the schema change**

Run: `pnpm exec prisma db push`
Expected: succeeds. If it fails with a unique-constraint violation, Task 1's cleanup script didn't fully run — re-run it and try again.

- [ ] **Step 3: Check for existing tests of the two functions, write missing ones**

Run: `grep -n "findOrCreatePokemonCatalogEntry\|findOrCreateRiftboundCatalogEntry" src/__tests__/lib/listingDisplay.test.ts`. If a test named along the lines of "reuses an existing row" exists, update its mock from `findFirst`+`create` to `upsert` (below). If no such test exists, add:

```ts
  describe("findOrCreatePokemonCatalogEntry", () => {
    it("upserts on tcgPlayerId, not overwriting an existing row's fields", async () => {
      mockPrisma.pokemonCardCatalog.upsert.mockResolvedValue({ id: "existing-1", tcgPlayerId: "42360" });
      const result = await findOrCreatePokemonCatalogEntry(mockPrisma as any, {
        title: "Blastoise", setName: "Base Set", rarity: "Holo Rare",
        tcgPlayerId: "42360", language: "English", cardNumber: "2",
      });
      expect(mockPrisma.pokemonCardCatalog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tcgPlayerId: "42360" }, update: {} })
      );
      expect(result).toEqual({ id: "existing-1", tcgPlayerId: "42360" });
    });
  });
```

(Add the equivalent for `findOrCreateRiftboundCatalogEntry`, and add `pokemonCardCatalog: { upsert: vi.fn() }` / `riftboundCardCatalog: { upsert: vi.fn() }` to that file's `mockPrisma` if it currently only mocks `findFirst`/`create`.)

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test listingDisplay.test.ts`
Expected: FAIL — the functions still call `findFirst`/`create`, not `upsert`.

- [ ] **Step 5: Implement the upsert**

In `src/lib/listingDisplay.ts`, replace the body of `findOrCreatePokemonCatalogEntry` (keep the signature and doc comment) with:

```ts
  return prismaOrTx.pokemonCardCatalog.upsert({
    where: { tcgPlayerId: fields.tcgPlayerId },
    update: {}, // an existing row wins as-is — matches the prior find-and-reuse behavior
    create: {
      externalId: `manual-${fields.tcgPlayerId}`,
      nameEn: fields.title,
      setNameEn: fields.setName,
      rarity: fields.rarity,
      language: fields.language,
      localId: fields.cardNumber || null,
      tcgPlayerId: fields.tcgPlayerId,
      setId: fields.tcgPlayerId,
    },
  });
```

And the body of `findOrCreateRiftboundCatalogEntry` with:

```ts
  return prismaOrTx.riftboundCardCatalog.upsert({
    where: { tcgPlayerId: fields.tcgPlayerId },
    update: {},
    create: {
      riftboundId: `manual-${fields.tcgPlayerId}`,
      name: fields.title,
      setLabel: fields.setName,
      rarity: fields.rarity,
      collectorNumber: fields.cardNumber,
      type: fields.type,
      supertype: fields.supertype,
      tcgPlayerId: fields.tcgPlayerId,
      setId: fields.tcgPlayerId,
      imageUrl: "",
    },
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test listingDisplay.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: PASS, no new failures.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma src/lib/listingDisplay.ts src/__tests__/lib/listingDisplay.test.ts
git commit -m "Make tcgPlayerId unique and find-or-create atomic"
```

---

### Task 3: `importCatalogDelta.ts`

**Files:**
- Create: `prisma/importCatalogDelta.ts`
- Create: `src/lib/catalogDeltaImport.ts` (pure-ish logic, testable without a real file/DB)
- Test: `src/__tests__/lib/catalogDeltaImport.test.ts`
- Create fixture: `src/__tests__/fixtures/catalog-delta-pokemon.json`

**Interfaces:**
- Consumes: `CatalogDelta` shape (Global Constraints section above)
- Produces: `importCatalogDelta(prisma: PrismaClient, delta: CatalogDelta): Promise<{ created: number; updated: number }>`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/catalogDeltaImport.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { importCatalogDelta } from "@/lib/catalogDeltaImport";

const mockPrisma = {
  pokemonCardCatalog: { upsert: vi.fn() },
  riftboundCardCatalog: { upsert: vi.fn() },
} as any;

beforeEach(() => vi.clearAllMocks());

describe("importCatalogDelta", () => {
  it("upserts each Pokemon card by tcgPlayerId, mapping delta fields to catalog columns", async () => {
    mockPrisma.pokemonCardCatalog.upsert.mockResolvedValue({});
    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{
        externalId: "swsh3-136", tcgPlayerId: "192391", name: "Charizard VMAX",
        language: "English", imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp",
        setNameEn: "Darkness Ablaze", rarity: "Secret Rare", setId: "swsh3", localId: "136",
      }],
    });

    expect(mockPrisma.pokemonCardCatalog.upsert).toHaveBeenCalledWith({
      where: { tcgPlayerId: "192391" },
      update: expect.objectContaining({ nameEn: "Charizard VMAX", imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp" }),
      create: expect.objectContaining({ externalId: "swsh3-136", tcgPlayerId: "192391", nameEn: "Charizard VMAX" }),
    });
    expect(result).toEqual({ created: 0, updated: 1 });
  });

  it("counts created vs updated based on whether upsert returned a pre-existing id", async () => {
    // Prisma's upsert doesn't itself report created-vs-updated, so the
    // importer checks first via findUnique before upserting.
    mockPrisma.pokemonCardCatalog.upsert.mockResolvedValue({});
    mockPrisma.pokemonCardCatalog.findUnique = vi.fn()
      .mockResolvedValueOnce(null)         // card 1: doesn't exist yet -> created
      .mockResolvedValueOnce({ id: "x" }); // card 2: exists -> updated

    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [
        { externalId: "a", tcgPlayerId: "1", name: "A", imageUrl: null },
        { externalId: "b", tcgPlayerId: "2", name: "B", imageUrl: null },
      ],
    });

    expect(result).toEqual({ created: 1, updated: 1 });
  });

  it("upserts Riftbound cards against riftboundCardCatalog instead", async () => {
    mockPrisma.riftboundCardCatalog.upsert.mockResolvedValue({});
    mockPrisma.riftboundCardCatalog.findUnique = vi.fn().mockResolvedValue(null);

    await importCatalogDelta(mockPrisma, {
      game: "RIFTBOUND",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{ externalId: "unl-1-219", tcgPlayerId: "500", name: "Test Card", imageUrl: null, setLabel: "Unleashed", rarity: "Common", collectorNumber: "1", type: "Unit", supertype: "" }],
    });

    expect(mockPrisma.riftboundCardCatalog.upsert).toHaveBeenCalled();
    expect(mockPrisma.pokemonCardCatalog.upsert).not.toHaveBeenCalled();
  });

  it("skips a card with no tcgPlayerId — nothing to key an upsert on", async () => {
    const result = await importCatalogDelta(mockPrisma, {
      game: "POKEMON",
      generatedAt: "2026-09-16T00:00:00Z",
      cards: [{ externalId: "a", tcgPlayerId: null, name: "A", imageUrl: null }],
    });
    expect(mockPrisma.pokemonCardCatalog.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, updated: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test catalogDeltaImport.test.ts`
Expected: FAIL — `@/lib/catalogDeltaImport` doesn't exist.

- [ ] **Step 3: Implement**

Create `src/lib/catalogDeltaImport.ts`:

```ts
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
```

Note: unlike Task 2's find-or-create (which leaves an existing row untouched), this importer's `update` is a real field update — a delta is expected to carry cards that changed (errata, corrected image), so re-importing should apply those changes, not silently ignore them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test catalogDeltaImport.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Write the CLI wrapper script**

Create `prisma/importCatalogDelta.ts`:

```ts
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
```

- [ ] **Step 6: Add a fixture for manual/future use**

Create `src/__tests__/fixtures/catalog-delta-pokemon.json`:

```json
{
  "game": "POKEMON",
  "generatedAt": "2026-09-16T00:00:00Z",
  "cards": [
    {
      "externalId": "swsh3-136",
      "tcgPlayerId": "192391",
      "name": "Charizard VMAX",
      "language": "English",
      "imageUrl": "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp",
      "setId": "swsh3",
      "setNameEn": "Darkness Ablaze",
      "rarity": "Secret Rare",
      "localId": "136"
    }
  ]
}
```

- [ ] **Step 7: Add the npm script**

In `package.json`'s `"scripts"`, add:
```json
    "import:catalog-delta": "tsx prisma/importCatalogDelta.ts",
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/catalogDeltaImport.ts src/__tests__/lib/catalogDeltaImport.test.ts src/__tests__/fixtures/catalog-delta-pokemon.json prisma/importCatalogDelta.ts package.json
git commit -m "Add importCatalogDelta script for card lookup sync"
```

---

### Task 4: Backfill — listing-prioritized, catalog-wide

**Files:**
- Modify: `src/app/api/cron/backfill-prices/route.ts`
- Test: `src/__tests__/api/cron/backfill-prices.test.ts`

**Interfaces:**
- Produces: same route contract (`GET`/`POST`, same response shape), only the eligibility query changes.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/api/cron/backfill-prices.test.ts`:

```ts
  it("fills pending cards with a listing before pending cards without one, within one limit", async () => {
    mockPrisma.pokemonCardCatalog.findMany
      .mockResolvedValueOnce([{ id: "listed-1", tcgPlayerId: "1", language: "English" }]) // listed pass
      .mockResolvedValueOnce([]); // unlisted pass — limit already spent
    mockFetchCardVariants.mockResolvedValue([]);

    await GET(makeRequest("test-cron-secret", "?limit=1"));

    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ where: expect.objectContaining({ listings: { some: {} } }), take: 1 })
    );
    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ where: expect.objectContaining({ listings: { none: {} } }), take: 1 })
    );
  });

  it("spends leftover limit on unlisted cards once listed ones are exhausted", async () => {
    mockPrisma.pokemonCardCatalog.findMany
      .mockResolvedValueOnce([{ id: "listed-1", tcgPlayerId: "1", language: "English" }]) // 1 listed found
      .mockResolvedValueOnce([{ id: "unlisted-1", tcgPlayerId: "2", language: "English" }]); // fills the rest
    mockFetchCardVariants.mockResolvedValue([]);

    const res = await GET(makeRequest("test-cron-secret", "?limit=2"));
    const data = await res.json();

    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ take: 1 }) // 2 - 1 already taken by the listed pass
    );
    expect(data.backfilled).toBe(2);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test backfill-prices.test.ts`
Expected: FAIL — the route currently does one query with a hard `listings: { some: {} }` filter, not two ordered passes.

- [ ] **Step 3: Implement the two-pass query**

In `src/app/api/cron/backfill-prices/route.ts`, replace the `pendingWhere`/query section with:

```ts
  const capturedAt = new Date(new Date().toISOString().slice(0, 10));
  const basePending = { tcgPlayerId: { not: null }, priceBackfilledAt: null };

  async function takeCards<T extends "pokemonCardCatalog" | "riftboundCardCatalog">(
    model: T,
    remaining: number
  ) {
    if (remaining <= 0) return [];
    // Listed cards first — a card someone's actually trying to sell matters
    // more than one nobody's listed yet, when JustTCG's daily budget is
    // the limiting factor. No new state: same priceBackfilledAt queue,
    // just drained in two ordered passes instead of one ungated query.
    const listed = await (prisma[model] as any).findMany({
      where: { ...basePending, listings: { some: {} } },
      select: model === "pokemonCardCatalog" ? { id: true, tcgPlayerId: true, language: true } : { id: true, tcgPlayerId: true },
      take: remaining,
      orderBy: { id: "asc" },
    });
    if (listed.length >= remaining) return listed;

    const unlisted = await (prisma[model] as any).findMany({
      where: { ...basePending, listings: { none: {} } },
      select: model === "pokemonCardCatalog" ? { id: true, tcgPlayerId: true, language: true } : { id: true, tcgPlayerId: true },
      take: remaining - listed.length,
      orderBy: { id: "asc" },
    });
    return [...listed, ...unlisted];
  }

  const pokemonCards = await takeCards("pokemonCardCatalog", limit);
  const riftboundCards = await takeCards("riftboundCardCatalog", limit - pokemonCards.length);
```

Change the default `limit` (in the `searchParams` parsing above) from `900` to `500`, per the spec's budget note, and update its comment to explain why:

```ts
  // Default 500, not the route's own 950 cap on its own — the daily refresh
  // job (now covering the full catalog too) needs headroom in the same
  // shared JustTCG daily budget. See the design doc's Budget note.
  const requestedLimit = Number(searchParams.get("limit") ?? "500");
```

Remove the old `pendingWhere` and the two separate `findMany` calls it fed; the rest of the route (the per-card backfill loop, marking `priceBackfilledAt`, the `remaining` count at the end) is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test backfill-prices.test.ts`
Expected: PASS, including the existing tests (the `remaining` count query and the `limit=5000` cap test still apply unchanged).

- [ ] **Step 5: Run full suite and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/backfill-prices/route.ts src/__tests__/api/cron/backfill-prices.test.ts
git commit -m "Prioritize listed cards in backfill-prices, decouple from listing existence"
```

---

### Task 5: Refresh — widen to the full catalog

**Files:**
- Modify: `src/app/api/cron/refresh-prices/route.ts`
- Test: `src/__tests__/api/cron/refresh-prices.test.ts`

**Interfaces:**
- Produces: same route contract — only the raw-price eligibility query changes (the graded-listing lookup, which reads real `Listing.condition` values, is unaffected).

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/api/cron/refresh-prices.test.ts`:

```ts
  it("queries every catalog card with a tcgPlayerId, not just ones with a listing", async () => {
    await GET(makeRequest("test-cron-secret"));
    expect(mockPrisma.pokemonCardCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tcgPlayerId: { not: null } } })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test refresh-prices.test.ts`
Expected: FAIL — the current query's `where` also includes `listings: { some: {} }`.

- [ ] **Step 3: Implement**

In `src/app/api/cron/refresh-prices/route.ts`, change both catalog `findMany` calls' `where` clauses from:
```ts
      where: { tcgPlayerId: { not: null }, listings: { some: {} } },
```
to:
```ts
      where: { tcgPlayerId: { not: null } },
```
(one occurrence for `pokemonCardCatalog`, one for `riftboundCardCatalog`). The separate graded-listing detection query (`prisma.listing.findMany` for cards with a graded condition) is untouched — that's about which *variant labels* to fetch for a card already in scope, not about whether the card is in scope at all.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test refresh-prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/refresh-prices/route.ts src/__tests__/api/cron/refresh-prices.test.ts
git commit -m "Widen refresh-prices to the full catalog, not just listed cards"
```

---

## Self-Review Notes

- **Spec coverage:** duplicate cleanup + unique constraint (Tasks 1-2), import script (Task 3), priority-aware backfill with the 500-default budget adjustment (Task 4), widened refresh (Task 5) — every item in the spec's Design section has a task.
- **Type consistency:** `CatalogDelta`/`CatalogDeltaCard` in Task 3 match the Global Constraints shape exactly, and are the same names the companion sync-project plan's output must satisfy.
- **Ordering dependency:** Task 1 must run before Task 2's `db push` — called out explicitly in Task 2's Step 2.
- **No placeholders:** every step has complete, real code.
