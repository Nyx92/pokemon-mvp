"use client";

import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// ── Animation variants ────────────────────────────────────────────────────────
// 1. Individual card tile: fade up on enter.
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
// 2. Grid container: staggers card tiles and fades out when any of
//    filter / binder / search changes (AnimatePresence key-swap).
const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import CardListItem from "../shared-components/cards/CardListItem";
import ErrorState from "../shared-components/ErrorState";
import EmptyState from "../shared-components/EmptyState";
import type { CardItem } from "@/types/card";
import { centsToDollars } from "@/lib/money";

// Hoisted so the reference is stable across renders — passing a new array
// literal here every render defeats useFuzzySearch's internal useMemo,
// rebuilding the entire Fuse index on every keystroke in the search box.
const MY_COLLECTION_SEARCH_KEYS = ["title", "status", "condition", "setName", "rarity", "type"];

export default function MyCollection() {
  const [cards,      setCards]      = useState<CardItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [binders, setBinders] = useState<{ id: string; name: string }[]>([
    { id: "all", name: "All Cards" },
  ]);
  const [binder, setBinder] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");

  // 1. Fetch the user's cards; surface error state on failure.
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/user/cards");
        const data = await res.json();
        if (res.ok) {
          const normalized = data.cards.map((c: any) => ({
            ...c,
            price: c.price != null ? centsToDollars(c.price) : null,
          }));
          setCards(normalized);
        } else {
          console.error("Error loading cards:", data.error);
          setFetchError(true);
        }
      } catch (err) {
        console.error("Failed to fetch cards:", err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  // 1b. Fetch the user's binders separately from /api/binders (not derived from
  // `cards` above) — a freshly-created, still-empty binder has no cards yet, so
  // deriving the list from card.binder would never let it show up at all.
  useEffect(() => {
    const fetchBinders = async () => {
      try {
        const res = await fetch("/api/binders");
        const data = await res.json();
        if (res.ok && Array.isArray(data.binders)) {
          setBinders([{ id: "all", name: "All Cards" }, ...data.binders]);
        } else {
          console.error("Error loading binders:", data.error);
        }
      } catch (err) {
        console.error("Failed to fetch binders:", err);
      }
    };

    fetchBinders();
  }, []);

  // Fuzzy search
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: MY_COLLECTION_SEARCH_KEYS,
  });

  // Filters
  const filteredProducts = searchResults.filter((product) => {
    const matchesBinder = binder === "all" || product.binder?.id === binder;
    const matchesFilter =
      filter === "all" ||
      (filter === "forsale"   && product.forSale) ||
      (filter === "inauction" && product.inAuction) ||
      (filter === "sold"      && product.status === "sold");
    return matchesBinder && matchesFilter;
  });

  const handleCreateBinder = async () => {
    const name = newBinderName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create binder.");
        return;
      }
      setBinders([...binders, data.binder]);
      setBinder(data.binder.id);
      setNewBinderName("");
      setOpenDialog(false);
    } catch (err) {
      console.error("Failed to create binder:", err);
      alert("Failed to create binder.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 2. Render error state if the fetch failed.
  if (fetchError) {
    return (
      <ErrorState
        variant="error"
        title="Couldn't load your collection"
        action={{ label: "Refresh page", onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          gap: 2,
          width: "95%",
          mx: "auto",
        }}
      >
        {/* Left: Binder + Search */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Binder</InputLabel>
            <Select
              value={binder}
              onChange={(e) => {
                if (e.target.value === "new") {
                  setOpenDialog(true);
                } else {
                  setBinder(e.target.value);
                }
              }}
              label="Binder"
            >
              {binders.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
              <MenuItem value="new">
                <AddIcon fontSize="small" sx={{ mr: 1 }} /> Create New Binder
              </MenuItem>
            </Select>
          </FormControl>

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
            sx={{ width: { xs: "100%", sm: 260, md: 300 } }}
          />
        </Box>

        {/* Right: filters */}
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_e, val) => val && setFilter(val)}
          size="small"
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              fontFamily: "'Nunito Sans', 'Poppins', 'Roboto', sans-serif",
              textTransform: "none",
              border: "none",
              borderRadius: "20px",
              fontWeight: 600,
              fontSize: "0.9rem",
              letterSpacing: "0.3px",
              color: "#555",
              px: 2.5,
              py: 0.5,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(56, 55, 53, 0.1)",
                color: "#000",
              },
              "&.Mui-selected": {
                backgroundColor: "black",
                color: "#fff",
                "&:hover": {
                  backgroundColor: "rgba(56, 55, 53, 0.1)",
                },
              },
            },
            "& .MuiToggleButtonGroup-grouped:not(:last-of-type)": {
              marginRight: "8px",
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="forsale">For Sale</ToggleButton>
          <ToggleButton value="inauction">In Auction</ToggleButton>
          <ToggleButton value="sold">Sold</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Card Grid */}
      <Box>
        {/* 3. Composite key covers all three filter axes so any change
               triggers exit + re-enter, replaying the stagger entrance. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${filter}-${binder}-${search}`}
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
                    onClick={(card) => router.push(`/cards/${card.id}`)}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div variants={cardVariants} style={{ width: "100%" }}>
                <EmptyState
                  icon={<SearchIcon sx={{ fontSize: 40, color: "#d1d5db" }} />}
                  title="No cards match your filters."
                />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Create Binder Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Create a New Binder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Binder Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newBinderName}
            onChange={(e) => setNewBinderName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateBinder} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
