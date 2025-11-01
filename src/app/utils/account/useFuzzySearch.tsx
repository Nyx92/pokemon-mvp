// utils/useFuzzySearch.ts
import { useMemo } from "react";
import Fuse from "fuse.js";

interface UseFuzzySearchOptions<T> {
  data: T[];
  query: string;
  keys: string[];
  threshold?: number;
}

/**
 * A reusable hook for fuzzy searching arrays of objects using Fuse.js.
 */
export function useFuzzySearch<T>({
  data,
  query,
  keys,
  threshold = 0.3,
}: UseFuzzySearchOptions<T>): T[] {
  const fuse = useMemo(() => {
    return new Fuse(data, {
      keys,
      threshold,
    });
  }, [data, keys, threshold]);

  if (!query) return data;

  return fuse.search(query).map((r) => r.item);
}
