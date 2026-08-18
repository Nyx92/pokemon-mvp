import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/expire-offers is called by Vercel's cron scheduler every
 * 5 minutes. It:
 *   1. Verifies the bearer token matches CRON_SECRET (set in Vercel env vars)
 *   2. Queries for offers with status:"pending" and expiresAt in the past
 *   3. Calls expireOffer() for each one (cancel PI + mark DB expired)
 *   4. Returns a summary: { expired, failed, errors }
 *
 * expireOffer is mocked here (its internals are covered in offerExpiry.test.ts) —
 * this file only verifies the cron queries the right offers and calls
 * expireOffer correctly for each one.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  offer: { findMany: vi.fn() },
}));

const mockExpireOffer = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/offerExpiry", () => ({ expireOffer: mockExpireOffer }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET, POST } from "@/app/api/cron/expire-offers/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

function makeRequest(authToken?: string) {
  return new NextRequest("http://localhost/api/cron/expire-offers", {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
  });
}

// Each expired offer's card reference is now `listingId` (renamed from `cardId`).
const EXPIRED_OFFER_1 = { id: "offer-1", paymentIntentId: "pi_1", buyerId: "buyer-1", listingId: "card-1" };
const EXPIRED_OFFER_2 = { id: "offer-2", paymentIntentId: "pi_2", buyerId: "buyer-2", listingId: "card-2" };

describe("GET /api/cron/expire-offers (Vercel Cron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpireOffer.mockResolvedValue(undefined);
  });

  it("returns 401 when bearer token is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns expired:0 and a message when no offers have passed their deadline", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(0);
    expect(data.message).toBe("Nothing to expire");
    expect(mockExpireOffer).not.toHaveBeenCalled();
  });

  it("calls expireOffer for each expired offer and returns the count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(2);
    expect(data.failed).toBe(0);

    expect(mockExpireOffer).toHaveBeenCalledTimes(2);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_1);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_2);
  });

  it("queries only pending offers with expiresAt in the past, selecting the renamed listingId field", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);
    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "pending",
          expiresAt: { lt: expect.any(Date) },
        },
        select: {
          id: true,
          paymentIntentId: true,
          buyerId: true,
          listingId: true,
        },
      })
    );
  });

  it("continues processing remaining offers when one fails, reports failed count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    mockExpireOffer
      .mockRejectedValueOnce(new Error("Stripe timeout"))
      .mockResolvedValueOnce(undefined);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain("offer-1");
    expect(data.errors[0]).toContain("Stripe timeout");
  });

  it("also works via POST (for local curl testing)", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/cron/expire-offers", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
