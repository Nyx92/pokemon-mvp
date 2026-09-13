import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for /api/user (POST signup, PUT profile update).
 *
 * Note on password length: a parallel hardening task may raise the minimum
 * password length from 6 to 10 characters. To stay valid either way, the
 * "too short" cases below use a password well below either threshold, and
 * the "valid" cases use one well above either threshold.
 */

// ── STEP 1: Create mock objects ───────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  user: { create: vi.fn(), update: vi.fn() },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockBcryptHash = vi.hoisted(() => vi.fn().mockResolvedValue("hashed-password"));

// ── STEP 2: Register fakes ────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("bcryptjs", () => ({ default: { hash: mockBcryptHash } }));

// ── STEP 3: Import code under test ────────────────────────────────────────────

import { POST, PUT } from "@/app/api/user/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/user", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function putRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/user", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

const VALID_SIGNUP = {
  firstName: "Ash",
  lastName: "Ketchum",
  username: "ashketchum",
  email: "ash@example.com",
  password: "pikachu-secure-1",
  country: "SG",
  sex: "M",
  dob: "2000-01-01",
  address: "1 Pallet Town",
  phoneNumber: "12345678",
};

const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/user (signup)", () => {
  it("creates a new user with a valid email/username/password", async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      firstName: "Ash",
      lastName: "Ketchum",
      username: "ashketchum",
      email: "ash@example.com",
      country: "SG",
      sex: "M",
      dob: new Date("2000-01-01"),
      address: "1 Pallet Town",
      phoneNumber: "12345678",
      verified: false,
      role: "user",
    });

    const res = await POST(postRequest(VALID_SIGNUP));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("ash@example.com");

    expect(mockBcryptHash).toHaveBeenCalledWith(VALID_SIGNUP.password, 10);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "ash@example.com",
          username: "ashketchum",
          password: "hashed-password",
          role: "user",
          verified: false,
        }),
      })
    );
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await POST(postRequest({ email: "", password: "" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a password that is too short", async () => {
    const res = await POST(postRequest({ ...VALID_SIGNUP, password: "ab" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 on duplicate email (P2002 on email)", async () => {
    mockPrisma.user.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["email"] },
    });

    const res = await POST(postRequest(VALID_SIGNUP));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 409 on duplicate username (P2002 on username)", async () => {
    mockPrisma.user.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["username"] },
    });

    const res = await POST(postRequest(VALID_SIGNUP));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/username/i);
  });

  it("returns 500 on an unexpected error", async () => {
    mockPrisma.user.create.mockRejectedValue(new Error("db exploded"));

    const res = await POST(postRequest(VALID_SIGNUP));
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/user (profile update)", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await PUT(putRequest({ email: "new@example.com" }));
    expect(res.status).toBe(401);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const res = await PUT(putRequest({ firstName: "Ash" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the current session user's profile", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      firstName: "Ash",
      lastName: "Ketchum",
      username: "ashketchum",
      email: "new@example.com",
      country: "SG",
      sex: "M",
      dob: null,
      address: "1 Pallet Town",
      phoneNumber: "12345678",
      verified: false,
      role: "user",
    });

    const res = await PUT(putRequest({ email: "new@example.com", firstName: "Ash" }));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("new@example.com");
  });

  it("returns 409 when the new email is already in use (P2002)", async () => {
    mockPrisma.user.update.mockRejectedValue({ code: "P2002" });

    const res = await PUT(putRequest({ email: "taken@example.com" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 500 on an unexpected error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("db exploded"));
    const res = await PUT(putRequest({ email: "new@example.com" }));
    expect(res.status).toBe(500);
  });
});
