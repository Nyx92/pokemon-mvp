// src/types/auction.ts

export interface AuctionCard {
  id: string;
  title: string;
  imageUrls: string[];
  condition: string;
  setName: string | null;
  language: string;
  cardNumber: string | null;
  rarity: string | null;
  tcgPlayerId: string;
  inAuction: boolean;
  owner: { id: string; username: string | null };
}

export interface AuctionItem {
  id:         string;
  cardId:     string;
  sellerId:   string;

  // All monetary values in dollars (converted from cents at the API layer)
  startingBid:  number;
  reservePrice: number | null;
  buyOutPrice:  number | null;
  currentBid:   number | null;

  highestBidderId: string | null;

  // active | pending_seller_decision | sold | expired
  status: string;

  endsAt:                 string; // ISO string
  sellerDecisionDeadline: string | null;

  version:  number;
  bidCount: number;

  card: AuctionCard;
}
