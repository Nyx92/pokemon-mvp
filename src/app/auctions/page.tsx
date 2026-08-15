"use client";
/**
 * /auctions — browse all live auctions.
 *
 * Fetches GET /api/auctions (returns up to 100 active auctions).
 * Renders a responsive grid of AuctionCardItem tiles.
 * Clicking a tile navigates to the card detail page where the buyer can place a bid.
 */

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, CircularProgress, Tabs, Tab, Typography } from "@mui/material";
import { motion, type Variants } from "framer-motion";
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import AuctionCardItem from "@/app/shared-components/cards/AuctionCardItem";
import ErrorState from "@/app/shared-components/ErrorState";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistIds } from "@/app/hooks/useWatchlistIds";
import type { AuctionItem } from "@/types/auction";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT, frostedTabsSx } from "@/app/utils/navChrome";

// ── Animation variants ────────────────────────────────────────────────────────
// 1. Individual auction tile: slides up on enter.
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
// 2. Grid container: staggers tiles in once data has loaded.
const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export default function AuctionsPage() {
  const pathname     = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();
  const [auctions,   setAuctions]   = useState<AuctionItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const watchlistedIds              = useWatchlistIds();

  // 1. Load all active auctions on mount; surface error state on failure.
  useEffect(() => {
    fetch("/api/auctions")
      .then((r) => r.json())
      .then((data) => { if (data.auctions) setAuctions(data.auctions); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG_Ships.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: { xs: "88px", md: "112px" },
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
        {/* Shared nav tabs — mirrors myCollection and marketplace pages */}
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs
            value={pathname}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={frostedTabsSx}
          >
            {isLoggedIn && (
              <Tab component={Link} href="/myCollection" icon={<CollectionsIcon />} label="My Collection" iconPosition="start" value="/myCollection" />
            )}
            <Tab component={Link} href="/marketplace" icon={<StorefrontIcon />} label="Marketplace" iconPosition="start" value="/marketplace" />
            <Tab component={Link} href="/auctions"    icon={<GavelIcon />}      label="Auctions"    iconPosition="start" value="/auctions" />
            {isAdmin && (
              <Tab component={Link} href="/upload" icon={<UploadIcon />} label="Upload Card" iconPosition="start" value="/upload" />
            )}
          </Tabs>
        </Box>

        <Box sx={{ mt: 4 }}>
          {/* Page header — icon intentionally omitted to match myCollection / marketplace style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1, color: "#fff" }}>
                Live Auctions
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
                Bid on rare Pokémon cards. Funds are only charged if your bid wins.
              </Typography>
            </Box>
          </motion.div>

          {/* 2. Error state — fetch failed */}
          {fetchError && (
            <ErrorState
              variant="error"
              title="Couldn't load auctions"
              action={{ label: "Refresh page", onClick: () => window.location.reload() }}
              dark
            />
          )}

          {/* Loading state */}
          {!fetchError && loading && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {/* 3. Empty state: container fades in, then the icon spring-bounces
                 (spring feels livelier than a linear fade for a small icon). */}
          {!fetchError && !loading && auctions.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center", marginTop: "80px" }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.1 }}
                style={{ display: "inline-block" }}
              >
                <GavelIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.4)", mb: 2 }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
              >
                <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.8)" }}>
                  No live auctions right now.
                </Typography>
                <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.5)", mt: 0.5 }}>
                  Check back soon — sellers list new auctions regularly.
                </Typography>
              </motion.div>
            </motion.div>
          )}

          {/* Auction grid */}
          {!fetchError && !loading && auctions.length > 0 && (
            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "16px",
              }}
            >
              {auctions.map((auction) => (
                <motion.div key={auction.id} variants={cardVariants}>
                  <AuctionCardItem
                    auction={auction}
                    watchlisted={watchlistedIds.has(auction.cardId)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </Box>
      </Box>
    </Box>
  );
}
