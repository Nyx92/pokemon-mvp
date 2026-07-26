import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/cards
 *
 * Lets an admin create a card and assign it to ANY user (an admin tool for
 * listing cards on behalf of sellers — the `ownerId` field is deliberately
 * client-supplied so an admin can pick any user from a dropdown). Because
 * ownerId is trusted input, this route must be restricted to admins only.
 *
 * Tests cover:
 *   - 401 unauthenticated
 *   - 403 authenticated but not an admin
 *   - 201 admin can still create a card (happy path, proves the auth gate
 *     doesn't break the legitimate flow)
 */

// ── STEP 1: Create the mock objects ──────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  card: { create: vi.fn() },
}));

const mockSupabaseInstance = vi.hoisted(() => ({
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "cards/1-test.png" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/cards/1-test.png" } }),
    })),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register the fakes ────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseInstance),
}));

// ── STEP 3: Import the code under test ───────────────────────────────────────

import { POST } from "@/app/api/cards/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("title", "Charizard");
  fd.set("condition", "NM");
  fd.set("ownerId", "target-user-1");
  fd.set("tcgPlayerId", "tcg-1");
  fd.set("language", "English");
  fd.set("forSale", "true");
  fd.set("price", "50.00");
  fd.append("images", new File(["fake"], "card.png", { type: "image/png" }));
  Object.entries(overrides).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

function postRequest(formData: FormData) {
  return new NextRequest("http://localhost/api/cards", {
    method: "POST",
    body: formData,
  });
}

const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };
const USER_SESSION = { user: { id: "user-1", role: "user" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cards", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(401);
    expect(mockPrisma.card.create).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not an admin", async () => {
    mockGetServerSession.mockResolvedValue(USER_SESSION);
    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(403);
    expect(mockPrisma.card.create).not.toHaveBeenCalled();
  });

  it("lets an admin create a card owned by a different user", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.card.create.mockResolvedValue({
      id: "card-1",
      title: "Charizard",
      ownerId: "target-user-1",
    });

    const res = await POST(postRequest(buildFormData()));
    expect(res.status).toBe(200);

    // The admin's own id must NOT silently override the chosen ownerId —
    // this route intentionally lets an admin assign the card to anyone.
    expect(mockPrisma.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          owner: { connect: { id: "target-user-1" } },
        }),
      })
    );
  });
});
