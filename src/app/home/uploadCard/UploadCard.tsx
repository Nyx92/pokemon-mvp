"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Divider,
} from "@mui/material";

export default function UploadCard() {
  const [form, setForm] = useState({
    title: "",
    price: "",
    conditionType: "",
    condition: "",
    description: "",
    ownerId: "",
    forSale: false,
    setName: "",
    rarity: "",
    type: "",
  });
  const [users, setUsers] = useState<
    { id: string; username: string | null; email: string }[]
  >([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const rarities = [
    "Common",
    "Uncommon",
    "Rare",
    "Rare Holo",
    "Rare Holo V",
    "Rare Holo VSTAR",
    "Rare Holo VMAX",
    "Rare Holo EX",
    "Double Rare",
    "Ultra Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare",
    "Secret Rare",
    "Promo",
    "Trainer Gallery",
    "Shiny Rare",
    "Shiny Ultra Rare",
    "Radiant Rare",
    "Amazing Rare",
    "Legend",
    "Prism Star",
    "ACE SPEC",
    "Rare BREAK",
    "Rare Prime",
    "Rare Shining",
    "Rare Holo GX",
    "Rare Rainbow",
    "Rare Shiny GX",
    "Rare Secret",
    "Rare Ultra",
    "Rare Shiny",
    "Promo (Black Star)",
    "Other / Error / Misc",
  ];

  // ✅ Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (res.ok) setUsers(data.users);
        else throw new Error(data.error || "Failed to load users");
      } catch (err: any) {
        console.error("❌ Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.title ||
      !form.price ||
      !form.condition ||
      !form.ownerId ||
      !imageFile
    )
      return alert("Please fill in all required fields and select an image.");

    setUploading(true);
    setSuccessMsg("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, val]) =>
        body.append(key, String(val))
      );
      body.append("image", imageFile);

      const res = await fetch("/api/cards", { method: "POST", body });
      if (!res.ok) throw new Error("Failed to upload card.");
      const data = await res.json();
      setSuccessMsg(`✅ Card "${data.card.title}" uploaded successfully!`);
      setForm({
        title: "",
        price: "",
        conditionType: "",
        condition: "",
        description: "",
        ownerId: "",
        forSale: false,
        setName: "",
        rarity: "",
        type: "",
      });
      setImageFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ px: 2, py: 6, display: "flex", justifyContent: "center" }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 3,
          maxWidth: 850,
          width: "100%",
          backgroundColor: "#fafafa",
        }}
      >
        <Typography variant="h5" fontWeight={700} textAlign="center" mb={1}>
          Upload a Card (Admin)
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          mb={4}
        >
          {
            "Add a new card to a specific user's collection and make it available in the marketplace."
          }
        </Typography>

        <form onSubmit={handleSubmit}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 4,
            }}
          >
            {/* Left column */}
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Title"
                name="title"
                value={form.title}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
              />

              <TextField
                label="Price (USD)"
                name="price"
                type="number"
                value={form.price}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
              />

              {/* 🧩 Condition (RAW / Graded) */}
              <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
                {/* Primary type */}
                <TextField
                  select
                  label="Condition Type"
                  name="conditionType"
                  value={form.conditionType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      conditionType: e.target.value,
                      condition: "",
                    })
                  }
                  fullWidth
                  required
                >
                  <MenuItem value="RAW">RAW (Ungraded)</MenuItem>
                  <MenuItem value="PSA">PSA</MenuItem>
                  <MenuItem value="Beckett">Beckett / BGS</MenuItem>
                  <MenuItem value="CGC">CGC</MenuItem>
                  <MenuItem value="SGC">SGC</MenuItem>
                </TextField>

                {/* Dynamic grade list */}
                {form.conditionType === "RAW" && (
                  <TextField
                    select
                    label="Raw Condition"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    fullWidth
                    required
                  >
                    {["Mint", "Near Mint", "Good", "Fair", "Poor"].map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {form.conditionType === "PSA" && (
                  <TextField
                    select
                    label="PSA Grade"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    fullWidth
                    required
                  >
                    {[...Array(10)].map((_, i) => (
                      <MenuItem key={i + 1} value={`PSA ${i + 1}`}>
                        PSA {i + 1}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {form.conditionType === "Beckett" && (
                  <TextField
                    select
                    label="Beckett Grade"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    fullWidth
                    required
                  >
                    {[
                      "Beckett 10 Black Label",
                      "Beckett 10 Pristine",
                      "Beckett 9.5 Gem Mint",
                      "Beckett 9 Mint",
                      "Beckett 8.5 NM-MT+",
                      "Beckett 8 NM-MT",
                      "Beckett 7.5 NM+",
                      "Beckett 7 NM",
                      "Beckett 6.5 EX-MT+",
                      "Beckett 6 EX-MT",
                    ].map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {form.conditionType === "CGC" && (
                  <TextField
                    select
                    label="CGC Grade"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    fullWidth
                    required
                  >
                    {[
                      "CGC 10 Pristine",
                      "CGC 9.5 Gem Mint",
                      "CGC 9 Mint",
                      "CGC 8.5 NM-MT+",
                      "CGC 8 NM-MT",
                      "CGC 7.5 NM+",
                      "CGC 7 NM",
                    ].map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {form.conditionType === "SGC" && (
                  <TextField
                    select
                    label="SGC Grade"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    fullWidth
                    required
                  >
                    {[
                      "SGC 10 Pristine",
                      "SGC 9.5 Gem Mint",
                      "SGC 9 Mint",
                      "SGC 8.5 NM-MT+",
                      "SGC 8 NM-MT",
                      "SGC 7.5 NM+",
                      "SGC 7 NM",
                    ].map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>

              <TextField
                label="Description"
                name="description"
                value={form.description}
                onChange={handleChange}
                fullWidth
                multiline
                rows={3}
                sx={{ mb: 2 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* 🧩 Owner dropdown */}
              <TextField
                select
                label="Select Owner"
                name="ownerId"
                value={form.ownerId}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
                helperText="Pick the card owner's username"
                SelectProps={{
                  MenuProps: {
                    PaperProps: { sx: { maxHeight: 300 } },
                  },
                }}
              >
                {users.map((u) => (
                  <MenuItem
                    key={u.id}
                    value={u.id}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      py: 1,
                    }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {u.username || "(no username)"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.8rem",
                        wordBreak: "break-all",
                      }}
                    >
                      User ID: {u.id}
                    </Typography>
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Set Name"
                name="setName"
                value={form.setName}
                onChange={handleChange}
                fullWidth
                helperText="(Optional)"
                sx={{ mb: 2 }}
              />
              <TextField
                select
                label="Rarity"
                name="rarity"
                value={form.rarity}
                onChange={handleChange}
                fullWidth
                sx={{ mb: 2 }}
                helperText="(Optional)"
                slotProps={{
                  select: {
                    MenuProps: {
                      PaperProps: {
                        sx: {
                          maxHeight: 250,
                          overflowY: "auto",
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {rarities.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="For Sale?"
                name="forSale"
                value={form.forSale ? "true" : "false"}
                onChange={(e) =>
                  setForm({ ...form, forSale: e.target.value === "true" })
                }
                fullWidth
                sx={{ mb: 2 }}
                helperText="Specify if this card is listed for sale or only in the user's collection"
              >
                <MenuItem value="true">Yes — List for Sale</MenuItem>
                <MenuItem value="false">No — Collection Only</MenuItem>
              </TextField>
            </Box>

            {/* Right: image preview */}
            <Box
              sx={{
                flexBasis: { md: "35%", xs: "100%" },
                textAlign: "center",
                mt: { xs: 3, md: 0 },
              }}
            >
              <Typography fontWeight={600} mb={1}>
                Card Image
              </Typography>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  fontWeight: 500,
                  borderColor: "#ccc",
                }}
              >
                Choose File
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </Button>

              {previewUrl && (
                <Paper
                  elevation={4}
                  sx={{
                    mt: 1,
                    p: 1.5,
                    borderRadius: 3,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      objectFit: "contain",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  />
                </Paper>
              )}
            </Box>
          </Box>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={uploading}
            fullWidth
            sx={{
              mt: 4,
              py: 1.3,
              borderRadius: 2,
              fontWeight: 600,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {uploading ? <CircularProgress size={22} /> : "Upload Card"}
          </Button>

          {successMsg && (
            <Typography
              variant="body1"
              color="success.main"
              textAlign="center"
              sx={{ mt: 3, fontWeight: 500 }}
            >
              {successMsg}
            </Typography>
          )}
        </form>
      </Paper>
    </Box>
  );
}
