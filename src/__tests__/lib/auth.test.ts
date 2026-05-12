import { describe, it, expect } from "vitest";
import { deriveGoogleUserFields } from "@/lib/auth";

/**
 * Unit tests for deriveGoogleUserFields — the pure helper that turns a
 * Google profile name + email into firstName, lastName, and a DB-safe username.
 * No DB or network calls involved.
 */

describe("deriveGoogleUserFields", () => {
  // ── Name splitting ──────────────────────────────────────────────────────────

  it("splits a two-part name into firstName and lastName", () => {
    const r = deriveGoogleUserFields("John Doe", "john@example.com");
    expect(r.firstName).toBe("John");
    expect(r.lastName).toBe("Doe");
  });

  it("joins remaining parts into lastName for three-part names", () => {
    const r = deriveGoogleUserFields("John Michael Doe", "j@example.com");
    expect(r.firstName).toBe("John");
    expect(r.lastName).toBe("Michael Doe");
  });

  it("returns null lastName when only one name part is present", () => {
    const r = deriveGoogleUserFields("Alice", "alice@example.com");
    expect(r.firstName).toBe("Alice");
    expect(r.lastName).toBeNull();
  });

  it("returns null firstName and lastName when name is null", () => {
    const r = deriveGoogleUserFields(null, "user@example.com");
    expect(r.firstName).toBeNull();
    expect(r.lastName).toBeNull();
  });

  it("returns null firstName and lastName when name is an empty string", () => {
    const r = deriveGoogleUserFields("", "user@example.com");
    expect(r.firstName).toBeNull();
    expect(r.lastName).toBeNull();
  });

  it("handles extra whitespace in the name", () => {
    const r = deriveGoogleUserFields("  Jane   Smith  ", "jane@example.com");
    expect(r.firstName).toBe("Jane");
    expect(r.lastName).toBe("Smith");
  });

  // ── Username derivation ─────────────────────────────────────────────────────

  it("uses the email prefix as the base username", () => {
    const r = deriveGoogleUserFields("John Doe", "johndoe@gmail.com");
    expect(r.baseUsername).toBe("johndoe");
  });

  it("replaces dots and special characters with underscores", () => {
    const r = deriveGoogleUserFields(null, "john.doe@gmail.com");
    expect(r.baseUsername).toBe("john_doe");
  });

  it("replaces plus signs and other non-alphanumeric characters", () => {
    const r = deriveGoogleUserFields(null, "john.doe+test@gmail.com");
    expect(r.baseUsername).toBe("john_doe_test");
  });

  it("strips leading and trailing underscores from the derived username", () => {
    const r = deriveGoogleUserFields(null, ".leading@example.com");
    expect(r.baseUsername).toBe("leading");
  });

  it("falls back to 'user' when the email prefix sanitises to empty", () => {
    const r = deriveGoogleUserFields(null, "...@gmail.com");
    expect(r.baseUsername).toBe("user");
  });
});
