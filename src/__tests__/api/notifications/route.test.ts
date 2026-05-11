import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests for the notifications REST API:
 *
 *   GET  /api/notifications          — list all for current user
 *   PATCH /api/notifications          — bulk mark all as read
 *   PATCH /api/notifications/[id]    — mark one as read
 *   DELETE /api/notifications/[id]   — dismiss one
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  notification: {
    findMany:    vi.fn(),
    updateMany:  vi.fn(),
    deleteMany:  vi.fn(),
  },
}));

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { GET, PATCH } from "@/app/api/notifications/route";
import {
  PATCH as PatchById,
  DELETE as DeleteById,
} from "@/app/api/notifications/[id]/route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION = { user: { id: "user-1" } };

const NOTIFICATION = {
  id:        "notif-1",
  userId:    "user-1",
  type:      "offer_received",
  title:     "New offer on your card",
  body:      "Someone made an offer of S$10 on your card.",
  offerId:   "offer-1",
  cardId:    "card-1",
  orderId:   null,
  read:      false,
  createdAt: new Date().toISOString(),
};

function makeRequest(method = "GET") {
  return new NextRequest("http://localhost/api/notifications", { method });
}

function makeRequestById(id: string, method: string) {
  return new NextRequest(`http://localhost/api/notifications/${id}`, { method });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.notification.findMany.mockResolvedValue([NOTIFICATION]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns notifications for the current user", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].id).toBe("notif-1");
    // Prisma was called with the correct userId filter
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.notification.findMany.mockRejectedValueOnce(new Error("DB down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/notifications (bulk mark all read)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest("PATCH"));
    expect(res.status).toBe(401);
  });

  it("marks all unread notifications as read and returns count", async () => {
    const res = await PATCH(makeRequest("PATCH"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", read: false },
        data:  { read: true },
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/notifications/[id] (mark one read)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await PatchById(makeRequestById("notif-1", "PATCH"), {
      params: { id: "notif-1" },
    });
    expect(res.status).toBe(401);
  });

  it("marks the notification as read", async () => {
    const res = await PatchById(makeRequestById("notif-1", "PATCH"), {
      params: { id: "notif-1" },
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1", userId: "user-1" },
        data:  { read: true },
      })
    );
  });

  it("returns 404 when notification does not belong to this user", async () => {
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await PatchById(makeRequestById("notif-other", "PATCH"), {
      params: { id: "notif-other" },
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/notifications/[id] (dismiss)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await DeleteById(makeRequestById("notif-1", "DELETE"), {
      params: { id: "notif-1" },
    });
    expect(res.status).toBe(401);
  });

  it("deletes the notification", async () => {
    const res = await DeleteById(makeRequestById("notif-1", "DELETE"), {
      params: { id: "notif-1" },
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "notif-1", userId: "user-1" } })
    );
  });

  it("returns 404 when notification does not belong to this user", async () => {
    mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 0 });
    const res = await DeleteById(makeRequestById("notif-other", "DELETE"), {
      params: { id: "notif-other" },
    });
    expect(res.status).toBe(404);
  });
});
