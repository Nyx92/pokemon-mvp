"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/hooks/useAuth";
import Marketplace from "./MarketPlace";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { motion } from "framer-motion";
import CollectionsIcon from "@mui/icons-material/Collections";
import GavelIcon from "@mui/icons-material/Gavel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import UploadIcon from "@mui/icons-material/Upload";
import { pageBackgroundSx } from "@/app/utils/pageBackground";
import { NAVBAR_HEIGHT, frostedTabsSx } from "@/app/utils/navChrome";

export default function MarketplacePage() {
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();

  return (
    <Box
      component="main"
      sx={{
        ...pageBackgroundSx("/collateral/Riftbound_BG_Market.jpg"),
        mt: `-${NAVBAR_HEIGHT}px`,
        pt: { xs: "88px", md: "112px" },
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
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
              <Tab
                component={Link}
                href="/myCollection"
                icon={<CollectionsIcon />}
                label="My Collection"
                iconPosition="start"
                value="/myCollection"
              />
            )}
            <Tab
              component={Link}
              href="/marketplace"
              icon={<StorefrontIcon />}
              label="Marketplace"
              iconPosition="start"
              value="/marketplace"
            />
            <Tab
              component={Link}
              href="/auctions"
              icon={<GavelIcon />}
              label="Auctions"
              iconPosition="start"
              value="/auctions"
            />
            {isAdmin && (
              <Tab
                component={Link}
                href="/upload"
                icon={<UploadIcon />}
                label="Upload Card"
                iconPosition="start"
                value="/upload"
              />
            )}
          </Tabs>
        </Box>

        <Box sx={{ mt: 4 }}>
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Box sx={{ mb: 4 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1.1, color: "#fff" }}>
                Marketplace
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
                Browse and buy Pokémon cards listed by other collectors.
              </Typography>
            </Box>
          </motion.div>

          <Marketplace />
        </Box>
      </Box>
    </Box>
  );
}
