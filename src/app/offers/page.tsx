"use client";
/**
 * /offers — shows the current user's offer activity, split into two views:
 *
 *   "Offers Placed"   — offers I made on other sellers' cards
 *                       Data: GET /api/offers?mine=true
 *   "Incoming Offers" — offers other buyers made on my listings
 *                       Data: GET /api/offers?received=true
 *
 * Both fetches run in parallel on mount. A dropdown lets the user switch views.
 *
 * Auth:   client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, TextField, InputAdornment, IconButton,
  CircularProgress, Alert, Select, MenuItem, Divider,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import {
  PlacedOfferCard, ReceivedOfferCard,
  type OfferRow, type ReceivedOfferRow,
} from "@/app/shared-components/transaction-cards";

export default function OffersPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [placedOffers, setPlacedOffers]     = useState<OfferRow[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<ReceivedOfferRow[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [q, setQ]                           = useState("");

  // Controls which view is shown — "placed" | "received"
  const [offerView, setOfferView] = useState<"placed" | "received">("placed");

  // ── Fetch (parallel) ─────────────────────────────────────────────────────────
  // Both endpoints are called simultaneously to avoid sequential waterfalls.
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.all([
      fetch("/api/offers?mine=true").then((r) => r.json()),
      fetch("/api/offers?received=true").then((r) => r.json()),
    ])
      .then(([placed, received]) => {
        if (placed.offers)   setPlacedOffers(placed.offers);   else setError(placed.error);
        if (received.offers) setReceivedOffers(received.offers);
      })
      .catch(() => setError("Failed to load offers."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  // Exclude "paid" status from placed offers — those show in /purchases instead.
  const filteredPlaced = useMemo(() => {
    const active = placedOffers.filter((o) => o.status !== "paid");
    if (!q.trim()) return active;
    const lq = q.toLowerCase();
    return active.filter((o) =>
      [o.card.title, o.status, `S$${o.price}`].join(" ").toLowerCase().includes(lq)
    );
  }, [placedOffers, q]);

  const filteredReceived = useMemo(() => {
    if (!q.trim()) return receivedOffers;
    const lq = q.toLowerCase();
    return receivedOffers.filter((o) =>
      [o.card.title, `S$${o.price}`].join(" ").toLowerCase().includes(lq)
    );
  }, [receivedOffers, q]);

  // ── Loading / auth wait ──────────────────────────────────────────────────────
  if (status === "loading" || !isLoggedIn) {
    return (
      <AccountLayout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
          <CircularProgress />
        </Box>
      </AccountLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AccountLayout>
      {/* Page header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px" }}>
          My Offers
        </Typography>
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by card name, amount…"
          size="small"
          sx={{ width: { xs: "100%", md: 340 }, "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#fff" } }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#9ca3af" }} /></InputAdornment>,
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setQ("")} size="small"><CloseIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* View selector dropdown */}
          <Box sx={{ mb: 3 }}>
            <Select
              value={offerView}
              onChange={(e) => setOfferView(e.target.value as "placed" | "received")}
              size="small"
              sx={{ minWidth: 220, backgroundColor: "#fff", borderRadius: 1.5, fontWeight: 600, fontSize: 14 }}
            >
              <MenuItem value="placed">Offers Placed</MenuItem>
              <MenuItem value="received">Incoming Offers</MenuItem>
            </Select>
          </Box>

          {/* Section title mirrors the dropdown selection */}
          <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px", mb: 2.5 }}>
            {offerView === "placed" ? "Offers Placed" : "Incoming Offers"}
          </Typography>

          {/* ── Offers Placed ── */}
          {offerView === "placed" && (
            filteredPlaced.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 10 }}>
                <GavelIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
                  {q ? "No offers match your search." : "You haven't placed any offers yet."}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Active offers (not archived) */}
                {filteredPlaced.filter((o) => !o.archivedAt).map((o) => (
                  <PlacedOfferCard key={o.id} offer={o} />
                ))}
                {/* Archived offers — card was sold to someone else */}
                {filteredPlaced.filter((o) => !!o.archivedAt).length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", mb: 0.5 }}>
                      Past — card no longer available
                    </Typography>
                    {filteredPlaced.filter((o) => !!o.archivedAt).map((o) => (
                      <PlacedOfferCard key={o.id} offer={o} />
                    ))}
                  </>
                )}
              </Box>
            )
          )}

          {/* ── Incoming Offers ── */}
          {offerView === "received" && (
            filteredReceived.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 10 }}>
                <GavelIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
                <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
                  {q ? "No offers match your search." : "No incoming offers on your listings."}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {filteredReceived.map((o) => (
                  <ReceivedOfferCard
                    key={o.id}
                    offer={o}
                    // Remove from the list immediately after accept/reject
                    // (the offer is no longer pending so the API won't return it anyway)
                    onRespond={(id) => setReceivedOffers((prev) => prev.filter((r) => r.id !== id))}
                  />
                ))}
              </Box>
            )
          )}
        </>
      )}
    </AccountLayout>
  );
}
