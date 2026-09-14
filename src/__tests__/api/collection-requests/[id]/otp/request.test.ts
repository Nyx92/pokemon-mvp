import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/collection-requests/[id]/otp/request — sends a pickup
 * verification code to the caller's own verified phone number. Only
 * allowed once staff have marked the request PACKED.
 */

const mockPrisma = vi.hoisted(() => ({
  collectionRequest: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockSendSms = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockCheckRateLimit = vi.hoisted(() => vi.fn().mockReturnValue({ allowed: true }));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/sms", () => ({ sendSms: mockSendSms }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mockCheckRateLimit, getClientIp: () => "127.0.0.1" }));

import { POST } from "@/app/api/collection-requests/[id]/otp/request/route";

function postRequest() {
  return new Request("http://localhost/api/collection-requests/req-1/otp/request", { method: "POST" }) as any;
}
const params = { params: Promise.resolve({ id: "req-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true });
  mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
  mockSendSms.mockResolvedValue({ success: true });
  mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", userId: "user-1", status: "PACKED", requestRef: "PU-2609-AAAA" });
  mockPrisma.user.findUnique.mockResolvedValue({ phoneNumber: "+6591234567", phoneVerified: true });
});

describe("POST /api/collection-requests/[id]/otp/request", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(429);
  });

  it("returns 404 when the request doesn't exist", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue(null);
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the request doesn't belong to the caller", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", userId: "someone-else", status: "PACKED" });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(404);
  });

  it("returns 409 when the request isn't PACKED yet", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", userId: "user-1", status: "REQUESTED" });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(409);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("returns 409 when the request is already COLLECTED", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", userId: "user-1", status: "COLLECTED" });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(409);
  });

  it("returns 400 when the caller's phone isn't verified", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ phoneNumber: "+6591234567", phoneVerified: false });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(400);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("sends a code to the caller's verified phone and stores its hash", async () => {
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(200);

    const updateArgs = mockPrisma.collectionRequest.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "req-1" });
    expect(updateArgs.data.pickupCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(updateArgs.data.pickupCodeAttempts).toBe(0);

    expect(mockSendSms).toHaveBeenCalledWith(expect.objectContaining({ to: "+6591234567" }));
  });

  it("returns 502 when the SMS fails to send", async () => {
    mockSendSms.mockResolvedValue({ success: false, error: "Twilio down" });
    const res = await POST(postRequest(), params);
    expect(res.status).toBe(502);
  });
});
