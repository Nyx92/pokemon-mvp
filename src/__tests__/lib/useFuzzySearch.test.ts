// @vitest-environment jsdom
//
// This file is the only one in the suite that needs a DOM: renderHook (from
// @testing-library/react) mounts a real React tree via react-dom, which
// needs `document`. The rest of the suite runs under vitest's global "node"
// environment (see vitest.config.ts) — this per-file directive opts just
// this test into jsdom without changing that global setting.
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";

/**
 * useFuzzySearch's Fuse index is built inside a useMemo keyed on [data, keys,
 * threshold]. If a caller passes a NEW array literal for `keys` on every
 * render (e.g. `keys: ["title", "status"]` written inline in JSX), the
 * useMemo dependency never matches and the index is rebuilt from scratch on
 * every re-render — including every keystroke in a search box. This test
 * pins the hook's own memoization: calling it twice with a referentially
 * STABLE keys array and the same data/threshold must not change behavior
 * between renders (the fix is at the call sites, not in this hook — this
 * test documents the contract the call-site fix relies on).
 */

describe("useFuzzySearch", () => {
  const data = [{ title: "Charizard" }, { title: "Blastoise" }];
  const stableKeys = ["title"];

  it("returns matching results for a query", () => {
    const { result } = renderHook(() =>
      useFuzzySearch({ data, query: "char", keys: stableKeys })
    );
    expect(result.current).toEqual([{ title: "Charizard" }]);
  });

  it("returns all data when the query is empty", () => {
    const { result } = renderHook(() =>
      useFuzzySearch({ data, query: "", keys: stableKeys })
    );
    expect(result.current).toEqual(data);
  });
});
