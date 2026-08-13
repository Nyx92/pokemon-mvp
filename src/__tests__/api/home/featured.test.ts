import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/home/featured
 *
 * Public, unauthenticated homepage data source (best sellers, highest
 * transacted, newly listed, auctions ending soon). Because it has no auth
 * check at all, it must never include a card owner's email — anyone can
 * curl this endpoint. Commit 6410447 fixed the equivalent leak on
 * /api/cards and /api/cards/[id]; this route was missed.
 */

const mockPrisma = vi.hoisted(() => ({
  bestSeller: { findMany: vi.fn() },
  card: { findFirst: vi.fn(), findMany: vi.fn() },
  auction: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/home/featured/route";

function makeCard(overrides: Partial<any> = {}) {
  return {
    id: "card-1",
    title: "Charizard",
    price: 1000,
    forSale: true,
    tcgPlayerId: "tcg-1",
    binder: null,
    owner: { id: "owner-1", username: "Ash" },
    ...overrides,
  };
}

describe("GET /api/home/featured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bestSeller.findMany.mockResolvedValue([{ tcgPlayerId: "tcg-1" }]);
    mockPrisma.card.findFirst.mockResolvedValue(makeCard());
    mockPrisma.$queryRaw.mockResolvedValue([{ tcgPlayerId: "tcg-1", count: BigInt(3) }]);
    mockPrisma.card.findMany.mockResolvedValue([makeCard()]);
    mockPrisma.auction.findMany.mockResolvedValue([]);
  });

  it("never includes the card owner's email in bestSellers, highestTransacted, or newlyListed", async () => {
    const res = await GET();
    const body = await res.json();

    for (const list of [body.bestSellers, body.highestTransacted, body.newlyListed]) {
      for (const card of list) {
        expect(card.owner).toEqual({ id: "owner-1", username: "Ash" });
        expect(card.owner.email).toBeUndefined();
      }
    }

    // The response-body assertions above can't actually prove the fix: the
    // mocks return an email-free owner regardless of what select the route
    // passes to Prisma, so reverting `cardInclude.owner`'s select back to
    // including `email: true` would still pass them. Assert on the actual
    // call arguments for every call site that shares `cardInclude` — the
    // findFirst calls driving bestSellers/highestTransacted, and the
    // findMany call driving newlyListed — so this test fails if that
    // select is ever widened again.
    expect(mockPrisma.card.findFirst.mock.calls.length).toBeGreaterThan(0);
    for (const [args] of mockPrisma.card.findFirst.mock.calls) {
      expect(args.include.owner).toEqual({ select: { id: true, username: true } });
    }

    const findManyArgs = mockPrisma.card.findMany.mock.calls[0][0];
    expect(findManyArgs.include.owner).toEqual({ select: { id: true, username: true } });
  });

  // What's being tested: the four independent query groups (bestSellers,
  // highestTransacted, newlyListed, auctionsEndingSoon) must be issued
  // concurrently, not one after another — none of them depends on another's
  // result. This test proves concurrency by using manually-controlled
  // ("deferred") promises: if the route awaited them sequentially, only the
  // first mock would be invoked before this assertion runs; if it uses
  // Promise.all (or an equivalent), all four are invoked before any resolve.

  it("issues all four independent query groups concurrently", async () => {
    const started: string[] = [];
    const finishers: Record<string, (v: any) => void> = {};

    function deferred(name: string, value: any) {
      started.push(name);
      return new Promise((resolve) => {
        finishers[name] = () => resolve(value);
      });
    }

    mockPrisma.bestSeller.findMany.mockImplementation(() => deferred("bestSeller", []));
    mockPrisma.$queryRaw.mockImplementation(() => deferred("queryRaw", []));
    mockPrisma.card.findMany.mockImplementation(() => deferred("newlyListed", []));
    mockPrisma.auction.findMany.mockImplementation(() => deferred("endingSoon", []));

    const resPromise = GET();
    await Promise.resolve(); // let the handler run up to its first await boundary
    await Promise.resolve(); // and its microtask continuations

    expect(started.sort()).toEqual(["bestSeller", "endingSoon", "newlyListed", "queryRaw"]);

    Object.values(finishers).forEach((finish) => finish(undefined));
    await resPromise;
  });
});
