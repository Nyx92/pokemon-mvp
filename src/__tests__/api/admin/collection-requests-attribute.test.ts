import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  collectionRequest: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/admin/collection-requests/[id]/attribute/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/collection-requests/req-1/attribute", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: "admin-1", role: "admin", username: "staffuser" } });
});

describe("POST /api/admin/collection-requests/[id]/attribute", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the request doesn't exist", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the request isn't COLLECTED yet", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", status: "PACKED" });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(400);
    expect(mockPrisma.collectionRequest.update).not.toHaveBeenCalled();
  });

  it("sets collectedByStaffId to the calling admin and returns their info", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", status: "COLLECTED" });
    mockPrisma.collectionRequest.update.mockResolvedValue({});

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    const body = await res.json();

    expect(mockPrisma.collectionRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { collectedByStaffId: "admin-1" },
    });
    expect(body.collectedByStaff).toEqual({ id: "admin-1", username: "staffuser" });
  });
});
