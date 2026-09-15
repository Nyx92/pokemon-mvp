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
