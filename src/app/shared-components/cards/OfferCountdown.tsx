"use client";

/**
 * OfferCountdown — live ticking countdown for offer expiry.
 *
 * Sequence of what happens:
 *
 *  1. MOUNT
 *     The component receives `expiresAt` (an ISO date string, e.g.
 *     "2026-04-15T10:30:00.000Z") from the parent.
 *     `useState` calculates the initial milliseconds remaining so the display
 *     is correct on the very first render — no blank flash.
 *
 *  2. START THE INTERVAL (useEffect)
 *     Once mounted, `setInterval` fires the `tick` function every 1 second.
 *     `tick` is also called immediately so there is no 1-second gap before the
 *     first update.
 *
 *  3. TICK — recalculate remaining time
 *     Each tick computes: expiresAt (ms) − Date.now() (ms).
 *     `setRemaining` pushes the new value into React state, causing a re-render
 *     with the updated countdown string.
 *
 *  4. EXPIRY CHECK (inside tick)
 *     If `ms <= 0` the offer has passed its deadline.
 *     - The interval is cleared so it stops ticking.
 *     - `onExpired?.()` is called if the parent passed a callback (e.g. to
 *       re-fetch offers and update the UI without a full page reload).
 *
 *  5. COLOUR CODING (render)
 *     grey  → more than 1 hour remaining (normal state)
 *     amber → under 1 hour remaining    (urgent — seller needs to act soon)
 *     red   → expired                   (deadline passed)
 *
 *  6. CLEANUP (useEffect return)
 *     When the component unmounts (dialog closed, page navigated away),
 *     `clearInterval` is called to prevent memory leaks and phantom state updates.
 */

import { useEffect, useState } from "react";
import { Typography } from "@mui/material";

interface OfferCountdownProps {
  /** ISO date string returned by the API, e.g. offer.expiresAt */
  expiresAt: string;
  /** Called once when the countdown reaches 0 — use to refresh offer state */
  onExpired?: () => void;
}

/**
 * Converts raw milliseconds into a human-readable "Xh MMm SSs" string.
 * `Math.max(0, ...)` prevents negative values from showing if the clock
 * drifts slightly past zero before the interval clears.
 */
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  // padStart ensures "5m 03s" rather than "5m 3s"
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function OfferCountdown({ expiresAt, onExpired }: OfferCountdownProps) {
  // ── 1. Initial state — computed once on mount ──────────────────────────────
  // Lazy initialiser runs synchronously before the first paint, so the timer
  // displays a real value immediately rather than "0h 00m 00s" for one frame.
  const [remaining, setRemaining] = useState(
    () => new Date(expiresAt).getTime() - Date.now()
  );

  // ── 2-4. Start ticking, check expiry, clean up on unmount ─────────────────
  useEffect(() => {
    const tick = () => {
      // 3. Recalculate remaining ms on every tick
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);

      // 4. Stop the interval and fire the callback when time is up
      if (ms <= 0) {
        clearInterval(id);
        onExpired?.();
      }
    };

    // Start the 1-second interval, then fire immediately (step 2)
    const id = setInterval(tick, 1000);
    tick();

    // 6. Clean up so the interval doesn't run after the component unmounts
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  // ── 5. Colour coding ───────────────────────────────────────────────────────
  const isExpired = remaining <= 0;
  const isUrgent  = !isExpired && remaining < 60 * 60 * 1000; // under 1 hour

  return (
    <Typography
      component="span"
      sx={{
        fontSize: 11,
        fontWeight: 600,
        // tabular-nums keeps digit widths equal so the string doesn't jump
        // left/right as numbers change each second
        fontVariantNumeric: "tabular-nums",
        color: isExpired ? "#ef4444"   // red   — expired
             : isUrgent  ? "#d97706"   // amber — under 1 hour
             :             "#6b7280",  // grey  — plenty of time
      }}
    >
      {isExpired ? "Expired" : `Expires in ${formatRemaining(remaining)}`}
    </Typography>
  );
}
