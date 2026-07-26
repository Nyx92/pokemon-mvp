import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/users
 *
 * Returns every user's id/username/email. The only legitimate consumer is
 * the admin "assign owner" dropdown in /upload (UploadCard.tsx), so this
 * route must be restricted to admins — otherwise it leaks every user's
 * email to anyone who can reach it.
 *
 * Tests cover:
 *   - 401 unauthenticated
 *   - 403 authenticated but not an admin
 *   - 200 admin gets the full user list
 */

const mockPrisma = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "@/app/api/users/route";

const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } };
const USER_SESSION = { user: { id: "user-1", role: "user" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not an admin", async () => {
    mockGetServerSession.mockResolvedValue(USER_SESSION);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns the full user list for an admin", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "bob", email: "bob@x.com" },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users).toHaveLength(1);
    expect(data.users[0].email).toBe("bob@x.com");
  });
});
