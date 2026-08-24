"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PoroLoader from "@/app/shared-components/PoroLoader";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
} from "@mui/material";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import SearchIcon from "@mui/icons-material/Search";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistIds } from "@/app/hooks/useWatchlistIds";
import CardListItem from "../shared-components/cards/CardListItem";
import ErrorState from "../shared-components/ErrorState";
import type { CardItem, CardBrowseIndexItem } from "@/types/card";
import { computeFacets } from "@/lib/marketplaceFacets";
import FilterBar, { type MarketplaceFilterState } from "./FilterBar";

// ── Animation variants ────────────────────────────────────────────────────────
// 1. Individual card tile: fade up on enter.
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
// 2. Grid container: staggers child cards and fades the whole grid out when
//    `search` changes (AnimatePresence key-swap triggers exit → enter cycle).
const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Hoisted so the reference is stable across renders — passing a new array
// literal here every render defeats useFuzzySearch's internal useMemo,
// rebuilding the entire Fuse index on every keystroke in the search box.
// Scoped to the lightweight browse-index's own fields (not the full
// CardItem shape the old full-list search used).
const MARKETPLACE_SEARCH_KEYS = ["title", "setName", "rarity"];
const PAGE_SIZE = 24;
const DEFAULT_FILTERS: MarketplaceFilterState = {
  game: "POKEMON",
  setNames: [],
  rarities: [],
  types: [],
  languages: [],
  conditions: [],
};

export default function Marketplace() {
  const { userId } = useAuth();
  const router = useRouter();
  const watchlistedIds = useWatchlistIds();

  const [browseIndex, setBrowseIndex] = useState<CardBrowseIndexItem[]>([]);
  const [browseIndexReady, setBrowseIndexReady] = useState(false);
  const [filters, setFilters] = useState<MarketplaceFilterState>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Fetch the lightweight browse-index once on mount — feeds search + facets.
  useEffect(() => {
    fetch("/api/cards/browse-index")
      .then((r) => r.json())
      .then((data) => setBrowseIndex(data.items ?? []))
      .catch(() => setBrowseIndex([])) // degrade gracefully — search/facets just show nothing
      .finally(() => setBrowseIndexReady(true));
  }, []);

  const facets = useMemo(() => computeFacets(browseIndex, filters.game), [browseIndex, filters.game]);

  // fuse.js over the in-memory index (existing hook, unchanged) — ranked by relevance.
  const searchMatches = useFuzzySearch({
    data: browseIndex,
    query: search,
    keys: MARKETPLACE_SEARCH_KEYS,
  });
  const matchedIds = search ? searchMatches.map((m) => m.id) : null;

  // True only while a search is typed but the index hasn't loaded yet — the
  // one case where matchedIds (computed from an empty browseIndex) can't be
  // trusted. This is deliberately NOT `!browseIndexReady` on its own: that
  // would flip false->true once on every page load regardless of whether a
  // search is active, re-triggering the page-1 effect below even when
  // nothing meaningful changed — which is exactly the redundant-fetch/flash
  // bug fixed in a prior commit. Gating on `search` too means this only
  // toggles (and so only forces a re-run) in the narrow case it exists for.
  const searchAwaitingIndex = Boolean(search) && !browseIndexReady;

  function buildQuery(pageNum: number) {
    const params = new URLSearchParams({
      forSale: "true",
      page: String(pageNum),
      pageSize: String(PAGE_SIZE),
    });
    params.set("game", filters.game);
    filters.setNames.forEach((v) => params.append("setName", v));
    filters.rarities.forEach((v) => params.append("rarity", v));
    filters.types.forEach((v) => params.append("type", v));
    filters.languages.forEach((v) => params.append("language", v));
    filters.conditions.forEach((v) => params.append("condition", v));
    if (matchedIds) {
      // Search-mode: paginate the client-side relevance-ranked id list
      // rather than trusting server pagination order, and only send this
      // page's ids (bounded to PAGE_SIZE) to keep the query string short.
      const start = (pageNum - 1) * PAGE_SIZE;
      matchedIds.slice(start, start + PAGE_SIZE).forEach((id) => params.append("ids", id));
    }
    return params.toString();
  }

  function reorderToMatchSearch(fetchedCards: CardItem[]): CardItem[] {
    if (!matchedIds) return fetchedCards;
    // Preserve fuse.js's relevance ranking — Prisma's `id IN (...)` does
    // not guarantee the response is ordered like the input array.
    const order = new Map(matchedIds.map((id, i) => [id, i]));
    return [...fetchedCards].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  // Refetch page 1 whenever filters or search change. Deliberately does NOT
  // depend on browseIndex directly: browseIndex only changes what gets
  // fetched when a search is active (it feeds fuse.js's match-id list via
  // matchedIds), and `search` is already in the dependency list to cover
  // that case. Without this, the browse-index request finishing shortly
  // after mount would retrigger this effect with an identical query,
  // flipping `loading` back to true and remounting (and replaying the
  // entrance animation of) the card grid right after it had just rendered.
  // searchAwaitingIndex is the one exception: it only changes when a search
  // is typed before the index has loaded, so depending on it re-runs this
  // effect in exactly that case (see its own comment above) without
  // reintroducing the redundant-fetch problem in the common no-search case.
  useEffect(() => {
    if (searchAwaitingIndex) {
      // Can't tell yet whether this search has zero matches or many — the
      // index it depends on hasn't loaded. Don't fetch, and don't take the
      // zero-matches shortcut below on stale/incomplete data; wait for
      // searchAwaitingIndex to flip false, which re-runs this effect.
      setLoading(true);
      return;
    }

    // A search with zero matches has nothing to fetch — skip the request.
    if (matchedIds && matchedIds.length === 0) {
      setCards([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(false);
    fetch(`/api/cards?${buildQuery(1)}`)
      .then((r) => r.json())
      .then((data) => {
        setCards(reorderToMatchSearch(data.cards ?? []));
        setHasMore(matchedIds ? matchedIds.length > PAGE_SIZE : Boolean(data.hasMore));
        setPage(1);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, searchAwaitingIndex]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetch(`/api/cards?${buildQuery(nextPage)}`)
      .then((r) => r.json())
      .then((data) => {
        setCards((prev) => [...prev, ...reorderToMatchSearch(data.cards ?? [])]);
        setHasMore(matchedIds ? matchedIds.length > nextPage * PAGE_SIZE : Boolean(data.hasMore));
        setPage(nextPage);
      })
      .finally(() => setLoadingMore(false));
  }

  const filteredProducts = cards.filter(
    (product) => !(userId && product.owner?.id === userId)
  );

  // 2. Render error state if the fetch failed.
  if (fetchError) {
    return (
      <ErrorState
        variant="error"
        title="Couldn't load the marketplace"
        action={{ label: "Refresh page", onClick: () => window.location.reload() }}
        dark
      />
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: 4,
          width: "95%",
          mx: "auto",
        }}
      >
        <TextField
          placeholder="Search cards..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 480, md: 600 },
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 1,
          }}
        />
      </Box>

      <Box sx={{ width: "95%", mx: "auto" }}>
        <FilterBar facets={facets} filters={filters} onChange={setFilters} />

        <Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
              <PoroLoader />
            </Box>
          ) : (
            // pb (not mb) deliberately — a bottom margin on the last element
            // in the page's content flow can collapse past the dark
            // pageBackgroundSx container's own bottom edge, leaving a gap
            // where the plain white page background shows through instead.
            // Padding stays inside the container, so it's always covered.
            // Applied here (not just inside the "hasMore" block below) so
            // the last row of cards still gets the same breathing room
            // before the footer once there's no more Load More button to
            // provide it.
            <Box sx={{ pb: 6 }}>
              {/* 3. key={search} causes AnimatePresence to unmount + remount the grid
                     whenever the search query changes, replaying the stagger entrance. */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={search}
                  variants={gridVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}
                >
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <motion.div key={product.id} variants={cardVariants}>
                        <CardListItem
                          card={product}
                          watchlisted={watchlistedIds.has(product.id)}
                          onClick={(card) => router.push(`/cards/${card.id}`)}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div variants={cardVariants} style={{ width: "100%" }}>
                      <Typography
                        variant="body1"
                        textAlign="center"
                        sx={{ mt: 4, color: "rgba(255,255,255,0.6)" }}
                      >
                        No cards match your filters.
                      </Typography>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>

              {hasMore && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    sx={{
                      // Same frosted-glass pill treatment as the
                      // Marketplace/Auctions nav tabs (frostedTabsSx in
                      // navChrome.ts) — kept inline here since that helper
                      // targets MuiTab-root, not a plain Button.
                      minHeight: 44,
                      px: 3,
                      py: 1,
                      fontWeight: 600,
                      fontSize: "1.05rem",
                      letterSpacing: "0.5px",
                      textTransform: "none",
                      borderRadius: "999px",
                      border: "1px solid rgba(255,255,255,0.28)",
                      backgroundColor: "rgba(255,255,255,0.10)",
                      backdropFilter: "blur(8px)",
                      color: "rgba(255,255,255,0.85)",
                      transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.18)",
                        borderColor: "rgba(255,255,255,0.45)",
                      },
                      "&.Mui-disabled": {
                        color: "rgba(255,255,255,0.5)",
                        borderColor: "rgba(255,255,255,0.15)",
                      },
                    }}
                  >
                    {loadingMore ? <CircularProgress size={20} sx={{ color: "rgba(255,255,255,0.85)" }} /> : "Load more"}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
