// src/types/card.ts
export interface CardItem {
  id: string;
  title: string;
  price: number | null;
  condition: string;
  status: "available" | "sold" | "reserved" | string;
  forSale: boolean;
  imageUrls: string[];
  tcgPlayerId: string;
  game: "POKEMON" | "RIFTBOUND";

  setName: string | null;
  rarity: string | null;
  description: string | null;
  language: string;
  cardNumber: string | null;
  // Riftbound-only — absent for a POKEMON card.
  type?: string;
  supertype?: string;

  // True while the card has an active (or cron-pending) auction.
  // Set by POST /api/auctions; cleared when the auction is settled or expired.
  inAuction?: boolean;

  // Optional fields populated by specific API endpoints
  watchlistCount?: number;
  watchlistedByUser?: boolean;

  createdAt: string;
  updatedAt: string;

  owner?: {
    id: string;
    username: string | null;
    // Optional, not required: the marketplace/listings query path
    // (getListingsPage in src/lib/listingsQuery.ts) deliberately selects
    // only id/username for a public listing's owner — an anonymous
    // visitor shouldn't see another user's email. Nothing today reads
    // owner.email; keep it optional rather than widening that select
    // just to satisfy this type.
    email?: string;
  };

  binder?: { id: string; name: string };
}

// Lightweight per-card fields for the marketplace's client-side search
// index and filter-facet computation — deliberately excludes
// price/images/description to keep this endpoint's payload small.
export interface CardBrowseIndexItem {
  id: string;
  title: string;
  setName: string | null;
  rarity: string | null;
  type: string | null;
  language: string;
  condition: string;
  game: "POKEMON" | "RIFTBOUND";
}
