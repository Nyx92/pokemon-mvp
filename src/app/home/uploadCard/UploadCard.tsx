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
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { POKEMON_RARITIES } from "@/constants/pokemon";
import {
  RAW_GRADES,
  PSA_GRADES,
  BECKETT_GRADES,
  CGC_GRADES,
  SGC_GRADES,
} from "@/constants/grades";

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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // which image is shown
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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

  // ✅ Handle multiple image uploads
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      const newFiles = [...imageFiles, ...files];
      const newPreviews = [
        ...previewUrls,
        ...files.map((f) => URL.createObjectURL(f)),
      ];

      setImageFiles(newFiles);
      setPreviewUrls(newPreviews);

      // show the latest uploaded image
      setCurrentImageIndex(newPreviews.length - 1);
    }
  };

  // ✅ Delete currently selected image
  const handleRemoveImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);

    setImageFiles(newFiles);
    setPreviewUrls(newPreviews);

    if (newPreviews.length === 0) {
      setCurrentImageIndex(0);
    } else {
      // clamp index so we don't go out of bounds
      setCurrentImageIndex((prev) =>
        prev >= newPreviews.length ? newPreviews.length - 1 : prev
      );
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? previewUrls.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === previewUrls.length - 1 ? 0 : prev + 1
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.title ||
      !form.price ||
      !form.condition ||
      !form.ownerId ||
      imageFiles.length === 0
    ) {
      return alert(
        "Please fill in all required fields and upload at least one image."
      );
    }

    setUploading(true);
    setSuccessMsg("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, val]) =>
        body.append(key, String(val))
      );
      imageFiles.forEach((file) => body.append("images", file)); // 👈 multiple images

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
      setImageFiles([]);
      setPreviewUrls([]);
      setCurrentImageIndex(0);
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
          userSelect: "none", // can't select text inside
          caretColor: "transparent", // hide the blinking text cursor
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
                    {RAW_GRADES.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
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
                    {PSA_GRADES.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
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
                    {BECKETT_GRADES.map((g) => (
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
                    {CGC_GRADES.map((g) => (
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
                    {SGC_GRADES.map((g) => (
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
                {POKEMON_RARITIES.map((r) => (
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

            {/* Right: multiple image upload */}
            <Box
              sx={{
                flexBasis: { md: "40%", xs: "100%" },
                textAlign: "center",
                mt: { xs: 3, md: 0 },
              }}
            >
              <Typography fontWeight={600} mb={1}>
                Card Images
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
                Choose Images
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </Button>

              {previewUrls.length > 0 && (
                <>
                  {/* Main image area */}
                  <Box
                    sx={{
                      position: "relative",
                      mt: 1,
                      borderRadius: 3,
                      overflow: "hidden",
                      backgroundColor: "#fff",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.18)", // shadow around the box
                      p: 1.5,
                    }}
                  >
                    <img
                      src={previewUrls[currentImageIndex]}
                      alt={`Preview ${currentImageIndex + 1}`}
                      style={{
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "contain",
                        borderRadius: 12,
                        display: "block",
                      }}
                    />

                    {/* Left/right arrows */}
                    {previewUrls.length > 1 && (
                      <>
                        <IconButton
                          onClick={handlePrevImage}
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: 12,
                            transform: "translateY(-50%)",
                            backgroundColor: "rgba(255,255,255,0.9)",
                            "&:hover": { backgroundColor: "#eee" },
                          }}
                        >
                          <ChevronLeftIcon />
                        </IconButton>
                        <IconButton
                          onClick={handleNextImage}
                          sx={{
                            position: "absolute",
                            top: "50%",
                            right: 12,
                            transform: "translateY(-50%)",
                            backgroundColor: "rgba(255,255,255,0.9)",
                            "&:hover": { backgroundColor: "#eee" },
                          }}
                        >
                          <ChevronRightIcon />
                        </IconButton>
                      </>
                    )}

                    {/* Delete current image */}
                    <IconButton
                      onClick={() => handleRemoveImage(currentImageIndex)}
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        backgroundColor: "rgba(255,255,255,0.95)",
                        "&:hover": { backgroundColor: "#f8d7da" },
                      }}
                    >
                      <DeleteIcon color="error" fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Thumbnails */}
                  {previewUrls.length > 1 && (
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        mt: 2,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {previewUrls.map((url, i) => (
                        <Box
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 1.5,
                            overflow: "hidden",
                            cursor: "pointer",
                            border:
                              i === currentImageIndex
                                ? "2px solid #1976d2"
                                : "1px solid #ddd",
                          }}
                        >
                          <img
                            src={url}
                            alt={`Thumb ${i + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain", // show whole pic
                              display: "block",
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
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
