"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";
import CardListItem from "../shared-components/cards/CardListItem";
import type { CardItem } from "@/types/card";
import { centsToDollars } from "@/lib/money";

export default function MyCollection() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [binders, setBinders] = useState<{ id: string; name: string }[]>([
    { id: "all", name: "All Cards" },
  ]);
  const [binder, setBinder] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");

  // Fetch user's cards
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

          // Dynamically extract binders from the user's cards
          const binderMap = new Map<string, string>();
          data.cards.forEach((c: any) => {
            if (c.binder) binderMap.set(c.binder.id, c.binder.name);
          });
          setBinders([
            { id: "all", name: "All Cards" },
            ...Array.from(binderMap).map(([id, name]) => ({ id, name })),
          ]);
        } else {
          console.error("Error loading cards:", data.error);
        }
      } catch (err) {
        console.error("❌ Failed to fetch cards:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  // Fuzzy search
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: ["title", "status", "condition", "setName", "rarity", "type"],
  });

  // Filters
  const filteredProducts = searchResults.filter((product) => {
    const matchesBinder = binder === "all" || product.binder?.id === binder;
    const matchesFilter =
      filter === "all" ||
      (filter === "forsale" && product.forSale) ||
      (filter === "sold" && product.status === "sold");
    return matchesBinder && matchesFilter;
  });

  const handleCreateBinder = () => {
    if (!newBinderName.trim()) return;
    const newId = newBinderName.toLowerCase().replace(/\s+/g, "-");
    if (binders.find((b) => b.id === newId)) {
      alert("Binder name already exists!");
      return;
    }
    setBinders([...binders, { id: newId, name: newBinderName }]);
    setBinder(newId);
    setNewBinderName("");
    setOpenDialog(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
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
          onChange={(e, val) => val && setFilter(val)}
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
          <ToggleButton value="sold">Sold</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Card Grid */}
      <Box>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
          }}
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <CardListItem
                key={product.id}
                card={product}
                onClick={(card) => router.push(`/cards/${card.id}`)}
              />
            ))
          ) : (
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              sx={{ mt: 4 }}
            >
              No cards match your filters.
            </Typography>
          )}
        </Box>
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
