// src/types/market.ts

export type PriceHistoryPoint = {
  date: string; // ISO date string (YYYY-MM-DD)
  price: number; // SGD
};

export type MarketData = {
  variantLabel: string; // e.g. "PSA 10" or "RAW"
  currentPrice: number | null; // SGD, the latest snapshot for this variant
  lastUpdated: string | null; // ISO date (YYYY-MM-DD) of the latest snapshot
  history: PriceHistoryPoint[];
  // The raw (ungraded) price, shown alongside a graded variant as a
  // baseline for comparison. Null when the primary variant is already RAW,
  // or when no raw price is on record for this card.
  rawPrice: number | null;
};
