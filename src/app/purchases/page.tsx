"use client";
/**
 * /purchases — shows the current user's completed purchases (PAID orders only).
 *
 * Data:  GET /api/orders?type=purchases  → { orders: OrderRow[] }
 * Auth:  client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 *
 * The ?success=1 query param is set by the Stripe checkout redirect
 * (see src/app/api/checkout/route.ts successUrl) and triggers a success banner.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box, Typography, TextField, InputAdornment, IconButton,
  CircularProgress, Alert, Button,
} from "@mui/material";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import { OrderCard, type OrderRow } from "@/app/shared-components/transaction-cards";

export default function PurchasesPage() {
  const { isLoggedIn, status } = useAuth();
  const router   = useRouter();
  const params   = useSearchParams();

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [purchases, setPurchases] = useState<OrderRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [q, setQ]                 = useState("");

  // Success banner — shown when Stripe redirects back with ?success=1
  const [showSuccess, setShowSuccess] = useState(params.get("success") === "1");

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetch("/api/orders?type=purchases")
      .then((r) => r.json())
      .then((d) => { if (d.orders) setPurchases(d.orders); else setError(d.error); })
      .catch(() => setError("Failed to load purchases."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  // Only show PAID orders — PENDING = abandoned checkout, EXPIRED = timed out
  const filtered = useMemo(() => {
    const paid = purchases.filter((o) => o.status === "PAID");
    if (!q.trim()) return paid;
    const lq = q.toLowerCase();
    return paid.filter((o) =>
      [o.card.title, o.card.condition, `S$${o.amount}`, o.id]
        .join(" ").toLowerCase().includes(lq)
    );
  }, [purchases, q]);

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
          Purchases
        </Typography>
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by card name, condition, amount…"
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

      {/* Payment success banner — shown after Stripe checkout redirect */}
      {showSuccess && (
        <Box sx={{ mb: 3, border: "1px solid rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.07)", borderRadius: 2, px: 2.5, py: 1.4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <ShoppingBagIcon sx={{ color: "#065f46" }} />
            <Box>
              <Typography sx={{ fontWeight: 800, color: "#065f46" }}>Payment successful</Typography>
              <Typography sx={{ fontSize: 13, color: "#047857" }}>Your transaction has been recorded below.</Typography>
            </Box>
          </Box>
          <Button variant="text" sx={{ textTransform: "none", fontWeight: 700, color: "#047857" }} onClick={() => setShowSuccess(false)}>
            Dismiss
          </Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Order list */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <ShoppingBagIcon sx={{ fontSize: 40, color: "#d1d5db", mb: 1 }} />
            <Typography sx={{ color: "#9ca3af", fontSize: 15 }}>
              {q ? "No purchases match your search." : "You haven't purchased anything yet."}
            </Typography>
          </Box>
        ) : (
          filtered.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </Box>
    </AccountLayout>
  );
}
