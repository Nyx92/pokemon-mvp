// src/types/card.ts
export interface CardItem {
  id: string;
  title: string;
  price: number | null;
  condition: string;
  status: string;
  forSale: boolean;
  imageUrls: string[];

  // Optional metadata
  setName?: string | null;
  rarity?: string | null;
  type?: string | null;
  officialId?: string | null;
  description?: string | null;

  // Owner info (from /api/cards include)
  owner?: {
    id: string;
    username: string | null;
    email: string;
  };

  binder?: { id: string; name: string };

  // Future: likes, etc.
  likesCount?: number;
}
