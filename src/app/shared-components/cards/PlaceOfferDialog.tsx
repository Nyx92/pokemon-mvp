"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";

interface PlaceOfferDialogProps {
  open: boolean;
  cardId: string;
  cardTitle: string;
  listingPrice: number | null;
  // Optional: the buyer's current pending offer on this card.
  // Used purely for UI purposes — pre-fills the form so the buyer can see
  // what they previously offered and edit from there.
  // The actual upsert logic lives server-side in POST /api/offers; it finds
  // the existing offer by cardId + buyerId, so we never need to send the id.
  existingOffer?: { id: string; price: number; message: string | null } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlaceOfferDialog({
  open,
  cardId,
  cardTitle,
  listingPrice,
  existingOffer,
  onClose,
  onSuccess,
}: PlaceOfferDialogProps) {
  // isAmend drives the title, button label, and info banner
  const isAmend = !!existingOffer;

  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // amended is returned by the API — true if an existing offer was updated,
  // false if a new one was created. Used to show the right success message.
  const [amended, setAmended] = useState(false);

  // When the dialog opens, pre-fill with the existing offer values (amend mode)
  // or reset to empty (new offer mode).
  // Runs whenever `open` or `existingOffer` changes.
  useEffect(() => {
    if (open && existingOffer) {
      setPrice(existingOffer.price.toFixed(2));
      setMessage(existingOffer.message ?? "");
    } else if (open) {
      setPrice("");
      setMessage("");
    }
    setError(null);
    setSuccess(false);
  }, [open, existingOffer]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async () => {
    const parsed = parseFloat(price);
    if (!price || isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid offer price.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Always POST — the API handles both create and update.
      // If a pending offer already exists for this buyer+card, the server
      // updates it in place and returns { amended: true }.
      // If not, it creates a new offer and returns { amended: false }.
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, price: parsed, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to place offer.");
        return;
      }
      setAmended(data.amended);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GavelIcon sx={{ color: "#0053ff" }} />
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {isAmend ? "Amend Offer" : "Place an Offer"}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "#6b7280", mb: 2 }}>
          {cardTitle}
          {listingPrice != null && (
            <> &mdash; listed at <strong>S${listingPrice.toFixed(2)}</strong></>
          )}
        </Typography>

        {success ? (
          <Alert severity="success">
            {amended ? "Offer updated!" : "Offer placed!"} The seller will review it.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

            {isAmend && (
              <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>
                You already have a pending offer. Submitting will update it.
              </Alert>
            )}

            <TextField
              label="Your offer (S$)"
              type="number"
              inputProps={{ min: 0.01, step: 0.01 }}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 1.5 }}
              disabled={loading}
            />

            <TextField
              label="Message (optional)"
              multiline
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              size="small"
              placeholder="E.g. I can pick up in person"
              disabled={loading}
            />
          </>
        )}
      </DialogContent>

      {!success && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant="contained"
            sx={{
              backgroundColor: "#0053ff",
              "&:hover": { backgroundColor: "#0041cc" },
              textTransform: "none",
            }}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {loading ? "Submitting…" : isAmend ? "Update Offer" : "Submit Offer"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
