"use client";
/**
 * useWatchlistIds — fetches the current user's watchlisted card IDs once on
 * mount (or when login state changes) and returns them as a Set<string>.
 *
 * Used by pages that render CardListItem in bulk (Marketplace, HomeFeatured) so
 * each tile knows its initial watchlist state without making N individual requests.
 *
 * Returns an empty Set when the user is not authenticated.
 */

import { useEffect, useState, startTransition } from "react";
import { useAuth } from "./useAuth";

// Stable reference returned while logged out, so callers that render off
// this Set don't see a new object identity on every render.
const EMPTY_SET: Set<string> = new Set();

export function useWatchlistIds(): Set<string> {
  const { isLoggedIn } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  // When logged out, the returned Set is masked to empty below (derived at
  // render) instead of resetting `ids` here — avoids a synchronous
  // setState-in-effect while keeping the same returned value.
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.cards)) {
          // Wrapped in startTransition — this hook runs on every page (e.g.
          // Marketplace, HomeFeatured), and an ordinary setState here can
          // otherwise win the scheduler over a pending route-change
          // transition, visibly delaying navigation. See HomeFeatured.tsx.
          startTransition(() => {
            setIds(new Set(data.cards.map((c: { id: string }) => c.id)));
          });
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  return isLoggedIn ? ids : EMPTY_SET;
}
