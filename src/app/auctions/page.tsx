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
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import AuctionCardItem from "@/app/shared-components/cards/AuctionCardItem";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistIds } from "@/app/hooks/useWatchlistIds";
import type { AuctionItem } from "@/types/auction";

export default function AuctionsPage() {
  const pathname     = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const watchlistedIds          = useWatchlistIds();

  // Load all active auctions on mount
  useEffect(() => {
    fetch("/api/auctions")
      .then((r) => r.json())
      .then((data) => { if (data.auctions) setAuctions(data.auctions); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
    <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
      {/* Shared nav tabs — mirrors myCollection and marketplace pages */}
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Tabs
          value={pathname}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTabs-flexContainer": { justifyContent: "center" },
            "& .MuiTab-root": {
              fontWeight: 600,
              fontSize: "1.05rem",
              letterSpacing: "0.5px",
              textTransform: "none",
              color: "#333",
              minHeight: 50,
            },
            "& .Mui-selected": { color: "black" },
            "& .MuiTabs-indicator": { backgroundColor: "black", height: 3, borderRadius: 2 },
          }}
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
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1 }}>
            Live Auctions
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", mt: 0.25 }}>
            Bid on rare Pokémon cards. Funds are only charged if your bid wins.
          </Typography>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty state */}
        {!loading && auctions.length === 0 && (
          <Box sx={{ textAlign: "center", mt: 10 }}>
            <GavelIcon sx={{ fontSize: 48, color: "#d1d5db", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No live auctions right now.
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#9ca3af", mt: 0.5 }}>
              Check back soon — sellers list new auctions regularly.
            </Typography>
          </Box>
        )}

        {/* Auction grid */}
        {!loading && auctions.length > 0 && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            {auctions.map((auction) => (
              <AuctionCardItem
                key={auction.id}
                auction={auction}
                watchlisted={watchlistedIds.has(auction.cardId)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
    </main>
  );
}
