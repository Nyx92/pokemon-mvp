// src/lib/seedListingFakers.ts
//
// Small, deterministic-given-Math.random() helpers for fabricating
// plausible-looking (not real-market) Listing fields when bulk-seeding
// mock marketplace data — price/condition/owner aren't present anywhere in
// a real card catalog index.

export function cycleOwnerId(index: number, ownerIds: string[]): string {
  if (ownerIds.length === 0) {
    throw new Error("cycleOwnerId requires at least one ownerId");
  }
  return ownerIds[index % ownerIds.length];
}

export function randomDollarsInRange(minDollars: number, maxDollars: number): number {
  const value = minDollars + Math.random() * (maxDollars - minDollars);
  return Math.round(value * 100) / 100;
}

export function randomFrom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("randomFrom requires a non-empty array");
  }
  return items[Math.floor(Math.random() * items.length)];
}
