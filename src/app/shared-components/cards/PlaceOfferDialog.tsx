"use client";

/**
 * PlaceOfferDialog — Buyer places or amends an offer on a card.
 *
 * ── High-level flow ────────────────────────────────────────────────────────
 *
 *  Step 1 (UI: price + message)
 *    The buyer types their offer price and an optional message.
 *
 *  Step 2 (UI: card details via Stripe CardElement)
 *    After clicking "Continue", the form reveals a Stripe-hosted card input.
 *    The buyer enters their card number / expiry / CVC directly into the
 *    Stripe-rendered element — we never touch or store card data ourselves.
 *
 *  Step 3 (Submit button)
 *    3a. POST /api/offers/payment-intent  →  Stripe creates a PaymentIntent
 *        with capture_method: "manual". We get back a clientSecret.
 *    3b. stripe.confirmCardPayment(clientSecret, { card: cardElement })
 *        →  Stripe authorises (holds) the funds on the buyer's card.
 *           Money is NOT moved yet — just ring-fenced.
 *    3c. POST /api/offers with { cardId, price, message, paymentIntentId }
 *        →  Our API stores the offer in the DB, linked to the PI.
 *
 *  On seller accept:
 *    The seller clicks "Accept" in SellerOffersDialog →
 *    PATCH /api/offers/[id] { action: "accept" } captures the PI (money
 *    moves) and transfers the card in one atomic operation.
 *
 *  On seller reject / offer expiry:
 *    The PI is cancelled → hold released → buyer sees no charge.
 *
 * ── Amend mode ──────────────────────────────────────────────────────────────
 *    If existingOffer is passed, the dialog pre-fills price/message.
 *    The submit flow is identical to a new offer — the server cancels the
 *    old PaymentIntent and updates the offer record in place.
 */

import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
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

// Why do we need NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY here but NOT in Buy Now?
//
// Buy Now redirects the buyer to Stripe's own hosted page (checkout.stripe.com).
// Stripe collects the card number on their site — our frontend never touches it.
// No publishable key needed because our app is completely out of the picture.
//
// Place Offer is different: the CardElement (card input) is embedded directly
// inside our dialog. The buyer never leaves our page. For Stripe to render that
// card input and know which Stripe account the card data belongs to, it needs
// the publishable key. Think of it as Stripe asking: "which account should I
// send this card to?" — the publishable key is the answer.
//
// The NEXT_PUBLIC_ prefix is a Next.js convention that makes the env var
// available in the browser bundle (normally env vars are server-only).
// The publishable key is safe to expose — it can only tokenise card data,
// it cannot charge, refund, or read any account information.
//
// loadStripe() is called once at module level (not inside a component) so
// the same Promise is reused across renders — avoids re-creating the Stripe
// iframe on every render.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
);

// ── Stripe CardElement visual options ──────────────────────────────────────
// These style the iframe Stripe renders for card input. The font/colour here
// matches the rest of the MUI form so the Stripe element doesn't look alien.
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "14px",
      color: "#111",
      fontFamily: "inherit",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
  },
};

// ── Props ──────────────────────────────────────────────────────────────────
interface PlaceOfferDialogProps {
  open: boolean;
  cardId: string;
  cardTitle: string;
  listingPrice: number | null;
  // Optional: buyer's current pending offer (if any). Used to pre-fill the
  // form (amend mode). The server identifies the existing offer by
  // cardId + buyerId — we never need to send the offer id.
  existingOffer?: { id: string; price: number; message: string | null } | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Inner form component ───────────────────────────────────────────────────
// Stripe hooks (useStripe, useElements) must be called inside an <Elements>
// provider. We split the form into its own component so the hooks are always
// called inside the provider tree.
function OfferForm({
  cardId,
  cardTitle,
  listingPrice,
  existingOffer,
  onClose,
  onSuccess,
}: Omit<PlaceOfferDialogProps, "open">) {
  const stripe = useStripe();
  const elements = useElements();

  const isAmend = !!existingOffer;

  // ── Local state ──────────────────────────────────────────────────────────
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  // "card" step shown after buyer fills in price; "details" is price+message
  const [step, setStep] = useState<"details" | "card">("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [amended, setAmended] = useState(false);

  // Pre-fill form when opening in amend mode, or reset for a new offer.
  // Runs whenever the dialog opens or existingOffer changes.
  useEffect(() => {
    if (existingOffer) {
      setPrice(existingOffer.price.toFixed(2));
      setMessage(existingOffer.message ?? "");
    } else {
      setPrice("");
      setMessage("");
    }
    setStep("details");
    setError(null);
    setSuccess(false);
    setAmended(false);
  }, [existingOffer]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  // ── Step 1 → Step 2: validate price then show card input ─────────────────
  const handleContinue = () => {
    const parsed = parseFloat(price);
    if (!price || isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid offer price.");
      return;
    }
    setError(null);
    setStep("card");
  };

  // ── Step 2: submit the full offer ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (!stripe || !elements) {
      // Stripe.js hasn't finished loading yet. This shouldn't normally happen
      // but we guard against it to avoid a runtime crash.
      setError("Stripe is not ready. Please try again.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card element not found. Please refresh and try again.");
      return;
    }

    const parsed = parseFloat(price);
    if (!price || isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid offer price.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── 3a. Create a Stripe PaymentIntent (authorise-only) ──────────────
      // We send the price in DOLLARS here; the server converts to cents.
      // The endpoint returns a clientSecret (used by Stripe to confirm the
      // card) and paymentIntentId (stored in our DB on the offer).
      const piRes = await fetch("/api/offers/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          // Convert dollars → cents for the Stripe PI amount.
          // (Stripe amounts are always in the smallest currency unit)
          price: Math.round(parsed * 100),
        }),
      });
      const piData = await piRes.json();
      if (!piRes.ok) {
        setError(piData.error ?? "Failed to initialise payment.");
        return;
      }

      // ── 3b. Confirm the card (authorise / hold funds) ───────────────────
      // stripe.confirmCardPayment() sends the card details from the
      // CardElement to Stripe. Stripe contacts the buyer's card issuer and
      // rings-fences (authorises) the funds.
      // The money is NOT charged yet — that only happens when the seller
      // accepts and PATCH /api/offers/[id] calls stripe.paymentIntents.capture().
      const { error: stripeError } = await stripe.confirmCardPayment(
        piData.clientSecret,
        {
          payment_method: { card: cardElement },
        }
      );

      if (stripeError) {
        // Card declined, insufficient funds, 3DS failure, etc.
        // stripeError.message is buyer-friendly (Stripe formats it).
        setError(stripeError.message ?? "Card authorisation failed.");
        return;
      }

      // ── 3c. Save the offer in our database ─────────────────────────────
      // We send paymentIntentId so the server can link the offer to the PI.
      // The server will:
      //   - Create a new offer (or update the existing pending one if amending)
      //   - Store paymentIntentId and expiresAt (24h from now)
      const offerRes = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          price: parsed, // in dollars — server converts to cents
          message: message.trim() || null,
          paymentIntentId: piData.paymentIntentId,
        }),
      });
      const offerData = await offerRes.json();
      if (!offerRes.ok) {
        setError(offerData.error ?? "Failed to place offer.");
        return;
      }

      // `amended` tells us whether the server updated an existing offer (true)
      // or created a new one (false). Used only for the success message.
      setAmended(offerData.amended);
      setSuccess(true);

      // Wait 1.2s so the buyer can read the success message, then close.
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GavelIcon sx={{ color: "#0053ff" }} />
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {isAmend ? "Amend Offer" : "Place an Offer"}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Card title + listing price for context */}
        <Typography sx={{ fontSize: 13, color: "#6b7280", mb: 2 }}>
          {cardTitle}
          {listingPrice != null && (
            <>
              {" "}
              &mdash; listed at <strong>S${listingPrice.toFixed(2)}</strong>
            </>
          )}
        </Typography>

        {success ? (
          // ── Success state ───────────────────────────────────────────────
          <Alert severity="success">
            {amended ? "Offer updated!" : "Offer placed!"} Funds are authorised
            and the seller will be notified.
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {error}
              </Alert>
            )}

            {/* ── Step 1: price + message ─────────────────────────────── */}
            {step === "details" && (
              <>
                {isAmend && (
                  <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>
                    You already have a pending offer. Submitting will update it
                    (your card will be re-authorised for the new amount).
                  </Alert>
                )}

                <TextField
                  label="Your offer (S$)"
                  type="number"
                  slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
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

            {/* ── Step 2: Stripe card input ───────────────────────────── */}
            {step === "card" && (
              <>
                {/* Remind buyer of the price they're authorising */}
                <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                  Your card will be authorised for{" "}
                  <strong>S${parseFloat(price).toFixed(2)}</strong>. Funds are
                  only charged if the seller accepts — otherwise the hold is
                  released automatically.
                </Alert>

                {/* Stripe-rendered card input (iframe).
                    CardElement handles PCI compliance — card data goes
                    directly to Stripe, never through our servers. */}
                <Box
                  sx={{
                    border: "1px solid #d1d5db",
                    borderRadius: 1,
                    px: 1.5,
                    py: 1.5,
                    "&:focus-within": { borderColor: "#0053ff" },
                  }}
                >
                  <CardElement options={CARD_ELEMENT_OPTIONS} />
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      {!success && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Cancel
          </Button>

          {/* Step 1: Continue validates price and shows card input */}
          {step === "details" && (
            <Button
              onClick={handleContinue}
              variant="contained"
              sx={{
                backgroundColor: "#0053ff",
                "&:hover": { backgroundColor: "#0041cc" },
                textTransform: "none",
              }}
            >
              Continue
            </Button>
          )}

          {/* Step 2: Submit authorises card and saves offer */}
          {step === "card" && (
            <Button
              onClick={handleSubmit}
              disabled={loading || !stripe}
              variant="contained"
              sx={{
                backgroundColor: "#0053ff",
                "&:hover": { backgroundColor: "#0041cc" },
                textTransform: "none",
              }}
              startIcon={
                loading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : undefined
              }
            >
              {loading
                ? "Submitting…"
                : isAmend
                  ? "Update Offer"
                  : "Submit Offer"}
            </Button>
          )}
        </DialogActions>
      )}
    </>
  );
}

// ── Outer dialog component ─────────────────────────────────────────────────
// Wraps the form in an <Elements> provider so useStripe / useElements work.
// The <Elements> provider must be an ancestor of any component that calls
// those hooks — it sets up the Stripe iframe context.
export default function PlaceOfferDialog({
  open,
  cardId,
  cardTitle,
  listingPrice,
  existingOffer,
  onClose,
  onSuccess,
}: PlaceOfferDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* Elements must wrap the component that uses useStripe/useElements */}
      <Elements stripe={stripePromise}>
        <OfferForm
          cardId={cardId}
          cardTitle={cardTitle}
          listingPrice={listingPrice}
          existingOffer={existingOffer}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </Elements>
    </Dialog>
  );
}
