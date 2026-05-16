/**
 * Shared display helpers used by CardListItem and AuctionCardItem.
 *
 * Keeping these in one place ensures the countdown logic and language
 * chip styles stay in sync across both tile components.
 */

// ── Countdown ────────────────────────────────────────────────────────────────

export function getTimeLeft(endsAt: string): { h: number; m: number; s: number; done: boolean } {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { h: 0, m: 0, s: 0, done: true };
  const totalSec = Math.floor(ms / 1000);
  return {
    h:    Math.floor(totalSec / 3600),
    m:    Math.floor((totalSec % 3600) / 60),
    s:    totalSec % 60,
    done: false,
  };
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ── Price formatting ─────────────────────────────────────────────────────────
// Strips the ".00" suffix for whole-dollar amounts (e.g. 80 → "80", 41.01 → "41.01").
export function fmtPrice(amount: number): string {
  const fixed = amount.toFixed(2);
  return fixed.endsWith(".00") ? String(Math.round(amount)) : fixed;
}

// ── Language chip ─────────────────────────────────────────────────────────────

export function getLanguageChip(
  language?: string | null
): { label: string; sx: { backgroundColor: string; color: string } } | null {
  const normalized = language?.trim().toLowerCase();
  if (normalized === "english")  return { label: "EN", sx: { backgroundColor: "#0D2D75", color: "#fff" } };
  if (normalized === "japanese") return { label: "JP", sx: { backgroundColor: "#D32F2F", color: "#fff" } };
  return null;
}
