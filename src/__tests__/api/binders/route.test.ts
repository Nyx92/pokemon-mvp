import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/binders.
 *
 * GET  → list the current user's binders (auth required)
 * POST → create a new binder for the current user (auth required,
 *        case-insensitive duplicate-name rejection)
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  binder: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET, POST } from "@/app/api/binders/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postRequest(body: unknown) {
  return new Request("http://localhost/api/binders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/binders", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockPrisma.binder.findMany).not.toHaveBeenCalled();
  });

  it("lists the current user's binders", async () => {
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.binder.findMany.mockResolvedValue([
      { id: "binder-1", name: "Vintage" },
      { id: "binder-2", name: "Modern" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    expect(mockPrisma.binder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );

    const body = await res.json();
    expect(body.binders).toEqual([
      { id: "binder-1", name: "Vintage" },
      { id: "binder-2", name: "Modern" },
    ]);
  });
});

describe("POST /api/binders", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST(postRequest({ name: "Vintage" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.binder.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing or blank", async () => {
    const res = await POST(postRequest({ name: "   " }));
    expect(res.status).toBe(400);
    expect(mockPrisma.binder.create).not.toHaveBeenCalled();
  });

  it("creates a new binder for the current user", async () => {
    mockPrisma.binder.findFirst.mockResolvedValue(null);
    mockPrisma.binder.create.mockResolvedValue({ id: "binder-1", name: "Vintage" });

    const res = await POST(postRequest({ name: "Vintage" }));
    expect(res.status).toBe(201);

    expect(mockPrisma.binder.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", name: { equals: "Vintage", mode: "insensitive" } },
    });
    expect(mockPrisma.binder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Vintage", userId: "user-1" } })
    );

    const body = await res.json();
    expect(body.binder).toEqual({ id: "binder-1", name: "Vintage" });
  });

  it("rejects a duplicate binder name case-insensitively", async () => {
    mockPrisma.binder.findFirst.mockResolvedValue({ id: "existing-1", name: "vintage" });

    const res = await POST(postRequest({ name: "VINTAGE" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
    expect(mockPrisma.binder.create).not.toHaveBeenCalled();
  });
});
