"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  CircularProgress,
  Typography,
} from "@mui/material";

interface EditPriceDialogProps {
  open: boolean;
  cardId: string;
  currentPrice: number | null;
  currentForSale: boolean;
  onClose: () => void;
  onSuccess: (updatedPrice: number | null, updatedForSale: boolean) => void;
}

export default function EditPriceDialog({
  open,
  cardId,
  currentPrice,
  currentForSale,
  onClose,
  onSuccess,
}: EditPriceDialogProps) {
  const [price, setPrice] = useState(
    currentPrice != null ? String(currentPrice) : ""
  );
  const [forSale, setForSale] = useState(currentForSale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (forSale && (!price || Number.isNaN(Number(price)))) {
      setError("Enter a valid price.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("price", forSale ? price : "");
      body.append("forSale", String(forSale));

      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PUT",
        body,
      });
      if (!res.ok) throw new Error("Failed to update.");
      const data = await res.json();
      onSuccess(data.card.price, data.card.forSale);
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Edit Listing</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <FormControlLabel
          control={
            <Switch
              checked={forSale}
              onChange={(e) => {
                setForSale(e.target.checked);
                if (!e.target.checked) setPrice("");
              }}
            />
          }
          label="List for sale"
        />
        <TextField
          label="Price (SGD)"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={!forSale}
          fullWidth
          size="small"
        />
        {error && (
          <Typography color="error" fontSize={13}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {saving ? <CircularProgress size={18} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
