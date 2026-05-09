import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTimeRemaining } from "@/lib/formatTimeRemaining";

const NOW = new Date("2024-06-01T12:00:00.000Z").getTime();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

const future = (ms: number) => new Date(NOW + ms).toISOString();

describe("formatTimeRemaining", () => {
  it("returns null for a null input", () => {
    expect(formatTimeRemaining(null)).toBeNull();
  });

  it("returns null when the timestamp is in the past", () => {
    expect(formatTimeRemaining(new Date(NOW - 1000).toISOString())).toBeNull();
  });

  it("returns null when the timestamp is exactly now", () => {
    expect(formatTimeRemaining(new Date(NOW).toISOString())).toBeNull();
  });

  it("shows minutes only when under an hour remains", () => {
    expect(formatTimeRemaining(future(45 * 60_000))).toBe("45m remaining");
  });

  it("shows hours and minutes when between 1 h and 24 h remain", () => {
    expect(formatTimeRemaining(future(2 * 3_600_000 + 15 * 60_000))).toBe("2h 15m remaining");
  });

  it("shows hours only when minutes are zero", () => {
    expect(formatTimeRemaining(future(3 * 3_600_000))).toBe("3h 0m remaining");
  });

  it("shows days and hours when 24 h or more remain", () => {
    expect(formatTimeRemaining(future(3 * 86_400_000 + 4 * 3_600_000))).toBe("3d 4h remaining");
  });

  it("shows 1d 0h when exactly 24 h remain", () => {
    expect(formatTimeRemaining(future(24 * 3_600_000))).toBe("1d 0h remaining");
  });
});
