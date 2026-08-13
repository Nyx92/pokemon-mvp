import { describe, it, expect } from "vitest";
import { isAdminOrOwner } from "@/lib/auth";

describe("isAdminOrOwner", () => {
  it("returns true for an admin regardless of ownerId", () => {
    expect(isAdminOrOwner({ user: { id: "user-1", role: "admin" } }, "owner-1")).toBe(true);
  });

  it("returns true when the session user id matches ownerId", () => {
    expect(isAdminOrOwner({ user: { id: "owner-1", role: "user" } }, "owner-1")).toBe(true);
  });

  it("returns false for a non-admin, non-owner user", () => {
    expect(isAdminOrOwner({ user: { id: "user-1", role: "user" } }, "owner-1")).toBe(false);
  });

  it("returns false when there is no session", () => {
    expect(isAdminOrOwner(null, "owner-1")).toBe(false);
    expect(isAdminOrOwner(undefined, "owner-1")).toBe(false);
  });

  it("returns false when the session has no user id", () => {
    expect(isAdminOrOwner({ user: {} }, "owner-1")).toBe(false);
  });
});
