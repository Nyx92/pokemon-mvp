import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  card: { findUnique: vi.fn() },
}));
const mockNotifyAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/notifications", () => ({ notifyAsync: mockNotifyAsync, createNotification: vi.fn() }));

import { transferCardOwnership, notifySellerCardSold } from "@/lib/webhookHelpers";

describe("transferCardOwnership", () => {
  it("runs the concurrency-guarded updateMany with the expected where/data shape", async () => {
    const tx = { card: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const count = await transferCardOwnership(tx as any, {
      cardId: "card-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(1);
    expect(tx.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: "card-1",
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
    const tx = { card: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    const count = await transferCardOwnership(tx as any, {
      cardId: "card-1",
      checkoutSessionId: "cs_123",
      buyerId: "buyer-1",
    });

    expect(count).toBe(0);
  });
});

describe("notifySellerCardSold", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up the card title and fires a card_sold notification", async () => {
    mockPrisma.card.findUnique.mockResolvedValue({ title: "Charizard" });

    notifySellerCardSold({ sellerId: "seller-1", cardId: "card-1", orderId: "order-1" });
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget chain resolve

    expect(mockNotifyAsync).toHaveBeenCalledWith({
      userId: "seller-1",
      type: "card_sold",
      title: "Your card was sold",
      body: 'Your card "Charizard" was purchased via Buy Now.',
      cardId: "card-1",
      orderId: "order-1",
    });
  });

  it("never throws even if the card lookup fails", async () => {
    mockPrisma.card.findUnique.mockRejectedValue(new Error("db down"));
    expect(() =>
      notifySellerCardSold({ sellerId: "seller-1", cardId: "card-1", orderId: "order-1" })
    ).not.toThrow();
  });
});
