import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

/**
 * POST /api/auth/reset-password — verifies the raw token against the stored
 * SHA-256 hash and expiry before allowing a password change, then clears the
 * token so the link can't be replayed.
 */

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));

const mockBcryptHash = vi.hoisted(() => vi.fn().mockResolvedValue("new-hashed-password"));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("bcryptjs", () => ({ default: { hash: mockBcryptHash } }));

import { POST } from "@/app/api/auth/reset-password/route";

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const VALID_PASSWORD = "brand-new-password";

// Mirrors exactly what /api/auth/forgot-password stores — a raw token and
// the SHA-256 hash of that same token.
function makeValidTokenPair() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/reset-password", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await POST(postRequest({ uid: "user-1" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 (not a 500) when a field is present but the wrong type", async () => {
    const res = await POST(
      postRequest({ uid: "user-1", token: ["not-a-string"], password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when the new password is too short", async () => {
    const res = await POST(
      postRequest({ uid: "user-1", token: "abc", password: "short" }) as any
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the user has no reset token on record", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    });

    const res = await POST(
      postRequest({ uid: "user-1", token: "whatever", password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the token has expired", async () => {
    const { rawToken, tokenHash } = makeValidTokenPair();
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() - 1000), // already past
    });

    const res = await POST(
      postRequest({ uid: "user-1", token: rawToken, password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the token doesn't match the stored hash", async () => {
    const { tokenHash } = makeValidTokenPair();
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await POST(
      postRequest({ uid: "user-1", token: "wrong-token", password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the password and clears the token on a valid, unexpired match", async () => {
    const { rawToken, tokenHash } = makeValidTokenPair();
    mockPrisma.user.findUnique.mockResolvedValue({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await POST(
      postRequest({ uid: "user-1", token: rawToken, password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(200);

    expect(mockBcryptHash).toHaveBeenCalledWith(VALID_PASSWORD, 10);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        password: "new-hashed-password",
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      postRequest({ uid: "user-1", token: "abc", password: VALID_PASSWORD }) as any
    );
    expect(res.status).toBe(500);
  });
});
