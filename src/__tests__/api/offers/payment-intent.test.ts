import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/offers/payment-intent
 *
 * The buyer's frontend calls this BEFORE submitting an offer. Creates a
 * Stripe PaymentIntent with capture_method: "manual" — Stripe authorises
 * (holds) the funds on the buyer's card but does NOT charge them yet.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  listing: { findUnique: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("stripe", () => ({ default: vi.fn(() => mockStripeInstance) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/offers/payment-intent/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/offers/payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LISTING = {
  id: "card-1",
  forSale: true,
  ownerId: "seller-1",
  pokemonCard: {
    nameEn: "Charizard", rarity: "Rare Holo", setNameEn: "Base Set",
    language: "English", localId: "4/102", tcgPlayerId: "tcg-1",
  },
  riftboundCard: null,
};

describe("POST /api/offers/payment-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "buyer-1" } });
    mockPrisma.listing.findUnique.mockResolvedValue(LISTING);
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: "pi_123",
      client_secret: "pi_123_secret_abc",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when cardId is missing", async () => {
    const res = await POST(makeRequest({ price: 5000 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("cardId") });
  });

  it("returns 400 when price is zero", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when price is negative", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when card does not exist", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ cardId: "card-x", price: 5000 }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when card is not for sale", async () => {
    mockPrisma.listing.findUnique.mockResolvedValue({ ...LISTING, forSale: false });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "Card is not for sale" });
  });

  it("returns 403 when buyer tries to offer on their own card", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1" } });
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    expect(res.status).toBe(403);
  });

  it("creates a manual-capture PaymentIntent with the resolved card title and returns clientSecret + paymentIntentId", async () => {
    const res = await POST(makeRequest({ cardId: "card-1", price: 5000 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.clientSecret).toBe("pi_123_secret_abc");
    expect(data.paymentIntentId).toBe("pi_123");

    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: "sgd",
        capture_method: "manual",
        metadata: expect.objectContaining({
          buyerId: "buyer-1",
          cardId: "card-1",
          cardTitle: "Charizard",
        }),
      })
    );
  });
});
