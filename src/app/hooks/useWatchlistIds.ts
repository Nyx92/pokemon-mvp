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

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export function useWatchlistIds(): Set<string> {
  const { isLoggedIn } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoggedIn) {
      setIds(new Set());
      return;
    }
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.cards)) {
          setIds(new Set(data.cards.map((c: { id: string }) => c.id)));
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  return ids;
}
