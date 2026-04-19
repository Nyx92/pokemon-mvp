import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * HOW THIS FILE EXECUTES (what Vitest does before a single test runs)
 *
 * 1. vi.hoisted() blocks run first — creates two mock objects in memory:
 *      mockPrisma       — fake Prisma client (offer.findMany)
 *      mockExpireOffer  — fake expireOffer function
 *
 * 2. vi.mock() factories run second — registers the fakes. No Stripe or
 *    next-auth mock here because:
 *      - The cron endpoint uses CRON_SECRET auth (bearer token), not sessions
 *      - expireOffer is mocked directly — we don't test its internals here
 *        (those are already covered in offerExpiry.test.ts)
 *
 * 3. import { GET, POST } runs last — the real cron route is loaded.
 *
 * What this endpoint does:
 *   GET /api/cron/expire-offers is called by Vercel's cron scheduler every
 *   5 minutes. It:
 *     1. Verifies the bearer token matches CRON_SECRET (set in Vercel env vars)
 *     2. Queries for offers with status:"pending" and expiresAt in the past
 *     3. Calls expireOffer() for each one (cancel PI + mark DB expired)
 *     4. Returns a summary: { expired, failed, errors }
 *
 *   The cron must be resilient: if one offer fails (e.g. Stripe timeout),
 *   it logs the error and continues processing the remaining offers.
 *
 *   POST is kept as an alias for local testing via curl.
 *
 * Why expireOffer is mocked (not the real one):
 *   expireOffer's internals (Stripe cancel + DB update) are already tested in
 *   offerExpiry.test.ts. Here we only care that the cron calls it correctly —
 *   with the right offer data and the right number of times. Mocking it keeps
 *   the two concerns separate and makes test failures easier to diagnose.
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  offer: { findMany: vi.fn() },
}));

// mockExpireOffer replaces the real expireOffer. In most tests it simply
// resolves — the cron treats a resolved call as a successful expiry.
const mockExpireOffer = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/offerExpiry", () => ({ expireOffer: mockExpireOffer }));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { GET, POST } from "@/app/api/cron/expire-offers/route";

// ── Test helpers + shared data ────────────────────────────────────────────────

// Builds a request with an optional bearer token.
// Vercel sends CRON_SECRET automatically — tests that use the correct token
// pass "test-cron-secret" (set in vitest.config.ts env block).
function makeRequest(authToken?: string) {
  return new NextRequest("http://localhost/api/cron/expire-offers", {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
  });
}

// Two fake expired offers. Each has the minimum fields expireOffer needs:
// id (for logging), paymentIntentId (for Stripe cancel), and the identifiers.
const EXPIRED_OFFER_1 = { id: "offer-1", paymentIntentId: "pi_1", buyerId: "buyer-1", cardId: "card-1" };
const EXPIRED_OFFER_2 = { id: "offer-2", paymentIntentId: "pi_2", buyerId: "buyer-2", cardId: "card-2" };

describe("GET /api/cron/expire-offers (Vercel Cron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: expireOffer succeeds for all offers
    mockExpireOffer.mockResolvedValue(undefined);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  // What's being tested: the bearer token guard — wrong token is rejected.
  //
  // Vercel sends CRON_SECRET as the bearer token when it invokes the cron.
  // Any other caller (e.g. an attacker trying to mass-expire offers) is
  // rejected with 401. This prevents abuse of the expiry endpoint.
  //
  // "test-cron-secret" is set as CRON_SECRET in vitest.config.ts env block.
  // Here we send "wrong-secret" — the route should reject it.

  it("returns 401 when bearer token is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  // What's being tested: the auth guard when the Authorization header is absent.
  //
  // If there's no header at all, the route must still return 401.
  // makeRequest() with no argument produces a request with no auth header.

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest()); // no token provided
    expect(res.status).toBe(401);
  });

  // ── Nothing to expire ─────────────────────────────────────────────────────

  // What's being tested: the early-exit path when no offers are past their deadline.
  //
  // Most cron runs will find nothing to expire (offers are live for 24h, cron
  // runs every 5 min). The route should:
  //   - Return 200 (not an error — nothing expired is expected and normal)
  //   - Return expired:0 and "Nothing to expire"
  //   - Not call expireOffer at all (no work to do)

  it("returns expired:0 and a message when no offers have passed their deadline", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]); // no expired offers

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(0);
    expect(data.message).toBe("Nothing to expire");
    // expireOffer must not be called — there's nothing to process
    expect(mockExpireOffer).not.toHaveBeenCalled();
  });

  // ── Happy path — multiple expired offers ─────────────────────────────────

  // What's being tested: the main job — expires all offers past their deadline.
  //
  // With two expired offers, the cron must call expireOffer once per offer and
  // return expired:2 failed:0 in the summary. This confirms:
  //   a) The loop iterates over all returned offers (not just the first)
  //   b) Each offer is passed to expireOffer with its full data
  //   c) The count in the response matches the number successfully processed

  it("calls expireOffer for each expired offer and returns the count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.expired).toBe(2);
    expect(data.failed).toBe(0);

    // expireOffer called exactly twice — once per offer
    expect(mockExpireOffer).toHaveBeenCalledTimes(2);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_1);
    expect(mockExpireOffer).toHaveBeenCalledWith(EXPIRED_OFFER_2);
  });

  // What's being tested: the DB query shape — only the right offers are fetched.
  //
  // The cron must NOT expire active offers. The query must filter for:
  //   status: "pending"      — only offers that are still open (not already expired/rejected/paid)
  //   expiresAt: { lt: now } — only offers whose 24h window has passed
  //
  // This test verifies the exact Prisma query shape. A wrong query (e.g. no
  // status filter) could accidentally expire active offers that are still valid.

  it("queries only pending offers with expiresAt in the past", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([]);
    await GET(makeRequest("test-cron-secret"));

    expect(mockPrisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "pending",
          expiresAt: { lt: expect.any(Date) }, // "less than now"
        },
      })
    );
  });

  // ── Partial failure — one offer fails, rest continue ─────────────────────

  // What's being tested: the cron's resilience when one expiry fails.
  //
  // If expireOffer throws for one offer (e.g. Stripe times out for that PI),
  // the cron must NOT abort — it catches the error, logs it, and continues
  // to the next offer. The failed offer stays "pending" so the next cron run
  // can try again.
  //
  // The response reflects what happened: expired:1 (one succeeded), failed:1
  // (one failed), and errors contains a message identifying which offer failed.
  //
  // mockRejectedValueOnce + mockResolvedValueOnce: the first call throws,
  // the second call succeeds. Vitest applies them in call order.

  it("continues processing remaining offers when one fails, reports failed count", async () => {
    mockPrisma.offer.findMany.mockResolvedValue([EXPIRED_OFFER_1, EXPIRED_OFFER_2]);

    // First offer's expiry fails (Stripe timeout), second succeeds
    mockExpireOffer
      .mockRejectedValueOnce(new Error("Stripe timeout"))
      .mockResolvedValueOnce(undefined);

    const res = await GET(makeRequest("test-cron-secret"));
    const data = await res.json();

    expect(res.status).toBe(200); // overall 200 — partial success is not a server error
    expect(data.expired).toBe(1); // one succeeded
    expect(data.failed).toBe(1);  // one failed
    expect(data.errors).toHaveLength(1);
    // Error message identifies the offer and includes the error text
    expect(data.errors[0]).toContain("offer-1");
    expect(data.errors[0]).toContain("Stripe timeout");
  });

  // ── POST kept for local curl testing ─────────────────────────────────────

  // What's being tested: the POST alias for local testing.
  //
  // Vercel Cron only supports GET, but running "GET with a body" via curl is
  // awkward. The route exports both GET and POST (both call the same handler)
  // so you can trigger it locally with: curl -X POST ... -H "Authorization: Bearer ..."
  //
  // This test just verifies POST is wired up and responds the same as GET.

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
