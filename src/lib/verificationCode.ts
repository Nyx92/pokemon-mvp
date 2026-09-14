// src/lib/verificationCode.ts
//
// Shared one-time-code helpers for the email + phone verification flows
// (src/app/api/user/verify/**). Mirrors the hash-only-storage principle
// already used by the password reset flow (see forgot-password/route.ts):
// the raw code is only ever emailed/texted, never persisted — only its
// SHA-256 hash is stored, so a DB leak alone can't be used to "verify" an
// account an attacker doesn't control.

import crypto from "crypto";

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_VERIFICATION_ATTEMPTS = 5;

/** Generates a random 6-digit numeric code, zero-padded (e.g. "004821"). */
export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison, same rationale as reset-password/route.ts. */
export function verificationCodeMatches(providedCode: string, storedHash: string): boolean {
  const providedHash = hashVerificationCode(providedCode);
  return (
    providedHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash))
  );
}
