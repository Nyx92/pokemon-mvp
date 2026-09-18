"use client";
/**
 * /sold — shows orders where the current user was the seller (PAID only).
 *
 * Data:  GET /api/orders?type=sold  → { orders: OrderRow[] }
 * Auth:  client-side via useAuth; redirects to /auth/login if unauthenticated.
 * Layout: AccountLayout (sidebar + content panel)
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Typography, TextField, InputAdornment, IconButton, CircularProgress,
} from "@mui/material";
import SellIcon from "@mui/icons-material/Sell";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import { useAuth } from "@/app/hooks/useAuth";
import AccountLayout from "@/app/shared-components/AccountLayout";
import AccountLoadingGate from "@/app/shared-components/AccountLoadingGate";
import ErrorState from "@/app/shared-components/ErrorState";
import EmptyState from "@/app/shared-components/EmptyState";
import { OrderCard, type OrderRow } from "@/app/shared-components/transaction-cards";
import { motion, AnimatePresence } from "framer-motion";

export default function SoldPage() {
  const { isLoggedIn, status } = useAuth();
  const router = useRouter();

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "loading" && !isLoggedIn) router.replace("/auth/login");
  }, [status, isLoggedIn, router]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [sold, setSold]       = useState<OrderRow[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [q, setQ]             = useState("");
  // Tracks the isLoggedIn value that `sold`/`error` currently reflect.
  // `loading` is derived by comparing it against the live isLoggedIn value
  // instead of a separately re-armed boolean, so the fetch effect below
  // never needs to call setState synchronously as its first statement
  // (react-hooks/set-state-in-effect flags that shape).
  const [loadedFor, setLoadedFor] = useState<boolean | null>(null);
  const loading = isLoggedIn && loadedFor !== isLoggedIn;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/orders?type=sold")
      .then((r) => r.json())
      .then((d) => { if (d.orders) setSold(d.orders); else setError(d.error); })
      .catch(() => setError("Failed to load sold items."))
      .finally(() => setLoadedFor(isLoggedIn));
  }, [isLoggedIn]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  // Only show PAID orders — same reasoning as /purchases
  const filtered = useMemo(() => {
    const paid = sold.filter((o) => o.status === "PAID");
    if (!q.trim()) return paid;
    const lq = q.toLowerCase();
    return paid.filter((o) =>
      [o.card.title, o.card.condition, `S$${o.amount}`, o.id]
        .join(" ").toLowerCase().includes(lq)
    );
  }, [sold, q]);

  // ── Loading / auth wait ──────────────────────────────────────────────────────
  if (status === "loading" || !isLoggedIn) {
    return <AccountLoadingGate />;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // 1. Show full-page error state so the user has a clear recovery path.
  if (error) {
    return (
      <AccountLayout>
        <ErrorState
          variant="error"
          title="Couldn't load your sales"
          action={{ label: "Refresh page", onClick: () => window.location.reload() }}
        />
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Sold
        </Typography>
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by card name, condition, amount…"
          size="small"
          sx={{ width: { xs: "100%", md: 340 }, "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#fff" } }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#6b7280" }} /></InputAdornment>,
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setQ("")} aria-label="Clear search" size="small"><CloseIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </Box>
      </motion.div>

      {/* Order list */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SellIcon sx={{ fontSize: 40, color: "#d1d5db" }} />}
            title={q ? "No sales match your search." : "You haven't sold anything yet."}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={q}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {filtered.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut", delay: Math.min(i * 0.06, 0.3) }}
                >
                  <OrderCard order={o} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </Box>
    </AccountLayout>
  );
}
