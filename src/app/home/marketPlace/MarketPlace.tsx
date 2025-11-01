"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useFuzzySearch } from "@/app/utils/account/useFuzzySearch";

interface CardItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  status: string;
  forSale: boolean;
  imageUrls: string[];
  binder?: { id: string; name: string };
}

export default function MyCollection() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [binders, setBinders] = useState<{ id: string; name: string }[]>([
    { id: "all", name: "All Cards" },
  ]);
  const [binder, setBinder] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");

  // ✅ Fetch cards from Prisma via API
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cards");
        const data = await res.json();
        if (res.ok) {
          setCards(data.cards);

          // dynamically extract binders
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

  // Fuzzy search setup
  const searchResults = useFuzzySearch({
    data: cards,
    query: search,
    keys: ["title", "binder.name", "status", "condition"],
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

  // Handle binder creation
  const handleCreateBinder = () => {
    if (!newBinderName.trim()) return;
    const newId = newBinderName.toLowerCase().replace(/\s+/g, "-");
    if (binders.find((b) => b.id === newId)) {
      alert("Binder name already exists!");
      return;
    }
    const newBinder = { id: newId, name: newBinderName };
    setBinders([...binders, newBinder]);
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
    <Box sx={{ px: 4, py: 6 }}>
      {/* ✅ Toolbar */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          gap: 2,
          width: "80%",
          mx: "auto",
        }}
      >
        {/* Left side: Binder + Search */}
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
            placeholder="Search your cards..."
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

        {/* Right side: Filter Toggle */}
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
              marginRight: "8px", // spacing between buttons
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="forsale">For Sale</ToggleButton>
          <ToggleButton value="sold">Sold</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ✅ Card Grid */}
      <Box sx={{ width: "80%", mx: "auto" }}>
        <Grid
          container
          spacing={3}
          justifyContent="center"
          alignItems="stretch"
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <Grid
                key={product.id}
                size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
                display="flex"
                justifyContent="center"
              >
                <Card
                  sx={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 300,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: 2,
                    borderRadius: 2,
                    "&:hover": {
                      boxShadow: 5,
                      transform: "scale(1.02)",
                    },
                    transition: "0.2s",
                  }}
                >
                  {/* Status Badge */}
                  {product.status === "sold" && (
                    <Chip
                      label="Sold"
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        backgroundColor: "#A15C5C", // warm muted crimson
                        color: "#FFF",
                        fontWeight: 600,
                        "& .MuiChip-label": { fontSize: "0.8rem" },
                      }}
                    />
                  )}

                  {product.forSale && product.status !== "sold" && (
                    <Chip
                      label="For Sale"
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        backgroundColor: "#3FA796", // fresh muted teal
                        color: "#FFF",
                        fontWeight: 600,
                        "& .MuiChip-label": { fontSize: "0.8rem" },
                      }}
                    />
                  )}

                  <CardMedia
                    component="img"
                    image={product.imageUrls?.[0] || "/placeholder.png"}
                    alt={product.title}
                    sx={{
                      aspectRatio: "3 / 4",
                      objectFit: "contain",
                      backgroundColor: "#f8f8f8",
                    }}
                  />
                  <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight="bold"
                      noWrap
                      title={product.title}
                    >
                      {product.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Condition: {product.condition}
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      color="primary"
                      sx={{ mt: 0.5 }}
                    >
                      ${product.price.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
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
        </Grid>
      </Box>

      {/* ✅ Create Binder Dialog */}
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
