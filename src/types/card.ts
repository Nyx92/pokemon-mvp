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

  setName: string | null;
  rarity: string | null;
  description: string | null;
  language: string;
  cardNumber: string | null;

  // Optional purely-frontend or future fields
  likesCount?: number;

  createdAt: string;
  updatedAt: string;

  owner?: {
    id: string;
    username: string | null;
    email: string;
  };

  binder?: { id: string; name: string };
}
