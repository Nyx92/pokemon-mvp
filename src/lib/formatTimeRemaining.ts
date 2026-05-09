/**
 * Converts an ISO expiresAt timestamp into a human-readable countdown string.
 * Returns null if the timestamp is null or the offer has already expired.
 *
 * Examples:
 *   "2h 15m remaining"
 *   "3d 4h remaining"
 *   "45m remaining"
 */
export function formatTimeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`;
  if (h > 0)   return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}
