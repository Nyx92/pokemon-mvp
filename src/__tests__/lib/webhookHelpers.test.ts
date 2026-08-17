import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
}));
const mockNotifyAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync, createNotification: vi.fn() }));

import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";

describe("transferCardOwnership", () => {
  it("runs the concurrency-guarded updateMany with the expected where/data shape", async () => {
    const tx = { listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const count = await transferCardOwnership(tx as any, {
      listingId: "listing-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(1);
    expect(tx.listing.updateMany).toHaveBeenCalledWith({
      where: {
        id: "listing-1",
        reservedCheckoutSessionId: "cs_123",
        reservedById: "buyer-1",
        forSale: true,
      },
      data: {
        ownerId: "buyer-1",
        forSale: false,
        price: null,
        reservedById: null,
        reservedUntil: null,
        reservedCheckoutSessionId: null,
        binderId: null,
      },
    });
  });

  it("returns 0 when the card was already transferred/released by another process", async () => {
    const tx = { listing: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    const count = await transferCardOwnership(tx as any, {
      listingId: "listing-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(0);
  });
});

describe("notifySellerCardSold", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the listing's title via the catalog relation and fires a card_sold notification", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({
      id: "listing-1",
      pokemonCard: {
        nameEn: "Charizard",
        rarity: "Rare Holo",
        setNameEn: "Base Set",
        language: "English",
        localId: "004",
        tcgPlayerId: "tcg-1",
      },
      riftboundCard: null,
    });

    notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget chain resolve

    expect(mockPrisma.listing.findUnique).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      include: { pokemonCard: true, riftboundCard: true },
    });
    expect(mockNotifyAsync).toHaveBeenCalledWith({
      userId: "seller-1",
      type: "card_sold",
      title: "Your card was sold",
      body: 'Your card "Charizard" was purchased via Buy Now.',
      cardId: "listing-1",
      orderId: "order-1",
    });
  });

  it("falls back to 'a card' when the listing can no longer be found", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);

    notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyAsync).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Your card "a card" was purchased via Buy Now.' })
    );
  });

  it("never throws even if the listing lookup fails", async () => {
    mockPrisma.listing.findUnique.mockRejectedValue(new Error("db down"));

    expect(() =>
      notifySellerCardSold({ sellerId: "seller-1", listingId: "listing-1", orderId: "order-1" })
    ).not.toThrow();
  });
});
