// src/types/market.ts

export type PriceHistoryPoint = {
  date: string; // ISO date string from API
  market: number; // market price (USD)
  volume: number; // items sold
};

export type MarketData = {
  conditionLabel: string; // e.g. "PSA 10" or "Near Mint"
  history: PriceHistoryPoint[];
  marketPrice: number | null;
};
