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

import { POKEMON_RARITIES, POKEMON_LANGUAGES } from "@/constants/pokemon";
import {
  RAW_GRADES,
  PSA_GRADES,
  BECKETT_GRADES,
  CGC_GRADES,
  SGC_GRADES,
} from "@/constants/grades";

type ImageSlot =
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File; previewUrl: string };

function inferConditionType(condition: string): string {
  if ((PSA_GRADES as readonly string[]).includes(condition)) return "PSA";
  if ((BECKETT_GRADES as readonly string[]).includes(condition)) return "Beckett";
  if ((CGC_GRADES as readonly string[]).includes(condition)) return "CGC";
  if ((SGC_GRADES as readonly string[]).includes(condition)) return "SGC";
  return "RAW";
}

interface CardInitialData {
  id: string;
  title: string;
  price: number | null;
  condition: string;
  language: string;
  tcgPlayerId: string;
  description: string;
  ownerId: string;
  forSale: boolean;
  setName: string;
  rarity: string;
  imageUrls: string[];
  cardNumber?: string;
}

interface UploadCardProps {
  initialData?: CardInitialData;
}

export default function UploadCard({ initialData }: UploadCardProps) {
  const isEditMode = !!initialData;

  const [form, setForm] = useState(() => ({
    title: initialData?.title ?? "",
    price: initialData?.price != null ? String(initialData.price) : "",
    conditionType: initialData ? inferConditionType(initialData.condition) : "",
    condition: initialData?.condition ?? "",
    language: initialData?.language ?? "",
    tcgPlayerId: initialData?.tcgPlayerId ?? "",
    description: initialData?.description ?? "",
    ownerId: initialData?.ownerId ?? "",
    forSale: initialData?.forSale ?? true,
    setName: initialData?.setName ?? "",
    rarity: initialData?.rarity ?? "",
    cardNumber: initialData?.cardNumber ?? "",
  }));

  const [users, setUsers] = useState<
    { id: string; username: string | null; email: string }[]
  >([]);
  const [images, setImages] = useState<ImageSlot[]>(() =>
    initialData?.imageUrls.map((url) => ({ kind: "existing", url })) ?? []
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

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
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const newSlots: ImageSlot[] = files.map((file) => ({
      kind: "new",
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => {
      const updated = [...prev, ...newSlots];
      setCurrentImageIndex(updated.length - 1);
      return updated;
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setCurrentImageIndex((prev) =>
        prev >= updated.length ? Math.max(0, updated.length - 1) : prev
      );
      return updated;
    });
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const priceRequiredButMissing =
      form.forSale && (!form.price || Number.isNaN(Number(form.price)));

    if (
      !form.title ||
      !form.condition ||
      !form.ownerId ||
      images.length === 0 ||
      priceRequiredButMissing
    ) {
      return alert(
        "Please fill in all required fields and include at least one image."
      );
    }

    setUploading(true);
    setSuccessMsg("");

    try {
      const body = new FormData();
      const { conditionType: _ct, ...formFields } = form;
      Object.entries(formFields).forEach(([key, val]) =>
        body.append(key, String(val))
      );

      // Existing images to keep
      const keepImageUrls = images
        .filter((s): s is { kind: "existing"; url: string } => s.kind === "existing")
        .map((s) => s.url);
      body.append("keepImageUrls", JSON.stringify(keepImageUrls));

      // New image files
      images
        .filter(
          (s): s is { kind: "new"; file: File; previewUrl: string } =>
            s.kind === "new"
        )
        .forEach((s) => body.append("images", s.file));

      const url = isEditMode
        ? `/api/cards/${initialData!.id}`
        : "/api/cards";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, { method, body });
      if (!res.ok) throw new Error("Failed to save card.");
      const data = await res.json();

      setSuccessMsg(
        isEditMode
          ? `✅ Card "${data.card.title}" updated successfully!`
          : `✅ Card "${data.card.title}" uploaded successfully!`
      );

      if (!isEditMode) {
        setForm({
          title: "",
          price: "",
          conditionType: "",
          condition: "",
          language: "",
          tcgPlayerId: "",
          description: "",
          ownerId: "",
          forSale: false,
          setName: "",
          rarity: "",
          cardNumber: "",
        });
        setImages([]);
        setCurrentImageIndex(0);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const displayUrl =
    images.length > 0
      ? images[currentImageIndex].kind === "existing"
        ? images[currentImageIndex].url
        : images[currentImageIndex].previewUrl
      : null;

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
          userSelect: "none",
          caretColor: "transparent",
        }}
      >
        <Typography variant="h5" fontWeight={700} textAlign="center" mb={1}>
          {isEditMode ? "Edit Card (Admin)" : "Upload a Card (Admin)"}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          mb={4}
        >
          {isEditMode
            ? "Update the card details. Existing images are shown — remove or add new ones as needed."
            : "Add a new card to a specific user's collection and make it available in the marketplace."}
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
                label="Price (SGD)"
                name="price"
                type="number"
                value={form.price}
                onChange={handleChange}
                fullWidth
                required={form.forSale}
                disabled={!form.forSale}
                sx={{ mb: 2 }}
                helperText={
                  form.forSale
                    ? "Required for cards listed for sale"
                    : "Optional — price is not needed for collection-only cards"
                }
              />

              <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
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

                {form.conditionType === "RAW" && (
                  <TextField select label="Raw Condition" name="condition" value={form.condition} onChange={handleChange} fullWidth required>
                    {RAW_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                )}
                {form.conditionType === "PSA" && (
                  <TextField select label="PSA Grade" name="condition" value={form.condition} onChange={handleChange} fullWidth required>
                    {PSA_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                )}
                {form.conditionType === "Beckett" && (
                  <TextField select label="Beckett Grade" name="condition" value={form.condition} onChange={handleChange} fullWidth required>
                    {BECKETT_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                )}
                {form.conditionType === "CGC" && (
                  <TextField select label="CGC Grade" name="condition" value={form.condition} onChange={handleChange} fullWidth required>
                    {CGC_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                )}
                {form.conditionType === "SGC" && (
                  <TextField select label="SGC Grade" name="condition" value={form.condition} onChange={handleChange} fullWidth required>
                    {SGC_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                )}
              </Box>

              <TextField
                select
                label="Language"
                name="language"
                value={form.language}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
              >
                {POKEMON_LANGUAGES.map((g) => (
                  <MenuItem key={g} value={g}>{g}</MenuItem>
                ))}
              </TextField>

              <TextField
                label="TCG Player ID"
                name="tcgPlayerId"
                value={form.tcgPlayerId}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 2 }}
                helperText="Required for Price History"
              />

              <TextField
                select
                label="Select Owner"
                name="ownerId"
                value={form.ownerId}
                onChange={handleChange}
                fullWidth
                required
                sx={{ mb: 3 }}
                helperText="Pick the card owner's username"
                slotProps={{
                  select: { MenuProps: { PaperProps: { sx: { maxHeight: 300 } } } },
                }}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", py: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {u.username || "(no username)"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem", wordBreak: "break-all" }}>
                      User ID: {u.id}
                    </Typography>
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="For Sale?"
                name="forSale"
                value={form.forSale ? "true" : "false"}
                onChange={(e) => {
                  const isForSale = e.target.value === "true";
                  setForm((prev) => ({
                    ...prev,
                    forSale: isForSale,
                    price: isForSale ? prev.price : "",
                  }));
                }}
                fullWidth
                sx={{ mb: 2 }}
                helperText="Specify if this card is listed for sale or only in the user's collection"
              >
                <MenuItem value="true">Yes — List for Sale</MenuItem>
                <MenuItem value="false">No — Collection Only</MenuItem>
              </TextField>

              <Divider sx={{ my: 2 }} />

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
                    MenuProps: { PaperProps: { sx: { maxHeight: 250, overflowY: "auto" } } },
                  },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {POKEMON_RARITIES.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Right: image management */}
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
                sx={{ mb: 2, borderRadius: 2, fontWeight: 500, borderColor: "#ccc" }}
              >
                {isEditMode ? "Add Images" : "Choose Images"}
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </Button>

              {images.length > 0 && (
                <>
                  <Box
                    sx={{
                      position: "relative",
                      mt: 1,
                      borderRadius: 3,
                      overflow: "hidden",
                      backgroundColor: "#fff",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                      p: 1.5,
                    }}
                  >
                    <img
                      src={displayUrl!}
                      alt={`Preview ${currentImageIndex + 1}`}
                      style={{
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "contain",
                        borderRadius: 12,
                        display: "block",
                      }}
                    />

                    {images.length > 1 && (
                      <>
                        <IconButton
                          onClick={handlePrevImage}
                          sx={{ position: "absolute", top: "50%", left: 12, transform: "translateY(-50%)", backgroundColor: "rgba(255,255,255,0.9)", "&:hover": { backgroundColor: "#eee" } }}
                        >
                          <ChevronLeftIcon />
                        </IconButton>
                        <IconButton
                          onClick={handleNextImage}
                          sx={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", backgroundColor: "rgba(255,255,255,0.9)", "&:hover": { backgroundColor: "#eee" } }}
                        >
                          <ChevronRightIcon />
                        </IconButton>
                      </>
                    )}

                    <IconButton
                      onClick={() => handleRemoveImage(currentImageIndex)}
                      size="small"
                      sx={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(255,255,255,0.95)", "&:hover": { backgroundColor: "#f8d7da" } }}
                    >
                      <DeleteIcon color="error" fontSize="small" />
                    </IconButton>
                  </Box>

                  {images.length > 1 && (
                    <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "center", flexWrap: "wrap" }}>
                      {images.map((slot, i) => (
                        <Box
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 1.5,
                            overflow: "hidden",
                            cursor: "pointer",
                            border: i === currentImageIndex ? "2px solid #1976d2" : "1px solid #ddd",
                          }}
                        >
                          <img
                            src={slot.kind === "existing" ? slot.url : slot.previewUrl}
                            alt={`Thumb ${i + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
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
            sx={{ mt: 4, py: 1.3, borderRadius: 2, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}
          >
            {uploading ? <CircularProgress size={22} /> : isEditMode ? "Save Changes" : "Upload Card"}
          </Button>

          {successMsg && (
            <Typography variant="body1" color="success.main" textAlign="center" sx={{ mt: 3, fontWeight: 500 }}>
              {successMsg}
            </Typography>
          )}
        </form>
      </Paper>
    </Box>
  );
}
